import { isTaskStatus, NotFoundError } from "@aichestra/core";
import type { Task, TaskStatus } from "@aichestra/core";
import type { InMemoryAichestraStore } from "@aichestra/db";
import type { GitProviderRuntimeConfig } from "@aichestra/git-adapter";
import type { RegistryService } from "@aichestra/registry";
import { agentRunToDto } from "@aichestra/runner";
import type { AgentRunnerRuntimeConfig, AgentRunnerService } from "@aichestra/runner";
import { runAgentTaskWorkflow } from "@aichestra/worker";
import type { ApiRequestContextMiddleware } from "../request-context-middleware.ts";

export type TaskApiServiceContext = {
  store: InMemoryAichestraStore;
  registryService: RegistryService;
  apiRequestContextMiddleware: ApiRequestContextMiddleware;
  agentRunnerService: AgentRunnerService;
  agentRunnerConfig: AgentRunnerRuntimeConfig;
  gitProviderConfig: GitProviderRuntimeConfig;
};

export type TaskRunAgentRequest = {
  task: Task;
  requestContext: ReturnType<ApiRequestContextMiddleware["requireApiContext"]>;
};

export type ApiServiceResult = {
  statusCode: number;
  body: Record<string, unknown> | unknown[];
};

function notFound(resource: string, id: string): never {
  throw new NotFoundError(resource, id);
}

function taskView(task: Task): Record<string, unknown> {
  return {
    ...task,
    state: task.status
  };
}

export class TaskApiService {
  private readonly context: TaskApiServiceContext;

  constructor(context: TaskApiServiceContext) {
    this.context = context;
  }

  createTask(input: unknown): ApiServiceResult {
    return { statusCode: 201, body: taskView(this.context.store.createTask(input)) };
  }

  listTasks(): ApiServiceResult {
    return { statusCode: 200, body: { tasks: this.context.store.listTasks().map(taskView) } };
  }

  getTaskOrThrow(taskId: string | undefined): Task {
    if (!taskId) notFound("task", "");
    return this.context.store.getTask(taskId) ?? notFound("task", taskId);
  }

  getTaskDetail(task: Task): ApiServiceResult {
    const store = this.context.store;
    return {
      statusCode: 200,
      body: {
        task: taskView(task),
        taskRuns: store.listTaskRuns(task.id),
        pullRequests: store.listPullRequests(task.id),
        usageEvents: store.listUsageEvents().filter((event) => event.taskId === task.id)
      }
    };
  }

  async runWorkflow(task: Task): Promise<ApiServiceResult> {
    const store = this.context.store;
    const result = await runAgentTaskWorkflow(task.id, { store });
    const updatedTask = store.getTask(task.id) ?? task;
    return {
      statusCode: 200,
      body: {
        task: taskView(updatedTask),
        result,
        taskRuns: store.listTaskRuns(task.id),
        pullRequests: store.listPullRequests(task.id),
        usageEvents: store.listUsageEvents().filter((event) => event.taskId === task.id)
      }
    };
  }

  async runAgent(input: TaskRunAgentRequest): Promise<ApiServiceResult> {
    const { task, requestContext } = input;
    const { store, registryService } = this.context;
    const activeRun = store.listTaskRuns(task.id).find((run) => run.status === "queued" || run.status === "running");
    if (activeRun) {
      return {
        statusCode: 409,
        body: { error: "conflict", message: `Task ${task.id} already has active run ${activeRun.id}` }
      };
    }

    const agent = task.selectedAgent ?? "codex";
    const registryResolution = registryService.resolveRegistryContextForTask({
      task,
      agent,
      repo: store.getRepo(task.repoId),
      requestContext
    });
    const selectedHarness = registryResolution.selectedHarness.id ? store.getHarness(registryResolution.selectedHarness.id) : undefined;
    const taskRun = store.createTaskRun({
      taskId: task.id,
      attempt: store.listTaskRuns(task.id).length + 1,
      status: "running",
      agent,
      model: task.selectedModel ?? "mock-coder@1.0",
      modelProvider: "mock",
      selectedHarnessId: selectedHarness?.id,
      harnessVersion: `${registryResolution.selectedHarness.name}@${registryResolution.selectedHarness.version}`,
      selectedSkillRefs: registryResolution.selectedSkills,
      selectedHarnessRef: registryResolution.selectedHarness,
      selectedInstructionRefs: registryResolution.selectedInstructions,
      registryResolutionWarnings: registryResolution.warnings,
      registryResolutionErrors: registryResolution.errors,
      startedAt: new Date()
    });
    const agentRun = await this.context.agentRunnerService.runAgent({
      taskId: task.id,
      taskRunId: taskRun.id,
      actorId: requestContext.authContext.actor.id,
      repoRef: {
        repoId: task.repoId,
        provider: store.getRepo(task.repoId)?.provider,
        localPath: undefined
      },
      branchRef: {
        repoId: task.repoId,
        branchName: task.branchName ?? `mock-agent/${task.id}`,
        baseBranch: task.baseBranch
      },
      selectedModelRef: task.selectedModel ?? "mock-coder@1.0",
      selectedSkillRefs: registryResolution.selectedSkills,
      selectedHarnessRef: registryResolution.selectedHarness,
      selectedInstructionRefs: registryResolution.selectedInstructions,
      prompt: task.description ?? task.title,
      allowedCommands: selectedHarness?.allowedTools ?? [],
      testCommands: selectedHarness?.testCommands ?? ["pnpm test"],
      maxRuntimeMs: this.context.agentRunnerConfig.maxRuntimeMs,
      metadata: {
        budgetLimitUsd: task.budgetLimitUsd,
        gitProviderKind: this.context.gitProviderConfig.providerKind,
        source: "task_run_agent_endpoint",
        requestId: requestContext.requestId,
        correlationId: requestContext.correlationId,
        principalId: requestContext.authContext.principal.id,
        authMode: requestContext.authContext.authMode,
        taskRequesterUserId: task.requesterUserId
      }
    });
    store.updateTaskRun(taskRun.id, {
      status: agentRun.status === "completed" ? "succeeded" : "failed",
      finishedAt: new Date(),
      resultSummary: agentRun.status === "completed" ? "Agent runner completed." : `Agent runner ${agentRun.status}.`,
      changedFiles: agentRun.changedFiles,
      diffSummary: agentRun.diffSummary,
      errorMessage: agentRun.status === "completed" ? undefined : String(agentRun.metadata.reason ?? agentRun.status)
    });
    return {
      statusCode: agentRun.status === "blocked" ? 409 : 201,
      body: {
        task: taskView(store.getTask(task.id) ?? task),
        taskRun: store.listTaskRuns(task.id).find((run) => run.id === taskRun.id),
        agentRun: agentRunToDto(agentRun),
        usageEvents: store.listUsageEvents().filter((event) => event.taskRunId === taskRun.id)
      }
    };
  }

  listTaskRuns(task: Task): ApiServiceResult {
    return { statusCode: 200, body: { taskRuns: this.context.store.listTaskRuns(task.id) } };
  }

  listAgentRuns(task: Task): ApiServiceResult {
    return {
      statusCode: 200,
      body: { agentRuns: this.context.agentRunnerService.listRuns({ taskId: task.id }).map(agentRunToDto) }
    };
  }

  transitionTask(task: Task, status: TaskStatus): ApiServiceResult {
    return { statusCode: 200, body: this.context.store.transitionTask(task.id, status) as unknown as Record<string, unknown> };
  }

  startTask(task: Task): ApiServiceResult {
    if (task.status === "draft") {
      this.context.store.transitionTask(task.id, "planned");
    }
    return this.transitionTask(task, "queued");
  }

  updateTaskStatus(task: Task, input: { status?: string }): ApiServiceResult {
    if (!input.status || !isTaskStatus(input.status)) {
      return { statusCode: 400, body: { error: "Invalid status" } };
    }
    return this.transitionTask(task, input.status);
  }
}

export function createTaskApiService(context: TaskApiServiceContext): TaskApiService {
  return new TaskApiService(context);
}

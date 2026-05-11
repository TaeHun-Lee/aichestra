import { MockLlmGateway } from "@aichestra/llm-gateway";
import type { LlmGateway } from "@aichestra/llm-gateway";
import { createId } from "@aichestra/core";
import type {
  AgentPreparedRun,
  AgentRunExecutionResult,
  AgentRunInput,
  AgentRunRequest,
  AgentRunResult,
  AgentRunner,
  AgentRunnerEnvironmentValidation,
  AgentRunnerKind
} from "./agent-runner.ts";

type RouteCapableGateway = LlmGateway & {
  routeCompletion(input: {
    taskId: string;
    taskRunId: string;
    actorId?: string;
    modelRef?: string;
    prompt: string;
    systemInstructions?: string;
    maxTokens?: number;
    budgetLimitUsd?: number;
    repoId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    ok: boolean;
    reason?: string;
    result?: { id: string; providerKind: string; modelId: string };
    usageEvent?: { id: string };
  }>;
};

function changedFilesForPrompt(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes("login") || lowerPrompt.includes("auth") || lowerPrompt.includes("session")) {
    return ["src/auth/session.ts", "tests/auth/session.test.ts"];
  }
  if (lowerPrompt.includes("payment")) {
    return ["src/payments/service.ts", "tests/payments/service.test.ts"];
  }
  if (lowerPrompt.includes("infra")) {
    return ["infra/app.tf"];
  }
  return ["src/app.ts"];
}

function shouldFail(prompt: string): boolean {
  return /\b(mock-fail|force-fail|fail-task)\b/.test(prompt.toLowerCase());
}

function shouldBlock(prompt: string): boolean {
  return /\b(mock-block|blocked-command|deny-run)\b/.test(prompt.toLowerCase());
}

function hasRouteCompletion(gateway: LlmGateway): gateway is RouteCapableGateway {
  return typeof (gateway as Partial<RouteCapableGateway>).routeCompletion === "function";
}

export class MockAgentRunner implements AgentRunner {
  private llmGateway: LlmGateway;

  constructor(llmGateway: LlmGateway = new MockLlmGateway()) {
    this.llmGateway = llmGateway;
  }

  getRunnerKind(): AgentRunnerKind {
    return "mock";
  }

  async validateEnvironment(): Promise<AgentRunnerEnvironmentValidation> {
    return {
      ok: true,
      runnerKind: "mock",
      metadata: {
        externalCalls: false,
        filesystemMutation: false,
        remoteGit: false
      }
    };
  }

  async prepareRun(request: AgentRunRequest): Promise<AgentPreparedRun> {
    return {
      id: createId("agentprep"),
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      runnerKind: "mock",
      status: "prepared",
      createdAt: new Date()
    };
  }

  async executeRun(request: AgentRunRequest): Promise<AgentRunExecutionResult> {
    const now = new Date();
    if (shouldBlock(request.prompt)) {
      return {
        id: createId("agentrun"),
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        runnerKind: "mock",
        status: "blocked",
        diffSummary: "0 files changed, 0 insertions, 0 deletions",
        changedFiles: [],
        testResults: [{ command: "mock test", status: "blocked", output: "Mock runner blocked by request metadata or prompt." }],
        llmGatewayRequestIds: [],
        usageLedgerEntryIds: [],
        auditEventIds: [],
        commandExecutionResultIds: [],
        createdAt: now,
        completedAt: now,
        metadata: { reason: "mock_runner_blocked" }
      };
    }

    const route = hasRouteCompletion(this.llmGateway)
      ? await this.llmGateway.routeCompletion({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId,
        modelRef: request.selectedModelRef,
        prompt: request.prompt,
        systemInstructions: `Agent runner ${request.selectedHarnessRef.name}@${request.selectedHarnessRef.version}`,
        repoId: request.repoRef?.repoId,
        budgetLimitUsd: typeof request.metadata.budgetLimitUsd === "number" ? request.metadata.budgetLimitUsd : undefined,
        metadata: {
          source: "agent_runner",
          runnerKind: "mock"
        }
      })
      : undefined;

    if (route && !route.ok) {
      return {
        id: createId("agentrun"),
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        runnerKind: "mock",
        status: "blocked",
        diffSummary: "0 files changed, 0 insertions, 0 deletions",
        changedFiles: [],
        testResults: [{ command: "mock test", status: "blocked", output: route.reason ?? "LLM gateway blocked the runner call." }],
        llmGatewayRequestIds: [],
        usageLedgerEntryIds: [],
        auditEventIds: [],
        commandExecutionResultIds: [],
        createdAt: now,
        completedAt: new Date(),
        metadata: { reason: route.reason ?? "llm_gateway_blocked" }
      };
    }

    const changedFiles = changedFilesForPrompt(request.prompt);
    const failed = shouldFail(request.prompt);
    return {
      id: createId("agentrun"),
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      runnerKind: "mock",
      status: failed ? "failed" : "completed",
      diffSummary: `${changedFiles.length} files changed, 18 insertions, 4 deletions`,
      changedFiles,
      testResults: [{
        command: request.testCommands[0] ?? "mock test",
        status: failed ? "failed" : "passed",
        output: failed ? `Mock tests failed for ${request.taskId}.` : `Mock tests passed for ${changedFiles.length} changed file(s).`
      }],
      llmGatewayRequestIds: route?.result?.id ? [route.result.id] : [],
      usageLedgerEntryIds: route?.usageEvent?.id ? [route.usageEvent.id] : [],
      auditEventIds: [],
      commandExecutionResultIds: [],
      createdAt: now,
      completedAt: new Date(),
      metadata: {
        completionProviderKind: route?.result?.providerKind,
        completionModelId: route?.result?.modelId,
        externalCalls: false,
        remoteGit: false
      }
    };
  }

  async collectRunResult(request: AgentRunRequest): Promise<AgentRunExecutionResult | undefined> {
    return this.executeRun(request);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const completion = await this.llmGateway.complete({
      ...input,
      instructionSetHash: input.instructionSet.assembledHash
    });
    const changedFiles = changedFilesForPrompt(input.prompt);
    const failed = shouldFail(input.prompt);

    return {
      summary: `Mock agent generated a patch plan for ${input.prompt}.`,
      changedFiles,
      diffSummary: `${changedFiles.length} files changed, 18 insertions, 4 deletions`,
      usage: completion.usage,
      testsPassed: !failed,
      runnerKind: "mock",
      status: failed ? "failed" : "completed",
      testResults: [{
        command: "mock test",
        status: failed ? "failed" : "passed",
        output: failed ? `Mock tests failed for ${input.taskId}.` : `Mock tests passed for ${changedFiles.length} changed file(s).`
      }]
    };
  }
}

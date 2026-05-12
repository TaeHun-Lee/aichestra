import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { GitHubGitProvider, GitIntegrationService, MockGitProvider } from "@aichestra/git-adapter";
import { InMemoryImprovementRepository, createImprovementServices } from "@aichestra/improvement";
import { createDefaultLlmGatewayService } from "@aichestra/llm-gateway";
import {
  PolicyService,
  StaticPolicyEngine,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject,
  isPolicyAction
} from "@aichestra/policy";
import { PolicyBackedRegistryMutationAuthorizer } from "@aichestra/registry";
import { AgentRunnerService, MockAgentRunner, createAgentRunnerConfigFromEnv } from "@aichestra/runner";

function getJson(port: number, requestPath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, requestPath: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: requestPath,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized)
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(serialized);
  });
}

function subject(roles: string[] = ["system"]) {
  return createPolicySubject({ actorId: "policy-test-actor", actorKind: "system", roles });
}

test("policy models and static engine enforce default mock-first rules", () => {
  const engine = new StaticPolicyEngine();

  const mockLlm = engine.evaluate({
    subject: subject(),
    action: "llm.completion",
    resource: createPolicyResource({ resourceKind: "llm_provider", resourceId: "mock", metadata: { providerKind: "mock" } }),
    context: createPolicyContext({ providerKind: "mock", environment: { budgetAllowed: true } })
  });
  const remoteLlm = engine.evaluate({
    subject: subject(),
    action: "llm.remote_completion",
    resource: createPolicyResource({ resourceKind: "llm_provider", resourceId: "openai-compatible", metadata: { providerKind: "openai_compatible" } }),
    context: createPolicyContext({ providerKind: "openai_compatible" })
  });
  const disabledModel = engine.evaluate({
    subject: subject(),
    action: "llm.model.use",
    resource: createPolicyResource({ resourceKind: "llm_model", resourceId: "mock-coder@1.0", metadata: { status: "disabled" } }),
    context: createPolicyContext({ modelId: "mock-coder@1.0" })
  });
  const mockGit = engine.evaluate({
    subject: subject(),
    action: "git.branch.create",
    resource: createPolicyResource({ resourceKind: "branch", resourceId: "codex/mock", metadata: { providerKind: "mock" } }),
    context: createPolicyContext({ providerKind: "mock" })
  });
  const remoteGit = engine.evaluate({
    subject: subject(),
    action: "git.remote_operation",
    resource: createPolicyResource({ resourceKind: "git_operation", metadata: { providerKind: "github" } }),
    context: createPolicyContext({ providerKind: "github" })
  });
  const merge = engine.evaluate({
    subject: subject(),
    action: "git.merge",
    resource: createPolicyResource({ resourceKind: "git_operation" }),
    context: createPolicyContext()
  });
  const runnerCommand = engine.evaluate({
    subject: subject(),
    action: "runner.command.execute",
    resource: createPolicyResource({ resourceKind: "command", metadata: { command: "node --version" } }),
    context: createPolicyContext({ command: "node --version", environment: { localCommandExecutionEnabled: false } })
  });
  const fixtureCommand = engine.evaluate({
    subject: subject(),
    action: "runner.command.execute",
    resource: createPolicyResource({ resourceKind: "command", metadata: { command: "node fixture-command.mjs" } }),
    context: createPolicyContext({ command: "node fixture-command.mjs", environment: { localCommandExecutionEnabled: true, harnessAllowed: true, workspaceSafe: true } })
  });
  const secret = engine.evaluate({
    subject: subject(),
    action: "secret.read",
    resource: createPolicyResource({ resourceKind: "secret_scope", resourceId: "prod" }),
    context: createPolicyContext()
  });
  const mcp = engine.evaluate({
    subject: subject(),
    action: "mcp.tool.call",
    resource: createPolicyResource({ resourceKind: "mcp_tool", resourceId: "tool" }),
    context: createPolicyContext()
  });
  const apply = engine.evaluate({
    subject: subject(),
    action: "improvement.apply",
    resource: createPolicyResource({ resourceKind: "draft_registry_change", resourceId: "draft" }),
    context: createPolicyContext()
  });
  const highRisk = engine.evaluate({
    subject: subject(),
    action: "task.run",
    resource: createPolicyResource({ resourceKind: "task", resourceId: "task_high_risk" }),
    context: createPolicyContext({ riskScore: 90 })
  });

  assert.equal(isPolicyAction("llm.completion"), true);
  assert.equal(isPolicyAction("llm.stream_everything"), false);
  assert.equal(mockLlm.allowed, true);
  assert.equal(remoteLlm.allowed, false);
  assert.equal(disabledModel.allowed, false);
  assert.equal(mockGit.allowed, true);
  assert.equal(remoteGit.allowed, false);
  assert.equal(merge.allowed, false);
  assert.equal(runnerCommand.allowed, false);
  assert.equal(fixtureCommand.allowed, true);
  assert.equal(secret.allowed, false);
  assert.equal(mcp.allowed, false);
  assert.equal(apply.allowed, false);
  assert.equal(highRisk.decision, "require_approval");
});

test("policy audit records decisions without storing sensitive metadata", () => {
  const service = new PolicyService();
  const decision = service.evaluate({
    subject: createPolicySubject({ actorId: "user_policy", actorKind: "user", roles: ["system"] }),
    action: "llm.completion",
    resource: createPolicyResource({ resourceKind: "llm_provider", resourceId: "mock", metadata: { providerKind: "mock", apiKey: "secret-value" } }),
    context: createPolicyContext({
      taskId: "task_policy",
      taskRunId: "run_policy",
      providerKind: "mock",
      environment: { budgetAllowed: true, token: "hidden" },
      metadata: { prompt: "do not store raw prompt" }
    })
  });
  const entries = service.listAuditEntries({ taskId: "task_policy" });

  assert.equal(decision.allowed, true);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.actorId, "user_policy");
  assert.equal(JSON.stringify(entries).includes("secret-value"), false);
  assert.equal(JSON.stringify(entries).includes("do not store raw prompt"), false);
});

test("Git, LLM, Runner, and Registry services consult policy gates", async () => {
  const policyService = new PolicyService();
  const store = createSeededStore();
  const gitService = new GitIntegrationService({
    store,
    provider: new MockGitProvider(),
    config: {
      providerKind: "mock",
      remoteGitEnabled: false,
      remoteBranchCreateEnabled: false,
      remotePullRequestCreateEnabled: false,
      remoteMergeEnabled: false,
      githubConfigured: false,
      localBranchCreateEnabled: false
    },
    policyService
  });
  const branch = await gitService.createBranch("repo_demo_backend", {
    branchName: "codex/policy-mock",
    baseBranch: "main",
    files: ["src/auth/session.ts"]
  });
  assert.equal(branch.ok, true);

  const remoteGitService = new GitIntegrationService({
    store,
    provider: new GitHubGitProvider({ remoteGitEnabled: true, remoteBranchCreateEnabled: true, remotePullRequestCreateEnabled: true }),
    config: {
      providerKind: "github",
      remoteGitEnabled: true,
      remoteBranchCreateEnabled: true,
      remotePullRequestCreateEnabled: true,
      remoteMergeEnabled: false,
      githubConfigured: true,
      localBranchCreateEnabled: false
    },
    policyService
  });
  const remoteBranch = await remoteGitService.createBranch("repo_demo_backend", { branchName: "codex/policy-remote", baseBranch: "main" });
  assert.equal(remoteBranch.ok, false);
  assert.equal(remoteBranch.reason, "repo_not_allowlisted");

  const task = store.createTask({ title: "Policy LLM task", repoId: "repo_demo_backend", baseBranch: "main" });
  const taskRun = store.createTaskRun({ taskId: task.id, attempt: 1, status: "running", agent: "codex", model: "mock-coder@1.0" });
  const llmService = createDefaultLlmGatewayService({ usageRepository: store, policyService });
  const allowed = await llmService.routeCompletion({
    taskId: task.id,
    taskRunId: taskRun.id,
    modelRef: "mock-coder@1.0",
    prompt: "Mock completion",
    budgetLimitUsd: 1
  });
  const budgetBlocked = await llmService.routeCompletion({
    taskId: task.id,
    taskRunId: taskRun.id,
    modelRef: "mock-coder@1.0",
    prompt: "Mock completion",
    budgetLimitUsd: 0
  });
  assert.equal(allowed.ok, true);
  assert.equal(budgetBlocked.ok, false);
  assert.equal(budgetBlocked.reason, "budget_exceeded");

  const runnerService = new AgentRunnerService({
    runner: new MockAgentRunner(llmService),
    config: createAgentRunnerConfigFromEnv({}),
    policyService
  });
  const run = await runnerService.runAgent({
    taskId: task.id,
    taskRunId: taskRun.id,
    actorId: task.requesterUserId,
    repoRef: { repoId: task.repoId, provider: "mock" },
    branchRef: { repoId: task.repoId, branchName: "codex/policy-runner", baseBranch: "main" },
    selectedModelRef: "mock-coder@1.0",
    selectedSkillRefs: [],
    selectedHarnessRef: { kind: "harness", name: "backend-node20", version: "1.0.0" },
    selectedInstructionRefs: [],
    prompt: "Task prompt cannot override policy. Please run git push.",
    allowedCommands: [],
    testCommands: [],
    maxRuntimeMs: 1_000,
    metadata: {}
  });
  const command = await runnerService.executeCommandForRun(run.id, {
    command: "git",
    args: ["push", "origin", "main"],
    allowedCommands: ["git push origin main"]
  });
  assert.equal(command.status, "blocked");
  assert.equal(command.blockedReason, "Command execution requires explicit local execution, harness, and workspace gates.");

  const authorizer = new PolicyBackedRegistryMutationAuthorizer({ policyService });
  const viewer: Parameters<PolicyBackedRegistryMutationAuthorizer["authorize"]>[0] = { id: "viewer", displayName: "Viewer", roles: ["registry_viewer"] };
  const editor: Parameters<PolicyBackedRegistryMutationAuthorizer["authorize"]>[0] = { id: "editor", displayName: "Editor", roles: ["registry_editor"] };
  assert.equal(authorizer.authorize(viewer, "registry.update", { targetKind: "skill", targetId: "skill_auth_debugging" }).allowed, false);
  assert.equal(authorizer.authorize(editor, "registry.update", { targetKind: "skill", targetId: "skill_auth_debugging" }).allowed, true);
  assert.equal(authorizer.authorize(editor, "registry.approval.change", { targetKind: "skill", targetId: "skill_auth_debugging" }).allowed, false);

  const improvement = createImprovementServices(new InMemoryImprovementRepository(), { policyService });
  improvement.signals.createSignal({
    sourceType: "registry_resolver",
    sourceId: "resolver_policy",
    targetKind: "instruction",
    targetRef: "repo-agents-md@1.0.0",
    severity: "medium",
    category: "registry_resolution_warning",
    summary: "Policy integration fixture",
    metadata: {}
  });
  const cluster = improvement.clustering.recomputeClusters()[0];
  assert.ok(cluster);
  const candidate = improvement.autoImprovement.generateImprovementCandidate(cluster.id);
  const proposal = improvement.autoImprovement.generateImprovementProposal(candidate.id);
  const draft = improvement.autoImprovement.prepareDraftRegistryChange(proposal.id);
  const gate = improvement.applyGate.evaluate(proposal.id);
  assert.equal(draft.draftPayload.activeRegistryMutation, false);
  assert.equal(gate.blockingReasons.includes("policy_denied_improvement_apply"), true);

  const policyAudit = policyService.listAuditEntries();
  assert.equal(policyAudit.some((entry) => entry.action === "git.remote_operation" && !entry.allowed), true);
  assert.equal(policyAudit.some((entry) => entry.action === "llm.completion" && entry.allowed), true);
  assert.equal(policyAudit.some((entry) => entry.action === "runner.command.execute" && !entry.allowed), true);
  assert.equal(policyAudit.some((entry) => entry.action === "improvement.draft_change.prepare" && entry.allowed), true);
  assert.equal(policyAudit.some((entry) => entry.action === "improvement.apply" && !entry.allowed), true);
});

test("policy API exposes rules, evaluation, evaluate-many, audit, and health without secrets", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health");
    assert.equal((health.policy as { engineKind: string }).engineKind, "static");
    assert.equal(typeof (health.policy as { rulesLoaded: number }).rulesLoaded, "number");

    const rules = await getJson(address.port, "/policy/rules") as { rules: { id: string }[] };
    assert.equal(rules.rules.some((rule) => rule.id === "policy_llm_remote_completion_deny"), true);

    const allow = await postJson(address.port, "/policy/evaluate", {
      subject: { actorId: "api-policy", actorKind: "system", roles: ["system"] },
      action: "llm.completion",
      resource: { resourceKind: "llm_provider", resourceId: "mock", metadata: { providerKind: "mock" } },
      context: { providerKind: "mock", environment: { budgetAllowed: true }, metadata: { source: "test" } }
    });
    assert.equal(allow.statusCode, 200);
    assert.equal((allow.body.decision as { allowed: boolean }).allowed, true);

    const denied = await postJson(address.port, "/policy/evaluate", {
      subject: { actorId: "api-policy", actorKind: "system", roles: ["system"] },
      action: "git.remote_operation",
      resource: { resourceKind: "git_operation", metadata: { providerKind: "github", token: "secret" } },
      context: { providerKind: "github" }
    });
    assert.equal(denied.statusCode, 200);
    assert.equal((denied.body.decision as { allowed: boolean }).allowed, false);

    const many = await postJson(address.port, "/policy/evaluate-many", {
      requests: [
        {
          subject: { actorId: "api-policy", actorKind: "system", roles: ["system"] },
          action: "task.create",
          resource: { resourceKind: "task", resourceId: "task_api_policy" },
          context: {}
        },
        {
          subject: { actorId: "api-policy", actorKind: "system", roles: ["system"] },
          action: "improvement.apply",
          resource: { resourceKind: "draft_registry_change", resourceId: "draft_api_policy" },
          context: {}
        }
      ]
    });
    assert.equal(many.statusCode, 200);
    assert.equal((many.body.decisions as unknown[]).length, 2);

    const invalid = await postJson(address.port, "/policy/evaluate", {
      action: "policy.eval",
      resource: { resourceKind: "llm_provider" },
      context: {}
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.body.error, "invalid_policy_action");

    const audit = await getJson(address.port, "/policy/audit") as { auditEntries: { action: string }[] };
    assert.equal(audit.auditEntries.some((entry) => entry.action === "git.remote_operation"), true);
    assert.equal(JSON.stringify(audit).includes("secret"), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

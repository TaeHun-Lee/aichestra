import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { AgentRunCoordinationService } from "@aichestra/runner";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

let sessionCounter = 0;

function registerSession(service: AgentRunCoordinationService, overrides: Partial<Parameters<AgentRunCoordinationService["registerSession"]>[0]> = {}) {
  sessionCounter += 1;
  return service.registerSession({
    userId: "user_alpha",
    actorId: "actor_alpha",
    taskId: "task_alpha",
    taskRunId: "taskrun_alpha",
    id: `session_default_${sessionCounter}`,
    agentRunId: `agentrun_default_${sessionCounter}`,
    repoId: "repo_alpha",
    baseBranch: "main",
    branchName: `codex/session-${sessionCounter}`,
    workspaceLeaseId: `workspace_${sessionCounter}`,
    targetFiles: ["src/auth/session.ts"],
    sourceScope: { scopeKind: "directory", paths: ["src/auth"], metadata: {} },
    status: "running",
    metadata: { test: "multi_session_coordination" },
    ...overrides
  });
}

function getJson(port: number, requestPath: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
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

function serializedHasSecretMaterial(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GITHUB_TOKEN",
    "VAULT_TOKEN",
    "sk-test",
    "ghp_",
    "xoxb-",
    "DATABASE_URL="
  ].some((needle) => serialized.includes(needle));
}

test("Multi-session Agent Run Coordination v1 registers sessions and groups by repo/base branch", () => {
  const service = new AgentRunCoordinationService();
  const first = registerSession(service, { id: "session_one", branchName: "codex/one", workspaceLeaseId: "workspace_one" });
  const second = registerSession(service, { id: "session_two", branchName: "codex/two", workspaceLeaseId: "workspace_two", targetFiles: ["src/billing/invoice.ts"], sourceScope: { scopeKind: "directory", paths: ["src/billing"], metadata: {} } });

  const sessions = service.listSessions({ repoId: "repo_alpha" });
  const groups = service.listCoordinationGroups({ repoId: "repo_alpha" });

  assert.equal(sessions.length, 2);
  assert.equal(sessions.some((session) => session.id === first.id), true);
  assert.equal(sessions.some((session) => session.id === second.id), true);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0]?.activeSessionIds.sort(), ["session_one", "session_two"]);
  assert.equal(groups[0]?.status, "healthy");
});

test("Multi-session Agent Run Coordination v1 blocks shared workspace metadata", () => {
  const service = new AgentRunCoordinationService();
  registerSession(service, { id: "session_workspace_a", branchName: "codex/a", workspaceLeaseId: "workspace_shared", targetFiles: ["src/auth/session.ts"] });
  const second = registerSession(service, { id: "session_workspace_b", branchName: "codex/b", workspaceLeaseId: "workspace_shared", targetFiles: ["src/billing/invoice.ts"], sourceScope: { scopeKind: "directory", paths: ["src/billing"], metadata: {} } });

  const overlaps = service.listSessionOverlaps({ repoId: "repo_alpha" });
  const sameWorkspace = overlaps.find((overlap) => overlap.overlapKind === "same_workspace");
  const refreshedSecond = service.listSessions().find((session) => session.id === second.id);

  assert.equal(sameWorkspace?.severity, "critical");
  assert.equal(sameWorkspace?.recommendation, "block");
  assert.equal(refreshedSecond?.status, "waiting_on_conflict");
  assert.equal(service.getSummary().sameWorkspaceBlockers, 1);
});

test("Multi-session Agent Run Coordination v1 detects same branch, file, directory, missing target, and allowed independent files", () => {
  const sameBranchService = new AgentRunCoordinationService();
  registerSession(sameBranchService, { id: "session_branch_a", branchName: "codex/shared", workspaceLeaseId: "workspace_branch_a", targetFiles: ["src/auth/session.ts"] });
  registerSession(sameBranchService, { id: "session_branch_b", branchName: "codex/shared", workspaceLeaseId: "workspace_branch_b", targetFiles: ["src/billing/invoice.ts"], sourceScope: { scopeKind: "directory", paths: ["src/billing"], metadata: {} } });
  assert.equal(sameBranchService.listSessionOverlaps().find((overlap) => overlap.overlapKind === "same_branch")?.severity, "high");

  const sameFileService = new AgentRunCoordinationService();
  registerSession(sameFileService, { id: "session_file_a", branchName: "codex/file-a", workspaceLeaseId: "workspace_file_a", targetFiles: ["src/auth/session.ts"] });
  registerSession(sameFileService, { id: "session_file_b", branchName: "codex/file-b", workspaceLeaseId: "workspace_file_b", targetFiles: ["src/auth/session.ts"] });
  const sameFile = sameFileService.listSessionOverlaps().find((overlap) => overlap.overlapKind === "same_file");
  assert.equal(sameFile?.severity, "high");
  assert.equal(sameFile?.recommendation, "serialize");
  assert.deepEqual(sameFile?.files, ["src/auth/session.ts"]);

  const sameDirectoryService = new AgentRunCoordinationService();
  registerSession(sameDirectoryService, { id: "session_dir_a", branchName: "codex/dir-a", workspaceLeaseId: "workspace_dir_a", targetFiles: ["src/auth/session.ts"] });
  registerSession(sameDirectoryService, { id: "session_dir_b", branchName: "codex/dir-b", workspaceLeaseId: "workspace_dir_b", targetFiles: ["src/auth/token.ts"] });
  const sameDirectory = sameDirectoryService.listSessionOverlaps().find((overlap) => overlap.overlapKind === "same_directory");
  assert.equal(sameDirectory?.severity, "medium");
  assert.equal(sameDirectory?.recommendation, "split_files");

  const missingTargetService = new AgentRunCoordinationService();
  registerSession(missingTargetService, { id: "session_missing_a", branchName: "codex/missing-a", workspaceLeaseId: "workspace_missing_a", targetFiles: [] });
  registerSession(missingTargetService, { id: "session_missing_b", branchName: "codex/missing-b", workspaceLeaseId: "workspace_missing_b", targetFiles: ["src/auth/session.ts"] });
  const missingTarget = missingTargetService.listSessionOverlaps().find((overlap) => overlap.overlapKind === "unknown_target_files");
  assert.equal(missingTarget?.severity, "medium");
  assert.equal(missingTarget?.recommendation, "warn");

  const independentService = new AgentRunCoordinationService();
  registerSession(independentService, { id: "session_independent_a", branchName: "codex/independent-a", workspaceLeaseId: "workspace_independent_a", targetFiles: ["src/auth/session.ts"] });
  registerSession(independentService, { id: "session_independent_b", branchName: "codex/independent-b", workspaceLeaseId: "workspace_independent_b", targetFiles: ["src/billing/invoice.ts"], sourceScope: { scopeKind: "directory", paths: ["src/billing"], metadata: {} } });
  assert.equal(independentService.listSessionOverlaps().length, 0);
  assert.equal(independentService.listCoordinationGroups()[0]?.coordinationMode, "isolated_by_workspace");
});

test("Multi-session Agent Run Coordination v1 recommends unique branch and workspace policy", () => {
  const service = new AgentRunCoordinationService();
  registerSession(service, { id: "session_policy_a", branchName: "codex/policy-a", workspaceLeaseId: "workspace_policy_a" });
  registerSession(service, { id: "session_policy_b", branchName: "codex/policy-b", workspaceLeaseId: "workspace_policy_b", targetFiles: ["src/billing/invoice.ts"], sourceScope: { scopeKind: "directory", paths: ["src/billing"], metadata: {} } });

  const policies = service.listConcurrencyPolicies();
  const group = service.listCoordinationGroups()[0];
  assert.equal(policies.some((policy) => policy.mode === "require_unique_branch" && policy.enabled), true);
  assert.equal(policies.some((policy) => policy.mode === "require_isolated_workspace" && policy.enabled), true);
  assert.equal(group?.status, "healthy");
  assert.equal(group ? service.recommendCoordinationAction(group.id).action : undefined, "allow");
});

test("Multi-session Agent Run Coordination v1 API endpoints are metadata-only and safe", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const first = await postJson(address.port, "/agents/sessions", {
      userId: "user_api_a",
      agentRunId: "agentrun_api_a",
      repoId: "repo_api",
      baseBranch: "main",
      branchName: "codex/api-a",
      workspaceLeaseId: "workspace_api_shared",
      targetFiles: ["src/auth/session.ts"],
      sourceScope: { scopeKind: "directory", paths: ["src/auth"], metadata: { raw: "OPENAI_API_KEY=sk-test" } },
      metadata: { source: "api_test", token: "ghp_should_redact" }
    });
    const second = await postJson(address.port, "/agents/sessions", {
      userId: "user_api_b",
      agentRunId: "agentrun_api_b",
      repoId: "repo_api",
      baseBranch: "main",
      branchName: "codex/api-b",
      workspaceLeaseId: "workspace_api_shared",
      targetFiles: ["src/auth/session.ts"]
    });
    const firstSession = (first.body.session as Record<string, unknown>);
    const updateFiles = await postJson(address.port, `/agents/sessions/${firstSession.id}/target-files`, { files: ["src/auth/token.ts"] });
    const sessions = await getJson(address.port, "/agents/sessions?repoId=repo_api");
    const groups = await getJson(address.port, "/agents/coordination/groups?repoId=repo_api");
    const group = ((groups.body.groups as Record<string, unknown>[])[0]);
    const recommendation = await getJson(address.port, `/agents/coordination/groups/${group.id}/recommendation`);
    const overlaps = await getJson(address.port, "/agents/coordination/overlaps?repoId=repo_api");
    const summary = await getJson(address.port, "/agents/coordination/summary");
    const policies = await getJson(address.port, "/agents/coordination/policies");
    const audit = await getJson(address.port, "/agents/coordination/audit?repoId=repo_api");
    const safePayload = { first, second, updateFiles, sessions, groups, recommendation, overlaps, summary, policies, audit };

    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 201);
    assert.equal(updateFiles.statusCode, 200);
    assert.equal(sessions.statusCode, 200);
    assert.equal(groups.statusCode, 200);
    assert.equal(recommendation.statusCode, 200);
    assert.equal(overlaps.statusCode, 200);
    assert.equal(summary.statusCode, 200);
    assert.equal(policies.statusCode, 200);
    assert.equal(audit.statusCode, 200);
    assert.equal(((summary.body.summary as Record<string, unknown>).remoteGitOperation), false);
    assert.equal(((summary.body.summary as Record<string, unknown>).agentExecution), false);
    assert.equal(((summary.body.summary as Record<string, unknown>).noDestructiveAction), true);
    assert.equal((overlaps.body.overlaps as Record<string, unknown>[]).some((overlap) => overlap.overlapKind === "same_workspace" && overlap.severity === "critical"), true);
    assert.equal(serializedHasSecretMaterial(safePayload), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Multi-session Agent Run Coordination v1 dashboard panel renders coordination state", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("Session coordination"), true);
  assert.equal(html.includes("Coordination groups"), true);
  assert.equal(html.includes("Overlap warnings"), true);
  assert.equal(html.includes("same_workspace:critical:block"), true);
  assert.equal(html.includes("same_file:high:serialize"), true);
  assert.equal(html.includes("v1_implemented"), true);
});

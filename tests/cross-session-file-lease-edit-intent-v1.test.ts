import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { EditIntentGraphService } from "@aichestra/runner";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

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
    "DATABASE_URL="
  ].some((needle) => serialized.includes(needle));
}

test("Cross-session File Lease / Edit Intent Graph v1 declares intents and builds deterministic graph metadata", () => {
  const service = new EditIntentGraphService();
  const intent = service.declareIntent({
    id: "intent_alpha",
    repoId: "repo_alpha",
    sessionId: "session_alpha",
    agentRunId: "agentrun_alpha",
    taskId: "task_alpha",
    branchName: "codex/alpha",
    workspaceLeaseId: "workspace_alpha",
    intentKind: "modify",
    filePaths: ["src/auth/session.ts", ".\\tests\\auth\\session.test.ts"],
    directoryScopes: ["src/auth/"],
    confidence: "high",
    status: "active",
    metadata: { source: "test" }
  });
  const graph = service.buildGraph("repo_alpha");
  const summary = service.getOverlapSummary("repo_alpha");

  assert.equal(intent.filePaths.includes("tests/auth/session.test.ts"), true);
  assert.equal(graph.nodes.some((node) => node.id === "editnode_session_session-alpha"), true);
  assert.equal(graph.edges.some((edge) => edge.edgeKind === "intends_to_edit"), true);
  assert.equal(summary.activeIntents, 1);
  assert.equal(summary.noFileLocks, true);
  assert.equal(summary.noSourceMutation, true);
  assert.equal(summary.remoteGitOperation, false);
});

test("file leases detect same-file write intent overlap and release without OS locks", () => {
  const service = new EditIntentGraphService();
  const first = service.requestFileLease({
    id: "lease_alpha",
    repoId: "repo_alpha",
    filePath: "src/auth/session.ts",
    leaseKind: "write_intent",
    ownerSessionId: "session_alpha",
    ownerAgentRunId: "agentrun_alpha",
    ownerTaskId: "task_alpha",
    branchName: "codex/alpha",
    workspaceLeaseId: "workspace_alpha",
    metadata: { source: "test" }
  });
  const second = service.requestFileLease({
    id: "lease_beta",
    repoId: "repo_alpha",
    filePath: "src/auth/session.ts",
    leaseKind: "write_intent",
    ownerSessionId: "session_beta",
    ownerAgentRunId: "agentrun_beta",
    ownerTaskId: "task_beta",
    branchName: "codex/beta",
    workspaceLeaseId: "workspace_beta",
    metadata: { source: "test" }
  });
  const sameFile = service.listOverlapAssessments({ repoId: "repo_alpha" }).find((assessment) => assessment.overlapKind === "same_file");

  assert.equal(first.status, "active");
  assert.equal(second.status, "warning_overlap");
  assert.equal(sameFile?.severity, "high");
  assert.equal(sameFile?.recommendation, "serialize");
  assert.deepEqual(sameFile?.files, ["src/auth/session.ts"]);

  const released = service.releaseFileLease("lease_beta", { actorId: "actor_test" });
  assert.equal(released.status, "released");
  assert.equal(service.listOverlapAssessments({ repoId: "repo_alpha" }).some((assessment) => assessment.overlapKind === "same_file"), false);
});

test("edit intent graph classifies same-directory, read-only, same-workspace, and broad unknown overlaps", () => {
  const directoryService = new EditIntentGraphService();
  directoryService.declareIntent({
    repoId: "repo_dir",
    sessionId: "session_refactor",
    branchName: "codex/refactor",
    workspaceLeaseId: "workspace_refactor",
    intentKind: "refactor",
    filePaths: ["src/auth/session.ts"],
    directoryScopes: ["src/auth"],
    status: "active"
  });
  directoryService.declareIntent({
    repoId: "repo_dir",
    sessionId: "session_token",
    branchName: "codex/token",
    workspaceLeaseId: "workspace_token",
    intentKind: "modify",
    filePaths: ["src/auth/token.ts"],
    directoryScopes: ["src/auth"],
    status: "active"
  });
  const sameDirectory = directoryService.listOverlapAssessments({ repoId: "repo_dir" }).find((assessment) => assessment.overlapKind === "same_directory");
  assert.equal(sameDirectory?.severity, "high");
  assert.equal(sameDirectory?.recommendation, "require_review");

  const readOnlyService = new EditIntentGraphService();
  readOnlyService.declareIntent({
    repoId: "repo_read",
    sessionId: "session_reader",
    branchName: "codex/read",
    intentKind: "read_only",
    filePaths: ["src/auth/session.ts"],
    status: "active"
  });
  readOnlyService.declareIntent({
    repoId: "repo_read",
    sessionId: "session_writer",
    branchName: "codex/write",
    intentKind: "modify",
    filePaths: ["src/auth/session.ts"],
    status: "active"
  });
  const readOnlyOverlap = readOnlyService.listOverlapAssessments({ repoId: "repo_read" }).find((assessment) => assessment.overlapKind === "same_file");
  assert.equal(readOnlyOverlap?.severity, "low");
  assert.equal(readOnlyOverlap?.recommendation, "warn");

  const workspaceService = new EditIntentGraphService();
  workspaceService.declareIntent({
    repoId: "repo_workspace",
    sessionId: "session_a",
    branchName: "codex/a",
    workspaceLeaseId: "workspace_shared",
    intentKind: "modify",
    filePaths: ["src/auth/session.ts"],
    status: "active"
  });
  workspaceService.declareIntent({
    repoId: "repo_workspace",
    sessionId: "session_b",
    branchName: "codex/b",
    workspaceLeaseId: "workspace_shared",
    intentKind: "modify",
    filePaths: ["src/billing/invoice.ts"],
    status: "active"
  });
  const sameWorkspace = workspaceService.listOverlapAssessments({ repoId: "repo_workspace" }).find((assessment) => assessment.overlapKind === "same_workspace");
  assert.equal(sameWorkspace?.severity, "critical");
  assert.equal(sameWorkspace?.recommendation, "block");

  const unknownService = new EditIntentGraphService();
  unknownService.declareIntent({
    repoId: "repo_unknown_scope",
    sessionId: "session_unknown",
    branchName: "codex/unknown",
    intentKind: "modify",
    filePaths: [],
    directoryScopes: [],
    status: "active"
  });
  unknownService.declareIntent({
    repoId: "repo_unknown_scope",
    sessionId: "session_known",
    branchName: "codex/known",
    intentKind: "modify",
    filePaths: ["src/auth/session.ts"],
    status: "active"
  });
  const broadUnknown = unknownService.listOverlapAssessments({ repoId: "repo_unknown_scope" }).find((assessment) => assessment.overlapKind === "broad_unknown");
  assert.equal(broadUnknown?.severity, "medium");
  assert.equal(broadUnknown?.recommendation, "warn");
});

test("edit intent API endpoints are metadata-only, sanitized, and safe", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const firstIntent = await postJson(address.port, "/agents/edit-intents", {
      repoId: "repo_api",
      sessionId: "session_api_a",
      agentRunId: "agentrun_api_a",
      taskId: "task_api_a",
      branchName: "codex/api-a",
      workspaceLeaseId: "workspace_api_shared",
      intentKind: "modify",
      filePaths: ["C:\\Users\\demo\\secret-session.ts"],
      directoryScopes: ["src/auth"],
      confidence: "high",
      status: "active",
      metadata: { token: "ghp_should_redact", raw: "OPENAI_API_KEY=sk-test" }
    });
    const secondIntent = await postJson(address.port, "/agents/edit-intents", {
      repoId: "repo_api",
      sessionId: "session_api_b",
      agentRunId: "agentrun_api_b",
      taskId: "task_api_b",
      branchName: "codex/api-b",
      workspaceLeaseId: "workspace_api_shared",
      intentKind: "modify",
      filePaths: ["C:\\Users\\demo\\secret-session.ts"],
      directoryScopes: ["src/auth"],
      status: "active"
    });
    const firstLease = await postJson(address.port, "/agents/file-leases", {
      repoId: "repo_api",
      filePath: "src/auth/session.ts",
      leaseKind: "write_intent",
      ownerSessionId: "session_api_a",
      ownerAgentRunId: "agentrun_api_a",
      ownerTaskId: "task_api_a",
      branchName: "codex/api-a",
      workspaceLeaseId: "workspace_api_shared"
    });
    const secondLease = await postJson(address.port, "/agents/file-leases", {
      repoId: "repo_api",
      filePath: "src/auth/session.ts",
      leaseKind: "write_intent",
      ownerSessionId: "session_api_b",
      ownerAgentRunId: "agentrun_api_b",
      ownerTaskId: "task_api_b",
      branchName: "codex/api-b",
      workspaceLeaseId: "workspace_api_shared"
    });
    const graph = await getJson(address.port, "/agents/edit-intent-graph?repoId=repo_api");
    const overlaps = await getJson(address.port, "/agents/edit-overlaps?repoId=repo_api");
    const summary = await getJson(address.port, "/agents/edit-intent-summary?repoId=repo_api");
    const leases = await getJson(address.port, "/agents/file-leases?repoId=repo_api");
    const leaseId = ((firstLease.body.fileLease as Record<string, unknown>).id as string);
    const release = await postJson(address.port, `/agents/file-leases/${leaseId}/release`);
    const safePayload = { firstIntent, secondIntent, firstLease, secondLease, graph, overlaps, summary, leases, release };

    assert.equal(firstIntent.statusCode, 201);
    assert.equal(secondIntent.statusCode, 201);
    assert.equal(firstLease.statusCode, 409);
    assert.equal(secondLease.statusCode, 409);
    assert.equal(graph.statusCode, 200);
    assert.equal(overlaps.statusCode, 200);
    assert.equal(summary.statusCode, 200);
    assert.equal(leases.statusCode, 200);
    assert.equal(release.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).noFileLocks, true);
    assert.equal((summary.body.summary as Record<string, unknown>).noSourceMutation, true);
    assert.equal((summary.body.summary as Record<string, unknown>).remoteGitOperation, false);
    assert.equal(JSON.stringify(safePayload).includes("C:\\Users\\demo"), false);
    assert.equal(serializedHasSecretMaterial(safePayload), false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("dashboard renders Cross-session File Lease / Edit Intent graph panel without secrets", async () => {
  const provider = new DemoDashboardDataProvider();
  const html = await renderDashboardHtml(provider);

  assert.match(html, /Edit intent graph/);
  assert.match(html, /File leases/);
  assert.match(html, /Edit overlaps/);
  assert.match(html, /file locks disabled/);
  assert.doesNotMatch(html, /OPENAI_API_KEY|sk-test|ghp_/);
});

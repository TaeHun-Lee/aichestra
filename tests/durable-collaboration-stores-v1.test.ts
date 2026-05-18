import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import {
  createInMemoryStorageProvider,
  createPostgresStorageProvider,
  createSeededStore,
  DURABLE_COLLABORATION_RECORD_KINDS_BY_GROUP,
  DURABLE_COLLABORATION_RECORD_TABLES,
  type DurableCollaborationRepositories,
  type DurableCollaborationRepositoryGroup
} from "@aichestra/db";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardReadModels } from "../apps/web/src/render.ts";

type RepositoryProperty =
  | "branchOrchestration"
  | "agentSessionCoordination"
  | "agentWorkspace"
  | "agentWorktreeAllocation"
  | "editIntent"
  | "mergeQueuePolicy"
  | "conflictResolution"
  | "prOwnership"
  | "cleanupRecovery";

const repositoryProperties: Record<DurableCollaborationRepositoryGroup, RepositoryProperty> = {
  branch_orchestration: "branchOrchestration",
  agent_session_coordination: "agentSessionCoordination",
  agent_workspace: "agentWorkspace",
  agent_worktree_allocation: "agentWorktreeAllocation",
  edit_intent: "editIntent",
  merge_queue_policy: "mergeQueuePolicy",
  conflict_resolution: "conflictResolution",
  pr_ownership: "prOwnership",
  cleanup_recovery: "cleanupRecovery"
};

function getJson(port: number, path: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
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

function hasUnsafeSecret(value: unknown): boolean {
  return /postgres(?:ql)?:\/\/|ghp_|github_pat_|Bearer\s+|OPENAI_API_KEY=|ANTHROPIC_API_KEY=|GITHUB_TOKEN=|VAULT_TOKEN=|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|SESSION_SECRET=|JWT_SECRET=|raw-secret-value|D:\\\\Secret/i.test(
    JSON.stringify(value)
  );
}

function exerciseRepositories(repositories: DurableCollaborationRepositories): void {
  for (const [group, property] of Object.entries(repositoryProperties) as Array<[DurableCollaborationRepositoryGroup, RepositoryProperty]>) {
    const repository = repositories[property];
    const recordKind = DURABLE_COLLABORATION_RECORD_KINDS_BY_GROUP[group][0];
    const record = repository.create({
      id: `${group}_record_1`,
      recordKind,
      repoId: "repo_demo_backend",
      taskId: "task_durable_demo",
      taskRunId: "run_durable_demo",
      agentRunId: "agent_run_durable_demo",
      branchName: "codex/durable-demo",
      status: "open",
      severity: "info",
      requestId: "request_durable_demo",
      correlationId: "correlation_durable_demo",
      actorId: "actor_demo",
      serviceAccountId: "svc_demo",
      metadata: {
        safe: "metadata",
        rawPayload: "raw-secret-value",
        token: "ghp_secret_token",
        databaseUrl: "postgres://user:password@example.invalid/aichestra",
        workspacePath: "D:\\Secret\\workspace"
      }
    });

    assert.equal(record.group, group);
    assert.equal(repository.getById(record.id)?.id, record.id);
    assert.equal(repository.list().length, 1);
    assert.equal(JSON.stringify(record).includes("raw-secret-value"), false);
    assert.equal(JSON.stringify(record).includes("ghp_secret_token"), false);
    assert.equal(JSON.stringify(record).includes("postgres://"), false);

    const updated = repository.updateStatus(record.id, {
      status: "closed",
      decision: "metadata_only",
      severity: "low",
      metadata: { review: "complete", Authorization: "Bearer durable-secret" }
    });
    assert.equal(updated.status, "closed");
    assert.equal(updated.decision, "metadata_only");
    assert.equal(hasUnsafeSecret(updated), false);

    const metadataUpdated = repository.updateMetadata(record.id, { envValue: "OPENAI_API_KEY=secret" });
    assert.equal(hasUnsafeSecret(metadataUpdated), false);

    const event = repository.appendEvent({
      id: `${group}_event_1`,
      recordKind,
      recordId: record.id,
      eventType: "metadata_update",
      requestId: "request_durable_demo",
      correlationId: "correlation_durable_demo",
      metadata: { cookie: "session-cookie-secret", safe: true }
    });
    assert.equal(event.group, group);
    assert.equal(repository.listEvents(record.id).length, 1);
    assert.equal(hasUnsafeSecret(event), false);

    const summary = repository.summarize();
    assert.equal(summary.group, group);
    assert.equal(summary.implemented, true);
    assert.equal(summary.recordCount, 1);
    assert.equal(summary.eventCount, 1);
    assert.equal(summary.noSecretsExposed, true);
    assert.equal(summary.envValuesExposed, false);
    assert.equal(summary.databaseUrlExposed, false);
  }
}

test("durable collaboration in-memory repositories support deterministic contract operations", () => {
  const provider = createInMemoryStorageProvider();
  const repositories = provider.repositoryFactory.createDurableCollaborationRepositories();
  exerciseRepositories(repositories);

  const summary = repositories.getSummary();
  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.providerKind, "in_memory");
  assert.equal(summary.defaultRuntime, "in_memory");
  assert.equal(summary.durableCollaborationStoreConfigured, false);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.repositoryGroupCount, 9);
  assert.equal(summary.implementedRepositoryGroupCount, 9);
  assert.equal(summary.requiredDurableRecordCount, 28);
  assert.equal(summary.postgresTableCount, 28);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(summary.databaseUrlExposed, false);
  assert.equal(summary.remoteGitOperationsExecuted, false);
  assert.equal(summary.workspaceMutationExecuted, false);
  assert.equal(summary.externalCallsExecuted, false);
});

test("durable collaboration migration contains expected safe tables", () => {
  const migration = readFileSync("infra/migrations/0001_initial_aichestra_schema.sql", "utf8");
  for (const tableName of Object.values(DURABLE_COLLABORATION_RECORD_TABLES)) {
    assert.equal(migration.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`), true, tableName);
  }
  assert.equal(migration.includes("CREATE TABLE IF NOT EXISTS durable_collaboration_events"), true);
  const durableSection = migration.split("-- Durable Collaboration Stores v1")[1] ?? "";
  assert.equal(/\bdatabase_url\b/i.test(durableSection), false);
  assert.equal(/\braw_payload\b/i.test(durableSection), false);
  assert.equal(/\bcredential_value\b/i.test(durableSection), false);
  assert.equal(/\benv_value\b/i.test(durableSection), false);
});

test("durable collaboration readiness and dashboard API surfaces are safe", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health");
    const summary = await getJson(address.port, "/readiness/collaboration-stores/summary");
    const inventory = await getJson(address.port, "/readiness/collaboration-stores/inventory");
    const repositories = await getJson(address.port, "/readiness/collaboration-stores/repositories");
    const schema = await getJson(address.port, "/readiness/collaboration-stores/schema");
    const dashboard = await getJson(address.port, "/dashboard/collaboration-stores");

    assert.equal((health.durableCollaborationStores as { status: string }).status, "v1_implemented");
    assert.equal(((summary.summary as Record<string, unknown>).providerKind), "in_memory");
    assert.equal(Array.isArray(inventory.inventory), true);
    assert.equal(Array.isArray(repositories.repositories), true);
    assert.equal((schema.schema as { tableCount: number }).tableCount, 28);
    assert.equal(((dashboard.collaborationStores as Record<string, unknown>).summary as Record<string, unknown>).status, "v1_implemented");
    assert.equal(hasUnsafeSecret({ health, summary, inventory, repositories, schema, dashboard }), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("durable collaboration dashboard panel renders without secrets", async () => {
  const provider = new DemoDashboardDataProvider();
  const readModels = await provider.getReadModels();
  const html = renderDashboardReadModels(readModels);

  assert.equal(html.includes("Durable Collaboration Stores"), true);
  assert.equal(html.includes("raw-secret-value"), false);
  assert.equal(html.includes("postgres://"), false);
  assert.equal(html.includes("OPENAI_API_KEY="), false);
});

test(
  "optional Postgres durable collaboration repository contract is skipped unless a test database URL is configured",
  {
    skip: process.env.AICHESTRA_TEST_DATABASE_URL
      ? false
      : "Set AICHESTRA_TEST_DATABASE_URL to run optional Postgres durable collaboration repository tests."
  },
  async () => {
    const provider = createPostgresStorageProvider({
      databaseUrl: process.env.AICHESTRA_TEST_DATABASE_URL ?? ""
    });
    try {
      const health = await provider.healthCheck();
      assert.equal(health.healthy, true);
      const repositories = provider.repositoryFactory.createDurableCollaborationRepositories();
      const record = repositories.agentWorkspace.create({
        id: "agent_workspace_postgres_contract_record",
        recordKind: "AgentWorkspaceLease",
        repoId: "repo_demo_backend",
        workspaceLeaseId: "lease_postgres_contract",
        status: "active",
        metadata: { safe: "postgres contract", token: "ghp_postgres_secret" }
      });
      assert.equal(repositories.agentWorkspace.getById(record.id)?.id, record.id);
      assert.equal(hasUnsafeSecret(record), false);
    } finally {
      await provider.close?.();
    }
  }
);

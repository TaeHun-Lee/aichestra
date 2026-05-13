import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-13T00:00:00.000Z");

function hasDatabaseUrlValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /postgres(?:ql)?:\/\/|db-password|test-db-password|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|DATABASE_URL=/.test(text);
}

function getJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "2"
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end("{}");
  });
}

async function withApiServer(run: (port: number) => Promise<void>, envPatch: Record<string, string | undefined> = {}): Promise<void> {
  const previousEnv = new Map(Object.keys(envPatch).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(envPatch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("database operations models report profiles, checks, risks, and migration metadata without DB URL values", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_STORAGE_PROVIDER: "postgres",
      AICHESTRA_DATABASE_URL: "postgres://db-user:db-password@example.invalid/aichestra",
      AICHESTRA_TEST_DATABASE_URL: "postgres://test-user:test-db-password@example.invalid/aichestra_test"
    },
    repoRoot: process.cwd(),
    now: () => fixedNow
  });

  const summary = service.getDatabaseOperationsSummary();
  const profiles = service.listDatabaseDeploymentProfiles();
  const checks = service.listDatabaseReadinessChecks({ profileId: "production" });
  const risks = service.listDatabaseOperationRisks();
  const migrations = service.getDatabaseMigrationStatus();
  const firstChecksum = migrations[0]?.checksum;
  const secondChecksum = service.getDatabaseMigrationStatus()[0]?.checksum;

  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.storageProviderKind, "postgres");
  assert.equal(summary.databaseUrlConfigured, true);
  assert.equal(summary.testDatabaseUrlConfigured, true);
  assert.equal(summary.databaseUrlExposed, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.productionDbConnectionAttempted, false);
  assert.equal(summary.retentionDeletionJobsEnabled, false);
  assert.equal(summary.migrationRunnerAvailable, true);
  assert.equal(summary.migrationFileCount > 0, true);
  assert.equal(profiles.some((profile) => profile.id === "production" && profile.postgresRequired), true);
  assert.equal(checks.some((check) => check.id === "db_pooling_required" && check.status === "fail"), true);
  assert.equal(checks.some((check) => check.id === "db_backup_restore_required" && check.severity === "critical"), true);
  assert.equal(risks.some((risk) => risk.id === "risk_db_audit_growth_unbounded" && risk.status === "open"), true);
  assert.equal(firstChecksum?.startsWith("sha256:"), true);
  assert.equal(firstChecksum, secondChecksum);
  assert.equal(hasDatabaseUrlValue({ summary, profiles, checks, risks, migrations }), false);
});

test("database operations service exposes index, retention, audit growth, and webhook plans", () => {
  const service = createDeploymentReadinessService({ repoRoot: process.cwd(), now: () => fixedNow });
  const schema = service.getDatabaseSchemaInventory();
  const indexReview = service.getDatabaseIndexReview();
  const retention = service.getDatabaseRetentionPlan();
  const auditGrowth = service.getDatabaseAuditGrowthPlan();
  const webhookPersistence = service.getDatabaseWebhookPersistencePlan();

  assert.equal(schema.some((item) => item.tableName === "git_webhook_events" && item.metadata.rawPayloadStorage === false), true);
  assert.equal(schema.some((item) => item.tableName === "observability_audit_events" && item.metadata.futureOnly === true), true);
  assert.equal(indexReview.some((item) => item.tableName === "git_webhook_events" && item.status === "recommended"), true);
  assert.equal(indexReview.some((item) => item.tableName === "llm_routing_decisions" && item.status === "future"), true);
  assert.equal(retention.deletionJobsEnabled, false);
  assert.equal(retention.retentionClassesAligned, true);
  assert.equal(auditGrowth.noDeletionInV1, true);
  assert.equal(auditGrowth.partitioningCandidates.includes("audit_events"), true);
  assert.equal(webhookPersistence.deliveryIdUniqueness, "required");
  assert.equal(webhookPersistence.rawPayloadStorage, false);
  assert.equal(webhookPersistence.backgroundWorkerImplemented, false);
  assert.equal(hasDatabaseUrlValue({ schema, indexReview, retention, auditGrowth, webhookPersistence }), false);
});

test("database readiness APIs and health metadata are read-only and hide DB URLs", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/database/summary");
    const profiles = await getJson(port, "/readiness/database/profiles");
    const checks = await getJson(port, "/readiness/database/checks?profileId=production");
    const risks = await getJson(port, "/readiness/database/risks");
    const migrations = await getJson(port, "/readiness/database/migrations");
    const indexReview = await getJson(port, "/readiness/database/index-review");
    const retention = await getJson(port, "/readiness/database/retention");
    const auditGrowth = await getJson(port, "/readiness/database/audit-growth");
    const webhookPersistence = await getJson(port, "/readiness/database/webhook-persistence");
    const schema = await getJson(port, "/readiness/database/schema");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/database/summary");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).databaseUrlConfigured, true);
    assert.equal((summary.body.summary as Record<string, unknown>).databaseUrlExposed, false);
    assert.equal((summary.body.summary as Record<string, unknown>).productionDbConnectionAttempted, false);
    assert.equal(profiles.statusCode, 200);
    assert.equal((profiles.body.profiles as unknown[]).length, 4);
    assert.equal(checks.statusCode, 200);
    assert.equal((checks.body.checks as Array<Record<string, unknown>>).some((check) => check.id === "db_pooling_required"), true);
    assert.equal(risks.statusCode, 200);
    assert.equal(migrations.statusCode, 200);
    assert.equal((migrations.body.migrations as Array<Record<string, unknown>>).some((migration) => String(migration.checksum).startsWith("sha256:")), true);
    assert.equal(indexReview.statusCode, 200);
    assert.equal(retention.statusCode, 200);
    assert.equal((retention.body.retention as Record<string, unknown>).deletionJobsEnabled, false);
    assert.equal(auditGrowth.statusCode, 200);
    assert.equal(webhookPersistence.statusCode, 200);
    assert.equal((webhookPersistence.body.webhookPersistence as Record<string, unknown>).rawPayloadStorage, false);
    assert.equal(schema.statusCode, 200);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.databaseOperations as Record<string, unknown>).databaseUrlConfigured, true);
    assert.equal((health.body.databaseOperations as Record<string, unknown>).databaseUrlExposed, false);
    assert.equal((health.body.databaseOperations as Record<string, unknown>).productionDbConnectionAttempted, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasDatabaseUrlValue({ summary, profiles, checks, risks, migrations, indexReview, retention, auditGrowth, webhookPersistence, schema, health }), false);
  }, {
    AICHESTRA_STORAGE_PROVIDER: undefined,
    AICHESTRA_DATABASE_URL: "postgres://db-user:db-password@example.invalid/aichestra",
    AICHESTRA_TEST_DATABASE_URL: "postgres://test-user:test-db-password@example.invalid/aichestra_test"
  });
});

test("dashboard exposes DB operations panel without production DB connection or DB URL values", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/database");
    const panel = dashboard.body.database as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).productionDbConnectionAttempted, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).databaseUrlExposed, false);
    assert.equal(Array.isArray(panel.migrations), true);
    assert.equal(Array.isArray(panel.indexReview), true);
    assert.equal(Array.isArray(panel.blockers), true);
    assert.equal(hasDatabaseUrlValue(dashboard), false);
  }, {
    AICHESTRA_DATABASE_URL: "postgres://db-user:db-password@example.invalid/aichestra"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Database Operations"), true);
  assert.equal(html.includes("Migration readiness"), true);
  assert.equal(html.includes("Webhook persistence"), true);
  assert.equal(html.includes("Backup and restore"), true);
  assert.equal(html.includes("No DB URL exposure"), true);
  assert.equal(html.includes("postgres://"), false);
  assert.equal(html.includes("db-password"), false);
});

test("schema skeleton and docs preserve webhook/audit index recommendations without destructive jobs", () => {
  const schemaSql = readFileSync("infra/migrations/0001_initial_aichestra_schema.sql", "utf8");

  assert.equal(schemaSql.includes("CREATE TABLE IF NOT EXISTS git_webhook_events"), true);
  assert.equal(schemaSql.includes("idx_git_webhook_events_delivery"), true);
  assert.equal(schemaSql.includes("CREATE TABLE IF NOT EXISTS git_webhook_audit_events"), true);
  assert.equal(schemaSql.includes("CREATE TABLE IF NOT EXISTS audit_events"), true);
  assert.equal(schemaSql.includes("DROP TABLE"), false);
  assert.equal(schemaSql.includes("DELETE FROM"), false);
});

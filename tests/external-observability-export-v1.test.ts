import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  DisabledObservabilityExporter,
  ExternalObservabilityExportReadinessService,
  FutureObservabilityExporter,
  MockObservabilityExporter,
  createExternalObservabilityExportReadinessService
} from "@aichestra/observability";
import type { ObservabilityExportEnvelope } from "@aichestra/observability";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

function hasUnsafeExportMaterial(value: unknown): boolean {
  const text = JSON.stringify(value);
  return text.includes("sk-export-secret") ||
    text.includes("ghp_exportsecret") ||
    text.includes("Bearer export-token") ||
    text.includes("SESSION_SECRET=export-session") ||
    text.includes("JWT_SECRET=export-jwt") ||
    text.includes("postgres://export") ||
    text.includes("https://observability.example.invalid") ||
    text.includes("raw webhook payload value");
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

function postJson(port: number, path: string, body: Record<string, unknown>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
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
    request.end(serialized);
  });
}

async function withApiServer(run: (port: number) => Promise<void>): Promise<void> {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    await run(address.port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("external observability exporter defaults to disabled with future backends unconfigured", () => {
  const service = createExternalObservabilityExportReadinessService();
  const summary = service.getSummary();
  const configs = service.getExporterConfigs();
  const disabled = new DisabledObservabilityExporter();

  assert.equal(summary.exporterEnabled, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.rawPayloadExportAllowed, false);
  assert.equal(summary.secretExportAllowed, false);
  assert.equal(summary.configuredExporterCount, 0);
  assert.equal(summary.failedSafetyCheckCount, 0);
  assert.equal(configs.some((config) => config.exporterKind === "disabled" && config.status === "disabled"), true);
  assert.equal(configs.filter((config) => config.exporterKind.endsWith("_future")).every((config) => config.status === "future"), true);
  assert.equal(configs.every((config) => config.externalCallsEnabled === false), true);
  assert.equal(disabled.getStatus(), "disabled");
});

test("mock exporter records deterministic metadata only and never performs external export", () => {
  const fixedNow = new Date("2026-05-18T00:00:00.000Z");
  const service = new ExternalObservabilityExportReadinessService();
  const mock = new MockObservabilityExporter({ now: () => fixedNow });
  const envelope = service.buildSafeExportEnvelope({
    id: "export_envelope_demo",
    envelopeKind: "audit",
    source: "test",
    tenantId: "tenant_demo",
    retentionClass: "security",
    redactionClass: "secret_adjacent",
    payloadSummary: "credential resolution summary with sk-export-secret-12345678",
    rawPayload: "raw webhook payload value",
    metadata: {
      apiKey: "sk-export-secret-12345678",
      exporterEndpoint: "https://observability.example.invalid",
      note: "SESSION_SECRET=export-session"
    }
  });
  const result = mock.exportEnvelope(envelope);
  const records = mock.listRecordedMetadata();

  assert.equal(result.status, "recorded_mock_metadata");
  assert.equal(result.externalCallAttempted, false);
  assert.equal(result.rawPayloadExported, false);
  assert.equal(result.secretExported, false);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.recordedAt.toISOString(), fixedNow.toISOString());
  assert.equal(records[0]?.rawPayloadIncluded, false);
  assert.equal(records[0]?.secretFieldsRedacted, true);
  assert.equal(hasUnsafeExportMaterial({ envelope, result, records }), false);
});

test("future exporters return not-configured metadata without external calls", () => {
  const service = createExternalObservabilityExportReadinessService();
  const envelope = service.buildSafeExportEnvelope({ source: "future_check", tenantId: "tenant_demo" });
  const future = new FutureObservabilityExporter("datadog_future");
  const result = future.exportEnvelope(envelope);

  assert.equal(future.getStatus(), "future");
  assert.equal(result.status, "future_not_configured");
  assert.equal(result.externalCallAttempted, false);
  assert.equal(result.rawPayloadExported, false);
  assert.equal(result.secretExported, false);
  assert.equal(hasUnsafeExportMaterial(result), false);
});

test("export envelope builder excludes raw payloads, endpoint values, auth values, and env values", () => {
  const service = createExternalObservabilityExportReadinessService();
  const envelope = service.buildSafeExportEnvelope({
    source: "safe_builder",
    tenantId: "tenant_demo",
    payloadSummary: "OPENAI_API_KEY=sk-export-secret-12345678",
    rawPayloadIncluded: true,
    rawPayload: "raw webhook payload value",
    metadata: {
      authorization: "Bearer export-token-value",
      cookie: "session=export",
      databaseUrl: "postgres://export:secret@localhost/db",
      endpointUrl: "https://observability.example.invalid",
      token: "ghp_exportsecret12345678"
    }
  });
  const checks = service.validateEnvelope(envelope);

  assert.equal(envelope.rawPayloadIncluded, false);
  assert.equal(envelope.secretFieldsRedacted, true);
  assert.equal(checks.filter((check) => check.status === "fail").length, 0);
  assert.equal(hasUnsafeExportMaterial({ envelope, checks }), false);
});

test("safety checks catch raw payload, secret-like fields, env values, endpoint values, and auth values", () => {
  const service = createExternalObservabilityExportReadinessService();
  const safe = service.buildSafeExportEnvelope({ source: "unsafe_check", tenantId: "tenant_demo" });
  const unsafe = {
    ...safe,
    rawPayloadIncluded: true,
    metadata: {
      token: "sk-export-secret-12345678",
      envDump: "SESSION_SECRET=export-session",
      exporterEndpoint: "https://observability.example.invalid",
      authorization: "Bearer export-token-value"
    }
  } as unknown as ObservabilityExportEnvelope;
  const checks = service.validateEnvelope(unsafe);
  const statusByKind = new Map(checks.map((check) => [check.checkKind, check.status]));

  assert.equal(statusByKind.get("no_raw_payload"), "fail");
  assert.equal(statusByKind.get("no_secret_fields"), "fail");
  assert.equal(statusByKind.get("no_env_values"), "fail");
  assert.equal(statusByKind.get("endpoint_not_exposed"), "fail");
  assert.equal(statusByKind.get("auth_not_exposed"), "fail");
});

test("external observability export API endpoints are read-only, check-only, and safe", async () => {
  await withApiServer(async (port) => {
    const config = await getJson(port, "/observability/export/config");
    const backends = await getJson(port, "/observability/export/backends");
    const safetyChecks = await getJson(port, "/observability/export/safety-checks");
    const summary = await getJson(port, "/observability/export/summary");
    const checked = await postJson(port, "/observability/export/mock-envelope/check", {
      source: "api_check",
      tenantId: "tenant_demo",
      rawPayloadIncluded: true,
      rawPayload: "raw webhook payload value",
      payloadSummary: "Bearer export-token-value",
      metadata: {
        apiKey: "sk-export-secret-12345678",
        exporterEndpoint: "https://observability.example.invalid",
        databaseUrl: "postgres://export:secret@localhost/db",
        envDump: "JWT_SECRET=export-jwt"
      }
    });

    assert.equal(config.statusCode, 200);
    assert.equal(backends.statusCode, 200);
    assert.equal(safetyChecks.statusCode, 200);
    assert.equal(summary.statusCode, 200);
    assert.equal(checked.statusCode, 200);
    assert.equal(((summary.body.summary as Record<string, unknown>).exporterEnabled), false);
    assert.equal(((summary.body.summary as Record<string, unknown>).externalCallsEnabled), false);
    assert.equal(((summary.body.summary as Record<string, unknown>).rawPayloadExportAllowed), false);
    assert.equal(((summary.body.summary as Record<string, unknown>).secretExportAllowed), false);
    assert.equal((checked.body.envelope as Record<string, unknown>).rawPayloadIncluded, false);
    assert.equal(checked.body.exportAttempted, false);
    assert.equal(checked.body.externalCallAttempted, false);
    assert.equal(hasUnsafeExportMaterial({ config, backends, safetyChecks, summary, checked }), false);
  });
});

test("dashboard export panel renders disabled status without secrets or endpoint values", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/observability");
    const observability = dashboard.body.observability as Record<string, unknown>;
    const summary = observability.exportReadinessSummary as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal(summary.exporterEnabled, false);
    assert.equal(summary.externalCallsEnabled, false);
    assert.equal(summary.rawPayloadExportAllowed, false);
    assert.equal(summary.secretExportAllowed, false);
    assert.equal(Array.isArray(observability.exportSafetyChecks), true);
    assert.equal(Array.isArray(observability.futureBackends), true);
    assert.equal(hasUnsafeExportMaterial(dashboard), false);
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("External Observability Export"), true);
  assert.equal(html.includes("raw payload export false"), true);
  assert.equal(html.includes("external calls disabled"), true);
  assert.equal(hasUnsafeExportMaterial(html), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  policyRuntimeGoldenCases,
  runPolicyRuntimeGoldenHarness,
  validatePolicyRuntimeGoldenCases
} from "@aichestra/policy";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

function hasUnsafeGoldenHarnessValue(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return /sk-[a-z0-9_-]{12,}|ghp_[a-z0-9_]+|github_pat_[a-z0-9_]+|Bearer\s+[a-z0-9._-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|OPENAI_API_KEY=|ANTHROPIC_API_KEY=|GITHUB_TOKEN=|GITHUB_APP_PRIVATE_KEY=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|AICHESTRA_LLM_API_KEY=|LLM_API_KEY=|VAULT_TOKEN=|AICHESTRA_VAULT_TOKEN=|SESSION_SECRET=|JWT_SECRET=|DATABASE_URL=|postgres:\/\/|~\/\.codex|~\/\.claude|auth\.json/i.test(serialized);
}

function getJsonWithStatus(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
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

function postJsonWithStatus(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
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

test("policy runtime golden cases are deterministic, normalized, and secret-free", () => {
  const validation = validatePolicyRuntimeGoldenCases();
  const ids = new Set(policyRuntimeGoldenCases.map((goldenCase) => goldenCase.id));
  const domains = new Set(policyRuntimeGoldenCases.map((goldenCase) => goldenCase.domain));

  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(policyRuntimeGoldenCases.length, 42);
  assert.equal(ids.size, policyRuntimeGoldenCases.length);
  assert.equal(domains.size, 11);
  assert.equal(ids.has("git_remote_merge_denied"), true);
  assert.equal(ids.has("llm_remote_completion_denied_default"), true);
  assert.equal(ids.has("mcp_critical_tool_denied"), true);
  assert.equal(ids.has("secret_read_denied"), true);
  assert.equal(ids.has("credential_cache_read_denied"), true);
  assert.equal(ids.has("runner_secret_injection_denied"), true);
  assert.equal(ids.has("governance_apply_denied"), true);
  assert.equal(ids.has("service_account_cannot_bypass_scope_policy"), true);
  assert.equal(ids.has("missing_tenant_scope_does_not_grant_access"), true);
  assert.equal(policyRuntimeGoldenCases.every((goldenCase) => goldenCase.subject.actorId && goldenCase.resource.resourceKind && goldenCase.context.metadata), true);
  assert.equal(policyRuntimeGoldenCases.every((goldenCase) => goldenCase.expectedDecision.effect === "allow" || goldenCase.expectedDecision.effect === "deny" || goldenCase.expectedDecision.effect === "block" || goldenCase.expectedDecision.effect === "warn"), true);
  assert.equal(hasUnsafeGoldenHarnessValue(policyRuntimeGoldenCases), false);
});

test("policy runtime golden harness matches StaticPolicyEngine expectations", () => {
  const report = runPolicyRuntimeGoldenHarness();
  const resultById = new Map(report.results.map((result) => [result.id, result]));

  assert.equal(report.summary.status, "pass");
  assert.equal(report.summary.sourceOfTruth, "StaticPolicyEngine");
  assert.equal(report.summary.totalCases, 42);
  assert.equal(report.summary.passedCases, 42);
  assert.equal(report.summary.failedCases, 0);
  assert.equal(report.summary.expectedDenyCases, 35);
  assert.equal(report.summary.expectedAllowCases, 6);
  assert.equal(report.summary.expectedBlockCases, 1);
  assert.equal(report.summary.staticPolicyEngineOnly, true);
  assert.equal(report.summary.dynamicPolicyExecutionEnabled, false);
  assert.equal(report.summary.opaRuntimeExecuted, false);
  assert.equal(report.summary.cedarRuntimeExecuted, false);
  assert.equal(report.summary.signedBundleRuntimeExecuted, false);
  assert.equal(report.summary.externalPolicyServiceCallsEnabled, false);
  assert.equal(report.summary.remotePolicyLoadingEnabled, false);
  assert.equal(report.summary.hotReloadEnabled, false);
  assert.equal(report.results.every((result) => result.passed), true);

  assert.equal(resultById.get("git_remote_merge_denied")?.actualEffect, "deny");
  assert.equal(resultById.get("git_force_push_denied")?.actualEffect, "deny");
  assert.equal(resultById.get("secret_read_denied")?.actualEffect, "deny");
  assert.equal(resultById.get("credential_cache_read_denied")?.actualEffect, "deny");
  assert.equal(resultById.get("runner_secret_injection_denied")?.actualEffect, "deny");
  assert.equal(resultById.get("mcp_critical_tool_denied")?.actualEffect, "deny");
  assert.equal(resultById.get("governance_apply_denied")?.actualEffect, "deny");
  assert.equal(resultById.get("service_account_cannot_bypass_scope_policy")?.actualEffect, "deny");
  assert.equal(resultById.get("missing_tenant_scope_does_not_grant_access")?.actualEffect, "deny");
  assert.equal(resultById.get("local_agent_consent_required")?.actualEffect, "block");
  assert.equal(resultById.get("mcp_low_risk_mock_readonly_allowed")?.actualEffect, "allow");
  assert.equal(resultById.get("llm_remote_completion_gated_allowed")?.actualEffect, "allow");
  assert.equal(hasUnsafeGoldenHarnessValue(report), false);
});

test("policy runtime golden summary API is read-only and sanitized", async () => {
  await withApiServer(async (port) => {
    const summary = await getJsonWithStatus(port, "/readiness/policy-runtime-poc/golden-summary");
    const writeAttempt = await postJsonWithStatus(port, "/readiness/policy-runtime-poc/golden-summary");
    const goldenSummary = summary.body.goldenSummary as Record<string, unknown>;
    const goldenResults = summary.body.goldenResults as Array<Record<string, unknown>>;

    assert.equal(summary.statusCode, 200);
    assert.equal(goldenSummary.status, "pass");
    assert.equal(goldenSummary.sourceOfTruth, "StaticPolicyEngine");
    assert.equal(goldenSummary.totalCases, 42);
    assert.equal(goldenSummary.failedCases, 0);
    assert.equal(goldenSummary.dynamicPolicyExecutionEnabled, false);
    assert.equal(goldenSummary.opaRuntimeExecuted, false);
    assert.equal(goldenSummary.cedarRuntimeExecuted, false);
    assert.equal(goldenSummary.signedBundleRuntimeExecuted, false);
    assert.equal(goldenSummary.externalPolicyServiceCallsEnabled, false);
    assert.equal(goldenSummary.secretsInFixtures, false);
    assert.equal(goldenSummary.envValuesExposed, false);
    assert.equal(goldenResults.length, 42);
    assert.equal(goldenResults.every((result) => result.passed === true && result.mismatchCount === 0), true);
    assert.equal(goldenResults.some((result) => result.id === "git_remote_merge_denied" && result.actualEffect === "deny"), true);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasUnsafeGoldenHarnessValue({ summary, writeAttempt }), false);
  }, {
    OPENAI_API_KEY: "sk-env-secret-for-redaction-test",
    GITHUB_TOKEN: "ghp_env_secret_for_redaction_test",
    VAULT_TOKEN: "vault-env-secret-for-redaction-test",
    SESSION_SECRET: "session-env-secret-for-redaction-test"
  });
});

test("policy runtime dashboard exposes golden harness summary without runtime execution", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJsonWithStatus(port, "/dashboard/policy-runtime-poc");
    const panel = dashboard.body.policyRuntimePoc as Record<string, unknown>;
    const harness = panel.goldenHarness as Record<string, unknown>;
    const harnessResults = panel.goldenHarnessResults as Array<Record<string, unknown>>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).currentRuntime, "StaticPolicyEngine");
    assert.equal((panel.summary as Record<string, unknown>).runtimeEnforcementEnabled, false);
    assert.equal(harness.status, "pass");
    assert.equal(harness.sourceOfTruth, "StaticPolicyEngine");
    assert.equal(harness.totalCases, 42);
    assert.equal(harness.failedCases, 0);
    assert.equal(harness.dynamicPolicyExecutionEnabled, false);
    assert.equal(harness.opaRuntimeExecuted, false);
    assert.equal(harness.cedarRuntimeExecuted, false);
    assert.equal(harness.signedBundleRuntimeExecuted, false);
    assert.equal(harnessResults.length, 42);
    assert.equal((panel.noExecutionStatus as Record<string, unknown>).policyCodeExecuted, false);
    assert.equal((panel.noExecutionStatus as Record<string, unknown>).noSecretsExposed, true);
    assert.equal(hasUnsafeGoldenHarnessValue(dashboard), false);
  }, {
    OPENAI_API_KEY: "sk-dashboard-secret",
    GITHUB_TOKEN: "ghp_dashboard_secret",
    VAULT_TOKEN: "vault-dashboard-secret",
    JWT_SECRET: "jwt-dashboard-secret"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Policy Runtime PoC Planning"), true);
  assert.equal(html.includes("Golden harness"), true);
  assert.equal(html.includes("StaticPolicyEngine"), true);
  assert.equal(html.includes("dynamic execution disabled"), true);
  assert.equal(hasUnsafeGoldenHarnessValue(html), false);
});

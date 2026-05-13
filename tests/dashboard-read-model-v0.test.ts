import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  ApiDashboardDataProvider,
  createDashboardDataProviderFromEnv,
  DemoDashboardDataProvider
} from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml, renderDashboardReadModels } from "../apps/web/src/render.ts";
import type { DashboardReadModels } from "@aichestra/shared";

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

function postJsonWithStatus(port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
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
            body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
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

function jsonHasUnsafeSecret(value: unknown): boolean {
  const text = JSON.stringify(value);
  return text.includes("sk-dashboard-secret") ||
    text.includes("ghp_") ||
    text.includes("github_pat_") ||
    text.includes("OPENAI_API_KEY=") ||
    text.includes("ANTHROPIC_API_KEY=") ||
    text.includes("GITHUB_TOKEN=") ||
    text.includes("auth.json");
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

test("dashboard read-model API exposes safe read-only sections", async () => {
  await withApiServer(async (port) => {
    const overview = await getJson(port, "/dashboard/overview") as { overview: { source: string; safety: { noSecretsExposed: boolean; remoteMergeEnabled: boolean } } };
    const tasks = await getJson(port, "/dashboard/tasks") as { tasks: { tasks: unknown[]; taskRuns: unknown[] } };
    const git = await getJson(port, "/dashboard/git") as { git: { config: { remoteGitEnabled: boolean }; blockedExamples: unknown[]; remoteAuditEvents: unknown[] } };
    const llm = await getJson(port, "/dashboard/llm") as { llm: { models: unknown[]; blockedExamples: unknown[] } };
    const agents = await getJson(port, "/dashboard/agents") as { agents: { config: { localCommandExecutionEnabled: boolean }; blockedExamples: unknown[] } };
    const policy = await getJson(port, "/dashboard/policy") as { policy: { rules: unknown[]; blockedExamples: unknown[] } };
    const auth = await getJson(port, "/dashboard/auth") as { auth: { config: { authMode: string; productionAuthEnabled: boolean }; warning: string; actors: unknown[] } };
    const providers = await getJson(port, "/dashboard/providers") as { providers: { catalog: unknown[]; blockedExamples: unknown[] } };
    const security = await getJson(port, "/dashboard/security") as { security: { secretRefs: unknown[]; blockedExamples: unknown[] } };
    const localAgents = await getJson(port, "/dashboard/local-agents") as { localAgents: { config: { realTransportEnabled: boolean; vendorCliExecutionEnabled: boolean }; blockedExamples: unknown[] } };
    const readiness = await getJson(port, "/dashboard/readiness") as { readiness: { summary: { productionReady: boolean; criticalBlockerCount: number }; environmentWarnings: unknown[]; noSecretsExposed: boolean } };
    const audit = await getJson(port, "/dashboard/audit") as { audit: { auditGroups: unknown[]; summary: { noSecretsExposed: boolean } } };

    assert.equal(overview.overview.source, "api");
    assert.equal(overview.overview.safety.noSecretsExposed, true);
    assert.equal(overview.overview.safety.remoteMergeEnabled, false);
    assert.equal(Array.isArray(tasks.tasks.tasks), true);
    assert.equal(Array.isArray(tasks.tasks.taskRuns), true);
    assert.equal(git.git.config.remoteGitEnabled, false);
    assert.equal(git.git.blockedExamples.length > 0, true);
    assert.equal(llm.llm.models.length > 0, true);
    assert.equal(llm.llm.blockedExamples.length > 0, true);
    assert.equal(agents.agents.config.localCommandExecutionEnabled, false);
    assert.equal(agents.agents.blockedExamples.length > 0, true);
    assert.equal(policy.policy.rules.length > 0, true);
    assert.equal(policy.policy.blockedExamples.length > 0, true);
    assert.equal(auth.auth.config.authMode, "mock");
    assert.equal(auth.auth.config.productionAuthEnabled, false);
    assert.equal(auth.auth.actors.length > 0, true);
    assert.equal(auth.auth.warning.includes("not production authentication"), true);
    assert.equal(providers.providers.catalog.length > 0, true);
    assert.equal(providers.providers.blockedExamples.length > 0, true);
    assert.equal(security.security.secretRefs.length > 0, true);
    assert.equal(security.security.blockedExamples.length > 0, true);
    assert.equal(localAgents.localAgents.config.realTransportEnabled, false);
    assert.equal(localAgents.localAgents.config.vendorCliExecutionEnabled, false);
    assert.equal(localAgents.localAgents.blockedExamples.length > 0, true);
    assert.equal(readiness.readiness.summary.productionReady, false);
    assert.equal(readiness.readiness.summary.criticalBlockerCount > 0, true);
    assert.equal(readiness.readiness.environmentWarnings.includes("mock_actor_warning"), true);
    assert.equal(readiness.readiness.noSecretsExposed, true);
    assert.equal(audit.audit.auditGroups.length > 0, true);
    assert.equal(audit.audit.summary.noSecretsExposed, true);
    assert.equal(jsonHasUnsafeSecret({ overview, tasks, git, llm, agents, policy, auth, providers, security, localAgents, readiness, audit }), false);
  });
});

test("dashboard read-model endpoints do not mutate Git audit or accept workflow-style writes", async () => {
  await withApiServer(async (port) => {
    const before = await getJson(port, "/git/audit") as { auditEvents: unknown[] };
    await getJson(port, "/dashboard/git");
    await getJson(port, "/dashboard/overview");
    const after = await getJson(port, "/git/audit") as { auditEvents: unknown[] };
    const writeAttempt = await postJsonWithStatus(port, "/dashboard/overview", {});

    assert.equal(after.auditEvents.length, before.auditEvents.length);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(writeAttempt.body.error, "method_not_allowed");
  });
});

test("dashboard data providers support demo, API, and explicit fallback modes", async () => {
  const demo = await new DemoDashboardDataProvider().getReadModels();
  assert.equal(demo.overview.source, "demo");
  assert.equal(demo.git.config.remoteGitEnabled, false);
  assert.equal(jsonHasUnsafeSecret(demo), false);

  const endpoints = new Map<string, unknown>([
    ["/dashboard/overview", { overview: { ...demo.overview, source: "api" } }],
    ["/dashboard/tasks", { tasks: demo.tasks }],
    ["/dashboard/git", { git: demo.git }],
    ["/dashboard/conflicts", { conflicts: demo.conflicts }],
    ["/dashboard/registry", { registry: demo.registry }],
    ["/dashboard/llm", { llm: demo.llm }],
    ["/dashboard/agents", { agents: demo.agents }],
    ["/dashboard/policy", { policy: demo.policy }],
    ["/dashboard/auth", { auth: demo.auth }],
    ["/dashboard/providers", { providers: demo.providers }],
    ["/dashboard/security", { security: demo.security }],
    ["/dashboard/local-agents", { localAgents: demo.localAgents }],
    ["/dashboard/mcp", { mcp: demo.mcp }],
    ["/dashboard/readiness", { readiness: demo.readiness }],
    ["/dashboard/audit", { audit: demo.audit }]
  ]);
  const requested: string[] = [];
  const apiProvider = new ApiDashboardDataProvider({
    baseUrl: "http://aichestra-api.local",
    fetchImpl: async (input) => {
      const pathname = new URL(String(input)).pathname;
      requested.push(pathname);
      const body = endpoints.get(pathname);
      assert.notEqual(body, undefined);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body)
      };
    }
  });
  const api = await apiProvider.getReadModels();
  assert.equal(api.overview.source, "api");
  assert.equal(requested.length, endpoints.size);

  const fallbackProvider = new ApiDashboardDataProvider({
    baseUrl: "http://aichestra-api.local",
    fetchImpl: async () => {
      throw new Error("offline");
    },
    fallbackProvider: {
      getReadModels: async (): Promise<DashboardReadModels> => demo
    }
  });
  const fallback = await fallbackProvider.getReadModels();
  assert.equal(fallback.overview.source, "demo");

  assert.equal(await createDashboardDataProviderFromEnv({ AICHESTRA_DASHBOARD_DATA_SOURCE: "demo" }).getReadModels().then((models) => models.overview.source), "demo");
});

test("dashboard renderer consumes read models and preserves static demo fallback", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Data source"), true);
  assert.equal(html.includes("demo"), true);
  assert.equal(html.includes("Git Adapter"), true);
  assert.equal(html.includes("LLM Gateway"), true);
  assert.equal(html.includes("Auth/RBAC"), true);
  assert.equal(html.includes("Local Agent Protocol"), true);
  assert.equal(html.includes("Production Readiness"), true);
  assert.equal(html.includes("credential cache paths redacted"), true);
  assert.equal(html.includes("sk-dashboard-secret"), false);
  assert.equal(html.includes("auth.json"), false);

  const demo = await new DemoDashboardDataProvider().getReadModels();
  const rendered = renderDashboardReadModels({ ...demo, overview: { ...demo.overview, source: "api" } });
  assert.equal(rendered.includes("api"), true);
});

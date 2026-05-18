import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  ProviderAbstractionService,
  seedLocalCliCompatibilityRules,
  seedLocalCliParserProfiles,
  seedLocalCliProviderTemplates,
  seedLocalCliSecurityConstraints
} from "@aichestra/llm-gateway";
import { PolicyService, createPolicyContext, createPolicyResource, createPolicySubject } from "@aichestra/policy";
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

test("Local CLI Provider Templates v1 lists deterministic metadata-only provider templates", () => {
  const templates = seedLocalCliProviderTemplates();
  const providerIds = templates.map((template) => template.providerId);

  assert.deepEqual(providerIds, [
    "claude-code-local",
    "codex-cli-local",
    "gemini-cli-local",
    "aider-local",
    "custom-local-cli"
  ]);
  assert.equal(templates.every((template) => template.status === "template_only"), true);
  assert.equal(templates.every((template) => template.invocationMode === "local_agent_required"), true);
  assert.equal(templates.every((template) => template.sandboxPolicy.directExecutionAllowed === false), true);
  assert.equal(templates.every((template) => template.sandboxPolicy.ptyAllowed === false), true);
  assert.equal(templates.every((template) => template.credentialPolicy.credentialCacheReadAllowed === false), true);
  assert.equal(templates.every((template) => template.credentialPolicy.secretForwardingAllowed === false), true);
  assert.equal(JSON.stringify(templates).includes("commandPath"), false);
  assert.equal(JSON.stringify(templates).includes("auth.json"), false);
});

test("Local CLI Provider Templates v1 exposes parser profiles, compatibility rules, and enforced security constraints", () => {
  const templates = seedLocalCliProviderTemplates();
  const rules = seedLocalCliCompatibilityRules();
  const profiles = seedLocalCliParserProfiles();
  const constraints = seedLocalCliSecurityConstraints();

  for (const template of templates) {
    assert.equal(profiles.some((profile) => profile.id === template.parserProfile && profile.providerId === template.providerId), true);
    assert.equal(rules.some((rule) => rule.providerId === template.providerId && rule.capability === "local_agent_channel" && rule.status === "supported_mock"), true);
    assert.equal(rules.some((rule) => rule.providerId === template.providerId && rule.capability === "direct_execution" && rule.status === "blocked"), true);
    assert.equal(rules.some((rule) => rule.providerId === template.providerId && rule.capability === "credential_cache_read" && rule.status === "blocked"), true);
    assert.equal(rules.some((rule) => rule.providerId === template.providerId && rule.capability === "secret_forwarding" && rule.status === "blocked"), true);
    assert.equal(rules.some((rule) => rule.providerId === template.providerId && rule.capability === "pty" && rule.status === "unsupported"), true);
    assert.equal(constraints.some((constraint) => constraint.providerId === template.providerId && constraint.constraint === "no_credential_cache_read" && constraint.status === "enforced"), true);
    assert.equal(constraints.some((constraint) => constraint.providerId === template.providerId && constraint.constraint === "no_secret_forwarding" && constraint.status === "enforced"), true);
    assert.equal(constraints.some((constraint) => constraint.providerId === template.providerId && constraint.constraint === "no_direct_execution" && constraint.status === "enforced"), true);
    assert.equal(constraints.some((constraint) => constraint.providerId === template.providerId && constraint.constraint === "no_pty" && constraint.status === "enforced"), true);
  }
});

test("Local CLI Provider Templates v1 keeps policy and service readiness deny-first", () => {
  const service = new ProviderAbstractionService();
  const readiness = service.getLocalCliReadiness();
  const policy = new PolicyService();
  const subject = createPolicySubject({ actorId: "local_cli_templates_v1", actorKind: "system", roles: ["system"] });
  const resource = createPolicyResource({ resourceKind: "local_cli", resourceId: "codex-cli-local" });
  const templateRead = policy.evaluate({
    subject,
    action: "local_cli.template.read",
    resource,
    context: createPolicyContext({ metadata: { secretOrEnvValuesExposed: false } })
  });
  const execute = policy.evaluate({ subject, action: "local_cli.execute", resource, context: createPolicyContext() });
  const credentialCacheRead = policy.evaluate({ subject, action: "local_cli.credential_cache.read", resource, context: createPolicyContext() });
  const secretForward = policy.evaluate({ subject, action: "local_cli.secret.forward", resource, context: createPolicyContext() });

  assert.equal(readiness.status, "v1_implemented");
  assert.equal(readiness.vendorCliExecutionImplemented, false);
  assert.equal(readiness.credentialCacheReadAllowed, false);
  assert.equal(readiness.secretForwardingAllowed, false);
  assert.equal(templateRead.allowed, true);
  assert.equal(execute.allowed, false);
  assert.equal(credentialCacheRead.allowed, false);
  assert.equal(secretForward.allowed, false);
});

test("Local CLI Provider Templates v1 API endpoints are read-only and expose no secrets", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const templates = await getJson(address.port, "/providers/local-cli/templates");
    const template = await getJson(address.port, "/providers/local-cli/templates/codex-cli-template-v1");
    const compatibility = await getJson(address.port, "/providers/local-cli/compatibility");
    const constraints = await getJson(address.port, "/providers/local-cli/security-constraints");
    const readiness = await getJson(address.port, "/providers/local-cli/readiness");
    const post = await postJson(address.port, "/providers/local-cli/templates", {});
    const dashboard = await getJson(address.port, "/dashboard/providers");
    const serialized = JSON.stringify({ templates, template, compatibility, constraints, readiness, dashboard });

    assert.equal(templates.statusCode, 200);
    assert.equal(template.statusCode, 200);
    assert.equal(compatibility.statusCode, 200);
    assert.equal(constraints.statusCode, 200);
    assert.equal(readiness.statusCode, 200);
    assert.equal(post.statusCode, 405);
    assert.equal(((readiness.body.readiness as Record<string, unknown>).status), "v1_implemented");
    assert.equal(serialized.includes("OPENAI_API_KEY"), false);
    assert.equal(serialized.includes("ANTHROPIC_API_KEY"), false);
    assert.equal(serialized.includes("GOOGLE_APPLICATION_CREDENTIALS"), false);
    assert.equal(serialized.includes("auth.json"), false);
    assert.equal(serialized.includes("~/.claude"), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("dashboard panel renders Local CLI Provider Templates v1 safety state", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("Local CLI templates v1"), true);
  assert.equal(html.includes("Credential cache access"), true);
  assert.equal(html.includes("Secret forwarding"), true);
  assert.equal(html.includes("PTY fallback"), true);
});

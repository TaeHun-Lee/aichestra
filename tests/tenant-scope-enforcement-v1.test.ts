import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import {
  createTenantScopeEnforcementService,
  type TenantScopeSurfaceScope
} from "@aichestra/auth";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  PolicyService,
  createAuditQueryPolicyResource,
  createGitRepoPolicyResource,
  createPolicyContext,
  createPolicySubject,
  createSecretRefPolicyResource
} from "@aichestra/policy";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardReadModels } from "../apps/web/src/render.ts";

function hasSecretOrEnvValue(value: unknown): boolean {
  return /sk-[A-Za-z0-9_-]+|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._~+/=-]+|OPENAI_API_KEY=|ANTHROPIC_API_KEY=|GITHUB_TOKEN=|GITHUB_APP_PRIVATE_KEY=|GITHUB_APP_ID=|GITHUB_INSTALLATION_ID=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|GOOGLE_APPLICATION_CREDENTIALS=|AICHESTRA_LLM_API_KEY=|LLM_API_KEY=|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|VAULT_ADDR=|VAULT_TOKEN=|AICHESTRA_VAULT_TOKEN=|SESSION_SECRET=|JWT_SECRET=|PASSWORD=|SAML_ASSERTION=|OIDC_ID_TOKEN=|SCIM_TOKEN=|auth\.json|~\/\.codex|~\/\.claude|postgres:\/\//i.test(JSON.stringify(value));
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

async function withApiServer(run: (port: number) => Promise<void>): Promise<void> {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("Tenant Scope Enforcement v1 allows matching tenant and repo metadata without claiming production isolation", () => {
  const service = createTenantScopeEnforcementService();
  const resource = createGitRepoPolicyResource({
    repoId: "repo_scope_enforcement",
    tenantId: "tenant_a",
    teamId: "team_a",
    projectId: "project_a"
  });
  const subject = createPolicySubject({
    actorId: "user_scope_match",
    actorKind: "user",
    roles: ["developer"],
    tenantIds: ["tenant_a"],
    teamIds: ["team_a"],
    projectIds: ["project_a"],
    resourceScopes: resource.resourceScopes
  });
  const decision = service.evaluateScopeAccess(subject, resource, {
    requiredScopes: ["tenant", "team", "project", "repo"],
    source: "test:repo_match"
  });
  const summary = service.summarizeDecision(decision);

  assert.equal(decision.decision, "allow");
  assert.equal(decision.reason, "subject_and_resource_scopes_match");
  assert.deepEqual(decision.missingScopes, []);
  assert.deepEqual(decision.mismatchedScopes, []);
  assert.equal(summary.tenantFilteringImplemented, false);
  assert.equal(summary.productionTenantEnforcement, false);
  assert.equal(summary.productionReady, false);
  assert.equal(hasSecretOrEnvValue({ decision, summary }), false);
});

test("Tenant Scope Enforcement v1 warns for missing scope and records remediation metadata", () => {
  const service = createTenantScopeEnforcementService();
  const resource = createGitRepoPolicyResource({
    repoId: "repo_scope_warning",
    tenantId: "tenant_a",
    teamId: "team_a",
    projectId: "project_a"
  });
  const subject = createPolicySubject({
    actorId: "user_missing_scope",
    actorKind: "user",
    roles: ["viewer"]
  });
  const decision = service.evaluateScopeAccess(subject, resource, {
    requiredScopes: ["tenant", "repo"],
    enforcementMode: "warning",
    source: "test:missing_scope"
  });
  const summary = service.summarizeDecision(decision);

  assert.equal(decision.decision, "warn");
  assert.match(decision.reason, /missing_scope_warning/);
  assert.equal(decision.missingScopes.includes("tenant"), true);
  assert.equal(decision.missingScopes.includes("repo"), true);
  assert.equal(decision.mismatchedScopes.some((entry) => entry.mismatchKind === "missing_tenant"), true);
  assert.equal(decision.mismatchedScopes.some((entry) => entry.metadata.remediation === "Attach explicit tenant scope before production."), true);
  assert.equal(summary.warnings.includes("production_tenant_enforcement:false"), true);
  assert.equal(hasSecretOrEnvValue({ decision, summary }), false);
});

test("Tenant Scope Enforcement v1 detects mismatches and does not let service accounts bypass scope gaps", () => {
  const service = createTenantScopeEnforcementService();
  const resource = createGitRepoPolicyResource({
    repoId: "repo_scope_mismatch",
    tenantId: "tenant_b",
    teamId: "team_b",
    projectId: "project_b"
  });
  const subject = createPolicySubject({
    actorId: "svc_scope_runner",
    actorKind: "service_account",
    roles: ["service_account_runner"],
    serviceAccountId: "service_account_runner",
    tenantIds: ["tenant_a"],
    teamIds: ["team_a"],
    projectIds: ["project_a"]
  });
  const decision = service.evaluateScopeAccess(subject, resource, {
    requiredScopes: ["tenant", "team", "project"],
    source: "test:service_account_mismatch"
  });
  const summary = service.summarizeDecision(decision);

  assert.equal(decision.decision, "warn");
  assert.equal(decision.actorId, "svc_scope_runner");
  assert.equal(decision.serviceAccountId, "service_account_runner");
  assert.equal(decision.mismatchedScopes.some((entry) => entry.mismatchKind === "tenant_mismatch"), true);
  assert.equal(decision.mismatchedScopes.some((entry) => entry.defaultAction === "future_deny"), true);
  assert.equal((summary.metadata as Record<string, unknown>).scopeAllowOverridesPolicyDeny, false);
  assert.equal(service.policyRelation(decision).scopeAllowOverridesPolicyDeny, false);
});

test("Tenant Scope Enforcement v1 uses stricter decisions for secret-adjacent and audit query surfaces", () => {
  const service = createTenantScopeEnforcementService();
  const secretResource = createSecretRefPolicyResource({
    secretRefId: "metadata_only_secret_ref",
    tenantId: "tenant_a",
    projectId: "project_a"
  });
  const secretDecision = service.evaluateSecretAdjacentAccess(undefined, secretResource, {
    source: "test:secret_adjacent"
  });
  const secretSummary = service.summarizeDecision(secretDecision);
  const auditResource = createAuditQueryPolicyResource({
    queryId: "audit_query_scope_missing",
    tenantId: "tenant_a",
    projectId: "project_a"
  });
  const auditDecision = service.evaluateAuditQueryAccess(undefined, auditResource, {
    source: "test:audit_query"
  });
  const auditSummary = service.summarizeDecision(auditDecision);

  assert.equal(secretDecision.decision, "deny");
  assert.equal(secretDecision.enforcementMode, "deny_for_sensitive");
  assert.equal(secretDecision.mismatchedScopes.some((entry) => entry.severity === "critical" || entry.severity === "high"), true);
  assert.equal(secretSummary.warnings.includes("secret_adjacent_scope_enforcement_strict"), true);
  assert.equal(auditDecision.decision, "warn");
  assert.equal(auditDecision.enforcementMode, "warning");
  assert.equal(auditDecision.missingScopes.includes("audit_query"), true);
  assert.equal(auditSummary.warnings.includes("audit_query_scope_required_before_production"), true);
  assert.equal(hasSecretOrEnvValue({ secretDecision, secretSummary, auditDecision, auditSummary }), false);
});

test("Tenant Scope Enforcement v1 allow metadata cannot override StaticPolicyEngine deny", () => {
  const service = createTenantScopeEnforcementService();
  const policy = new PolicyService();
  const secretResource = createSecretRefPolicyResource({
    secretRefId: "secret_ref_policy_deny",
    tenantId: "tenant_a",
    projectId: "project_a"
  });
  const subject = createPolicySubject({
    actorId: "scope_allow_policy_deny",
    actorKind: "system",
    roles: ["system"],
    tenantIds: ["tenant_a"],
    projectIds: ["project_a"],
    resourceScopes: secretResource.resourceScopes
  });
  const scopeDecision = service.evaluateScopeAccess(subject, secretResource, {
    requiredScopes: ["tenant", "project", "secret"],
    source: "test:scope_allow_policy_deny"
  });
  const policyDecision = policy.evaluate({
    subject,
    action: "secret.read",
    resource: secretResource,
    context: createPolicyContext()
  });
  const enrichedSubject = service.attachDecisionToPolicySubject(subject, scopeDecision);
  const enrichedResource = service.attachDecisionToPolicyResource(secretResource, scopeDecision);
  const relation = service.policyRelation(scopeDecision);

  assert.equal(scopeDecision.decision, "allow");
  assert.equal(policyDecision.allowed, false);
  assert.equal(policyDecision.decision, "deny");
  assert.equal(relation.policyDecisionStillAuthoritative, true);
  assert.equal(relation.scopeAllowOverridesPolicyDeny, false);
  assert.equal(typeof enrichedSubject.metadata?.tenantScopeEnforcement, "object");
  assert.equal(typeof enrichedResource.metadata.tenantScopeEnforcement, "object");
  assert.equal(hasSecretOrEnvValue({ scopeDecision, policyDecision, enrichedSubject, enrichedResource, relation }), false);
});

test("Tenant Scope Enforcement v1 evaluates representative dashboard and readiness surface scopes", () => {
  const service = createTenantScopeEnforcementService();
  const dashboardSurface: TenantScopeSurfaceScope = {
    panelId: "observability",
    requiredScopes: ["tenant", "audit_query"],
    redactionClass: "sensitive_metadata"
  };
  const readinessSurface: TenantScopeSurfaceScope = {
    endpointGroup: "Vault Secret Backend",
    endpointPattern: "/readiness/secrets/vault/*",
    requiredScopes: ["tenant", "secret"],
    redactionClass: "secret_adjacent"
  };
  const dashboardDecision = service.evaluateDashboardPanelAccess(undefined, dashboardSurface);
  const readinessDecision = service.evaluateReadinessEndpointAccess(undefined, readinessSurface);

  assert.equal(dashboardDecision.decision, "warn");
  assert.equal(dashboardDecision.source, "dashboard:observability");
  assert.equal(service.summarizeDecision(dashboardDecision).warnings.includes("audit_query_scope_required_before_production"), true);
  assert.equal(readinessDecision.decision, "warn");
  assert.equal(readinessDecision.source, "readiness:/readiness/secrets/vault/*");
  assert.equal(readinessDecision.missingScopes.includes("secret"), true);
  assert.equal(hasSecretOrEnvValue({ dashboardDecision, readinessDecision }), false);
});

test("Tenant Scope Enforcement v1 API and dashboard surfaces expose partial metadata only", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/tenant-enforcement/summary");
    const modes = await getJson(port, "/readiness/tenant-enforcement/modes");
    const mismatches = await getJson(port, "/readiness/tenant-enforcement/mismatches");
    const dashboardScopes = await getJson(port, "/dashboard/scopes");
    const dashboardEnforcement = await getJson(port, "/dashboard/tenant-enforcement");
    const vaultReadiness = await getJson(port, "/readiness/secrets/vault/summary");
    const stagingExecution = await getJson(port, "/readiness/staging-execution/summary");
    const health = await getJson(port, "/health");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).status, "v1_implemented_partial");
    assert.equal((summary.body.noSecretStatus as Record<string, unknown>).productionTenantEnforcement, false);
    assert.equal(modes.statusCode, 200);
    assert.equal(Array.isArray(modes.body.modes), true);
    assert.equal(mismatches.statusCode, 200);
    assert.equal(Array.isArray(mismatches.body.mismatches), true);
    assert.equal(dashboardScopes.statusCode, 200);
    assert.equal(((dashboardScopes.body.scopes as Record<string, unknown>).enforcement as Record<string, unknown>).tenantScopeEnforcementImplemented, "partial");
    assert.equal(((dashboardScopes.body.scopes as Record<string, unknown>).enforcement as Record<string, unknown>).tenantFilteringImplemented, false);
    assert.equal(dashboardEnforcement.statusCode, 200);
    assert.equal(((dashboardEnforcement.body.tenantScopeEnforcement as Record<string, unknown>).summary as Record<string, unknown>).productionTenantEnforcement, false);
    assert.equal(vaultReadiness.statusCode, 200);
    assert.equal((vaultReadiness.body.scopeMetadata as Record<string, unknown>).tenantScopeEnforcementImplemented, "partial");
    assert.equal(typeof vaultReadiness.body.scopeDecisionSummary, "object");
    assert.equal(stagingExecution.statusCode, 200);
    assert.equal((stagingExecution.body.scopeMetadata as Record<string, unknown>).productionEnforcementImplemented, false);
    assert.equal((health.body.tenantScopeEnforcement as Record<string, unknown>).tenantFilteringImplemented, false);
    assert.equal(hasSecretOrEnvValue({ summary, modes, mismatches, dashboardScopes, dashboardEnforcement, vaultReadiness, stagingExecution, health }), false);
  });
});

test("Tenant Scope Enforcement v1 dashboard render shows enforcement, audit, and secret-adjacent warnings", async () => {
  const models = await new DemoDashboardDataProvider().getReadModels();
  const html = renderDashboardReadModels(models);
  const scopeDecision = models.git.scopeMetadata?.scopeDecisionSummary as Record<string, unknown> | undefined;

  assert.equal(models.tenantScopeEnforcement.summary.status, "v1_implemented_partial");
  assert.equal(models.tenantScopeEnforcement.summary.tenantFilteringImplemented, false);
  assert.equal(models.tenantScopeEnforcement.summary.productionTenantEnforcement, false);
  assert.equal(scopeDecision?.productionTenantEnforcement, false);
  assert.equal(html.includes("Tenant scope enforcement"), true);
  assert.equal(html.includes("representative only true"), true);
  assert.equal(html.includes("audit-query scope warnings visible"), true);
  assert.equal(html.includes("secret-adjacent warnings visible"), true);
  assert.equal(html.includes("tenant filtering implemented: false"), true);
  assert.equal(html.includes("production tenant enforcement: false"), true);
  assert.equal(html.includes("No-secret/no-env status"), true);
  assert.equal(hasSecretOrEnvValue({ models, html }), false);
});

test("Tenant Scope Enforcement v1 documentation records partial enforcement and production gaps", async () => {
  const files = await Promise.all([
    readFile("docs/foundations/auth-rbac/tenant-scope-enforcement-v1-plan.md", "utf8"),
    readFile("docs/foundations/auth-rbac/tenant-scope-enforcement-v1.md", "utf8"),
    readFile("docs/reference/tenant-scope-enforcement-inventory.md", "utf8"),
    readFile("docs/roadmaps/dashboard-readiness-tenant-scope/implementation-v1.md", "utf8"),
    readFile("docs/features/policy-as-code/v0.md", "utf8")
  ]);
  const combined = files.join("\n");

  assert.equal(combined.includes("Tenant Scope Enforcement: v1_implemented_partial"), true);
  assert.equal(combined.includes("TenantScopeEnforcementDecision"), true);
  assert.equal(combined.includes("TenantScopeEnforcementService"), true);
  assert.equal(combined.includes("policy deny remains authoritative"), true);
  assert.equal(combined.includes("production tenant enforcement remains false"), true);
  assert.equal(combined.includes("row-level security is not implemented"), true);
});

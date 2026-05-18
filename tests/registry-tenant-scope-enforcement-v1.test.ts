import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import type { InstructionArtifact, SkillPackage, Task } from "@aichestra/core";
import { seedHarnesses, seedInstructions, seedSkills } from "@aichestra/core";
import { createSeededStore } from "@aichestra/db";
import {
  InMemoryRegistryRepository,
  createRegistryService,
  createRegistryTenantScopeEnforcementService,
  registryResourceInputFromSkill
} from "@aichestra/registry";
import type { RegistryScopeEvaluationInput } from "@aichestra/registry";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardReadModels } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-18T00:00:00.000Z");

function hasSecretOrEnvValue(value: unknown): boolean {
  return /OPENAI_API_KEY=[^"\s]+|ANTHROPIC_API_KEY=[^"\s]+|GITHUB_TOKEN=[^"\s]+|VAULT_TOKEN=[^"\s]+|AICHESTRA_DATABASE_URL=[^"\s]+|DATABASE_URL=[^"\s]+|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_]{30,}|hvs\.[A-Za-z0-9_-]{20,}/i.test(JSON.stringify(value));
}

function registryPackageScope(kind: string, id: string, tenantId: string) {
  return {
    scopeKind: "registry_package" as const,
    scopeId: `${kind}:${id}`,
    metadata: { tenantId }
  };
}

function createScopedService() {
  return createRegistryTenantScopeEnforcementService({ now: () => fixedNow });
}

function createRegistryHarness(input: { instructions?: InstructionArtifact[] } = {}) {
  const repository = new InMemoryRegistryRepository({
    skills: seedSkills,
    harnesses: seedHarnesses,
    instructions: input.instructions ?? seedInstructions
  });
  const scopeService = createScopedService();
  const service = createRegistryService({
    skillRepository: repository,
    harnessRepository: repository,
    instructionRepository: repository,
    auditRepository: repository,
    historyRepository: repository,
    evalResultRepository: repository,
    packageRepository: repository,
    scopeEnforcementService: scopeService
  });
  return { service, scopeService };
}

function taskFixture(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_registry_scope_v1",
    title: "Registry scope resolver fixture",
    status: "draft",
    requesterUserId: "user_demo_admin",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: ["jest-test-fixer@1.0.0"],
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides
  };
}

function cloneSkillForPending(base: SkillPackage): SkillPackage {
  return {
    ...base,
    id: "skill_registry_scope_pending_v1",
    name: "registry-scope-pending-v1",
    version: "1.0.0",
    status: "active",
    approvalStatus: "pending",
    evalStatus: "passed",
    createdAt: fixedNow,
    updatedAt: fixedNow
  };
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
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("registry resource in-scope decision uses tenant and registry package scope", () => {
  const service = createScopedService();
  const input: RegistryScopeEvaluationInput = {
    registryResourceKind: "skill",
    resourceId: "skill_jest_test_fixer",
    packageKind: "skill",
    tenantId: "tenant_a"
  };
  const decision = service.evaluateRegistryResource(input, {
    actorId: "user_registry_scope_match",
    tenantId: "tenant_a",
    resourceScopes: [registryPackageScope("skill", "skill_jest_test_fixer", "tenant_a")]
  });

  assert.equal(decision.decision, "in_scope");
  assert.equal(decision.enforcementMode, "warning");
  assert.equal(service.summarizeDecisions([decision]).productionEnforcement, false);
  assert.equal(hasSecretOrEnvValue(decision), false);
});

test("registry scope warnings cover missing and out-of-scope metadata", () => {
  const service = createScopedService();
  const missing = service.evaluateRegistryResource({
    registryResourceKind: "skill",
    resourceId: "skill_missing_scope",
    packageKind: "skill",
    tenantId: "tenant_a"
  });
  const mismatch = service.evaluateRegistryResource({
    registryResourceKind: "skill",
    resourceId: "skill_out_of_scope",
    packageKind: "skill",
    tenantId: "tenant_a"
  }, {
    actorId: "user_registry_scope_mismatch",
    tenantId: "tenant_b",
    resourceScopes: [registryPackageScope("skill", "skill_out_of_scope", "tenant_b")]
  });

  assert.equal(missing.decision, "missing_scope_warning");
  assert.equal(mismatch.decision, "out_of_scope_warning");
  assert.equal(hasSecretOrEnvValue({ missing, mismatch }), false);
});

test("representative sensitive registry scope case denies out-of-scope access", () => {
  const service = createScopedService();
  const decision = service.evaluateRegistryResource({
    registryResourceKind: "audit",
    resourceId: "registry_audit_sensitive",
    tenantId: "tenant_a",
    sensitive: true
  }, {
    actorId: "user_registry_scope_sensitive",
    tenantId: "tenant_b"
  });

  assert.equal(decision.decision.endsWith("_denied"), true);
  assert.equal(decision.enforcementMode, "deny_sensitive");
  assert.equal((decision.metadata.tenantScopeDecision as Record<string, unknown>).productionTenantEnforcement, false);
});

test("resolver attaches scope metadata while preserving pending approval and checksum gates", () => {
  const { service } = createRegistryHarness();
  const base = service.getSkill("skill_auth_debugging") as SkillPackage;
  service.createSkill(cloneSkillForPending(base));
  const pendingResolution = service.resolveRegistryContextForTask({
    task: taskFixture({ selectedSkillIds: ["registry-scope-pending-v1@1.0.0"] }),
    agent: "codex"
  });

  assert.equal(pendingResolution.errors.some((error) => error.includes("No selectable skill version satisfies registry-scope-pending-v1@1.0.0")), true);
  assert.ok(pendingResolution.scopeSummary);
  assert.ok(Array.isArray(pendingResolution.scopeDecisions));

  const instructions = seedInstructions.map((instruction) => instruction.id === "instr_repo_agents_md"
    ? { ...instruction, checksumStatus: "mismatch" as const }
    : instruction);
  const { service: checksumService } = createRegistryHarness({ instructions });
  const checksumResolution = checksumService.resolveRegistryContextForTask({
    task: taskFixture(),
    agent: "codex"
  });

  assert.equal(checksumResolution.selectedInstructions.some((instruction) => instruction.id === "instr_repo_agents_md"), false);
  assert.ok(checksumResolution.scopeSummary);
  assert.equal(hasSecretOrEnvValue({ pendingResolution, checksumResolution }), false);
});

test("mutation scope check can warn or block without bypassing registry gates", () => {
  const service = createScopedService();
  const warning = service.evaluateMutationScope(registryResourceInputFromSkill(seedSkills[0] as SkillPackage), {
    actorId: "registry_editor_scope_warning",
    roles: ["registry_editor"]
  });
  const blocked = service.evaluateMutationScope({
    registryResourceKind: "skill",
    resourceId: "skill_sensitive_scope_block",
    packageKind: "skill",
    tenantId: "tenant_a",
    sensitive: true
  }, {
    actorId: "registry_editor_scope_block",
    roles: ["registry_editor"],
    tenantId: "tenant_b"
  });

  assert.equal(warning.decision.endsWith("_warning"), true);
  assert.equal(blocked.decision.endsWith("_denied"), true);
  assert.equal((blocked.metadata as Record<string, unknown>).policyDenyStillWins, true);
});

test("approval queue scope summary is deterministic metadata", () => {
  const { service, scopeService } = createRegistryHarness();
  const base = service.getSkill("skill_auth_debugging") as SkillPackage;
  service.createSkill(cloneSkillForPending(base));
  const queue = service.listApprovalQueue();
  const decisions = queue.map((item) => scopeService.evaluateApprovalQueueItem(item, { actorId: "approval_scope_reader" }));
  const summary = scopeService.summarizeDecisions(decisions);

  assert.equal(queue.some((item) => item.targetId === "skill_registry_scope_pending_v1"), true);
  assert.equal(summary.totalResources >= 1, true);
  assert.equal(summary.productionEnforcement, false);
  assert.equal(hasSecretOrEnvValue({ decisions, summary }), false);
});

test("registry scope API endpoints are safe metadata/readiness only", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/registry/scope/summary");
    const decision = await postJson(port, "/registry/scope/evaluate", {
      registryResourceKind: "skill",
      resourceId: "skill_api_scope_v1",
      tenantId: "tenant_a"
    });
    const decisions = await getJson(port, "/registry/scope/decisions");
    const readiness = await getJson(port, "/readiness/registry/scope/summary");

    assert.equal(summary.statusCode, 200);
    assert.equal(decision.statusCode, 201);
    assert.equal(decisions.statusCode, 200);
    assert.equal(readiness.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).productionEnforcement, false);
    assert.equal(decision.body.productionEnforcement, false);
    assert.equal((readiness.body as Record<string, unknown>).productionEnforcement, false);
    assert.equal(hasSecretOrEnvValue({ summary, decision, decisions, readiness }), false);
  });
});

test("registry dashboard renders tenant scope summary without secrets", async () => {
  const provider = new DemoDashboardDataProvider();
  const html = renderDashboardReadModels(await provider.getReadModels());

  assert.match(html, /Registry Tenant Scope/);
  assert.match(html, /Resolver scope/);
  assert.equal(hasSecretOrEnvValue(html), false);
});

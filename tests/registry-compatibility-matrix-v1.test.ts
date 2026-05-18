import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  RegistryCompatibilityService,
  type RegistryCompatibilityPolicyDecisionSnapshot,
  type RegistryCompatibilityServiceContext
} from "@aichestra/registry";
import type { HarnessPackage, InstructionArtifact, SkillPackage } from "@aichestra/core";
import { seedHarnesses, seedInstructions, seedSkills } from "@aichestra/core";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";
import { StaticPolicyEngine, PolicyService, createPolicyResource, createPolicySubject } from "@aichestra/policy";

const fixedNow = new Date("2026-05-18T00:00:00.000Z");

function makeRegistry(overrides: { skills?: SkillPackage[]; harnesses?: HarnessPackage[]; instructions?: InstructionArtifact[] } = {}) {
  const skills = overrides.skills ?? seedSkills;
  const harnesses = overrides.harnesses ?? seedHarnesses;
  const instructions = overrides.instructions ?? seedInstructions;
  return {
    listSkills: () => skills.map((entry) => structuredClone(entry)),
    listHarnesses: () => harnesses.map((entry) => structuredClone(entry)),
    listInstructions: () => instructions.map((entry) => structuredClone(entry))
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

function postJson(port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(data)
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
    request.end(data);
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

function hasSecretOrEnvValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /OPENAI_API_KEY=[^"\s]+|ANTHROPIC_API_KEY=[^"\s]+|AICHESTRA_LLM_API_KEY=[^"\s]+|GITHUB_TOKEN=[^"\s]+|VAULT_TOKEN=[^"\s]+|AICHESTRA_DATABASE_URL=[^"\s]+|DATABASE_URL=[^"\s]+|SESSION_SECRET=[^"\s]+|JWT_SECRET=[^"\s]+|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_]{30,}|hvs\.[A-Za-z0-9_-]{20,}/i.test(text);
}

test("buildContext normalizes optional fields and defaults", () => {
  const service = new RegistryCompatibilityService({ now: () => fixedNow });
  const context = service.buildContext({
    taskKind: "Test_Fix",
    repoLanguages: ["TypeScript"],
    frameworks: ["Jest"],
    modelCapabilities: ["Code"],
    runnerKind: "MOCK",
    mcpToolIds: ["safe.read"],
    highRiskMcpToolIds: ["unsafe.exec"]
  });
  assert.equal(context.taskKind, "test_fix");
  assert.deepEqual(context.repoLanguages, ["typescript"]);
  assert.deepEqual(context.frameworks, ["jest"]);
  assert.deepEqual(context.modelCapabilities, ["code"]);
  assert.equal(context.runnerKind, "mock");
  assert.deepEqual(context.mcpToolIds, ["safe.read"]);
  assert.deepEqual(context.highRiskMcpToolIds, ["unsafe.exec"]);
});

test("evaluateSkill marks jest-test-fixer compatible for test_fix code task", () => {
  const service = new RegistryCompatibilityService({ registry: makeRegistry(), now: () => fixedNow });
  const context = service.buildContext({
    taskKind: "test_fix",
    repoLanguages: ["typescript"],
    frameworks: ["jest"],
    modelCapabilities: ["code"],
    runnerKind: "mock",
    repoId: "repo_demo"
  });
  const decision = service.evaluateSkill("skill_jest_test_fixer", context);
  assert.equal(decision.decision, "compatible");
  assert.equal(decision.blockers.length, 0);
  assert.equal(decision.warnings.length, 0);
});

test("evaluateSkill flags missing required model capability as incompatible", () => {
  const service = new RegistryCompatibilityService({ registry: makeRegistry(), now: () => fixedNow });
  const context = service.buildContext({
    taskKind: "test_fix",
    repoLanguages: ["typescript"],
    frameworks: ["jest"],
    modelCapabilities: ["chat"],
    runnerKind: "mock",
    repoId: "repo_demo"
  });
  const decision = service.evaluateSkill("skill_jest_test_fixer", context);
  assert.equal(decision.decision, "incompatible");
  assert.equal(decision.blockers.includes("model_capability_missing_code"), true);
});

test("evaluateSkill returns blocked_by_registry_gate when approval is pending", () => {
  const customSkills: SkillPackage[] = seedSkills.map((skill) => skill.id === "skill_auth_debugging"
    ? { ...skill, approvalStatus: "pending" }
    : skill);
  const service = new RegistryCompatibilityService({ registry: makeRegistry({ skills: customSkills }), now: () => fixedNow });
  const context = service.buildContext({
    taskKind: "auth_debug",
    repoLanguages: ["typescript"],
    frameworks: ["express"],
    modelCapabilities: ["code"],
    runnerKind: "mock",
    repoId: "repo_demo"
  });
  const decision = service.evaluateSkill("skill_auth_debugging", context);
  assert.equal(decision.decision, "blocked_by_registry_gate");
  assert.equal(decision.blockers.includes("skill_approval_pending"), true);
  assert.equal(decision.requiredActions.includes("request_approval"), true);
});

test("evaluateHarness blocks remote-git-required harness when remote Git is disabled", () => {
  const service = new RegistryCompatibilityService({
    registry: makeRegistry(),
    harnessProfiles: [
      {
        harnessId: "harness_backend_node20",
        supportedRunnerKinds: ["mock", "local"],
        supportedLanguages: ["typescript", "javascript"],
        supportedFrameworks: ["express"],
        requiredCommands: ["pnpm lint", "pnpm test"],
        forbiddenCommands: [],
        networkRequired: false,
        fileWriteRequired: true,
        remoteGitRequired: true,
        secretsRequired: false,
        requiredPolicies: ["runner.execute"],
        compatibilityStatus: "active_mock",
        metadata: {}
      }
    ],
    now: () => fixedNow
  });
  const context = service.buildContext({
    runnerKind: "mock",
    repoLanguages: ["typescript"],
    frameworks: ["express"],
    remoteGitEnabled: false
  });
  const decision = service.evaluateHarness("harness_backend_node20", context);
  assert.equal(decision.decision, "incompatible");
  assert.equal(decision.blockers.includes("remote_git_required_but_disabled"), true);
});

test("evaluateInstruction blocks provider kind mismatch", () => {
  const service = new RegistryCompatibilityService({ registry: makeRegistry(), now: () => fixedNow });
  const context = service.buildContext({
    taskKind: "test_fix",
    providerKind: "openai_compatible",
    runnerKind: "mock"
  });
  const decision = service.evaluateInstruction("instr_conflict_manager_guidance", context);
  assert.equal(decision.decision, "incompatible");
  assert.equal(decision.blockers.some((blocker) => blocker.startsWith("provider_kind_unsupported_")), true);
});

test("required high-risk MCP tools produce incompatibility", () => {
  const service = new RegistryCompatibilityService({
    registry: makeRegistry(),
    skillProfiles: [
      {
        skillId: "skill_jest_test_fixer",
        supportedTaskKinds: ["test_fix"],
        supportedLanguages: ["typescript"],
        supportedFrameworks: ["jest"],
        supportedRepoKinds: ["node"],
        requiredModelCapabilities: ["code"],
        forbiddenModelCapabilities: [],
        requiredMcpTools: ["dangerous.exec"],
        forbiddenMcpTools: [],
        requiredScopes: ["repo"],
        compatibilityStatus: "active_mock",
        metadata: {}
      }
    ],
    now: () => fixedNow
  });
  const context = service.buildContext({
    taskKind: "test_fix",
    repoLanguages: ["typescript"],
    frameworks: ["jest"],
    modelCapabilities: ["code"],
    runnerKind: "mock",
    mcpToolIds: ["dangerous.exec"],
    highRiskMcpToolIds: ["dangerous.exec"]
  });
  const decision = service.evaluateSkill("skill_jest_test_fixer", context);
  assert.equal(decision.decision, "incompatible");
  assert.equal(decision.blockers.includes("mcp_tool_high_risk_required"), true);
});

test("scope mismatch is a warning when no production tenant enforcement", () => {
  const service = new RegistryCompatibilityService({ registry: makeRegistry(), now: () => fixedNow });
  const context = service.buildContext({
    taskKind: "test_fix",
    repoLanguages: ["typescript"],
    frameworks: ["jest"],
    modelCapabilities: ["code"],
    runnerKind: "mock"
  });
  const decision = service.evaluateSkill("skill_jest_test_fixer", context);
  assert.equal(decision.decision === "compatible_with_warnings" || decision.decision === "compatible", true);
  if (decision.decision === "compatible_with_warnings") {
    assert.equal(decision.warnings.includes("repo_scope_missing"), true);
  }
});

test("policy deny short-circuits compatibility evaluation to blocked_by_policy", () => {
  const denyEvaluator = (): RegistryCompatibilityPolicyDecisionSnapshot => ({
    decision: "deny",
    matchedRuleIds: ["policy_deny_test"],
    reason: "policy_deny_test"
  });
  const service = new RegistryCompatibilityService({ registry: makeRegistry(), now: () => fixedNow, policyEvaluator: denyEvaluator });
  const context = service.buildContext({ taskKind: "test_fix", repoLanguages: ["typescript"], modelCapabilities: ["code"], runnerKind: "mock" });
  const serviceContext: RegistryCompatibilityServiceContext = { actorId: "tester" };
  const decision = service.evaluateSkill("skill_jest_test_fixer", context, serviceContext);
  assert.equal(decision.decision, "blocked_by_policy");
  assert.equal(decision.blockers.includes("policy_deny_test"), true);
});

test("evaluateCandidates summarizes deterministically", () => {
  const service = new RegistryCompatibilityService({ registry: makeRegistry(), now: () => fixedNow });
  const context = service.buildContext({
    taskKind: "test_fix",
    repoLanguages: ["typescript"],
    frameworks: ["jest"],
    modelCapabilities: ["code"],
    runnerKind: "mock",
    repoId: "repo_demo"
  });
  const decisions = service.evaluateCandidates(context);
  assert.equal(decisions.length > 0, true);
  const summary = service.summarizeDecisions(decisions);
  assert.equal(summary.totalCandidates, decisions.length);
  assert.equal(summary.resolverGatesPreserved, true);
  assert.equal(summary.autoApplyEnabled, false);
  assert.equal(summary.registryMutationsExecuted, false);
});

test("policy denies registry.compatibility.matrix.update_future and override_future by default", () => {
  const policyService = new PolicyService({ engine: new StaticPolicyEngine() });
  const subject = createPolicySubject({ actorId: "mock-actor", roles: ["platform_admin"] });
  const resource = createPolicyResource({ resourceKind: "registry_compatibility", resourceId: "compat" });
  for (const action of ["registry.compatibility.matrix.update_future", "registry.compatibility.override_future"] as const) {
    const decision = policyService.evaluate({ subject, resource, action, context: { environment: {}, metadata: {} } });
    assert.equal(decision.decision, "deny");
  }
});

test("policy allows registry.compatibility.read and evaluate under mock context", () => {
  const policyService = new PolicyService({ engine: new StaticPolicyEngine() });
  const subject = createPolicySubject({ actorId: "mock-actor", roles: ["platform_admin"] });
  const resource = createPolicyResource({ resourceKind: "registry_compatibility", resourceId: "compat" });
  const environment = {
    metadataOnly: true,
    registryMutationExecuted: false,
    autoApplyEnabled: false,
    resolverGatesPreserved: true,
    externalCallExecuted: false
  };
  for (const action of ["registry.compatibility.read", "registry.compatibility.evaluate"] as const) {
    const decision = policyService.evaluate({ subject, resource, action, context: { environment, metadata: {} } });
    assert.equal(decision.decision, "allow", `${action} must be allowed under mock metadata-only context`);
  }
});

test("compatibility API endpoints are safe and never mutate registry", async () => {
  await withApiServer(async (port) => {
    const rules = await getJson(port, "/registry/compatibility/rules");
    const summary = await getJson(port, "/registry/compatibility/summary");
    const candidates = await getJson(port, "/registry/compatibility/candidates?taskKind=test_fix&runnerKind=mock&modelCapabilities=code");
    const evaluate = await postJson(port, "/registry/compatibility/evaluate", {
      candidateKind: "skill",
      candidateId: "skill_jest_test_fixer",
      context: {
        taskKind: "test_fix",
        repoLanguages: ["typescript"],
        frameworks: ["jest"],
        modelCapabilities: ["code"],
        runnerKind: "mock",
        repoId: "repo_demo"
      }
    });
    const evaluateMany = await postJson(port, "/registry/compatibility/evaluate-many", {
      context: {
        taskKind: "test_fix",
        repoLanguages: ["typescript"],
        frameworks: ["jest"],
        modelCapabilities: ["code"],
        runnerKind: "mock",
        repoId: "repo_demo"
      }
    });
    const readinessSummary = await getJson(port, "/readiness/registry/compatibility/summary");
    const health = await getJson(port, "/health");

    assert.equal(rules.statusCode, 200);
    assert.equal(Array.isArray(rules.body.rules), true);
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).resolverGatesPreserved, true);
    assert.equal((summary.body.summary as Record<string, unknown>).autoApplyEnabled, false);
    assert.equal(candidates.statusCode, 200);
    assert.equal(Array.isArray(candidates.body.decisions), true);
    assert.equal(evaluate.statusCode, 201);
    assert.equal(typeof (evaluate.body.decision as Record<string, unknown>).decision, "string");
    assert.equal(evaluateMany.statusCode, 201);
    assert.equal(Array.isArray(evaluateMany.body.decisions), true);
    assert.equal(readinessSummary.statusCode, 200);
    assert.equal((readinessSummary.body.summary as Record<string, unknown>).resolverGatesPreserved, true);
    assert.equal((health.body.registryCompatibility as Record<string, unknown>).autoApplyEnabled, false);
    assert.equal((health.body.registryCompatibility as Record<string, unknown>).registryMutationsExecuted, false);
    assert.equal((health.body.registryCompatibility as Record<string, unknown>).resolverGatesPreserved, true);
    assert.equal(hasSecretOrEnvValue({ rules, summary, candidates, evaluate, evaluateMany, readinessSummary, health }), false);
  });
});

test("compatibility dashboard panel renders advisory metadata without secrets", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/registry-compatibility");
    const panel = dashboard.body.registryCompatibility as Record<string, unknown>;
    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).resolverGatesPreserved, true);
    assert.equal((panel.resolverGateRelationship as Record<string, unknown>).compatibilityCanBypassResolver, false);
    assert.equal((panel.noAutoApplyStatus as Record<string, unknown>).autoApplyEnabled, false);
    assert.equal((panel.noAutoApplyStatus as Record<string, unknown>).registryMutationsExecuted, false);
    assert.equal(hasSecretOrEnvValue(dashboard), false);
  });
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Skill / Harness Compatibility Matrix"), true);
  assert.equal(html.includes("preserved true"), true);
  assert.equal(html.includes("auto-apply disabled"), true);
});

test("regression: registry resolver still excludes pending approval entries when compatibility is consulted separately", () => {
  // The compatibility service is advisory only; the resolver's selectableRegistryEntry should still be enforced.
  const customSkills: SkillPackage[] = seedSkills.map((skill) => skill.id === "skill_auth_debugging"
    ? { ...skill, approvalStatus: "pending" }
    : skill);
  const service = new RegistryCompatibilityService({ registry: makeRegistry({ skills: customSkills }), now: () => fixedNow });
  const context = service.buildContext({
    taskKind: "auth_debug",
    repoLanguages: ["typescript"],
    modelCapabilities: ["code"],
    runnerKind: "mock"
  });
  const decisions = service.evaluateCandidates(context);
  const authDebug = decisions.find((decision) => decision.candidateId === "skill_auth_debugging");
  assert.ok(authDebug, "auth-debugging decision must be present");
  assert.equal(authDebug!.decision, "blocked_by_registry_gate");
  assert.equal(authDebug!.metadata.gatePreserved, true);
});

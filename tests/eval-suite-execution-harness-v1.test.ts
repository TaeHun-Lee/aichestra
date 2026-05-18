import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import type { FailureSignalTargetKind, HarnessPackage, InstructionArtifact, SkillPackage } from "@aichestra/core";
import { seedHarnesses, seedInstructions, seedSkills } from "@aichestra/core";
import { createSeededStore } from "@aichestra/db";
import { InMemoryImprovementRepository, createImprovementServices } from "@aichestra/improvement";
import type { ImprovementServices } from "@aichestra/improvement";
import {
  InMemoryRegistryRepository,
  createEvalSuiteExecutionService,
  createRegistryService,
  registryEvalTargetFromRegistryPackage
} from "@aichestra/registry";
import type {
  EvalSuiteExecutionService,
  RegistryEvalPolicyDecisionSnapshot,
  RegistryEvalPolicyEvaluationInput,
  RegistryEvalTargetKind,
  RegistryEvalTargetSnapshot,
  RegistryService
} from "@aichestra/registry";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardReadModels } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-18T00:00:00.000Z");

function hasSecretOrEnvValue(value: unknown): boolean {
  return /OPENAI_API_KEY=[^"\s]+|ANTHROPIC_API_KEY=[^"\s]+|AICHESTRA_LLM_API_KEY=[^"\s]+|GITHUB_TOKEN=[^"\s]+|VAULT_TOKEN=[^"\s]+|AICHESTRA_DATABASE_URL=[^"\s]+|DATABASE_URL=[^"\s]+|SESSION_SECRET=[^"\s]+|JWT_SECRET=[^"\s]+|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_]{30,}|hvs\.[A-Za-z0-9_-]{20,}/i.test(JSON.stringify(value));
}

function cloneFailedSkill(base: SkillPackage): SkillPackage {
  return {
    ...base,
    id: "skill_eval_harness_failed_v1",
    name: "eval-harness-failed-v1",
    version: "1.0.0",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "failed",
    createdAt: fixedNow,
    updatedAt: fixedNow
  };
}

function targetFromRegistry(
  registryService: RegistryService,
  improvementServices: ImprovementServices,
  targetKind: RegistryEvalTargetKind,
  targetId: string
): RegistryEvalTargetSnapshot | undefined {
  if (targetKind === "skill") {
    const target = registryService.getSkill(targetId);
    return target ? {
      targetKind,
      targetId: target.id,
      targetName: target.name,
      targetVersion: target.version,
      status: target.status,
      approvalStatus: target.approvalStatus,
      evalStatus: target.evalStatus,
      metadata: {
        owner: target.owner,
        compatibleAgents: target.compatibleAgents,
        requiredHarnesses: target.requiredHarnesses,
        dependencyCount: target.dependencies?.length ?? 0
      }
    } : undefined;
  }
  if (targetKind === "harness") {
    const target = registryService.getHarness(targetId);
    return target ? {
      targetKind,
      targetId: target.id,
      targetName: target.name,
      targetVersion: target.version,
      status: target.status,
      approvalStatus: target.approvalStatus,
      evalStatus: target.evalStatus,
      metadata: {
        owner: target.owner,
        runtimeType: target.runtimeType,
        dependencyCount: target.dependencies?.length ?? 0
      }
    } : undefined;
  }
  if (targetKind === "instruction") {
    const target = registryService.getInstruction(targetId);
    return target ? {
      targetKind,
      targetId: target.id,
      targetName: target.name,
      targetVersion: target.version,
      status: target.status,
      approvalStatus: target.approvalStatus,
      evalStatus: target.evalStatus,
      checksumStatus: target.checksumStatus,
      metadata: {
        checksumAlgorithm: target.checksumAlgorithm,
        dependencyCount: target.dependencies?.length ?? 0
      }
    } : undefined;
  }
  if (targetKind === "registry_package") {
    const manifest = registryService.getPackageManifest(targetId);
    return manifest ? registryEvalTargetFromRegistryPackage(manifest) : undefined;
  }
  if (targetKind === "draft_registry_change") {
    const draftChange = improvementServices.draftRegistryChanges.getDraftChange(targetId);
    return draftChange ? {
      targetKind,
      targetId: draftChange.id,
      targetName: draftChange.targetName,
      targetVersion: draftChange.targetVersion,
      status: draftChange.status,
      draftRegistryChange: draftChange,
      metadata: {
        proposalId: draftChange.proposalId,
        draftOnly: true,
        activeRegistryMutation: false
      }
    } : undefined;
  }
  return undefined;
}

function createHarness(input: {
  skills?: SkillPackage[];
  harnesses?: HarnessPackage[];
  instructions?: InstructionArtifact[];
  policyEvaluator?: (input: RegistryEvalPolicyEvaluationInput) => RegistryEvalPolicyDecisionSnapshot;
} = {}): {
  registryService: RegistryService;
  improvementServices: ImprovementServices;
  service: EvalSuiteExecutionService;
} {
  const repository = new InMemoryRegistryRepository({
    skills: input.skills ?? seedSkills,
    harnesses: input.harnesses ?? seedHarnesses,
    instructions: input.instructions ?? seedInstructions
  });
  const registryService = createRegistryService({
    skillRepository: repository,
    harnessRepository: repository,
    instructionRepository: repository,
    auditRepository: repository,
    historyRepository: repository,
    evalResultRepository: repository,
    packageRepository: repository
  });
  const improvementServices = createImprovementServices(new InMemoryImprovementRepository());
  const service = createEvalSuiteExecutionService({
    now: () => fixedNow,
    policyEvaluator: input.policyEvaluator,
    dataSource: {
      getTarget: (targetKind, targetId) => targetFromRegistry(registryService, improvementServices, targetKind, targetId),
      attachRegistryEvalResult: (attachInput) => registryService.attachEvalResult(attachInput.targetKind, attachInput.targetId, {
        evalName: attachInput.evalName,
        evalType: "mock",
        status: attachInput.status,
        score: attachInput.score,
        maxScore: attachInput.maxScore,
        summary: attachInput.summary,
        details: attachInput.details,
        source: "mock",
        artifactRef: attachInput.artifactRef,
        updateEvalStatus: attachInput.updateEvalStatus,
        actorId: attachInput.context?.actorId,
        requestContext: attachInput.context?.requestContext,
        authContext: attachInput.context?.authContext,
        metadata: {
          ...(attachInput.metadata ?? {}),
          testFixture: true,
          externalCallExecuted: false,
          canaryExecuted: false,
          autoApplyEnabled: false
        }
      }),
      attachProposalEvalRun: (attachInput) => improvementServices.proposalEvalRuns.attachEvalRun({
        proposalId: attachInput.proposalId,
        evalRequirementId: attachInput.evalRequirementId,
        status: attachInput.status,
        summary: attachInput.summary,
        score: attachInput.score,
        maxScore: attachInput.maxScore,
        requestContext: attachInput.context?.requestContext,
        authContext: attachInput.context?.authContext,
        metadata: {
          ...(attachInput.metadata ?? {}),
          testFixture: true,
          externalCallExecuted: false,
          canaryExecuted: false,
          autoApplyEnabled: false
        }
      })
    }
  });
  return { registryService, improvementServices, service };
}

function createProposal(
  services: ImprovementServices,
  category = "eval_suite_execution_fixture",
  targetKind: FailureSignalTargetKind = "skill",
  targetRef = "jest-test-fixer@1.0.0"
) {
  services.signals.createSignal({
    sourceType: "manual",
    sourceId: `${category}_${targetRef}`,
    targetKind,
    targetRef,
    severity: "high",
    category,
    summary: `${category} observed for ${targetRef}.`
  });
  const cluster = services.clustering.recomputeClusters().find((entry) => entry.category === category && entry.targetRef === targetRef);
  assert.ok(cluster);
  const candidate = services.autoImprovement.generateImprovementCandidate(cluster.id);
  const proposal = services.autoImprovement.generateImprovementProposal(candidate.id);
  const draftChange = services.autoImprovement.prepareDraftRegistryChange(proposal.id);
  return { cluster, candidate, proposal, draftChange };
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

test("eval suite catalog lists deterministic mock suites and cases", () => {
  const { service } = createHarness();
  const suites = service.listSuites();
  const cases = service.listCases("skill-required-metadata-suite");

  assert.equal(suites.some((suite) => suite.id === "skill-required-metadata-suite"), true);
  assert.equal(suites.some((suite) => suite.id === "provider-live-future-suite" && suite.status === "future"), true);
  assert.equal(cases.some((evalCase) => evalCase.caseKind === "required_field"), true);
  assert.equal(service.getEvalSummary().executionMode, "mock_deterministic_only");
});

test("request and execute mock eval run produces passing verdict and attachable metadata", () => {
  const { registryService, service } = createHarness();
  const before = registryService.getSkill("skill_jest_test_fixer");
  assert.ok(before);

  const run = service.requestEvalRun({
    suiteId: "skill-required-metadata-suite",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer"
  }, { actorId: "user_eval_harness", requestId: "req_eval_pass" });
  const completed = service.executeMockEvalRun(run.id, { actorId: "user_eval_harness", requestId: "req_eval_pass_execute" });
  const verdict = service.getEvalVerdict(run.id);
  const attachment = service.attachEvalResultToRegistryTarget({ runId: run.id }, { actorId: "user_eval_harness", requestId: "req_eval_pass_attach" });
  const after = registryService.getSkill("skill_jest_test_fixer");

  assert.equal(run.status, "requested");
  assert.equal(completed.status, "passed");
  assert.equal(verdict?.overallVerdict, "passed");
  assert.equal(service.listCaseResults(run.id).length >= 2, true);
  assert.equal(attachment.registryEvalResult?.status, "passed");
  assert.equal(after?.evalStatus, before.evalStatus);
  assert.equal(hasSecretOrEnvValue({ run, completed, verdict, attachment }), false);
});

test("failing, warning, future, policy denied, and missing-target runs are deterministic", () => {
  const base = seedSkills.find((skill) => skill.id === "skill_jest_test_fixer");
  assert.ok(base);
  const failedSkill = cloneFailedSkill(base);
  const { service } = createHarness({ skills: [...seedSkills, failedSkill] });
  const failedRun = service.requestEvalRun({
    suiteId: "skill-required-metadata-suite",
    targetKind: "skill",
    targetId: failedSkill.id
  });
  const failedCompleted = service.executeMockEvalRun(failedRun.id);
  const warningRun = service.requestEvalRun({
    suiteId: "drift-followup-suite",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer"
  });
  const warningCompleted = service.executeMockEvalRun(warningRun.id);
  const futureRun = service.requestEvalRun({
    suiteId: "provider-live-future-suite",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer"
  });
  const denied = createHarness({
    policyEvaluator: () => ({ decision: "deny", matchedRuleIds: ["policy_eval_suite_test_deny"], reason: "test_policy_deny" })
  }).service.requestEvalRun({
    suiteId: "skill-required-metadata-suite",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer"
  });
  const missing = service.requestEvalRun({
    suiteId: "skill-required-metadata-suite",
    targetKind: "skill",
    targetId: "skill_missing_eval_target"
  });

  assert.equal(failedCompleted.status, "failed");
  assert.equal(service.getEvalVerdict(failedRun.id)?.overallVerdict, "failed");
  assert.equal(warningCompleted.status, "warning");
  assert.equal(service.getEvalVerdict(warningRun.id)?.overallVerdict, "warning");
  assert.equal(futureRun.status, "future_external");
  assert.equal(service.getEvalVerdict(futureRun.id)?.overallVerdict, "skipped");
  assert.equal(denied.status, "blocked_policy");
  assert.equal(missing.status, "blocked_missing_target");
});

test("eval result attachment feeds proposal readiness while canary and apply stay blocked", () => {
  const base = seedSkills.find((skill) => skill.id === "skill_jest_test_fixer");
  assert.ok(base);
  const failedSkill = cloneFailedSkill(base);
  const { improvementServices, service } = createHarness({ skills: [...seedSkills, failedSkill] });
  const { proposal } = createProposal(improvementServices, "eval_suite_failed_fixture", "skill", "eval-harness-failed-v1@1.0.0");
  const requirement = improvementServices.evalRequirements.createRequirement({
    targetKind: proposal.targetKind,
    targetId: proposal.targetId,
    requirementName: "Eval Suite Execution Harness v1",
    requirementType: "mock_eval",
    requiredStatus: "passed",
    description: "Deterministic mock eval must pass before apply/canary readiness.",
    blocking: true
  });
  const run = service.requestEvalRun({
    suiteId: "skill-required-metadata-suite",
    targetKind: "skill",
    targetId: failedSkill.id,
    proposalId: proposal.id
  });
  const completed = service.executeMockEvalRun(run.id);
  const attachment = service.attachEvalResultToRegistryTarget({
    runId: run.id,
    attachToProposal: true,
    evalRequirementId: requirement.id
  });
  const readiness = improvementServices.autoImprovement.evaluateProposalReadiness(proposal.id);
  const canary = improvementServices.canaryReadiness.evaluate(proposal.id);
  const gate = improvementServices.applyGate.evaluate(proposal.id);

  assert.equal(completed.status, "failed");
  assert.equal(attachment.proposalEvalRun?.status, "failed");
  assert.equal(readiness.evalStatus, "failed");
  assert.equal(readiness.blockingReasons.includes("eval_pass_required"), true);
  assert.deepEqual(canary.blockingReasons, ["canary_required"]);
  assert.equal(gate.canApply, false);
  assert.equal(gate.blockingReasons.includes("active_apply_not_implemented"), true);
  assert.equal(gate.blockingReasons.includes("auto_apply_disabled"), true);
});

test("passing eval attachment is visible to proposal readiness metadata", () => {
  const { improvementServices, service } = createHarness();
  const { proposal } = createProposal(improvementServices);
  const requirement = improvementServices.evalRequirements.createRequirement({
    targetKind: proposal.targetKind,
    targetId: proposal.targetId,
    requirementName: "Eval Suite Execution Harness v1 pass",
    requirementType: "mock_eval",
    requiredStatus: "passed",
    description: "Deterministic mock eval metadata.",
    blocking: true
  });
  const run = service.requestEvalRun({
    suiteId: "skill-required-metadata-suite",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    proposalId: proposal.id
  });
  service.executeMockEvalRun(run.id);
  const attachment = service.attachEvalResultToRegistryTarget({
    runId: run.id,
    attachToProposal: true,
    evalRequirementId: requirement.id
  });
  const readiness = improvementServices.autoImprovement.evaluateProposalReadiness(proposal.id);

  assert.equal(attachment.proposalEvalRun?.status, "passed");
  assert.equal(readiness.evalStatus, "passed");
  assert.equal(readiness.blockingReasons.includes("eval_pass_required"), false);
  assert.equal(hasSecretOrEnvValue({ attachment, readiness }), false);
});

test("eval suite API endpoints are safe and metadata-only", async () => {
  await withApiServer(async (port) => {
    const suites = await getJson(port, "/registry/eval-suites");
    const cases = await getJson(port, "/registry/eval-suites/skill-required-metadata-suite/cases");
    const requested = await postJson(port, "/registry/eval-runs", {
      suiteId: "skill-required-metadata-suite",
      targetKind: "skill",
      targetId: "skill_jest_test_fixer"
    });
    const runId = ((requested.body.evalRun as Record<string, unknown>).id as string);
    const executed = await postJson(port, `/registry/eval-runs/${runId}/execute-mock`);
    const results = await getJson(port, `/registry/eval-runs/${runId}/results`);
    const verdict = await getJson(port, `/registry/eval-runs/${runId}/verdict`);
    const attached = await postJson(port, `/registry/eval-runs/${runId}/attach`, { updateRegistryEvalStatus: false });
    const readiness = await getJson(port, "/readiness/registry/evals/summary");
    const dashboard = await getJson(port, "/dashboard/registry");

    assert.equal(suites.statusCode, 200);
    assert.equal(Array.isArray(suites.body.suites), true);
    assert.equal(cases.statusCode, 200);
    assert.equal(Array.isArray(cases.body.cases), true);
    assert.equal(requested.statusCode, 201);
    assert.equal(executed.statusCode, 200);
    assert.equal((executed.body.evalRun as Record<string, unknown>).status, "passed");
    assert.equal(Array.isArray(results.body.results), true);
    assert.equal((verdict.body.verdict as Record<string, unknown>).overallVerdict, "passed");
    assert.equal(attached.statusCode, 201);
    assert.equal(attached.body.autoApplyEnabled, false);
    assert.equal(readiness.statusCode, 200);
    assert.equal((readiness.body.summary as Record<string, unknown>).executionMode, "mock_deterministic_only");
    assert.equal(((dashboard.body.registry as Record<string, unknown>).evalSuiteStatus as Record<string, unknown>).externalEvalImplemented, false);
    assert.equal(hasSecretOrEnvValue({ suites, cases, requested, executed, results, verdict, attached, readiness, dashboard }), false);
  });
});

test("dashboard renders eval suite execution panel without exposing external execution", async () => {
  const data = await new DemoDashboardDataProvider().getReadModels();
  const html = renderDashboardReadModels(data);

  assert.match(html, /Eval Suite Execution Harness/);
  assert.match(html, /mock_deterministic_only/);
  assert.match(html, /external eval disabled/);
  assert.match(html, /auto-apply disabled/);
  assert.equal(hasSecretOrEnvValue(html), false);
});

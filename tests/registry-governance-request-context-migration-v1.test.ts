import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  AuthorizationService,
  InMemoryAuthRepository,
  MockAuthProvider,
  RequestContextResolver,
  ServiceAccountContextFactory
} from "@aichestra/auth";
import { createApiServer } from "@aichestra/api";
import type { RegistryActor, SkillPackage } from "@aichestra/core";
import { createSeededStore } from "@aichestra/db";
import {
  InMemoryImprovementRepository,
  createImprovementServices
} from "@aichestra/improvement";
import {
  InMemoryRegistryRepository,
  PolicyBackedRegistryMutationAuthorizer,
  createRegistryService
} from "@aichestra/registry";
import { PolicyService } from "@aichestra/policy";

const adminActor: RegistryActor = { id: "mock-admin", displayName: "Mock Admin", roles: ["registry_admin"] };

function hasSecretMaterial(value: unknown): boolean {
  return /Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]+|ghp_|github_pat_|SESSION_SECRET=|JWT_SECRET=|PASSWORD=|TOKEN=|authorization:\s*Bearer|cookie:\s*session|auth\.json|~\/\.claude/i.test(JSON.stringify(value));
}

function createAuthServices() {
  const policyService = new PolicyService();
  const repository = new InMemoryAuthRepository();
  const authorizationService = new AuthorizationService({
    repository,
    provider: new MockAuthProvider({ repository }),
    policyService
  });
  const resolver = new RequestContextResolver(authorizationService);
  const serviceAccountFactory = new ServiceAccountContextFactory({
    authorizationService,
    idFactory: (prefix) => `${prefix}_registry_governance_test`
  });
  return { policyService, authorizationService, resolver, serviceAccountFactory };
}

function createRegistryHarness(policyService: PolicyService) {
  const repository = new InMemoryRegistryRepository();
  const service = createRegistryService({
    skillRepository: repository,
    harnessRepository: repository,
    instructionRepository: repository,
    auditRepository: repository,
    historyRepository: repository,
    evalResultRepository: repository,
    packageRepository: repository,
    authorizer: new PolicyBackedRegistryMutationAuthorizer({ policyService }),
    defaultActor: adminActor
  });
  return { repository, service };
}

function cloneSkillForTest(base: SkillPackage, id: string, name: string): SkillPackage {
  return {
    ...base,
    id,
    name,
    version: "1.0.1",
    status: "draft",
    approvalStatus: "pending",
    evalStatus: "pending",
    createdAt: new Date("2026-05-15T00:00:00.000Z"),
    updatedAt: new Date("2026-05-15T00:00:00.000Z")
  };
}

function requestJson(
  method: "GET" | "POST" | "PATCH",
  port: number,
  path: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = method === "GET" ? "" : JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        ...(method === "GET" ? {} : {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(serialized)
        }),
        ...headers
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
        });
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

function createGovernanceProposal(services: ReturnType<typeof createImprovementServices>, context: { requestContext?: ReturnType<RequestContextResolver["createTestContext"]> } = {}) {
  services.signals.createSignal({
    sourceType: "manual",
    sourceId: "registry_governance_ctx_v1",
    targetKind: "instruction",
    targetRef: "repo-agents-md@1.0.0",
    severity: "high",
    category: "registry_resolution_warning",
    summary: "Registry/governance RequestContext migration fixture."
  });
  const cluster = services.clustering.recomputeClusters()[0];
  assert.ok(cluster);
  const candidate = services.autoImprovement.generateImprovementCandidate(cluster.id, context);
  const proposal = services.autoImprovement.generateImprovementProposal(candidate.id, context);
  const draftChange = services.autoImprovement.prepareDraftRegistryChange(proposal.id, context);
  return { cluster, candidate, proposal, draftChange };
}

test("registry mutation accepts RequestContext and adds audit/correlation metadata", () => {
  const { policyService, resolver } = createAuthServices();
  const { service } = createRegistryHarness(policyService);
  const requestContext = resolver.createTestContext("mock-admin", {
    requestId: "req_registry_governance_registry_v1",
    correlationId: "corr_registry_governance_registry_v1"
  });
  const base = service.getSkill("skill_auth_debugging") as SkillPackage;
  const created = service.createSkill(cloneSkillForTest(base, "skill_registry_context_v1", "registry-context-v1"), { requestContext });

  service.updateSkillApproval(created.id, {
    approvalStatus: "approved",
    reason: "RequestContext approval fixture.",
    requestContext
  });
  const evalResult = service.attachEvalResult("skill", created.id, {
    evalName: "request context mock eval",
    evalType: "mock",
    status: "passed",
    summary: "Mock eval metadata passed.",
    source: "mock",
    updateEvalStatus: true,
    requestContext
  });
  const logs = service.listAuditLogs({ targetKind: "skill", targetId: created.id, requestContext });

  assert.equal(created.id, "skill_registry_context_v1");
  assert.equal(evalResult.requestId, "req_registry_governance_registry_v1");
  assert.equal(evalResult.correlationId, "corr_registry_governance_registry_v1");
  assert.equal(evalResult.authMode, "mock");
  assert.equal(evalResult.requestSource, "test");
  assert.equal(logs.some((log) =>
    log.action === "create" &&
    log.requestId === "req_registry_governance_registry_v1" &&
    log.correlationId === "corr_registry_governance_registry_v1" &&
    log.principalId === "principal_mock_admin" &&
    log.authMode === "mock" &&
    log.source === "test"
  ), true);
  assert.equal(logs.some((log) => log.action === "approve" && log.policyDecisionId), true);
  assert.equal(hasSecretMaterial({ logs, evalResult }), false);
});

test("registry policy deny still blocks and compatibility actor fallback remains deterministic", () => {
  const { policyService, resolver } = createAuthServices();
  const { service } = createRegistryHarness(policyService);
  const viewerContext = resolver.createTestContext("user_demo_viewer", {
    requestId: "req_registry_viewer_denied_v1",
    correlationId: "corr_registry_viewer_denied_v1"
  });

  assert.throws(() => service.updateSkillStatus("skill_auth_debugging", {
    status: "deprecated",
    requestContext: viewerContext
  }), /missing permission|denied/);

  service.updateSkillStatus("skill_auth_debugging", {
    status: "deprecated",
    actorId: "legacy-mock-admin",
    reason: "legacy compatibility fallback"
  });
  const fallbackLog = service.listAuditLogs({ actorId: "legacy-mock-admin" }).find((log) => log.reason === "legacy compatibility fallback");
  assert.equal(fallbackLog?.actorId, "legacy-mock-admin");
  assert.equal((fallbackLog?.metadata as Record<string, unknown>).compatibilityActorFallback, true);
  assert.equal(hasSecretMaterial(fallbackLog), false);
});

test("registry resolver gates remain unchanged while service account context is attributed", () => {
  const { policyService, serviceAccountFactory } = createAuthServices();
  const { service } = createRegistryHarness(policyService);
  const serviceContext = serviceAccountFactory.createServiceAccountRequestContext("registry_governance_service", "system", {
    requestId: "req_registry_service_account_v1",
    correlationId: "corr_registry_service_account_v1"
  });

  const base = service.getSkill("skill_auth_debugging") as SkillPackage;
  const pending = service.createSkill(cloneSkillForTest(base, "skill_registry_service_account_pending_v1", "registry-sa-pending-v1"), { requestContext: serviceContext });
  const resolution = service.resolveRegistryContextForTask({
    task: {
      id: "task_registry_context_v1",
      title: "Resolve registry context",
      status: "draft",
      requesterUserId: "user_demo_admin",
      repoId: "repo_demo_backend",
      baseBranch: "main",
      selectedSkillIds: ["registry-sa-pending-v1@1.0.1"],
      createdAt: new Date("2026-05-15T00:00:00.000Z"),
      updatedAt: new Date("2026-05-15T00:00:00.000Z")
    },
    agent: "codex",
    requestContext: serviceContext
  });
  const audit = service.listAuditLogs({ targetKind: "skill", targetId: pending.id, requestContext: serviceContext });

  assert.equal(resolution.errors.some((error) => error.includes("No selectable skill version satisfies registry-sa-pending-v1@1.0.1")), true);
  assert.equal(audit.some((log) =>
    log.serviceAccountId === "registry_governance_service" &&
    log.actorKind === "service_account" &&
    log.requestId === "req_registry_service_account_v1"
  ), true);
  assert.equal(hasSecretMaterial({ resolution, audit }), false);
});

test("governance RequestContext migration preserves draft-only apply safety", () => {
  const { policyService, resolver, serviceAccountFactory } = createAuthServices();
  const services = createImprovementServices(new InMemoryImprovementRepository(), { policyService });
  const requestContext = resolver.createTestContext("mock-admin", {
    requestId: "req_registry_governance_governance_v1",
    correlationId: "corr_registry_governance_governance_v1"
  });
  const { proposal, draftChange } = createGovernanceProposal(services, { requestContext });
  const serviceContext = serviceAccountFactory.createServiceAccountRequestContext("improvement_governance_service", "system", {
    requestId: "req_improvement_service_account_v1",
    correlationId: "corr_improvement_service_account_v1"
  });

  const decision = services.governance.recordDecision({
    proposalId: proposal.id,
    requestContext,
    decision: "approve",
    reason: "Approve for metadata-only gate checks."
  });
  const requirement = services.evalRequirements.createRequirement({
    targetKind: proposal.targetKind,
    targetId: proposal.targetId,
    requirementName: "RequestContext eval",
    requirementType: "mock_eval",
    requiredStatus: "passed",
    description: "Metadata-only eval attachment.",
    blocking: true
  });
  const evalRun = services.proposalEvalRuns.attachEvalRun({
    proposalId: proposal.id,
    evalRequirementId: requirement.id,
    status: "passed",
    summary: "Mock eval metadata passed.",
    requestContext
  });
  const canary = services.canaryReadiness.evaluate(proposal.id, { requestContext });
  const gate = services.applyGate.evaluate(proposal.id, { requestContext: serviceContext });
  const blocked = services.applyGate.blockApplyAttempt(proposal.id, { requestContext });
  const audit = services.governance.listAuditEvents(proposal.id);

  assert.equal(draftChange.requestId, "req_registry_governance_governance_v1");
  assert.equal(decision.requestId, "req_registry_governance_governance_v1");
  assert.equal(evalRun.correlationId, "corr_registry_governance_governance_v1");
  assert.equal(canary.requestId, "req_registry_governance_governance_v1");
  assert.equal(gate.serviceAccountId, "improvement_governance_service");
  assert.equal(gate.canApply, false);
  assert.equal(gate.blockingReasons.includes("policy_denied_improvement_apply"), true);
  assert.equal(blocked.canApply, false);
  assert.equal(audit.some((event) => event.action === "proposal_decision_recorded" && event.requestId === "req_registry_governance_governance_v1"), true);
  assert.equal(audit.some((event) => event.action === "proposal_apply_gate_checked" && event.serviceAccountId === "improvement_governance_service"), true);
  assert.equal(hasSecretMaterial({ decision, evalRun, canary, gate, blocked, audit }), false);
});

test("API registry and governance routes propagate RequestContext and keep apply forbidden", async () => {
  await withApiServer(async (port) => {
    const headers = {
      "x-aichestra-request-id": "req_registry_governance_api_v1",
      "x-aichestra-correlation-id": "corr_registry_governance_api_v1",
      "x-aichestra-actor-id": "mock-admin",
      authorization: "Bearer should-not-be-exposed",
      cookie: "session=should-not-be-exposed"
    };

    const status = await requestJson("PATCH", port, "/registry/skills/skill_auth_debugging/status", { status: "deprecated" }, headers);
    const registryAudit = await requestJson("GET", port, "/registry/audit?targetKind=skill&targetId=skill_auth_debugging", {}, headers);

    await requestJson("POST", port, "/improvement/failure-signals", {
      sourceType: "manual",
      sourceId: "api_registry_governance_request_context_v1",
      targetKind: "instruction",
      targetRef: "repo-agents-md@1.0.0",
      severity: "high",
      category: "registry_resolution_warning",
      summary: "API RequestContext migration fixture."
    }, headers);
    const clusters = await requestJson("POST", port, "/improvement/failure-clusters/recompute", {}, headers);
    const clusterId = ((clusters.body.failureClusters as Array<{ id: string }>)[0]).id;
    const candidate = await requestJson("POST", port, `/improvement/clusters/${clusterId}/generate-candidate`, {}, headers);
    const candidateId = (candidate.body.candidate as { id: string }).id;
    const proposalResponse = await requestJson("POST", port, `/improvement/candidates/${candidateId}/generate-proposal`, {}, headers);
    const proposalId = (proposalResponse.body.proposal as { id: string }).id;
    const draft = await requestJson("POST", port, `/improvement/proposals/${proposalId}/prepare-draft-change`, {}, headers);
    const decision = await requestJson("POST", port, `/improvement/proposals/${proposalId}/decisions`, {
      decision: "mark_eval_required",
      reason: "API governance RequestContext fixture."
    }, headers);
    const apply = await requestJson("POST", port, `/improvement/proposals/${proposalId}/apply`, {}, headers);
    const governanceAudit = await requestJson("GET", port, `/improvement/governance-audit?proposalId=${proposalId}`, {}, headers);

    const registryEvents = registryAudit.body.auditLogs as Array<Record<string, unknown>>;
    const governanceEvents = governanceAudit.body.events as Array<Record<string, unknown>>;
    assert.equal(status.statusCode, 200);
    assert.equal(registryEvents.some((event) =>
      event.requestId === "req_registry_governance_api_v1" &&
      event.correlationId === "corr_registry_governance_api_v1" &&
      event.source === "api"
    ), true);
    assert.equal(draft.statusCode, 201);
    assert.equal(decision.statusCode, 201);
    assert.equal(apply.statusCode, 403);
    assert.equal(governanceEvents.some((event) =>
      event.requestId === "req_registry_governance_api_v1" &&
      event.correlationId === "corr_registry_governance_api_v1" &&
      event.source === "api"
    ), true);
    assert.equal(hasSecretMaterial({ registryAudit, governanceAudit, apply }), false);
  });
});

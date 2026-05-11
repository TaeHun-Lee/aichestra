import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  InMemoryImprovementRepository,
  createImprovementServices,
  failureSignalToDto,
  improvementProposalToDto
} from "@aichestra/improvement";
import { createRegistryService } from "@aichestra/registry";

function servicesFor() {
  return createImprovementServices(new InMemoryImprovementRepository());
}

function getJson(port: number, path: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
      });
    });
    request.on("error", reject);
  });
}

function requestJson(method: "POST" | "PATCH", port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized)
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

test("failure signals validate source, severity, target kind, and DTO output", () => {
  const services = servicesFor();
  const signal = services.signals.createSignal({
    sourceType: "task_run",
    sourceId: "run_1",
    taskId: "task_1",
    taskRunId: "run_1",
    targetKind: "skill",
    targetRef: "auth-debugging@1.0.0",
    severity: "high",
    category: "repeated_eval_failed",
    summary: "Skill failed repeated mock eval checks.",
    metadata: { attempts: 2 }
  });

  assert.equal(services.signals.listSignals().length, 1);
  assert.equal(failureSignalToDto(signal).observedAt.endsWith("Z"), true);
  assert.throws(() => services.signals.createSignal({
    sourceType: "manual",
    sourceId: "bad",
    targetKind: "skill",
    severity: "severe" as never,
    category: "bad",
    summary: "bad"
  }), /severity/);
  assert.throws(() => services.signals.createSignal({
    sourceType: "manual",
    sourceId: "bad",
    targetKind: "service" as never,
    severity: "low",
    category: "bad",
    summary: "bad"
  }), /targetKind/);
});

test("failure clustering is deterministic and recompute does not duplicate clusters", () => {
  const services = servicesFor();
  services.signals.createSignal({
    sourceType: "registry_resolver",
    sourceId: "resolver_1",
    targetKind: "instruction",
    targetRef: "repo-agents-md@1.0.0",
    severity: "medium",
    category: "registry_resolution_warning",
    summary: "Resolver warning one."
  });
  services.signals.createSignal({
    sourceType: "registry_resolver",
    sourceId: "resolver_2",
    targetKind: "instruction",
    targetRef: "repo-agents-md@1.0.0",
    severity: "high",
    category: "registry_resolution_warning",
    summary: "Resolver warning two."
  });

  const first = services.clustering.recomputeClusters();
  const second = services.clustering.recomputeClusters();

  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(first[0]?.id, second[0]?.id);
  assert.equal(second[0]?.signalIds.length, 2);
  assert.equal(second[0]?.severity, "high");
});

test("improvement candidates can be triaged and dismissed candidates are not proposed by default", () => {
  const services = servicesFor();
  services.signals.createSignal({
    sourceType: "test_result",
    sourceId: "test_1",
    targetKind: "harness",
    targetRef: "backend-node20@1.0.0",
    severity: "medium",
    category: "harness_runtime_failure",
    summary: "Harness runtime failed a fixture."
  });
  const cluster = services.clustering.recomputeClusters()[0];
  assert.ok(cluster);

  const candidate = services.candidates.createCandidateFromCluster({ sourceClusterId: cluster.id });
  const triaged = services.candidates.triageCandidate({ id: candidate.id, status: "triaged" });
  const dismissed = services.candidates.triageCandidate({ id: candidate.id, status: "dismissed" });

  assert.equal(triaged.status, "triaged");
  assert.equal(services.candidates.isCandidateProposable(dismissed), false);
  assert.throws(() => services.proposals.createDraftProposal({ candidateId: dismissed.id }), /Dismissed candidates/);
});

test("draft proposals transition safely and do not mutate active registry entries", () => {
  const services = servicesFor();
  const store = createSeededStore();
  const registryService = createRegistryService({
    skillRepository: store,
    harnessRepository: store,
    instructionRepository: store,
    auditRepository: {
      appendAuditLog: (input) => store.appendAuditLog(input),
      listAuditLogs: () => store.listRegistryAuditLogs(),
      listAuditLogsForTarget: (targetKind, targetId) => store.listAuditLogsForTarget(targetKind, targetId)
    },
    historyRepository: store,
    evalResultRepository: store,
    packageRepository: store
  });
  const before = registryService.getSkill("skill_auth_debugging");
  services.signals.createSignal({
    sourceType: "test_result",
    sourceId: "eval_1",
    targetKind: "skill",
    targetRef: "auth-debugging@1.0.0",
    severity: "high",
    category: "repeated_eval_failed",
    summary: "Skill needs review."
  });
  const cluster = services.clustering.recomputeClusters()[0];
  assert.ok(cluster);
  const candidate = services.candidates.createCandidateFromCluster({ sourceClusterId: cluster.id, targetId: "skill_auth_debugging" });
  const proposal = services.proposals.createDraftProposal({
    candidateId: candidate.id,
    rationale: "Repeated local fixture failures.",
    safetyNotes: ["Draft only.", "No active registry mutation."]
  });
  const awaitingReview = services.proposals.transitionProposalStatus({ id: proposal.id, status: "awaiting_review" });
  const after = registryService.getSkill("skill_auth_debugging");

  assert.equal(proposal.status, "draft");
  assert.equal(awaitingReview.status, "awaiting_review");
  assert.equal(improvementProposalToDto(proposal).createdAt.endsWith("Z"), true);
  assert.deepEqual(after, before);
  assert.throws(() => services.proposals.transitionProposalStatus({ id: proposal.id, status: "applied" }), /out of scope/);
  assert.throws(() => services.proposals.transitionProposalStatus({ id: proposal.id, status: "draft" }), /Invalid proposal status transition/);
});

test("eval requirements, canary plans, and safety policy are preparation-only", () => {
  const services = servicesFor();
  const requirement = services.evalRequirements.createRequirement({
    targetKind: "skill",
    targetId: "skill_auth_debugging",
    requirementName: "mock regression suite",
    requirementType: "mock_eval",
    requiredStatus: "passed",
    description: "Document a future eval gate without executing it.",
    blocking: true
  });
  const plan = services.canaryPlans.createPlan({
    proposalId: "proposal_1",
    targetKind: "skill",
    targetId: "skill_auth_debugging",
    stages: [
      {
        name: "mock 10 percent",
        percentage: 10,
        scope: "mock task fixtures",
        successCriteria: ["No new high severity signals"],
        rollbackCriteria: ["Any critical signal"]
      }
    ]
  });
  const policy = services.safetyPolicies.listPolicies()[0];
  assert.ok(policy);

  assert.equal(requirement.blocking, true);
  assert.equal(plan.status, "draft");
  assert.equal(policy.allowAutoApply, false);
  assert.equal(policy.requireHumanApproval, true);
  assert.equal(policy.requireEvalPassed, true);
  assert.equal(policy.requireCanary, true);
  assert.throws(() => services.canaryPlans.createPlan({
    proposalId: "bad",
    targetKind: "skill",
    targetId: "skill_auth_debugging",
    stages: [{ name: "bad", percentage: 101, scope: "all", successCriteria: ["ok"], rollbackCriteria: ["bad"] }]
  }), /percentage/);
  assert.throws(() => services.safetyPolicies.updatePolicy(policy.id, { allowAutoApply: true }), /Auto-apply is disabled/);
});

test("improvement API exposes preparation read/write endpoints without auto-apply", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const signal = await requestJson("POST", address.port, "/improvement/failure-signals", {
      sourceType: "usage_ledger",
      sourceId: "usage_1",
      targetKind: "skill",
      targetRef: "auth-debugging@1.0.0",
      severity: "medium",
      category: "cost_spike",
      summary: "Mock cost spike observed."
    });
    const invalidSignal = await requestJson("POST", address.port, "/improvement/failure-signals", {
      sourceType: "manual",
      sourceId: "bad",
      targetKind: "skill",
      severity: "bad",
      category: "bad",
      summary: "bad"
    });
    const clusters = await requestJson("POST", address.port, "/improvement/failure-clusters/recompute");
    const clusterId = ((clusters.body.failureClusters as Array<{ id: string }>)[0]?.id);
    const candidate = await requestJson("POST", address.port, "/improvement/candidates/triage", {
      sourceClusterId: clusterId,
      targetKind: "skill",
      targetId: "skill_auth_debugging",
      targetName: "auth-debugging",
      targetVersion: "1.0.0"
    });
    const candidateId = ((candidate.body.candidate as { id: string }).id);
    const proposal = await requestJson("POST", address.port, "/improvement/proposals", {
      candidateId,
      rationale: "API test proposal.",
      safetyNotes: ["Draft only."]
    });
    const proposalId = ((proposal.body.proposal as { id: string }).id);
    const transitioned = await requestJson("PATCH", address.port, `/improvement/proposals/${proposalId}/status`, { status: "awaiting_review" });
    const applied = await requestJson("PATCH", address.port, `/improvement/proposals/${proposalId}/status`, { status: "applied" });
    const requirement = await requestJson("POST", address.port, "/improvement/eval-requirements", {
      targetKind: "skill",
      targetId: "skill_auth_debugging",
      requirementName: "manual review",
      requirementType: "manual_review",
      requiredStatus: "approved",
      description: "Manual approval is required.",
      blocking: true
    });
    const canary = await requestJson("POST", address.port, "/improvement/canary-plans", {
      proposalId,
      targetKind: "skill",
      targetId: "skill_auth_debugging",
      stages: [
        {
          name: "mock canary",
          percentage: 10,
          scope: "mock fixtures",
          successCriteria: ["stable"],
          rollbackCriteria: ["critical failure"]
        }
      ]
    });
    const policies = await getJson(address.port, "/improvement/safety-policies") as {
      safetyPolicies: Array<{ id: string; allowAutoApply: boolean }>;
    };
    const unsafePolicy = await requestJson("PATCH", address.port, `/improvement/safety-policies/${policies.safetyPolicies[0]?.id}`, { allowAutoApply: true });
    const listedCandidates = await getJson(address.port, "/improvement/candidates") as { candidates: unknown[] };
    const listedProposals = await getJson(address.port, "/improvement/proposals") as { proposals: unknown[] };

    assert.equal(signal.statusCode, 201);
    assert.equal(invalidSignal.statusCode, 400);
    assert.equal(clusters.statusCode, 200);
    assert.equal(candidate.statusCode, 201);
    assert.equal(proposal.statusCode, 201);
    assert.equal((proposal.body.proposal as { status: string }).status, "draft");
    assert.equal(transitioned.statusCode, 200);
    assert.equal(applied.statusCode, 400);
    assert.equal(requirement.statusCode, 201);
    assert.equal(canary.statusCode, 201);
    assert.equal(policies.safetyPolicies[0]?.allowAutoApply, false);
    assert.equal(unsafePolicy.statusCode, 400);
    assert.equal(listedCandidates.candidates.length, 1);
    assert.equal(listedProposals.proposals.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { InMemoryImprovementRepository, createImprovementServices } from "@aichestra/improvement";
import type { FailureSignalTargetKind } from "@aichestra/core";

function servicesFor() {
  return createImprovementServices(new InMemoryImprovementRepository());
}

function createProposal(
  services: ReturnType<typeof servicesFor>,
  category = "registry_resolution_warning",
  targetKind: FailureSignalTargetKind = "instruction",
  targetRef = "repo-agents-md@1.0.0"
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

test("proposal review queue is deterministic and excludes rejected or archived proposals by default", () => {
  const services = servicesFor();
  const first = createProposal(services, "registry_resolution_warning", "instruction", "repo-agents-md@1.0.0");
  const second = createProposal(services, "harness_runtime_failure", "harness", "backend-node20@1.0.0");
  services.proposals.transitionProposalStatus({ id: second.proposal.id, status: "awaiting_review" });

  const queue = services.governance.listReviewQueue();
  assert.deepEqual(queue.map((item) => item.proposalId).sort(), [first.proposal.id, second.proposal.id].sort());
  assert.equal(queue[0]?.blockingReasons.includes("human_approval_required"), true);

  services.governance.recordDecision({
    proposalId: first.proposal.id,
    decision: "reject",
    reason: "Governance test rejects this proposal."
  });
  services.governance.recordDecision({
    proposalId: second.proposal.id,
    decision: "archive",
    reason: "Governance test archives this proposal."
  });

  assert.equal(services.governance.listReviewQueue().length, 0);
  assert.equal(services.governance.listReviewQueue({ includeArchived: true }).length, 2);
});

test("governance decisions update proposal status, create audit events, and do not mutate registry entries", () => {
  const store = createSeededStore();
  const beforeSkill = store.getSkill("skill_auth_debugging");
  assert.ok(beforeSkill);
  const services = servicesFor();
  const { proposal } = createProposal(services, "repeated_eval_failed", "skill", "auth-debugging@1.0.0");

  const decision = services.governance.recordDecision({
    proposalId: proposal.id,
    decision: "approve",
    reason: "Approved for canary readiness checks only."
  });
  const updatedProposal = services.proposals.listProposals().find((entry) => entry.id === proposal.id);
  const events = services.governance.listAuditEvents(proposal.id);
  const afterSkill = store.getSkill("skill_auth_debugging");

  assert.equal(decision.decision, "approve");
  assert.equal(updatedProposal?.status, "approved_for_canary");
  assert.equal(events.some((event) => event.action === "proposal_decision_recorded"), true);
  assert.equal(events.some((event) => event.action === "proposal_approved"), true);
  assert.deepEqual(afterSkill, beforeSkill);
});

test("eval runs, canary readiness, and apply gate keep apply blocked without executing eval or rollout", () => {
  const services = servicesFor();
  const { proposal } = createProposal(services);
  const requirement = services.evalRequirements.createRequirement({
    targetKind: proposal.targetKind,
    targetId: proposal.targetId,
    requirementName: "mock governance review",
    requirementType: "mock_eval",
    requiredStatus: "passed",
    description: "A mock eval run must be attached.",
    blocking: true
  });

  services.governance.recordDecision({
    proposalId: proposal.id,
    decision: "approve",
    reason: "Approval should not bypass eval and canary gates."
  });
  const failedRun = services.proposalEvalRuns.attachEvalRun({
    proposalId: proposal.id,
    evalRequirementId: requirement.id,
    status: "failed",
    summary: "Mock eval metadata reports failure."
  });
  const failedReadiness = services.autoImprovement.evaluateProposalReadiness(proposal.id);
  const blockedCanary = services.canaryReadiness.evaluate(proposal.id);
  const gate = services.applyGate.evaluate(proposal.id);

  assert.equal(failedRun.status, "failed");
  assert.equal(failedReadiness.evalStatus, "failed");
  assert.equal(failedReadiness.blockingReasons.includes("eval_pass_required"), true);
  assert.deepEqual(blockedCanary.blockingReasons, ["canary_required"]);
  assert.equal(gate.canApply, false);
  assert.equal(gate.blockingReasons.includes("active_apply_not_implemented"), true);
  assert.equal(gate.blockingReasons.includes("auto_apply_disabled"), true);

  const readyPlan = services.canaryPlans.createPlan({
    proposalId: proposal.id,
    targetKind: proposal.targetKind,
    targetId: proposal.targetId,
    status: "ready",
    stages: [
      {
        name: "mock ready canary",
        percentage: 10,
        scope: "mock task runs",
        successCriteria: ["Mock success criteria reviewed"],
        rollbackCriteria: ["Any failed mock signal appears"]
      }
    ]
  });
  const readyCanary = services.canaryReadiness.evaluate(proposal.id);
  assert.equal(readyPlan.status, "ready");
  assert.equal(readyCanary.ready, true);
});

test("governance API exposes queue, decisions, eval runs, readiness gates, and forbidden apply", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  try {
    await requestJson("POST", address.port, "/improvement/failure-signals", {
      sourceType: "manual",
      sourceId: "api_governance_signal",
      targetKind: "instruction",
      targetRef: "repo-agents-md@1.0.0",
      severity: "high",
      category: "registry_resolution_warning",
      summary: "API governance fixture signal."
    });
    const clusters = await requestJson("POST", address.port, "/improvement/failure-clusters/recompute");
    const clusterId = ((clusters.body.failureClusters as Array<{ id: string }>)[0]).id;
    const candidate = await requestJson("POST", address.port, `/improvement/clusters/${clusterId}/generate-candidate`);
    const candidateId = (candidate.body.candidate as { id: string }).id;
    const proposalResponse = await requestJson("POST", address.port, `/improvement/candidates/${candidateId}/generate-proposal`);
    const proposalId = (proposalResponse.body.proposal as { id: string }).id;
    await requestJson("POST", address.port, `/improvement/proposals/${proposalId}/prepare-draft-change`);
    const queue = await getJson(address.port, "/improvement/proposal-review-queue") as { proposalReviewQueue: unknown[] };
    const invalidDecision = await requestJson("POST", address.port, `/improvement/proposals/${proposalId}/decisions`, { decision: "apply", reason: "bad" });
    const decision = await requestJson("POST", address.port, `/improvement/proposals/${proposalId}/decisions`, { decision: "mark_eval_required", reason: "Need mock eval metadata." });
    const decisions = await getJson(address.port, `/improvement/proposals/${proposalId}/decisions`) as { decisions: unknown[] };
    const evalReq = await requestJson("POST", address.port, "/improvement/eval-requirements", {
      targetKind: "instruction",
      targetId: (proposalResponse.body.proposal as { targetId: string }).targetId,
      requirementName: "api mock eval",
      requirementType: "mock_eval",
      requiredStatus: "passed",
      description: "Attach mock eval metadata.",
      blocking: true
    });
    const evalRun = await requestJson("POST", address.port, `/improvement/proposals/${proposalId}/eval-runs`, {
      evalRequirementId: (evalReq.body.evalRequirement as { id: string }).id,
      status: "passed",
      summary: "Mock eval metadata passed."
    });
    const evalRuns = await getJson(address.port, `/improvement/proposals/${proposalId}/eval-runs`) as { evalRuns: unknown[] };
    const canaryReadiness = await getJson(address.port, `/improvement/proposals/${proposalId}/canary-readiness`) as { canaryReadiness: { blockingReasons: string[] } };
    const applyGate = await getJson(address.port, `/improvement/proposals/${proposalId}/apply-gate`) as { applyGate: { canApply: boolean; blockingReasons: string[] } };
    const applyAttempt = await requestJson("POST", address.port, `/improvement/proposals/${proposalId}/apply`);
    const audit = await getJson(address.port, `/improvement/governance-audit?proposalId=${proposalId}`) as { events: unknown[] };

    assert.equal(queue.proposalReviewQueue.length, 1);
    assert.equal(invalidDecision.statusCode, 400);
    assert.equal(decision.statusCode, 201);
    assert.equal(decisions.decisions.length, 1);
    assert.equal(evalRun.statusCode, 201);
    assert.equal(evalRuns.evalRuns.length, 1);
    assert.deepEqual(canaryReadiness.canaryReadiness.blockingReasons, ["canary_required"]);
    assert.equal(applyGate.applyGate.canApply, false);
    assert.equal(applyGate.applyGate.blockingReasons.includes("active_apply_not_implemented"), true);
    assert.equal(applyAttempt.statusCode, 403);
    assert.equal(audit.events.length >= 4, true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

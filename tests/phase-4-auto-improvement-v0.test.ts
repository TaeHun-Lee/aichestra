import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { InMemoryImprovementRepository, createImprovementServices } from "@aichestra/improvement";
import { createRegistryService } from "@aichestra/registry";
import type { FailureSignalTargetKind } from "@aichestra/core";

function servicesFor() {
  return createImprovementServices(new InMemoryImprovementRepository());
}

function createCluster(
  services: ReturnType<typeof servicesFor>,
  category: string,
  targetKind: FailureSignalTargetKind,
  targetRef: string,
  severity: "low" | "medium" | "high" | "critical" = "high"
) {
  services.signals.createSignal({
    sourceType: "manual",
    sourceId: `${category}_${targetRef}`,
    targetKind,
    targetRef,
    severity,
    category,
    summary: `${category} observed for ${targetRef}.`
  });
  const cluster = services.clustering.recomputeClusters()[0];
  assert.ok(cluster);
  return cluster;
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

test("MockAutoImprovementEngine analyzes clusters and generates deterministic candidates, proposals, draft changes, and readiness", () => {
  const services = servicesFor();
  const cluster = createCluster(services, "instruction_checksum_mismatch", "instruction", "repo-agents-md@1.0.0");
  const analysis = services.autoImprovement.analyzeFailureCluster(cluster.id);
  const analysisAgain = services.autoImprovement.analyzeFailureCluster(cluster.id);
  const candidate = services.autoImprovement.generateImprovementCandidate(cluster.id);
  const proposal = services.autoImprovement.generateImprovementProposal(candidate.id);
  services.evalRequirements.createRequirement({
    targetKind: "instruction",
    targetId: proposal.targetId,
    requirementName: "manual instruction review",
    requirementType: "manual_review",
    requiredStatus: "approved",
    description: "Review the proposed instruction change.",
    blocking: true
  });
  const draftChange = services.autoImprovement.prepareDraftRegistryChange(proposal.id);
  const readiness = services.autoImprovement.evaluateProposalReadiness(proposal.id);

  assert.equal(analysis.id, analysisAgain.id);
  assert.equal(analysis.targetKind, "instruction");
  assert.equal(analysis.recommendedCandidateType, "update_instruction");
  assert.equal(candidate.candidateType, "update_instruction");
  assert.equal(proposal.proposedChangeType, "instruction_update");
  assert.equal(draftChange.changeType, "instruction_update");
  assert.equal(draftChange.status, "draft");
  assert.equal(draftChange.draftPayload.activeRegistryMutation, false);
  assert.deepEqual(readiness.blockingReasons, [
    "human_approval_required",
    "eval_pass_required",
    "canary_required",
    "auto_apply_disabled"
  ]);
  assert.equal(readiness.requiredEvalIds.length, 1);
});

test("mock engine mappings cover skill eval, harness runtime, registry warning, conflict risk, and cost spike categories", () => {
  const skillServices = servicesFor();
  const skillCluster = createCluster(skillServices, "repeated_eval_failed", "skill", "auth-debugging@1.0.0");
  const skillCandidate = skillServices.autoImprovement.generateImprovementCandidate(skillCluster.id);
  const skillProposal = skillServices.autoImprovement.generateImprovementProposal(skillCandidate.id);

  const harnessServices = servicesFor();
  const harnessCluster = createCluster(harnessServices, "harness_runtime_failure", "harness", "backend-node20@1.0.0");
  const harnessCandidate = harnessServices.autoImprovement.generateImprovementCandidate(harnessCluster.id);
  const harnessProposal = harnessServices.autoImprovement.generateImprovementProposal(harnessCandidate.id);

  const warningServices = servicesFor();
  const warningCluster = createCluster(warningServices, "registry_resolution_warning", "instruction", "repo-agents-md@1.0.0");
  const warningCandidate = warningServices.autoImprovement.generateImprovementCandidate(warningCluster.id);

  const conflictServices = servicesFor();
  const conflictCluster = createCluster(conflictServices, "conflict_risk_repeated", "conflict_manager", "repo_demo_backend@main");
  const conflictCandidate = conflictServices.autoImprovement.generateImprovementCandidate(conflictCluster.id);

  const costServices = servicesFor();
  const costCluster = createCluster(costServices, "cost_spike", "model", "mock-model@0.0.0");
  const costCandidate = costServices.autoImprovement.generateImprovementCandidate(costCluster.id);
  const costProposal = costServices.autoImprovement.generateImprovementProposal(costCandidate.id);
  const costDraft = costServices.autoImprovement.prepareDraftRegistryChange(costProposal.id);

  assert.equal(skillCandidate.candidateType, "update_skill");
  assert.equal(skillProposal.proposedChangeType, "new_version");
  assert.equal(harnessCandidate.candidateType, "update_harness");
  assert.equal(harnessProposal.proposedChangeType, "patch");
  assert.equal(warningCandidate.candidateType, "update_instruction");
  assert.equal(conflictCandidate.targetName, "conflict-risk-reviewer");
  assert.equal(conflictCandidate.candidateType, "update_skill");
  assert.equal(costCandidate.candidateType, "adjust_resolver");
  assert.equal(costProposal.proposedChangeType, "status_change");
  assert.equal(costDraft.changeType, "metadata_update");
  assert.equal(JSON.stringify(costDraft.draftPayload).includes("OpenAI"), false);
});

test("draft registry changes transition without apply behavior and cannot mutate registry entries", () => {
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
  const beforeSkill = registryService.getSkill("skill_auth_debugging");
  const beforeHarness = registryService.getHarness("harness_backend_node20");
  const beforeInstruction = registryService.getInstruction("instr_org_secure_coding_baseline");
  const skillCluster = createCluster(services, "repeated_eval_failed", "skill", "auth-debugging@1.0.0");
  const harnessCluster = createCluster(services, "harness_runtime_failure", "harness", "backend-node20@1.0.0");
  const instructionCluster = createCluster(services, "instruction_checksum_mismatch", "instruction", "org-secure-coding-baseline@1.0.0");
  const skillDraft = services.autoImprovement.prepareDraftRegistryChange(
    services.autoImprovement.generateImprovementProposal(services.autoImprovement.generateImprovementCandidate(skillCluster.id).id).id
  );
  const harnessDraft = services.autoImprovement.prepareDraftRegistryChange(
    services.autoImprovement.generateImprovementProposal(services.autoImprovement.generateImprovementCandidate(harnessCluster.id).id).id
  );
  const instructionDraft = services.autoImprovement.prepareDraftRegistryChange(
    services.autoImprovement.generateImprovementProposal(services.autoImprovement.generateImprovementCandidate(instructionCluster.id).id).id
  );
  const awaitingReview = services.draftRegistryChanges.transitionDraftChange({ id: skillDraft.id, status: "awaiting_review" });
  const rejected = services.draftRegistryChanges.transitionDraftChange({ id: harnessDraft.id, status: "rejected" });

  assert.equal(awaitingReview.status, "awaiting_review");
  assert.equal(rejected.status, "rejected");
  assert.equal(instructionDraft.status, "draft");
  assert.throws(() => services.draftRegistryChanges.transitionDraftChange({ id: awaitingReview.id, status: "draft" }), /Invalid draft registry change status transition/);
  assert.deepEqual(registryService.getSkill("skill_auth_debugging"), beforeSkill);
  assert.deepEqual(registryService.getHarness("harness_backend_node20"), beforeHarness);
  assert.deepEqual(registryService.getInstruction("instr_org_secure_coding_baseline"), beforeInstruction);
});

test("proposal readiness always explains why auto-apply is blocked by default policy", () => {
  const services = servicesFor();
  const cluster = createCluster(services, "repeated_eval_failed", "skill", "auth-debugging@1.0.0");
  const proposal = services.autoImprovement.generateImprovementProposal(
    services.autoImprovement.generateImprovementCandidate(cluster.id).id
  );
  const readiness = services.autoImprovement.evaluateProposalReadiness(proposal.id);

  assert.equal(readiness.readyForReview, true);
  assert.equal(readiness.requiredApproval, true);
  assert.equal(readiness.requiredCanary, true);
  assert.equal(readiness.blockingReasons.includes("human_approval_required"), true);
  assert.equal(readiness.blockingReasons.includes("eval_pass_required"), true);
  assert.equal(readiness.blockingReasons.includes("canary_required"), true);
  assert.equal(readiness.blockingReasons.includes("auto_apply_disabled"), true);
});

test("auto-improvement API exposes analysis, proposal generation, draft changes, and readiness", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    await requestJson("POST", address.port, "/improvement/failure-signals", {
      sourceType: "manual",
      sourceId: "manual_1",
      targetKind: "skill",
      targetRef: "auth-debugging@1.0.0",
      severity: "high",
      category: "repeated_eval_failed",
      summary: "Repeated eval failures."
    });
    const clusters = await requestJson("POST", address.port, "/improvement/failure-clusters/recompute");
    const clusterId = (clusters.body.failureClusters as Array<{ id: string }>)[0]?.id;
    const analysis = await requestJson("POST", address.port, `/improvement/clusters/${clusterId}/analyze`);
    const candidate = await requestJson("POST", address.port, `/improvement/clusters/${clusterId}/generate-candidate`);
    const candidateId = (candidate.body.candidate as { id: string }).id;
    const proposal = await requestJson("POST", address.port, `/improvement/candidates/${candidateId}/generate-proposal`);
    const proposalId = (proposal.body.proposal as { id: string }).id;
    const draft = await requestJson("POST", address.port, `/improvement/proposals/${proposalId}/prepare-draft-change`);
    const draftId = (draft.body.draftRegistryChange as { id: string }).id;
    const readiness = await getJson(address.port, `/improvement/proposals/${proposalId}/readiness`) as { readiness: { blockingReasons: string[] } };
    const analyses = await getJson(address.port, "/improvement/analyses") as { analyses: unknown[] };
    const analysisDetail = await getJson(address.port, `/improvement/analyses/${(analysis.body.analysis as { id: string }).id}`) as { analysis: { clusterId: string } };
    const drafts = await getJson(address.port, "/improvement/draft-registry-changes") as { draftRegistryChanges: unknown[] };
    const draftDetail = await getJson(address.port, `/improvement/draft-registry-changes/${draftId}`) as { draftRegistryChange: { id: string } };
    const draftStatus = await requestJson("PATCH", address.port, `/improvement/draft-registry-changes/${draftId}/status`, { status: "awaiting_review" });
    const invalidDraftStatus = await requestJson("PATCH", address.port, `/improvement/draft-registry-changes/${draftId}/status`, { status: "applied" });
    const missingCluster = await requestJson("POST", address.port, "/improvement/clusters/missing/analyze");
    const missingCandidate = await requestJson("POST", address.port, "/improvement/candidates/missing/generate-proposal");
    const missingProposal = await requestJson("POST", address.port, "/improvement/proposals/missing/prepare-draft-change");
    const applyAttempt = await requestJson("POST", address.port, `/improvement/draft-registry-changes/${draftId}/apply`);

    assert.equal(analysis.statusCode, 201);
    assert.equal(candidate.statusCode, 201);
    assert.equal(proposal.statusCode, 201);
    assert.equal((proposal.body.proposal as { status: string }).status, "draft");
    assert.equal(draft.statusCode, 201);
    assert.equal(readiness.readiness.blockingReasons.includes("auto_apply_disabled"), true);
    assert.equal(analyses.analyses.length, 1);
    assert.equal(analysisDetail.analysis.clusterId, clusterId);
    assert.equal(drafts.draftRegistryChanges.length, 1);
    assert.equal(draftDetail.draftRegistryChange.id, draftId);
    assert.equal(draftStatus.statusCode, 200);
    assert.equal(invalidDraftStatus.statusCode, 400);
    assert.equal(missingCluster.statusCode, 404);
    assert.equal(missingCandidate.statusCode, 404);
    assert.equal(missingProposal.statusCode, 404);
    assert.equal(applyAttempt.statusCode, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

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
  createRegistryArtifactTrustService,
  createRegistryService,
  registryArtifactInputFromPackageManifest
} from "@aichestra/registry";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardReadModels } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-18T00:00:00.000Z");

function hasSecretOrEnvValue(value: unknown): boolean {
  return /OPENAI_API_KEY=[^"\s]+|ANTHROPIC_API_KEY=[^"\s]+|GITHUB_TOKEN=[^"\s]+|VAULT_TOKEN=[^"\s]+|AICHESTRA_DATABASE_URL=[^"\s]+|DATABASE_URL=[^"\s]+|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_]{30,}|hvs\.[A-Za-z0-9_-]{20,}/i.test(JSON.stringify(value));
}

function createRegistryHarness(input: { skills?: SkillPackage[]; instructions?: InstructionArtifact[] } = {}) {
  const repository = new InMemoryRegistryRepository({
    skills: input.skills ?? seedSkills,
    harnesses: seedHarnesses,
    instructions: input.instructions ?? seedInstructions
  });
  const artifactTrustService = createRegistryArtifactTrustService({ now: () => fixedNow });
  const registryService = createRegistryService({
    skillRepository: repository,
    harnessRepository: repository,
    instructionRepository: repository,
    auditRepository: repository,
    historyRepository: repository,
    evalResultRepository: repository,
    packageRepository: repository,
    artifactTrustService
  });
  return { registryService, artifactTrustService };
}

function taskFixture(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_registry_artifact_trust_v1",
    title: "Registry artifact trust fixture",
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
    id: "skill_artifact_trust_pending_v1",
    name: "artifact-trust-pending-v1",
    version: "1.0.0",
    status: "active",
    approvalStatus: "pending",
    evalStatus: "passed",
    createdAt: fixedNow,
    updatedAt: fixedNow
  };
}

function cloneInstructionForChecksumMismatch(base: InstructionArtifact): InstructionArtifact {
  return {
    ...base,
    id: "instr_artifact_trust_checksum_mismatch_v1",
    name: "artifact-trust-checksum-mismatch-v1",
    version: "1.0.0",
    checksum: "sha256:artifact-trust-checksum-mismatch-v1",
    checksumStatus: "mismatch",
    precedence: 1,
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

test("artifact trust evaluates digest, mock signature metadata, provenance, and policy", () => {
  const { registryService, artifactTrustService } = createRegistryHarness();
  const manifest = registryService.exportPackageManifest({ packageKind: "skill", targetId: "skill_jest_test_fixer" });
  const unsignedDecision = artifactTrustService.evaluatePackageTrust(manifest, { actorId: "user_artifact_trust", requestId: "req_artifact_trust_unsigned" });

  assert.equal(unsignedDecision.decision, "trusted_with_warnings");
  assert.equal(unsignedDecision.warnings.includes("signature_unsigned"), true);
  assert.equal(unsignedDecision.warnings.includes("provenance_missing"), true);
  assert.equal((unsignedDecision.metadata.digest as Record<string, unknown>).digestStatus, "present");

  const signature = artifactTrustService.createMockSignatureMetadata({ artifactId: manifest.id }, { actorId: "mock_signer" });
  const provenance = artifactTrustService.attachProvenanceMetadata({ artifactId: manifest.id, sourceRepoId: "repo_demo_backend" }, { actorId: "mock_builder" });
  const trustedDecision = artifactTrustService.evaluatePackageTrust(manifest, { actorId: "user_artifact_trust", requestId: "req_artifact_trust_signed" });

  assert.equal(signature.signatureStatus, "mock_signed");
  assert.equal(provenance.provenanceStatus, "present_mock");
  assert.equal(trustedDecision.decision, "trusted");
  assert.equal(artifactTrustService.listTrustPolicies()[0]?.status, "active_mock");
  assert.equal(hasSecretOrEnvValue({ unsignedDecision, signature, provenance, trustedDecision }), false);
});

test("digest mismatch and invalid mock signature produce blocking trust decisions", () => {
  const service = createRegistryArtifactTrustService({ now: () => fixedNow });
  const digestMismatch = service.evaluateArtifactTrust({
    artifactId: "artifact_digest_mismatch",
    artifactKind: "skill_package",
    checksum: "sha256:expected",
    digest: { digestStatus: "mismatch", digestValue: "sha256:actual" },
    signature: { signatureStatus: "mock_signed", signatureKind: "mock_signature" },
    provenance: { provenanceStatus: "present_mock", buildSystem: "mock" }
  }, { requestId: "req_digest_mismatch" });
  const invalidSignature = service.evaluateArtifactTrust({
    artifactId: "artifact_invalid_signature",
    artifactKind: "harness_package",
    checksum: "sha256:harness",
    signature: { signatureStatus: "invalid", signatureKind: "mock_signature" },
    provenance: { provenanceStatus: "present_mock", buildSystem: "mock" }
  }, { requestId: "req_invalid_signature" });

  assert.equal(digestMismatch.decision, "blocked_digest_mismatch");
  assert.equal(digestMismatch.resolverImpact, "block_sensitive");
  assert.equal(invalidSignature.decision, "blocked_invalid_signature");
  assert.equal(invalidSignature.resolverImpact, "block_sensitive");
  assert.equal(hasSecretOrEnvValue({ digestMismatch, invalidSignature }), false);
});

test("missing provenance warns by default and policy deny blocks trust evaluation", () => {
  const warnings = createRegistryArtifactTrustService({ now: () => fixedNow }).evaluateArtifactTrust({
    artifactId: "artifact_missing_provenance",
    artifactKind: "registry_bundle",
    checksum: "sha256:bundle",
    signature: { signatureStatus: "mock_signed", signatureKind: "mock_signature" }
  }, { requestId: "req_missing_provenance" });
  const denied = createRegistryArtifactTrustService({
    now: () => fixedNow,
    policyEvaluator: () => ({ decision: "deny", matchedRuleIds: ["policy_registry_artifact_trust_test_deny"], reason: "test_policy_deny" })
  }).evaluateArtifactTrust({
    artifactId: "artifact_policy_denied",
    artifactKind: "skill_package",
    checksum: "sha256:policy"
  }, { requestId: "req_policy_deny" });

  assert.equal(warnings.decision, "trusted_with_warnings");
  assert.equal(warnings.warnings.includes("provenance_missing"), true);
  assert.equal(denied.decision, "untrusted");
  assert.equal(denied.blockers.some((blocker) => blocker.includes("policy_denied")), true);
});

test("resolver attaches trust metadata while preserving approval and checksum gates", () => {
  const baseSkill = seedSkills.find((skill) => skill.id === "skill_auth_debugging") as SkillPackage;
  const baseInstruction = seedInstructions.find((instruction) => instruction.id === "instr_org_secure_coding_baseline") as InstructionArtifact;
  const { registryService } = createRegistryHarness({
    skills: [...seedSkills, cloneSkillForPending(baseSkill)],
    instructions: [...seedInstructions, cloneInstructionForChecksumMismatch(baseInstruction)]
  });

  const pendingResolution = registryService.resolveRegistryContextForTask({
    task: taskFixture({ selectedSkillIds: ["artifact-trust-pending-v1@1.0.0"] }),
    agent: "codex"
  });
  const normalResolution = registryService.resolveRegistryContextForTask({
    task: taskFixture(),
    agent: "codex"
  });

  assert.equal(pendingResolution.errors.some((error) => error.includes("No selectable skill version satisfies artifact-trust-pending-v1@1.0.0")), true);
  assert.ok(pendingResolution.artifactTrustSummary);
  assert.equal(normalResolution.selectedInstructions.some((instruction) => instruction.name === "artifact-trust-checksum-mismatch-v1"), false);
  assert.equal(Array.isArray(normalResolution.artifactTrustDecisions), true);
});

test("registry import/export trust metadata is local and does not bypass gates", () => {
  const { registryService, artifactTrustService } = createRegistryHarness();
  const manifest = registryService.exportPackageManifest({ packageKind: "skill", targetId: "skill_jest_test_fixer" });
  const trustInput = registryArtifactInputFromPackageManifest(manifest);
  const decision = artifactTrustService.evaluateArtifactTrust(trustInput, { requestId: "req_export_trust" });
  const imported = registryService.importPackageManifest({ manifest, dryRun: true });

  assert.equal((manifest.metadata.artifactTrust as Record<string, unknown>).realSigningImplemented, false);
  assert.equal(decision.metadata.resolverGatesPreserved, true);
  assert.equal(imported.dryRun, true);
  assert.equal(imported.imported, false);
});

test("artifact trust API endpoints are safe metadata-only surfaces", async () => {
  await withApiServer(async (port) => {
    const policies = await getJson(port, "/registry/artifact-trust/policies");
    const summary = await getJson(port, "/registry/artifact-trust/summary");
    const signature = await postJson(port, "/registry/artifact-trust/mock-signature", { artifactId: "api_artifact_trust" });
    const provenance = await postJson(port, "/registry/artifact-trust/provenance", { artifactId: "api_artifact_trust", sourceRepoId: "repo_demo_backend" });
    const evaluate = await postJson(port, "/registry/artifact-trust/evaluate", {
      artifactId: "api_artifact_trust",
      checksum: "sha256:api-artifact-trust"
    });
    const readiness = await getJson(port, "/readiness/registry/artifact-trust/summary");

    assert.equal(policies.statusCode, 200);
    assert.equal(summary.statusCode, 200);
    assert.equal(signature.statusCode, 201);
    assert.equal(provenance.statusCode, 201);
    assert.equal(evaluate.statusCode, 201);
    assert.equal(readiness.statusCode, 200);
    assert.equal(summary.body.realSigningImplemented, false);
    assert.equal(summary.body.realVerificationImplemented, false);
    assert.equal(summary.body.externalRegistryCalls, false);
    assert.equal((signature.body.signature as Record<string, unknown>).signatureStatus, "mock_signed");
    assert.equal((provenance.body.provenance as Record<string, unknown>).provenanceStatus, "present_mock");
    assert.equal(hasSecretOrEnvValue({ policies, summary, signature, provenance, evaluate, readiness }), false);
  });
});

test("dashboard renders registry artifact trust panel without secret or env values", async () => {
  const models = await new DemoDashboardDataProvider().getReadModels();
  const html = renderDashboardReadModels(models);

  assert.equal(models.registry.artifactTrustSummary.realSigningImplemented, false);
  assert.equal(models.registry.artifactTrustSummary.realVerificationImplemented, false);
  assert.equal(html.includes("Registry Artifact Trust"), true);
  assert.equal(hasSecretOrEnvValue(html), false);
});


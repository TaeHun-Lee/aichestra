import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  InMemoryRegistryRepository,
  createDefaultRegistry,
  createRegistryPackageManifest,
  createRegistryService,
  diffRegistryStructures,
  registryPackageManifestToDto
} from "@aichestra/registry";
import type { RegistryActor, SkillPackage, Task } from "@aichestra/core";

const admin: RegistryActor = { id: "admin", displayName: "Admin", roles: ["registry_admin"] };
const viewer: RegistryActor = { id: "viewer", displayName: "Viewer", roles: ["registry_viewer"] };

function serviceFor(repository = new InMemoryRegistryRepository()) {
  return createRegistryService({
    skillRepository: repository,
    harnessRepository: repository,
    instructionRepository: repository,
    auditRepository: repository,
    historyRepository: repository,
    evalResultRepository: repository,
    packageRepository: repository,
    defaultActor: admin
  });
}

function task(selectedSkillIds: string[] = []): Task {
  return {
    id: "task_registry_versions",
    title: "Fix auth login timeout",
    status: "draft",
    requesterUserId: "user_demo_admin",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
}

function postJsonWithStatus(port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
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

test("registry package manifests export skill, harness, instruction, and bundle packages deterministically", () => {
  const service = serviceFor();
  const skill = service.exportPackageManifest({ packageKind: "skill", targetId: "skill_auth_debugging" });
  const skillAgain = service.exportPackageManifest({ packageKind: "skill", targetId: "skill_auth_debugging" });
  const harness = service.exportPackageManifest({ packageKind: "harness", targetId: "harness_backend_node20" });
  const instruction = service.exportPackageManifest({ packageKind: "instruction", targetId: "instr_org_secure_coding_baseline" });
  const bundle = service.exportPackageManifest({ packageKind: "bundle", name: "core-registry", version: "1.0.0" });

  assert.equal(skill.schemaVersion, "aichestra.registry.package.v1");
  assert.equal(skill.packageKind, "skill");
  assert.equal(skill.checksum, skillAgain.checksum);
  assert.equal(harness.packageKind, "harness");
  assert.equal(instruction.packageKind, "instruction");
  assert.equal(bundle.packageKind, "bundle");
  assert.equal(bundle.entries.some((entry) => entry.kind === "skill"), true);
  assert.equal(registryPackageManifestToDto(skill).createdAt.endsWith("Z"), true);
  assert.throws(() => createRegistryPackageManifest({ ...skill, entries: [] }), /manifest.entries/);
});

test("local package import supports create-only, dry-run, conflicts, and draft replacement", () => {
  const source = serviceFor();
  const manifest = source.exportPackageManifest({ packageKind: "skill", targetId: "skill_auth_debugging" });
  const empty = new InMemoryRegistryRepository({ skills: [], harnesses: [], instructions: [], auditLogs: [], revisions: [], evalResults: [], packageManifests: [] });
  const target = serviceFor(empty);

  const dryRun = target.importPackageManifest({ manifest, dryRun: true, actor: admin });
  assert.equal(dryRun.dryRun, true);
  assert.equal(target.listSkills().length, 0);

  const imported = target.importPackageManifest({ manifest, actor: admin, reason: "local import" });
  assert.equal(imported.imported, true);
  assert.equal(imported.createdEntries[0]?.name, "auth-debugging");
  assert.equal(target.listAuditLogs({ actor: viewer }).some((log) => log.reason === "local import"), true);
  assert.equal(target.listRevisionsForTarget("skill", imported.createdEntries[0]?.id ?? "", viewer).length, 1);

  const conflict = target.importPackageManifest({ manifest, actor: admin });
  assert.equal(conflict.errors.some((error) => error.includes("Import conflict")), true);

  const draftRepo = new InMemoryRegistryRepository({ skills: [{ ...(manifest.metadata.artifacts as Record<string, SkillPackage>)[manifest.entries[0].id], status: "draft" }], harnesses: [], instructions: [], auditLogs: [], revisions: [], evalResults: [], packageManifests: [] });
  const draftTarget = serviceFor(draftRepo);
  const replaced = draftTarget.importPackageManifest({ manifest, importMode: "replace_draft_only", actor: admin });
  assert.equal(replaced.replacedEntries[0]?.name, "auth-debugging");
  assert.equal(draftTarget.getSkill(replaced.replacedEntries[0]?.id ?? "")?.status, "active");

  assert.throws(() => target.importPackageManifest({ manifest, actor: viewer }), /missing permission registry.create/);
  const invalid = target.importPackageManifest({ manifest: { ...manifest, schemaVersion: "bad.schema" }, actor: admin });
  assert.equal(invalid.errors.some((error) => error.includes("Unsupported package schemaVersion")), true);
});

test("semver range resolution selects highest compatible safe versions and rejects invalid ranges", () => {
  const repository = new InMemoryRegistryRepository();
  const service = serviceFor(repository);
  const base = service.getSkill("skill_auth_debugging") as SkillPackage;
  service.createSkill({ ...base, id: "skill_auth_debugging_1_1", version: "1.1.0" }, admin);
  service.createSkill({ ...base, id: "skill_auth_debugging_1_2_bad", version: "1.2.0", status: "deprecated" }, admin);
  service.createSkill({ ...base, id: "skill_auth_debugging_2_0", version: "2.0.0" }, admin);

  const exact = service.resolveVersion("skill", "auth-debugging", "1.0.0");
  const caret = service.resolveVersion("skill", "auth-debugging", "^1.0.0");
  const tilde = service.resolveVersion("skill", "auth-debugging", "~1.1.0");
  const wildcard = service.resolveVersion("skill", "auth-debugging", "1.x");
  const invalid = service.resolveVersion("skill", "auth-debugging", ">=1");
  service.updateSkillApproval("skill_auth_debugging_1_1", { approvalStatus: "rejected", actor: { id: "reviewer", displayName: "Reviewer", roles: ["registry_reviewer"] } });
  const rejectedExcluded = service.resolveVersion("skill", "auth-debugging", "^1.0.0");

  assert.equal(exact.selected?.version, "1.0.0");
  assert.equal(caret.selected?.version, "1.1.0");
  assert.equal(tilde.selected?.version, "1.1.0");
  assert.equal(wildcard.selected?.version, "1.1.0");
  assert.equal(invalid.errors.some((error) => error.includes("Unsupported version range")), true);
  assert.equal(rejectedExcluded.selected?.version, "1.0.0");

  const resolution = service.resolveRegistryContextForTask({ task: task(["auth-debugging@^1.0.0"]), agent: "codex" });
  assert.equal(resolution.selectedSkills.some((skill) => skill.name === "auth-debugging" && skill.version === "1.0.0"), true);
});

test("resolver handles dependencies, optional warnings, unsafe entries, and cycles deterministically", () => {
  const service = serviceFor();
  const auth = service.getSkill("skill_auth_debugging") as SkillPackage;
  service.createSkill({
    ...auth,
    id: "skill_dep_host",
    name: "dep-host",
    dependencies: [
      { kind: "skill", name: "auth-debugging", versionRange: "^1.0.0", required: true },
      { kind: "instruction", name: "missing-optional", versionRange: "1.x", required: false }
    ]
  }, admin);
  const withDependency = service.resolveRegistryContextForTask({ task: task(["dep-host@1.0.0"]), agent: "codex" });

  service.createSkill({
    ...auth,
    id: "skill_missing_required",
    name: "missing-required",
    dependencies: [{ kind: "skill", name: "no-such-skill", versionRange: "1.x", required: true }]
  }, admin);
  const missingRequired = service.resolveRegistryContextForTask({ task: task(["missing-required@1.0.0"]), agent: "codex" });

  service.createSkill({
    ...auth,
    id: "skill_cycle_a",
    name: "cycle-a",
    dependencies: [{ kind: "skill", name: "cycle-b", versionRange: "1.x", required: true }]
  }, admin);
  service.createSkill({
    ...auth,
    id: "skill_cycle_b",
    name: "cycle-b",
    dependencies: [{ kind: "skill", name: "cycle-a", versionRange: "1.x", required: true }]
  }, admin);
  const cycle = service.resolveRegistryContextForTask({ task: task(["cycle-a@1.0.0"]), agent: "codex" });

  assert.equal(withDependency.selectedSkills.some((skill) => skill.name === "auth-debugging"), true);
  assert.equal(withDependency.warnings.some((warning) => warning.includes("missing-optional")), true);
  assert.equal(missingRequired.errors.some((error) => error.includes("no-such-skill")), true);
  assert.equal(cycle.errors.some((error) => error.includes("Circular registry dependency")), true);
});

test("package and revision diffs are deterministic and risk-aware", () => {
  const service = serviceFor();
  const skill = service.exportPackageManifest({ packageKind: "skill", targetId: "skill_auth_debugging" });
  const { checksum: _checksum, ...skillWithoutChecksum } = skill;
  const changedSkill = createRegistryPackageManifest({ ...skillWithoutChecksum, id: undefined, description: "Changed package description." });
  const skillDiff = service.diffPackageManifests(skill, changedSkill);
  const harness = createDefaultRegistry().harnesses[0];
  const highRisk = diffRegistryStructures(
    "harness@old",
    { networkPolicy: harness.networkPolicy, allowedTools: harness.allowedTools },
    "harness@new",
    { networkPolicy: { mode: "unrestricted" }, allowedTools: ["git", "node", "shell"] }
  );
  const instructionRisk = diffRegistryStructures("instruction@old", { body: "old" }, "instruction@new", { body: "new" });

  assert.equal(skillDiff.summary.includes("changed"), true);
  assert.equal(skillDiff.riskLevel, "low");
  assert.equal(highRisk.riskLevel, "high");
  assert.equal(instructionRisk.riskLevel, "medium");
});

test("API exposes package manifest export, import dry-run, listing, and diff", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const manifestResponse = await getJson(address.port, "/registry/skills/skill_auth_debugging/manifest") as { package: { id: string; name: string; checksum: string } };
    const packages = await getJson(address.port, "/registry/packages") as { packages: { id: string; name: string }[] };
    const dryRun = await postJsonWithStatus(address.port, "/registry/packages/import/dry-run", {
      manifest: manifestResponse.package
    });
    const exported = await postJsonWithStatus(address.port, "/registry/packages/export", {
      packageKind: "bundle",
      name: "api-bundle",
      version: "1.0.0"
    });
    const listedAfterExport = await getJson(address.port, "/registry/packages") as { packages: { id: string; name: string }[] };
    const diff = await postJsonWithStatus(address.port, "/registry/packages/diff", {
      fromPackageId: manifestResponse.package.id,
      toPackageId: (exported.body.package as { id: string }).id
    });

    assert.equal(manifestResponse.package.name, "auth-debugging");
    assert.equal(manifestResponse.package.checksum.startsWith("sha256:"), true);
    assert.equal(packages.packages.some((manifest) => manifest.name === "auth-debugging"), true);
    assert.equal(dryRun.statusCode, 400);
    assert.equal(((dryRun.body.importResult as Record<string, unknown>).dryRun), true);
    assert.equal(exported.statusCode, 201);
    assert.equal(listedAfterExport.packages.some((manifest) => manifest.name === "api-bundle"), true);
    assert.equal(diff.statusCode, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

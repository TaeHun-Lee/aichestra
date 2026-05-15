# Phase 3 Packaging & Versioning v3

## What v3 Adds Over v2

Phase 3 v2 made registry changes traceable, reviewable, reversible, and authorization-aware through repository boundaries, stable DTOs, audit logs, history, rollback, approval queue read models, local eval result attachment, checksum gates, and mock mutation RBAC.

Phase 3 v3 adds local-only registry packaging and versioning:

- Registry package manifests for Skills, Harnesses, Instructions, and bundles.
- Deterministic manifest checksums.
- Local JSON import/export with dry-run validation.
- Simple semver range resolution v0.
- Registry dependency metadata and dependency-aware resolver warnings/errors.
- Structural package diff summaries.
- API and dashboard visibility for package manifests, version resolution, and diffs.

This is still mock-first. It does not add a real artifact registry, signed artifacts, hosted package publishing, or external network calls.

Registry/Governance RequestContext Migration v1 later adds optional RequestContext/AuthContext attribution to migrated registry mutation, package, resolver, audit, revision, and eval-result paths without changing package safety gates.

## Package Manifest Model

`RegistryPackageManifest` references registry objects without replacing them.

Fields:

- `id`
- `packageKind`: `skill`, `harness`, `instruction`, or `bundle`
- `name`
- `version`
- `description`
- `owner`
- `manifestVersion`
- `entries`
- `dependencies`
- `checksum`
- `checksumAlgorithm`
- `createdAt`
- `createdBy`
- `tags`
- `metadata`

`RegistryPackageEntry` points at a Skill, Harness, or Instruction by `kind`, `id`, `name`, `version`, optional `checksum`, and `required`.

`RegistryPackageDependency` describes local registry dependencies by `kind`, `name`, `versionRange`, and `optional`.

Bundle manifests group multiple registry entries. They are local JSON documents, not remote artifacts.

## Import And Export

v3 supports local-only package import/export through the registry service and API.

Export behavior:

- Exports a single Skill, Harness, or Instruction manifest by target id.
- Exports bundle manifests from existing active registry entries.
- Includes deterministic checksum metadata.
- May include local metadata snapshots for import use.

Import behavior:

- Accepts local JSON payloads only.
- Validates manifest shape, entries, checksums, and supported kinds.
- Detects duplicate name/version conflicts.
- Supports `create_only` import mode.
- Supports `replace_draft_only` import mode for draft registry entries.
- Creates audit logs and registry revisions for real mutations.
- Does not contact remote registries or package services.

Dry-run import:

- Uses the same validation as real import.
- Returns deterministic warnings/errors.
- Does not mutate registry state, audit logs, package manifests, or revisions.

## Semver Range Resolution v0

Exact version pinning remains supported. v3 adds simple deterministic range matching:

- Exact versions, such as `1.0.0`.
- Caret ranges, such as `^1.0.0`.
- Tilde ranges, such as `~1.2.0`.
- Major wildcards, such as `1.x`.
- `latest`, resolved as the highest selectable compatible version.

The resolver selects the highest compatible active version that also passes lifecycle, approval, eval, and checksum gates.

Entries are excluded by default when they are:

- `draft`
- `deprecated`
- `archived`
- approval pending or rejected
- eval pending or failed
- instruction checksum mismatch

If no selectable version satisfies a requested range, the resolver returns deterministic warnings or errors.

## Dependency Metadata

Skills, Harnesses, and Instructions may declare registry dependencies. v3 dependency handling is intentionally simple:

- Required dependencies that cannot be selected produce resolver errors.
- Optional dependencies that cannot be selected produce resolver warnings.
- Deprecated, rejected, eval-failed, archived, or checksum-mismatched dependencies are not selected by default.
- Circular dependency references are detected and reported deterministically.

This is not a full package manager.

## Package Diff

`RegistryPackageDiff` compares two package manifests by structural entries.

It reports:

- added entries
- removed entries
- changed entries
- unchanged entries
- deterministic summary text

The diff is deterministic and does not use LLM summarization.

## Audit And History Integration

Package import connects to the existing v2 audit/history foundation:

- Real imports append audit log entries.
- Imported registry entries create revisions.
- Replaced draft entries create new revisions instead of deleting history.
- Rollback continues to restore prior registry snapshots by creating a new revision.
- Dry-run imports do not create audit logs or revisions.

Package manifest persistence itself is local and repository-backed. It is not a real artifact registry.

## API Endpoints

Package endpoints:

- `GET /registry/packages`
- `GET /registry/packages/:id`
- `POST /registry/packages/export`
- `POST /registry/packages/import`
- `POST /registry/packages/import/dry-run`
- `POST /registry/packages/diff`
- `POST /registry/import`

Convenience manifest endpoints:

- `GET /registry/bundle/manifest`
- `GET /registry/skills/:id/manifest`
- `GET /registry/harnesses/:id/manifest`
- `GET /registry/instructions/:id/manifest`

Existing registry v0, v1, and v2 APIs remain available.

## Dashboard Changes

The dashboard now surfaces:

- package manifest counts and entries
- selected version range resolution
- package diff summary
- registry package metadata beside existing registry, approval, eval, checksum, audit, and history views

The dashboard remains a simple MVP read model.

## Test Strategy

v3 tests cover:

- Skill, Harness, Instruction, and bundle manifest creation.
- Deterministic manifest checksums.
- Manifest validation failures.
- Local import/export behavior.
- Dry-run import non-mutation.
- Duplicate name/version conflict detection.
- Audit and revision creation during import.
- Exact, caret, tilde, wildcard, and latest version resolution.
- Exclusion of deprecated, archived, rejected, eval-failed, and checksum-mismatched entries.
- Required, optional, and circular dependency handling.
- Package diff added, removed, changed, and unchanged entries.
- API package endpoints.
- Dashboard assumptions.
- Phase 1, Phase 2, and Phase 3 regression behavior.

## Known Limitations

- No signed artifacts.
- No real artifact registry integration.
- No artifact provenance or SBOM.
- No package publishing workflow.
- No full dependency solver.
- No semver prerelease/build metadata support.
- No remote import source.
- No production auth/RBAC.
- Policy-as-code remains static/mock-first and deny-by-default.
- No eval suite execution.
- No automatic registry improvement loop.

## Next Recommended Task

Recommended next task: Dashboard/Readiness Tenant Scope Planning v1, or Tenant Scope Enforcement v1.

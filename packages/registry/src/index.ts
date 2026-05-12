import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createId, seedHarnesses, seedInstructions, seedRepos, seedSkills } from "@aichestra/core";
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject
} from "@aichestra/policy";
import type { PolicyAction } from "@aichestra/policy";
import type {
  AgentKind,
  ApprovalStatus,
  ChecksumAlgorithm,
  ChecksumStatus,
  EvalStatus,
  HarnessPackage,
  InstructionArtifact,
  RegistryAuditAction,
  RegistryAuditLogEntry,
  RegistryActor,
  RegistryApprovalQueueItem,
  RegistryDependency,
  RegistryEvalResult,
  RegistryEvalResultSource,
  RegistryEvalResultStatus,
  RegistryEvalResultType,
  RegistryKind,
  RegistryPackageDependency,
  RegistryPackageDiff,
  RegistryPackageDiffEntry,
  RegistryPackageEntry,
  RegistryPackageKind,
  RegistryPackageManifest,
  RegistryPermission,
  RegistryResolution,
  RegistryRevision,
  RegistryRole,
  RegistryRollbackRequest,
  RegistryRollbackResult,
  RegistryStatus,
  RegistryVersionRef,
  Repo,
  RiskLevel,
  SkillPackage,
  Task
} from "@aichestra/core";

export type RegistrySnapshot = {
  skills: SkillPackage[];
  harnesses: HarnessPackage[];
  instructions: InstructionArtifact[];
  auditLogs?: RegistryAuditLogEntry[];
  revisions?: RegistryRevision[];
  evalResults?: RegistryEvalResult[];
  packageManifests?: RegistryPackageManifest[];
};

export type CreateSkillPackageInput = Omit<SkillPackage, "id" | "createdAt" | "updatedAt" | "approvalStatus" | "evalStatus"> &
  Partial<Pick<SkillPackage, "id" | "createdAt" | "updatedAt" | "approvalStatus" | "evalStatus">>;

export type CreateHarnessDefinitionInput = Omit<HarnessPackage, "id" | "createdAt" | "updatedAt" | "approvalStatus" | "evalStatus"> &
  Partial<Pick<HarnessPackage, "id" | "createdAt" | "updatedAt" | "approvalStatus" | "evalStatus">>;

export type CreateInstructionArtifactInput = Omit<
  InstructionArtifact,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "approvalStatus"
  | "evalStatus"
  | "checksumAlgorithm"
  | "checksumStatus"
  | "checksumVerifiedAt"
> &
  Partial<
    Pick<
      InstructionArtifact,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "approvalStatus"
      | "evalStatus"
      | "checksumAlgorithm"
      | "checksumStatus"
      | "checksumVerifiedAt"
    >
  >;

export type ResolveRegistryContextInput = {
  task: Task;
  agent: AgentKind;
  repo?: Repo;
  skills: SkillPackage[];
  harnesses: HarnessPackage[];
  instructions: InstructionArtifact[];
};

export type RegistryServiceInput = {
  skillRepository: SkillRegistryRepository;
  harnessRepository: HarnessRegistryRepository;
  instructionRepository: InstructionRegistryRepository;
  auditRepository: RegistryAuditRepository;
  historyRepository?: RegistryHistoryRepository;
  evalResultRepository?: RegistryEvalResultRepository;
  packageRepository?: RegistryPackageRepository;
  authorizer?: RegistryMutationAuthorizer;
  defaultActorId?: string;
  defaultActor?: RegistryActor;
  repoRoot?: string;
};

export type RegistryAuditInput = Omit<RegistryAuditLogEntry, "id" | "createdAt">;

export type RegistryStatusUpdateInput = {
  status: RegistryStatus;
  actorId?: string;
  actor?: RegistryActor;
  reason?: string;
};

export type RegistryApprovalUpdateInput = {
  approvalStatus: ApprovalStatus;
  actorId?: string;
  actor?: RegistryActor;
  reason?: string;
};

export type RegistryEvalUpdateInput = {
  evalStatus: EvalStatus;
  actorId?: string;
  actor?: RegistryActor;
  reason?: string;
};

export type VerifyInstructionChecksumInput = {
  actorId?: string;
  actor?: RegistryActor;
  repoRoot?: string;
  reason?: string;
};

export type RegistryRollbackServiceInput = Omit<RegistryRollbackRequest, "actorId"> & {
  actor?: RegistryActor;
  actorId?: string;
};

export type RegistryApprovalQueueFilter = {
  targetKind?: RegistryKind;
  approvalStatus?: ApprovalStatus;
  owner?: string;
  includeArchived?: boolean;
};

export type RegistryEvalResultInput = {
  evalName: string;
  evalType: RegistryEvalResultType;
  status: RegistryEvalResultStatus;
  score?: number;
  maxScore?: number;
  summary: string;
  details?: string;
  attachedBy?: string;
  source: RegistryEvalResultSource;
  artifactRef?: string;
  updateEvalStatus?: boolean;
  actor?: RegistryActor;
  actorId?: string;
  reason?: string;
};

export type RegistryPackageExportInput = {
  packageKind: RegistryPackageKind;
  targetId?: string;
  entryRefs?: Array<{ kind: RegistryKind; id: string; required?: boolean }>;
  name?: string;
  version?: string;
  description?: string;
  owner?: string;
  createdBy?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export type RegistryPackageImportMode = "create_only" | "replace_draft_only";

export type RegistryPackageImportInput = {
  manifest: RegistryPackageManifest;
  importMode?: RegistryPackageImportMode;
  dryRun?: boolean;
  actor?: RegistryActor;
  actorId?: string;
  reason?: string;
};

export type RegistryPackageImportResult = {
  dryRun: boolean;
  imported: boolean;
  manifest: RegistryPackageManifest;
  createdEntries: RegistryVersionRef[];
  replacedEntries: RegistryVersionRef[];
  skippedEntries: RegistryVersionRef[];
  warnings: string[];
  errors: string[];
  auditLogIds: string[];
  revisionIds: string[];
};

export type RegistryVersionResolution = {
  kind: RegistryKind;
  name: string;
  requestedRange: string;
  selected?: RegistryVersionRef;
  warnings: string[];
  errors: string[];
};

export type SkillRegistryRepository = {
  listSkills(): SkillPackage[];
  getSkillById(id: string): SkillPackage | undefined;
  getSkillByNameVersion(name: string, version: string): SkillPackage | undefined;
  createSkill(input: SkillPackage): SkillPackage;
  updateSkill(id: string, patch: Partial<SkillPackage>): SkillPackage;
  updateSkillStatus(id: string, status: RegistryStatus): SkillPackage;
};

export type HarnessRegistryRepository = {
  listHarnesses(): HarnessPackage[];
  getHarnessById(id: string): HarnessPackage | undefined;
  getHarnessByNameVersion(name: string, version: string): HarnessPackage | undefined;
  createHarness(input: HarnessPackage): HarnessPackage;
  updateHarness(id: string, patch: Partial<HarnessPackage>): HarnessPackage;
  updateHarnessStatus(id: string, status: RegistryStatus): HarnessPackage;
};

export type InstructionRegistryRepository = {
  listInstructions(): InstructionArtifact[];
  getInstructionById(id: string): InstructionArtifact | undefined;
  getInstructionByNameVersion(name: string, version: string): InstructionArtifact | undefined;
  createInstruction(input: InstructionArtifact): InstructionArtifact;
  updateInstruction(id: string, patch: Partial<InstructionArtifact>): InstructionArtifact;
  updateInstructionStatus(id: string, status: RegistryStatus): InstructionArtifact;
};

export type RegistryAuditRepository = {
  appendAuditLog(input: RegistryAuditInput): RegistryAuditLogEntry;
  listAuditLogs(): RegistryAuditLogEntry[];
  listAuditLogsForTarget(targetKind: RegistryKind, targetId: string): RegistryAuditLogEntry[];
};

export type RegistryHistoryInput = Omit<RegistryRevision, "id" | "createdAt">;

export type RegistryHistoryRepository = {
  appendRevision(input: RegistryHistoryInput): RegistryRevision;
  listRevisionsForTarget(targetKind: RegistryKind, targetId: string): RegistryRevision[];
  getRevision(id: string): RegistryRevision | undefined;
  getLatestRevisionForTarget(targetKind: RegistryKind, targetId: string): RegistryRevision | undefined;
};

export type RegistryEvalResultInputRecord = Omit<RegistryEvalResult, "id" | "attachedAt">;

export type RegistryEvalResultRepository = {
  appendEvalResult(input: RegistryEvalResultInputRecord): RegistryEvalResult;
  listEvalResultsForTarget(targetKind: RegistryKind, targetId: string): RegistryEvalResult[];
  getLatestEvalResultForTarget(targetKind: RegistryKind, targetId: string): RegistryEvalResult | undefined;
};

export type RegistryPackageRepository = {
  createPackageManifest(input: RegistryPackageManifest): RegistryPackageManifest;
  listPackageManifests(): RegistryPackageManifest[];
  getPackageManifestById(id: string): RegistryPackageManifest | undefined;
  getPackageManifestByNameVersion(name: string, version: string): RegistryPackageManifest | undefined;
};

export type RegistryMutationTarget = {
  targetKind?: RegistryKind;
  targetId?: string;
};

export type RegistryMutationAuthorizer = {
  authorize(actor: RegistryActor, permission: RegistryPermission, target?: RegistryMutationTarget): {
    allowed: boolean;
    reason: string;
    requiredPermission: RegistryPermission;
    actorId: string;
    targetKind?: RegistryKind;
    targetId?: string;
  };
};

export type SkillRegistry = {
  listSkills(): SkillPackage[];
  getSkill(id: string): SkillPackage | undefined;
  createSkill(input: CreateSkillPackageInput): SkillPackage;
  updateSkillStatus(id: string, status: RegistryStatus): SkillPackage;
  resolveSkillsForTask(input: ResolveRegistryContextInput): RegistryVersionRef[];
};

export type HarnessRegistry = {
  listHarnesses(): HarnessPackage[];
  getHarness(id: string): HarnessPackage | undefined;
  createHarness(input: CreateHarnessDefinitionInput): HarnessPackage;
  updateHarnessStatus(id: string, status: RegistryStatus): HarnessPackage;
  resolveHarnessForTask(input: ResolveRegistryContextInput): RegistryVersionRef;
};

export type InstructionRegistry = {
  listInstructions(): InstructionArtifact[];
  getInstruction(id: string): InstructionArtifact | undefined;
  createInstruction(input: CreateInstructionArtifactInput): InstructionArtifact;
  updateInstructionStatus(id: string, status: RegistryStatus): InstructionArtifact;
  resolveInstructionsForTask(input: ResolveRegistryContextInput): RegistryVersionRef[];
};

export type RegistryResolver = {
  resolveRegistryContextForTask(input: ResolveRegistryContextInput): RegistryResolution;
};

export type SkillDto = {
  id: string;
  name: string;
  version: string;
  description: string;
  status: RegistryStatus;
  approvalStatus: ApprovalStatus;
  evalStatus: EvalStatus;
  owner: string;
  compatibleAgents: AgentKind[];
  compatibleModels?: string[];
  requiredTools: string[];
  requiredHarnesses: string[];
  invocationRules: string[];
  instructionRef?: RegistryVersionRef;
  evalRefs: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type HarnessDto = {
  id: string;
  name: string;
  version: string;
  description: string;
  status: RegistryStatus;
  approvalStatus: ApprovalStatus;
  evalStatus: EvalStatus;
  owner: string;
  runtimeType: HarnessPackage["runtimeType"];
  runtimeImage?: string;
  allowedTools: string[];
  allowedMcpServers: string[];
  secretScopes: string[];
  networkPolicy: HarnessPackage["networkPolicy"];
  testCommands: string[];
  compatibleAgents: AgentKind[];
  instructionLoadingPolicy: HarnessPackage["instructionLoadingPolicy"];
  createdAt: string;
  updatedAt: string;
};

export type InstructionArtifactDto = {
  id: string;
  name: string;
  version: string;
  description: string;
  status: RegistryStatus;
  approvalStatus: ApprovalStatus;
  evalStatus: EvalStatus;
  owner: string;
  type: InstructionArtifact["type"];
  scope: InstructionArtifact["scope"];
  path?: string;
  checksum: string;
  checksumAlgorithm: ChecksumAlgorithm;
  checksumStatus: ChecksumStatus;
  checksumVerifiedAt?: string;
  precedence: number;
  appliesToAgents: AgentKind[];
  appliesToRepos: string[];
  appliesToDirectories: string[];
  maxContextBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type RegistryResolutionDto = {
  selectedSkills: RegistryVersionRef[];
  selectedHarness: RegistryVersionRef;
  selectedInstructions: RegistryVersionRef[];
  warnings: string[];
  errors: string[];
  resolvedAt: string;
};

export type RegistryAuditLogDto = {
  id: string;
  actorId: string;
  action: RegistryAuditAction;
  targetKind: RegistryKind;
  targetId: string;
  targetName: string;
  targetVersion: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  createdAt: string;
};

export type RegistryRevisionDto = {
  id: string;
  targetKind: RegistryKind;
  targetId: string;
  targetName: string;
  targetVersion: string;
  revisionNumber: number;
  snapshot: Record<string, unknown>;
  snapshotChecksum: string;
  changeReason?: string;
  createdBy: string;
  createdAt: string;
  sourceAuditLogId?: string;
};

export type RegistryRollbackRequestDto = {
  targetKind?: RegistryKind;
  targetRevisionId?: string;
  revisionNumber?: number;
  reason?: string;
};

export type RegistryRollbackResultDto = {
  targetKind: RegistryKind;
  targetId: string;
  rolledBackFromRevision: RegistryRevisionDto;
  rolledBackToRevision: RegistryRevisionDto;
  newRevision: RegistryRevisionDto;
  auditLogId: string;
  createdAt: string;
};

export type RegistryApprovalQueueItemDto = {
  id: string;
  targetKind: RegistryKind;
  targetId: string;
  targetName: string;
  targetVersion: string;
  approvalStatus: ApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  reason?: string;
  currentStatus: RegistryStatus;
  evalStatus: EvalStatus;
  checksumStatus?: ChecksumStatus;
  blockingReasons: string[];
  recommendedAction: string;
};

export type RegistryEvalResultDto = {
  id: string;
  targetKind: RegistryKind;
  targetId: string;
  targetName: string;
  targetVersion: string;
  evalName: string;
  evalType: RegistryEvalResultType;
  status: RegistryEvalResultStatus;
  score?: number;
  maxScore?: number;
  summary: string;
  details?: string;
  attachedBy: string;
  attachedAt: string;
  source: RegistryEvalResultSource;
  artifactRef?: string;
};

export type RegistryActorDto = {
  id: string;
  displayName: string;
  roles: RegistryRole[];
  teams?: string[];
};

export type MutationAuthorizationDecisionDto = {
  allowed: boolean;
  reason: string;
  requiredPermission: RegistryPermission;
  actorId: string;
  targetKind?: RegistryKind;
  targetId?: string;
};

export type RegistryDependencyDto = RegistryDependency;
export type RegistryPackageManifestDto = Omit<RegistryPackageManifest, "createdAt"> & { createdAt: string };
export type RegistryImportRequestDto = {
  manifest?: RegistryPackageManifestDto | RegistryPackageManifest;
  importMode?: RegistryPackageImportMode;
  dryRun?: boolean;
  reason?: string;
};
export type RegistryImportResultDto = Omit<RegistryPackageImportResult, "manifest"> & {
  manifest: RegistryPackageManifestDto;
};
export type RegistryPackageDiffDto = RegistryPackageDiff;
export type RegistryVersionResolutionDto = RegistryVersionResolution;

export type RegistryCreateSkillRequest = CreateSkillPackageInput;
export type RegistryCreateHarnessRequest = CreateHarnessDefinitionInput;
export type RegistryCreateInstructionRequest = CreateInstructionArtifactInput;
export type RegistryStatusUpdateRequest = { status: RegistryStatus; reason?: string };
export type RegistryCreateEvalResultRequest = Omit<RegistryEvalResultInput, "actor" | "actorId" | "attachedBy"> & {
  attachedBy?: string;
};

const registryStatuses = new Set<RegistryStatus>(["draft", "active", "deprecated", "archived"]);
const approvalStatuses = new Set<ApprovalStatus>(["not_required", "pending", "approved", "rejected"]);
const evalStatuses = new Set<EvalStatus>(["not_required", "pending", "passed", "failed"]);
const registryKinds = new Set<RegistryKind>(["skill", "harness", "instruction"]);
const registryPackageKinds = new Set<RegistryPackageKind>(["skill", "harness", "instruction", "bundle"]);
const evalResultStatuses = new Set<RegistryEvalResultStatus>(["passed", "failed", "pending", "skipped"]);
const evalResultTypes = new Set<RegistryEvalResultType>(["local", "manual", "mock"]);
const evalResultSources = new Set<RegistryEvalResultSource>(["local_fixture", "manual", "mock"]);

function cloneDate(value: Date | string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) return new Date(value);
  return new Date(value);
}

function cloneSkill(skill: SkillPackage): SkillPackage {
  return {
    ...skill,
    createdAt: new Date(skill.createdAt),
    updatedAt: new Date(skill.updatedAt)
  };
}

function cloneHarness(harness: HarnessPackage): HarnessPackage {
  return {
    ...harness,
    createdAt: new Date(harness.createdAt),
    updatedAt: new Date(harness.updatedAt)
  };
}

function cloneInstruction(instruction: InstructionArtifact): InstructionArtifact {
  return {
    ...instruction,
    checksumVerifiedAt: cloneDate(instruction.checksumVerifiedAt),
    createdAt: new Date(instruction.createdAt),
    updatedAt: new Date(instruction.updatedAt)
  };
}

function cloneAuditLog(log: RegistryAuditLogEntry): RegistryAuditLogEntry {
  return {
    ...log,
    createdAt: new Date(log.createdAt)
  };
}

function cloneRevision(revision: RegistryRevision): RegistryRevision {
  return {
    ...revision,
    snapshot: structuredClone(revision.snapshot),
    createdAt: new Date(revision.createdAt)
  };
}

function cloneEvalResult(result: RegistryEvalResult): RegistryEvalResult {
  return {
    ...result,
    attachedAt: new Date(result.attachedAt)
  };
}

function clonePackageManifest(manifest: RegistryPackageManifest): RegistryPackageManifest {
  return {
    ...manifest,
    entries: manifest.entries.map((entry) => ({ ...entry })),
    dependencies: manifest.dependencies.map((dependency) => ({ ...dependency })),
    createdAt: new Date(manifest.createdAt),
    tags: [...manifest.tags],
    metadata: structuredClone(manifest.metadata)
  };
}

function copySnapshot(snapshot: RegistrySnapshot): Required<RegistrySnapshot> {
  return {
    skills: snapshot.skills.map(cloneSkill),
    harnesses: snapshot.harnesses.map(cloneHarness),
    instructions: snapshot.instructions.map(cloneInstruction),
    auditLogs: (snapshot.auditLogs ?? []).map(cloneAuditLog),
    revisions: (snapshot.revisions ?? []).map(cloneRevision),
    evalResults: (snapshot.evalResults ?? []).map(cloneEvalResult),
    packageManifests: (snapshot.packageManifests ?? []).map(clonePackageManifest)
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value;
}

function requireDate(value: unknown, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${field} must be a Date`);
  }
  return value;
}

export function isRegistryStatus(value: unknown): value is RegistryStatus {
  return typeof value === "string" && registryStatuses.has(value as RegistryStatus);
}

export function isApprovalStatus(value: unknown): value is ApprovalStatus {
  return typeof value === "string" && approvalStatuses.has(value as ApprovalStatus);
}

export function isEvalStatus(value: unknown): value is EvalStatus {
  return typeof value === "string" && evalStatuses.has(value as EvalStatus);
}

export function isRegistryKind(value: unknown): value is RegistryKind {
  return typeof value === "string" && registryKinds.has(value as RegistryKind);
}

export function isRegistryPackageKind(value: unknown): value is RegistryPackageKind {
  return typeof value === "string" && registryPackageKinds.has(value === "registry_bundle" ? "bundle" : value as RegistryPackageKind);
}

export function isRegistryEvalResultStatus(value: unknown): value is RegistryEvalResultStatus {
  return typeof value === "string" && evalResultStatuses.has(value as RegistryEvalResultStatus);
}

export function isRegistryEvalResultType(value: unknown): value is RegistryEvalResultType {
  return typeof value === "string" && evalResultTypes.has(value as RegistryEvalResultType);
}

export function isRegistryEvalResultSource(value: unknown): value is RegistryEvalResultSource {
  return typeof value === "string" && evalResultSources.has(value as RegistryEvalResultSource);
}

function assertRegistryStatus(value: unknown, field: string): RegistryStatus {
  if (!isRegistryStatus(value)) {
    throw new Error(`${field} must be draft, active, deprecated, or archived`);
  }
  return value;
}

function assertApprovalStatus(value: unknown, field: string): ApprovalStatus {
  if (!isApprovalStatus(value)) {
    throw new Error(`${field} must be not_required, pending, approved, or rejected`);
  }
  return value;
}

function assertEvalStatus(value: unknown, field: string): EvalStatus {
  if (!isEvalStatus(value)) {
    throw new Error(`${field} must be not_required, pending, passed, or failed`);
  }
  return value;
}

function assertRegistryKind(value: unknown, field: string): RegistryKind {
  if (!isRegistryKind(value)) {
    throw new Error(`${field} must be skill, harness, or instruction`);
  }
  return value;
}

function normalizePackageKind(value: unknown): RegistryPackageKind {
  if (value === "registry_bundle") return "bundle";
  if (!isRegistryPackageKind(value)) {
    throw new Error("packageKind must be skill, harness, instruction, or bundle");
  }
  return value;
}

function assertRegistryEvalResultStatus(value: unknown, field: string): RegistryEvalResultStatus {
  if (!isRegistryEvalResultStatus(value)) {
    throw new Error(`${field} must be passed, failed, pending, or skipped`);
  }
  return value;
}

function assertRegistryEvalResultType(value: unknown, field: string): RegistryEvalResultType {
  if (!isRegistryEvalResultType(value)) {
    throw new Error(`${field} must be local, manual, or mock`);
  }
  return value;
}

function assertRegistryEvalResultSource(value: unknown, field: string): RegistryEvalResultSource {
  if (!isRegistryEvalResultSource(value)) {
    throw new Error(`${field} must be local_fixture, manual, or mock`);
  }
  return value;
}

function nowOrDate(value: Date | undefined): Date {
  return value ?? new Date();
}

function toIso(date: Date | undefined): string | undefined {
  return date?.toISOString();
}

function registryEntitySnapshot(entry: { id: string; name: string; version: string; status?: string; approvalStatus?: string; evalStatus?: string }): Record<string, unknown> {
  return {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    status: entry.status,
    approvalStatus: entry.approvalStatus,
    evalStatus: entry.evalStatus
  };
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

function registryEntityFullSnapshot(entry: SkillPackage | HarnessPackage | InstructionArtifact | RegistryPackageManifest): Record<string, unknown> {
  return JSON.parse(JSON.stringify(entry)) as Record<string, unknown>;
}

function registrySnapshotChecksum(snapshot: Record<string, unknown>): string {
  return sha256Checksum(stableSerialize(snapshot));
}

type ParsedSemver = { major: number; minor: number; patch: number };

function parseSemver(version: string): ParsedSemver | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareSemver(left: string, right: string): number {
  const parsedLeft = parseSemver(left);
  const parsedRight = parseSemver(right);
  if (!parsedLeft || !parsedRight) return left.localeCompare(right);
  return parsedLeft.major - parsedRight.major || parsedLeft.minor - parsedRight.minor || parsedLeft.patch - parsedRight.patch;
}

export function isSupportedVersionRange(range: string): boolean {
  const value = range.trim();
  if (value === "latest") return true;
  if (/^\d+\.x$/.test(value)) return true;
  if (/^[\^~]?\d+\.\d+\.\d+$/.test(value)) return true;
  return false;
}

export function versionSatisfiesRange(version: string, range: string): boolean {
  const candidate = parseSemver(version);
  const value = range.trim();
  if (!candidate) return version === value;
  if (value === "latest") return true;
  if (/^\d+\.\d+\.\d+$/.test(value)) return version === value;
  if (/^\d+\.x$/.test(value)) return candidate.major === Number(value.split(".")[0]);
  if (value.startsWith("^")) {
    const base = parseSemver(value.slice(1));
    return base !== undefined && candidate.major === base.major && compareSemver(version, value.slice(1)) >= 0;
  }
  if (value.startsWith("~")) {
    const base = parseSemver(value.slice(1));
    return base !== undefined && candidate.major === base.major && candidate.minor === base.minor && compareSemver(version, value.slice(1)) >= 0;
  }
  return false;
}

function highestCompatible<T extends { name: string; version: string }>(entries: T[], versionRange: string): T | undefined {
  return entries
    .filter((entry) => versionSatisfiesRange(entry.version, versionRange))
    .sort((left, right) => compareSemver(right.version, left.version) || left.name.localeCompare(right.name))
    .at(0);
}

function dependencyKey(dependency: RegistryDependency): string {
  return `${dependency.kind}:${dependency.name}`;
}

function normalizeDependencies(value: unknown, field: string): RegistryDependency[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value.map((entry, index) => {
    const record = entry as Partial<RegistryDependency>;
    return {
      kind: assertRegistryKind(record.kind, `${field}[${index}].kind`),
      name: requireString(record.name, `${field}[${index}].name`),
      versionRange: requireString(record.versionRange, `${field}[${index}].versionRange`),
      required: record.required ?? true,
      reason: record.reason
    };
  });
}

export function registryRefFromSkill(skill: SkillPackage): RegistryVersionRef {
  return {
    kind: "skill",
    id: skill.id,
    name: skill.name,
    version: skill.version
  };
}

export function registryRefFromHarness(harness: HarnessPackage): RegistryVersionRef {
  return {
    kind: "harness",
    id: harness.id,
    name: harness.name,
    version: harness.version
  };
}

export function registryRefFromInstruction(instruction: InstructionArtifact): RegistryVersionRef {
  return {
    kind: "instruction",
    id: instruction.id,
    name: instruction.name,
    version: instruction.version,
    checksum: instruction.checksum
  };
}

export function registryRefLabel(ref: RegistryVersionRef): string {
  return `${ref.name}@${ref.version}`;
}

export function createSkillPackage(input: CreateSkillPackageInput): SkillPackage {
  const createdAt = nowOrDate(input.createdAt);
  const skill: SkillPackage = {
    ...input,
    id: input.id ?? createId("skill"),
    name: requireString(input.name, "skill.name"),
    version: requireString(input.version, "skill.version"),
    description: requireString(input.description, "skill.description"),
    status: assertRegistryStatus(input.status, "skill.status"),
    approvalStatus: assertApprovalStatus(input.approvalStatus ?? "not_required", "skill.approvalStatus"),
    evalStatus: assertEvalStatus(input.evalStatus ?? "not_required", "skill.evalStatus"),
    owner: requireString(input.owner, "skill.owner"),
    compatibleAgents: input.compatibleAgents,
    compatibleModels: input.compatibleModels,
    requiredTools: requireStringArray(input.requiredTools, "skill.requiredTools"),
    requiredHarnesses: requireStringArray(input.requiredHarnesses, "skill.requiredHarnesses"),
    invocationRules: requireStringArray(input.invocationRules, "skill.invocationRules"),
    instructionRef: input.instructionRef,
    instructionBody: input.instructionBody,
    evalRefs: requireStringArray(input.evalRefs, "skill.evalRefs"),
    dependencies: normalizeDependencies(input.dependencies, "skill.dependencies"),
    tags: requireStringArray(input.tags, "skill.tags"),
    createdAt,
    updatedAt: nowOrDate(input.updatedAt ?? createdAt)
  };
  if (!Array.isArray(skill.compatibleAgents) || skill.compatibleAgents.length === 0) {
    throw new Error("skill.compatibleAgents must include at least one agent");
  }
  return skill;
}

export function createHarnessDefinition(input: CreateHarnessDefinitionInput): HarnessPackage {
  const createdAt = nowOrDate(input.createdAt);
  const harness: HarnessPackage = {
    ...input,
    id: input.id ?? createId("harness"),
    name: requireString(input.name, "harness.name"),
    version: requireString(input.version, "harness.version"),
    description: requireString(input.description, "harness.description"),
    status: assertRegistryStatus(input.status, "harness.status"),
    approvalStatus: assertApprovalStatus(input.approvalStatus ?? "not_required", "harness.approvalStatus"),
    evalStatus: assertEvalStatus(input.evalStatus ?? "not_required", "harness.evalStatus"),
    owner: requireString(input.owner, "harness.owner"),
    runtimeType: input.runtimeType,
    runtimeImage: input.runtimeImage,
    allowedTools: requireStringArray(input.allowedTools, "harness.allowedTools"),
    allowedMcpServers: requireStringArray(input.allowedMcpServers, "harness.allowedMcpServers"),
    secretScopes: requireStringArray(input.secretScopes, "harness.secretScopes"),
    networkPolicy: input.networkPolicy,
    testCommands: requireStringArray(input.testCommands, "harness.testCommands"),
    dependencies: normalizeDependencies(input.dependencies, "harness.dependencies"),
    compatibleAgents: input.compatibleAgents,
    instructionLoadingPolicy: input.instructionLoadingPolicy,
    createdAt,
    updatedAt: nowOrDate(input.updatedAt ?? createdAt)
  };
  if (!["docker", "kubernetes", "firecracker", "local"].includes(harness.runtimeType)) {
    throw new Error("harness.runtimeType is unsupported");
  }
  if (!harness.networkPolicy || !isNetworkPolicyMode(harness.networkPolicy.mode)) {
    throw new Error("harness.networkPolicy.mode is unsupported");
  }
  if (!Array.isArray(harness.compatibleAgents) || harness.compatibleAgents.length === 0) {
    throw new Error("harness.compatibleAgents must include at least one agent");
  }
  if (!harness.instructionLoadingPolicy) {
    throw new Error("harness.instructionLoadingPolicy is required");
  }
  return harness;
}

function isNetworkPolicyMode(value: unknown): boolean {
  return value === "disabled" || value === "allowlist" || value === "unrestricted";
}

export function createInstructionArtifact(input: CreateInstructionArtifactInput): InstructionArtifact {
  const createdAt = nowOrDate(input.createdAt);
  const instruction: InstructionArtifact = {
    ...input,
    id: input.id ?? createId("instr"),
    name: requireString(input.name, "instruction.name"),
    version: requireString(input.version, "instruction.version"),
    description: requireString(input.description, "instruction.description"),
    status: assertRegistryStatus(input.status, "instruction.status"),
    approvalStatus: assertApprovalStatus(input.approvalStatus ?? "not_required", "instruction.approvalStatus"),
    evalStatus: assertEvalStatus(input.evalStatus ?? "not_required", "instruction.evalStatus"),
    owner: requireString(input.owner, "instruction.owner"),
    type: input.type,
    scope: input.scope,
    path: input.path,
    body: input.body,
    checksum: requireString(input.checksum, "instruction.checksum"),
    checksumAlgorithm: input.checksumAlgorithm ?? "sha256",
    checksumStatus: input.checksumStatus ?? "unverified",
    checksumVerifiedAt: input.checksumVerifiedAt,
    precedence: input.precedence,
    appliesToAgents: input.appliesToAgents,
    appliesToRepos: requireStringArray(input.appliesToRepos, "instruction.appliesToRepos"),
    appliesToDirectories: requireStringArray(input.appliesToDirectories, "instruction.appliesToDirectories"),
    dependencies: normalizeDependencies(input.dependencies, "instruction.dependencies"),
    maxContextBytes: input.maxContextBytes,
    createdAt,
    updatedAt: nowOrDate(input.updatedAt ?? createdAt)
  };
  if (!Array.isArray(instruction.appliesToAgents) || instruction.appliesToAgents.length === 0) {
    throw new Error("instruction.appliesToAgents must include at least one agent");
  }
  if (!Number.isInteger(instruction.precedence)) {
    throw new Error("instruction.precedence must be an integer");
  }
  if (!Number.isInteger(instruction.maxContextBytes) || instruction.maxContextBytes <= 0) {
    throw new Error("instruction.maxContextBytes must be a positive integer");
  }
  return instruction;
}

export function createDefaultRegistry(): Required<RegistrySnapshot> {
  return copySnapshot({
    skills: seedSkills,
    harnesses: seedHarnesses,
    instructions: seedInstructions,
    auditLogs: [],
    revisions: [],
    evalResults: [],
    packageManifests: []
  });
}

export function findSkill(registry: RegistrySnapshot, id: string): SkillPackage | undefined {
  return registry.skills.find((skill) => skill.id === id);
}

export function findHarness(registry: RegistrySnapshot, id: string): HarnessPackage | undefined {
  return registry.harnesses.find((harness) => harness.id === id);
}

export function findInstruction(registry: RegistrySnapshot, id: string): InstructionArtifact | undefined {
  return registry.instructions.find((instruction) => instruction.id === id);
}

function isSelectableLifecycle<T extends { status: RegistryStatus }>(entry: T): boolean {
  return entry.status === "active";
}

function approvalAllows(entry: { approvalStatus?: ApprovalStatus }): boolean {
  return entry.approvalStatus === undefined || entry.approvalStatus === "not_required" || entry.approvalStatus === "approved";
}

function evalAllows(entry: { evalStatus?: EvalStatus }): boolean {
  return entry.evalStatus === undefined || entry.evalStatus === "not_required" || entry.evalStatus === "passed";
}

function checksumAllows(entry: { checksumStatus?: ChecksumStatus }): boolean {
  return entry.checksumStatus !== "mismatch";
}

function selectableRegistryEntry(entry: SkillPackage | HarnessPackage | InstructionArtifact): boolean {
  return isSelectableLifecycle(entry) && approvalAllows(entry) && evalAllows(entry) && ("checksumStatus" in entry ? checksumAllows(entry) : true);
}

function exclusionWarning(kind: RegistryKind, entry: SkillPackage | HarnessPackage | InstructionArtifact): string | undefined {
  const label = `${entry.name}@${entry.version}`;
  if (entry.status !== "active") return `${kind} ${label} excluded: status is ${entry.status}.`;
  if (!approvalAllows(entry)) return `${kind} ${label} excluded: approvalStatus is ${entry.approvalStatus}.`;
  if (!evalAllows(entry)) return `${kind} ${label} excluded: evalStatus is ${entry.evalStatus}.`;
  if ("checksumStatus" in entry && !checksumAllows(entry)) return `${kind} ${label} excluded: checksumStatus is ${entry.checksumStatus}.`;
  return undefined;
}

function addExclusionWarning(warnings: string[], kind: RegistryKind, entry: SkillPackage | HarnessPackage | InstructionArtifact | undefined): void {
  if (!entry) return;
  const warning = exclusionWarning(kind, entry);
  if (warning && !warnings.includes(warning)) warnings.push(warning);
}

function taskText(task: Task): string {
  return `${task.title} ${task.description ?? ""}`.toLowerCase();
}

function matchesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function findSkillByName(skills: SkillPackage[], name: string): SkillPackage | undefined {
  return highestCompatible(skills.filter((skill) => skill.name === name), "latest");
}

function findSelectableSkill(skills: SkillPackage[], name: string, warnings: string[]): SkillPackage | undefined {
  const sameName = skills.filter((skill) => skill.name === name);
  const skill = highestCompatible(sameName.filter(selectableRegistryEntry), "latest");
  sameName.forEach((entry) => addExclusionWarning(warnings, "skill", entry));
  if (!skill) return undefined;
  return skill;
}

function findHarnessByName(harnesses: HarnessPackage[], name: string): HarnessPackage | undefined {
  return highestCompatible(harnesses.filter((harness) => harness.name === name), "latest");
}

function findSelectableHarness(harnesses: HarnessPackage[], name: string, warnings: string[]): HarnessPackage | undefined {
  const sameName = harnesses.filter((harness) => harness.name === name);
  const harness = highestCompatible(sameName.filter(selectableRegistryEntry), "latest");
  sameName.forEach((entry) => addExclusionWarning(warnings, "harness", entry));
  if (!harness) return undefined;
  return harness;
}

function parseNameVersionRequest(requested: string): { name: string; range: string } | undefined {
  const separator = requested.lastIndexOf("@");
  if (separator <= 0) return undefined;
  return {
    name: requested.slice(0, separator),
    range: requested.slice(separator + 1)
  };
}

function findRequestedSkill(skills: SkillPackage[], requested: string, warnings: string[], errors: string[]): SkillPackage | undefined {
  const byId = skills.find((skill) => skill.id === requested);
  if (byId) return byId;
  const parsed = parseNameVersionRequest(requested);
  if (!parsed) return undefined;
  if (!isSupportedVersionRange(parsed.range)) {
    errors.push(`Requested skill has unsupported version range: ${requested}`);
    return undefined;
  }
  const candidates = skills.filter((skill) => skill.name === parsed.name);
  candidates.forEach((entry) => addExclusionWarning(warnings, "skill", entry));
  const selected = highestCompatible(candidates.filter(selectableRegistryEntry), parsed.range);
  if (!selected && candidates.length > 0) {
    errors.push(`No selectable skill version satisfies ${parsed.name}@${parsed.range}.`);
  }
  return selected;
}

function findRequestedHarness(harnesses: HarnessPackage[], requested: string, warnings: string[], errors: string[]): HarnessPackage | undefined {
  const byId = harnesses.find((harness) => harness.id === requested);
  if (byId) return byId;
  const parsed = parseNameVersionRequest(requested);
  if (!parsed) return undefined;
  if (!isSupportedVersionRange(parsed.range)) {
    errors.push(`Requested harness has unsupported version range: ${requested}`);
    return undefined;
  }
  const candidates = harnesses.filter((harness) => harness.name === parsed.name);
  candidates.forEach((entry) => addExclusionWarning(warnings, "harness", entry));
  const selected = highestCompatible(candidates.filter(selectableRegistryEntry), parsed.range);
  if (!selected && candidates.length > 0) {
    errors.push(`No selectable harness version satisfies ${parsed.name}@${parsed.range}.`);
  }
  return selected;
}

function uniqueById<T extends { id: string }>(entries: T[]): T[] {
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
}

function resolveSkillEntries(input: ResolveRegistryContextInput, warnings: string[], errors: string[]): SkillPackage[] {
  const text = taskText(input.task);
  const requestedSkills = input.task.selectedSkillIds.map((id) => {
    const skill = findRequestedSkill(input.skills, id, warnings, errors);
    if (!skill) {
      if (!errors.some((error) => error.includes(id))) errors.push(`Requested skill was not found: ${id}`);
      return undefined;
    }
    if (!selectableRegistryEntry(skill)) {
      addExclusionWarning(warnings, "skill", skill);
      return undefined;
    }
    return skill;
  }).filter((skill): skill is SkillPackage => skill !== undefined);

  const selected = [...requestedSkills];
  if (matchesAny(text, ["conflict", "merge", "branch lease", "dry-run", "dry run", "queue risk"])) {
    const conflictSkill = findSelectableSkill(input.skills, "conflict-risk-reviewer", warnings);
    if (conflictSkill) {
      selected.push(conflictSkill);
    } else if (!findSkillByName(input.skills, "conflict-risk-reviewer")) {
      warnings.push("Default conflict-risk-reviewer skill is not available.");
    }
  }

  if (selected.length === 0 && matchesAny(text, ["jest", "test", "spec", "failing assertion"])) {
    const testSkill = findSelectableSkill(input.skills, "jest-test-fixer", warnings);
    if (testSkill) selected.push(testSkill);
  }

  if (selected.length === 0 && matchesAny(text, ["auth", "login", "session", "token", "permission"])) {
    const authSkill = findSelectableSkill(input.skills, "auth-debugging", warnings);
    if (authSkill) selected.push(authSkill);
  }

  if (selected.length === 0) {
    const auth = findSelectableSkill(input.skills, "auth-debugging", warnings);
    const fallback = auth ?? highestCompatible(input.skills.filter(selectableRegistryEntry), "latest");
    if (fallback) {
      selected.push(fallback);
    } else {
      errors.push("No selectable skills are registered.");
    }
  }

  return uniqueById(selected);
}

function resolveHarnessEntry(input: ResolveRegistryContextInput, warnings: string[], errors: string[]): HarnessPackage | undefined {
  const text = taskText(input.task);
  if (input.task.selectedHarnessId) {
    const requested = findRequestedHarness(input.harnesses, input.task.selectedHarnessId, warnings, errors);
    if (!requested) {
      if (!errors.some((error) => error.includes(input.task.selectedHarnessId ?? ""))) {
        errors.push(`Requested harness was not found: ${input.task.selectedHarnessId}`);
      }
    } else if (!selectableRegistryEntry(requested)) {
      addExclusionWarning(warnings, "harness", requested);
    } else {
      return requested;
    }
  }

  const desiredName = matchesAny(text, ["frontend", "react", "vite", "component", "dashboard", "ui"])
    ? "frontend-node20"
    : matchesAny(text, ["local git dry-run", "local git dry run", "merge simulation"])
      ? "local-git-dry-run"
      : "backend-node20";
  const desired = findSelectableHarness(input.harnesses, desiredName, warnings);
  if (desired) return desired;

  const fallback = highestCompatible(input.harnesses.filter(selectableRegistryEntry), "latest");
  if (!fallback) {
    errors.push("No selectable harnesses are registered.");
    return undefined;
  }

  warnings.push(`Default harness ${desiredName} is not available; using ${fallback.name}@${fallback.version}.`);
  return fallback;
}

function appliesToRepo(instruction: InstructionArtifact, repo?: Repo): boolean {
  return instruction.appliesToRepos.length === 0 || (repo !== undefined && instruction.appliesToRepos.includes(repo.id));
}

function resolveInstructionEntries(input: ResolveRegistryContextInput, warnings: string[]): InstructionArtifact[] {
  const text = taskText(input.task);
  const selected: InstructionArtifact[] = [];
  input.instructions.forEach((instruction) => addExclusionWarning(warnings, "instruction", instruction));
  const eligibleInstructions = input.instructions
    .filter(selectableRegistryEntry)
    .filter((instruction) => instruction.appliesToAgents.includes(input.agent))
    .filter((instruction) => appliesToRepo(instruction, input.repo));

  const orgBaseline = highestCompatible(eligibleInstructions.filter((instruction) => instruction.name === "org-secure-coding-baseline"), "latest");
  if (orgBaseline) {
    selected.push(orgBaseline);
  } else {
    warnings.push("Default org-secure-coding-baseline instruction is not available.");
  }

  const repoAgents = highestCompatible(eligibleInstructions.filter((instruction) => instruction.name === "repo-agents-md"), "latest");
  if (repoAgents && input.task.repoId) {
    selected.push(repoAgents);
  }

  if (matchesAny(text, ["conflict", "merge", "branch lease", "dry-run", "dry run", "queue risk"])) {
    const conflictGuidance = highestCompatible(eligibleInstructions.filter((instruction) => instruction.name === "conflict-manager-guidance"), "latest");
    if (conflictGuidance) {
      selected.push(conflictGuidance);
    }
  }

  return uniqueById(selected).sort((left, right) => left.precedence - right.precedence || left.name.localeCompare(right.name));
}

function findSelectableDependency(input: ResolveRegistryContextInput, dependency: RegistryDependency, warnings: string[], errors: string[]): SkillPackage | HarnessPackage | InstructionArtifact | undefined {
  if (!isSupportedVersionRange(dependency.versionRange)) {
    errors.push(`Dependency ${dependency.kind} ${dependency.name} has unsupported version range ${dependency.versionRange}.`);
    return undefined;
  }
  const candidates = dependency.kind === "skill"
    ? input.skills.filter((entry) => entry.name === dependency.name)
    : dependency.kind === "harness"
      ? input.harnesses.filter((entry) => entry.name === dependency.name)
      : input.instructions.filter((entry) => entry.name === dependency.name);
  candidates.forEach((entry) => addExclusionWarning(warnings, dependency.kind, entry));
  const selected = highestCompatible(candidates.filter(selectableRegistryEntry), dependency.versionRange);
  if (!selected) {
    const message = `Dependency ${dependency.kind} ${dependency.name}@${dependency.versionRange} could not be resolved.`;
    if (dependency.required) errors.push(message);
    else warnings.push(message);
  }
  return selected;
}

function resolveEntryDependencies(
  input: ResolveRegistryContextInput,
  entry: SkillPackage | HarnessPackage | InstructionArtifact,
  selectedSkills: SkillPackage[],
  selectedInstructions: InstructionArtifact[],
  warnings: string[],
  errors: string[],
  visiting: Set<string>
): void {
  const dependencies = entry.dependencies ?? [];
  const currentKey = `${"runtimeType" in entry ? "harness" : "type" in entry ? "instruction" : "skill"}:${entry.name}`;
  if (visiting.has(currentKey)) {
    errors.push(`Circular registry dependency detected at ${entry.name}.`);
    return;
  }
  visiting.add(currentKey);
  dependencies.forEach((dependency) => {
    const key = dependencyKey(dependency);
    if (visiting.has(key)) {
      errors.push(`Circular registry dependency detected: ${currentKey} -> ${key}.`);
      return;
    }
    const resolved = findSelectableDependency(input, dependency, warnings, errors);
    if (!resolved) return;
    if (dependency.kind === "skill") selectedSkills.push(resolved as SkillPackage);
    if (dependency.kind === "instruction") selectedInstructions.push(resolved as InstructionArtifact);
    resolveEntryDependencies(input, resolved, selectedSkills, selectedInstructions, warnings, errors, new Set(visiting));
  });
}

export function resolveRegistryContextForTask(input: ResolveRegistryContextInput): RegistryResolution {
  const repo = input.repo ?? seedRepos.find((candidate) => candidate.id === input.task.repoId);
  const warnings: string[] = [];
  const errors: string[] = [];
  const normalizedInput = { ...input, repo };
  const selectedSkillEntries = resolveSkillEntries(normalizedInput, warnings, errors);
  const selectedHarness = resolveHarnessEntry(normalizedInput, warnings, errors);
  const selectedInstructionEntries = resolveInstructionEntries(normalizedInput, warnings);
  [...selectedSkillEntries, ...(selectedHarness ? [selectedHarness] : []), ...selectedInstructionEntries].forEach((entry) => {
    resolveEntryDependencies(normalizedInput, entry, selectedSkillEntries, selectedInstructionEntries, warnings, errors, new Set());
  });
  const selectedSkills = uniqueById(selectedSkillEntries).map(registryRefFromSkill);
  const selectedInstructions = uniqueById(selectedInstructionEntries).map(registryRefFromInstruction);

  if (!selectedHarness) {
    errors.push("Registry resolution could not select a harness.");
  }

  return {
    selectedSkills,
    selectedHarness: selectedHarness
      ? registryRefFromHarness(selectedHarness)
      : {
          kind: "harness",
          name: "unresolved",
          version: "0.0.0"
        },
    selectedInstructions,
    warnings: [...new Set(warnings)],
    errors: [...new Set(errors)],
    resolvedAt: new Date()
  };
}

export function skillToDto(skill: SkillPackage): SkillDto {
  return {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    description: skill.description,
    status: skill.status,
    approvalStatus: skill.approvalStatus,
    evalStatus: skill.evalStatus,
    owner: skill.owner,
    compatibleAgents: [...skill.compatibleAgents],
    compatibleModels: skill.compatibleModels ? [...skill.compatibleModels] : undefined,
    requiredTools: [...skill.requiredTools],
    requiredHarnesses: [...skill.requiredHarnesses],
    invocationRules: [...skill.invocationRules],
    instructionRef: skill.instructionRef,
    evalRefs: [...skill.evalRefs],
    tags: [...skill.tags],
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString()
  };
}

export function harnessToDto(harness: HarnessPackage): HarnessDto {
  return {
    id: harness.id,
    name: harness.name,
    version: harness.version,
    description: harness.description,
    status: harness.status,
    approvalStatus: harness.approvalStatus,
    evalStatus: harness.evalStatus,
    owner: harness.owner,
    runtimeType: harness.runtimeType,
    runtimeImage: harness.runtimeImage,
    allowedTools: [...harness.allowedTools],
    allowedMcpServers: [...harness.allowedMcpServers],
    secretScopes: [...harness.secretScopes],
    networkPolicy: harness.networkPolicy,
    testCommands: [...harness.testCommands],
    compatibleAgents: [...harness.compatibleAgents],
    instructionLoadingPolicy: harness.instructionLoadingPolicy,
    createdAt: harness.createdAt.toISOString(),
    updatedAt: harness.updatedAt.toISOString()
  };
}

export function instructionToDto(instruction: InstructionArtifact): InstructionArtifactDto {
  return {
    id: instruction.id,
    name: instruction.name,
    version: instruction.version,
    description: instruction.description,
    status: instruction.status,
    approvalStatus: instruction.approvalStatus,
    evalStatus: instruction.evalStatus,
    owner: instruction.owner,
    type: instruction.type,
    scope: instruction.scope,
    path: instruction.path,
    checksum: instruction.checksum,
    checksumAlgorithm: instruction.checksumAlgorithm,
    checksumStatus: instruction.checksumStatus,
    checksumVerifiedAt: toIso(instruction.checksumVerifiedAt),
    precedence: instruction.precedence,
    appliesToAgents: [...instruction.appliesToAgents],
    appliesToRepos: [...instruction.appliesToRepos],
    appliesToDirectories: [...instruction.appliesToDirectories],
    maxContextBytes: instruction.maxContextBytes,
    createdAt: instruction.createdAt.toISOString(),
    updatedAt: instruction.updatedAt.toISOString()
  };
}

export function registryResolutionToDto(resolution: RegistryResolution): RegistryResolutionDto {
  return {
    selectedSkills: resolution.selectedSkills,
    selectedHarness: resolution.selectedHarness,
    selectedInstructions: resolution.selectedInstructions,
    warnings: [...resolution.warnings],
    errors: [...resolution.errors],
    resolvedAt: resolution.resolvedAt.toISOString()
  };
}

export function registryAuditLogToDto(log: RegistryAuditLogEntry): RegistryAuditLogDto {
  return {
    id: log.id,
    actorId: log.actorId,
    action: log.action,
    targetKind: log.targetKind,
    targetId: log.targetId,
    targetName: log.targetName,
    targetVersion: log.targetVersion,
    before: log.before,
    after: log.after,
    reason: log.reason,
    createdAt: log.createdAt.toISOString()
  };
}

export function registryRevisionToDto(revision: RegistryRevision): RegistryRevisionDto {
  return {
    id: revision.id,
    targetKind: revision.targetKind,
    targetId: revision.targetId,
    targetName: revision.targetName,
    targetVersion: revision.targetVersion,
    revisionNumber: revision.revisionNumber,
    snapshot: structuredClone(revision.snapshot),
    snapshotChecksum: revision.snapshotChecksum,
    changeReason: revision.changeReason,
    createdBy: revision.createdBy,
    createdAt: revision.createdAt.toISOString(),
    sourceAuditLogId: revision.sourceAuditLogId
  };
}

export function registryRollbackResultToDto(result: RegistryRollbackResult): RegistryRollbackResultDto {
  return {
    targetKind: result.targetKind,
    targetId: result.targetId,
    rolledBackFromRevision: registryRevisionToDto(result.rolledBackFromRevision),
    rolledBackToRevision: registryRevisionToDto(result.rolledBackToRevision),
    newRevision: registryRevisionToDto(result.newRevision),
    auditLogId: result.auditLogId,
    createdAt: result.createdAt.toISOString()
  };
}

export function registryApprovalQueueItemToDto(item: RegistryApprovalQueueItem): RegistryApprovalQueueItemDto {
  return {
    id: item.id,
    targetKind: item.targetKind,
    targetId: item.targetId,
    targetName: item.targetName,
    targetVersion: item.targetVersion,
    approvalStatus: item.approvalStatus,
    requestedBy: item.requestedBy,
    requestedAt: item.requestedAt.toISOString(),
    reason: item.reason,
    currentStatus: item.currentStatus,
    evalStatus: item.evalStatus,
    checksumStatus: item.checksumStatus,
    blockingReasons: [...item.blockingReasons],
    recommendedAction: item.recommendedAction
  };
}

export function registryEvalResultToDto(result: RegistryEvalResult): RegistryEvalResultDto {
  return {
    id: result.id,
    targetKind: result.targetKind,
    targetId: result.targetId,
    targetName: result.targetName,
    targetVersion: result.targetVersion,
    evalName: result.evalName,
    evalType: result.evalType,
    status: result.status,
    score: result.score,
    maxScore: result.maxScore,
    summary: result.summary,
    details: result.details,
    attachedBy: result.attachedBy,
    attachedAt: result.attachedAt.toISOString(),
    source: result.source,
    artifactRef: result.artifactRef
  };
}

export function registryActorToDto(actor: RegistryActor): RegistryActorDto {
  return {
    id: actor.id,
    displayName: actor.displayName,
    roles: [...actor.roles],
    teams: actor.teams ? [...actor.teams] : undefined
  };
}

export function sha256Checksum(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function packageChecksumPayload(manifest: Omit<RegistryPackageManifest, "checksum">): Record<string, unknown> {
  return {
    schemaVersion: manifest.schemaVersion,
    packageKind: manifest.packageKind,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    owner: manifest.owner,
    manifestVersion: manifest.manifestVersion,
    entries: [...manifest.entries].sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name) || left.version.localeCompare(right.version)),
    dependencies: [...manifest.dependencies].sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name) || left.versionRange.localeCompare(right.versionRange)),
    checksumAlgorithm: manifest.checksumAlgorithm,
    createdBy: manifest.createdBy,
    tags: [...manifest.tags].sort(),
    metadata: manifest.metadata
  };
}

export type CreateRegistryPackageManifestInput = Omit<RegistryPackageManifest, "id" | "checksum" | "checksumAlgorithm" | "createdAt"> &
  Partial<Pick<RegistryPackageManifest, "id" | "checksum" | "checksumAlgorithm" | "createdAt">>;

export function createRegistryPackageManifest(input: CreateRegistryPackageManifestInput): RegistryPackageManifest {
  const entries = validatePackageEntries(input.entries);
  const dependencies = validatePackageDependencies(input.dependencies ?? []);
  const manifestWithoutChecksum: Omit<RegistryPackageManifest, "checksum"> = {
    ...input,
    id: input.id ?? createId("regpkg"),
    schemaVersion: requireString(input.schemaVersion, "manifest.schemaVersion"),
    packageKind: normalizePackageKind(input.packageKind),
    name: requireString(input.name, "manifest.name"),
    version: requireString(input.version, "manifest.version"),
    description: requireString(input.description, "manifest.description"),
    owner: requireString(input.owner, "manifest.owner"),
    manifestVersion: requireString(input.manifestVersion, "manifest.manifestVersion"),
    entries,
    dependencies,
    checksumAlgorithm: input.checksumAlgorithm ?? "sha256",
    createdAt: input.createdAt ?? new Date(),
    createdBy: requireString(input.createdBy, "manifest.createdBy"),
    tags: requireStringArray(input.tags, "manifest.tags"),
    metadata: input.metadata ?? {}
  };
  const checksum = sha256Checksum(stableSerialize(packageChecksumPayload(manifestWithoutChecksum)));
  if (input.checksum && input.checksum !== checksum) {
    throw new Error("manifest.checksum does not match deterministic payload");
  }
  return { ...manifestWithoutChecksum, checksum };
}

function validatePackageEntries(entries: RegistryPackageEntry[]): RegistryPackageEntry[] {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("manifest.entries must include at least one entry");
  return entries.map((entry, index) => ({
    kind: assertRegistryKind(entry.kind, `manifest.entries[${index}].kind`),
    id: requireString(entry.id, `manifest.entries[${index}].id`),
    name: requireString(entry.name, `manifest.entries[${index}].name`),
    version: requireString(entry.version, `manifest.entries[${index}].version`),
    checksum: entry.checksum,
    required: entry.required ?? true
  }));
}

function validatePackageDependencies(dependencies: RegistryPackageDependency[]): RegistryPackageDependency[] {
  if (!Array.isArray(dependencies)) throw new Error("manifest.dependencies must be an array");
  return dependencies.map((dependency, index) => ({
    kind: normalizePackageKind(dependency.kind),
    name: requireString(dependency.name, `manifest.dependencies[${index}].name`),
    versionRange: requireString(dependency.versionRange, `manifest.dependencies[${index}].versionRange`),
    optional: dependency.optional ?? false
  }));
}

function packageEntryFromEntity(kind: RegistryKind, entry: SkillPackage | HarnessPackage | InstructionArtifact, required = true): RegistryPackageEntry {
  return {
    kind,
    id: entry.id,
    name: entry.name,
    version: entry.version,
    checksum: "checksum" in entry ? entry.checksum : registrySnapshotChecksum(registryEntityFullSnapshot(entry)),
    required
  };
}

export function registryPackageManifestToDto(manifest: RegistryPackageManifest): RegistryPackageManifestDto {
  return {
    ...clonePackageManifest(manifest),
    createdAt: manifest.createdAt.toISOString()
  };
}

export function registryImportResultToDto(result: RegistryPackageImportResult): RegistryImportResultDto {
  return {
    ...result,
    manifest: registryPackageManifestToDto(result.manifest)
  };
}

export function diffRegistryStructures(fromRef: string, fromValue: Record<string, unknown>, toRef: string, toValue: Record<string, unknown>): RegistryPackageDiff {
  const keys = [...new Set([...Object.keys(fromValue), ...Object.keys(toValue)])].sort();
  const addedEntries: RegistryPackageDiffEntry[] = [];
  const removedEntries: RegistryPackageDiffEntry[] = [];
  const changedEntries: RegistryPackageDiffEntry[] = [];
  const unchangedEntries: string[] = [];
  keys.forEach((key) => {
    const hasFrom = Object.prototype.hasOwnProperty.call(fromValue, key);
    const hasTo = Object.prototype.hasOwnProperty.call(toValue, key);
    if (!hasFrom) {
      addedEntries.push({ path: key, to: toValue[key] });
    } else if (!hasTo) {
      removedEntries.push({ path: key, from: fromValue[key] });
    } else if (stableSerialize(fromValue[key]) !== stableSerialize(toValue[key])) {
      changedEntries.push({ path: key, from: fromValue[key], to: toValue[key] });
    } else {
      unchangedEntries.push(key);
    }
  });
  const changedPaths = changedEntries.map((entry) => entry.path);
  const riskLevel: RiskLevel = changedPaths.some((pathName) => pathName.includes("networkPolicy") || pathName.includes("allowedTools"))
    ? "high"
    : changedPaths.some((pathName) => pathName.includes("body") || pathName.includes("path") || pathName.includes("invocationRules"))
      ? "medium"
      : "low";
  return {
    fromRef,
    toRef,
    addedEntries,
    removedEntries,
    changedEntries,
    unchangedEntries,
    riskLevel,
    summary: `${addedEntries.length} added, ${removedEntries.length} removed, ${changedEntries.length} changed, ${unchangedEntries.length} unchanged`
  };
}

function isSafeRelativePath(inputPath: string): boolean {
  return inputPath.length > 0 && !path.isAbsolute(inputPath) && !inputPath.includes("..");
}

function readSafeRelativeFile(repoRoot: string, inputPath: string): string | undefined {
  if (!isSafeRelativePath(inputPath)) return undefined;
  const root = path.resolve(repoRoot);
  const target = path.resolve(root, inputPath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return undefined;
  if (!existsSync(target)) return undefined;
  return readFileSync(target, "utf8");
}

export function verifyInstructionChecksum(
  instruction: InstructionArtifact,
  options: { repoRoot?: string } = {}
): Pick<InstructionArtifact, "checksumStatus" | "checksumVerifiedAt"> {
  if (instruction.checksumAlgorithm !== "sha256") {
    return { checksumStatus: "unavailable" };
  }

  const content = instruction.body ?? (instruction.path && options.repoRoot ? readSafeRelativeFile(options.repoRoot, instruction.path) : undefined);
  if (content === undefined) {
    return { checksumStatus: "unavailable" };
  }

  return {
    checksumStatus: sha256Checksum(content) === instruction.checksum ? "verified" : "mismatch",
    checksumVerifiedAt: new Date()
  };
}

abstract class InMemoryRegistryBase {
  protected snapshot: Required<RegistrySnapshot>;

  constructor(snapshot: RegistrySnapshot = createDefaultRegistry()) {
    this.snapshot = copySnapshot(snapshot);
  }
}

export class InMemoryRegistryRepository extends InMemoryRegistryBase implements
  SkillRegistryRepository,
  HarnessRegistryRepository,
  InstructionRegistryRepository,
  RegistryAuditRepository,
  RegistryHistoryRepository,
  RegistryEvalResultRepository,
  RegistryPackageRepository {
  listSkills(): SkillPackage[] {
    return this.snapshot.skills.map(cloneSkill);
  }

  getSkillById(id: string): SkillPackage | undefined {
    const skill = this.snapshot.skills.find((entry) => entry.id === id);
    return skill ? cloneSkill(skill) : undefined;
  }

  getSkillByNameVersion(name: string, version: string): SkillPackage | undefined {
    const skill = this.snapshot.skills.find((entry) => entry.name === name && entry.version === version);
    return skill ? cloneSkill(skill) : undefined;
  }

  createSkill(input: SkillPackage): SkillPackage {
    this.snapshot.skills.push(cloneSkill(input));
    return cloneSkill(input);
  }

  updateSkill(id: string, patch: Partial<SkillPackage>): SkillPackage {
    const skill = this.snapshot.skills.find((entry) => entry.id === id);
    if (!skill) throw new Error(`Skill not found: ${id}`);
    Object.assign(skill, patch, { updatedAt: new Date() });
    return cloneSkill(skill);
  }

  updateSkillStatus(id: string, status: RegistryStatus): SkillPackage {
    return this.updateSkill(id, { status });
  }

  listHarnesses(): HarnessPackage[] {
    return this.snapshot.harnesses.map(cloneHarness);
  }

  getHarnessById(id: string): HarnessPackage | undefined {
    const harness = this.snapshot.harnesses.find((entry) => entry.id === id);
    return harness ? cloneHarness(harness) : undefined;
  }

  getHarnessByNameVersion(name: string, version: string): HarnessPackage | undefined {
    const harness = this.snapshot.harnesses.find((entry) => entry.name === name && entry.version === version);
    return harness ? cloneHarness(harness) : undefined;
  }

  createHarness(input: HarnessPackage): HarnessPackage {
    this.snapshot.harnesses.push(cloneHarness(input));
    return cloneHarness(input);
  }

  updateHarness(id: string, patch: Partial<HarnessPackage>): HarnessPackage {
    const harness = this.snapshot.harnesses.find((entry) => entry.id === id);
    if (!harness) throw new Error(`Harness not found: ${id}`);
    Object.assign(harness, patch, { updatedAt: new Date() });
    return cloneHarness(harness);
  }

  updateHarnessStatus(id: string, status: RegistryStatus): HarnessPackage {
    return this.updateHarness(id, { status });
  }

  listInstructions(): InstructionArtifact[] {
    return this.snapshot.instructions.map(cloneInstruction);
  }

  getInstructionById(id: string): InstructionArtifact | undefined {
    const instruction = this.snapshot.instructions.find((entry) => entry.id === id);
    return instruction ? cloneInstruction(instruction) : undefined;
  }

  getInstructionByNameVersion(name: string, version: string): InstructionArtifact | undefined {
    const instruction = this.snapshot.instructions.find((entry) => entry.name === name && entry.version === version);
    return instruction ? cloneInstruction(instruction) : undefined;
  }

  createInstruction(input: InstructionArtifact): InstructionArtifact {
    this.snapshot.instructions.push(cloneInstruction(input));
    return cloneInstruction(input);
  }

  updateInstruction(id: string, patch: Partial<InstructionArtifact>): InstructionArtifact {
    const instruction = this.snapshot.instructions.find((entry) => entry.id === id);
    if (!instruction) throw new Error(`Instruction artifact not found: ${id}`);
    Object.assign(instruction, patch, { updatedAt: new Date() });
    return cloneInstruction(instruction);
  }

  updateInstructionStatus(id: string, status: RegistryStatus): InstructionArtifact {
    return this.updateInstruction(id, { status });
  }

  appendAuditLog(input: RegistryAuditInput): RegistryAuditLogEntry {
    const log: RegistryAuditLogEntry = {
      ...input,
      id: createId("regaudit"),
      createdAt: new Date()
    };
    this.snapshot.auditLogs.push(log);
    return cloneAuditLog(log);
  }

  listAuditLogs(): RegistryAuditLogEntry[] {
    return this.snapshot.auditLogs.map(cloneAuditLog);
  }

  listAuditLogsForTarget(targetKind: RegistryKind, targetId: string): RegistryAuditLogEntry[] {
    return this.snapshot.auditLogs
      .filter((log) => log.targetKind === targetKind && log.targetId === targetId)
      .map(cloneAuditLog);
  }

  appendRevision(input: RegistryHistoryInput): RegistryRevision {
    const revision: RegistryRevision = {
      ...input,
      id: createId("regrev"),
      createdAt: new Date()
    };
    this.snapshot.revisions.push(cloneRevision(revision));
    return cloneRevision(revision);
  }

  listRevisionsForTarget(targetKind: RegistryKind, targetId: string): RegistryRevision[] {
    return this.snapshot.revisions
      .filter((revision) => revision.targetKind === targetKind && revision.targetId === targetId)
      .sort((left, right) => left.revisionNumber - right.revisionNumber || left.createdAt.getTime() - right.createdAt.getTime())
      .map(cloneRevision);
  }

  getRevision(id: string): RegistryRevision | undefined {
    const revision = this.snapshot.revisions.find((entry) => entry.id === id);
    return revision ? cloneRevision(revision) : undefined;
  }

  getLatestRevisionForTarget(targetKind: RegistryKind, targetId: string): RegistryRevision | undefined {
    return this.listRevisionsForTarget(targetKind, targetId).at(-1);
  }

  appendEvalResult(input: RegistryEvalResultInputRecord): RegistryEvalResult {
    const result: RegistryEvalResult = {
      ...input,
      id: createId("regeval"),
      attachedAt: new Date()
    };
    this.snapshot.evalResults.push(cloneEvalResult(result));
    return cloneEvalResult(result);
  }

  listEvalResultsForTarget(targetKind: RegistryKind, targetId: string): RegistryEvalResult[] {
    return this.snapshot.evalResults
      .filter((result) => result.targetKind === targetKind && result.targetId === targetId)
      .sort((left, right) => left.attachedAt.getTime() - right.attachedAt.getTime() || left.id.localeCompare(right.id))
      .map(cloneEvalResult);
  }

  getLatestEvalResultForTarget(targetKind: RegistryKind, targetId: string): RegistryEvalResult | undefined {
    return this.listEvalResultsForTarget(targetKind, targetId).at(-1);
  }

  createPackageManifest(input: RegistryPackageManifest): RegistryPackageManifest {
    this.snapshot.packageManifests.push(clonePackageManifest(input));
    return clonePackageManifest(input);
  }

  listPackageManifests(): RegistryPackageManifest[] {
    return this.snapshot.packageManifests.map(clonePackageManifest);
  }

  getPackageManifestById(id: string): RegistryPackageManifest | undefined {
    const manifest = this.snapshot.packageManifests.find((entry) => entry.id === id);
    return manifest ? clonePackageManifest(manifest) : undefined;
  }

  getPackageManifestByNameVersion(name: string, version: string): RegistryPackageManifest | undefined {
    const manifest = this.snapshot.packageManifests.find((entry) => entry.name === name && entry.version === version);
    return manifest ? clonePackageManifest(manifest) : undefined;
  }
}

function serializeSnapshot(snapshot: Required<RegistrySnapshot>): string {
  return JSON.stringify(snapshot, null, 2);
}

function reviveSnapshot(raw: string): Required<RegistrySnapshot> {
  const parsed = JSON.parse(raw) as RegistrySnapshot;
  return copySnapshot({
    skills: parsed.skills ?? [],
    harnesses: parsed.harnesses ?? [],
    instructions: parsed.instructions ?? [],
    auditLogs: parsed.auditLogs ?? [],
    revisions: parsed.revisions ?? [],
    evalResults: parsed.evalResults ?? [],
    packageManifests: parsed.packageManifests ?? []
  });
}

export class FileBackedRegistryRepository extends InMemoryRegistryRepository {
  private readonly filePath: string;

  constructor(filePath: string, seed: RegistrySnapshot = createDefaultRegistry()) {
    super(FileBackedRegistryRepository.load(filePath, seed));
    this.filePath = filePath;
  }

  private static load(filePath: string, seed: RegistrySnapshot): Required<RegistrySnapshot> {
    if (!existsSync(filePath)) {
      const directory = path.dirname(filePath);
      mkdirSync(directory, { recursive: true });
      const initial = copySnapshot(seed);
      writeFileSync(filePath, serializeSnapshot(initial), "utf8");
      return initial;
    }
    return reviveSnapshot(readFileSync(filePath, "utf8"));
  }

  private persist(): void {
    writeFileSync(this.filePath, serializeSnapshot(this.snapshot), "utf8");
  }

  override createSkill(input: SkillPackage): SkillPackage {
    const skill = super.createSkill(input);
    this.persist();
    return skill;
  }

  override updateSkill(id: string, patch: Partial<SkillPackage>): SkillPackage {
    const skill = super.updateSkill(id, patch);
    this.persist();
    return skill;
  }

  override createHarness(input: HarnessPackage): HarnessPackage {
    const harness = super.createHarness(input);
    this.persist();
    return harness;
  }

  override updateHarness(id: string, patch: Partial<HarnessPackage>): HarnessPackage {
    const harness = super.updateHarness(id, patch);
    this.persist();
    return harness;
  }

  override createInstruction(input: InstructionArtifact): InstructionArtifact {
    const instruction = super.createInstruction(input);
    this.persist();
    return instruction;
  }

  override updateInstruction(id: string, patch: Partial<InstructionArtifact>): InstructionArtifact {
    const instruction = super.updateInstruction(id, patch);
    this.persist();
    return instruction;
  }

  override appendAuditLog(input: RegistryAuditInput): RegistryAuditLogEntry {
    const log = super.appendAuditLog(input);
    this.persist();
    return log;
  }

  override appendRevision(input: RegistryHistoryInput): RegistryRevision {
    const revision = super.appendRevision(input);
    this.persist();
    return revision;
  }

  override appendEvalResult(input: RegistryEvalResultInputRecord): RegistryEvalResult {
    const result = super.appendEvalResult(input);
    this.persist();
    return result;
  }

  override createPackageManifest(input: RegistryPackageManifest): RegistryPackageManifest {
    const manifest = super.createPackageManifest(input);
    this.persist();
    return manifest;
  }
}

export const defaultRegistryActor: RegistryActor = {
  id: "mock-admin",
  displayName: "Mock Admin",
  roles: ["registry_admin"]
};

const rolePermissions: Record<RegistryRole, RegistryPermission[]> = {
  registry_viewer: ["registry.read", "registry.audit.read", "registry.history.read"],
  registry_editor: ["registry.read", "registry.create", "registry.update", "registry.status.change", "registry.checksum.verify", "registry.audit.read", "registry.history.read"],
  registry_reviewer: ["registry.read", "registry.approval.change", "registry.eval.change", "registry.audit.read", "registry.history.read"],
  registry_admin: [
    "registry.read",
    "registry.create",
    "registry.update",
    "registry.status.change",
    "registry.approval.change",
    "registry.eval.change",
    "registry.checksum.verify",
    "registry.rollback",
    "registry.audit.read",
    "registry.history.read"
  ],
  system: [
    "registry.read",
    "registry.create",
    "registry.update",
    "registry.status.change",
    "registry.approval.change",
    "registry.eval.change",
    "registry.checksum.verify",
    "registry.rollback",
    "registry.audit.read",
    "registry.history.read"
  ]
};

export class MockRegistryMutationAuthorizer implements RegistryMutationAuthorizer {
  authorize(actor: RegistryActor, permission: RegistryPermission, target: RegistryMutationTarget = {}) {
    const permissions = new Set(actor.roles.flatMap((role) => rolePermissions[role] ?? []));
    const allowed = permissions.has(permission);
    return {
      allowed,
      reason: allowed ? "allowed by mock registry role" : `missing permission ${permission}`,
      requiredPermission: permission,
      actorId: actor.id,
      targetKind: target.targetKind,
      targetId: target.targetId
    };
  }
}

function registryPermissionToPolicyAction(permission: RegistryPermission): PolicyAction | undefined {
  if (permission === "registry.create") return "registry.create";
  if (permission === "registry.update" || permission === "registry.status.change" || permission === "registry.eval.change" || permission === "registry.checksum.verify") return "registry.update";
  if (permission === "registry.approval.change") return "registry.approve";
  if (permission === "registry.rollback") return "registry.rollback";
  return undefined;
}

export class PolicyBackedRegistryMutationAuthorizer implements RegistryMutationAuthorizer {
  private readonly fallback: RegistryMutationAuthorizer;
  private readonly policyService: PolicyService;

  constructor(input: { policyService: PolicyService; fallback?: RegistryMutationAuthorizer }) {
    this.policyService = input.policyService;
    this.fallback = input.fallback ?? new MockRegistryMutationAuthorizer();
  }

  authorize(actor: RegistryActor, permission: RegistryPermission, target: RegistryMutationTarget = {}) {
    const fallbackDecision = this.fallback.authorize(actor, permission, target);
    if (!fallbackDecision.allowed) return fallbackDecision;
    const action = registryPermissionToPolicyAction(permission);
    if (!action) return fallbackDecision;
    const policyDecision = this.policyService.evaluate({
      subject: createPolicySubject({
        actorId: actor.id,
        actorKind: actor.roles.includes("system") ? "system" : "user",
        roles: actor.roles,
        teams: actor.teams
      }),
      action,
      resource: createPolicyResource({
        resourceKind: "registry_item",
        resourceId: target.targetId,
        metadata: {
          targetKind: target.targetKind
        }
      }),
      context: createPolicyContext({
        metadata: {
          permission,
          targetKind: target.targetKind,
          targetId: target.targetId
        }
      })
    });
    return {
      allowed: policyDecision.allowed,
      reason: policyDecision.allowed ? fallbackDecision.reason : policyDecision.reason,
      requiredPermission: permission,
      actorId: actor.id,
      targetKind: target.targetKind,
      targetId: target.targetId
    };
  }
}

export class RegistryAuthorizationError extends Error {
  readonly decision: ReturnType<RegistryMutationAuthorizer["authorize"]>;

  constructor(decision: ReturnType<RegistryMutationAuthorizer["authorize"]>) {
    super(decision.reason);
    this.decision = decision;
    this.name = "RegistryAuthorizationError";
  }
}

function actorFromInput(defaultActor: RegistryActor, actor?: RegistryActor, actorId?: string): RegistryActor {
  if (actor) return actor;
  if (actorId && actorId !== defaultActor.id) {
    return {
      id: actorId,
      displayName: actorId,
      roles: defaultActor.roles
    };
  }
  return defaultActor;
}

export class RegistryService {
  private readonly skillRepository: SkillRegistryRepository;
  private readonly harnessRepository: HarnessRegistryRepository;
  private readonly instructionRepository: InstructionRegistryRepository;
  private readonly auditRepository: RegistryAuditRepository;
  private readonly historyRepository: RegistryHistoryRepository;
  private readonly evalResultRepository: RegistryEvalResultRepository;
  private readonly packageRepository: RegistryPackageRepository;
  private readonly authorizer: RegistryMutationAuthorizer;
  private readonly defaultActor: RegistryActor;
  private readonly defaultActorId: string;
  private readonly repoRoot?: string;

  constructor(input: RegistryServiceInput) {
    const fallbackRepository = new InMemoryRegistryRepository();
    this.skillRepository = input.skillRepository;
    this.harnessRepository = input.harnessRepository;
    this.instructionRepository = input.instructionRepository;
    this.auditRepository = input.auditRepository;
    this.historyRepository = input.historyRepository ?? ("appendRevision" in input.auditRepository ? input.auditRepository as unknown as RegistryHistoryRepository : fallbackRepository);
    this.evalResultRepository = input.evalResultRepository ?? ("appendEvalResult" in input.auditRepository ? input.auditRepository as unknown as RegistryEvalResultRepository : fallbackRepository);
    this.packageRepository = input.packageRepository ?? ("createPackageManifest" in input.auditRepository ? input.auditRepository as unknown as RegistryPackageRepository : fallbackRepository);
    this.authorizer = input.authorizer ?? new MockRegistryMutationAuthorizer();
    this.defaultActor = input.defaultActor ?? {
      ...defaultRegistryActor,
      id: input.defaultActorId ?? defaultRegistryActor.id,
      displayName: input.defaultActorId ?? defaultRegistryActor.displayName
    };
    this.defaultActorId = this.defaultActor.id;
    this.repoRoot = input.repoRoot;
  }

  listSkills(actor = this.defaultActor): SkillPackage[] {
    this.authorize(actor, "registry.read");
    return this.skillRepository.listSkills();
  }

  getSkill(id: string): SkillPackage | undefined {
    return this.skillRepository.getSkillById(id);
  }

  createSkill(input: CreateSkillPackageInput, actor: RegistryActor | string = this.defaultActor): SkillPackage {
    const registryActor = typeof actor === "string" ? actorFromInput(this.defaultActor, undefined, actor) : actor;
    this.authorize(registryActor, "registry.create", { targetKind: "skill" });
    const skill = createSkillPackage(input);
    const created = this.skillRepository.createSkill(skill);
    const audit = this.appendAudit({
      actorId: registryActor.id,
      action: "create",
      targetKind: "skill",
      targetId: created.id,
      targetName: created.name,
      targetVersion: created.version,
      after: registryEntitySnapshot(created)
    });
    this.appendRevisionForEntity("skill", created, registryActor.id, "create", audit.id);
    return created;
  }

  updateSkillStatus(id: string, input: RegistryStatusUpdateInput): SkillPackage {
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.status.change", { targetKind: "skill", targetId: id });
    const before = this.requireSkill(id);
    this.ensureInitialRevision("skill", before, actor.id);
    const updated = this.skillRepository.updateSkillStatus(id, input.status);
    const audit = this.appendAudit({
      actorId: actor.id,
      action: statusAuditAction(input.status, before.status),
      targetKind: "skill",
      targetId: updated.id,
      targetName: updated.name,
      targetVersion: updated.version,
      before: registryEntitySnapshot(before),
      after: registryEntitySnapshot(updated),
      reason: input.reason
    });
    this.appendRevisionForEntity("skill", updated, actor.id, input.reason ?? "status_change", audit.id);
    return updated;
  }

  updateSkillApproval(id: string, input: RegistryApprovalUpdateInput): SkillPackage {
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.approval.change", { targetKind: "skill", targetId: id });
    const before = this.requireSkill(id);
    this.ensureInitialRevision("skill", before, actor.id);
    const updated = this.skillRepository.updateSkill(id, { approvalStatus: input.approvalStatus });
    const audit = this.appendAudit({
      actorId: actor.id,
      action: approvalAuditAction(input.approvalStatus),
      targetKind: "skill",
      targetId: updated.id,
      targetName: updated.name,
      targetVersion: updated.version,
      before: registryEntitySnapshot(before),
      after: registryEntitySnapshot(updated),
      reason: input.reason
    });
    this.appendRevisionForEntity("skill", updated, actor.id, input.reason ?? "approval_change", audit.id);
    return updated;
  }

  updateSkillEval(id: string, input: RegistryEvalUpdateInput): SkillPackage {
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.eval.change", { targetKind: "skill", targetId: id });
    const before = this.requireSkill(id);
    this.ensureInitialRevision("skill", before, actor.id);
    const updated = this.skillRepository.updateSkill(id, { evalStatus: input.evalStatus });
    const audit = this.appendAudit({
      actorId: actor.id,
      action: evalAuditAction(input.evalStatus),
      targetKind: "skill",
      targetId: updated.id,
      targetName: updated.name,
      targetVersion: updated.version,
      before: registryEntitySnapshot(before),
      after: registryEntitySnapshot(updated),
      reason: input.reason
    });
    this.appendRevisionForEntity("skill", updated, actor.id, input.reason ?? "eval_status_change", audit.id);
    return updated;
  }

  listHarnesses(actor = this.defaultActor): HarnessPackage[] {
    this.authorize(actor, "registry.read");
    return this.harnessRepository.listHarnesses();
  }

  getHarness(id: string): HarnessPackage | undefined {
    return this.harnessRepository.getHarnessById(id);
  }

  createHarness(input: CreateHarnessDefinitionInput, actor: RegistryActor | string = this.defaultActor): HarnessPackage {
    const registryActor = typeof actor === "string" ? actorFromInput(this.defaultActor, undefined, actor) : actor;
    this.authorize(registryActor, "registry.create", { targetKind: "harness" });
    const harness = createHarnessDefinition(input);
    const created = this.harnessRepository.createHarness(harness);
    const audit = this.appendAudit({
      actorId: registryActor.id,
      action: "create",
      targetKind: "harness",
      targetId: created.id,
      targetName: created.name,
      targetVersion: created.version,
      after: registryEntitySnapshot(created)
    });
    this.appendRevisionForEntity("harness", created, registryActor.id, "create", audit.id);
    return created;
  }

  updateHarnessStatus(id: string, input: RegistryStatusUpdateInput): HarnessPackage {
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.status.change", { targetKind: "harness", targetId: id });
    const before = this.requireHarness(id);
    this.ensureInitialRevision("harness", before, actor.id);
    const updated = this.harnessRepository.updateHarnessStatus(id, input.status);
    const audit = this.appendAudit({
      actorId: actor.id,
      action: statusAuditAction(input.status, before.status),
      targetKind: "harness",
      targetId: updated.id,
      targetName: updated.name,
      targetVersion: updated.version,
      before: registryEntitySnapshot(before),
      after: registryEntitySnapshot(updated),
      reason: input.reason
    });
    this.appendRevisionForEntity("harness", updated, actor.id, input.reason ?? "status_change", audit.id);
    return updated;
  }

  updateHarnessApproval(id: string, input: RegistryApprovalUpdateInput): HarnessPackage {
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.approval.change", { targetKind: "harness", targetId: id });
    const before = this.requireHarness(id);
    this.ensureInitialRevision("harness", before, actor.id);
    const updated = this.harnessRepository.updateHarness(id, { approvalStatus: input.approvalStatus });
    const audit = this.appendAudit({
      actorId: actor.id,
      action: approvalAuditAction(input.approvalStatus),
      targetKind: "harness",
      targetId: updated.id,
      targetName: updated.name,
      targetVersion: updated.version,
      before: registryEntitySnapshot(before),
      after: registryEntitySnapshot(updated),
      reason: input.reason
    });
    this.appendRevisionForEntity("harness", updated, actor.id, input.reason ?? "approval_change", audit.id);
    return updated;
  }

  updateHarnessEval(id: string, input: RegistryEvalUpdateInput): HarnessPackage {
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.eval.change", { targetKind: "harness", targetId: id });
    const before = this.requireHarness(id);
    this.ensureInitialRevision("harness", before, actor.id);
    const updated = this.harnessRepository.updateHarness(id, { evalStatus: input.evalStatus });
    const audit = this.appendAudit({
      actorId: actor.id,
      action: evalAuditAction(input.evalStatus),
      targetKind: "harness",
      targetId: updated.id,
      targetName: updated.name,
      targetVersion: updated.version,
      before: registryEntitySnapshot(before),
      after: registryEntitySnapshot(updated),
      reason: input.reason
    });
    this.appendRevisionForEntity("harness", updated, actor.id, input.reason ?? "eval_status_change", audit.id);
    return updated;
  }

  listInstructions(actor = this.defaultActor): InstructionArtifact[] {
    this.authorize(actor, "registry.read");
    return this.instructionRepository.listInstructions();
  }

  getInstruction(id: string): InstructionArtifact | undefined {
    return this.instructionRepository.getInstructionById(id);
  }

  createInstruction(input: CreateInstructionArtifactInput, actor: RegistryActor | string = this.defaultActor): InstructionArtifact {
    const registryActor = typeof actor === "string" ? actorFromInput(this.defaultActor, undefined, actor) : actor;
    this.authorize(registryActor, "registry.create", { targetKind: "instruction" });
    const instruction = createInstructionArtifact(input);
    const created = this.instructionRepository.createInstruction(instruction);
    const audit = this.appendAudit({
      actorId: registryActor.id,
      action: "create",
      targetKind: "instruction",
      targetId: created.id,
      targetName: created.name,
      targetVersion: created.version,
      after: registryEntitySnapshot(created)
    });
    this.appendRevisionForEntity("instruction", created, registryActor.id, "create", audit.id);
    return created;
  }

  updateInstructionStatus(id: string, input: RegistryStatusUpdateInput): InstructionArtifact {
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.status.change", { targetKind: "instruction", targetId: id });
    const before = this.requireInstruction(id);
    this.ensureInitialRevision("instruction", before, actor.id);
    const updated = this.instructionRepository.updateInstructionStatus(id, input.status);
    const audit = this.appendAudit({
      actorId: actor.id,
      action: statusAuditAction(input.status, before.status),
      targetKind: "instruction",
      targetId: updated.id,
      targetName: updated.name,
      targetVersion: updated.version,
      before: registryEntitySnapshot(before),
      after: registryEntitySnapshot(updated),
      reason: input.reason
    });
    this.appendRevisionForEntity("instruction", updated, actor.id, input.reason ?? "status_change", audit.id);
    return updated;
  }

  updateInstructionApproval(id: string, input: RegistryApprovalUpdateInput): InstructionArtifact {
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.approval.change", { targetKind: "instruction", targetId: id });
    const before = this.requireInstruction(id);
    this.ensureInitialRevision("instruction", before, actor.id);
    const updated = this.instructionRepository.updateInstruction(id, { approvalStatus: input.approvalStatus });
    const audit = this.appendAudit({
      actorId: actor.id,
      action: approvalAuditAction(input.approvalStatus),
      targetKind: "instruction",
      targetId: updated.id,
      targetName: updated.name,
      targetVersion: updated.version,
      before: registryEntitySnapshot(before),
      after: registryEntitySnapshot(updated),
      reason: input.reason
    });
    this.appendRevisionForEntity("instruction", updated, actor.id, input.reason ?? "approval_change", audit.id);
    return updated;
  }

  updateInstructionEval(id: string, input: RegistryEvalUpdateInput): InstructionArtifact {
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.eval.change", { targetKind: "instruction", targetId: id });
    const before = this.requireInstruction(id);
    this.ensureInitialRevision("instruction", before, actor.id);
    const updated = this.instructionRepository.updateInstruction(id, { evalStatus: input.evalStatus });
    const audit = this.appendAudit({
      actorId: actor.id,
      action: evalAuditAction(input.evalStatus),
      targetKind: "instruction",
      targetId: updated.id,
      targetName: updated.name,
      targetVersion: updated.version,
      before: registryEntitySnapshot(before),
      after: registryEntitySnapshot(updated),
      reason: input.reason
    });
    this.appendRevisionForEntity("instruction", updated, actor.id, input.reason ?? "eval_status_change", audit.id);
    return updated;
  }

  verifyInstructionChecksum(id: string, input: VerifyInstructionChecksumInput = {}): InstructionArtifact {
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.checksum.verify", { targetKind: "instruction", targetId: id });
    const before = this.requireInstruction(id);
    this.ensureInitialRevision("instruction", before, actor.id);
    const verification = verifyInstructionChecksum(before, { repoRoot: input.repoRoot ?? this.repoRoot });
    const updated = this.instructionRepository.updateInstruction(id, verification);
    const audit = this.appendAudit({
      actorId: actor.id,
      action: updated.checksumStatus === "verified" ? "checksum_verified" : "checksum_failed",
      targetKind: "instruction",
      targetId: updated.id,
      targetName: updated.name,
      targetVersion: updated.version,
      before: registryEntitySnapshot(before),
      after: {
        ...registryEntitySnapshot(updated),
        checksumStatus: updated.checksumStatus,
        checksumVerifiedAt: toIso(updated.checksumVerifiedAt)
      },
      reason: input.reason
    });
    if (before.checksumStatus !== updated.checksumStatus || before.checksumVerifiedAt?.getTime() !== updated.checksumVerifiedAt?.getTime()) {
      this.appendRevisionForEntity("instruction", updated, actor.id, input.reason ?? "checksum_verification", audit.id);
    }
    return updated;
  }

  listRevisionsForTarget(targetKind: RegistryKind, targetId: string, actor = this.defaultActor): RegistryRevision[] {
    this.authorize(actor, "registry.history.read", { targetKind, targetId });
    return this.historyRepository.listRevisionsForTarget(targetKind, targetId);
  }

  rollback(input: RegistryRollbackServiceInput): RegistryRollbackResult {
    const targetKind = assertRegistryKind(input.targetKind, "rollback.targetKind");
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.rollback", { targetKind, targetId: input.targetId });
    const current = this.requireRegistryEntity(targetKind, input.targetId);
    this.ensureInitialRevision(targetKind, current, actor.id);
    const latest = this.historyRepository.getLatestRevisionForTarget(targetKind, input.targetId);
    if (!latest) throw new Error(`No registry history found for ${targetKind}: ${input.targetId}`);

    const targetRevision = input.targetRevisionId
      ? this.historyRepository.getRevision(input.targetRevisionId)
      : typeof input.revisionNumber === "number"
        ? this.historyRepository.listRevisionsForTarget(targetKind, input.targetId).find((revision) => revision.revisionNumber === input.revisionNumber)
        : undefined;

    if (!targetRevision || targetRevision.targetKind !== targetKind || targetRevision.targetId !== input.targetId) {
      throw new Error(`Rollback revision not found for ${targetKind}: ${input.targetId}`);
    }

    const reason = requireString(input.reason, "rollback.reason");
    const restored = this.restoreEntityFromRevision(targetKind, input.targetId, targetRevision, actor.id);
    const audit = this.appendAudit({
      actorId: actor.id,
      action: "rollback",
      targetKind,
      targetId: restored.id,
      targetName: restored.name,
      targetVersion: restored.version,
      before: registryEntitySnapshot(current),
      after: registryEntitySnapshot(restored),
      reason
    });
    const newRevision = this.appendRevisionForEntity(targetKind, restored, actor.id, `rollback: ${reason}`, audit.id);
    return {
      targetKind,
      targetId: restored.id,
      rolledBackFromRevision: latest,
      rolledBackToRevision: targetRevision,
      newRevision,
      auditLogId: audit.id,
      createdAt: new Date()
    };
  }

  listApprovalQueue(filter: RegistryApprovalQueueFilter = {}, actor = this.defaultActor): RegistryApprovalQueueItem[] {
    this.authorize(actor, "registry.read");
    const status = filter.approvalStatus ?? "pending";
    const entries = [
      ...this.skillRepository.listSkills().map((entry) => this.approvalQueueItemForEntity("skill", entry)),
      ...this.harnessRepository.listHarnesses().map((entry) => this.approvalQueueItemForEntity("harness", entry)),
      ...this.instructionRepository.listInstructions().map((entry) => this.approvalQueueItemForEntity("instruction", entry))
    ].filter((item) => item.approvalStatus === status);

    return entries
      .filter((item) => !filter.targetKind || item.targetKind === filter.targetKind)
      .filter((item) => !filter.owner || this.ownerForQueueItem(item) === filter.owner)
      .filter((item) => filter.includeArchived || item.currentStatus !== "archived")
      .sort((left, right) => left.requestedAt.getTime() - right.requestedAt.getTime() || left.targetKind.localeCompare(right.targetKind) || left.targetName.localeCompare(right.targetName));
  }

  attachEvalResult(targetKind: RegistryKind, targetId: string, input: RegistryEvalResultInput): RegistryEvalResult {
    const kind = assertRegistryKind(targetKind, "evalResult.targetKind");
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.eval.change", { targetKind: kind, targetId });
    const entity = this.requireRegistryEntity(kind, targetId);
    const result = this.evalResultRepository.appendEvalResult({
      targetKind: kind,
      targetId: entity.id,
      targetName: entity.name,
      targetVersion: entity.version,
      evalName: requireString(input.evalName, "evalResult.evalName"),
      evalType: assertRegistryEvalResultType(input.evalType, "evalResult.evalType"),
      status: assertRegistryEvalResultStatus(input.status, "evalResult.status"),
      score: input.score,
      maxScore: input.maxScore,
      summary: requireString(input.summary, "evalResult.summary"),
      details: input.details,
      attachedBy: input.attachedBy ?? actor.id,
      source: assertRegistryEvalResultSource(input.source, "evalResult.source"),
      artifactRef: input.artifactRef
    });

    const audit = this.appendAudit({
      actorId: actor.id,
      action: "attach_eval_result",
      targetKind: kind,
      targetId: entity.id,
      targetName: entity.name,
      targetVersion: entity.version,
      before: registryEntitySnapshot(entity),
      after: {
        ...registryEntitySnapshot(entity),
        evalResultId: result.id,
        evalResultStatus: result.status
      },
      reason: input.reason
    });

    if (input.updateEvalStatus) {
      this.ensureInitialRevision(kind, entity, actor.id);
      const evalStatus = evalStatusFromResult(result.status);
      if (evalStatus) {
        const updated = this.updateEntityEvalStatus(kind, entity.id, evalStatus);
        this.appendRevisionForEntity(kind, updated, actor.id, input.reason ?? "eval_result_attached", audit.id);
      }
    }

    return result;
  }

  listEvalResultsForTarget(targetKind: RegistryKind, targetId: string, actor = this.defaultActor): RegistryEvalResult[] {
    this.authorize(actor, "registry.read", { targetKind, targetId });
    return this.evalResultRepository.listEvalResultsForTarget(targetKind, targetId);
  }

  listPackageManifests(actor = this.defaultActor): RegistryPackageManifest[] {
    this.authorize(actor, "registry.read");
    return this.packageRepository.listPackageManifests();
  }

  getPackageManifest(id: string, actor = this.defaultActor): RegistryPackageManifest | undefined {
    this.authorize(actor, "registry.read");
    return this.packageRepository.getPackageManifestById(id);
  }

  exportPackageManifest(input: RegistryPackageExportInput, actor = this.defaultActor): RegistryPackageManifest {
    this.authorize(actor, "registry.read");
    const packageKind = normalizePackageKind(input.packageKind);
    const entries = packageKind === "bundle"
      ? this.bundleEntries(input.entryRefs)
      : [this.entryForTarget(packageKind, requireString(input.targetId, "export.targetId"))];
    const metadata = {
      ...(input.metadata ?? {}),
      artifacts: Object.fromEntries(entries.map((entry) => [entry.id, registryEntityFullSnapshot(this.requireRegistryEntity(entry.kind, entry.id))]))
    };
    const first = entries[0];
    const manifest = createRegistryPackageManifest({
      schemaVersion: "aichestra.registry.package.v1",
      packageKind,
      name: input.name ?? (packageKind === "bundle" ? "registry-bundle" : first.name),
      version: input.version ?? (packageKind === "bundle" ? "1.0.0" : first.version),
      description: input.description ?? `Local ${packageKind} registry package manifest.`,
      owner: input.owner ?? "platform",
      manifestVersion: "1.0.0",
      entries,
      dependencies: input.metadata?.dependencies as RegistryPackageDependency[] | undefined ?? [],
      createdBy: input.createdBy ?? actor.id,
      tags: input.tags ?? [],
      metadata
    });
    const existing = this.packageRepository.getPackageManifestByNameVersion(manifest.name, manifest.version);
    return existing ?? this.packageRepository.createPackageManifest(manifest);
  }

  importPackageManifest(input: RegistryPackageImportInput): RegistryPackageImportResult {
    const actor = actorFromInput(this.defaultActor, input.actor, input.actorId);
    this.authorize(actor, "registry.create");
    const rawManifest = input.manifest;
    const emptyResult = (manifest: RegistryPackageManifest): RegistryPackageImportResult => ({
      dryRun: input.dryRun ?? false,
      imported: false,
      manifest,
      createdEntries: [],
      replacedEntries: [],
      skippedEntries: [],
      warnings: [],
      errors: [],
      auditLogIds: [],
      revisionIds: []
    });
    if (rawManifest.schemaVersion !== "aichestra.registry.package.v1") {
      const result = emptyResult({
        ...rawManifest,
        createdAt: cloneDate(rawManifest.createdAt) ?? new Date()
      });
      result.errors.push(`Unsupported package schemaVersion: ${rawManifest.schemaVersion}`);
      return result;
    }
    let manifest: RegistryPackageManifest;
    try {
      manifest = createRegistryPackageManifest({
        ...rawManifest,
        createdAt: cloneDate(rawManifest.createdAt) ?? new Date()
      });
    } catch (error) {
      const result = emptyResult({
        ...rawManifest,
        createdAt: cloneDate(rawManifest.createdAt) ?? new Date()
      });
      result.errors.push(error instanceof Error ? error.message : "Invalid package manifest");
      return result;
    }
    const importMode = input.importMode ?? "create_only";
    const result: RegistryPackageImportResult = emptyResult(manifest);
    const artifacts = manifest.metadata.artifacts as Record<string, Record<string, unknown>> | undefined;
    for (const entry of manifest.entries) {
      const existing = this.findByNameVersion(entry.kind, entry.name, entry.version);
      if (existing && importMode === "create_only") {
        result.errors.push(`Import conflict for ${entry.kind} ${entry.name}@${entry.version}.`);
        continue;
      }
      if (existing && importMode === "replace_draft_only" && existing.status !== "draft") {
        result.errors.push(`Import cannot replace non-draft ${entry.kind} ${entry.name}@${entry.version}.`);
        continue;
      }
      const snapshot = artifacts?.[entry.id] ?? artifacts?.[`${entry.kind}:${entry.name}@${entry.version}`];
      if (!snapshot) {
        result.errors.push(`Package entry ${entry.kind} ${entry.name}@${entry.version} is missing artifact metadata.`);
        continue;
      }
      if (input.dryRun) {
        result.skippedEntries.push({ kind: entry.kind, id: entry.id, name: entry.name, version: entry.version, checksum: entry.checksum });
        continue;
      }
      if (existing) {
        this.ensureInitialRevision(entry.kind, existing, actor.id);
        const updated = this.replaceRegistryEntity(entry.kind, existing.id, snapshot);
        const audit = this.appendAudit({
          actorId: actor.id,
          action: "update",
          targetKind: entry.kind,
          targetId: updated.id,
          targetName: updated.name,
          targetVersion: updated.version,
          before: registryEntitySnapshot(existing),
          after: registryEntitySnapshot(updated),
          reason: input.reason ?? "package import"
        });
        const revision = this.appendRevisionForEntity(entry.kind, updated, actor.id, input.reason ?? "package import", audit.id);
        result.replacedEntries.push(this.refForEntity(entry.kind, updated));
        result.auditLogIds.push(audit.id);
        result.revisionIds.push(revision.id);
      } else {
        const created = this.createRegistryEntityFromSnapshot(entry.kind, snapshot);
        const audit = this.appendAudit({
          actorId: actor.id,
          action: "create",
          targetKind: entry.kind,
          targetId: created.id,
          targetName: created.name,
          targetVersion: created.version,
          after: registryEntitySnapshot(created),
          reason: input.reason ?? "package import"
        });
        const revision = this.appendRevisionForEntity(entry.kind, created, actor.id, input.reason ?? "package import", audit.id);
        result.createdEntries.push(this.refForEntity(entry.kind, created));
        result.auditLogIds.push(audit.id);
        result.revisionIds.push(revision.id);
      }
    }
    if (result.errors.length === 0 && !input.dryRun) {
      if (!this.packageRepository.getPackageManifestByNameVersion(manifest.name, manifest.version)) {
        this.packageRepository.createPackageManifest(manifest);
      }
      result.imported = true;
    }
    return result;
  }

  diffPackageManifests(from: RegistryPackageManifest, to: RegistryPackageManifest): RegistryPackageDiff {
    return diffRegistryStructures(`${from.name}@${from.version}`, registryEntityFullSnapshot(from), `${to.name}@${to.version}`, registryEntityFullSnapshot(to));
  }

  resolveVersion(kind: RegistryKind, name: string, versionRange: string): RegistryVersionResolution {
    const warnings: string[] = [];
    const errors: string[] = [];
    if (!isSupportedVersionRange(versionRange)) {
      errors.push(`Unsupported version range: ${versionRange}`);
      return { kind, name, requestedRange: versionRange, warnings, errors };
    }
    const candidates = kind === "skill"
      ? this.skillRepository.listSkills().filter((entry) => entry.name === name)
      : kind === "harness"
        ? this.harnessRepository.listHarnesses().filter((entry) => entry.name === name)
        : this.instructionRepository.listInstructions().filter((entry) => entry.name === name);
    candidates.forEach((entry) => addExclusionWarning(warnings, kind, entry));
    const selected = highestCompatible(candidates.filter(selectableRegistryEntry), versionRange);
    if (!selected) errors.push(`No selectable ${kind} version satisfies ${name}@${versionRange}.`);
    return {
      kind,
      name,
      requestedRange: versionRange,
      selected: selected ? this.refForEntity(kind, selected) : undefined,
      warnings: [...new Set(warnings)],
      errors
    };
  }

  resolveRegistryContextForTask(input: Omit<ResolveRegistryContextInput, "skills" | "harnesses" | "instructions">): RegistryResolution {
    return resolveRegistryContextForTask({
      ...input,
      skills: this.listSkills(),
      harnesses: this.listHarnesses(),
      instructions: this.listInstructions()
    });
  }

  listAuditLogs(filter: { targetKind?: RegistryKind; targetId?: string; actor?: RegistryActor } = {}): RegistryAuditLogEntry[] {
    this.authorize(filter.actor ?? this.defaultActor, "registry.audit.read", { targetKind: filter.targetKind, targetId: filter.targetId });
    if (filter.targetKind && filter.targetId) {
      return this.auditRepository.listAuditLogsForTarget(filter.targetKind, filter.targetId);
    }
    return this.auditRepository.listAuditLogs();
  }

  private requireSkill(id: string): SkillPackage {
    const skill = this.getSkill(id);
    if (!skill) throw new Error(`Skill not found: ${id}`);
    return skill;
  }

  private requireHarness(id: string): HarnessPackage {
    const harness = this.getHarness(id);
    if (!harness) throw new Error(`Harness not found: ${id}`);
    return harness;
  }

  private requireInstruction(id: string): InstructionArtifact {
    const instruction = this.getInstruction(id);
    if (!instruction) throw new Error(`Instruction artifact not found: ${id}`);
    return instruction;
  }

  private requireRegistryEntity(kind: RegistryKind, id: string): SkillPackage | HarnessPackage | InstructionArtifact {
    if (kind === "skill") return this.requireSkill(id);
    if (kind === "harness") return this.requireHarness(id);
    return this.requireInstruction(id);
  }

  private findByNameVersion(kind: RegistryKind, name: string, version: string): SkillPackage | HarnessPackage | InstructionArtifact | undefined {
    if (kind === "skill") return this.skillRepository.getSkillByNameVersion(name, version);
    if (kind === "harness") return this.harnessRepository.getHarnessByNameVersion(name, version);
    return this.instructionRepository.getInstructionByNameVersion(name, version);
  }

  private refForEntity(kind: RegistryKind, entity: SkillPackage | HarnessPackage | InstructionArtifact): RegistryVersionRef {
    if (kind === "skill") return registryRefFromSkill(entity as SkillPackage);
    if (kind === "harness") return registryRefFromHarness(entity as HarnessPackage);
    return registryRefFromInstruction(entity as InstructionArtifact);
  }

  private entryForTarget(kind: RegistryKind, id: string): RegistryPackageEntry {
    return packageEntryFromEntity(kind, this.requireRegistryEntity(kind, id));
  }

  private bundleEntries(refs: Array<{ kind: RegistryKind; id: string; required?: boolean }> | undefined): RegistryPackageEntry[] {
    const entries = refs && refs.length > 0
      ? refs.map((ref) => packageEntryFromEntity(ref.kind, this.requireRegistryEntity(ref.kind, ref.id), ref.required ?? true))
      : [
          ...this.skillRepository.listSkills().filter(selectableRegistryEntry).map((entry) => packageEntryFromEntity("skill", entry)),
          ...this.harnessRepository.listHarnesses().filter(selectableRegistryEntry).map((entry) => packageEntryFromEntity("harness", entry)),
          ...this.instructionRepository.listInstructions().filter(selectableRegistryEntry).map((entry) => packageEntryFromEntity("instruction", entry))
        ];
    return entries.sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name) || compareSemver(left.version, right.version));
  }

  private createRegistryEntityFromSnapshot(kind: RegistryKind, snapshot: Record<string, unknown>): SkillPackage | HarnessPackage | InstructionArtifact {
    if (kind === "skill") return this.skillRepository.createSkill(createSkillPackage(reviveSkill(snapshot) as CreateSkillPackageInput));
    if (kind === "harness") return this.harnessRepository.createHarness(createHarnessDefinition(reviveHarness(snapshot) as CreateHarnessDefinitionInput));
    return this.instructionRepository.createInstruction(createInstructionArtifact(reviveInstruction(snapshot) as CreateInstructionArtifactInput));
  }

  private replaceRegistryEntity(kind: RegistryKind, id: string, snapshot: Record<string, unknown>): SkillPackage | HarnessPackage | InstructionArtifact {
    const patch = { ...snapshot, id };
    if (kind === "skill") return this.skillRepository.updateSkill(id, reviveSkill(patch));
    if (kind === "harness") return this.harnessRepository.updateHarness(id, reviveHarness(patch));
    return this.instructionRepository.updateInstruction(id, reviveInstruction(patch));
  }

  private updateEntityEvalStatus(kind: RegistryKind, id: string, evalStatus: EvalStatus): SkillPackage | HarnessPackage | InstructionArtifact {
    if (kind === "skill") return this.skillRepository.updateSkill(id, { evalStatus });
    if (kind === "harness") return this.harnessRepository.updateHarness(id, { evalStatus });
    return this.instructionRepository.updateInstruction(id, { evalStatus });
  }

  private restoreEntityFromRevision(kind: RegistryKind, targetId: string, revision: RegistryRevision, actorId: string): SkillPackage | HarnessPackage | InstructionArtifact {
    const snapshot = { ...revision.snapshot, id: targetId, updatedAt: new Date().toISOString() };
    if (kind === "skill") {
      return this.skillRepository.updateSkill(targetId, reviveSkill(snapshot));
    }
    if (kind === "harness") {
      return this.harnessRepository.updateHarness(targetId, reviveHarness(snapshot));
    }
    return this.instructionRepository.updateInstruction(targetId, reviveInstruction(snapshot, actorId));
  }

  private approvalQueueItemForEntity(kind: RegistryKind, entry: SkillPackage | HarnessPackage | InstructionArtifact): RegistryApprovalQueueItem {
    const logs = this.auditRepository.listAuditLogsForTarget(kind, entry.id);
    const latest = logs.at(-1);
    const blockingReasons = approvalQueueBlockingReasons(entry);
    return {
      id: `approval:${kind}:${entry.id}`,
      targetKind: kind,
      targetId: entry.id,
      targetName: entry.name,
      targetVersion: entry.version,
      approvalStatus: entry.approvalStatus,
      requestedBy: latest?.actorId ?? entry.owner,
      requestedAt: latest?.createdAt ?? entry.updatedAt,
      reason: latest?.reason,
      currentStatus: entry.status,
      evalStatus: entry.evalStatus,
      checksumStatus: "checksumStatus" in entry ? entry.checksumStatus : undefined,
      blockingReasons,
      recommendedAction: approvalQueueRecommendation(entry, blockingReasons)
    };
  }

  private ownerForQueueItem(item: RegistryApprovalQueueItem): string | undefined {
    return this.requireRegistryEntity(item.targetKind, item.targetId).owner;
  }

  private ensureInitialRevision(kind: RegistryKind, entity: SkillPackage | HarnessPackage | InstructionArtifact, actorId: string): void {
    if (!this.historyRepository.getLatestRevisionForTarget(kind, entity.id)) {
      this.appendRevisionForEntity(kind, entity, actorId, "initial snapshot");
    }
  }

  private appendRevisionForEntity(
    kind: RegistryKind,
    entity: SkillPackage | HarnessPackage | InstructionArtifact,
    actorId: string,
    changeReason?: string,
    sourceAuditLogId?: string
  ): RegistryRevision {
    const latest = this.historyRepository.getLatestRevisionForTarget(kind, entity.id);
    const snapshot = registryEntityFullSnapshot(entity);
    return this.historyRepository.appendRevision({
      targetKind: kind,
      targetId: entity.id,
      targetName: entity.name,
      targetVersion: entity.version,
      revisionNumber: (latest?.revisionNumber ?? 0) + 1,
      snapshot,
      snapshotChecksum: registrySnapshotChecksum(snapshot),
      changeReason,
      createdBy: actorId,
      sourceAuditLogId
    });
  }

  private authorize(actor: RegistryActor, permission: RegistryPermission, target: RegistryMutationTarget = {}): void {
    const decision = this.authorizer.authorize(actor, permission, target);
    if (!decision.allowed) {
      throw new RegistryAuthorizationError(decision);
    }
  }

  private appendAudit(input: RegistryAuditInput): RegistryAuditLogEntry {
    return this.auditRepository.appendAuditLog(input);
  }
}

function statusAuditAction(status: RegistryStatus, previousStatus: RegistryStatus): RegistryAuditAction {
  if (status === "archived") return "archive";
  if (previousStatus === "archived" && status === "active") return "restore";
  return "status_change";
}

function approvalAuditAction(status: ApprovalStatus): RegistryAuditAction {
  if (status === "approved") return "approve";
  if (status === "rejected") return "reject";
  return "update";
}

function evalAuditAction(status: EvalStatus): RegistryAuditAction {
  if (status === "passed") return "mark_eval_passed";
  if (status === "failed") return "mark_eval_failed";
  return "update";
}

function evalStatusFromResult(status: RegistryEvalResultStatus): EvalStatus | undefined {
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  if (status === "pending") return "pending";
  return undefined;
}

function approvalQueueBlockingReasons(entry: SkillPackage | HarnessPackage | InstructionArtifact): string[] {
  const reasons: string[] = [];
  if (entry.status !== "active") reasons.push(`lifecycle status is ${entry.status}`);
  if (entry.evalStatus !== "not_required" && entry.evalStatus !== "passed") reasons.push(`evalStatus is ${entry.evalStatus}`);
  if ("checksumStatus" in entry && entry.checksumStatus === "mismatch") reasons.push("checksumStatus is mismatch");
  return reasons;
}

function approvalQueueRecommendation(entry: SkillPackage | HarnessPackage | InstructionArtifact, blockingReasons: string[]): string {
  if (entry.approvalStatus === "pending" && blockingReasons.length === 0) return "review_for_approval";
  if (entry.approvalStatus === "pending") return "resolve_blocking_reasons_before_approval";
  if (entry.approvalStatus === "rejected") return "revise_or_archive";
  return "no_action_required";
}

function reviveDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date) return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function reviveSkill(snapshot: Record<string, unknown>): Partial<SkillPackage> {
  return {
    ...snapshot,
    createdAt: reviveDate(snapshot.createdAt),
    updatedAt: reviveDate(snapshot.updatedAt)
  } as Partial<SkillPackage>;
}

function reviveHarness(snapshot: Record<string, unknown>): Partial<HarnessPackage> {
  return {
    ...snapshot,
    createdAt: reviveDate(snapshot.createdAt),
    updatedAt: reviveDate(snapshot.updatedAt)
  } as Partial<HarnessPackage>;
}

function reviveInstruction(snapshot: Record<string, unknown>, _actorId = "system"): Partial<InstructionArtifact> {
  return {
    ...snapshot,
    checksumVerifiedAt: cloneDate(snapshot.checksumVerifiedAt as Date | string | undefined),
    createdAt: reviveDate(snapshot.createdAt),
    updatedAt: reviveDate(snapshot.updatedAt)
  } as Partial<InstructionArtifact>;
}

export function createRegistryService(input: RegistryServiceInput): RegistryService {
  return new RegistryService(input);
}

export class InMemorySkillRegistry extends InMemoryRegistryBase implements SkillRegistry {
  listSkills(): SkillPackage[] {
    return this.snapshot.skills.map(cloneSkill);
  }

  getSkill(id: string): SkillPackage | undefined {
    const skill = findSkill(this.snapshot, id);
    return skill ? cloneSkill(skill) : undefined;
  }

  createSkill(input: CreateSkillPackageInput): SkillPackage {
    const skill = createSkillPackage(input);
    this.snapshot.skills.push(cloneSkill(skill));
    return skill;
  }

  updateSkillStatus(id: string, status: RegistryStatus): SkillPackage {
    const skill = this.snapshot.skills.find((entry) => entry.id === id);
    if (!skill) throw new Error(`Skill not found: ${id}`);
    skill.status = status;
    skill.updatedAt = new Date();
    return cloneSkill(skill);
  }

  resolveSkillsForTask(input: ResolveRegistryContextInput): RegistryVersionRef[] {
    return resolveRegistryContextForTask(input).selectedSkills;
  }
}

export class InMemoryHarnessRegistry extends InMemoryRegistryBase implements HarnessRegistry {
  listHarnesses(): HarnessPackage[] {
    return this.snapshot.harnesses.map(cloneHarness);
  }

  getHarness(id: string): HarnessPackage | undefined {
    const harness = findHarness(this.snapshot, id);
    return harness ? cloneHarness(harness) : undefined;
  }

  createHarness(input: CreateHarnessDefinitionInput): HarnessPackage {
    const harness = createHarnessDefinition(input);
    this.snapshot.harnesses.push(cloneHarness(harness));
    return harness;
  }

  updateHarnessStatus(id: string, status: RegistryStatus): HarnessPackage {
    const harness = this.snapshot.harnesses.find((entry) => entry.id === id);
    if (!harness) throw new Error(`Harness not found: ${id}`);
    harness.status = status;
    harness.updatedAt = new Date();
    return cloneHarness(harness);
  }

  resolveHarnessForTask(input: ResolveRegistryContextInput): RegistryVersionRef {
    return resolveRegistryContextForTask(input).selectedHarness;
  }
}

export class InMemoryInstructionRegistry extends InMemoryRegistryBase implements InstructionRegistry {
  listInstructions(): InstructionArtifact[] {
    return this.snapshot.instructions.map(cloneInstruction);
  }

  getInstruction(id: string): InstructionArtifact | undefined {
    const instruction = findInstruction(this.snapshot, id);
    return instruction ? cloneInstruction(instruction) : undefined;
  }

  createInstruction(input: CreateInstructionArtifactInput): InstructionArtifact {
    const instruction = createInstructionArtifact(input);
    this.snapshot.instructions.push(cloneInstruction(instruction));
    return instruction;
  }

  updateInstructionStatus(id: string, status: RegistryStatus): InstructionArtifact {
    const instruction = this.snapshot.instructions.find((entry) => entry.id === id);
    if (!instruction) throw new Error(`Instruction artifact not found: ${id}`);
    instruction.status = status;
    instruction.updatedAt = new Date();
    return cloneInstruction(instruction);
  }

  resolveInstructionsForTask(input: ResolveRegistryContextInput): RegistryVersionRef[] {
    return resolveRegistryContextForTask(input).selectedInstructions;
  }
}

export class InMemoryRegistryResolver extends InMemoryRegistryBase implements RegistryResolver {
  resolveRegistryContextForTask(input: ResolveRegistryContextInput): RegistryResolution {
    return resolveRegistryContextForTask(input);
  }
}

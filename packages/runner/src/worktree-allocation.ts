import os from "node:os";
import path from "node:path";
import { createId } from "@aichestra/core";
import type { BranchLease } from "@aichestra/core";
import {
  AgentWorkspaceLifecycleService,
  type AgentWorkspaceLifecycleContext,
  type AgentWorkspaceLease,
  sanitizeWorkspaceLifecycleMetadata,
  sanitizeWorkspacePathForDto
} from "./workspace-lifecycle.ts";

export type AgentWorktreeAllocationMode = "fixture_only" | "dry_run" | "git_worktree_future";

export type AgentWorktreeAllocationDecision =
  | "allocated_fixture"
  | "dry_run_valid"
  | "blocked_root_not_allowed"
  | "blocked_path_collision"
  | "blocked_branch_missing"
  | "blocked_policy"
  | "future_git_worktree_required";

export type AgentWorktreeSafetyCheckKind =
  | "workspace_root_allowed"
  | "path_within_root"
  | "path_not_shared"
  | "branch_lease_present"
  | "branch_name_safe"
  | "no_remote_git"
  | "cleanup_safe"
  | "fixture_only";

export type AgentWorktreeSafetyStatus = "pass" | "warning" | "fail" | "not_applicable";

export type AgentWorktreeSafetySeverity = "low" | "medium" | "high" | "critical";

export type AgentWorktreeAllocationRequest = {
  id: string;
  repoId: string;
  baseRepoPath?: string;
  baseBranch: string;
  branchName: string;
  branchLeaseId: string;
  workspaceLeaseId?: string;
  requestedPath: string;
  workspaceRoot: string;
  agentRunId: string;
  taskId?: string;
  userId?: string;
  allocationMode: AgentWorktreeAllocationMode;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type AgentWorktreeAllocationResult = {
  id: string;
  requestId: string;
  decision: AgentWorktreeAllocationDecision;
  worktreePath?: string;
  sanitizedPath?: string;
  branchName: string;
  workspaceLeaseId?: string;
  branchLeaseId: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type AgentWorktreeSafetyCheck = {
  id: string;
  checkKind: AgentWorktreeSafetyCheckKind;
  status: AgentWorktreeSafetyStatus;
  severity: AgentWorktreeSafetySeverity;
  reason: string;
  metadata: Record<string, unknown>;
};

export type AgentWorktreeAllocationInput = {
  id?: string;
  repoId: string;
  baseRepoPath?: string;
  baseBranch?: string;
  branchName: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  requestedPath: string;
  workspaceRoot: string;
  agentRunId: string;
  taskId?: string;
  userId?: string;
  allocationMode?: AgentWorktreeAllocationMode;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
};

export type AgentWorktreeAllocationContext = AgentWorkspaceLifecycleContext & {
  principalId?: string;
  source?: string;
};

export type AgentWorktreeAllocationQuery = {
  repoId?: string;
  requestId?: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  allocationMode?: AgentWorktreeAllocationMode;
  decision?: AgentWorktreeAllocationDecision;
};

export type AgentWorktreeSafetyCheckQuery = {
  requestId?: string;
  resultId?: string;
  status?: AgentWorktreeSafetyStatus;
  checkKind?: AgentWorktreeSafetyCheckKind;
};

export type AgentWorktreeValidationResult = {
  request: AgentWorktreeAllocationRequest;
  decision: AgentWorktreeAllocationDecision;
  checks: AgentWorktreeSafetyCheck[];
  sanitizedPath?: string;
};

export type AgentWorktreeAllocationSummary = {
  status: "v1_implemented";
  allocationEnabled: false;
  fixtureOnly: true;
  productionWorktreeAllocation: false;
  integrationTestsEnabled: boolean;
  workspaceRootAllowlistConfigured: boolean;
  workspaceRootAllowlistCount: number;
  requests: number;
  allocations: number;
  safetyChecks: number;
  blockedAllocations: number;
  pathCollisionWarnings: number;
  branchLeaseLinkedAllocations: number;
  workspaceLeaseLinkedAllocations: number;
  realGitWorktreeExecuted: false;
  remoteGitOperation: false;
  destructiveCleanupExecuted: false;
  sourceMutation: false;
  secretsExposed: false;
  envValuesExposed: false;
  fullLocalPathsExposed: false;
  metadata: Record<string, unknown>;
};

export type AgentWorktreeAllocationServiceInput = {
  allowedWorkspaceRoots?: string[];
  allocationEnabled?: boolean;
  integrationTestsEnabled?: boolean;
  workspaceLifecycleService?: AgentWorkspaceLifecycleService;
  branchLeaseLookup?: (branchLeaseId: string) => BranchLease | undefined;
  workspaceLeaseLookup?: (workspaceLeaseId: string) => AgentWorkspaceLease | undefined;
  now?: () => Date;
};

type PreparedAllocation = {
  request: AgentWorktreeAllocationRequest;
  fullRequestedPath: string;
  fullWorkspaceRoot: string;
  fullBaseRepoPath?: string;
  lease?: BranchLease;
  checks: AgentWorktreeSafetyCheck[];
  decision: AgentWorktreeAllocationDecision;
};

const activeWorkspaceStatuses = new Set(["requested", "allocated", "active", "frozen", "ready_for_merge", "cleanup_pending"]);
const blockedDecisions = new Set<AgentWorktreeAllocationDecision>([
  "blocked_root_not_allowed",
  "blocked_path_collision",
  "blocked_branch_missing",
  "blocked_policy",
  "future_git_worktree_required"
]);

function flag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function cloneRequest(request: AgentWorktreeAllocationRequest): AgentWorktreeAllocationRequest {
  return structuredClone(request);
}

function cloneResult(result: AgentWorktreeAllocationResult): AgentWorktreeAllocationResult {
  return structuredClone(result);
}

function normalizePath(input: string): string {
  return path.resolve(input);
}

function resolveRequestedPath(workspaceRoot: string, requestedPath: string): string {
  return path.isAbsolute(requestedPath)
    ? normalizePath(requestedPath)
    : normalizePath(path.join(workspaceRoot, requestedPath));
}

function pathKey(input: string): string {
  return normalizePath(input).toLowerCase();
}

function isWithinRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function hasTraversal(input: string): boolean {
  return input.split(/[\\/]+/).some((part) => part === "..");
}

function sanitizePathForDto(input: string | undefined, label = "workspace-path"): string | undefined {
  if (!input) return undefined;
  if (input.startsWith("[")) return input;
  const normalized = path.normalize(input);
  const basename = path.basename(normalized);
  return basename ? `[${label}]/${basename}` : `[${label}]`;
}

function sanitizeMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  const sanitized = sanitizeWorkspaceLifecycleMetadata(metadata);
  return Object.fromEntries(Object.entries(sanitized).map(([key, value]) => {
    if (typeof value === "string" && containsSecretLikeValue(value)) return [key, "[redacted]"];
    if (Array.isArray(value)) {
      return [key, value.map((item) => typeof item === "string" && containsSecretLikeValue(item) ? "[redacted]" : item)];
    }
    return [key, value];
  }));
}

function containsSecretLikeValue(value: string): boolean {
  return /(OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|VAULT_TOKEN|DATABASE_URL|AICHESTRA_[A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD))/i.test(value);
}

function isSafeBranchName(branchName: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = branchName.trim();
  if (!trimmed) return { ok: false, reason: "branch_name_missing" };
  if (trimmed.length > 240) return { ok: false, reason: "branch_name_too_long" };
  if (path.isAbsolute(trimmed) || trimmed.includes("\\") || trimmed.includes("..")) {
    return { ok: false, reason: "branch_name_path_traversal" };
  }
  if (trimmed.includes("@{") || trimmed.includes("//") || trimmed.startsWith("/") || trimmed.endsWith("/")) {
    return { ok: false, reason: "branch_name_invalid_git_ref_shape" };
  }
  if (trimmed.endsWith(".lock") || trimmed.split("/").some((part) => part === "." || part === "")) {
    return { ok: false, reason: "branch_name_invalid_segment" };
  }
  if (/^(head|main|master|develop|release)$/i.test(trimmed)) {
    return { ok: false, reason: "protected_branch_name_requires_orchestrator" };
  }
  if (/(^|\/)(force|delete|branch-d|rm|clean|reset)(\/|$)/i.test(trimmed)) {
    return { ok: false, reason: "branch_name_destructive_keyword" };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(trimmed)) {
    return { ok: false, reason: "branch_name_unsafe_characters" };
  }
  return { ok: true };
}

function createdCheck(
  checkKind: AgentWorktreeSafetyCheckKind,
  status: AgentWorktreeSafetyStatus,
  severity: AgentWorktreeSafetySeverity,
  reason: string,
  metadata: Record<string, unknown>
): AgentWorktreeSafetyCheck {
  return {
    id: createId("agentwtcheck"),
    checkKind,
    status,
    severity,
    reason,
    metadata: sanitizeMetadata(metadata)
  };
}

function decisionFromChecks(mode: AgentWorktreeAllocationMode, checks: AgentWorktreeSafetyCheck[]): AgentWorktreeAllocationDecision {
  const failed = (kind: AgentWorktreeSafetyCheckKind) => checks.some((check) => check.checkKind === kind && check.status === "fail");
  if (failed("workspace_root_allowed") || failed("path_within_root")) return "blocked_root_not_allowed";
  if (failed("path_not_shared")) return "blocked_path_collision";
  if (failed("branch_name_safe")) return "blocked_policy";
  if (failed("branch_lease_present")) return "blocked_branch_missing";
  if (mode === "git_worktree_future") return "future_git_worktree_required";
  return mode === "fixture_only" ? "allocated_fixture" : "dry_run_valid";
}

export class AgentWorktreeAllocationService {
  private readonly allowedWorkspaceRoots: string[];
  private readonly allocationEnabled: boolean;
  private readonly integrationTestsEnabled: boolean;
  private readonly workspaceLifecycleService: AgentWorkspaceLifecycleService;
  private readonly branchLeaseLookup?: (branchLeaseId: string) => BranchLease | undefined;
  private readonly workspaceLeaseLookup?: (workspaceLeaseId: string) => AgentWorkspaceLease | undefined;
  private readonly now: () => Date;
  private readonly requests: AgentWorktreeAllocationRequest[] = [];
  private readonly results: AgentWorktreeAllocationResult[] = [];
  private readonly safetyChecks: AgentWorktreeSafetyCheck[] = [];
  private readonly requestPaths = new Map<string, { requestedPath: string; workspaceRoot: string; baseRepoPath?: string }>();
  private readonly reservedPathByResultId = new Map<string, string>();

  constructor(input: AgentWorktreeAllocationServiceInput = {}) {
    this.allowedWorkspaceRoots = uniquePaths(input.allowedWorkspaceRoots ?? []);
    this.allocationEnabled = input.allocationEnabled === true;
    this.integrationTestsEnabled = input.integrationTestsEnabled === true;
    this.workspaceLifecycleService = input.workspaceLifecycleService ?? new AgentWorkspaceLifecycleService();
    this.branchLeaseLookup = input.branchLeaseLookup;
    this.workspaceLeaseLookup = input.workspaceLeaseLookup;
    this.now = input.now ?? (() => new Date());
  }

  validateRequest(input: AgentWorktreeAllocationInput, context: AgentWorktreeAllocationContext = {}): AgentWorktreeValidationResult {
    const prepared = this.prepare(input, input.allocationMode ?? "dry_run", context);
    this.saveRequestAndChecks(prepared);
    return {
      request: cloneRequest(prepared.request),
      decision: prepared.decision,
      checks: prepared.checks.map((check) => structuredClone(check)),
      sanitizedPath: sanitizeWorkspacePathForDto(prepared.fullRequestedPath)
    };
  }

  dryRunAllocate(input: AgentWorktreeAllocationInput, context: AgentWorktreeAllocationContext = {}): AgentWorktreeAllocationResult {
    const mode = input.allocationMode ?? "dry_run";
    const prepared = this.prepare({ ...input, allocationMode: mode }, mode, context);
    this.saveRequest(prepared);
    return this.saveResult(prepared, undefined);
  }

  async allocateFixtureWorktree(input: AgentWorktreeAllocationInput, context: AgentWorktreeAllocationContext = {}): Promise<AgentWorktreeAllocationResult> {
    const prepared = this.prepare({ ...input, allocationMode: "fixture_only" }, "fixture_only", context);
    this.saveRequest(prepared);

    let workspaceLeaseId = prepared.request.workspaceLeaseId;
    if (prepared.decision === "allocated_fixture") {
      const lease = await this.workspaceLifecycleService.allocateFixtureWorkspace({
        taskId: prepared.request.taskId ?? prepared.request.agentRunId,
        agentRunId: prepared.request.agentRunId,
        repoId: prepared.request.repoId,
        branchLeaseId: prepared.request.branchLeaseId,
        branchName: prepared.request.branchName,
        baseBranch: prepared.request.baseBranch,
        workspacePath: prepared.fullRequestedPath,
        metadata: {
          ...prepared.request.metadata,
          agentWorktreeAllocationRequestId: prepared.request.id,
          fixtureOnly: true,
          realGitWorktreeExecuted: false,
          destructiveCleanupExecuted: false
        }
      }, this.contextForLifecycle(context));
      workspaceLeaseId = lease.id;
      if (lease.status === "failed") {
        prepared.decision = "blocked_policy";
      }
    }

    return this.saveResult(prepared, workspaceLeaseId);
  }

  evaluateSafety(input: AgentWorktreeAllocationInput, context: AgentWorktreeAllocationContext = {}): AgentWorktreeSafetyCheck[] {
    return this.prepare(input, input.allocationMode ?? "dry_run", context).checks.map((check) => structuredClone(check));
  }

  listAllocations(query: AgentWorktreeAllocationQuery = {}): AgentWorktreeAllocationResult[] {
    return this.results
      .filter((result) =>
        (query.requestId === undefined || result.requestId === query.requestId) &&
        (query.branchLeaseId === undefined || result.branchLeaseId === query.branchLeaseId) &&
        (query.workspaceLeaseId === undefined || result.workspaceLeaseId === query.workspaceLeaseId) &&
        (query.decision === undefined || result.decision === query.decision) &&
        (query.repoId === undefined || this.requests.find((request) => request.id === result.requestId)?.repoId === query.repoId) &&
        (query.allocationMode === undefined || this.requests.find((request) => request.id === result.requestId)?.allocationMode === query.allocationMode)
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(cloneResult);
  }

  listRequests(query: Pick<AgentWorktreeAllocationQuery, "repoId" | "branchLeaseId" | "workspaceLeaseId" | "allocationMode"> = {}): AgentWorktreeAllocationRequest[] {
    return this.requests
      .filter((request) =>
        (query.repoId === undefined || request.repoId === query.repoId) &&
        (query.branchLeaseId === undefined || request.branchLeaseId === query.branchLeaseId) &&
        (query.workspaceLeaseId === undefined || request.workspaceLeaseId === query.workspaceLeaseId) &&
        (query.allocationMode === undefined || request.allocationMode === query.allocationMode)
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(cloneRequest);
  }

  getAllocation(id: string): AgentWorktreeAllocationResult | undefined {
    const result = this.results.find((candidate) => candidate.id === id);
    return result ? cloneResult(result) : undefined;
  }

  listSafetyChecks(query: AgentWorktreeSafetyCheckQuery = {}): AgentWorktreeSafetyCheck[] {
    return this.safetyChecks
      .filter((check) =>
        (query.status === undefined || check.status === query.status) &&
        (query.checkKind === undefined || check.checkKind === query.checkKind) &&
        (query.requestId === undefined || check.metadata.requestId === query.requestId) &&
        (query.resultId === undefined || check.metadata.resultId === query.resultId)
      )
      .map((check) => structuredClone(check));
  }

  getSummary(): AgentWorktreeAllocationSummary {
    const allocations = this.listAllocations();
    const blockedAllocations = allocations.filter((allocation) => blockedDecisions.has(allocation.decision)).length;
    return {
      status: "v1_implemented",
      allocationEnabled: false,
      fixtureOnly: true,
      productionWorktreeAllocation: false,
      integrationTestsEnabled: this.integrationTestsEnabled,
      workspaceRootAllowlistConfigured: this.allowedWorkspaceRoots.length > 0,
      workspaceRootAllowlistCount: this.allowedWorkspaceRoots.length,
      requests: this.requests.length,
      allocations: allocations.length,
      safetyChecks: this.safetyChecks.length,
      blockedAllocations,
      pathCollisionWarnings: this.safetyChecks.filter((check) => check.checkKind === "path_not_shared" && check.status === "fail").length,
      branchLeaseLinkedAllocations: allocations.filter((allocation) => allocation.branchLeaseId.length > 0).length,
      workspaceLeaseLinkedAllocations: allocations.filter((allocation) => allocation.workspaceLeaseId !== undefined).length,
      realGitWorktreeExecuted: false,
      remoteGitOperation: false,
      destructiveCleanupExecuted: false,
      sourceMutation: false,
      secretsExposed: false,
      envValuesExposed: false,
      fullLocalPathsExposed: false,
      metadata: {
        allocationGateConfigured: this.allocationEnabled,
        defaultRuntimeSafe: true,
        workspaceRootValuesExposed: false,
        noRealGitWorktreeAddRemove: true
      }
    };
  }

  private prepare(
    input: AgentWorktreeAllocationInput,
    mode: AgentWorktreeAllocationMode,
    context: AgentWorktreeAllocationContext
  ): PreparedAllocation {
    const fullWorkspaceRoot = normalizePath(input.workspaceRoot);
    const fullRequestedPath = resolveRequestedPath(fullWorkspaceRoot, input.requestedPath);
    const fullBaseRepoPath = input.baseRepoPath ? normalizePath(input.baseRepoPath) : undefined;
    const request: AgentWorktreeAllocationRequest = {
      id: input.id ?? createId("agentwtrequest"),
      repoId: input.repoId,
      baseRepoPath: sanitizePathForDto(fullBaseRepoPath, "repo-path"),
      baseBranch: input.baseBranch ?? "main",
      branchName: input.branchName,
      branchLeaseId: input.branchLeaseId ?? "",
      workspaceLeaseId: input.workspaceLeaseId,
      requestedPath: sanitizeWorkspacePathForDto(fullRequestedPath),
      workspaceRoot: sanitizePathForDto(fullWorkspaceRoot, "workspace-root") ?? "[workspace-root]",
      agentRunId: input.agentRunId,
      taskId: input.taskId,
      userId: input.userId,
      allocationMode: mode,
      createdAt: input.createdAt ?? this.now(),
      metadata: sanitizeMetadata({
        ...input.metadata,
        requestContext: {
          actorId: context.actorId,
          principalId: context.principalId,
          serviceAccountId: context.serviceAccountId,
          requestId: context.requestId,
          correlationId: context.correlationId,
          source: context.source
        },
        realGitWorktreeExecuted: false,
        remoteGitOperation: false,
        destructiveCleanupExecuted: false,
        envValuesExposed: false
      })
    };
    const lease = input.branchLeaseId ? this.branchLeaseLookup?.(input.branchLeaseId) : undefined;
    const checks = this.buildChecks(request, fullRequestedPath, fullWorkspaceRoot, input.requestedPath, lease);
    return {
      request,
      fullRequestedPath,
      fullWorkspaceRoot,
      fullBaseRepoPath,
      lease,
      checks,
      decision: decisionFromChecks(mode, checks)
    };
  }

  private buildChecks(
    request: AgentWorktreeAllocationRequest,
    fullRequestedPath: string,
    fullWorkspaceRoot: string,
    originalRequestedPath: string,
    lease: BranchLease | undefined
  ): AgentWorktreeSafetyCheck[] {
    const rootAllowed = this.allowedWorkspaceRoots.some((root) => pathKey(root) === pathKey(fullWorkspaceRoot) || isWithinRoot(fullWorkspaceRoot, root));
    const branchValidation = isSafeBranchName(request.branchName);
    const existingWorkspace = request.workspaceLeaseId ? this.workspaceLeaseLookup?.(request.workspaceLeaseId) : undefined;
    const pathWithinRoot = isWithinRoot(fullRequestedPath, fullWorkspaceRoot) && !hasTraversal(originalRequestedPath);
    const sharedPath = this.isSharedPath(fullRequestedPath, request.agentRunId);
    const branchLeaseOk = Boolean(request.branchLeaseId) &&
      (this.branchLeaseLookup === undefined || (
        lease !== undefined &&
        lease.status === "active" &&
        lease.repoId === request.repoId &&
        lease.branchName === request.branchName &&
        lease.baseBranch === request.baseBranch
      ));

    return [
      createdCheck(
        "workspace_root_allowed",
        rootAllowed ? "pass" : "fail",
        rootAllowed ? "low" : "critical",
        rootAllowed ? "workspace_root_allowlisted" : this.allowedWorkspaceRoots.length === 0 ? "workspace_root_allowlist_empty" : "workspace_root_not_allowed",
        {
          requestId: request.id,
          workspaceRootConfigured: true,
          workspaceRootAllowlistCount: this.allowedWorkspaceRoots.length,
          workspaceRootValuesExposed: false
        }
      ),
      createdCheck(
        "path_within_root",
        pathWithinRoot ? "pass" : "fail",
        pathWithinRoot ? "low" : "critical",
        pathWithinRoot ? "requested_path_within_workspace_root" : "requested_path_outside_workspace_root_or_traversal",
        {
          requestId: request.id,
          requestedPath: sanitizeWorkspacePathForDto(fullRequestedPath),
          workspaceRoot: sanitizePathForDto(fullWorkspaceRoot, "workspace-root")
        }
      ),
      createdCheck(
        "path_not_shared",
        sharedPath ? "fail" : "pass",
        sharedPath ? "high" : "low",
        sharedPath ? "worktree_path_already_reserved_or_active" : "worktree_path_not_shared",
        {
          requestId: request.id,
          requestedPath: sanitizeWorkspacePathForDto(fullRequestedPath)
        }
      ),
      createdCheck(
        "branch_lease_present",
        branchLeaseOk ? "pass" : "fail",
        branchLeaseOk ? "low" : "high",
        branchLeaseOk ? "active_branch_lease_matches_request" : "active_branch_lease_missing_or_mismatch",
        {
          requestId: request.id,
          branchLeaseId: request.branchLeaseId || undefined,
          branchLeaseLookupConfigured: this.branchLeaseLookup !== undefined,
          branchLeaseStatus: lease?.status,
          workspaceLeaseLinked: existingWorkspace !== undefined
        }
      ),
      createdCheck(
        "branch_name_safe",
        branchValidation.ok ? "pass" : "fail",
        branchValidation.ok ? "low" : "high",
        branchValidation.ok ? "branch_name_matches_safe_policy" : branchValidation.reason,
        {
          requestId: request.id,
          branchName: request.branchName
        }
      ),
      createdCheck(
        "no_remote_git",
        "pass",
        "low",
        "remote_git_operations_disabled",
        {
          requestId: request.id,
          remoteGitOperation: false,
          gitFetchPushMergeRebase: false
        }
      ),
      createdCheck(
        "cleanup_safe",
        "pass",
        "low",
        "destructive_cleanup_disabled",
        {
          requestId: request.id,
          destructiveCleanupExecuted: false,
          nonFixtureDeletionAllowed: false
        }
      ),
      createdCheck(
        "fixture_only",
        request.allocationMode === "git_worktree_future" ? "warning" : "pass",
        request.allocationMode === "git_worktree_future" ? "high" : "low",
        request.allocationMode === "git_worktree_future" ? "production_git_worktree_allocation_disabled" : "fixture_or_dry_run_mode_only",
        {
          requestId: request.id,
          allocationMode: request.allocationMode,
          productionWorktreeAllocation: false,
          realGitWorktreeExecuted: false
        }
      )
    ];
  }

  private saveRequestAndChecks(prepared: PreparedAllocation): void {
    this.saveRequest(prepared);
    this.safetyChecks.push(...prepared.checks.map((check) => structuredClone(check)));
  }

  private saveRequest(prepared: PreparedAllocation): void {
    this.requests.push(cloneRequest(prepared.request));
    this.requestPaths.set(prepared.request.id, {
      requestedPath: prepared.fullRequestedPath,
      workspaceRoot: prepared.fullWorkspaceRoot,
      baseRepoPath: prepared.fullBaseRepoPath
    });
  }

  private saveResult(prepared: PreparedAllocation, workspaceLeaseId: string | undefined): AgentWorktreeAllocationResult {
    const result: AgentWorktreeAllocationResult = {
      id: createId("agentwtresult"),
      requestId: prepared.request.id,
      decision: prepared.decision,
      worktreePath: sanitizeWorkspacePathForDto(prepared.fullRequestedPath),
      sanitizedPath: sanitizeWorkspacePathForDto(prepared.fullRequestedPath),
      branchName: prepared.request.branchName,
      workspaceLeaseId,
      branchLeaseId: prepared.request.branchLeaseId,
      createdAt: this.now(),
      metadata: sanitizeMetadata({
        requestId: prepared.request.id,
        repoId: prepared.request.repoId,
        allocationMode: prepared.request.allocationMode,
        applyAllowed: false,
        productionWorktreeAllocation: false,
        realGitWorktreeExecuted: false,
        remoteGitOperation: false,
        destructiveCleanupExecuted: false,
        sourceMutation: false,
        fixtureOnly: prepared.request.allocationMode !== "git_worktree_future",
        safetyCheckIds: prepared.checks.map((check) => check.id),
        safetyChecksPassed: prepared.checks.every((check) => check.status !== "fail")
      })
    };
    this.results.push(cloneResult(result));
    if (result.decision === "allocated_fixture" || result.decision === "dry_run_valid") {
      this.reservedPathByResultId.set(result.id, prepared.fullRequestedPath);
    }
    const resultSafetyChecks = prepared.checks.map((check) => ({
      ...check,
      id: createId("agentwtcheck"),
      metadata: sanitizeMetadata({
        ...check.metadata,
        resultId: result.id
      })
    }));
    this.safetyChecks.push(...resultSafetyChecks);
    return cloneResult(result);
  }

  private isSharedPath(fullRequestedPath: string, agentRunId: string): boolean {
    const requestedKey = pathKey(fullRequestedPath);
    const reservedCollision = [...this.reservedPathByResultId.values()].some((reservedPath) => pathKey(reservedPath) === requestedKey);
    if (reservedCollision) return true;
    const activeWorkspaceCollision = this.workspaceLifecycleService.listWorkspaces()
      .some((workspace) =>
        workspace.agentRunId !== agentRunId &&
        activeWorkspaceStatuses.has(workspace.status) &&
        pathKey(workspace.workspacePath) === requestedKey
      );
    return activeWorkspaceCollision;
  }

  private contextForLifecycle(context: AgentWorktreeAllocationContext): AgentWorkspaceLifecycleContext {
    return {
      actorId: context.actorId,
      serviceAccountId: context.serviceAccountId,
      requestId: context.requestId,
      correlationId: context.correlationId,
      metadata: sanitizeMetadata({
        ...context.metadata,
        source: context.source ?? "agent_worktree_allocation_service",
        metadataOnly: true,
        realGitWorktreeExecuted: false
      })
    };
  }
}

export function createAgentWorktreeAllocationServiceFromEnv(
  env: Record<string, string | undefined> = process.env,
  input: Omit<AgentWorktreeAllocationServiceInput, "allowedWorkspaceRoots" | "allocationEnabled" | "integrationTestsEnabled"> = {}
): AgentWorktreeAllocationService {
  const roots = (env.AICHESTRA_WORKSPACE_ROOT_ALLOWLIST ?? "")
    .split(",")
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);
  if (roots.length === 0 && env.AICHESTRA_AGENT_WORKSPACE_ROOT) {
    roots.push(env.AICHESTRA_AGENT_WORKSPACE_ROOT);
  }
  if (roots.length === 0 && flag(env.AICHESTRA_AGENT_WORKTREE_INTEGRATION_TESTS)) {
    roots.push(path.join(os.tmpdir(), "aichestra-agent-worktrees"));
  }
  return new AgentWorktreeAllocationService({
    ...input,
    allowedWorkspaceRoots: roots,
    allocationEnabled: flag(env.AICHESTRA_ENABLE_AGENT_WORKTREE_ALLOCATION),
    integrationTestsEnabled: flag(env.AICHESTRA_AGENT_WORKTREE_INTEGRATION_TESTS)
  });
}

export function agentWorktreeAllocationRequestToDto(request: AgentWorktreeAllocationRequest) {
  return {
    ...request,
    createdAt: request.createdAt.toISOString(),
    metadata: sanitizeMetadata(request.metadata)
  };
}

export function agentWorktreeAllocationResultToDto(result: AgentWorktreeAllocationResult) {
  return {
    ...result,
    createdAt: result.createdAt.toISOString(),
    metadata: sanitizeMetadata(result.metadata)
  };
}

export function agentWorktreeSafetyCheckToDto(check: AgentWorktreeSafetyCheck) {
  return {
    ...check,
    metadata: sanitizeMetadata(check.metadata)
  };
}

export function agentWorktreeAllocationSummaryToDto(summary: AgentWorktreeAllocationSummary) {
  return {
    ...summary,
    metadata: sanitizeMetadata(summary.metadata)
  };
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((candidate) => normalizePath(candidate)))];
}

import path from "node:path";
import { NotFoundError } from "@aichestra/core";
import type { BranchLeaseStatus, MergeSimulationMode, MergeSimulationStatus } from "@aichestra/core";
import type { InMemoryAichestraStore } from "@aichestra/db";
import { LocalGitDryRunMergeSimulator, MockMergeSimulator } from "@aichestra/git-adapter";

export type CollaborationApiServiceContext = {
  store: InMemoryAichestraStore;
};

export type ApiServiceResult = {
  statusCode: number;
  body: Record<string, unknown> | unknown[];
};

export type MergeSimulationRequestBody = Record<string, unknown>;

function notFound(resource: string, id: string): never {
  throw new NotFoundError(resource, id);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isMergeSimulationStatus(value: unknown): value is MergeSimulationStatus {
  return value === "clean" || value === "text_conflict" || value === "failed" || value === "unavailable";
}

function allowedLocalRepoPrefixes(env: Record<string, string | undefined> = process.env): string[] {
  return (env.AICHESTRA_ALLOWED_REPO_PATHS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
}

function isRepoPathAllowlisted(repoPath: string, prefixes = allowedLocalRepoPrefixes()): boolean {
  const resolved = path.resolve(repoPath);
  return prefixes.some((prefix) => resolved === prefix || resolved.startsWith(`${prefix}${path.sep}`));
}

export class CollaborationApiService {
  private readonly context: CollaborationApiServiceContext;

  constructor(context: CollaborationApiServiceContext) {
    this.context = context;
  }

  listBranchLeases(query: URLSearchParams): ApiServiceResult {
    const repoId = query.get("repoId") ?? undefined;
    const status = query.get("status") as BranchLeaseStatus | null;
    return {
      statusCode: 200,
      body: { branchLeases: this.context.store.listBranchLeases(repoId, status ?? undefined) }
    };
  }

  listConflictRisks(query: URLSearchParams): ApiServiceResult {
    const store = this.context.store;
    const repoId = query.get("repoId") ?? undefined;
    const taskRunId = query.get("taskRunId") ?? undefined;
    const conflictRisks = taskRunId
      ? store.computeConflictRisksForTaskRun(taskRunId)
      : repoId
        ? store.computeRepoConflictRisks(repoId)
        : store.listRepos().flatMap((repo) => store.computeRepoConflictRisks(repo.id));
    return { statusCode: 200, body: { conflictRisks } };
  }

  listMergeSimulations(query: URLSearchParams): ApiServiceResult {
    return {
      statusCode: 200,
      body: {
        mergeSimulations: this.context.store.listMergeSimulations({
          repoId: query.get("repoId") ?? undefined,
          taskRunId: query.get("taskRunId") ?? undefined,
          branchLeaseId: query.get("branchLeaseId") ?? undefined
        })
      }
    };
  }

  async createMergeSimulation(body: MergeSimulationRequestBody): Promise<ApiServiceResult> {
    const store = this.context.store;
    const branchLeaseId = stringValue(body.branchLeaseId);
    const lease = branchLeaseId ? store.getBranchLease(branchLeaseId) ?? notFound("branch lease", branchLeaseId) : undefined;
    const mode: MergeSimulationMode = body.mode === "local_git_merge_tree" ? "local_git_merge_tree" : "mock";
    const repoId = stringValue(body.repoId) ?? lease?.repoId;
    const baseRef = stringValue(body.baseRef) ?? lease?.baseBranch;
    const sourceRef = stringValue(body.sourceRef) ?? lease?.branchName;
    if (!repoId || !baseRef || !sourceRef) {
      return {
        statusCode: 400,
        body: {
          error: "invalid_merge_simulation_request",
          message: "repoId, baseRef, and sourceRef are required unless branchLeaseId supplies them."
        }
      };
    }

    const simulator = mode === "local_git_merge_tree" ? new LocalGitDryRunMergeSimulator() : new MockMergeSimulator();
    const repoPath = stringValue(body.repoPath);
    if (mode === "local_git_merge_tree") {
      if (!repoPath) {
        return {
          statusCode: 400,
          body: { error: "repo_path_required", message: "local_git_merge_tree mode requires repoPath." }
        };
      }
      if (!isRepoPathAllowlisted(repoPath)) {
        return {
          statusCode: 400,
          body: {
            error: "repo_path_not_allowlisted",
            message: "repoPath must be under AICHESTRA_ALLOWED_REPO_PATHS for local dry-run simulation."
          }
        };
      }
    }

    const mergeSimulation = await simulator.simulate({
      repoId,
      repoPath,
      baseRef,
      sourceRef,
      targetRef: stringValue(body.targetRef) ?? baseRef,
      taskRunId: stringValue(body.taskRunId) ?? lease?.taskRunId,
      branchLeaseId,
      mode,
      requestedStatus: isMergeSimulationStatus(body.requestedStatus)
        ? body.requestedStatus
        : isMergeSimulationStatus(body.status)
          ? body.status
          : undefined
    });
    store.recordMergeSimulation(mergeSimulation);
    return {
      statusCode: 201,
      body: {
        mergeSimulation,
        mergeQueue: branchLeaseId
          ? store.listMergeQueueEntries(repoId).filter((entry) => entry.branchLeaseId === branchLeaseId)
          : []
      }
    };
  }

  listMergeQueue(query: URLSearchParams): ApiServiceResult {
    const repoId = query.get("repoId") ?? undefined;
    return { statusCode: 200, body: { mergeQueue: this.context.store.listMergeQueueEntries(repoId) } };
  }

  markMergeQueueEntryMerged(entryId: string | undefined): ApiServiceResult {
    if (!entryId) notFound("merge queue entry", "");
    if (!this.context.store.getMergeQueueEntry(entryId)) notFound("merge queue entry", entryId);
    return { statusCode: 200, body: { mergeQueueEntry: this.context.store.markMergeQueueEntryMerged(entryId) } };
  }

  cancelMergeQueueEntry(entryId: string | undefined, reason?: string): ApiServiceResult {
    if (!entryId) notFound("merge queue entry", "");
    if (!this.context.store.getMergeQueueEntry(entryId)) notFound("merge queue entry", entryId);
    return { statusCode: 200, body: { mergeQueueEntry: this.context.store.cancelMergeQueueEntry(entryId, reason) } };
  }
}

export function createCollaborationApiService(context: CollaborationApiServiceContext): CollaborationApiService {
  return new CollaborationApiService(context);
}

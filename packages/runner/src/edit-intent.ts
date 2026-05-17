import path from "node:path";
import { createHash } from "node:crypto";
import { createId, slugify } from "@aichestra/core";

export type FileLeaseKind = "read" | "write_intent" | "exclusive_write_future" | "review";

export type FileLeaseStatus =
  | "requested"
  | "active"
  | "warning_overlap"
  | "blocked_overlap"
  | "released"
  | "expired";

export type EditIntentKind =
  | "modify"
  | "create"
  | "delete_future"
  | "rename_future"
  | "read_only"
  | "refactor"
  | "test_update"
  | "docs_update";

export type EditIntentConfidence = "low" | "medium" | "high";

export type EditIntentStatus = "declared" | "active" | "completed" | "abandoned" | "expired";

export type EditIntentGraphNodeKind = "session" | "file" | "directory" | "branch" | "workspace" | "task";

export type EditIntentGraphEdgeKind =
  | "intends_to_edit"
  | "leases_file"
  | "overlaps_with"
  | "same_directory"
  | "same_branch"
  | "same_workspace"
  | "future_symbol_overlap";

export type EditOverlapKind =
  | "same_file"
  | "same_directory"
  | "same_branch"
  | "same_workspace"
  | "same_symbol_future"
  | "broad_unknown";

export type EditOverlapSeverity = "low" | "medium" | "high" | "critical";

export type EditOverlapRecommendation =
  | "allow"
  | "warn"
  | "serialize"
  | "split_files"
  | "require_review"
  | "block";

export type FileLease = {
  id: string;
  repoId: string;
  filePath: string;
  filePathHash?: string;
  leaseKind: FileLeaseKind;
  ownerSessionId: string;
  ownerAgentRunId?: string;
  ownerTaskId?: string;
  ownerActorId?: string;
  branchName: string;
  workspaceLeaseId?: string;
  status: FileLeaseStatus;
  createdAt: Date;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
};

export type EditIntent = {
  id: string;
  repoId: string;
  sessionId: string;
  agentRunId?: string;
  taskId?: string;
  branchName: string;
  workspaceLeaseId?: string;
  intentKind: EditIntentKind;
  filePaths: string[];
  directoryScopes: string[];
  declaredSymbols?: string[];
  confidence: EditIntentConfidence;
  status: EditIntentStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type EditIntentGraphNode = {
  id: string;
  nodeKind: EditIntentGraphNodeKind;
  nodeId: string;
  metadata: Record<string, unknown>;
};

export type EditIntentGraphEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  edgeKind: EditIntentGraphEdgeKind;
  severity: EditOverlapSeverity;
  metadata: Record<string, unknown>;
};

export type EditOverlapAssessment = {
  id: string;
  repoId: string;
  sessionIds: string[];
  overlapKind: EditOverlapKind;
  files: string[];
  directories: string[];
  severity: EditOverlapSeverity;
  recommendation: EditOverlapRecommendation;
  reason: string;
  metadata: Record<string, unknown>;
};

export type EditIntentGraph = {
  repoId: string;
  nodes: EditIntentGraphNode[];
  edges: EditIntentGraphEdge[];
  assessments: EditOverlapAssessment[];
  metadata: Record<string, unknown>;
};

export type EditIntentOverlapSummary = {
  repoId?: string;
  activeIntents: number;
  activeFileLeases: number;
  graphNodes: number;
  graphEdges: number;
  overlapAssessments: number;
  sameFileOverlaps: number;
  sameDirectoryOverlaps: number;
  sameWorkspaceConflicts: number;
  broadUnknownWarnings: number;
  highestSeverity?: EditOverlapSeverity;
  recommendation: EditOverlapRecommendation;
  noFileLocks: true;
  noSourceMutation: true;
  remoteGitOperation: false;
  secretsExposed: false;
  metadata: Record<string, unknown>;
};

export type EditIntentGraphContext = {
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type DeclareEditIntentInput = {
  id?: string;
  repoId: string;
  sessionId: string;
  agentRunId?: string;
  taskId?: string;
  branchName: string;
  workspaceLeaseId?: string;
  intentKind: EditIntentKind;
  filePaths?: string[];
  directoryScopes?: string[];
  declaredSymbols?: string[];
  confidence?: EditIntentConfidence;
  status?: EditIntentStatus;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

export type RequestFileLeaseInput = {
  id?: string;
  repoId: string;
  filePath: string;
  leaseKind: FileLeaseKind;
  ownerSessionId: string;
  ownerAgentRunId?: string;
  ownerTaskId?: string;
  ownerActorId?: string;
  branchName: string;
  workspaceLeaseId?: string;
  status?: FileLeaseStatus;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

export type FileLeaseQuery = {
  repoId?: string;
  ownerSessionId?: string;
  ownerAgentRunId?: string;
  ownerTaskId?: string;
  status?: FileLeaseStatus;
  leaseKind?: FileLeaseKind;
  workspaceLeaseId?: string;
};

export type EditIntentQuery = {
  repoId?: string;
  sessionId?: string;
  agentRunId?: string;
  taskId?: string;
  status?: EditIntentStatus;
  intentKind?: EditIntentKind;
  workspaceLeaseId?: string;
};

export type EditIntentGraphQuery = {
  repoId?: string;
  nodeKind?: EditIntentGraphNodeKind;
  edgeKind?: EditIntentGraphEdgeKind;
};

export type EditOverlapAssessmentQuery = {
  repoId?: string;
  sessionId?: string;
  severity?: EditOverlapSeverity;
  recommendation?: EditOverlapRecommendation;
  overlapKind?: EditOverlapKind;
};

export type EditIntentGraphRepository = {
  saveFileLease(lease: FileLease): FileLease;
  updateFileLease(id: string, patch: Partial<Omit<FileLease, "id" | "createdAt">>): FileLease;
  getFileLease(id: string): FileLease | undefined;
  listFileLeases(query?: FileLeaseQuery): FileLease[];
  saveEditIntent(intent: EditIntent): EditIntent;
  updateEditIntent(id: string, patch: Partial<Omit<EditIntent, "id" | "createdAt">>): EditIntent;
  getEditIntent(id: string): EditIntent | undefined;
  listEditIntents(query?: EditIntentQuery): EditIntent[];
  replaceOverlapAssessments(repoId: string, assessments: EditOverlapAssessment[]): EditOverlapAssessment[];
  listOverlapAssessments(query?: EditOverlapAssessmentQuery): EditOverlapAssessment[];
};

export type EditIntentGraphServiceOptions = {
  repository?: EditIntentGraphRepository;
};

const activeLeaseStatuses = new Set<FileLeaseStatus>(["requested", "active", "warning_overlap", "blocked_overlap"]);
const activeIntentStatuses = new Set<EditIntentStatus>(["declared", "active"]);

const severityRank: Record<EditOverlapSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const recommendationRank: Record<EditOverlapRecommendation, number> = {
  allow: 0,
  warn: 1,
  split_files: 2,
  serialize: 3,
  require_review: 4,
  block: 5
};

export class InMemoryEditIntentGraphRepository implements EditIntentGraphRepository {
  private readonly leases: FileLease[] = [];
  private readonly intents: EditIntent[] = [];
  private readonly assessments: EditOverlapAssessment[] = [];

  saveFileLease(lease: FileLease): FileLease {
    this.leases.push(clone(lease));
    return clone(lease);
  }

  updateFileLease(id: string, patch: Partial<Omit<FileLease, "id" | "createdAt">>): FileLease {
    const lease = this.leases.find((candidate) => candidate.id === id);
    if (!lease) {
      throw new Error(`File lease not found: ${id}`);
    }
    Object.assign(lease, clone(patch));
    return clone(lease);
  }

  getFileLease(id: string): FileLease | undefined {
    const lease = this.leases.find((candidate) => candidate.id === id);
    return lease ? clone(lease) : undefined;
  }

  listFileLeases(query: FileLeaseQuery = {}): FileLease[] {
    return this.leases
      .filter((lease) =>
        (query.repoId === undefined || lease.repoId === query.repoId) &&
        (query.ownerSessionId === undefined || lease.ownerSessionId === query.ownerSessionId) &&
        (query.ownerAgentRunId === undefined || lease.ownerAgentRunId === query.ownerAgentRunId) &&
        (query.ownerTaskId === undefined || lease.ownerTaskId === query.ownerTaskId) &&
        (query.status === undefined || lease.status === query.status) &&
        (query.leaseKind === undefined || lease.leaseKind === query.leaseKind) &&
        (query.workspaceLeaseId === undefined || lease.workspaceLeaseId === query.workspaceLeaseId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((lease) => clone(lease));
  }

  saveEditIntent(intent: EditIntent): EditIntent {
    this.intents.push(clone(intent));
    return clone(intent);
  }

  updateEditIntent(id: string, patch: Partial<Omit<EditIntent, "id" | "createdAt">>): EditIntent {
    const intent = this.intents.find((candidate) => candidate.id === id);
    if (!intent) {
      throw new Error(`Edit intent not found: ${id}`);
    }
    Object.assign(intent, clone(patch), { updatedAt: patch.updatedAt ?? new Date() });
    return clone(intent);
  }

  getEditIntent(id: string): EditIntent | undefined {
    const intent = this.intents.find((candidate) => candidate.id === id);
    return intent ? clone(intent) : undefined;
  }

  listEditIntents(query: EditIntentQuery = {}): EditIntent[] {
    return this.intents
      .filter((intent) =>
        (query.repoId === undefined || intent.repoId === query.repoId) &&
        (query.sessionId === undefined || intent.sessionId === query.sessionId) &&
        (query.agentRunId === undefined || intent.agentRunId === query.agentRunId) &&
        (query.taskId === undefined || intent.taskId === query.taskId) &&
        (query.status === undefined || intent.status === query.status) &&
        (query.intentKind === undefined || intent.intentKind === query.intentKind) &&
        (query.workspaceLeaseId === undefined || intent.workspaceLeaseId === query.workspaceLeaseId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((intent) => clone(intent));
  }

  replaceOverlapAssessments(repoId: string, assessments: EditOverlapAssessment[]): EditOverlapAssessment[] {
    for (let index = this.assessments.length - 1; index >= 0; index -= 1) {
      if (this.assessments[index]?.repoId === repoId) {
        this.assessments.splice(index, 1);
      }
    }
    this.assessments.push(...assessments.map((assessment) => clone(assessment)));
    return assessments.map((assessment) => clone(assessment));
  }

  listOverlapAssessments(query: EditOverlapAssessmentQuery = {}): EditOverlapAssessment[] {
    return this.assessments
      .filter((assessment) =>
        (query.repoId === undefined || assessment.repoId === query.repoId) &&
        (query.sessionId === undefined || assessment.sessionIds.includes(query.sessionId)) &&
        (query.severity === undefined || assessment.severity === query.severity) &&
        (query.recommendation === undefined || assessment.recommendation === query.recommendation) &&
        (query.overlapKind === undefined || assessment.overlapKind === query.overlapKind))
      .sort((left, right) =>
        severityRank[right.severity] - severityRank[left.severity] ||
        recommendationRank[right.recommendation] - recommendationRank[left.recommendation] ||
        left.id.localeCompare(right.id))
      .map((assessment) => clone(assessment));
  }
}

export class EditIntentGraphService {
  private readonly repository: EditIntentGraphRepository;

  constructor(options: EditIntentGraphServiceOptions = {}) {
    this.repository = options.repository ?? new InMemoryEditIntentGraphRepository();
  }

  declareIntent(input: DeclareEditIntentInput, context: EditIntentGraphContext = {}): EditIntent {
    const now = input.createdAt ?? new Date();
    const intent = this.repository.saveEditIntent({
      id: input.id ?? createId("editintent"),
      repoId: input.repoId,
      sessionId: input.sessionId,
      agentRunId: input.agentRunId,
      taskId: input.taskId,
      branchName: input.branchName,
      workspaceLeaseId: input.workspaceLeaseId,
      intentKind: input.intentKind,
      filePaths: normalizeFilePaths(input.filePaths ?? []),
      directoryScopes: normalizeDirectories(input.directoryScopes ?? []),
      declaredSymbols: normalizeSymbols(input.declaredSymbols),
      confidence: input.confidence ?? "medium",
      status: input.status ?? "declared",
      createdAt: now,
      updatedAt: now,
      metadata: sanitizeEditIntentMetadata({
        ...input.metadata,
        ...contextMetadata(context),
        noFileLocks: true,
        noSourceMutation: true,
        remoteGitOperation: false
      })
    });
    this.evaluateOverlaps(intent.repoId);
    return this.repository.getEditIntent(intent.id) ?? intent;
  }

  requestFileLease(input: RequestFileLeaseInput, context: EditIntentGraphContext = {}): FileLease {
    const filePath = normalizeFilePath(input.filePath);
    const lease = this.repository.saveFileLease({
      id: input.id ?? createId("filelease"),
      repoId: input.repoId,
      filePath,
      filePathHash: hashFilePath(filePath),
      leaseKind: input.leaseKind,
      ownerSessionId: input.ownerSessionId,
      ownerAgentRunId: input.ownerAgentRunId,
      ownerTaskId: input.ownerTaskId,
      ownerActorId: input.ownerActorId ?? context.actorId,
      branchName: input.branchName,
      workspaceLeaseId: input.workspaceLeaseId,
      status: input.status ?? "requested",
      createdAt: input.createdAt ?? new Date(),
      expiresAt: input.expiresAt,
      metadata: sanitizeEditIntentMetadata({
        ...input.metadata,
        ...contextMetadata(context),
        noOsFileLock: true,
        noSourceMutation: true,
        exclusiveWriteEnforced: false
      })
    });
    this.evaluateOverlaps(lease.repoId);
    return this.repository.getFileLease(lease.id) ?? lease;
  }

  releaseFileLease(leaseId: string, context: EditIntentGraphContext = {}): FileLease {
    const lease = this.requireFileLease(leaseId);
    const released = this.repository.updateFileLease(leaseId, {
      status: "released",
      metadata: sanitizeEditIntentMetadata({
        ...lease.metadata,
        ...contextMetadata(context),
        releasedAt: new Date().toISOString(),
        noOsUnlockRequired: true
      })
    });
    this.evaluateOverlaps(released.repoId);
    return this.repository.getFileLease(leaseId) ?? released;
  }

  expireLeases(now = new Date()): FileLease[] {
    const expired: FileLease[] = [];
    for (const lease of this.repository.listFileLeases()) {
      if (activeLeaseStatuses.has(lease.status) && lease.expiresAt && lease.expiresAt.getTime() <= now.getTime()) {
        expired.push(this.repository.updateFileLease(lease.id, {
          status: "expired",
          metadata: sanitizeEditIntentMetadata({
            ...lease.metadata,
            expiredAt: now.toISOString(),
            noOsUnlockRequired: true
          })
        }));
      }
    }
    for (const repoId of unique(expired.map((lease) => lease.repoId))) {
      this.evaluateOverlaps(repoId);
    }
    return expired;
  }

  buildGraph(repoId: string): EditIntentGraph {
    const intents = this.activeIntents(repoId);
    const leases = this.activeLeases(repoId);
    const assessments = this.evaluateOverlaps(repoId);
    const nodes = new Map<string, EditIntentGraphNode>();
    const edges = new Map<string, EditIntentGraphEdge>();

    const ensureNode = (nodeKind: EditIntentGraphNodeKind, nodeId: string, metadata: Record<string, unknown> = {}) => {
      const id = nodeIdFor(nodeKind, nodeId);
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          nodeKind,
          nodeId,
          metadata: sanitizeEditIntentMetadata(metadata)
        });
      }
      return id;
    };

    for (const intent of intents) {
      const sessionNodeId = ensureNode("session", intent.sessionId, {
        repoId: intent.repoId,
        agentRunId: intent.agentRunId,
        intentId: intent.id
      });
      if (intent.taskId) ensureEdge(edges, sessionNodeId, ensureNode("task", intent.taskId), "intends_to_edit", "low", { intentId: intent.id });
      ensureEdge(edges, sessionNodeId, ensureNode("branch", intent.branchName), "same_branch", "low", { intentId: intent.id });
      if (intent.workspaceLeaseId) ensureEdge(edges, sessionNodeId, ensureNode("workspace", intent.workspaceLeaseId), "same_workspace", "low", { intentId: intent.id });
      for (const filePath of intent.filePaths) {
        ensureEdge(edges, sessionNodeId, ensureNode("file", filePath, { filePathHash: hashFilePath(filePath) }), "intends_to_edit", "low", {
          intentId: intent.id,
          intentKind: intent.intentKind
        });
      }
      for (const directory of intent.directoryScopes) {
        ensureEdge(edges, sessionNodeId, ensureNode("directory", directory), "same_directory", "low", {
          intentId: intent.id,
          intentKind: intent.intentKind
        });
      }
    }

    for (const lease of leases) {
      const sessionNodeId = ensureNode("session", lease.ownerSessionId, {
        repoId: lease.repoId,
        agentRunId: lease.ownerAgentRunId,
        leaseId: lease.id
      });
      if (lease.ownerTaskId) ensureEdge(edges, sessionNodeId, ensureNode("task", lease.ownerTaskId), "leases_file", "low", { leaseId: lease.id });
      ensureEdge(edges, sessionNodeId, ensureNode("branch", lease.branchName), "same_branch", "low", { leaseId: lease.id });
      if (lease.workspaceLeaseId) ensureEdge(edges, sessionNodeId, ensureNode("workspace", lease.workspaceLeaseId), "same_workspace", "low", { leaseId: lease.id });
      ensureEdge(edges, sessionNodeId, ensureNode("file", lease.filePath, { filePathHash: lease.filePathHash }), "leases_file", "low", {
        leaseId: lease.id,
        leaseKind: lease.leaseKind
      });
    }

    for (const assessment of assessments) {
      const [leftSessionId, rightSessionId] = assessment.sessionIds;
      if (!leftSessionId || !rightSessionId) continue;
      const edgeKind: EditIntentGraphEdgeKind =
        assessment.overlapKind === "same_directory" ? "same_directory" :
          assessment.overlapKind === "same_branch" ? "same_branch" :
            assessment.overlapKind === "same_workspace" ? "same_workspace" :
              assessment.overlapKind === "same_symbol_future" ? "future_symbol_overlap" :
                "overlaps_with";
      ensureEdge(edges, ensureNode("session", leftSessionId), ensureNode("session", rightSessionId), edgeKind, assessment.severity, {
        overlapAssessmentId: assessment.id,
        overlapKind: assessment.overlapKind,
        recommendation: assessment.recommendation,
        reason: assessment.reason
      });
    }

    return {
      repoId,
      nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
      edges: [...edges.values()].sort((left, right) => left.id.localeCompare(right.id)),
      assessments,
      metadata: sanitizeEditIntentMetadata({
        status: "v1_implemented",
        storage: "in_memory",
        noFileLocks: true,
        noSourceMutation: true,
        remoteGitOperation: false
      })
    };
  }

  evaluateOverlaps(repoId: string): EditOverlapAssessment[] {
    const profiles = this.sessionProfiles(repoId);
    const assessments: EditOverlapAssessment[] = [];
    for (let index = 0; index < profiles.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < profiles.length; nextIndex += 1) {
        const left = profiles[index];
        const right = profiles[nextIndex];
        if (!left || !right) continue;
        assessments.push(...detectProfileOverlaps(repoId, left, right));
      }
    }
    const saved = this.repository.replaceOverlapAssessments(repoId, assessments);
    this.updateLeaseOverlapStatuses(repoId, saved);
    return saved;
  }

  listLeases(query: FileLeaseQuery = {}): FileLease[] {
    return this.repository.listFileLeases(query);
  }

  listIntents(query: EditIntentQuery = {}): EditIntent[] {
    return this.repository.listEditIntents(query);
  }

  listGraph(query: EditIntentGraphQuery = {}): EditIntentGraph {
    const repoId = query.repoId ?? this.defaultRepoId();
    const graph = this.buildGraph(repoId);
    return {
      ...graph,
      nodes: graph.nodes.filter((node) => query.nodeKind === undefined || node.nodeKind === query.nodeKind),
      edges: graph.edges.filter((edge) => query.edgeKind === undefined || edge.edgeKind === query.edgeKind)
    };
  }

  listOverlapAssessments(query: EditOverlapAssessmentQuery = {}): EditOverlapAssessment[] {
    return this.repository.listOverlapAssessments(query);
  }

  getOverlapSummary(repoId?: string): EditIntentOverlapSummary {
    const repoIds = repoId ? [repoId] : this.repoIds();
    const assessments = repoIds.flatMap((id) => this.evaluateOverlaps(id));
    const graphCounts = repoIds.map((id) => this.buildGraph(id));
    const worst = worstAssessment(assessments);
    return {
      repoId,
      activeIntents: repoIds.reduce((total, id) => total + this.activeIntents(id).length, 0),
      activeFileLeases: repoIds.reduce((total, id) => total + this.activeLeases(id).length, 0),
      graphNodes: graphCounts.reduce((total, graph) => total + graph.nodes.length, 0),
      graphEdges: graphCounts.reduce((total, graph) => total + graph.edges.length, 0),
      overlapAssessments: assessments.length,
      sameFileOverlaps: assessments.filter((assessment) => assessment.overlapKind === "same_file").length,
      sameDirectoryOverlaps: assessments.filter((assessment) => assessment.overlapKind === "same_directory").length,
      sameWorkspaceConflicts: assessments.filter((assessment) => assessment.overlapKind === "same_workspace").length,
      broadUnknownWarnings: assessments.filter((assessment) => assessment.overlapKind === "broad_unknown").length,
      highestSeverity: worst?.severity,
      recommendation: strongestRecommendation(assessments),
      noFileLocks: true,
      noSourceMutation: true,
      remoteGitOperation: false,
      secretsExposed: false,
      metadata: sanitizeEditIntentMetadata({
        status: "v1_implemented",
        storage: "in_memory",
        graphModel: "metadata_only",
        exclusiveWriteEnforced: false,
        osFileLocks: false
      })
    };
  }

  recommendAction(overlapId: string): EditOverlapAssessment {
    const assessment = this.repository.listOverlapAssessments().find((candidate) => candidate.id === overlapId);
    if (!assessment) {
      throw new Error(`Edit overlap assessment not found: ${overlapId}`);
    }
    return assessment;
  }

  private requireFileLease(leaseId: string): FileLease {
    const lease = this.repository.getFileLease(leaseId);
    if (!lease) {
      throw new Error(`File lease not found: ${leaseId}`);
    }
    return lease;
  }

  private activeLeases(repoId: string): FileLease[] {
    return this.repository.listFileLeases({ repoId }).filter((lease) => activeLeaseStatuses.has(lease.status));
  }

  private activeIntents(repoId: string): EditIntent[] {
    return this.repository.listEditIntents({ repoId }).filter((intent) => activeIntentStatuses.has(intent.status));
  }

  private sessionProfiles(repoId: string): SessionEditProfile[] {
    const profiles = new Map<string, SessionEditProfile>();
    const ensureProfile = (sessionId: string): SessionEditProfile => {
      const existing = profiles.get(sessionId);
      if (existing) return existing;
      const created: SessionEditProfile = {
        sessionId,
        repoId,
        taskIds: [],
        agentRunIds: [],
        branchNames: [],
        workspaceLeaseIds: [],
        writeFiles: [],
        readFiles: [],
        directories: [],
        broadRefactor: false,
        missingTargets: false,
        exclusiveWriteFuture: false
      };
      profiles.set(sessionId, created);
      return created;
    };

    for (const intent of this.activeIntents(repoId)) {
      const profile = ensureProfile(intent.sessionId);
      pushUnique(profile.taskIds, intent.taskId);
      pushUnique(profile.agentRunIds, intent.agentRunId);
      pushUnique(profile.branchNames, intent.branchName);
      pushUnique(profile.workspaceLeaseIds, intent.workspaceLeaseId);
      if (intent.intentKind === "read_only") {
        pushAllUnique(profile.readFiles, intent.filePaths);
      } else {
        pushAllUnique(profile.writeFiles, intent.filePaths);
      }
      pushAllUnique(profile.directories, [...intent.directoryScopes, ...intent.filePaths.map(directoryForFile).filter(isString)]);
      if (intent.intentKind === "refactor") profile.broadRefactor = true;
      if (intent.filePaths.length === 0 && intent.directoryScopes.length === 0) profile.missingTargets = true;
    }

    for (const lease of this.activeLeases(repoId)) {
      const profile = ensureProfile(lease.ownerSessionId);
      pushUnique(profile.taskIds, lease.ownerTaskId);
      pushUnique(profile.agentRunIds, lease.ownerAgentRunId);
      pushUnique(profile.branchNames, lease.branchName);
      pushUnique(profile.workspaceLeaseIds, lease.workspaceLeaseId);
      if (lease.leaseKind === "read" || lease.leaseKind === "review") {
        pushUnique(profile.readFiles, lease.filePath);
      } else {
        pushUnique(profile.writeFiles, lease.filePath);
      }
      if (lease.leaseKind === "exclusive_write_future") profile.exclusiveWriteFuture = true;
      pushUnique(profile.directories, directoryForFile(lease.filePath));
    }

    return [...profiles.values()].sort((left, right) => left.sessionId.localeCompare(right.sessionId));
  }

  private updateLeaseOverlapStatuses(repoId: string, assessments: EditOverlapAssessment[]): void {
    for (const lease of this.activeLeases(repoId)) {
      const leaseAssessments = assessments.filter((assessment) =>
        assessment.sessionIds.includes(lease.ownerSessionId) &&
        (assessment.files.includes(lease.filePath) || assessment.overlapKind === "same_workspace" || assessment.overlapKind === "same_branch" || assessment.directories.includes(directoryForFile(lease.filePath) ?? ""))
      );
      const status: FileLeaseStatus = leaseAssessments.some((assessment) => assessment.recommendation === "block")
        ? "blocked_overlap"
        : leaseAssessments.length > 0
          ? "warning_overlap"
          : "active";
      if (lease.status !== status) {
        this.repository.updateFileLease(lease.id, {
          status,
          metadata: sanitizeEditIntentMetadata({
            ...lease.metadata,
            latestOverlapStatus: status,
            overlapAssessmentIds: leaseAssessments.map((assessment) => assessment.id)
          })
        });
      }
    }
  }

  private repoIds(): string[] {
    return unique([
      ...this.repository.listEditIntents().map((intent) => intent.repoId),
      ...this.repository.listFileLeases().map((lease) => lease.repoId)
    ]).sort((left, right) => left.localeCompare(right));
  }

  private defaultRepoId(): string {
    return this.repoIds()[0] ?? "repo_unknown";
  }
}

type SessionEditProfile = {
  sessionId: string;
  repoId: string;
  taskIds: string[];
  agentRunIds: string[];
  branchNames: string[];
  workspaceLeaseIds: string[];
  writeFiles: string[];
  readFiles: string[];
  directories: string[];
  broadRefactor: boolean;
  missingTargets: boolean;
  exclusiveWriteFuture: boolean;
};

function detectProfileOverlaps(repoId: string, left: SessionEditProfile, right: SessionEditProfile): EditOverlapAssessment[] {
  const assessments: EditOverlapAssessment[] = [];
  const sessions = [left.sessionId, right.sessionId].sort((a, b) => a.localeCompare(b));
  const sharedWorkspaces = intersection(left.workspaceLeaseIds, right.workspaceLeaseIds);
  if (sharedWorkspaces.length > 0) {
    assessments.push(createAssessment(repoId, sessions, "same_workspace", [], [], "critical", "block", "active_sessions_share_workspace_lease", {
      workspaceLeaseIds: sharedWorkspaces
    }));
  }

  const sharedBranches = intersection(left.branchNames, right.branchNames);
  if (sharedBranches.length > 0) {
    assessments.push(createAssessment(repoId, sessions, "same_branch", [], [], "high", "serialize", "active_sessions_share_branch_name", {
      branchNames: sharedBranches
    }));
  }

  if (left.missingTargets || right.missingTargets) {
    assessments.push(createAssessment(repoId, sessions, "broad_unknown", [], [], "medium", "warn", "missing_target_files_prevent_precise_overlap_detection", {
      leftMissingTargets: left.missingTargets,
      rightMissingTargets: right.missingTargets
    }));
  }

  const sameWriteFiles = intersection(left.writeFiles, right.writeFiles);
  if (sameWriteFiles.length > 0) {
    assessments.push(createAssessment(repoId, sessions, "same_file", sameWriteFiles, [], "high", "serialize", "write_intents_target_same_file", {
      exclusiveWriteFuture: left.exclusiveWriteFuture || right.exclusiveWriteFuture
    }));
  } else {
    const readWriteFiles = unique([
      ...intersection(left.readFiles, right.writeFiles),
      ...intersection(right.readFiles, left.writeFiles)
    ]);
    if (readWriteFiles.length > 0) {
      assessments.push(createAssessment(repoId, sessions, "same_file", readWriteFiles, [], "low", "warn", "read_only_intent_overlaps_write_intent", {
        readOnlyOverlap: true
      }));
    }
  }

  if (sameWriteFiles.length === 0) {
    const sameDirectories = intersection(left.directories, right.directories).filter(Boolean);
    if (sameDirectories.length > 0) {
      const broad = left.broadRefactor || right.broadRefactor;
      assessments.push(createAssessment(
        repoId,
        sessions,
        "same_directory",
        [],
        sameDirectories,
        broad ? "high" : "medium",
        broad ? "require_review" : "split_files",
        broad ? "broad_refactor_targets_same_directory" : "active_sessions_target_same_directory",
        { broadRefactor: broad }
      ));
    }
  }

  return assessments;
}

function createAssessment(
  repoId: string,
  sessionIds: string[],
  overlapKind: EditOverlapKind,
  files: string[],
  directories: string[],
  severity: EditOverlapSeverity,
  recommendation: EditOverlapRecommendation,
  reason: string,
  metadata: Record<string, unknown>
): EditOverlapAssessment {
  const normalizedFiles = normalizeFilePaths(files);
  const normalizedDirectories = normalizeDirectories(directories);
  return {
    id: assessmentId(repoId, sessionIds, overlapKind, normalizedFiles, normalizedDirectories),
    repoId,
    sessionIds,
    overlapKind,
    files: normalizedFiles,
    directories: normalizedDirectories,
    severity,
    recommendation,
    reason,
    metadata: sanitizeEditIntentMetadata({
      ...metadata,
      noFileLocks: true,
      noSourceMutation: true,
      remoteGitOperation: false
    })
  };
}

function ensureEdge(
  edges: Map<string, EditIntentGraphEdge>,
  fromNodeId: string,
  toNodeId: string,
  edgeKind: EditIntentGraphEdgeKind,
  severity: EditOverlapSeverity,
  metadata: Record<string, unknown> = {}
): void {
  const id = edgeIdFor(fromNodeId, toNodeId, edgeKind, metadata);
  if (!edges.has(id)) {
    edges.set(id, {
      id,
      fromNodeId,
      toNodeId,
      edgeKind,
      severity,
      metadata: sanitizeEditIntentMetadata(metadata)
    });
  }
}

function nodeIdFor(nodeKind: EditIntentGraphNodeKind, nodeId: string): string {
  return `editnode_${nodeKind}_${slugify(nodeId)}`;
}

function edgeIdFor(fromNodeId: string, toNodeId: string, edgeKind: EditIntentGraphEdgeKind, metadata: Record<string, unknown>): string {
  const detail = [
    stringValue(metadata.intentId),
    stringValue(metadata.leaseId),
    stringValue(metadata.overlapAssessmentId)
  ].filter(isString).join("_");
  return `editedge_${slugify(fromNodeId)}_${slugify(toNodeId)}_${edgeKind}${detail ? `_${slugify(detail)}` : ""}`;
}

function assessmentId(repoId: string, sessionIds: string[], overlapKind: EditOverlapKind, files: string[], directories: string[]): string {
  return `editoverlap_${slugify(repoId)}_${slugify(sessionIds.join("_"))}_${overlapKind}_${slugify([...files, ...directories].join("_") || "metadata")}`;
}

function normalizeFilePath(filePath: string): string {
  return filePath.trim().replaceAll("\\", "/").replace(/\/+/g, "/").replace(/^\.\//, "");
}

function normalizeFilePaths(files: string[]): string[] {
  return unique(files
    .filter(isString)
    .map(normalizeFilePath)
    .filter((file) => file.length > 0))
    .sort((left, right) => left.localeCompare(right));
}

function normalizeDirectory(directory: string): string {
  return normalizeFilePath(directory).replace(/\/$/, "");
}

function normalizeDirectories(directories: string[]): string[] {
  return unique(directories
    .filter(isString)
    .map(normalizeDirectory)
    .filter((directory) => directory.length > 0))
    .sort((left, right) => left.localeCompare(right));
}

function normalizeSymbols(symbols: string[] | undefined): string[] | undefined {
  if (!symbols) return undefined;
  const normalized = unique(symbols.map((symbol) => symbol.trim()).filter(Boolean)).sort((left, right) => left.localeCompare(right));
  return normalized.length > 0 ? normalized : undefined;
}

function directoryForFile(filePath: string): string | undefined {
  const normalized = normalizeFilePath(filePath);
  if (normalized.endsWith("/")) return normalizeDirectory(normalized);
  const parts = normalized.split("/");
  parts.pop();
  const directory = parts.join("/");
  return directory.length > 0 ? directory : undefined;
}

function hashFilePath(filePath: string): string {
  return createHash("sha256").update(normalizeFilePath(filePath).toLowerCase()).digest("hex").slice(0, 16);
}

function intersection(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).sort((a, b) => a.localeCompare(b));
}

function strongestRecommendation(assessments: EditOverlapAssessment[]): EditOverlapRecommendation {
  return assessments
    .map((assessment) => assessment.recommendation)
    .sort((left, right) => recommendationRank[right] - recommendationRank[left])[0] ?? "allow";
}

function worstAssessment(assessments: EditOverlapAssessment[]): EditOverlapAssessment | undefined {
  return [...assessments].sort((left, right) =>
    severityRank[right.severity] - severityRank[left.severity] ||
    recommendationRank[right.recommendation] - recommendationRank[left.recommendation] ||
    left.id.localeCompare(right.id))[0];
}

function isAbsoluteLikePath(value: string): boolean {
  return path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("/");
}

export function sanitizeEditIntentFilePathForDto(filePath: string): string {
  const normalized = normalizeFilePath(filePath);
  if (!isAbsoluteLikePath(filePath)) return normalized;
  const basename = path.basename(normalized);
  return basename ? `[file-path]/${basename}` : "[file-path]";
}

function isSensitiveMetadataKey(key: string): boolean {
  return /token|secret|password|credential|authorization|cookie|private[_-]?key|api[_-]?key|env(ironment)?[_-]?value/i.test(key);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

export function sanitizeEditIntentMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => {
    if (isSensitiveMetadataKey(key)) return [key, "[redacted]"];
    if (Array.isArray(value)) {
      return [key, value.map((item) => isPlainRecord(item) ? sanitizeEditIntentMetadata(item) : item)];
    }
    if (isPlainRecord(value)) return [key, sanitizeEditIntentMetadata(value)];
    if (typeof value === "string" && /(OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|VAULT_TOKEN|DATABASE_URL|AICHESTRA_[A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD))=/i.test(value)) {
      return [key, "[redacted]"];
    }
    if (typeof value === "string" && isAbsoluteLikePath(value)) return [key, sanitizeEditIntentFilePathForDto(value)];
    return [key, value];
  }));
}

function contextMetadata(context: EditIntentGraphContext): Record<string, unknown> {
  return sanitizeEditIntentMetadata({
    requestId: context.requestId,
    correlationId: context.correlationId,
    principalId: context.principalId,
    serviceAccountId: context.serviceAccountId,
    source: context.source,
    ...context.metadata
  });
}

export function fileLeaseToDto(lease: FileLease) {
  return {
    ...lease,
    filePath: sanitizeEditIntentFilePathForDto(lease.filePath),
    filePathRedacted: isAbsoluteLikePath(lease.filePath),
    createdAt: lease.createdAt.toISOString(),
    expiresAt: lease.expiresAt?.toISOString(),
    metadata: sanitizeEditIntentMetadata(lease.metadata)
  };
}

export function editIntentToDto(intent: EditIntent) {
  return {
    ...intent,
    filePaths: intent.filePaths.map(sanitizeEditIntentFilePathForDto),
    directoryScopes: intent.directoryScopes.map(sanitizeEditIntentFilePathForDto),
    createdAt: intent.createdAt.toISOString(),
    updatedAt: intent.updatedAt.toISOString(),
    metadata: sanitizeEditIntentMetadata(intent.metadata)
  };
}

export function editIntentGraphNodeToDto(node: EditIntentGraphNode) {
  return {
    ...node,
    nodeId: node.nodeKind === "file" || node.nodeKind === "directory" ? sanitizeEditIntentFilePathForDto(node.nodeId) : node.nodeId,
    metadata: sanitizeEditIntentMetadata(node.metadata)
  };
}

export function editIntentGraphEdgeToDto(edge: EditIntentGraphEdge) {
  return {
    ...edge,
    metadata: sanitizeEditIntentMetadata(edge.metadata)
  };
}

export function editOverlapAssessmentToDto(assessment: EditOverlapAssessment) {
  return {
    ...assessment,
    files: assessment.files.map(sanitizeEditIntentFilePathForDto),
    directories: assessment.directories.map(sanitizeEditIntentFilePathForDto),
    metadata: sanitizeEditIntentMetadata(assessment.metadata)
  };
}

export function editIntentGraphToDto(graph: EditIntentGraph) {
  return {
    ...graph,
    nodes: graph.nodes.map(editIntentGraphNodeToDto),
    edges: graph.edges.map(editIntentGraphEdgeToDto),
    assessments: graph.assessments.map(editOverlapAssessmentToDto),
    metadata: sanitizeEditIntentMetadata(graph.metadata)
  };
}

export function editIntentOverlapSummaryToDto(summary: EditIntentOverlapSummary) {
  return {
    ...summary,
    metadata: sanitizeEditIntentMetadata(summary.metadata)
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function pushUnique(target: string[], value: string | undefined): void {
  if (value && !target.includes(value)) target.push(value);
}

function pushAllUnique(target: string[], values: string[]): void {
  for (const value of values) pushUnique(target, value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

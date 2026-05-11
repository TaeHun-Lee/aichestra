import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@aichestra/core";
import type {
  AgentWorkspace,
  AgentWorkspaceCreateRequest,
  AgentWorkspaceManager,
  AgentWorkspaceStatus
} from "./agent-runner.ts";
import type { AgentWorkspaceRepository } from "./repository.ts";

function resolvePath(input: string): string {
  return path.resolve(input);
}

function isWithinRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export type LocalAgentWorkspaceManagerConfig = {
  workspaceRoot?: string;
  workspaceRepository?: AgentWorkspaceRepository;
};

export class LocalAgentWorkspaceManager implements AgentWorkspaceManager {
  private readonly workspaceRoot: string;
  private readonly workspaceRepository?: AgentWorkspaceRepository;
  private readonly workspaces: AgentWorkspace[] = [];

  constructor(config: LocalAgentWorkspaceManagerConfig = {}) {
    this.workspaceRoot = resolvePath(config.workspaceRoot ?? path.join(os.tmpdir(), "aichestra-agent-workspaces"));
    this.workspaceRepository = config.workspaceRepository;
  }

  async createWorkspace(request: AgentWorkspaceCreateRequest): Promise<AgentWorkspace> {
    const validationPath = request.mode === "fixture"
      ? request.requestedPath
      : await this.createTempWorkspacePath(request.taskId);

    if (!validationPath) {
      return this.saveWorkspace({
        id: createId("agentws"),
        rootPath: this.workspaceRoot,
        mode: request.mode,
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        createdAt: new Date(),
        cleanupPolicy: request.cleanupPolicy,
        status: "rejected",
        metadata: {
          ...request.metadata,
          reason: "workspace_path_missing"
        }
      });
    }

    const validation = await this.validateWorkspace(validationPath, {
      allowRepositoryRootFixture: request.allowRepositoryRootFixture
    });
    return this.saveWorkspace({
      id: createId("agentws"),
      rootPath: validation.resolvedPath ?? resolvePath(validationPath),
      mode: request.mode,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      createdAt: new Date(),
      cleanupPolicy: request.cleanupPolicy,
      status: validation.ok ? "ready" : "rejected",
      metadata: {
        ...request.metadata,
        reason: validation.reason,
        workspaceRoot: this.workspaceRoot
      }
    });
  }

  async validateWorkspace(workspacePath: string, options: { allowRepositoryRootFixture?: boolean } = {}) {
    const resolvedRoot = this.workspaceRoot;
    const resolved = resolvePath(workspacePath);
    if (!isWithinRoot(resolved, resolvedRoot)) {
      return { ok: false, reason: "workspace_outside_allowed_root", resolvedPath: resolved };
    }
    if (resolved === resolvePath(process.cwd()) && options.allowRepositoryRootFixture !== true) {
      return { ok: false, reason: "repository_root_workspace_rejected", resolvedPath: resolved };
    }
    if (resolved === path.parse(resolved).root) {
      return { ok: false, reason: "filesystem_root_workspace_rejected", resolvedPath: resolved };
    }
    return { ok: true, resolvedPath: resolved };
  }

  async cleanupWorkspace(workspaceId: string): Promise<AgentWorkspace> {
    const workspace = this.workspaceRepository?.getWorkspace(workspaceId) ?? this.workspaces.find((candidate) => candidate.id === workspaceId);
    if (!workspace) {
      throw new Error(`Agent workspace not found: ${workspaceId}`);
    }
    if (workspace.cleanupPolicy === "delete_temp_workspace" && workspace.mode === "temp" && workspace.status !== "cleaned") {
      await rm(workspace.rootPath, { recursive: true, force: true });
    }
    if (this.workspaceRepository) {
      return this.workspaceRepository.updateWorkspaceStatus(workspace.id, "cleaned", {
        ...workspace.metadata,
        cleanedAt: new Date().toISOString()
      });
    }
    const stored = this.workspaces.find((candidate) => candidate.id === workspaceId);
    if (!stored) throw new Error(`Agent workspace not found: ${workspaceId}`);
    stored.status = "cleaned";
    stored.metadata = {
      ...stored.metadata,
      cleanedAt: new Date().toISOString()
    };
    return structuredClone(stored);
  }

  getWorkspace(workspaceId: string): AgentWorkspace | undefined {
    if (this.workspaceRepository) return this.workspaceRepository.getWorkspace(workspaceId);
    const workspace = this.workspaces.find((candidate) => candidate.id === workspaceId);
    return workspace ? structuredClone(workspace) : undefined;
  }

  listWorkspaces(filter: { taskId?: string; taskRunId?: string; status?: AgentWorkspaceStatus } = {}): AgentWorkspace[] {
    if (this.workspaceRepository) return this.workspaceRepository.listWorkspaces(filter);
    return this.workspaces
      .filter((workspace) => (filter.taskId === undefined || workspace.taskId === filter.taskId) &&
        (filter.taskRunId === undefined || workspace.taskRunId === filter.taskRunId) &&
        (filter.status === undefined || workspace.status === filter.status))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((workspace) => structuredClone(workspace));
  }

  private async createTempWorkspacePath(taskId: string): Promise<string> {
    await mkdir(this.workspaceRoot, { recursive: true });
    return mkdtemp(path.join(this.workspaceRoot, `${taskId.replace(/[^a-zA-Z0-9_-]/g, "_")}-`));
  }

  private saveWorkspace(workspace: AgentWorkspace): AgentWorkspace {
    if (this.workspaceRepository) return this.workspaceRepository.saveWorkspace(workspace);
    this.workspaces.push(structuredClone(workspace));
    return structuredClone(workspace);
  }
}

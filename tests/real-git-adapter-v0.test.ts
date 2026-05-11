import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  GitHubGitProvider,
  GitIntegrationService,
  LocalGitProvider,
  MockGitProvider,
  createGitProviderConfigFromEnv
} from "@aichestra/git-adapter";

const execFileAsync = promisify(execFile);

async function git(repoPath: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
  return result.stdout.trim();
}

async function createTempRepo(): Promise<string> {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "aichestra-real-git-v0-"));
  await execFileAsync("git", ["init", "-b", "main", repoPath], { encoding: "utf8", windowsHide: true });
  await git(repoPath, ["config", "user.email", "tests@example.local"]);
  await git(repoPath, ["config", "user.name", "Aichestra Tests"]);
  return repoPath;
}

function getJson(port: number, requestPath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, requestPath: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: requestPath,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized)
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(serialized);
  });
}

test("MockGitProvider exposes provider-neutral branch, PR, changed-file, and audit behavior", async () => {
  const provider = new MockGitProvider();
  const validation = await provider.validateConnection();
  assert.equal(provider.getProviderKind(), "mock");
  assert.equal(validation.ok, true);

  await provider.createBranch({ repoId: "repo_demo_backend", branchName: "codex/mock-git-v0", baseBranch: "main" });
  const branches = await provider.listBranches({ repoId: "repo_demo_backend", provider: "mock", defaultBranch: "main" });
  assert.equal(branches.data?.some((branch) => branch.branchName === "codex/mock-git-v0"), true);

  const pr = await provider.createPullRequest({
    taskId: "task_git_v0",
    taskRunId: "run_git_v0",
    repoId: "repo_demo_backend",
    provider: "mock",
    branchName: "codex/mock-git-v0",
    baseBranch: "main",
    title: "Mock Git v0 PR"
  });
  assert.equal(pr.ok, true);
  assert.equal(pr.data?.url?.startsWith("mock://pull-requests/"), true);

  const changedFiles = await provider.getChangedFiles({ repoId: "repo_demo_backend", branchName: "codex/mock-git-v0" });
  assert.equal(changedFiles.data?.some((file) => file.path === "src/auth/session.ts"), true);
});

test("LocalGitProvider reads local changed files without fetch, push, or working-tree mutation", async () => {
  const repoPath = await createTempRepo();
  try {
    await mkdir(path.join(repoPath, "src"), { recursive: true });
    await writeFile(path.join(repoPath, "src", "base.ts"), "export const base = true;\n");
    await git(repoPath, ["add", "."]);
    await git(repoPath, ["commit", "-m", "base"]);
    await git(repoPath, ["checkout", "-b", "feature"]);
    await writeFile(path.join(repoPath, "src", "base.ts"), "export const base = false;\n");
    await writeFile(path.join(repoPath, "src", "feature.ts"), "export const feature = true;\n");
    await git(repoPath, ["add", "."]);
    await git(repoPath, ["commit", "-m", "feature"]);
    await git(repoPath, ["checkout", "main"]);

    const provider = new LocalGitProvider();
    const beforeBranch = await git(repoPath, ["branch", "--show-current"]);
    const beforeStatus = await git(repoPath, ["status", "--short"]);
    const changedFiles = await provider.getChangedFiles({
      repoId: "repo_local_fixture",
      branchName: "feature",
      baseBranch: "main",
      repoRef: {
        repoId: "repo_local_fixture",
        provider: "local",
        localPath: repoPath,
        defaultBranch: "main"
      }
    });
    const afterBranch = await git(repoPath, ["branch", "--show-current"]);
    const afterStatus = await git(repoPath, ["status", "--short"]);

    assert.equal(changedFiles.ok, true);
    assert.equal(changedFiles.data?.some((file) => file.path === "src/base.ts" && file.status === "modified"), true);
    assert.equal(changedFiles.data?.some((file) => file.path === "src/feature.ts" && file.status === "added"), true);
    assert.equal(beforeBranch, afterBranch);
    assert.equal(beforeStatus, afterStatus);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("GitHubGitProvider boundary blocks remote operations by default without network calls", async () => {
  const provider = new GitHubGitProvider();
  const validation = await provider.validateConnection();
  const pr = await provider.createPullRequest({
    taskId: "task_remote",
    repoId: "repo_remote",
    provider: "github",
    branchName: "codex/remote",
    baseBranch: "main",
    title: "Remote PR"
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.reason, "remote_git_disabled");
  assert.equal(pr.ok, false);
  assert.equal(pr.reason, "remote_git_disabled");
  assert.equal(pr.auditEvent.result, "blocked");
});

test("GitIntegrationService links branch, PR, merge queue, and audit records through mock provider", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Git adapter service task",
    repoId: "repo_demo_backend",
    baseBranch: "main"
  });
  const taskRun = store.createTaskRun({
    taskId: task.id,
    attempt: 1,
    status: "running",
    agent: "codex",
    model: "mock-model"
  });
  const config = createGitProviderConfigFromEnv({});
  const service = new GitIntegrationService({
    store,
    provider: new MockGitProvider(),
    config
  });

  const branch = await service.createBranch("repo_demo_backend", {
    branchName: "codex/git-service-v0",
    baseBranch: "main",
    taskId: task.id,
    taskRunId: taskRun.id,
    files: ["src/auth/session.ts"]
  });
  assert.equal(branch.ok, true);
  assert.equal(branch.branchLease?.taskRunId, taskRun.id);

  const pr = await service.createPullRequest("repo_demo_backend", {
    taskId: task.id,
    taskRunId: taskRun.id,
    branchLeaseId: branch.branchLease?.id,
    branchName: "codex/git-service-v0",
    baseBranch: "main",
    title: "Git service v0 PR"
  });

  assert.equal(pr.ok, true);
  assert.equal(pr.pullRequest?.url?.startsWith("mock://pull-requests/"), true);
  assert.equal(pr.mergeQueueEntry?.taskRunId, taskRun.id);
  assert.equal(service.listGitAuditEvents().some((event) => event.action === "git.branch_created"), true);
  assert.equal(service.listGitAuditEvents().some((event) => event.action === "git.pull_request_created"), true);
});

test("Git API exposes provider config, branch/PR operations, changed files, and audit without credentials", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Git API task",
    repoId: "repo_demo_backend",
    baseBranch: "main"
  });
  const taskRun = store.createTaskRun({
    taskId: task.id,
    attempt: 1,
    status: "running",
    agent: "codex",
    model: "mock-model"
  });
  const server = createApiServer(store);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health");
    assert.equal((health.git as { providerKind: string }).providerKind, "mock");

    const config = await getJson(address.port, "/git/config") as { config: { providerKind: string; remoteGitEnabled: boolean } };
    assert.equal(config.config.providerKind, "mock");
    assert.equal(config.config.remoteGitEnabled, false);

    const branch = await postJson(address.port, "/git/repos/repo_demo_backend/branches", {
      branchName: "codex/git-api-v0",
      baseBranch: "main",
      taskId: task.id,
      taskRunId: taskRun.id,
      files: ["src/auth/session.ts"]
    });
    assert.equal(branch.statusCode, 201);
    const branchLease = (branch.body.branchLease as { id: string });

    const pr = await postJson(address.port, "/git/repos/repo_demo_backend/pull-requests", {
      taskId: task.id,
      taskRunId: taskRun.id,
      branchLeaseId: branchLease.id,
      branchName: "codex/git-api-v0",
      title: "Git API v0 PR"
    });
    assert.equal(pr.statusCode, 201);
    assert.equal(((pr.body.pullRequest as { url: string }).url).startsWith("mock://pull-requests/"), true);

    const changed = await getJson(address.port, `/git/pull-requests/${(pr.body.pullRequest as { id: string }).id}/changed-files?branchName=codex/git-api-v0`);
    assert.equal((changed.changedFiles as { path: string }[]).some((file) => file.path === "src/auth/session.ts"), true);

    const audit = await getJson(address.port, "/git/audit") as { auditEvents: { action: string }[] };
    assert.equal(audit.auditEvents.some((event) => event.action === "git.branch_created"), true);
    assert.equal(audit.auditEvents.some((event) => event.action === "git.pull_request_created"), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

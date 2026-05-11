import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { LocalGitDryRunMergeSimulator, MockMergeSimulator } from "@aichestra/git-adapter";
import type { MergeSimulationRequest, MergeSimulator } from "@aichestra/core";

const execFileAsync = promisify(execFile);

async function git(repoPath: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
  return result.stdout.trim();
}

async function createTempRepo(): Promise<string> {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "aichestra-merge-sim-"));
  await execFileAsync("git", ["init", "-b", "main", repoPath], { encoding: "utf8", windowsHide: true });
  await git(repoPath, ["config", "user.email", "tests@example.local"]);
  await git(repoPath, ["config", "user.name", "Aichestra Tests"]);
  return repoPath;
}

function request(repoPath?: string): MergeSimulationRequest {
  return {
    repoId: "repo_fixture",
    repoPath,
    baseRef: "base",
    sourceRef: "feature",
    targetRef: "main",
    taskRunId: "run_fixture",
    branchLeaseId: "lease_fixture",
    mode: repoPath ? "local_git_merge_tree" : "mock"
  };
}

test("MergeSimulator interface supports deterministic mock clean result", async () => {
  const simulator: MergeSimulator = new MockMergeSimulator("clean");
  const result = await simulator.simulate(request());

  assert.equal(result.status, "clean");
  assert.equal(result.riskContribution, 0.1);
  assert.equal(result.mode, "mock");
});

test("MockMergeSimulator can return text conflict, failed, and unavailable statuses", async () => {
  const conflict = await new MockMergeSimulator("text_conflict").simulate(request());
  const failed = await new MockMergeSimulator("failed").simulate(request());
  const unavailable = await new MockMergeSimulator("unavailable").simulate(request());

  assert.equal(conflict.status, "text_conflict");
  assert.deepEqual(conflict.conflictingFiles, ["src/auth/session.ts"]);
  assert.equal(failed.status, "failed");
  assert.equal(unavailable.status, "unavailable");
  assert.deepEqual(unavailable.changedFiles, []);
});

test("LocalGitDryRunMergeSimulator returns clean for a non-conflicting temp repo merge", async () => {
  const repoPath = await createTempRepo();
  try {
    await writeFile(path.join(repoPath, "base.txt"), "base\n");
    await git(repoPath, ["add", "."]);
    await git(repoPath, ["commit", "-m", "base"]);
    await git(repoPath, ["tag", "base"]);
    await git(repoPath, ["checkout", "-b", "feature"]);
    await writeFile(path.join(repoPath, "feature.txt"), "feature\n");
    await git(repoPath, ["add", "."]);
    await git(repoPath, ["commit", "-m", "feature"]);
    await git(repoPath, ["checkout", "main"]);
    await writeFile(path.join(repoPath, "main.txt"), "main\n");
    await git(repoPath, ["add", "."]);
    await git(repoPath, ["commit", "-m", "main"]);

    const beforeBranch = await git(repoPath, ["branch", "--show-current"]);
    const beforeStatus = await git(repoPath, ["status", "--short"]);
    const result = await new LocalGitDryRunMergeSimulator().simulate(request(repoPath));
    const afterBranch = await git(repoPath, ["branch", "--show-current"]);
    const afterStatus = await git(repoPath, ["status", "--short"]);

    assert.equal(result.status, "clean");
    assert.deepEqual(result.conflictingFiles, []);
    assert.equal(result.changedFiles.includes("feature.txt"), true);
    assert.equal(result.changedFiles.includes("main.txt"), true);
    assert.equal(beforeBranch, afterBranch);
    assert.equal(beforeStatus, afterStatus);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("LocalGitDryRunMergeSimulator returns text_conflict without mutating the temp repo", async () => {
  const repoPath = await createTempRepo();
  try {
    await mkdir(path.join(repoPath, "src", "auth"), { recursive: true });
    await writeFile(path.join(repoPath, "src", "auth", "session.ts"), "export const timeout = 30;\n");
    await git(repoPath, ["add", "."]);
    await git(repoPath, ["commit", "-m", "base"]);
    await git(repoPath, ["tag", "base"]);
    await git(repoPath, ["checkout", "-b", "feature"]);
    await writeFile(path.join(repoPath, "src", "auth", "session.ts"), "export const timeout = 45;\n");
    await git(repoPath, ["add", "."]);
    await git(repoPath, ["commit", "-m", "feature timeout"]);
    await git(repoPath, ["checkout", "main"]);
    await writeFile(path.join(repoPath, "src", "auth", "session.ts"), "export const timeout = 60;\n");
    await git(repoPath, ["add", "."]);
    await git(repoPath, ["commit", "-m", "main timeout"]);

    const beforeBranch = await git(repoPath, ["branch", "--show-current"]);
    const beforeStatus = await git(repoPath, ["status", "--short"]);
    const result = await new LocalGitDryRunMergeSimulator().simulate(request(repoPath));
    const afterBranch = await git(repoPath, ["branch", "--show-current"]);
    const afterStatus = await git(repoPath, ["status", "--short"]);

    assert.equal(result.status, "text_conflict");
    assert.equal(result.conflictingFiles.includes("src/auth/session.ts"), true);
    assert.equal(result.rawCommandMetadata?.command.includes("<targetRef>"), true);
    assert.equal(beforeBranch, afterBranch);
    assert.equal(beforeStatus, afterStatus);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("LocalGitDryRunMergeSimulator returns unavailable for missing local repo path", async () => {
  const result = await new LocalGitDryRunMergeSimulator().simulate({
    ...request(),
    mode: "local_git_merge_tree"
  });

  assert.equal(result.status, "unavailable");
  assert.equal(result.riskContribution, 0.35);
});

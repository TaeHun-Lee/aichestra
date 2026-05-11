import test from "node:test";
import assert from "node:assert/strict";
import { MockGitProvider, createMockLease } from "@aichestra/adapters";

test("mock git provider raises conflict risk for overlapping leases and dangerous paths", () => {
  const git = new MockGitProvider();
  const existing = createMockLease({
    taskId: "task_existing",
    repoId: "repo_demo_backend",
    branchName: "ai/task_existing/codex/auth",
    baseBranch: "main",
    files: ["auth/session.ts"],
    symbols: ["SessionStore"],
    tests: ["auth/session.test.ts"]
  });

  const result = git.computeConflictRisk({
    activeLeases: [existing],
    currentLease: createMockLease({
      taskId: "task_new",
      taskRunId: "run_new",
      repoId: "repo_demo_backend",
      branchId: "branch_new",
      branchName: "ai/task_new/codex/auth",
      baseBranch: "main",
      files: ["auth/session.ts"],
      symbols: ["SessionStore"],
      tests: ["auth/session.test.ts"],
      status: "active"
    })
  });

  assert.equal(result.riskLevel, "critical");
  assert.equal(result.score, 0.9);
  assert.equal(result.reasons.some((reason) => reason.startsWith("critical_path_overlap")), true);
});

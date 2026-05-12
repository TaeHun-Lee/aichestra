import test from "node:test";
import assert from "node:assert/strict";
import { createConflictRisk, mergeQueueDecision } from "@aichestra/core";
import type { BranchLease } from "@aichestra/core";

function lease(id: string, taskRunId: string, files: string[]): BranchLease {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    taskId: `task_${taskRunId}`,
    taskRunId,
    repoId: "repo_demo_backend",
    branchId: `branch_${taskRunId}`,
    branchName: `ai/${taskRunId}`,
    baseBranch: "main",
    files,
    symbols: [],
    tests: files.filter((file) => file.includes(".test.") || file.includes(".spec.") || file.startsWith("tests/")),
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

test("conflict scoring returns safe risk for no overlap", () => {
  const risk = createConflictRisk(
    lease("lease_a", "run_a", ["src/auth/session.ts"]),
    lease("lease_b", "run_b", ["src/payments/service.ts"])
  );

  assert.equal(risk.riskScore, 0);
  assert.equal(risk.riskLevel, "none");
  assert.equal(risk.recommendation, "safe");
});

test("conflict scoring returns low safe risk for docs-only overlap", () => {
  const risk = createConflictRisk(
    lease("lease_a", "run_a", ["docs/foundations/architecture.md"]),
    lease("lease_b", "run_b", ["docs/foundations/architecture.md"])
  );

  assert.equal(risk.riskScore, 0.1);
  assert.equal(risk.riskLevel, "low");
  assert.equal(risk.recommendation, "safe");
});

test("conflict scoring returns low monitor risk for test-only overlap", () => {
  const risk = createConflictRisk(
    lease("lease_a", "run_a", ["tests/auth/session.test.ts"]),
    lease("lease_b", "run_b", ["tests/auth/session.test.ts"])
  );

  assert.equal(risk.riskScore, 0.3);
  assert.equal(risk.riskLevel, "low");
  assert.equal(risk.recommendation, "monitor");
});

test("conflict scoring returns medium serialize risk for source overlap", () => {
  const risk = createConflictRisk(
    lease("lease_a", "run_a", ["src/app.ts"]),
    lease("lease_b", "run_b", ["src/app.ts"])
  );

  assert.equal(risk.riskScore, 0.6);
  assert.equal(risk.riskLevel, "medium");
  assert.equal(risk.recommendation, "serialize");
});

test("conflict scoring returns high block risk for package overlap", () => {
  const risk = createConflictRisk(
    lease("lease_a", "run_a", ["package.json"]),
    lease("lease_b", "run_b", ["package.json"])
  );

  assert.equal(risk.riskScore, 0.75);
  assert.equal(risk.riskLevel, "high");
  assert.equal(risk.recommendation, "block");
});

test("conflict scoring returns critical human review risk for critical path overlap", () => {
  const risk = createConflictRisk(
    lease("lease_a", "run_a", ["infra/app.tf"]),
    lease("lease_b", "run_b", ["infra/app.tf"])
  );

  assert.equal(risk.riskScore, 0.9);
  assert.equal(risk.riskLevel, "critical");
  assert.equal(risk.recommendation, "human_review");
});

test("conflict scoring applies same-directory heuristic without exact overlap", () => {
  const risk = createConflictRisk(
    lease("lease_a", "run_a", ["src/a.ts", "src/b.ts"]),
    lease("lease_b", "run_b", ["src/c.ts"])
  );

  assert.equal(risk.overlapFiles.length, 0);
  assert.equal(risk.riskScore, 0.35);
  assert.equal(risk.riskLevel, "medium");
  assert.equal(risk.recommendation, "monitor");
});

test("conflict scoring is pair-order stable for score and overlap", () => {
  const left = lease("lease_a", "run_a", ["src/app.ts"]);
  const right = lease("lease_b", "run_b", ["src/app.ts"]);

  const first = createConflictRisk(left, right);
  const second = createConflictRisk(right, left);

  assert.equal(first.id, second.id);
  assert.equal(first.riskScore, second.riskScore);
  assert.deepEqual(first.overlapFiles, second.overlapFiles);
});

test("merge queue decision maps risk score to ready or blocked", () => {
  assert.equal(mergeQueueDecision(0.49).status, "ready");
  assert.equal(mergeQueueDecision(0.6).status, "blocked");
  assert.equal(mergeQueueDecision(0.9).reasons.includes("human_review_required_for_critical_overlap"), true);
});

test("conflict scoring combines clean dry-run simulation with file overlap score", () => {
  const risk = createConflictRisk(
    lease("lease_a", "run_a", ["src/app.ts"]),
    lease("lease_b", "run_b", ["src/app.ts"]),
    new Date("2026-01-01T00:00:00.000Z"),
    {
      status: "clean",
      riskContribution: 0.1,
      summary: "clean dry-run"
    }
  );

  assert.equal(risk.riskScore, 0.6);
  assert.equal(risk.simulationStatus, "clean");
  assert.equal(risk.reasons.includes("dry_run_merge_clean"), true);
});

test("conflict scoring keeps no-overlap clean dry-run as safe low risk", () => {
  const risk = createConflictRisk(
    lease("lease_a", "run_a", ["src/a.ts"]),
    lease("lease_b", "run_b", ["src/b.ts"]),
    new Date("2026-01-01T00:00:00.000Z"),
    {
      status: "clean",
      riskContribution: 0.1,
      summary: "clean dry-run"
    }
  );

  assert.equal(risk.riskScore, 0.1);
  assert.equal(risk.riskLevel, "low");
  assert.equal(risk.recommendation, "safe");
});

test("conflict scoring elevates risk when dry-run simulation finds text conflicts", () => {
  const risk = createConflictRisk(
    lease("lease_a", "run_a", ["src/a.ts"]),
    lease("lease_b", "run_b", ["src/b.ts"]),
    new Date("2026-01-01T00:00:00.000Z"),
    {
      status: "text_conflict",
      riskContribution: 0.8,
      summary: "conflict dry-run"
    }
  );

  assert.equal(risk.riskScore, 0.8);
  assert.equal(risk.riskLevel, "high");
  assert.equal(risk.simulationStatus, "text_conflict");
  assert.equal(risk.reasons.includes("dry_run_text_conflict"), true);
});

test("merge queue decision reflects dry-run simulation status", () => {
  assert.equal(mergeQueueDecision(0.8, { status: "text_conflict", summary: "conflict" }).recommendation, "conflict_detected");
  assert.equal(mergeQueueDecision(0.1, { status: "clean", summary: "clean" }).recommendation, "safe_to_queue");
  assert.equal(mergeQueueDecision(0.35, { status: "unavailable", summary: "missing repo" }).recommendation, "simulation_unavailable");
});

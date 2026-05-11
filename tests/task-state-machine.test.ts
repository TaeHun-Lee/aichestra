import test from "node:test";
import assert from "node:assert/strict";
import { assertTaskStatusTransition, canTransitionTaskStatus } from "@aichestra/core";

test("task state machine allows the primary MVP workflow path", () => {
  const path = [
    "draft",
    "planned",
    "queued",
    "branch_created",
    "running",
    "testing",
    "pr_draft_ready",
    "completed"
  ] as const;

  for (let index = 0; index < path.length - 1; index += 1) {
    assert.equal(canTransitionTaskStatus(path[index], path[index + 1]), true);
  }
});

test("task state machine rejects invalid jumps", () => {
  assert.throws(() => assertTaskStatusTransition("draft", "merged"), /Invalid task status transition/);
});

test("task state machine allows rerun only from completed or failed into queued", () => {
  assert.equal(canTransitionTaskStatus("completed", "queued"), true);
  assert.equal(canTransitionTaskStatus("failed", "queued"), true);
  assert.equal(canTransitionTaskStatus("completed", "running"), false);
  assert.equal(canTransitionTaskStatus("failed", "running"), false);
});

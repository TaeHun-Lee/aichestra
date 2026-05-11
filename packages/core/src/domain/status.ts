export const taskStatuses = [
  "draft",
  "planned",
  "policy_blocked",
  "queued",
  "branch_created",
  "running",
  "testing",
  "pr_draft_ready",
  "pr_opened",
  "ci_pending",
  "ci_failed",
  "conflict_detected",
  "conflict_fixing",
  "review_required",
  "merge_ready",
  "merged",
  "completed",
  "failed",
  "cancelled"
] as const;

export type TaskStatus = typeof taskStatuses[number];

export const taskRunStatuses = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled"
] as const;

export type TaskRunStatus = typeof taskRunStatuses[number];

const taskTransitions: Record<TaskStatus, TaskStatus[]> = {
  draft: ["planned", "failed", "cancelled"],
  planned: ["policy_blocked", "queued", "failed", "cancelled"],
  policy_blocked: ["cancelled"],
  queued: ["branch_created", "running", "failed", "cancelled"],
  branch_created: ["running", "failed", "cancelled"],
  running: ["testing", "failed", "cancelled"],
  testing: ["pr_draft_ready", "conflict_detected", "review_required", "failed", "ci_failed", "cancelled"],
  pr_draft_ready: ["pr_opened", "review_required", "merge_ready", "completed", "failed", "cancelled"],
  pr_opened: ["ci_pending", "conflict_detected", "review_required", "failed", "cancelled"],
  ci_pending: ["ci_failed", "merge_ready", "failed", "cancelled"],
  ci_failed: ["failed", "review_required", "cancelled"],
  conflict_detected: ["conflict_fixing", "review_required", "failed", "cancelled"],
  conflict_fixing: ["review_required", "testing", "failed", "cancelled"],
  review_required: ["merge_ready", "failed", "cancelled"],
  merge_ready: ["merged", "failed", "cancelled"],
  merged: ["completed"],
  completed: ["queued"],
  failed: ["queued"],
  cancelled: []
};

export function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || taskTransitions[from]?.includes(to) === true;
}

export function assertTaskStatusTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTaskStatus(from, to)) {
    throw new Error(`Invalid task status transition: ${from} -> ${to}`);
  }
}

export function isTaskStatus(value: string): value is TaskStatus {
  return taskStatuses.includes(value as TaskStatus);
}

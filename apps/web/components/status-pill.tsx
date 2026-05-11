import type { TaskStatus } from "@aichestra/core";

export function StatusPill({ status }: { status: TaskStatus }) {
  return <span data-status={status}>{status.replaceAll("_", " ")}</span>;
}

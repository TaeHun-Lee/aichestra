import { getDashboardReadModels } from "../../../lib/dashboard-data-provider.ts";
import { StatusPill } from "../../../components/status-pill.tsx";
import type { TaskStatus } from "@aichestra/core";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const data = await getDashboardReadModels();
  const task = data.tasks.tasks.find((item) => item.id === params.id);
  const taskRun = data.tasks.taskRuns.filter((run) => run.taskId === task?.id).at(-1);
  const mergeQueueEntry = data.conflicts.mergeQueue.find((entry) => entry.taskRunId === taskRun?.id);

  if (!task) {
    return <main><h1>Task not found</h1></main>;
  }

  return (
    <main>
      <h1>{String(task.title ?? "Untitled task")}</h1>
      <StatusPill status={String(task.status ?? "draft") as TaskStatus} />
      <dl>
        <dt>Agent</dt>
        <dd>{String(task.selectedAgent ?? "none")}</dd>
        <dt>Model</dt>
        <dd>{String(task.selectedModel ?? "none")}</dd>
        <dt>Branch</dt>
        <dd>{String(task.branchName ?? "Not created")}</dd>
        <dt>Conflict risk</dt>
        <dd>{Number(task.conflictRiskScore ?? 0).toFixed(2)}</dd>
        <dt>Merge queue</dt>
        <dd>{String(mergeQueueEntry?.recommendation ?? mergeQueueEntry?.status ?? "pending")}</dd>
        <dt>Dry-run merge</dt>
        <dd>{String(mergeQueueEntry?.simulationStatus ?? "not_run")}</dd>
        <dt>Selected skills</dt>
        <dd>{JSON.stringify(taskRun?.selectedSkillRefs ?? "pending")}</dd>
        <dt>Selected harness</dt>
        <dd>{JSON.stringify(taskRun?.selectedHarnessRef ?? "pending")}</dd>
        <dt>Selected instructions</dt>
        <dd>{JSON.stringify(taskRun?.selectedInstructionRefs ?? "pending")}</dd>
        <dt>Registry warnings</dt>
        <dd>{Array.isArray(taskRun?.registryResolutionWarnings) ? taskRun.registryResolutionWarnings.join(", ") : "none"}</dd>
        <dt>Registry errors</dt>
        <dd>{Array.isArray(taskRun?.registryResolutionErrors) ? taskRun.registryResolutionErrors.join(", ") : "none"}</dd>
      </dl>
    </main>
  );
}

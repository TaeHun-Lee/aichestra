import { getDashboardData } from "../../../lib/mock-data.ts";
import { StatusPill } from "../../../components/status-pill.tsx";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const data = await getDashboardData();
  const task = data.tasks.find((item) => item.id === params.id);
  const taskRun = data.taskRuns.filter((run) => run.taskId === task?.id).at(-1);
  const mergeQueueEntry = data.mergeQueue.find((entry) => entry.taskRunId === taskRun?.id);

  if (!task) {
    return <main><h1>Task not found</h1></main>;
  }

  return (
    <main>
      <h1>{task.title}</h1>
      <StatusPill status={task.status} />
      <dl>
        <dt>Agent</dt>
        <dd>{task.selectedAgent}</dd>
        <dt>Model</dt>
        <dd>{task.selectedModel}</dd>
        <dt>Branch</dt>
        <dd>{task.branchName ?? "Not created"}</dd>
        <dt>Conflict risk</dt>
        <dd>{(task.conflictRiskScore ?? 0).toFixed(2)}</dd>
        <dt>Merge queue</dt>
        <dd>{mergeQueueEntry?.recommendation ?? mergeQueueEntry?.status ?? "pending"}</dd>
        <dt>Dry-run merge</dt>
        <dd>{mergeQueueEntry?.simulationStatus ?? "not_run"}</dd>
        <dt>Selected skills</dt>
        <dd>{taskRun?.selectedSkillRefs?.map((ref) => `${ref.name}@${ref.version}`).join(", ") ?? "pending"}</dd>
        <dt>Selected harness</dt>
        <dd>{taskRun?.selectedHarnessRef ? `${taskRun.selectedHarnessRef.name}@${taskRun.selectedHarnessRef.version}` : "pending"}</dd>
        <dt>Selected instructions</dt>
        <dd>{taskRun?.selectedInstructionRefs?.map((ref) => `${ref.name}@${ref.version}`).join(", ") ?? "pending"}</dd>
        <dt>Registry warnings</dt>
        <dd>{taskRun?.registryResolutionWarnings?.join(", ") || "none"}</dd>
        <dt>Registry errors</dt>
        <dd>{taskRun?.registryResolutionErrors?.join(", ") || "none"}</dd>
      </dl>
    </main>
  );
}

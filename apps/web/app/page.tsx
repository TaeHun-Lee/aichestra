import { getDashboardData } from "../lib/mock-data.ts";
import { StatusPill } from "../components/status-pill.tsx";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <main>
      <section>
        <h1>Aichestra</h1>
        <dl>
          <dt>Total tasks</dt>
          <dd>{data.totalTasks}</dd>
          <dt>Running</dt>
          <dd>{data.runningTasks}</dd>
          <dt>Conflicts</dt>
          <dd>{data.conflictTasks}</dd>
          <dt>Mock cost</dt>
          <dd>${data.mockCostUsd.toFixed(3)}</dd>
          <dt>Active skills</dt>
          <dd>{data.registryOverview.activeSkills}</dd>
          <dt>Active harnesses</dt>
          <dd>{data.registryOverview.activeHarnesses}</dd>
          <dt>Active instructions</dt>
          <dd>{data.registryOverview.activeInstructions}</dd>
        </dl>
      </section>
      <section>
        <h2>Recent tasks</h2>
        {data.tasks.map((task) => (
          <article key={task.id}>
            <h3>{task.title}</h3>
            <StatusPill status={task.status} />
            <p>{task.selectedAgent} / {task.selectedModel}</p>
            <p>Risk {(task.conflictRiskScore ?? 0).toFixed(2)}</p>
          </article>
        ))}
      </section>
      <section>
        <h2>Registries</h2>
        <h3>Skills</h3>
        {data.skills.map((skill) => (
          <article key={skill.id}>
            <h4>{skill.name}@{skill.version}</h4>
            <p>{skill.status} / approval {skill.approvalStatus} / eval {skill.evalStatus}</p>
          </article>
        ))}
        <h3>Harnesses</h3>
        {data.harnesses.map((harness) => (
          <article key={harness.id}>
            <h4>{harness.name}@{harness.version}</h4>
            <p>{harness.status} / approval {harness.approvalStatus} / eval {harness.evalStatus} / {harness.runtimeType}</p>
          </article>
        ))}
        <h3>Instructions</h3>
        {data.instructions.map((instruction) => (
          <article key={instruction.id}>
            <h4>{instruction.name}@{instruction.version}</h4>
            <p>{instruction.type} / {instruction.scope} / {instruction.status} / checksum {instruction.checksumStatus}</p>
          </article>
        ))}
        <h3>Registry audit</h3>
        <p>Recent events: {data.registryAuditLogs.length}</p>
        <h3>Approval queue</h3>
        <p>Pending approvals: {data.registryApprovalQueue.length}</p>
        {data.registryApprovalQueue.map((item) => (
          <article key={item.id}>
            <h4>{item.targetName}@{item.targetVersion}</h4>
            <p>{item.targetKind} / {item.approvalStatus} / {item.recommendedAction}</p>
          </article>
        ))}
        <h3>Registry operations</h3>
        <p>History revisions: {data.registryRevisions.length}</p>
        <p>Eval results: {data.registryEvalResults.length}</p>
        <h3>Registry packages</h3>
        <p>Package manifests: {data.registryPackages.length}</p>
        <p>Version range: {data.registryVersionResolution.requestedRange} selects {data.registryVersionResolution.selected?.version ?? "unresolved"}</p>
        <p>Package diff: {data.registryPackageDiff.summary} / {data.registryPackageDiff.riskLevel}</p>
      </section>
      <section>
        <h2>Conflict manager</h2>
        <p>Active leases: {data.activeLeases.length}</p>
        <p>Conflict risks: {data.conflictRisks.length}</p>
        <p>Merge queue entries: {data.mergeQueue.length}</p>
        <p>Dry-run simulations: {data.mergeSimulations.length}</p>
        {data.mergeQueue.map((entry) => (
          <article key={entry.id}>
            <h3>{entry.branchName}</h3>
            <p>{entry.simulationStatus ?? "not_run"} / {entry.recommendation}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

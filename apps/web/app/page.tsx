import { getDashboardReadModels } from "../lib/dashboard-data-provider.ts";
import { StatusPill } from "../components/status-pill.tsx";
import type { TaskStatus } from "@aichestra/core";

export default async function DashboardPage() {
  const data = await getDashboardReadModels();
  const metrics = data.overview.metrics;
  const tasks = data.tasks.recentTasks.length > 0 ? data.tasks.recentTasks : data.tasks.tasks;

  return (
    <main>
      <section>
        <h1>Aichestra</h1>
        <dl>
          <dt>Total tasks</dt>
          <dd>{String(metrics.totalTasks ?? 0)}</dd>
          <dt>Running</dt>
          <dd>{String(metrics.runningTasks ?? 0)}</dd>
          <dt>Conflicts</dt>
          <dd>{String(metrics.conflictTasks ?? 0)}</dd>
          <dt>Mock cost</dt>
          <dd>${Number(metrics.mockCostUsd ?? 0).toFixed(3)}</dd>
          <dt>Active skills</dt>
          <dd>{String(metrics.activeSkills ?? 0)}</dd>
          <dt>Active harnesses</dt>
          <dd>{String(metrics.activeHarnesses ?? 0)}</dd>
          <dt>Active instructions</dt>
          <dd>{String(metrics.activeInstructions ?? 0)}</dd>
          <dt>Data source</dt>
          <dd>{data.overview.source}</dd>
        </dl>
      </section>
      <section>
        <h2>Recent tasks</h2>
        {tasks.map((task) => (
          <article key={String(task.id)}>
            <h3>{String(task.title ?? "Untitled task")}</h3>
            <StatusPill status={String(task.status ?? "draft") as TaskStatus} />
            <p>{String(task.selectedAgent ?? "none")} / {String(task.selectedModel ?? "none")}</p>
            <p>Risk {Number(task.conflictRiskScore ?? 0).toFixed(2)}</p>
          </article>
        ))}
      </section>
      <section>
        <h2>Registries</h2>
        <p>Skills: {data.registry.skills.length}</p>
        <p>Harnesses: {data.registry.harnesses.length}</p>
        <p>Instructions: {data.registry.instructions.length}</p>
        <p>Pending approvals: {data.registry.approvalQueue.length}</p>
      </section>
      <section>
        <h2>Git Adapter</h2>
        <p>Provider: {String(data.git.config.providerKind ?? "unknown")}</p>
        <p>Remote Git: {data.git.config.remoteGitEnabled === true ? "enabled" : "disabled"}</p>
        <p>Pull requests: {data.git.pullRequests.length}</p>
      </section>
      <section>
        <h2>Security</h2>
        <p>Redaction: {data.security.redaction.enabled === true ? "enabled" : "available"}</p>
        <p>No secrets exposed: {data.overview.safety.noSecretsExposed ? "true" : "false"}</p>
      </section>
      <section>
        <h2>Policy Runtime PoC</h2>
        <p>Runtime: {String(data.policyRuntimePoc.summary.currentRuntime ?? "StaticPolicyEngine")}</p>
        <p>Recommended path: {String(data.policyRuntimePoc.summary.recommendedPocPath ?? "signed_json_yaml_shadow_first")}</p>
        <p>Golden cases: {String(data.policyRuntimePoc.summary.goldenCaseCount ?? data.policyRuntimePoc.goldenCases.length)}</p>
        <p>Golden harness: {String(data.policyRuntimePoc.goldenHarness.status ?? "pass")} ({String(data.policyRuntimePoc.goldenHarness.totalCases ?? 0)} cases)</p>
        <p>Shadow planning: {String(data.policyRuntimePoc.shadowSummary.status ?? "v1_implemented")}</p>
        <p>Shadow enforcement changed: {data.policyRuntimePoc.shadowSummary.enforcementChanged === true ? "true" : "false"}</p>
        <p>Runtime enforcement: {data.policyRuntimePoc.summary.runtimeEnforcementEnabled === true ? "enabled" : "disabled"}</p>
      </section>
    </main>
  );
}

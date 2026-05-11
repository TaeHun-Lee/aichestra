import { createSeededStore } from "@aichestra/db";
import { createRegistryService } from "@aichestra/registry";
import { runAgentTaskWorkflow } from "@aichestra/worker";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function renderDashboardHtml(): Promise<string> {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Fix login timeout bug",
    description: "Investigate and fix intermittent login timeout failures.",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedAgent: "codex",
    selectedModel: "mock-model",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20",
    budgetLimitUsd: 20
  });
  const overlappingTask = store.createTask({
    title: "Update auth session refresh",
    description: "Adjust auth session refresh behavior in the same files.",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedAgent: "codex",
    selectedModel: "mock-model",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20",
    budgetLimitUsd: 20
  });
  await runAgentTaskWorkflow(task.id, { store });
  await runAgentTaskWorkflow(overlappingTask.id, { store });
  const registryService = createRegistryService({
    skillRepository: store,
    harnessRepository: store,
    instructionRepository: store,
    auditRepository: {
      appendAuditLog: (input) => store.appendAuditLog(input),
      listAuditLogs: () => store.listRegistryAuditLogs(),
      listAuditLogsForTarget: (targetKind, targetId) => store.listAuditLogsForTarget(targetKind, targetId)
    },
    historyRepository: store,
    evalResultRepository: store,
    packageRepository: store
  });
  registryService.updateSkillApproval("skill_auth_debugging", { approvalStatus: "pending", reason: "dashboard review queue fixture" });
  registryService.attachEvalResult("harness", "harness_backend_node20", {
    evalName: "mock harness smoke",
    evalType: "mock",
    status: "passed",
    summary: "Mock harness smoke eval passed.",
    source: "mock",
    updateEvalStatus: true
  });
  const skillManifest = registryService.exportPackageManifest({ packageKind: "skill", targetId: "skill_auth_debugging" });
  const bundleManifest = registryService.exportPackageManifest({
    packageKind: "bundle",
    name: "dashboard-registry-bundle",
    version: "1.0.0"
  });
  const tasks = store.listTasks();
  const taskRuns = store.listTaskRuns(task.id);
  const latestRun = taskRuns.at(-1);
  const pullRequest = store.listPullRequests(task.id).at(-1);
  const mockCost = store.listUsageEvents().reduce((total, event) => total + (event.costUsd ?? 0), 0);
  const activeLeases = store.listBranchLeases("repo_demo_backend", "active");
  const conflictRisks = store.computeRepoConflictRisks("repo_demo_backend");
  const mergeQueue = store.listMergeQueueEntries("repo_demo_backend");
  const mergeSimulations = store.listMergeSimulations({ repoId: "repo_demo_backend" });
  const registryAuditLogs = store.listRegistryAuditLogs();
  const registryApprovalQueue = registryService.listApprovalQueue();
  const registryRevisions = store.listRevisionsForTarget("skill", "skill_auth_debugging");
  const registryEvalResults = store.listEvalResultsForTarget("harness", "harness_backend_node20");
  const registryPackages = registryService.listPackageManifests();
  const registryPackageDiff = registryService.diffPackageManifests(skillManifest, bundleManifest);
  const registryVersionResolution = registryService.resolveVersion("skill", "auth-debugging", "^1.0.0");
  const activeSkills = store.listSkills().filter((skill) => skill.status === "active").length;
  const activeHarnesses = store.listHarnesses().filter((harness) => harness.status === "active").length;
  const activeInstructions = store.listInstructions().filter((instruction) => instruction.status === "active").length;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aichestra Dashboard</title>
  <style>
    :root {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #171a20;
      background: #f6f7fa;
    }
    body {
      margin: 0;
    }
    header {
      border-bottom: 1px solid #d9dee8;
      background: #ffffff;
    }
    .shell {
      width: min(1160px, calc(100vw - 32px));
      margin: 0 auto;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 64px;
      gap: 16px;
    }
    .brand {
      font-size: 20px;
      font-weight: 700;
    }
    nav {
      display: flex;
      gap: 16px;
      color: #48505d;
      font-size: 14px;
    }
    main {
      padding: 28px 0 40px;
    }
    h1 {
      font-size: 28px;
      margin: 0 0 18px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 18px;
      margin: 0 0 12px;
      letter-spacing: 0;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .metric,
    .panel,
    .item {
      background: #ffffff;
      border: 1px solid #d9dee8;
      border-radius: 8px;
    }
    .metric {
      padding: 16px;
    }
    .label {
      color: #596372;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .value {
      font-size: 26px;
      font-weight: 700;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.8fr);
      gap: 16px;
    }
    .panel {
      padding: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th,
    td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid #edf0f5;
      vertical-align: top;
    }
    th {
      color: #596372;
      font-weight: 600;
    }
    .status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      background: #e7f4ed;
      color: #17623b;
      font-size: 12px;
      white-space: nowrap;
    }
    .list {
      display: grid;
      gap: 10px;
    }
    .item {
      padding: 12px;
    }
    .item strong {
      display: block;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .item span {
      color: #596372;
      font-size: 13px;
    }
    @media (max-width: 760px) {
      .metrics,
      .grid {
        grid-template-columns: 1fr;
      }
      .topbar {
        align-items: flex-start;
        flex-direction: column;
        padding: 14px 0;
      }
      nav {
        flex-wrap: wrap;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="shell topbar">
      <div class="brand">Aichestra</div>
      <nav aria-label="Primary">
        <a href="/">Dashboard</a>
        <a href="/tasks">Tasks</a>
        <a href="/registries">Registries</a>
      </nav>
    </div>
  </header>
  <main class="shell">
    <h1>AgentOps Control Plane</h1>
    <section class="metrics" aria-label="Summary metrics">
      <div class="metric"><div class="label">Total tasks</div><div class="value">${tasks.length}</div></div>
      <div class="metric"><div class="label">Completed</div><div class="value">${tasks.filter((item) => item.status === "completed").length}</div></div>
      <div class="metric"><div class="label">Conflicts</div><div class="value">${tasks.filter((item) => item.status === "conflict_detected").length}</div></div>
      <div class="metric"><div class="label">Mock cost</div><div class="value">$${mockCost.toFixed(3)}</div></div>
      <div class="metric"><div class="label">Active skills</div><div class="value">${activeSkills}</div></div>
      <div class="metric"><div class="label">Active harnesses</div><div class="value">${activeHarnesses}</div></div>
      <div class="metric"><div class="label">Active instructions</div><div class="value">${activeInstructions}</div></div>
    </section>
    <section class="grid">
      <div class="panel">
        <h2>Recent Tasks</h2>
        <table>
          <thead><tr><th>Task</th><th>Status</th><th>Agent</th><th>Branch</th><th>Risk</th><th>Queue</th><th>Simulation</th><th>Mock PR</th><th>Cost</th></tr></thead>
          <tbody>
            ${tasks.map((item) => {
              const itemPr = store.listPullRequests(item.id).at(-1);
              const itemRun = store.listTaskRuns(item.id).at(-1);
              const itemQueueEntry = mergeQueue.find((entry) => entry.taskRunId === itemRun?.id);
              const itemCost = store.listUsageEvents().filter((event) => event.taskId === item.id).reduce((total, event) => total + (event.costUsd ?? 0), 0);
              return `<tr><td>${escapeHtml(item.title)}</td><td><span class="status">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.selectedAgent ?? "codex")} / ${escapeHtml(item.selectedModel ?? "mock-model")}</td><td>${escapeHtml(item.branchName ?? "pending")}</td><td>${(item.conflictRiskScore ?? 0).toFixed(2)}</td><td>${escapeHtml(itemQueueEntry?.recommendation ?? itemQueueEntry?.status ?? "pending")}</td><td>${escapeHtml(itemQueueEntry?.simulationStatus ?? "pending")}</td><td>${itemPr?.url ? `<a href="${escapeHtml(itemPr.url)}">${escapeHtml(itemPr.externalId ?? "mock PR")}</a>` : "pending"}</td><td>$${itemCost.toFixed(3)}</td></tr>`;
            }).join("")}
          </tbody>
        </table>
        <h2>Task Detail</h2>
        <div class="item">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${escapeHtml(latestRun?.resultSummary ?? "No run summary")}</span>
        </div>
        <div class="item">
          <strong>Changed files</strong>
          <span>${escapeHtml((latestRun?.changedFiles ?? []).join(", ") || "none")}</span>
        </div>
        <div class="item">
          <strong>Diff summary</strong>
          <span>${escapeHtml(latestRun?.diffSummary ?? "pending")}</span>
        </div>
        <div class="item">
          <strong>Registry selection</strong>
          <span>Skills: ${escapeHtml(latestRun?.selectedSkillRefs?.map((ref) => `${ref.name}@${ref.version}`).join(", ") ?? "pending")} / Harness: ${escapeHtml(latestRun?.selectedHarnessRef ? `${latestRun.selectedHarnessRef.name}@${latestRun.selectedHarnessRef.version}` : "pending")} / Instructions: ${escapeHtml(latestRun?.selectedInstructionRefs?.map((ref) => `${ref.name}@${ref.version}`).join(", ") ?? "pending")}</span>
        </div>
        <div class="item">
          <strong>Registry warnings</strong>
          <span>${escapeHtml(latestRun?.registryResolutionWarnings?.join(", ") || "none")}</span>
        </div>
        <div class="item">
          <strong>Mock PR</strong>
          <span>${pullRequest?.url ? `<a href="${escapeHtml(pullRequest.url)}">${escapeHtml(pullRequest.url)}</a>` : "pending"}</span>
        </div>
        <h2>Active Leases</h2>
        <table>
          <thead><tr><th>Task run</th><th>Branch</th><th>Files</th><th>Status</th></tr></thead>
          <tbody>
            ${activeLeases.map((lease) => `<tr><td>${escapeHtml(lease.taskRunId)}</td><td>${escapeHtml(lease.branchName)}</td><td>${escapeHtml(lease.files.join(", "))}</td><td>${escapeHtml(lease.status)}</td></tr>`).join("")}
          </tbody>
        </table>
        <h2>Conflict Risks</h2>
        <table>
          <thead><tr><th>Source</th><th>Target</th><th>Overlap</th><th>Score</th><th>Dry-run</th><th>Recommendation</th></tr></thead>
          <tbody>
            ${conflictRisks.map((risk) => `<tr><td>${escapeHtml(risk.sourceTaskRunId)}</td><td>${escapeHtml(risk.targetTaskRunId)}</td><td>${escapeHtml(risk.overlapFiles.join(", ") || "none")}</td><td>${risk.riskScore.toFixed(2)}</td><td>${escapeHtml(risk.simulationStatus ?? "not_run")}</td><td>${escapeHtml(risk.recommendation)}</td></tr>`).join("")}
          </tbody>
        </table>
        <h2>Dry-run Merge Simulations</h2>
        <table>
          <thead><tr><th>Task run</th><th>Mode</th><th>Status</th><th>Conflicts</th><th>Changed files</th></tr></thead>
          <tbody>
            ${mergeSimulations.map((simulation) => `<tr><td>${escapeHtml(simulation.taskRunId ?? "unknown")}</td><td>${escapeHtml(simulation.mode)}</td><td>${escapeHtml(simulation.status)}</td><td>${escapeHtml(simulation.conflictingFiles.join(", ") || "none")}</td><td>${escapeHtml(simulation.changedFiles.join(", ") || "none")}</td></tr>`).join("")}
          </tbody>
        </table>
        <h2>Merge Queue</h2>
        <table>
          <thead><tr><th>Task run</th><th>Branch</th><th>PR</th><th>Score</th><th>Status</th><th>Simulation</th><th>Recommendation</th><th>Reasons</th></tr></thead>
          <tbody>
            ${mergeQueue.map((entry) => `<tr><td>${escapeHtml(entry.taskRunId)}</td><td>${escapeHtml(entry.branchName)}</td><td><a href="${escapeHtml(entry.pullRequestUrl)}">${escapeHtml(entry.pullRequestId)}</a></td><td>${entry.riskScore.toFixed(2)}</td><td>${escapeHtml(entry.status)}</td><td>${escapeHtml(entry.simulationStatus ?? "not_run")}</td><td>${escapeHtml(entry.recommendation)}</td><td>${escapeHtml(entry.reasons.join(", "))}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <aside class="panel">
        <h2>Registries</h2>
        <div class="list">
          ${store.listSkills().map((skill) => `<div class="item"><strong>${escapeHtml(skill.name)}</strong><span>Skill ${escapeHtml(skill.version)} / ${escapeHtml(skill.status)} / approval ${escapeHtml(skill.approvalStatus)} / eval ${escapeHtml(skill.evalStatus)}</span></div>`).join("")}
          ${store.listHarnesses().map((harness) => `<div class="item"><strong>${escapeHtml(harness.name)}</strong><span>Harness ${escapeHtml(harness.version)} / ${escapeHtml(harness.status)} / approval ${escapeHtml(harness.approvalStatus)} / eval ${escapeHtml(harness.evalStatus)} / ${escapeHtml(harness.runtimeType)}</span></div>`).join("")}
          ${store.listInstructions().map((instruction) => `<div class="item"><strong>${escapeHtml(instruction.name)}</strong><span>Instruction ${escapeHtml(instruction.version)} / ${escapeHtml(instruction.type)} / ${escapeHtml(instruction.status)} / approval ${escapeHtml(instruction.approvalStatus)} / eval ${escapeHtml(instruction.evalStatus)} / checksum ${escapeHtml(instruction.checksumStatus)}</span></div>`).join("")}
        </div>
        <h2>Registry Audit</h2>
        <div class="list">
          ${(registryAuditLogs.length > 0 ? registryAuditLogs : []).map((log) => `<div class="item"><strong>${escapeHtml(log.action)}</strong><span>${escapeHtml(log.targetKind)} ${escapeHtml(log.targetName)}@${escapeHtml(log.targetVersion)} by ${escapeHtml(log.actorId)}</span></div>`).join("") || `<div class="item"><strong>No registry audit events</strong><span>Registry mutations will appear here.</span></div>`}
        </div>
        <h2>Approval Queue</h2>
        <div class="list">
          ${registryApprovalQueue.map((item) => `<div class="item"><strong>${escapeHtml(item.targetName)}</strong><span>${escapeHtml(item.targetKind)} ${escapeHtml(item.targetVersion)} / ${escapeHtml(item.approvalStatus)} / ${escapeHtml(item.recommendedAction)}</span></div>`).join("") || `<div class="item"><strong>No pending approvals</strong><span>Pending registry approvals will appear here.</span></div>`}
        </div>
        <h2>Registry Operations</h2>
        <div class="list">
          <div class="item"><strong>History</strong><span>${registryRevisions.length} revisions for auth-debugging; rollback is available through the API.</span></div>
          <div class="item"><strong>Latest eval</strong><span>${escapeHtml(registryEvalResults.at(-1)?.summary ?? "No eval result attached")}</span></div>
        </div>
        <h2>Registry Packages</h2>
        <div class="list">
          ${registryPackages.map((manifest) => `<div class="item"><strong>${escapeHtml(manifest.name)}@${escapeHtml(manifest.version)}</strong><span>${escapeHtml(manifest.packageKind)} / ${manifest.entries.length} entries / ${escapeHtml(manifest.checksum)}</span></div>`).join("")}
          <div class="item"><strong>Version resolution</strong><span>${escapeHtml(registryVersionResolution.name)} ${escapeHtml(registryVersionResolution.requestedRange)} -> ${escapeHtml(registryVersionResolution.selected?.version ?? "unresolved")}</span></div>
          <div class="item"><strong>Package diff</strong><span>${escapeHtml(registryPackageDiff.summary)} / risk ${escapeHtml(registryPackageDiff.riskLevel)}</span></div>
        </div>
      </aside>
    </section>
    <template data-current-task="${escapeHtml(task.id)}"></template>
  </main>
</body>
</html>`;
}

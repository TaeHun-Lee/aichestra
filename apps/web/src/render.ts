import type { DashboardDataProvider } from "../lib/dashboard-data-provider.ts";
import { createDashboardDataProviderFromEnv } from "../lib/dashboard-data-provider.ts";
import type { DashboardJsonObject, DashboardReadModels } from "@aichestra/shared";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function text(value: unknown, fallback = "none"): string {
  if (value === null || value === undefined) return fallback;
  if (Array.isArray(value)) return value.map((item) => text(item, "")).filter(Boolean).join(", ") || fallback;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function html(value: unknown, fallback = "none"): string {
  return escapeHtml(text(value, fallback));
}

function asObjects(value: unknown): DashboardJsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is DashboardJsonObject => typeof item === "object" && item !== null && !Array.isArray(item))
    : [];
}

function nestedObjects(source: DashboardJsonObject, key: string): DashboardJsonObject[] {
  return asObjects(source[key]);
}

function latestRunForTask(data: DashboardReadModels, taskId: unknown): DashboardJsonObject | undefined {
  const id = typeof taskId === "string" ? taskId : undefined;
  return data.tasks.taskRuns.filter((run) => run.taskId === id).at(-1);
}

function renderItems(items: DashboardJsonObject[], emptyTitle: string, render: (item: DashboardJsonObject) => string): string {
  if (items.length === 0) {
    return `<div class="item"><strong>${escapeHtml(emptyTitle)}</strong><span>No records in the current read model.</span></div>`;
  }
  return items.map(render).join("");
}

function renderStatus(value: unknown): string {
  return `<span class="status">${html(value, "unknown")}</span>`;
}

export function renderDashboardReadModels(data: DashboardReadModels): string {
  const metrics = data.overview.metrics;
  const tasks = data.tasks.recentTasks.length > 0 ? data.tasks.recentTasks : data.tasks.tasks;
  const selectedTask = data.tasks.tasks[0];
  const selectedRun = selectedTask ? latestRunForTask(data, selectedTask.id) : undefined;
  const governance = data.registry.governance;
  const proposalReadiness = nestedObjects(governance, "proposalReadiness");
  const canaryReadiness = nestedObjects(governance, "canaryReadiness");
  const proposalApplyGates = nestedObjects(governance, "proposalApplyGates");
  const safetyPolicies = nestedObjects(governance, "safetyPolicies");

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
      <div class="metric"><div class="label">Total tasks</div><div class="value">${html(metrics.totalTasks, "0")}</div></div>
      <div class="metric"><div class="label">Completed</div><div class="value">${html(metrics.completedTasks, "0")}</div></div>
      <div class="metric"><div class="label">Conflicts</div><div class="value">${html(metrics.conflictTasks, "0")}</div></div>
      <div class="metric"><div class="label">Mock cost</div><div class="value">$${Number(metrics.mockCostUsd ?? 0).toFixed(3)}</div></div>
      <div class="metric"><div class="label">Active skills</div><div class="value">${html(metrics.activeSkills, "0")}</div></div>
      <div class="metric"><div class="label">Active harnesses</div><div class="value">${html(metrics.activeHarnesses, "0")}</div></div>
      <div class="metric"><div class="label">Active instructions</div><div class="value">${html(metrics.activeInstructions, "0")}</div></div>
      <div class="metric"><div class="label">Data source</div><div class="value">${html(data.overview.source)}</div></div>
    </section>
    <section class="grid">
      <div class="panel">
        <h2>Recent Tasks</h2>
        <table>
          <thead><tr><th>Task</th><th>Status</th><th>Agent</th><th>Branch</th><th>Risk</th><th>Run</th><th>Cost</th></tr></thead>
          <tbody>
            ${tasks.map((task) => `<tr><td>${html(task.title)}</td><td>${renderStatus(task.status)}</td><td>${html(task.selectedAgent)} / ${html(task.selectedModel)}</td><td>${html(task.branchName, "pending")}</td><td>${Number(task.conflictRiskScore ?? 0).toFixed(2)}</td><td>${html(task.latestRunStatus, "pending")}</td><td>$${Number(task.usageCostUsd ?? 0).toFixed(3)}</td></tr>`).join("") || `<tr><td colspan="7">No tasks in API read model.</td></tr>`}
          </tbody>
        </table>
        <h2>Task Detail</h2>
        <div class="item">
          <strong>${html(selectedTask?.title, "No selected task")}</strong>
          <span>${html(selectedRun?.resultSummary, "No run summary")}</span>
        </div>
        <div class="item">
          <strong>Changed files</strong>
          <span>${html(selectedRun?.changedFiles, "none")}</span>
        </div>
        <div class="item">
          <strong>Diff summary</strong>
          <span>${html(selectedRun?.diffSummary, "pending")}</span>
        </div>
        <div class="item">
          <strong>Registry selection</strong>
          <span>Skills: ${html(selectedRun?.selectedSkillRefs, "pending")} / Harness: ${html(selectedRun?.selectedHarnessRef, "pending")} / Instructions: ${html(selectedRun?.selectedInstructionRefs, "pending")}</span>
        </div>
        <div class="item">
          <strong>Registry warnings</strong>
          <span>${html(selectedRun?.registryResolutionWarnings, "none")}</span>
        </div>
        <h2>Active Leases</h2>
        <table>
          <thead><tr><th>Task run</th><th>Branch</th><th>Files</th><th>Status</th></tr></thead>
          <tbody>
            ${data.conflicts.branchLeases.map((lease) => `<tr><td>${html(lease.taskRunId)}</td><td>${html(lease.branchName)}</td><td>${html(lease.files, "none")}</td><td>${html(lease.status)}</td></tr>`).join("")}
          </tbody>
        </table>
        <h2>Conflict Risks</h2>
        <table>
          <thead><tr><th>Source</th><th>Target</th><th>Overlap</th><th>Score</th><th>Dry-run</th><th>Recommendation</th></tr></thead>
          <tbody>
            ${data.conflicts.conflictRisks.map((risk) => `<tr><td>${html(risk.sourceTaskRunId)}</td><td>${html(risk.targetTaskRunId)}</td><td>${html(risk.overlapFiles, "none")}</td><td>${Number(risk.riskScore ?? 0).toFixed(2)}</td><td>${html(risk.simulationStatus, "not_run")}</td><td>${html(risk.recommendation)}</td></tr>`).join("")}
          </tbody>
        </table>
        <h2>Dry-run Merge Simulations</h2>
        <table>
          <thead><tr><th>Task run</th><th>Mode</th><th>Status</th><th>Conflicts</th><th>Changed files</th></tr></thead>
          <tbody>
            ${data.conflicts.mergeSimulations.map((simulation) => `<tr><td>${html(simulation.taskRunId, "unknown")}</td><td>${html(simulation.mode)}</td><td>${html(simulation.status)}</td><td>${html(simulation.conflictingFiles, "none")}</td><td>${html(simulation.changedFiles, "none")}</td></tr>`).join("")}
          </tbody>
        </table>
        <h2>Merge Queue</h2>
        <table>
          <thead><tr><th>Task run</th><th>Branch</th><th>PR</th><th>Score</th><th>Status</th><th>Simulation</th><th>Recommendation</th><th>Reasons</th></tr></thead>
          <tbody>
            ${data.conflicts.mergeQueue.map((entry) => `<tr><td>${html(entry.taskRunId)}</td><td>${html(entry.branchName)}</td><td>${html(entry.pullRequestId)}</td><td>${Number(entry.riskScore ?? 0).toFixed(2)}</td><td>${html(entry.status)}</td><td>${html(entry.simulationStatus, "not_run")}</td><td>${html(entry.recommendation)}</td><td>${html(entry.reasons, "none")}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <aside class="panel">
        <h2>Registries</h2>
        <div class="list">
          ${renderItems(data.registry.skills, "No skills", (skill) => `<div class="item"><strong>${html(skill.name)}</strong><span>Skill ${html(skill.version)} / ${html(skill.status)} / approval ${html(skill.approvalStatus)} / eval ${html(skill.evalStatus)}</span></div>`)}
          ${renderItems(data.registry.harnesses, "No harnesses", (harness) => `<div class="item"><strong>${html(harness.name)}</strong><span>Harness ${html(harness.version)} / ${html(harness.status)} / approval ${html(harness.approvalStatus)} / eval ${html(harness.evalStatus)} / ${html(harness.runtimeType)}</span></div>`)}
          ${renderItems(data.registry.instructions, "No instructions", (instruction) => `<div class="item"><strong>${html(instruction.name)}</strong><span>Instruction ${html(instruction.version)} / ${html(instruction.type)} / ${html(instruction.status)} / approval ${html(instruction.approvalStatus)} / eval ${html(instruction.evalStatus)} / checksum ${html(instruction.checksumStatus)}</span></div>`)}
        </div>
        <h2>Registry Audit</h2>
        <div class="list">${renderItems(data.registry.auditLogs, "No registry audit events", (log) => `<div class="item"><strong>${html(log.action)}</strong><span>${html(log.targetKind)} ${html(log.targetName)}@${html(log.targetVersion)} by ${html(log.actorId)}</span></div>`)}</div>
        <h2>Approval Queue</h2>
        <div class="list">${renderItems(data.registry.approvalQueue, "No pending approvals", (item) => `<div class="item"><strong>${html(item.targetName)}</strong><span>${html(item.targetKind)} ${html(item.targetVersion)} / ${html(item.approvalStatus)} / ${html(item.recommendedAction)}</span></div>`)}</div>
        <h2>Registry Operations</h2>
        <div class="list">
          <div class="item"><strong>History</strong><span>${data.registry.revisions.length} revisions; rollback is available through the API.</span></div>
          <div class="item"><strong>Latest eval</strong><span>${html(data.registry.evalResults.at(-1)?.summary, "No eval result attached")}</span></div>
        </div>
        <h2>Registry Packages</h2>
        <div class="list">
          ${renderItems(data.registry.packages, "No package manifests", (manifest) => `<div class="item"><strong>${html(manifest.name)}@${html(manifest.version)}</strong><span>${html(manifest.packageKind)} / entries ${Array.isArray(manifest.entries) ? manifest.entries.length : 0} / ${html(manifest.checksum)}</span></div>`)}
          <div class="item"><strong>Version resolution</strong><span>API-backed read model exposes registry package and approval state.</span></div>
          <div class="item"><strong>Package diff</strong><span>Package diff remains available through registry APIs.</span></div>
        </div>
        <h2>Git Adapter</h2>
        <div class="list">
          <div class="item"><strong>Provider</strong><span>${html(data.git.config.providerKind)} / remote Git ${data.git.config.remoteGitEnabled === true ? "enabled" : "disabled"} / branch create ${data.git.config.remoteBranchCreateEnabled === true ? "enabled" : "disabled"} / PR create ${data.git.config.remotePullRequestCreateEnabled === true ? "enabled" : "disabled"} / merge disabled</span></div>
          <div class="item"><strong>GitHub gates</strong><span>configured ${data.git.config.githubConfigured === true ? "yes" : "no"} / allowed repos ${html(data.git.config.githubAllowedRepoCount, "0")} / prefix ${html(data.git.config.githubAllowedBranchPrefix, "ai/")} / integration tests ${data.git.config.githubIntegrationTestsEnabled === true ? "enabled" : "skipped"}</span></div>
          <div class="item"><strong>Webhook gates</strong><span>webhooks ${data.git.webhookConfig.webhooksEnabled === true ? "enabled" : "disabled"} / secret ${data.git.webhookConfig.webhookSecretConfigured === true ? "configured" : "missing"} / accept unverified ${data.git.webhookConfig.webhookAcceptUnverified === true ? "enabled" : "disabled"} / events ${html(data.git.webhookConfig.supportedWebhookEventCount, "0")}</span></div>
          <div class="item"><strong>Branches</strong><span>${html(data.git.branchRecords.map((branch) => branch.branchName), "none")}</span></div>
          <div class="item"><strong>Pull requests</strong><span>${html(data.git.pullRequests.map((pr) => pr.url ?? pr.externalId ?? pr.id), "none")}</span></div>
          <div class="item"><strong>Webhook events</strong><span>${html(data.git.webhookEvents.map((event) => `${text(event.eventType)}:${text(event.status)}`), "none")}</span></div>
          <div class="item"><strong>PR sync</strong><span>${html(data.git.pullRequestSyncStates.map((state) => `${text(state.repoRef)}#${text(state.pullRequestNumber)}:${text(state.state)}`), "none")}</span></div>
          <div class="item"><strong>Branch sync</strong><span>${html(data.git.branchSyncStates.map((state) => `${text(state.branchName)}:${text(state.exists)}`), "none")}</span></div>
          <div class="item"><strong>Changed files</strong><span>${html(data.git.changedFiles.map((file) => `${text(file.path)}:${text(file.status)}`), "none")}</span></div>
          <div class="item"><strong>Changed-file refresh</strong><span>${html(data.git.changedFilesRefreshStatus.lastResult, "none")} / ${html(data.git.changedFilesRefreshStatus.lastReason, "no recent refresh")}</span></div>
          <div class="item"><strong>Merge queue linkage</strong><span>${html(data.git.mergeQueueLinkage.map((entry) => `${text(entry.pullRequestId)}:${text(entry.recommendation)}`), "none")}</span></div>
          <div class="item"><strong>Git audit</strong><span>${html(data.git.auditEvents.map((event) => event.action), "none")}</span></div>
          <div class="item"><strong>Remote Git audit</strong><span>${html(data.git.remoteAuditEvents.map((event) => event.action), "none")}</span></div>
          <div class="item"><strong>Webhook audit</strong><span>${html(data.git.webhookAuditEvents.map((event) => `${text(event.eventType)}:${text(event.result)}`), "none")}</span></div>
          <div class="item"><strong>Remote blocked example</strong><span>${html(data.git.blockedExamples.map((example) => example.reason), "none")}</span></div>
        </div>
        <h2>GitHub App / Webhook Hardening</h2>
        <div class="list">
          <div class="item"><strong>Status</strong><span>${html(data.githubApp.summary.status, "v0_implemented")} / planning only ${html(data.githubApp.summary.planningOnly, "true")} / production ready false / external calls ${data.githubApp.summary.externalCallsEnabled === true ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Permissions</strong><span>${html(data.githubApp.permissionMatrix.map((entry) => `${text(entry.githubPermissionName)}:${text(entry.requiredLevel)}:${text(entry.productionDefault)}`), "none")}</span></div>
          <div class="item"><strong>Webhook events</strong><span>${html(data.githubApp.webhookEventAllowlist.map((event) => `${text(event.eventName)}:${text(event.supportStatus)}`), "none")}</span></div>
          <div class="item"><strong>Replay protection</strong><span>${html(data.githubApp.replayProtection.status, "planning_only")} / delivery id ${html(data.githubApp.replayProtection.deliveryIdUniqueness, "required")} / production ready false</span></div>
          <div class="item"><strong>Delivery records</strong><span>${html(data.githubApp.webhookDeliveries.map((delivery) => `${text(delivery.deliveryId)}:${text(delivery.replayStatus)}:${text(delivery.processingStatus)}`), "none")}</span></div>
          <div class="item"><strong>Dead letter</strong><span>${html(data.githubApp.deadLetterPlan.status, "planning_only")} / max attempts ${html(data.githubApp.deadLetterPlan.maxRetryAttempts, "0")} / records ${data.githubApp.deadLetterRecords.length}</span></div>
          <div class="item"><strong>Credentials</strong><span>private key configured ${data.githubApp.credentialReadiness.privateKeyConfigured === true ? "true" : "false"} / token exchange ${data.githubApp.credentialReadiness.installationTokenExchangeImplemented === true ? "implemented" : "not implemented"} / no secrets stored ${html(data.githubApp.credentialReadiness.noSecretsStored, "true")}</span></div>
          <div class="item"><strong>Endpoint</strong><span>${html(data.githubApp.productionEndpoint.endpointPath, "/git/github/webhooks")} / TLS required ${html(data.githubApp.productionEndpoint.tlsRequired, "true")} / queue required ${html(data.githubApp.productionEndpoint.queueRequired, "true")} / deployed false</span></div>
          <div class="item"><strong>Blockers</strong><span>${html(data.githubApp.blockers.map((blocker) => `${text(blocker.id)}:${text(blocker.severity)}`), "none")}</span></div>
          <div class="item"><strong>Risks</strong><span>${html(data.githubApp.productionRisks.map((risk) => `${text(risk.id)}:${text(risk.severity)}:${text(risk.status)}`), "none")}</span></div>
          <div class="item"><strong>No-secret status</strong><span>private keys stored ${data.githubApp.noSecretStatus.privateKeysStored === true ? "true" : "false"} / webhook secrets exposed ${data.githubApp.noSecretStatus.webhookSecretsExposed === true ? "true" : "false"} / installation tokens issued ${data.githubApp.noSecretStatus.installationTokensIssued === true ? "true" : "false"}</span></div>
        </div>
        <h2>LLM Gateway</h2>
        <div class="list">
          <div class="item"><strong>Provider</strong><span>${html(data.llm.config.providerKind)} / remote LLM ${data.llm.config.remoteLlmEnabled === true ? "enabled" : "disabled"} / remote completion ${data.llm.config.remoteCompletionEnabled === true ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Routing</strong><span>${html(data.llm.routing.routingMode ?? data.llm.config.routingMode ?? "mock_only")} / fallback ${data.llm.routing.fallbackEnabled === true || data.llm.config.fallbackEnabled === true ? "enabled" : "disabled"} / max attempts ${html(data.llm.routing.maxFallbackAttempts ?? data.llm.config.maxFallbackAttempts ?? "0")}</span></div>
          <div class="item"><strong>Routes</strong><span>${html(data.llm.routes.map((route) => `${text(route.id)}:${text(route.enabled)}`), "none")}</span></div>
          <div class="item"><strong>Provider health</strong><span>${html(data.llm.providerHealth.map((provider) => `${text(provider.providerKind)}:${text(provider.status)}`), "none")}</span></div>
          <div class="item"><strong>Remote gates</strong><span>base URL ${data.llm.config.baseUrlConfigured === true ? "configured" : "missing"} / API key ${data.llm.config.apiKeyConfigured === true ? "configured" : "missing"} / allowed models ${html(data.llm.config.allowedModelCount, "0")} / integration tests ${data.llm.config.integrationTestsEnabled === true ? "enabled" : "skipped"}</span></div>
          <div class="item"><strong>Model catalog</strong><span>${html(data.llm.models.map((model) => `${text(model.id)}:${text(model.status)}`), "none")}</span></div>
          <div class="item"><strong>Virtual model keys</strong><span>${html(data.llm.virtualKeys.map((key) => `${text(key.id)}:${text(key.status)}:storesProviderSecret=false`), "none")}</span></div>
          <div class="item"><strong>Budget policy</strong><span>${html(data.llm.budget.budgetDecision ?? "budget checks enabled")} / selected ${html(data.llm.budget.selectedModel, "openai-compatible/default")} / API key not exposed</span></div>
          <div class="item"><strong>Recent LLM usage</strong><span>${html(data.llm.usageEvents.map((event) => `${text(event.model)}:${text(event.costUsd)}`), "none")}</span></div>
          <div class="item"><strong>LLM audit</strong><span>${html(data.llm.auditEvents.map((event) => event.eventType), "none")}</span></div>
          <div class="item"><strong>Routing decisions</strong><span>${html(data.llm.routingDecisions.map((decision) => `${text(decision.decision)}:${text(decision.reason)}`), "none")}</span></div>
          <div class="item"><strong>Remote LLM blocked example</strong><span>${html(data.llm.blockedExamples.map((example) => example.reason), "remote LLM blocked")}</span></div>
        </div>
        <h2>MCP Gateway</h2>
        <div class="list">
          <div class="item"><strong>Gateway</strong><span>${html(data.mcp.config.gatewayKind)} / real transport ${data.mcp.config.realTransportEnabled === true ? "enabled" : "disabled"} / external calls ${data.mcp.config.externalCallsEnabled === true ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Servers</strong><span>${html(data.mcp.servers.map((server) => `${text(server.id)}:${text(server.status)}`), "none")}</span></div>
          <div class="item"><strong>Tools</strong><span>${html(data.mcp.tools.map((tool) => `${text(tool.id)}:${text(tool.riskLevel)}:${text(tool.status)}`), "none")}</span></div>
          <div class="item"><strong>Risk summary</strong><span>low ${html(data.mcp.riskSummary.low, "0")} / high ${html(data.mcp.riskSummary.high, "0")} / critical ${html(data.mcp.riskSummary.critical, "0")} / enabled high-critical ${html(data.mcp.riskSummary.highCriticalEnabled, "0")}</span></div>
          <div class="item"><strong>Recent invocations</strong><span>${html(data.mcp.invocations.map((invocation) => `${text(invocation.toolId)}:${text(invocation.status)}`), "none")}</span></div>
          <div class="item"><strong>MCP audit</strong><span>${html(data.mcp.auditEvents.map((event) => `${text(event.eventType)}:${text(event.result)}`), "none")}</span></div>
          <div class="item"><strong>Blocked examples</strong><span>${html(data.mcp.blockedExamples.map((example) => `${text(example.operation)}:${text(example.reason)}`), "none")}</span></div>
          <div class="item"><strong>LLM and Runner</strong><span>LLM auto tool execution ${data.mcp.integration.llmAutoToolExecution === true ? "enabled" : "disabled"} / runner direct tool execution ${data.mcp.integration.runnerDirectToolExecution === true ? "enabled" : "disabled"}</span></div>
        </div>
        <h2>Production Readiness</h2>
        <div class="list">
          <div class="item"><strong>Profile</strong><span>${html(data.readiness.summary.currentProfileId, "local")} / status ${html(data.readiness.summary.productionReadinessStatus, "blocked")} / production ready false</span></div>
          <div class="item"><strong>Critical blockers</strong><span>${html(data.readiness.productionBlockers.map((blocker) => `${text(blocker.id)}:${text(blocker.severity)}`), "none")}</span></div>
          <div class="item"><strong>High-risk areas</strong><span>${html(data.readiness.risks.filter((risk) => risk.status === "open" && (risk.severity === "high" || risk.severity === "critical")).map((risk) => `${text(risk.id)}:${text(risk.severity)}`), "none")}</span></div>
          <div class="item"><strong>Missing requirements</strong><span>${html(data.readiness.missingProductionRequirements, "none")}</span></div>
          <div class="item"><strong>Environment warnings</strong><span>${html(data.readiness.environmentWarnings, "none")}</span></div>
          <div class="item"><strong>No-secret exposure</strong><span>${data.readiness.noSecretsExposed === true ? "true" : "false"} / readiness checks are local planning data only</span></div>
        </div>
        <h2>Database Operations</h2>
        <div class="list">
          <div class="item"><strong>Status</strong><span>${html(data.database.summary.status, "v1_implemented")} / planning only ${html(data.database.summary.planningOnly, "true")} / production ready false / provider ${html(data.database.summary.storageProviderKind, "in_memory")}</span></div>
          <div class="item"><strong>Deployment profiles</strong><span>${html(data.database.profiles.map((profile) => `${text(profile.id)}:${text(profile.status)}:${text(profile.storageProvider)}`), "none")}</span></div>
          <div class="item"><strong>Migration readiness</strong><span>runner ${data.database.summary.migrationRunnerAvailable === true ? "available" : "missing"} / files ${html(data.database.summary.migrationFileCount, "0")} / ${html(data.database.migrations.map((migration) => `${text(migration.name)}:${text(migration.status)}`), "none")}</span></div>
          <div class="item"><strong>Index review</strong><span>${html(data.database.indexReview.map((item) => `${text(item.tableName)}:${text(item.status)}`), "none")}</span></div>
          <div class="item"><strong>Retention and audit growth</strong><span>deletion jobs ${data.database.retentionPlan.deletionJobsEnabled === true ? "enabled" : "disabled"} / partitioning ${data.database.retentionPlan.partitioningImplemented === true ? "implemented" : "planned"} / audit tables ${html(data.database.auditGrowthPlan.highGrowthTables, "none")}</span></div>
          <div class="item"><strong>Webhook persistence</strong><span>${html(data.database.webhookPersistencePlan.status, "planning_only")} / delivery uniqueness ${html(data.database.webhookPersistencePlan.deliveryIdUniqueness, "required")} / raw payload storage ${data.database.webhookPersistencePlan.rawPayloadStorage === true ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Backup and restore</strong><span>backup ${html(data.database.summary.backupStatus, "planned_not_configured")} / restore ${html(data.database.summary.restoreStatus, "planned_not_tested")} / pooling ${html(data.database.summary.poolingStatus, "planned_not_enabled")}</span></div>
          <div class="item"><strong>Critical risks</strong><span>${html(data.database.criticalRisks.map((risk) => `${text(risk.id)}:${text(risk.severity)}`), "none")}</span></div>
          <div class="item"><strong>No DB URL exposure</strong><span>configured ${data.database.summary.databaseUrlConfigured === true ? "true" : "false"} / value exposed ${data.database.noSecretStatus.databaseUrlExposed === true ? "true" : "false"} / production connection attempted ${data.database.noSecretStatus.productionDbConnectionAttempted === true ? "true" : "false"}</span></div>
        </div>
        <h2>Secret Backend Migration</h2>
        <div class="list">
          <div class="item"><strong>Status</strong><span>${html(data.secretBackend.summary.status, "v0_implemented")} / planning only ${html(data.secretBackend.summary.planningOnly, "true")} / production ready false / real backend configured ${data.secretBackend.summary.realSecretBackendConfigured === true ? "true" : "false"}</span></div>
          <div class="item"><strong>Backend options</strong><span>${html(data.secretBackend.backendOptions.map((option) => `${text(option.backendKind)}:${text(option.status)}:${text(option.productionRecommended)}`), "none")}</span></div>
          <div class="item"><strong>Env fallback warning</strong><span>${html(data.secretBackend.envFallback.warning, "env_fallback_allowed_for_local_only")} / allowed for current profile ${data.secretBackend.envFallback.allowedForCurrentProfile === true ? "true" : "false"} / env values exposed ${data.secretBackend.envFallback.envValuesExposed === true ? "true" : "false"}</span></div>
          <div class="item"><strong>Credential kind migration</strong><span>${html(data.secretBackend.credentialKindStatus.map((item) => `${text(item.secretKind)}:rotation=${text(item.rotationStatus)}:lease=${text(item.leaseStatus)}`), "none")}</span></div>
          <div class="item"><strong>Lease TTL and rotation</strong><span>${html(data.secretBackend.leasePolicies.map((policy) => `${text(policy.secretKind)}:${text(policy.maxTtlSeconds)}s:approval=${text(policy.requiresApproval)}`), "none")} / rotations ${html(data.secretBackend.rotationPlans.map((plan) => `${text(plan.secretKind)}:${text(plan.rotationMode)}:${text(plan.status)}`), "none")}</span></div>
          <div class="item"><strong>Migration phases</strong><span>${html(data.secretBackend.migrationPhases.map((phase) => `${text(phase.order)}:${text(phase.status)}:${text(phase.name)}`), "none")}</span></div>
          <div class="item"><strong>Production blockers</strong><span>${html(data.secretBackend.blockers.map((blocker) => `${text(blocker.id)}:${text(blocker.severity)}`), "none")}</span></div>
          <div class="item"><strong>Secret backend risks</strong><span>${html(data.secretBackend.risks.map((risk) => `${text(risk.id)}:${text(risk.severity)}:${text(risk.status)}`), "none")}</span></div>
          <div class="item"><strong>No-secret/no-env status</strong><span>no secrets exposed ${data.secretBackend.noSecretStatus.noSecretsExposed === true ? "true" : "false"} / env values exposed ${data.secretBackend.noSecretStatus.envValuesExposed === true ? "true" : "false"} / credential caches read ${data.secretBackend.noSecretStatus.credentialCachesRead === true ? "true" : "false"} / external calls ${data.secretBackend.noSecretStatus.externalCallsEnabled === true ? "enabled" : "disabled"}</span></div>
        </div>
        <h2>Observability</h2>
        <div class="list">
          <div class="item"><strong>Status</strong><span>${html(data.observability.config.status)} / ${html(data.observability.config.aggregationMode)} / external backend ${data.observability.config.externalBackendEnabled === true ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Audit summary</strong><span>${html(data.observability.auditSummary.totalEvents, "0")} normalized event(s) / no secrets ${html(data.observability.auditSummary.noSecretsExposed, "true")}</span></div>
          <div class="item"><strong>Denied or blocked</strong><span>${html(data.observability.deniedOrBlockedEvents.map((event) => `${text(event.category)}:${text(event.eventType)}:${text(event.outcome)}`), "none")}</span></div>
          <div class="item"><strong>Security events</strong><span>${html(data.observability.recentSecurityEvents.map((event) => `${text(event.category)}:${text(event.eventType)}`), "none")}</span></div>
          <div class="item"><strong>Retention classes</strong><span>${html(data.observability.retentionClasses.map((item) => `${text(item.id)}:${text(item.defaultTtlDays)}`), "none")} / v0 deletes no audit data</span></div>
          <div class="item"><strong>Redaction classes</strong><span>${html(data.observability.redactionClasses.map((item) => `${text(item.id)}:${text(item.maxPreviewBytes)}`), "none")}</span></div>
          <div class="item"><strong>Metric snapshot</strong><span>${html(nestedObjects(data.observability.metricSnapshot, "points").map((point) => `${text(point.metricName)}:${text(point.value)}`), "none")}</span></div>
          <div class="item"><strong>Trace skeleton</strong><span>${html(data.observability.traceSpans.map((span) => `${text(span.name)}:${text(span.status)}`), "none")} / exporter disabled</span></div>
          <div class="item"><strong>Audit source coverage</strong><span>${html(data.observability.sourceCoverage.map((source) => `${text(source.moduleName)}:${text(source.normalized)}`), "none")}</span></div>
          <div class="item"><strong>Readiness blockers</strong><span>${html(data.observability.productionReadinessBlockers.map((blocker) => `${text(blocker.id)}:${text(blocker.status ?? blocker.severity)}`), "none")}</span></div>
          <div class="item"><strong>No-secret status</strong><span>raw payloads stored ${data.observability.noSecretStatus.rawPayloadsStored === true ? "true" : "false"} / external exporter ${data.observability.noSecretStatus.externalExporterEnabled === true ? "enabled" : "disabled"} / retention deletes ${data.observability.noSecretStatus.retentionDeletesEnabled === true ? "enabled" : "disabled"}</span></div>
        </div>
        <h2>Agent Runner</h2>
        <div class="list">
          <div class="item"><strong>Runner</strong><span>${html(data.agents.config.runnerKind)} / local runner ${data.agents.config.localRunnerEnabled === true ? "enabled" : "disabled"} / command execution ${data.agents.config.localCommandExecutionEnabled === true ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Command executor</strong><span>${html(data.agents.config.commandExecutorKind)} / max runtime ${html(data.agents.config.maxRuntimeMs)}ms</span></div>
          <div class="item"><strong>Latest agent run</strong><span>${html(data.agents.runs.at(-1)?.status, "not run")} / ${html(data.agents.runs.at(-1)?.diffSummary, "no diff")}</span></div>
          <div class="item"><strong>Instruction assembly</strong><span>${html(data.agents.instructionAssemblies.at(-1)?.instructionSetHash, "none")}</span></div>
          <div class="item"><strong>Command results</strong><span>${html(data.agents.commandResults.map((result) => `${text(result.command)}:${text(result.status)}`), "none")}</span></div>
          <div class="item"><strong>Workspace status</strong><span>${html(data.agents.workspaces.map((workspace) => `${text(workspace.mode)}:${text(workspace.status)}`), "no local workspace")}</span></div>
          <div class="item"><strong>Blocked command example</strong><span>${html(data.agents.blockedExamples.map((example) => example.blockedReason ?? example.reason ?? example.status), "none")}</span></div>
          <div class="item"><strong>Local runner blocked example</strong><span>${html(data.agents.blockedExamples.map((example) => example.reason), "mock runner available")}</span></div>
        </div>
        <h2>Policy-as-code</h2>
        <div class="list">
          <div class="item"><strong>Policy engine</strong><span>${html(data.policy.config.engineKind)} / ${html(data.policy.config.ruleCount)} rules / audit ${data.policy.config.auditEnabled === true ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Default policy summary</strong><span>remote Git denied unless gated, remote LLM denied, runner commands denied by default, improvement apply denied.</span></div>
          <div class="item"><strong>Recent policy decisions</strong><span>${html(data.policy.auditEntries.map((entry) => `${text(entry.action)}:${text(entry.decision)}`), "none")}</span></div>
          <div class="item"><strong>Blocked operation examples</strong><span>${html(data.policy.blockedExamples.map((example) => `${text(example.action)}:${text(example.reason)}:${text(example.matchedRuleIds)}`), "none")}</span></div>
          <div class="item"><strong>Policy audit</strong><span>${html(data.policy.auditEntries.map((entry) => `${text(entry.action)}:${text(entry.decision)}`), "none")}</span></div>
        </div>
        <h2>Auth/RBAC</h2>
        <div class="list">
          <div class="item"><strong>Auth mode</strong><span>${html(data.auth.config.authMode)} / provider ${html(data.auth.config.providerKind)} / production auth ${data.auth.config.productionAuthEnabled === true ? "enabled" : "disabled"} / mock actor ${data.auth.config.mockActorEnabled === true ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Current actor</strong><span>${html((data.auth.currentActor.actor as DashboardJsonObject | undefined)?.displayName)} / roles ${html(data.auth.currentActor.roles)} / teams ${html(data.auth.currentActor.teams)}</span></div>
          <div class="item"><strong>Role catalog</strong><span>${data.auth.roles.length} roles / ${data.auth.permissions.length} permissions / ${data.auth.roleBindings.length} binding(s)</span></div>
          <div class="item"><strong>Service accounts</strong><span>${html(data.auth.serviceAccounts.map((account) => `${text(account.name)}:${text(account.status)}`), "none")}</span></div>
          <div class="item"><strong>Authorization examples</strong><span>${html(data.auth.authorizationExamples.map((example) => `${text(example.action)}:${text(example.allowed)}:${text(example.reason)}`), "none")}</span></div>
          <div class="item"><strong>Auth audit</strong><span>${html(data.auth.auditEvents.map((event) => `${text(event.eventType)}:${text(event.result)}`), "none")}</span></div>
          <div class="item"><strong>Auth warning</strong><span>${html(data.auth.warning)}</span></div>
        </div>
        <h2>Secrets and Sandbox</h2>
        <div class="list">
          <div class="item"><strong>Secret manager</strong><span>${html(data.security.config.secretManagerKind)} / production injection disabled / raw secrets unavailable</span></div>
          <div class="item"><strong>Credential manager</strong><span>${html(data.security.credentialStatus.credentialManagerKind)} / env provider ${data.security.credentialStatus.envSecretProviderEnabled === true ? "enabled" : "disabled"} / GitHub ${html(data.security.credentialStatus.github)} / LLM ${html(data.security.credentialStatus.llm)} / raw values exposed false</span></div>
          <div class="item"><strong>Secret refs</strong><span>${html(data.security.secretRefs.map((ref) => `${text(ref.id)}:${text(ref.status)}:material=false`), "none")}</span></div>
          <div class="item"><strong>Secret scopes</strong><span>${html(data.security.secretScopes.map((scope) => `${text(scope.id)}:approval=${text(scope.requiresApproval)}`), "none")}</span></div>
          <div class="item"><strong>Lease request example</strong><span>${html(data.security.blockedExamples.map((example) => example.reason ?? example.status), "no secret material issued")}</span></div>
          <div class="item"><strong>Sandbox profiles</strong><span>${html(data.security.sandboxProfiles.map((profile) => `${text(profile.id)}:${text(profile.kind)}:${text(profile.status)}`), "none")}</span></div>
          <div class="item"><strong>Sandbox session</strong><span>${html(data.security.sandboxSessions.map((session) => `${text(session.status)}:${text(session.runnerKind)}`), "no sandbox session")} / network denied / secrets denied / remote Git denied</span></div>
          <div class="item"><strong>Network egress policy</strong><span>${html(data.security.networkPolicies.map((policy) => `${text(policy.id)}:${text(policy.defaultAction)}`), "none")}</span></div>
          <div class="item"><strong>Redaction policy</strong><span>${html(data.security.redactionPolicies.map((policy) => `${text(policy.id)}:maxPreview=${text(policy.maxPreviewBytes)}`), "none")} / raw output stored false</span></div>
          <div class="item"><strong>Credential audit</strong><span>${html(data.security.credentialAuditEvents.map((event) => `${text(event.eventType)}:${text(event.result)}`), "none")}</span></div>
          <div class="item"><strong>Security audit</strong><span>${html(data.security.auditEvents.map((event) => `${text(event.eventType)}:${text(event.result)}`), "none")}</span></div>
          <div class="item"><strong>Blocked examples</strong><span>secret reads denied, network egress blocked, credential cache paths redacted.</span></div>
        </div>
        <h2>Local Agent Protocol</h2>
        <div class="list">
          <div class="item"><strong>Protocol status</strong><span>${html(data.localAgents.config.status)} / mock transport ${data.localAgents.config.mockTransportEnabled === true ? "enabled" : "disabled"} / fixture daemon ${data.localAgents.config.fixtureDaemonSupportEnabled === true ? "enabled" : "disabled"} / mock channel ${data.localAgents.config.mockChannelSupportEnabled === true ? "enabled" : "disabled"} / real transport disabled / vendor CLI execution disabled</span></div>
          <div class="item"><strong>Fixture agents</strong><span>${html(data.localAgents.config.connectedFixtureAgents, "0")} connected fixture agent(s) / ${html(data.localAgents.config.activeMockChannels, "0")} active mock channel(s)</span></div>
          <div class="item"><strong>Registered agents</strong><span>${html(data.localAgents.registrations.map((agent) => `${text(agent.displayName)}:${text(agent.status)}`), "none")}</span></div>
          <div class="item"><strong>Channels</strong><span>${html(data.localAgents.channels.map((channel) => `${text(channel.channelKind)}:${text(channel.status)}:${text(channel.handshakeStatus)}`), "none")}</span></div>
          <div class="item"><strong>Handshakes</strong><span>${html(data.localAgents.handshakes.map((handshake) => `${text(handshake.responseStatus)}:productionCrypto=false`), "none")}</span></div>
          <div class="item"><strong>Capability advertisement</strong><span>${html(data.localAgents.capabilityAdvertisements.map((advertisement) => `${text(advertisement.agentVersion)}:streaming=${text(advertisement.supportsStreaming)}:cancel=${text(advertisement.supportsCancellation)}`), "none")}</span></div>
          <div class="item"><strong>Compatibility matrix</strong><span>${html(data.localAgents.compatibilityEntries.map((entry) => `${text(entry.providerTemplateId)}:${text(entry.parserMode)}:${entry.supported === true ? "supported" : "unsupported"}`), "none")}</span></div>
          <div class="item"><strong>Compatibility result</strong><span>${html(data.localAgents.compatibilityResults.map((result) => `${text(result.providerId)}:${result.compatible === true ? "compatible" : "blocked"}:${text(result.reason)}`), "none")}</span></div>
          <div class="item"><strong>Consent queue</strong><span>${data.localAgents.consentQueue.length} pending</span></div>
          <div class="item"><strong>Consent history</strong><span>${html(data.localAgents.consentHistory, "none")}</span></div>
          <div class="item"><strong>Recent invocation</strong><span>${html(data.localAgents.invocations.at(-1)?.state, "none")} / redaction applied</span></div>
          <div class="item"><strong>Stream events</strong><span>${html(data.localAgents.streamEvents.map((event) => `${text(event.sequence)}:${text(event.source)}:${text(event.type)}:${text(event.payloadPreview)}`), "none")}</span></div>
          <div class="item"><strong>Event previews</strong><span>${html(data.localAgents.events.map((event) => `${text(event.source)}:${text(event.type)}:${text(event.payload)}`), "none")}</span></div>
          <div class="item"><strong>Protocol audit</strong><span>${html(data.localAgents.auditEvents.map((event) => event.eventType), "none")}</span></div>
          <div class="item"><strong>Timeout/cancel/disconnect examples</strong><span>timeout, cancellation, and disconnect outcomes are deterministic fixture states.</span></div>
          <div class="item"><strong>Blocked examples</strong><span>${html(data.localAgents.blockedExamples.map((example) => `${text(example.operation)}:${text(example.reason)}`), "none")}</span></div>
        </div>
        <h2>Enterprise LLM Providers</h2>
        <div class="list">
          <div class="item"><strong>Provider abstraction</strong><span>${html(data.providers.config.status)} / ${data.providers.catalog.length} catalog entries</span></div>
          <div class="item"><strong>Provider kinds</strong><span>${html(data.providers.catalog.map((provider) => provider.kind), "none")}</span></div>
          <div class="item"><strong>Auth types</strong><span>${html(data.providers.authTypes, "none")}</span></div>
          <div class="item"><strong>Local CLI readiness</strong><span>${html(data.providers.readiness.localCliProviderReadiness, "Local Agent required")} / Local Agent required</span></div>
          <div class="item"><strong>Credential cache access</strong><span>denied; credential references only</span></div>
          <div class="item"><strong>PTY fallback</strong><span>disabled by policy</span></div>
          <div class="item"><strong>Provider audit</strong><span>${data.providers.auditEvents.length} event(s)</span></div>
        </div>
        <h2>Phase 4 Preparation</h2>
        <div class="list">
          <div class="item"><strong>Failure signals</strong><span>${nestedObjects(governance, "failureSignals").length} captured / ${html(nestedObjects(governance, "failureSignals").at(0)?.category, "none")}</span></div>
          <div class="item"><strong>Failure clusters</strong><span>${nestedObjects(governance, "failureClusters").length} deterministic clusters / ${html(nestedObjects(governance, "failureClusters").at(0)?.severity, "none")}</span></div>
          <div class="item"><strong>Improvement candidates</strong><span>${nestedObjects(governance, "improvementCandidates").length} candidate(s) / ${html(nestedObjects(governance, "improvementCandidates").at(0)?.status, "none")}</span></div>
          <div class="item"><strong>Improvement proposals</strong><span>${nestedObjects(governance, "improvementProposals").length} draft proposal(s); no auto-apply path exists.</span></div>
          <div class="item"><strong>Auto-improvement analyses</strong><span>${nestedObjects(governance, "autoImprovementAnalyses").length} mock analysis</span></div>
          <div class="item"><strong>Draft registry changes</strong><span>${nestedObjects(governance, "draftRegistryChanges").length} draft change(s); not active registry entries.</span></div>
          <div class="item"><strong>Proposal readiness</strong><span>${html(proposalReadiness.at(0)?.blockingReasons, "not evaluated")}</span></div>
          <div class="item"><strong>Eval requirements</strong><span>${nestedObjects(governance, "evalRequirements").length} requirement(s); evals are not executed.</span></div>
          <div class="item"><strong>Canary plans</strong><span>${nestedObjects(governance, "canaryRolloutPlans").length} draft plan(s); rollout is not executed.</span></div>
          <div class="item"><strong>Safety policy</strong><span>auto-apply ${safetyPolicies.at(0)?.allowAutoApply === true ? "enabled" : "disabled"} / human approval ${safetyPolicies.at(0)?.requireHumanApproval === true ? "required" : "not required"}</span></div>
        </div>
        <h2>Phase 4 Governance</h2>
        <div class="list">
          <div class="item"><strong>Review queue</strong><span>${nestedObjects(governance, "proposalReviewQueue").length} item(s) / ${html(nestedObjects(governance, "proposalReviewQueue").at(0)?.recommendedAction, "none")}</span></div>
          <div class="item"><strong>Governance decisions</strong><span>${nestedObjects(governance, "governanceDecisions").length} decision(s) / ${html(nestedObjects(governance, "governanceDecisions").at(0)?.decision, "none")}</span></div>
          <div class="item"><strong>Proposal eval runs</strong><span>${nestedObjects(governance, "proposalEvalRuns").length} attached; eval execution is manual/mock-only.</span></div>
          <div class="item"><strong>Canary readiness</strong><span>${html(canaryReadiness.at(0)?.blockingReasons, "not checked")} / rollout is not executed.</span></div>
          <div class="item"><strong>Apply gate</strong><span>${html(proposalApplyGates.at(0)?.blockingReasons, "not checked")} / apply is not implemented.</span></div>
          <div class="item"><strong>Governance audit</strong><span>${nestedObjects(governance, "governanceAuditEvents").length} event(s); draft changes are not active.</span></div>
        </div>
      </aside>
    </section>
    <template data-dashboard-source="${escapeHtml(data.overview.source)}"></template>
  </main>
</body>
</html>`;
}

export async function renderDashboardHtml(provider: DashboardDataProvider = createDashboardDataProviderFromEnv()): Promise<string> {
  return renderDashboardReadModels(await provider.getReadModels());
}

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
      <section>
        <h2>Git Adapter</h2>
        <p>Provider: {data.gitProviderConfig.providerKind}</p>
        <p>Remote Git: {data.gitProviderConfig.remoteGitEnabled ? "enabled" : "disabled"}</p>
        <p>Branches: {data.gitBranches.length}</p>
        <p>Pull requests: {data.gitPullRequests.length}</p>
        <p>Changed files: {data.gitChangedFiles.map((file) => file.path).join(", ")}</p>
        <p>Git audit events: {data.gitAuditEvents.length}</p>
        <p>Remote blocked reason: {data.remoteBlockedOperation.reason ?? "none"}</p>
      </section>
      <section>
        <h2>LLM Gateway</h2>
        <p>Provider: {data.llmProviderConfig.providerKind}</p>
        <p>Remote LLM: {data.llmProviderConfig.remoteLlmEnabled ? "enabled" : "disabled"}</p>
        <p>Models: {data.llmModels.length}</p>
        <p>Virtual model keys: {data.virtualModelKeys.length}</p>
        <p>Budget result: {data.llmCompletion?.budgetDecision?.reason ?? "not evaluated"}</p>
        <p>LLM usage events: {data.llmUsageEvents.length}</p>
        <p>LLM audit events: {data.llmAuditEvents.length}</p>
        <p>Remote LLM blocked reason: {data.remoteLlmBlockedOperation.reason ?? "none"}</p>
      </section>
      <section>
        <h2>Agent Runner</h2>
        <p>Runner: {data.agentRunnerConfig.runnerKind}</p>
        <p>Local runner: {data.agentRunnerConfig.localRunnerEnabled ? "enabled" : "disabled"}</p>
        <p>Command execution: {data.agentRunnerConfig.localCommandExecutionEnabled ? "enabled" : "disabled"}</p>
        <p>Command executor: {data.agentRunnerConfig.commandExecutorKind}</p>
        <p>Agent runs: {data.agentRuns.length}</p>
        <p>Latest run: {data.agentRun?.status ?? "not run"} / {data.agentRun?.diffSummary ?? "no diff"}</p>
        <p>Instruction assemblies: {data.agentInstructionAssemblies.length}</p>
        <p>Command results: {data.agentCommandResults.length}</p>
        <p>Workspaces: {data.agentWorkspaces.length}</p>
        <p>Blocked command reason: {data.blockedCommandExample?.blockedReason ?? "none"}</p>
        <p>Local runner blocked reason: {data.localRunnerBlockedExample.reason ?? "none"}</p>
      </section>
      <section>
        <h2>Policy-as-code</h2>
        <p>Engine: {data.policyConfig.engineKind}</p>
        <p>Rules loaded: {data.policyConfig.ruleCount}</p>
        <p>Audit: {data.policyConfig.auditEnabled ? "enabled" : "disabled"}</p>
        <p>Recent decisions: {data.policyDecisions.map((decision) => `${decision.action}:${decision.decision}`).join(", ")}</p>
        <p>Blocked operations: {data.policyDecisions.filter((decision) => !decision.allowed).map((decision) => decision.action).join(", ")}</p>
        <p>Policy audit entries: {data.policyAuditEntries.length}</p>
      </section>
      <section>
        <h2>Enterprise LLM Providers</h2>
        <p>Status: {data.providerAbstractionConfig.status}</p>
        <p>Catalog entries: {data.providerCatalog.length}</p>
        <p>Provider kinds: {data.providerCatalog.map((provider) => provider.kind).join(", ")}</p>
        <p>Auth types: {data.providerAuthTypes.join(", ")}</p>
        <p>Local CLI templates: {data.providerLocalCliTemplates.length}</p>
        <p>Local agents connected: {data.providerLocalAgents.length}</p>
        <p>Local CLI readiness: {data.providerInvocation.error?.code ?? "none"}</p>
        <p>Credential cache access: denied</p>
        <p>Provider audit events: {data.providerAuditEvents.length}</p>
      </section>
      <section>
        <h2>Phase 4 Preparation</h2>
        <p>Failure signals: {data.improvementFailureSignals.length}</p>
        <p>Failure clusters: {data.improvementFailureClusters.length}</p>
        <p>Improvement candidates: {data.improvementCandidates.length}</p>
        <p>Improvement proposals: {data.improvementProposals.length}</p>
        <p>Auto-improvement analyses: {data.autoImprovementAnalyses.length}</p>
        <p>Draft registry changes: {data.draftRegistryChanges.length}</p>
        <p>Readiness blockers: {data.proposalReadiness[0]?.blockingReasons.join(", ") ?? "not evaluated"}</p>
        <p>Eval requirements: {data.evalRequirements.length}</p>
        <p>Canary plans: {data.canaryRolloutPlans.length}</p>
        <p>Auto-apply: {data.autoImprovementSafetyPolicies[0]?.allowAutoApply ? "enabled" : "disabled"}</p>
      </section>
      <section>
        <h2>Phase 4 Governance</h2>
        <p>Proposal review queue: {data.proposalReviewQueue.length}</p>
        <p>Governance decisions: {data.governanceDecisions.length}</p>
        <p>Proposal eval runs: {data.proposalEvalRuns.length}</p>
        <p>Canary readiness: {data.canaryReadiness[0]?.blockingReasons.join(", ") ?? "not checked"}</p>
        <p>Apply gate: {data.proposalApplyGates[0]?.blockingReasons.join(", ") ?? "not checked"}</p>
        <p>Governance audit events: {data.governanceAuditEvents.length}</p>
      </section>
    </main>
  );
}

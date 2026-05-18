export type PolicyActorKind =
  | "user"
  | "team"
  | "system"
  | "service"
  | "human_user"
  | "service_account"
  | "local_agent"
  | "external_integration"
  | "anonymous_mock";

export type PolicySubject = {
  actorId: string;
  principalId?: string;
  actorKind: PolicyActorKind;
  roles: string[];
  teams?: string[];
  tenantIds?: string[];
  teamIds?: string[];
  projectIds?: string[];
  resourceScopes?: PolicyResourceScope[];
  authMode?: string;
  serviceAccountId?: string;
  isMockActor?: boolean;
  requestId?: string;
  correlationId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type PolicyResourceKind =
  | "task"
  | "task_run"
  | "repo"
  | "branch"
  | "pull_request"
  | "merge_queue"
  | "merge_execution"
  | "git_operation"
  | "github_app"
  | "github_app_installation"
  | "github_app_repo_grant"
  | "llm_model"
  | "llm_provider"
  | "llm_route"
  | "llm_fallback_policy"
  | "virtual_model_key"
  | "runner"
  | "command"
  | "workspace"
  | "skill"
  | "harness"
  | "instruction"
  | "registry_item"
  | "registry_compatibility"
  | "registry_drift"
  | "registry_canary"
  | "registry_apply_workflow"
  | "registry_scope"
  | "registry_artifact_trust"
  | "registry_eval_suite"
  | "improvement_proposal"
  | "draft_registry_change"
  | "provider"
  | "provider_credential"
  | "local_agent"
  | "local_cli"
  | "secret_ref"
  | "secret_lease"
  | "sandbox_profile"
  | "sandbox_session"
  | "network_egress_policy"
  | "redaction_policy"
  | "mcp_server"
  | "mcp_tool"
  | "secret_scope"
  | "dashboard"
  | "auth"
  | "cleanup";

export type PolicyResourceScopeKind =
  | "global"
  | "tenant"
  | "team"
  | "project"
  | "repo"
  | "provider"
  | "model"
  | "secret"
  | "mcp_tool"
  | "registry_package"
  | "local_agent_host"
  | "audit_query";

export type PolicyResourceScopeParent = {
  scopeKind: PolicyResourceScopeKind;
  scopeId: string;
};

export type PolicyResourceScope = {
  scopeKind: PolicyResourceScopeKind;
  scopeId: string;
  parentScopes?: PolicyResourceScopeParent[];
  metadata: Record<string, unknown>;
};

export type PolicyResource = {
  resourceKind: PolicyResourceKind;
  resourceId?: string;
  scopeKind?: PolicyResourceScopeKind;
  scopeId?: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  resourceScopes?: PolicyResourceScope[];
  metadata: Record<string, unknown>;
};

export type PolicyAction =
  | "task.create"
  | "task.run"
  | "git.branch.create"
  | "git.pull_request.create"
  | "git.webhook.receive"
  | "git.webhook.verify"
  | "git.webhook.process"
  | "git.pull_request.sync"
  | "git.branch.sync"
  | "git.changed_files.read"
  | "git.credential.resolve"
  | "git.remote_operation"
  | "git.merge"
  | "git.rebase"
  | "git.branch.delete"
  | "merge_queue.read"
  | "merge_queue.evaluate"
  | "merge_queue.hold"
  | "merge_queue.release_hold"
  | "merge_queue.merge_execute_future"
  | "merge_execution.policy.read"
  | "merge_execution.evaluate"
  | "merge_execution.request"
  | "merge_execution.execute_future"
  | "merge_execution.override_future"
  | "merge_execution.post_evidence.record_future"
  | "pr_ownership.read"
  | "pr_ownership.create"
  | "pr_ownership.update"
  | "pr_handoff.request"
  | "pr_handoff.accept"
  | "pr_handoff.reject"
  | "pr_handoff.expire"
  | "pr_reviewer.assign_future"
  | "pr_remote_update_future"
  | "registry.compatibility.read"
  | "registry.compatibility.evaluate"
  | "registry.compatibility.matrix.update_future"
  | "registry.compatibility.override_future"
  | "registry.drift.read"
  | "registry.drift.assess"
  | "registry.drift.recommend"
  | "registry.drift.create_candidate_future"
  | "registry.drift.auto_apply_future"
  | "registry.canary.plan"
  | "registry.canary.run_mock"
  | "registry.canary.run_external_future"
  | "registry.apply_workflow.create"
  | "registry.apply_gate.evaluate"
  | "registry.apply.metadata_record"
  | "registry.apply.execute_future"
  | "registry.apply.auto_apply_future"
  | "registry.scope.read"
  | "registry.scope.evaluate"
  | "registry.scope.enforce_future"
  | "registry.audit.read"
  | "registry.approval_queue.read"
  | "registry.mutation.scope_check"
  | "registry.artifact_trust.read"
  | "registry.artifact_trust.evaluate"
  | "registry.artifact_signature.attach_mock"
  | "registry.artifact_provenance.attach"
  | "registry.artifact_signature.verify_future"
  | "registry.artifact.sign_future"
  | "registry.artifact.import_trusted_future"
  | "registry.eval_suite.read"
  | "registry.eval_suite.run_mock"
  | "registry.eval_suite.attach_result"
  | "registry.eval_suite.run_external_future"
  | "governance.eval.require"
  | "governance.eval.override_future"
  | "cleanup.scan"
  | "cleanup.recommend"
  | "cleanup.decide"
  | "cleanup.metadata_execute"
  | "cleanup.destructive_execute_future"
  | "branch.delete_future"
  | "worktree.remove_future"
  | "pr.close_future"
  | "github_app.configure"
  | "github_app.installation.use"
  | "github_app.repo_grant.use"
  | "github_app.installation_token.issue"
  | "llm.completion"
  | "llm.remote_completion"
  | "llm.model.use"
  | "llm.credential.resolve"
  | "llm.route.select"
  | "llm.fallback"
  | "runner.execute"
  | "runner.command.execute"
  | "runner.local_execution"
  | "registry.create"
  | "registry.update"
  | "registry.approve"
  | "registry.rollback"
  | "improvement.proposal.create"
  | "improvement.proposal.approve"
  | "improvement.draft_change.prepare"
  | "improvement.apply"
  | "provider.invoke"
  | "provider.credential.resolve"
  | "provider.local_cli.invoke"
  | "provider.pty.invoke"
  | "provider.cloud_api.invoke"
  | "local_agent.register"
  | "local_agent.channel.create"
  | "local_agent.handshake.verify"
  | "local_agent.capability.advertise"
  | "local_agent.compatibility.check"
  | "local_agent.invoke"
  | "local_agent.consent.request"
  | "local_agent.consent.approve"
  | "local_agent.cancel"
  | "local_agent.revoke"
  | "local_agent.event.receive"
  | "local_agent.stream.receive"
  | "local_agent.session.approve"
  | "local_agent.session.expire"
  | "local_cli.invoke"
  | "local_cli.template.read"
  | "local_cli.template.use"
  | "local_cli.execute"
  | "local_cli.file_write"
  | "local_cli.shell_execution"
  | "local_cli.network_access"
  | "local_cli.danger_full_access"
  | "local_cli.credential_cache.read"
  | "local_cli.secret.forward"
  | "credential.cache.read"
  | "credential.cache.upload"
  | "secret.metadata.read"
  | "secret.lease.request"
  | "secret.lease.issue"
  | "secret.lease.revoke"
  | "dashboard.read"
  | "auth.read"
  | "auth.authorize.check"
  | "auth.admin"
  | "sandbox.profile.use"
  | "sandbox.session.create"
  | "network.egress"
  | "runner.secret.inject"
  | "local_agent.secret.forward"
  | "audit.secret.view"
  | "mcp.server.list"
  | "mcp.tool.list"
  | "mcp.tool.invoke"
  | "mcp.tool.invoke.low_risk"
  | "mcp.tool.invoke.high_risk"
  | "mcp.tool.invoke.critical"
  | "mcp.tool.secret.resolve"
  | "mcp.tool.network_access"
  | "mcp.tool.write"
  | "mcp.tool.deploy"
  | "mcp.tool.call"
  | "secret.read";

export type PolicyContext = {
  taskId?: string;
  taskRunId?: string;
  repoId?: string;
  branchName?: string;
  modelId?: string;
  providerKind?: string;
  runnerKind?: string;
  command?: string;
  skillRefs?: unknown[];
  harnessRef?: unknown;
  instructionRefs?: unknown[];
  riskScore?: number;
  environment: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type PolicyDecisionValue = "allow" | "deny" | "require_approval" | "not_applicable";

export type PolicyDecision = {
  id: string;
  allowed: boolean;
  decision: PolicyDecisionValue;
  reason: string;
  matchedRuleIds: string[];
  subject: PolicySubject;
  resource: PolicyResource;
  action: PolicyAction;
  context: PolicyContext;
  createdAt: Date;
};

export type PolicyRuleEffect = "allow" | "deny" | "require_approval";

export type PolicyRuleConditions = {
  subjectRolesAny?: string[];
  providerKinds?: string[];
  runnerKinds?: string[];
  resourceStatuses?: string[];
  commandIncludesAny?: string[];
  commandEqualsAny?: string[];
  environmentEquals?: Record<string, string | number | boolean>;
  metadataEquals?: Record<string, string | number | boolean>;
  riskScoreAtLeast?: number;
};

export type PolicyRule = {
  id: string;
  name: string;
  description: string;
  effect: PolicyRuleEffect;
  action: PolicyAction;
  resourceKind?: PolicyResourceKind;
  conditions: PolicyRuleConditions;
  priority: number;
  enabled: boolean;
};

export type PolicyEvaluationRequest = {
  subject: PolicySubject;
  action: PolicyAction;
  resource: PolicyResource;
  context: PolicyContext;
};

export type PolicySetValidationResult = {
  ok: boolean;
  errors: string[];
};

export type PolicyEngineKind = "static";

export type PolicyEngine = {
  getEngineKind(): PolicyEngineKind;
  evaluate(request: PolicyEvaluationRequest): PolicyDecision;
  evaluateMany(requests: PolicyEvaluationRequest[]): PolicyDecision[];
  listRules(): PolicyRule[];
  getRule(id: string): PolicyRule | undefined;
  validatePolicySet(policySet: PolicyRule[]): PolicySetValidationResult;
};

export type PolicyDecisionAuditEntry = {
  id: string;
  policyDecisionId: string;
  action: PolicyAction;
  resourceKind: PolicyResourceKind;
  resourceId?: string;
  scopeKind?: PolicyResourceScopeKind;
  scopeId?: string;
  tenantIds?: string[];
  teamIds?: string[];
  projectIds?: string[];
  resourceScopes?: PolicyResourceScope[];
  actorId?: string;
  principalId?: string;
  actorKind?: PolicyActorKind;
  authMode?: string;
  serviceAccountId?: string;
  source?: string;
  requestId?: string;
  correlationId?: string;
  allowed: boolean;
  decision: PolicyDecisionValue;
  reason: string;
  matchedRuleIds: string[];
  taskId?: string;
  taskRunId?: string;
  createdAt: Date;
};

export type TaskPolicyDecision = {
  allowed: boolean;
  reason?: string;
  reviewRequired?: boolean;
};

export type TaskPolicyEngine = {
  evaluateTask(input: { taskId: string; files: string[]; budgetLimitUsd?: number }): TaskPolicyDecision;
};

const policyActions = new Set<PolicyAction>([
  "task.create",
  "task.run",
  "git.branch.create",
  "git.pull_request.create",
  "git.webhook.receive",
  "git.webhook.verify",
  "git.webhook.process",
  "git.pull_request.sync",
  "git.branch.sync",
  "git.changed_files.read",
  "git.credential.resolve",
  "git.remote_operation",
  "git.merge",
  "git.rebase",
  "git.branch.delete",
  "merge_queue.read",
  "merge_queue.evaluate",
  "merge_queue.hold",
  "merge_queue.release_hold",
  "merge_queue.merge_execute_future",
  "merge_execution.policy.read",
  "merge_execution.evaluate",
  "merge_execution.request",
  "merge_execution.execute_future",
  "merge_execution.override_future",
  "merge_execution.post_evidence.record_future",
  "pr_ownership.read",
  "pr_ownership.create",
  "pr_ownership.update",
  "pr_handoff.request",
  "pr_handoff.accept",
  "pr_handoff.reject",
  "pr_handoff.expire",
  "pr_reviewer.assign_future",
  "pr_remote_update_future",
  "registry.compatibility.read",
  "registry.compatibility.evaluate",
  "registry.compatibility.matrix.update_future",
  "registry.compatibility.override_future",
  "registry.drift.read",
  "registry.drift.assess",
  "registry.drift.recommend",
  "registry.drift.create_candidate_future",
  "registry.drift.auto_apply_future",
  "registry.canary.plan",
  "registry.canary.run_mock",
  "registry.canary.run_external_future",
  "registry.apply_workflow.create",
  "registry.apply_gate.evaluate",
  "registry.apply.metadata_record",
  "registry.apply.execute_future",
  "registry.apply.auto_apply_future",
  "registry.scope.read",
  "registry.scope.evaluate",
  "registry.scope.enforce_future",
  "registry.audit.read",
  "registry.approval_queue.read",
  "registry.mutation.scope_check",
  "registry.artifact_trust.read",
  "registry.artifact_trust.evaluate",
  "registry.artifact_signature.attach_mock",
  "registry.artifact_provenance.attach",
  "registry.artifact_signature.verify_future",
  "registry.artifact.sign_future",
  "registry.artifact.import_trusted_future",
  "registry.eval_suite.read",
  "registry.eval_suite.run_mock",
  "registry.eval_suite.attach_result",
  "registry.eval_suite.run_external_future",
  "governance.eval.require",
  "governance.eval.override_future",
  "cleanup.scan",
  "cleanup.recommend",
  "cleanup.decide",
  "cleanup.metadata_execute",
  "cleanup.destructive_execute_future",
  "branch.delete_future",
  "worktree.remove_future",
  "pr.close_future",
  "github_app.configure",
  "github_app.installation.use",
  "github_app.repo_grant.use",
  "github_app.installation_token.issue",
  "llm.completion",
  "llm.remote_completion",
  "llm.model.use",
  "llm.credential.resolve",
  "llm.route.select",
  "llm.fallback",
  "runner.execute",
  "runner.command.execute",
  "runner.local_execution",
  "registry.create",
  "registry.update",
  "registry.approve",
  "registry.rollback",
  "improvement.proposal.create",
  "improvement.proposal.approve",
  "improvement.draft_change.prepare",
  "improvement.apply",
  "provider.invoke",
  "provider.credential.resolve",
  "provider.local_cli.invoke",
  "provider.pty.invoke",
  "provider.cloud_api.invoke",
  "local_agent.register",
  "local_agent.channel.create",
  "local_agent.handshake.verify",
  "local_agent.capability.advertise",
  "local_agent.compatibility.check",
  "local_agent.invoke",
  "local_agent.consent.request",
  "local_agent.consent.approve",
  "local_agent.cancel",
  "local_agent.revoke",
  "local_agent.event.receive",
  "local_agent.stream.receive",
  "local_agent.session.approve",
  "local_agent.session.expire",
  "local_cli.invoke",
  "local_cli.template.read",
  "local_cli.template.use",
  "local_cli.execute",
  "local_cli.file_write",
  "local_cli.shell_execution",
  "local_cli.network_access",
  "local_cli.danger_full_access",
  "local_cli.credential_cache.read",
  "local_cli.secret.forward",
  "credential.cache.read",
  "credential.cache.upload",
  "secret.metadata.read",
  "secret.lease.request",
  "secret.lease.issue",
  "secret.lease.revoke",
  "dashboard.read",
  "auth.read",
  "auth.authorize.check",
  "auth.admin",
  "sandbox.profile.use",
  "sandbox.session.create",
  "network.egress",
  "runner.secret.inject",
  "local_agent.secret.forward",
  "audit.secret.view",
  "mcp.server.list",
  "mcp.tool.list",
  "mcp.tool.invoke",
  "mcp.tool.invoke.low_risk",
  "mcp.tool.invoke.high_risk",
  "mcp.tool.invoke.critical",
  "mcp.tool.secret.resolve",
  "mcp.tool.network_access",
  "mcp.tool.write",
  "mcp.tool.deploy",
  "mcp.tool.call",
  "secret.read"
]);

const policyResourceKinds = new Set<PolicyResourceKind>([
  "task",
  "task_run",
  "repo",
  "branch",
  "pull_request",
  "merge_queue",
  "merge_execution",
  "git_operation",
  "github_app",
  "github_app_installation",
  "github_app_repo_grant",
  "llm_model",
  "llm_provider",
  "llm_route",
  "llm_fallback_policy",
  "virtual_model_key",
  "runner",
  "command",
  "workspace",
  "skill",
  "harness",
  "instruction",
  "registry_item",
  "registry_compatibility",
  "registry_drift",
  "registry_canary",
  "registry_apply_workflow",
  "registry_scope",
  "registry_artifact_trust",
  "registry_eval_suite",
  "improvement_proposal",
  "draft_registry_change",
  "provider",
  "provider_credential",
  "local_agent",
  "local_cli",
  "secret_ref",
  "secret_lease",
  "sandbox_profile",
  "sandbox_session",
  "network_egress_policy",
  "redaction_policy",
  "mcp_server",
  "mcp_tool",
  "secret_scope",
  "dashboard",
  "auth",
  "cleanup"
]);

export function isPolicyAction(value: unknown): value is PolicyAction {
  return typeof value === "string" && policyActions.has(value as PolicyAction);
}

export function isPolicyResourceKind(value: unknown): value is PolicyResourceKind {
  return typeof value === "string" && policyResourceKinds.has(value as PolicyResourceKind);
}

export function createPolicySubject(input: {
  actorId?: string;
  principalId?: string;
  actorKind?: PolicyActorKind;
  roles?: string[];
  teams?: string[];
  tenantIds?: string[];
  teamIds?: string[];
  projectIds?: string[];
  resourceScopes?: PolicyResourceScope[];
  authMode?: string;
  serviceAccountId?: string;
  isMockActor?: boolean;
  requestId?: string;
  correlationId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
} = {}): PolicySubject {
  return {
    actorId: input.actorId ?? "mock-policy-actor",
    principalId: input.principalId,
    actorKind: input.actorKind ?? "system",
    roles: input.roles ?? ["system"],
    teams: input.teams,
    tenantIds: input.tenantIds,
    teamIds: input.teamIds,
    projectIds: input.projectIds,
    resourceScopes: input.resourceScopes,
    authMode: input.authMode,
    serviceAccountId: input.serviceAccountId,
    isMockActor: input.isMockActor,
    requestId: input.requestId,
    correlationId: input.correlationId,
    source: input.source,
    metadata: input.metadata
  };
}

export function createPolicyResource(input: {
  resourceKind: PolicyResourceKind;
  resourceId?: string;
  scopeKind?: PolicyResourceScopeKind;
  scopeId?: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  resourceScopes?: PolicyResourceScope[];
  metadata?: Record<string, unknown>;
}): PolicyResource {
  return {
    resourceKind: input.resourceKind,
    resourceId: input.resourceId,
    scopeKind: input.scopeKind,
    scopeId: input.scopeId,
    tenantId: input.tenantId,
    teamId: input.teamId,
    projectId: input.projectId,
    resourceScopes: input.resourceScopes,
    metadata: input.metadata ?? {}
  };
}

export function createPolicyContext(input: Partial<PolicyContext> = {}): PolicyContext {
  return {
    taskId: input.taskId,
    taskRunId: input.taskRunId,
    repoId: input.repoId,
    branchName: input.branchName,
    modelId: input.modelId,
    providerKind: input.providerKind,
    runnerKind: input.runnerKind,
    command: input.command,
    skillRefs: input.skillRefs,
    harnessRef: input.harnessRef,
    instructionRefs: input.instructionRefs,
    riskScore: input.riskScore,
    environment: input.environment ?? {},
    metadata: input.metadata ?? {}
  };
}

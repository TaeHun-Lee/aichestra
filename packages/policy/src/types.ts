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
  authMode?: string;
  serviceAccountId?: string;
  isMockActor?: boolean;
  metadata?: Record<string, unknown>;
};

export type PolicyResourceKind =
  | "task"
  | "task_run"
  | "repo"
  | "branch"
  | "pull_request"
  | "git_operation"
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
  | "auth";

export type PolicyResource = {
  resourceKind: PolicyResourceKind;
  resourceId?: string;
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
  | "local_cli.template.use"
  | "local_cli.file_write"
  | "local_cli.shell_execution"
  | "local_cli.network_access"
  | "local_cli.danger_full_access"
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
  actorId?: string;
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
  "local_cli.template.use",
  "local_cli.file_write",
  "local_cli.shell_execution",
  "local_cli.network_access",
  "local_cli.danger_full_access",
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
  "git_operation",
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
  "auth"
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
  authMode?: string;
  serviceAccountId?: string;
  isMockActor?: boolean;
  metadata?: Record<string, unknown>;
} = {}): PolicySubject {
  return {
    actorId: input.actorId ?? "mock-policy-actor",
    principalId: input.principalId,
    actorKind: input.actorKind ?? "system",
    roles: input.roles ?? ["system"],
    teams: input.teams,
    authMode: input.authMode,
    serviceAccountId: input.serviceAccountId,
    isMockActor: input.isMockActor,
    metadata: input.metadata
  };
}

export function createPolicyResource(input: {
  resourceKind: PolicyResourceKind;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): PolicyResource {
  return {
    resourceKind: input.resourceKind,
    resourceId: input.resourceId,
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

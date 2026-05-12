import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { AichestraError, NotFoundError, isTaskStatus } from "@aichestra/core";
import type { BranchLeaseStatus, MergeSimulationMode, MergeSimulationStatus, RegistryVersionRef, Task } from "@aichestra/core";
import type { TaskStatus } from "@aichestra/core";
import {
  InMemoryAichestraStore,
  createInMemoryStorageProvider,
  createPostgresStorageProviderFromEnv,
  createSeededStore
} from "@aichestra/db";
import type { StorageProvider } from "@aichestra/db";
import {
  GitIntegrationService,
  LocalGitDryRunMergeSimulator,
  MockMergeSimulator,
  createGitProviderFromEnv
} from "@aichestra/git-adapter";
import type { GitProviderRuntimeConfig } from "@aichestra/git-adapter";
import {
  budgetDecisionToDto,
  credentialReferenceResultToDto,
  createDefaultLlmGatewayService,
  localAgentDescriptorToDto,
  localCliProviderConfigToDto,
  isLlmModelStatus,
  isLlmProviderKind,
  isVirtualModelKeyStatus,
  llmAuditEventToDto,
  llmCompletionResultToDto,
  llmConfigToDto,
  llmModelToDto,
  providerAuditEventToDto,
  providerCatalogEntryToDto,
  providerInvocationResultToDto,
  providerValidationResultToDto,
  ProviderAbstractionService,
  virtualModelKeyToDto
} from "@aichestra/llm-gateway";
import type { LLMGatewayService } from "@aichestra/llm-gateway";
import {
  AgentRunnerService,
  MockAgentRunner,
  agentRunAuditEventToDto,
  agentRunToDto,
  agentRunnerConfigToDto,
  agentWorkspaceToDto,
  commandExecutionResultToDto,
  createInMemoryAgentRunnerRepositories,
  createAgentRunnerConfigFromEnv,
  createAgentRunnerFromConfig,
  instructionAssemblyToDto,
  LocalAgentWorkspaceManager
} from "@aichestra/runner";
import type { AgentRunnerRuntimeConfig } from "@aichestra/runner";
import {
  autoImprovementAnalysisToDto,
  canaryReadinessToDto,
  canaryRolloutPlanToDto,
  createImprovementServices,
  draftRegistryChangeToDto,
  evalRequirementToDto,
  failureClusterToDto,
  failureSignalToDto,
  improvementGovernanceAuditEventToDto,
  improvementCandidateToDto,
  improvementProposalToDto,
  isDraftRegistryChangeStatus,
  isFailureSeverity,
  isFailureSignalTargetKind,
  isImprovementCandidateStatus,
  isImprovementProposalStatus,
  isProposalEvalRunStatus,
  isProposalGovernanceDecision,
  proposalApplyGateToDto,
  proposalEvalRunToDto,
  proposalGovernanceDecisionToDto,
  proposalReadinessToDto,
  proposalReviewQueueItemToDto,
  safetyPolicyToDto
} from "@aichestra/improvement";
import type { ImprovementServices } from "@aichestra/improvement";
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject,
  isPolicyAction,
  isPolicyResourceKind,
  policyDecisionAuditEntryToDto,
  policyDecisionToDto,
  policyRuleToDto
} from "@aichestra/policy";
import {
  PolicyBackedRegistryMutationAuthorizer,
  createRegistryService,
  harnessToDto,
  instructionToDto,
  isApprovalStatus,
  isEvalStatus,
  isRegistryEvalResultSource,
  isRegistryEvalResultStatus,
  isRegistryEvalResultType,
  isRegistryStatus,
  registryAuditLogToDto,
  registryApprovalQueueItemToDto,
  registryEvalResultToDto,
  registryImportResultToDto,
  registryPackageManifestToDto,
  registryResolutionToDto,
  registryRevisionToDto,
  registryRollbackResultToDto,
  skillToDto
} from "@aichestra/registry";
import type { RegistryService } from "@aichestra/registry";
import {
  SecurityControlService,
  networkEgressPolicyToDto,
  redactionPolicyToDto,
  redactionResultToDto,
  sandboxDecisionToDto,
  sandboxProfileToDto,
  sandboxSessionToDto,
  secretLeaseToDto,
  secretRefToDto,
  secretScopeToDto,
  securityAuditEventToDto
} from "@aichestra/security";
import { runAgentTaskWorkflow } from "@aichestra/worker";

type RouteContext = {
  store: InMemoryAichestraStore;
  storageProvider: StorageProvider;
  gitIntegrationService: GitIntegrationService;
  gitProviderConfig: GitProviderRuntimeConfig;
  llmGatewayService: LLMGatewayService;
  agentRunnerService: AgentRunnerService;
  agentRunnerConfig: AgentRunnerRuntimeConfig;
  registryService: RegistryService;
  improvementServices: ImprovementServices;
  policyService: PolicyService;
  providerAbstractionService: ProviderAbstractionService;
  securityService: SecurityControlService;
};

type JsonValue = Record<string, unknown> | unknown[];

function sendJson(response: ServerResponse, statusCode: number, body: JsonValue): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body, null, 2));
}

function notFound(resource: string, id: string): never {
  throw new NotFoundError(resource, id);
}

function taskView(task: Task): Record<string, unknown> {
  return {
    ...task,
    state: task.status
  };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isMergeSimulationStatus(value: unknown): value is MergeSimulationStatus {
  return value === "clean" || value === "text_conflict" || value === "failed" || value === "unavailable";
}

function isRegistryTargetKind(value: unknown): value is "skill" | "harness" | "instruction" {
  return value === "skill" || value === "harness" || value === "instruction";
}

function isValidEvalResultPayload(body: Record<string, unknown>): boolean {
  return typeof body.evalName === "string" &&
    isRegistryEvalResultType(body.evalType) &&
    isRegistryEvalResultStatus(body.status) &&
    typeof body.summary === "string" &&
    isRegistryEvalResultSource(body.source);
}

function registryRefValue(value: unknown, fallbackKind: RegistryVersionRef["kind"], fallbackName: string): RegistryVersionRef {
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (isRegistryTargetKind(record.kind) && typeof record.name === "string" && typeof record.version === "string") {
      return {
        kind: record.kind,
        name: record.name,
        version: record.version,
        versionRange: typeof record.versionRange === "string" ? record.versionRange : undefined,
        id: typeof record.id === "string" ? record.id : undefined,
        checksum: typeof record.checksum === "string" ? record.checksum : undefined
      };
    }
  }
  return {
    kind: fallbackKind,
    name: fallbackName,
    version: "1.0.0"
  };
}

function registryRefsValue(value: unknown, fallbackKind: RegistryVersionRef["kind"], fallbackName: string): RegistryVersionRef[] {
  if (!Array.isArray(value)) return [registryRefValue(undefined, fallbackKind, fallbackName)];
  const refs = value.map((item) => registryRefValue(item, fallbackKind, fallbackName));
  return refs.length > 0 ? refs : [registryRefValue(undefined, fallbackKind, fallbackName)];
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function policyEvaluationRequestFromBody(body: Record<string, unknown>) {
  const action = body.action;
  const subjectRecord = recordValue(body.subject);
  const resourceRecord = recordValue(body.resource);
  const contextRecord = recordValue(body.context);
  const resourceKind = resourceRecord.resourceKind ?? body.resourceKind;
  if (!isPolicyAction(action)) {
    return { ok: false as const, error: "invalid_policy_action", message: "action must be a valid policy action." };
  }
  if (!isPolicyResourceKind(resourceKind)) {
    return { ok: false as const, error: "invalid_policy_resource_kind", message: "resource.resourceKind must be a valid policy resource kind." };
  }
  const actorKind = subjectRecord.actorKind;
  if (actorKind !== undefined && actorKind !== "user" && actorKind !== "team" && actorKind !== "system" && actorKind !== "service") {
    return { ok: false as const, error: "invalid_policy_actor_kind", message: "subject.actorKind must be user, team, system, or service." };
  }
  return {
    ok: true as const,
    request: {
      subject: createPolicySubject({
        actorId: stringValue(subjectRecord.actorId),
        actorKind: actorKind as "user" | "team" | "system" | "service" | undefined,
        roles: stringArrayValue(subjectRecord.roles),
        teams: stringArrayValue(subjectRecord.teams)
      }),
      action,
      resource: createPolicyResource({
        resourceKind,
        resourceId: stringValue(resourceRecord.resourceId),
        metadata: recordValue(resourceRecord.metadata)
      }),
      context: createPolicyContext({
        taskId: stringValue(contextRecord.taskId),
        taskRunId: stringValue(contextRecord.taskRunId),
        repoId: stringValue(contextRecord.repoId),
        branchName: stringValue(contextRecord.branchName),
        modelId: stringValue(contextRecord.modelId),
        providerKind: stringValue(contextRecord.providerKind),
        runnerKind: stringValue(contextRecord.runnerKind),
        command: stringValue(contextRecord.command),
        skillRefs: Array.isArray(contextRecord.skillRefs) ? contextRecord.skillRefs : undefined,
        harnessRef: contextRecord.harnessRef,
        instructionRefs: Array.isArray(contextRecord.instructionRefs) ? contextRecord.instructionRefs : undefined,
        riskScore: typeof contextRecord.riskScore === "number" ? contextRecord.riskScore : undefined,
        environment: recordValue(contextRecord.environment),
        metadata: recordValue(contextRecord.metadata)
      })
    }
  };
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, context: RouteContext): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean);
    const method = request.method ?? "GET";
    const store = context.store;
    const registryService = context.registryService;
    const improvementServices = context.improvementServices;

    if (method === "GET" && url.pathname === "/health") {
      const storage = await context.storageProvider.healthCheck();
      sendJson(response, storage.healthy ? 200 : 503, {
        status: storage.healthy ? "ok" : "degraded",
        service: "aichestra-api",
        storage: {
          kind: storage.kind,
          healthy: storage.healthy,
          message: storage.message,
          checkedAt: storage.checkedAt.toISOString()
        },
        git: {
          providerKind: context.gitProviderConfig.providerKind,
          remoteGitEnabled: context.gitProviderConfig.remoteGitEnabled,
          remoteBranchCreateEnabled: context.gitProviderConfig.remoteBranchCreateEnabled,
          remotePullRequestCreateEnabled: context.gitProviderConfig.remotePullRequestCreateEnabled,
          remoteMergeEnabled: false
        },
        llm: {
          providerKind: context.llmGatewayService.getConfig().providerKind,
          remoteLlmEnabled: context.llmGatewayService.getConfig().remoteLlmEnabled,
          remoteCompletionEnabled: context.llmGatewayService.getConfig().remoteCompletionEnabled,
          modelCatalogStatus: "available",
          gatewayHealth: "available"
        },
        agentRunner: {
          runnerKind: context.agentRunnerService.getConfig().runnerKind,
          localRunnerEnabled: context.agentRunnerService.getConfig().localRunnerEnabled,
          localCommandExecutionEnabled: context.agentRunnerService.getConfig().localCommandExecutionEnabled,
          workspaceRootConfigured: context.agentRunnerService.getConfig().workspaceRootConfigured,
          commandExecutorKind: context.agentRunnerService.getConfig().commandExecutorKind,
          maxRuntimeMs: context.agentRunnerService.getConfig().maxRuntimeMs,
          llmProviderKind: context.llmGatewayService.getConfig().providerKind,
          gitProviderKind: context.gitProviderConfig.providerKind
        },
        policy: {
          engineKind: context.policyService.getConfig().engineKind,
          rulesLoaded: context.policyService.getConfig().ruleCount,
          auditEnabled: context.policyService.getConfig().auditEnabled
        },
        providerAbstraction: {
          status: context.providerAbstractionService.getConfig().status,
          providerCatalogCount: context.providerAbstractionService.getConfig().providerCatalogCount,
          localAgentSupportEnabled: context.providerAbstractionService.getConfig().localAgentSupportEnabled,
          connectedLocalAgents: context.providerAbstractionService.getConfig().connectedLocalAgents,
          credentialManagerKind: context.providerAbstractionService.getConfig().credentialManagerKind,
          tokenResolverKind: context.providerAbstractionService.getConfig().tokenResolverKind
        },
        security: {
          secretManagerKind: context.securityService.getConfig().secretManagerKind,
          sandboxSupportStatus: context.securityService.getConfig().sandboxSupportStatus,
          defaultSandboxProfile: context.securityService.getConfig().defaultSandboxProfile,
          networkDefaultAction: context.securityService.getConfig().networkDefaultAction,
          redactionEnabled: context.securityService.getConfig().redactionEnabled,
          productionSecretInjection: false,
          productionSandboxRuntime: false
        }
      });
      return;
    }

    if (segments[0] === "policy") {
      const policyService = context.policyService;

      if (method === "GET" && segments[1] === "config") {
        sendJson(response, 200, { config: policyService.getConfig() });
        return;
      }

      if (method === "GET" && segments[1] === "rules" && segments.length === 2) {
        sendJson(response, 200, { rules: policyService.listRules().map(policyRuleToDto) });
        return;
      }

      if (method === "GET" && segments[1] === "rules" && segments.length === 3) {
        const rule = policyService.getRule(segments[2]);
        if (!rule) notFound("policy rule", segments[2]);
        sendJson(response, 200, { rule: policyRuleToDto(rule) });
        return;
      }

      if (method === "POST" && segments[1] === "evaluate") {
        const body = await readJson(request) as Record<string, unknown>;
        const parsed = policyEvaluationRequestFromBody(body);
        if (!parsed.ok) {
          sendJson(response, 400, { error: parsed.error, message: parsed.message });
          return;
        }
        sendJson(response, 200, { decision: policyDecisionToDto(policyService.evaluate(parsed.request)) });
        return;
      }

      if (method === "POST" && segments[1] === "evaluate-many") {
        const body = await readJson(request) as Record<string, unknown>;
        const requests = Array.isArray(body.requests) ? body.requests : undefined;
        if (!requests) {
          sendJson(response, 400, { error: "invalid_policy_requests", message: "requests must be an array." });
          return;
        }
        const parsed = requests.map((item) => policyEvaluationRequestFromBody(recordValue(item)));
        const invalid = parsed.find((item) => !item.ok);
        if (invalid && !invalid.ok) {
          sendJson(response, 400, { error: invalid.error, message: invalid.message });
          return;
        }
        const decisions = policyService.evaluateMany(parsed.filter((item): item is Extract<typeof item, { ok: true }> => item.ok).map((item) => item.request));
        sendJson(response, 200, { decisions: decisions.map(policyDecisionToDto) });
        return;
      }

      if (method === "GET" && segments[1] === "audit") {
        const action = url.searchParams.get("action") ?? undefined;
        if (action !== undefined && !isPolicyAction(action)) {
          sendJson(response, 400, { error: "invalid_policy_action", message: "action must be a valid policy action." });
          return;
        }
        sendJson(response, 200, {
          auditEntries: policyService.listAuditEntries({
            action,
            actorId: url.searchParams.get("actorId") ?? undefined,
            taskId: url.searchParams.get("taskId") ?? undefined,
            taskRunId: url.searchParams.get("taskRunId") ?? undefined
          }).map(policyDecisionAuditEntryToDto)
        });
        return;
      }
    }

    if (segments[0] === "security") {
      const securityService = context.securityService;

      if (segments[1] === "secrets") {
        if (method === "GET" && segments[2] === "refs") {
          sendJson(response, 200, { secretRefs: securityService.listSecretRefs().map(secretRefToDto) });
          return;
        }
        if (method === "GET" && segments[2] === "scopes") {
          sendJson(response, 200, { secretScopes: securityService.listSecretScopes().map(secretScopeToDto) });
          return;
        }
        if (method === "POST" && segments[2] === "leases" && segments[3] === "request") {
          const body = await readJson(request) as Record<string, unknown>;
          const secretRefId = stringValue(body.secretRefId);
          const scopeId = stringValue(body.scopeId);
          if (!secretRefId || !scopeId) {
            sendJson(response, 400, { error: "invalid_secret_lease_request", message: "secretRefId and scopeId are required." });
            return;
          }
          const lease = securityService.requestLease({
            secretRefId,
            scopeId,
            taskId: stringValue(body.taskId),
            taskRunId: stringValue(body.taskRunId),
            actorId: stringValue(body.actorId),
            ttlSeconds: typeof body.ttlSeconds === "number" ? body.ttlSeconds : undefined,
            reason: stringValue(body.reason),
            metadata: recordValue(body.metadata)
          });
          sendJson(response, lease.status === "issued" ? 201 : 409, { lease: secretLeaseToDto(lease), safeEnvironment: securityService.getSafeEnvironment(lease.id) });
          return;
        }
        if (method === "GET" && segments[2] === "leases") {
          sendJson(response, 200, {
            leases: securityService.listSecretLeases({
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined
            }).map(secretLeaseToDto)
          });
          return;
        }
        if (method === "POST" && segments[2] === "leases" && segments[4] === "revoke") {
          try {
            sendJson(response, 200, { lease: secretLeaseToDto(securityService.revokeLease(segments[3])) });
          } catch (error) {
            sendJson(response, 404, { error: "secret_lease_not_found", message: error instanceof Error ? error.message : "Secret lease not found." });
          }
          return;
        }
        if (method === "GET" && segments[2] === "audit") {
          sendJson(response, 200, {
            auditEvents: securityService.listAuditEvents({
              targetKind: "secret",
              eventType: url.searchParams.get("eventType") ?? undefined,
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined,
              actorId: url.searchParams.get("actorId") ?? undefined
            }).map(securityAuditEventToDto)
          });
          return;
        }
      }

      if (segments[1] === "sandbox") {
        if (method === "GET" && segments[2] === "profiles") {
          sendJson(response, 200, { sandboxProfiles: securityService.listSandboxProfiles().map(sandboxProfileToDto) });
          return;
        }
        if (method === "GET" && segments[2] === "sessions") {
          sendJson(response, 200, {
            sandboxSessions: securityService.listSandboxSessions({
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined
            }).map(sandboxSessionToDto)
          });
          return;
        }
        if (method === "POST" && segments[2] === "sessions") {
          const body = await readJson(request) as Record<string, unknown>;
          const profileId = stringValue(body.profileId);
          if (!profileId) {
            sendJson(response, 400, { error: "invalid_sandbox_session", message: "profileId is required." });
            return;
          }
          const result = securityService.createSandboxSession({
            profileId,
            taskId: stringValue(body.taskId),
            taskRunId: stringValue(body.taskRunId),
            actorId: stringValue(body.actorId),
            runnerKind: stringValue(body.runnerKind),
            workspaceId: stringValue(body.workspaceId),
            metadata: recordValue(body.metadata)
          });
          sendJson(response, result.session ? 201 : 409, {
            session: result.session ? sandboxSessionToDto(result.session) : undefined,
            decision: sandboxDecisionToDto(result.decision)
          });
          return;
        }
        if (method === "GET" && segments[2] === "audit") {
          sendJson(response, 200, {
            auditEvents: securityService.listAuditEvents({
              targetKind: "sandbox",
              eventType: url.searchParams.get("eventType") ?? undefined,
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined,
              actorId: url.searchParams.get("actorId") ?? undefined
            }).map(securityAuditEventToDto)
          });
          return;
        }
      }

      if (segments[1] === "network" && method === "GET" && segments[2] === "policies") {
        sendJson(response, 200, { networkPolicies: securityService.listNetworkEgressPolicies().map(networkEgressPolicyToDto) });
        return;
      }

      if (segments[1] === "redaction") {
        if (method === "GET" && segments[2] === "policies") {
          sendJson(response, 200, { redactionPolicies: securityService.listRedactionPolicies().map(redactionPolicyToDto) });
          return;
        }
        if (method === "POST" && segments[2] === "test") {
          const body = await readJson(request) as Record<string, unknown>;
          const text = typeof body.text === "string" ? body.text : "";
          const result = securityService.redactText({
            text,
            policyId: stringValue(body.policyId),
            actorId: stringValue(body.actorId),
            taskId: stringValue(body.taskId),
            taskRunId: stringValue(body.taskRunId),
            metadata: { source: "api_redaction_test" }
          });
          sendJson(response, 200, { result: redactionResultToDto(result) });
          return;
        }
      }
    }

    if (segments[0] === "providers") {
      const providerService = context.providerAbstractionService;

      if (method === "GET" && segments.length === 1) {
        sendJson(response, 200, { providers: providerService.listProviders().map(providerCatalogEntryToDto) });
        return;
      }

      if (method === "GET" && segments[1] === "catalog") {
        sendJson(response, 200, { providers: providerService.listProviders().map(providerCatalogEntryToDto) });
        return;
      }

      if (method === "POST" && segments[1] === "validate") {
        const body = await readJson(request) as Record<string, unknown>;
        const providerId = stringValue(body.providerId);
        if (!providerId) {
          sendJson(response, 400, { error: "invalid_provider_validation", message: "providerId is required." });
          return;
        }
        const validation = providerService.validateProvider(providerId);
        sendJson(response, validation.ok ? 200 : 409, { validation: providerValidationResultToDto(validation) });
        return;
      }

      if (method === "GET" && segments[1] === "auth-types") {
        sendJson(response, 200, { authTypes: providerService.listAuthTypes() });
        return;
      }

      if (method === "GET" && segments[1] === "local-cli" && segments[2] === "templates") {
        sendJson(response, 200, { templates: providerService.listLocalCliTemplates().map(localCliProviderConfigToDto) });
        return;
      }

      if (method === "GET" && segments[1] === "local-agents") {
        sendJson(response, 200, { localAgents: providerService.listLocalAgents().map(localAgentDescriptorToDto) });
        return;
      }

      if (method === "POST" && segments[1] === "invoke") {
        const body = await readJson(request) as Record<string, unknown>;
        const providerId = stringValue(body.providerId);
        const prompt = stringValue(body.prompt);
        if (!providerId || !prompt) {
          sendJson(response, 400, { error: "invalid_provider_invocation", message: "providerId and prompt are required." });
          return;
        }
        const result = await providerService.invoke({
          providerId,
          prompt,
          taskId: stringValue(body.taskId),
          taskRunId: stringValue(body.taskRunId),
          actorId: stringValue(body.actorId),
          modelId: stringValue(body.modelId),
          context: recordValue(body.context),
          instructionSetHash: stringValue(body.instructionSetHash),
          workspaceRef: stringValue(body.workspaceRef),
          metadata: recordValue(body.metadata)
        });
        sendJson(response, result.status === "completed" ? 201 : 409, { result: providerInvocationResultToDto(result) });
        return;
      }

      if (method === "GET" && segments[1] === "audit") {
        sendJson(response, 200, {
          auditEvents: providerService.listAuditEvents({
            providerId: url.searchParams.get("providerId") ?? undefined,
            eventType: url.searchParams.get("eventType") ?? undefined,
            actorId: url.searchParams.get("actorId") ?? undefined
          }).map(providerAuditEventToDto)
        });
        return;
      }

      if (method === "GET" && segments.length === 2) {
        const provider = providerService.getProvider(segments[1]);
        if (!provider) notFound("provider catalog entry", segments[1]);
        sendJson(response, 200, {
          provider: providerCatalogEntryToDto(provider),
          credentialReference: credentialReferenceResultToDto(providerService.getCredentialReference(provider.id))
        });
        return;
      }
    }

    if (segments[0] === "agents") {
      const agentService = context.agentRunnerService;

      if (method === "GET" && segments[1] === "runners") {
        sendJson(response, 200, { runners: agentService.listRunners() });
        return;
      }

      if (method === "GET" && segments[1] === "config") {
        sendJson(response, 200, { config: agentRunnerConfigToDto(agentService.getConfig()) });
        return;
      }

      if (method === "GET" && segments[1] === "executors") {
        sendJson(response, 200, { executors: agentService.listExecutors() });
        return;
      }

      if (segments[1] === "workspaces") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { workspaces: agentService.listWorkspaces().map(agentWorkspaceToDto) });
          return;
        }
        const workspaceId = segments[2];
        if (!workspaceId) {
          sendJson(response, 400, { error: "missing_workspace_id", message: "workspace id is required." });
          return;
        }
        const workspace = agentService.getWorkspace(workspaceId);
        if (!workspace) notFound("agent workspace", workspaceId);
        if (method === "GET") {
          sendJson(response, 200, { workspace: agentWorkspaceToDto(workspace) });
          return;
        }
      }

      if (segments[1] === "runs") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, {
            agentRuns: agentService.listRuns({
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined
            }).map(agentRunToDto)
          });
          return;
        }

        if (method === "POST" && segments.length === 2) {
          const body = await readJson(request) as Record<string, unknown>;
          const taskId = stringValue(body.taskId);
          const taskRunId = stringValue(body.taskRunId);
          const prompt = stringValue(body.prompt);
          const selectedModelRef = stringValue(body.selectedModelRef) ?? "mock-coder@1.0";
          if (!taskId || !taskRunId || !prompt) {
            sendJson(response, 400, { error: "invalid_agent_run", message: "taskId, taskRunId, and prompt are required." });
            return;
          }
          const run = await agentService.runAgent({
            taskId,
            taskRunId,
            actorId: stringValue(body.actorId) ?? "mock-agent-actor",
            repoRef: {
              repoId: stringValue(body.repoId) ?? "repo_demo_backend",
              localPath: stringValue(body.localPath)
            },
            branchRef: {
              repoId: stringValue(body.repoId) ?? "repo_demo_backend",
              branchName: stringValue(body.branchName) ?? "mock-agent-run"
            },
            selectedModelRef,
            selectedSkillRefs: registryRefsValue(body.selectedSkillRefs, "skill", "mock-runner-skill"),
            selectedHarnessRef: registryRefValue(body.selectedHarnessRef, "harness", "backend-node20"),
            selectedInstructionRefs: registryRefsValue(body.selectedInstructionRefs, "instruction", "org-secure-coding-baseline"),
            prompt,
            allowedCommands: Array.isArray(body.allowedCommands) ? body.allowedCommands.filter((command): command is string => typeof command === "string") : [],
            testCommands: Array.isArray(body.testCommands) ? body.testCommands.filter((command): command is string => typeof command === "string") : ["pnpm test"],
            maxRuntimeMs: typeof body.maxRuntimeMs === "number" ? body.maxRuntimeMs : context.agentRunnerConfig.maxRuntimeMs,
            metadata: {
              budgetLimitUsd: typeof body.budgetLimitUsd === "number" ? body.budgetLimitUsd : undefined,
              source: "api"
            }
          });
          sendJson(response, run.status === "blocked" ? 409 : 201, { agentRun: agentRunToDto(run) });
          return;
        }

        const runId = segments[2];
        if (!runId) {
          sendJson(response, 400, { error: "missing_agent_run_id", message: "agent run id is required." });
          return;
        }
        const run = agentService.getRun(runId);
        if (!run) notFound("agent run", runId);

        if (method === "GET" && segments.length === 3) {
          sendJson(response, 200, { agentRun: agentRunToDto(run) });
          return;
        }
        if (method === "GET" && segments[3] === "audit") {
          sendJson(response, 200, { auditEvents: agentService.listAuditEvents({ runId }).map(agentRunAuditEventToDto) });
          return;
        }
        if (method === "GET" && segments[3] === "instructions") {
          const assembly = agentService.getInstructionAssemblyForTaskRun(run.taskRunId);
          sendJson(response, 200, { instructionAssembly: assembly ? instructionAssemblyToDto(assembly) : undefined });
          return;
        }
        if (method === "GET" && segments[3] === "commands") {
          sendJson(response, 200, {
            commandResults: agentService.listCommandResults({ agentRunId: runId }).map(commandExecutionResultToDto)
          });
          return;
        }
        if (method === "GET" && segments[3] === "workspace") {
          const workspace = agentService.getWorkspaceForRun(runId);
          sendJson(response, 200, { workspace: workspace ? agentWorkspaceToDto(workspace) : undefined });
          return;
        }
        if (method === "POST" && segments[3] === "execute-command") {
          const body = await readJson(request) as Record<string, unknown>;
          const command = stringValue(body.command);
          const args = Array.isArray(body.args) ? body.args.filter((arg): arg is string => typeof arg === "string") : [];
          if (!command) {
            sendJson(response, 400, { error: "invalid_command", message: "command is required." });
            return;
          }
          const commandResult = await agentService.executeCommandForRun(runId, {
            workspacePath: stringValue(body.workspacePath),
            command,
            args,
            allowedCommands: Array.isArray(body.allowedCommands) ? body.allowedCommands.filter((item): item is string => typeof item === "string") : [],
            deniedCommands: Array.isArray(body.deniedCommands) ? body.deniedCommands.filter((item): item is string => typeof item === "string") : undefined,
            timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined
          });
          sendJson(response, commandResult.status === "blocked" ? 409 : 200, { commandResult: commandExecutionResultToDto(commandResult) });
          return;
        }
      }
    }

    if (segments[0] === "improvement") {
      if (segments[1] === "failure-signals") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { failureSignals: improvementServices.signals.listSignals().map(failureSignalToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (!isFailureSeverity(body.severity) || !isFailureSignalTargetKind(body.targetKind)) {
              sendJson(response, 400, { error: "invalid_failure_signal", message: "severity and targetKind must be valid Phase 4 preparation values." });
              return;
            }
            const signal = improvementServices.signals.createSignal(body as Parameters<ImprovementServices["signals"]["createSignal"]>[0]);
            sendJson(response, 201, { failureSignal: failureSignalToDto(signal) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_failure_signal", message: error instanceof Error ? error.message : "Invalid failure signal" });
          }
          return;
        }
      }

      if (segments[1] === "failure-clusters") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { failureClusters: improvementServices.clustering.listClusters().map(failureClusterToDto) });
          return;
        }
        if (method === "POST" && segments[2] === "recompute") {
          sendJson(response, 200, { failureClusters: improvementServices.clustering.recomputeClusters().map(failureClusterToDto) });
          return;
        }
      }

      if (segments[1] === "clusters") {
        const clusterId = segments[2];
        if (method === "POST" && segments[3] === "analyze") {
          if (!clusterId) {
            sendJson(response, 400, { error: "missing_cluster_id", message: "cluster id is required." });
            return;
          }
          try {
            const analysis = improvementServices.autoImprovement.analyzeFailureCluster(clusterId);
            sendJson(response, 201, { analysis: autoImprovementAnalysisToDto(analysis) });
          } catch (error) {
            sendJson(response, 404, { error: "cluster_analysis_failed", message: error instanceof Error ? error.message : "Cluster analysis failed" });
          }
          return;
        }
        if (method === "POST" && segments[3] === "generate-candidate") {
          if (!clusterId) {
            sendJson(response, 400, { error: "missing_cluster_id", message: "cluster id is required." });
            return;
          }
          try {
            const candidate = improvementServices.autoImprovement.generateImprovementCandidate(clusterId);
            sendJson(response, 201, { candidate: improvementCandidateToDto(candidate) });
          } catch (error) {
            sendJson(response, 404, { error: "candidate_generation_failed", message: error instanceof Error ? error.message : "Candidate generation failed" });
          }
          return;
        }
      }

      if (segments[1] === "analyses") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { analyses: improvementServices.autoImprovement.listAnalyses().map(autoImprovementAnalysisToDto) });
          return;
        }
        if (method === "GET" && segments.length === 3) {
          const analysis = improvementServices.autoImprovement.getAnalysis(segments[2]);
          if (!analysis) {
            sendJson(response, 404, { error: "analysis_not_found", message: `Auto-improvement analysis not found: ${segments[2]}` });
            return;
          }
          sendJson(response, 200, { analysis: autoImprovementAnalysisToDto(analysis) });
          return;
        }
      }

      if (segments[1] === "candidates") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { candidates: improvementServices.candidates.listCandidates().map(improvementCandidateToDto) });
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "generate-proposal") {
          if (!segments[2]) {
            sendJson(response, 400, { error: "missing_candidate_id", message: "candidate id is required." });
            return;
          }
          try {
            const proposal = improvementServices.autoImprovement.generateImprovementProposal(segments[2]);
            sendJson(response, 201, { proposal: improvementProposalToDto(proposal) });
          } catch (error) {
            sendJson(response, 404, { error: "proposal_generation_failed", message: error instanceof Error ? error.message : "Proposal generation failed" });
          }
          return;
        }
        if (method === "POST" && segments[2] === "triage") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (typeof body.id === "string" || typeof body.candidateId === "string") {
              const status = body.status;
              if (!isImprovementCandidateStatus(status)) {
                sendJson(response, 400, { error: "invalid_candidate_status", message: "status must be new, triaged, proposal_requested, proposal_created, or dismissed." });
                return;
              }
              const candidate = improvementServices.candidates.triageCandidate({ id: String(body.id ?? body.candidateId), status });
              sendJson(response, 200, { candidate: improvementCandidateToDto(candidate) });
              return;
            }
            const candidate = improvementServices.candidates.createCandidateFromCluster(body as Parameters<ImprovementServices["candidates"]["createCandidateFromCluster"]>[0]);
            const triaged = improvementServices.candidates.triageCandidate({ id: candidate.id, status: "triaged" });
            sendJson(response, 201, { candidate: improvementCandidateToDto(triaged) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_candidate_triage", message: error instanceof Error ? error.message : "Invalid candidate triage" });
          }
          return;
        }
      }

      if (segments[1] === "proposal-review-queue") {
        if (method === "GET" && segments.length === 2) {
          const status = url.searchParams.get("status") ?? undefined;
          const targetKind = url.searchParams.get("targetKind") ?? undefined;
          const recommendedAction = url.searchParams.get("recommendedAction") ?? undefined;
          const includeArchived = url.searchParams.get("includeArchived") === "true";
          if (status !== undefined && !isImprovementProposalStatus(status)) {
            sendJson(response, 400, { error: "invalid_proposal_status", message: "status is invalid." });
            return;
          }
          if (targetKind !== undefined && !["skill", "harness", "instruction"].includes(targetKind)) {
            sendJson(response, 400, { error: "invalid_target_kind", message: "targetKind must be skill, harness, or instruction." });
            return;
          }
          const queue = improvementServices.governance.listReviewQueue({
            status,
            targetKind: targetKind as "skill" | "harness" | "instruction" | undefined,
            recommendedAction: recommendedAction as "review_proposal" | "attach_eval_result" | "prepare_canary_plan" | "ready_for_canary_review" | "no_action" | undefined,
            includeArchived
          });
          sendJson(response, 200, { proposalReviewQueue: queue.map(proposalReviewQueueItemToDto) });
          return;
        }
      }

      if (segments[1] === "proposals") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { proposals: improvementServices.proposals.listProposals().map(improvementProposalToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const proposal = improvementServices.proposals.createDraftProposal(await readJson(request) as Parameters<ImprovementServices["proposals"]["createDraftProposal"]>[0]);
            sendJson(response, 201, { proposal: improvementProposalToDto(proposal) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_improvement_proposal", message: error instanceof Error ? error.message : "Invalid improvement proposal" });
          }
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "prepare-draft-change") {
          if (!segments[2]) {
            sendJson(response, 400, { error: "missing_proposal_id", message: "proposal id is required." });
            return;
          }
          try {
            const draftChange = improvementServices.autoImprovement.prepareDraftRegistryChange(segments[2]);
            sendJson(response, 201, { draftRegistryChange: draftRegistryChangeToDto(draftChange) });
          } catch (error) {
            sendJson(response, 404, { error: "draft_change_preparation_failed", message: error instanceof Error ? error.message : "Draft registry change preparation failed" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "decisions") {
          try {
            const decisions = improvementServices.governance.listDecisions(segments[2]);
            sendJson(response, 200, { decisions: decisions.map(proposalGovernanceDecisionToDto) });
          } catch (error) {
            sendJson(response, 404, { error: "proposal_decisions_failed", message: error instanceof Error ? error.message : "Proposal decisions failed" });
          }
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "decisions") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (!isProposalGovernanceDecision(body.decision)) {
              sendJson(response, 400, { error: "invalid_governance_decision", message: "decision is invalid." });
              return;
            }
            const decision = improvementServices.governance.recordDecision({
              proposalId: segments[2],
              actorId: typeof body.actorId === "string" ? body.actorId : "mock-admin",
              decision: body.decision,
              reason: typeof body.reason === "string" ? body.reason : ""
            });
            sendJson(response, 201, { decision: proposalGovernanceDecisionToDto(decision) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_governance_decision", message: error instanceof Error ? error.message : "Invalid governance decision" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "eval-runs") {
          try {
            const runs = improvementServices.proposalEvalRuns.listEvalRuns(segments[2]);
            sendJson(response, 200, { evalRuns: runs.map(proposalEvalRunToDto) });
          } catch (error) {
            sendJson(response, 404, { error: "proposal_eval_runs_failed", message: error instanceof Error ? error.message : "Proposal eval runs failed" });
          }
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "eval-runs") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (!isProposalEvalRunStatus(body.status)) {
              sendJson(response, 400, { error: "invalid_eval_run_status", message: "status must be pending, passed, failed, or skipped." });
              return;
            }
            const run = improvementServices.proposalEvalRuns.attachEvalRun({
              ...body,
              proposalId: segments[2],
              status: body.status
            } as Parameters<ImprovementServices["proposalEvalRuns"]["attachEvalRun"]>[0]);
            sendJson(response, 201, { evalRun: proposalEvalRunToDto(run) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_eval_run", message: error instanceof Error ? error.message : "Invalid proposal eval run" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "canary-readiness") {
          try {
            const readiness = improvementServices.canaryReadiness.evaluate(segments[2]);
            sendJson(response, 200, { canaryReadiness: canaryReadinessToDto(readiness) });
          } catch (error) {
            sendJson(response, 404, { error: "canary_readiness_failed", message: error instanceof Error ? error.message : "Canary readiness failed" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "apply-gate") {
          try {
            const gate = improvementServices.applyGate.evaluate(segments[2]);
            sendJson(response, 200, { applyGate: proposalApplyGateToDto(gate) });
          } catch (error) {
            sendJson(response, 404, { error: "apply_gate_failed", message: error instanceof Error ? error.message : "Apply gate failed" });
          }
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "apply") {
          try {
            const gate = improvementServices.applyGate.blockApplyAttempt(segments[2]);
            sendJson(response, 403, {
              error: "apply_not_implemented",
              message: "Applying draft registry changes is not implemented in Phase 4 Governance v1.",
              applyGate: proposalApplyGateToDto(gate)
            });
          } catch (error) {
            sendJson(response, 404, { error: "apply_gate_failed", message: error instanceof Error ? error.message : "Apply gate failed" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "readiness") {
          if (!segments[2]) {
            sendJson(response, 400, { error: "missing_proposal_id", message: "proposal id is required." });
            return;
          }
          try {
            const readiness = improvementServices.autoImprovement.evaluateProposalReadiness(segments[2]);
            sendJson(response, 200, { readiness: proposalReadinessToDto(readiness) });
          } catch (error) {
            sendJson(response, 404, { error: "proposal_readiness_failed", message: error instanceof Error ? error.message : "Proposal readiness failed" });
          }
          return;
        }
        if (method === "PATCH" && segments.length === 4 && segments[3] === "status") {
          const body = await readJson(request) as Record<string, unknown>;
          if (!isImprovementProposalStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_proposal_status", message: "status is invalid." });
            return;
          }
          try {
            const proposal = improvementServices.proposals.transitionProposalStatus({ id: segments[2], status: body.status });
            sendJson(response, 200, { proposal: improvementProposalToDto(proposal) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_proposal_transition", message: error instanceof Error ? error.message : "Invalid proposal status transition" });
          }
          return;
        }
      }

      if (segments[1] === "governance-audit") {
        if (method === "GET" && segments.length === 2) {
          const proposalId = url.searchParams.get("proposalId") ?? undefined;
          sendJson(response, 200, { events: improvementServices.governance.listAuditEvents(proposalId).map(improvementGovernanceAuditEventToDto) });
          return;
        }
      }

      if (segments[1] === "draft-registry-changes") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { draftRegistryChanges: improvementServices.draftRegistryChanges.listDraftChanges().map(draftRegistryChangeToDto) });
          return;
        }
        if (method === "GET" && segments.length === 3) {
          const draftChange = improvementServices.draftRegistryChanges.getDraftChange(segments[2]);
          if (!draftChange) {
            sendJson(response, 404, { error: "draft_registry_change_not_found", message: `Draft registry change not found: ${segments[2]}` });
            return;
          }
          sendJson(response, 200, { draftRegistryChange: draftRegistryChangeToDto(draftChange) });
          return;
        }
        if (method === "PATCH" && segments.length === 4 && segments[3] === "status") {
          const body = await readJson(request) as Record<string, unknown>;
          if (!isDraftRegistryChangeStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_draft_registry_change_status", message: "status must be draft, awaiting_review, rejected, or superseded." });
            return;
          }
          try {
            const draftChange = improvementServices.draftRegistryChanges.transitionDraftChange({ id: segments[2], status: body.status });
            sendJson(response, 200, { draftRegistryChange: draftRegistryChangeToDto(draftChange) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_draft_registry_change_transition", message: error instanceof Error ? error.message : "Invalid draft registry change transition" });
          }
          return;
        }
      }

      if (segments[1] === "eval-requirements") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { evalRequirements: improvementServices.evalRequirements.listRequirements().map(evalRequirementToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const requirement = improvementServices.evalRequirements.createRequirement(await readJson(request) as Parameters<ImprovementServices["evalRequirements"]["createRequirement"]>[0]);
            sendJson(response, 201, { evalRequirement: evalRequirementToDto(requirement) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_eval_requirement", message: error instanceof Error ? error.message : "Invalid eval requirement" });
          }
          return;
        }
      }

      if (segments[1] === "canary-plans") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { canaryPlans: improvementServices.canaryPlans.listPlans().map(canaryRolloutPlanToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const plan = improvementServices.canaryPlans.createPlan(await readJson(request) as Parameters<ImprovementServices["canaryPlans"]["createPlan"]>[0]);
            sendJson(response, 201, { canaryPlan: canaryRolloutPlanToDto(plan) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_canary_plan", message: error instanceof Error ? error.message : "Invalid canary plan" });
          }
          return;
        }
      }

      if (segments[1] === "safety-policies") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { safetyPolicies: improvementServices.safetyPolicies.listPolicies().map(safetyPolicyToDto) });
          return;
        }
        if (method === "PATCH" && segments.length === 3) {
          try {
            const policy = improvementServices.safetyPolicies.updatePolicy(segments[2], await readJson(request) as Parameters<ImprovementServices["safetyPolicies"]["updatePolicy"]>[1]);
            sendJson(response, 200, { safetyPolicy: safetyPolicyToDto(policy) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_safety_policy_update", message: error instanceof Error ? error.message : "Invalid safety policy update" });
          }
          return;
        }
      }
    }

    if (segments[0] === "registry") {
      if (segments[1] === "audit" && method === "GET") {
        const targetKindParam = url.searchParams.get("targetKind") ?? undefined;
        const targetId = url.searchParams.get("targetId") ?? undefined;
        if (targetKindParam !== undefined && !isRegistryTargetKind(targetKindParam)) {
          sendJson(response, 400, { error: "invalid_target_kind", message: "targetKind must be skill, harness, or instruction." });
          return;
        }
        const targetKind = targetKindParam;
        sendJson(response, 200, {
          auditLogs: registryService.listAuditLogs({ targetKind, targetId }).map(registryAuditLogToDto)
        });
        return;
      }

      if (segments[1] === "approval-queue" && method === "GET") {
        const targetKindParam = url.searchParams.get("targetKind") ?? undefined;
        const approvalStatusParam = url.searchParams.get("approvalStatus") ?? undefined;
        if (targetKindParam !== undefined && !isRegistryTargetKind(targetKindParam)) {
          sendJson(response, 400, { error: "invalid_target_kind", message: "targetKind must be skill, harness, or instruction." });
          return;
        }
        if (approvalStatusParam !== undefined && !isApprovalStatus(approvalStatusParam)) {
          sendJson(response, 400, { error: "invalid_approval_status", message: "approvalStatus must be not_required, pending, approved, or rejected." });
          return;
        }
        sendJson(response, 200, {
          approvalQueue: registryService.listApprovalQueue({
            targetKind: targetKindParam,
            approvalStatus: approvalStatusParam,
            owner: url.searchParams.get("owner") ?? undefined,
            includeArchived: url.searchParams.get("includeArchived") === "true"
          }).map(registryApprovalQueueItemToDto)
        });
        return;
      }

      if (segments[1] === "packages") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { packages: registryService.listPackageManifests().map(registryPackageManifestToDto) });
          return;
        }
        if (method === "GET" && segments.length === 3) {
          const manifest = registryService.getPackageManifest(segments[2]) ?? notFound("registry package", segments[2]);
          sendJson(response, 200, { package: registryPackageManifestToDto(manifest) });
          return;
        }
        if (method === "POST" && segments[2] === "export") {
          try {
            const body = await readJson(request) as Parameters<RegistryService["exportPackageManifest"]>[0];
            const manifest = registryService.exportPackageManifest(body);
            sendJson(response, 201, { package: registryPackageManifestToDto(manifest) });
          } catch (error) {
            sendJson(response, 400, { error: "package_export_failed", message: error instanceof Error ? error.message : "Package export failed" });
          }
          return;
        }
        if (method === "POST" && segments[2] === "import") {
          const body = await readJson(request) as Parameters<RegistryService["importPackageManifest"]>[0];
          const result = registryService.importPackageManifest({
            ...body,
            dryRun: segments[3] === "dry-run" ? true : body.dryRun
          });
          sendJson(response, result.errors.length > 0 ? 400 : result.dryRun ? 200 : 201, { importResult: registryImportResultToDto(result) });
          return;
        }
        if (method === "POST" && segments[2] === "diff") {
          const body = await readJson(request) as { fromPackageId?: string; toPackageId?: string };
          const from = body.fromPackageId ? registryService.getPackageManifest(body.fromPackageId) : undefined;
          const to = body.toPackageId ? registryService.getPackageManifest(body.toPackageId) : undefined;
          if (!from || !to) {
            sendJson(response, 400, { error: "invalid_package_diff", message: "fromPackageId and toPackageId must reference existing package manifests." });
            return;
          }
          sendJson(response, 200, { diff: registryService.diffPackageManifests(from, to) });
          return;
        }
      }

      if (method === "POST" && (url.pathname === "/registry/import" || url.pathname === "/registry/packages/import" || url.pathname === "/registry/packages/import/dry-run")) {
        const body = await readJson(request) as Parameters<RegistryService["importPackageManifest"]>[0];
        const result = registryService.importPackageManifest({
          ...body,
          dryRun: url.pathname.endsWith("/dry-run") ? true : body.dryRun
        });
        sendJson(response, result.errors.length > 0 ? 400 : result.dryRun ? 200 : 201, { importResult: registryImportResultToDto(result) });
        return;
      }

      if (method === "GET" && url.pathname === "/registry/bundle/manifest") {
        const manifest = registryService.exportPackageManifest({ packageKind: "bundle", name: "registry-bundle", version: "1.0.0" });
        sendJson(response, 200, { package: registryPackageManifestToDto(manifest) });
        return;
      }

      if (segments[1] === "skills") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { skills: registryService.listSkills().map(skillToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            sendJson(response, 201, { skill: skillToDto(registryService.createSkill(await readJson(request) as Parameters<RegistryService["createSkill"]>[0])) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_skill", message: error instanceof Error ? error.message : "Invalid skill" });
          }
          return;
        }
        const skillId = segments[2];
        if (!skillId) notFound("skill", "");
        if (method === "GET" && segments.length === 3) {
          const skill = registryService.getSkill(skillId) ?? notFound("skill", skillId);
          sendJson(response, 200, { skill: skillToDto(skill) });
          return;
        }
        if (method === "GET" && segments[3] === "manifest") {
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          const manifest = registryService.exportPackageManifest({ packageKind: "skill", targetId: skillId });
          sendJson(response, 200, { package: registryPackageManifestToDto(manifest) });
          return;
        }
        if (method === "GET" && segments[3] === "history") {
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          sendJson(response, 200, { revisions: registryService.listRevisionsForTarget("skill", skillId).map(registryRevisionToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "rollback") {
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          const body = await readJson(request) as { targetRevisionId?: string; revisionNumber?: number; reason?: string };
          if (!body.reason) {
            sendJson(response, 400, { error: "invalid_rollback", message: "reason is required." });
            return;
          }
          try {
            const result = registryService.rollback({ targetKind: "skill", targetId: skillId, targetRevisionId: body.targetRevisionId, revisionNumber: body.revisionNumber, reason: body.reason });
            sendJson(response, 200, { rollback: registryRollbackResultToDto(result), skill: skillToDto(registryService.getSkill(skillId) ?? notFound("skill", skillId)) });
          } catch (error) {
            sendJson(response, 400, { error: "rollback_failed", message: error instanceof Error ? error.message : "Rollback failed" });
          }
          return;
        }
        if (method === "GET" && segments[3] === "eval-results") {
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          sendJson(response, 200, { evalResults: registryService.listEvalResultsForTarget("skill", skillId).map(registryEvalResultToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "eval-results") {
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          const body = await readJson(request) as Record<string, unknown>;
          if (!isValidEvalResultPayload(body)) {
            sendJson(response, 400, { error: "invalid_eval_result", message: "evalName, evalType, status, summary, and source are required." });
            return;
          }
          const result = registryService.attachEvalResult("skill", skillId, body as Parameters<RegistryService["attachEvalResult"]>[2]);
          sendJson(response, 201, { evalResult: registryEvalResultToDto(result), skill: skillToDto(registryService.getSkill(skillId) ?? notFound("skill", skillId)) });
          return;
        }
        if (method === "PATCH" && segments[3] === "status") {
          const body = await readJson(request) as { status?: unknown };
          if (!isRegistryStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_status", message: "Status must be draft, active, deprecated, or archived." });
            return;
          }
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          sendJson(response, 200, { skill: skillToDto(registryService.updateSkillStatus(skillId, { status: body.status })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "approval") {
          const body = await readJson(request) as { approvalStatus?: unknown; reason?: string };
          if (!isApprovalStatus(body.approvalStatus)) {
            sendJson(response, 400, { error: "invalid_approval_status", message: "approvalStatus must be not_required, pending, approved, or rejected." });
            return;
          }
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          sendJson(response, 200, { skill: skillToDto(registryService.updateSkillApproval(skillId, { approvalStatus: body.approvalStatus, reason: body.reason })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "eval") {
          const body = await readJson(request) as { evalStatus?: unknown; reason?: string };
          if (!isEvalStatus(body.evalStatus)) {
            sendJson(response, 400, { error: "invalid_eval_status", message: "evalStatus must be not_required, pending, passed, or failed." });
            return;
          }
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          sendJson(response, 200, { skill: skillToDto(registryService.updateSkillEval(skillId, { evalStatus: body.evalStatus, reason: body.reason })) });
          return;
        }
      }

      if (segments[1] === "harnesses") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { harnesses: registryService.listHarnesses().map(harnessToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            sendJson(response, 201, { harness: harnessToDto(registryService.createHarness(await readJson(request) as Parameters<RegistryService["createHarness"]>[0])) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_harness", message: error instanceof Error ? error.message : "Invalid harness" });
          }
          return;
        }
        const harnessId = segments[2];
        if (!harnessId) notFound("harness", "");
        if (method === "GET" && segments.length === 3) {
          const harness = registryService.getHarness(harnessId) ?? notFound("harness", harnessId);
          sendJson(response, 200, { harness: harnessToDto(harness) });
          return;
        }
        if (method === "GET" && segments[3] === "manifest") {
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          const manifest = registryService.exportPackageManifest({ packageKind: "harness", targetId: harnessId });
          sendJson(response, 200, { package: registryPackageManifestToDto(manifest) });
          return;
        }
        if (method === "GET" && segments[3] === "history") {
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          sendJson(response, 200, { revisions: registryService.listRevisionsForTarget("harness", harnessId).map(registryRevisionToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "rollback") {
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          const body = await readJson(request) as { targetRevisionId?: string; revisionNumber?: number; reason?: string };
          if (!body.reason) {
            sendJson(response, 400, { error: "invalid_rollback", message: "reason is required." });
            return;
          }
          try {
            const result = registryService.rollback({ targetKind: "harness", targetId: harnessId, targetRevisionId: body.targetRevisionId, revisionNumber: body.revisionNumber, reason: body.reason });
            sendJson(response, 200, { rollback: registryRollbackResultToDto(result), harness: harnessToDto(registryService.getHarness(harnessId) ?? notFound("harness", harnessId)) });
          } catch (error) {
            sendJson(response, 400, { error: "rollback_failed", message: error instanceof Error ? error.message : "Rollback failed" });
          }
          return;
        }
        if (method === "GET" && segments[3] === "eval-results") {
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          sendJson(response, 200, { evalResults: registryService.listEvalResultsForTarget("harness", harnessId).map(registryEvalResultToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "eval-results") {
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          const body = await readJson(request) as Record<string, unknown>;
          if (!isValidEvalResultPayload(body)) {
            sendJson(response, 400, { error: "invalid_eval_result", message: "evalName, evalType, status, summary, and source are required." });
            return;
          }
          const result = registryService.attachEvalResult("harness", harnessId, body as Parameters<RegistryService["attachEvalResult"]>[2]);
          sendJson(response, 201, { evalResult: registryEvalResultToDto(result), harness: harnessToDto(registryService.getHarness(harnessId) ?? notFound("harness", harnessId)) });
          return;
        }
        if (method === "PATCH" && segments[3] === "status") {
          const body = await readJson(request) as { status?: unknown };
          if (!isRegistryStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_status", message: "Status must be draft, active, deprecated, or archived." });
            return;
          }
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          sendJson(response, 200, { harness: harnessToDto(registryService.updateHarnessStatus(harnessId, { status: body.status })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "approval") {
          const body = await readJson(request) as { approvalStatus?: unknown; reason?: string };
          if (!isApprovalStatus(body.approvalStatus)) {
            sendJson(response, 400, { error: "invalid_approval_status", message: "approvalStatus must be not_required, pending, approved, or rejected." });
            return;
          }
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          sendJson(response, 200, { harness: harnessToDto(registryService.updateHarnessApproval(harnessId, { approvalStatus: body.approvalStatus, reason: body.reason })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "eval") {
          const body = await readJson(request) as { evalStatus?: unknown; reason?: string };
          if (!isEvalStatus(body.evalStatus)) {
            sendJson(response, 400, { error: "invalid_eval_status", message: "evalStatus must be not_required, pending, passed, or failed." });
            return;
          }
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          sendJson(response, 200, { harness: harnessToDto(registryService.updateHarnessEval(harnessId, { evalStatus: body.evalStatus, reason: body.reason })) });
          return;
        }
      }

      if (segments[1] === "instructions") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { instructions: registryService.listInstructions().map(instructionToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            sendJson(response, 201, { instruction: instructionToDto(registryService.createInstruction(await readJson(request) as Parameters<RegistryService["createInstruction"]>[0])) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_instruction", message: error instanceof Error ? error.message : "Invalid instruction" });
          }
          return;
        }
        const instructionId = segments[2];
        if (!instructionId) notFound("instruction", "");
        if (method === "GET" && segments.length === 3) {
          const instruction = registryService.getInstruction(instructionId) ?? notFound("instruction", instructionId);
          sendJson(response, 200, { instruction: instructionToDto(instruction) });
          return;
        }
        if (method === "GET" && segments[3] === "manifest") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          const manifest = registryService.exportPackageManifest({ packageKind: "instruction", targetId: instructionId });
          sendJson(response, 200, { package: registryPackageManifestToDto(manifest) });
          return;
        }
        if (method === "GET" && segments[3] === "history") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { revisions: registryService.listRevisionsForTarget("instruction", instructionId).map(registryRevisionToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "rollback") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          const body = await readJson(request) as { targetRevisionId?: string; revisionNumber?: number; reason?: string };
          if (!body.reason) {
            sendJson(response, 400, { error: "invalid_rollback", message: "reason is required." });
            return;
          }
          try {
            const result = registryService.rollback({ targetKind: "instruction", targetId: instructionId, targetRevisionId: body.targetRevisionId, revisionNumber: body.revisionNumber, reason: body.reason });
            sendJson(response, 200, { rollback: registryRollbackResultToDto(result), instruction: instructionToDto(registryService.getInstruction(instructionId) ?? notFound("instruction", instructionId)) });
          } catch (error) {
            sendJson(response, 400, { error: "rollback_failed", message: error instanceof Error ? error.message : "Rollback failed" });
          }
          return;
        }
        if (method === "GET" && segments[3] === "eval-results") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { evalResults: registryService.listEvalResultsForTarget("instruction", instructionId).map(registryEvalResultToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "eval-results") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          const body = await readJson(request) as Record<string, unknown>;
          if (!isValidEvalResultPayload(body)) {
            sendJson(response, 400, { error: "invalid_eval_result", message: "evalName, evalType, status, summary, and source are required." });
            return;
          }
          const result = registryService.attachEvalResult("instruction", instructionId, body as Parameters<RegistryService["attachEvalResult"]>[2]);
          sendJson(response, 201, { evalResult: registryEvalResultToDto(result), instruction: instructionToDto(registryService.getInstruction(instructionId) ?? notFound("instruction", instructionId)) });
          return;
        }
        if (method === "PATCH" && segments[3] === "status") {
          const body = await readJson(request) as { status?: unknown };
          if (!isRegistryStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_status", message: "Status must be draft, active, deprecated, or archived." });
            return;
          }
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { instruction: instructionToDto(registryService.updateInstructionStatus(instructionId, { status: body.status })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "approval") {
          const body = await readJson(request) as { approvalStatus?: unknown; reason?: string };
          if (!isApprovalStatus(body.approvalStatus)) {
            sendJson(response, 400, { error: "invalid_approval_status", message: "approvalStatus must be not_required, pending, approved, or rejected." });
            return;
          }
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { instruction: instructionToDto(registryService.updateInstructionApproval(instructionId, { approvalStatus: body.approvalStatus, reason: body.reason })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "eval") {
          const body = await readJson(request) as { evalStatus?: unknown; reason?: string };
          if (!isEvalStatus(body.evalStatus)) {
            sendJson(response, 400, { error: "invalid_eval_status", message: "evalStatus must be not_required, pending, passed, or failed." });
            return;
          }
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { instruction: instructionToDto(registryService.updateInstructionEval(instructionId, { evalStatus: body.evalStatus, reason: body.reason })) });
          return;
        }
        if (method === "POST" && segments[3] === "verify-checksum") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { instruction: instructionToDto(registryService.verifyInstructionChecksum(instructionId, { repoRoot: process.cwd() })) });
          return;
        }
      }

      if (segments[1] === "resolve" && method === "POST") {
        const body = await readJson(request) as { taskId?: unknown; agent?: unknown };
        const taskId = stringValue(body.taskId);
        if (!taskId) {
          sendJson(response, 400, { error: "invalid_registry_resolution_request", message: "taskId is required." });
          return;
        }
        const task = store.getTask(taskId) ?? notFound("task", taskId);
        const resolution = registryService.resolveRegistryContextForTask({
          task,
          agent: (stringValue(body.agent) ?? task.selectedAgent ?? "codex") as NonNullable<Task["selectedAgent"]>,
          repo: store.getRepo(task.repoId)
        });
        sendJson(response, 200, { resolution: registryResolutionToDto(resolution) });
        return;
      }
    }

    if (segments[0] === "tasks") {
      if (method === "POST" && segments.length === 1) {
        sendJson(response, 201, taskView(store.createTask(await readJson(request))));
        return;
      }
      if (method === "GET" && segments.length === 1) {
        sendJson(response, 200, { tasks: store.listTasks().map(taskView) });
        return;
      }
      const taskId = segments[1];
      if (!taskId) notFound("task", "");
      const task = store.getTask(taskId) ?? notFound("task", taskId);

      if (method === "GET" && segments.length === 2) {
        sendJson(response, 200, {
          task: taskView(task),
          taskRuns: store.listTaskRuns(task.id),
          pullRequests: store.listPullRequests(task.id),
          usageEvents: store.listUsageEvents().filter((event) => event.taskId === task.id)
        });
        return;
      }
      if (method === "POST" && segments[2] === "run") {
        const result = await runAgentTaskWorkflow(task.id, { store });
        const updatedTask = store.getTask(task.id) ?? task;
        sendJson(response, 200, {
          task: taskView(updatedTask),
          result,
          taskRuns: store.listTaskRuns(task.id),
          pullRequests: store.listPullRequests(task.id),
          usageEvents: store.listUsageEvents().filter((event) => event.taskId === task.id)
        });
        return;
      }
      if (method === "POST" && segments[2] === "run-agent") {
        const activeRun = store.listTaskRuns(task.id).find((run) => run.status === "queued" || run.status === "running");
        if (activeRun) {
          sendJson(response, 409, { error: "conflict", message: `Task ${task.id} already has active run ${activeRun.id}` });
          return;
        }
        const agent = task.selectedAgent ?? "codex";
        const registryResolution = registryService.resolveRegistryContextForTask({
          task,
          agent,
          repo: store.getRepo(task.repoId)
        });
        const selectedHarness = registryResolution.selectedHarness.id ? store.getHarness(registryResolution.selectedHarness.id) : undefined;
        const taskRun = store.createTaskRun({
          taskId: task.id,
          attempt: store.listTaskRuns(task.id).length + 1,
          status: "running",
          agent,
          model: task.selectedModel ?? "mock-coder@1.0",
          modelProvider: "mock",
          selectedHarnessId: selectedHarness?.id,
          harnessVersion: `${registryResolution.selectedHarness.name}@${registryResolution.selectedHarness.version}`,
          selectedSkillRefs: registryResolution.selectedSkills,
          selectedHarnessRef: registryResolution.selectedHarness,
          selectedInstructionRefs: registryResolution.selectedInstructions,
          registryResolutionWarnings: registryResolution.warnings,
          registryResolutionErrors: registryResolution.errors,
          startedAt: new Date()
        });
        const agentRun = await context.agentRunnerService.runAgent({
          taskId: task.id,
          taskRunId: taskRun.id,
          actorId: task.requesterUserId,
          repoRef: {
            repoId: task.repoId,
            provider: store.getRepo(task.repoId)?.provider,
            localPath: undefined
          },
          branchRef: {
            repoId: task.repoId,
            branchName: task.branchName ?? `mock-agent/${task.id}`,
            baseBranch: task.baseBranch
          },
          selectedModelRef: task.selectedModel ?? "mock-coder@1.0",
          selectedSkillRefs: registryResolution.selectedSkills,
          selectedHarnessRef: registryResolution.selectedHarness,
          selectedInstructionRefs: registryResolution.selectedInstructions,
          prompt: task.description ?? task.title,
          allowedCommands: selectedHarness?.allowedTools ?? [],
          testCommands: selectedHarness?.testCommands ?? ["pnpm test"],
          maxRuntimeMs: context.agentRunnerConfig.maxRuntimeMs,
          metadata: {
            budgetLimitUsd: task.budgetLimitUsd,
            gitProviderKind: context.gitProviderConfig.providerKind,
            source: "task_run_agent_endpoint"
          }
        });
        store.updateTaskRun(taskRun.id, {
          status: agentRun.status === "completed" ? "succeeded" : "failed",
          finishedAt: new Date(),
          resultSummary: agentRun.status === "completed" ? "Agent runner completed." : `Agent runner ${agentRun.status}.`,
          changedFiles: agentRun.changedFiles,
          diffSummary: agentRun.diffSummary,
          errorMessage: agentRun.status === "completed" ? undefined : String(agentRun.metadata.reason ?? agentRun.status)
        });
        sendJson(response, agentRun.status === "blocked" ? 409 : 201, {
          task: taskView(store.getTask(task.id) ?? task),
          taskRun: store.listTaskRuns(task.id).find((run) => run.id === taskRun.id),
          agentRun: agentRunToDto(agentRun),
          usageEvents: store.listUsageEvents().filter((event) => event.taskRunId === taskRun.id)
        });
        return;
      }
      if (method === "GET" && segments[2] === "runs") {
        sendJson(response, 200, { taskRuns: store.listTaskRuns(task.id) });
        return;
      }
      if (method === "GET" && segments[2] === "agent-runs") {
        sendJson(response, 200, { agentRuns: context.agentRunnerService.listRuns({ taskId: task.id }).map(agentRunToDto) });
        return;
      }
      if (method === "POST" && segments[2] === "plan") {
        sendJson(response, 200, store.transitionTask(task.id, "planned") as unknown as JsonValue);
        return;
      }
      if (method === "POST" && segments[2] === "start") {
        if (task.status === "draft") {
          store.transitionTask(task.id, "planned");
        }
        sendJson(response, 200, store.transitionTask(task.id, "queued") as unknown as JsonValue);
        return;
      }
      if (method === "POST" && segments[2] === "cancel") {
        sendJson(response, 200, store.transitionTask(task.id, "cancelled") as unknown as JsonValue);
        return;
      }
      if (method === "POST" && segments[2] === "status") {
        const body = await readJson(request) as { status?: string };
        if (!body.status || !isTaskStatus(body.status)) {
          sendJson(response, 400, { error: "Invalid status" });
          return;
        }
        sendJson(response, 200, store.transitionTask(task.id, body.status as TaskStatus) as unknown as JsonValue);
        return;
      }
    }

    if (segments[0] === "branches" && segments[1] === "leases" && method === "GET") {
      const repoId = url.searchParams.get("repoId") ?? undefined;
      const status = url.searchParams.get("status") as BranchLeaseStatus | null;
      sendJson(response, 200, {
        branchLeases: store.listBranchLeases(repoId, status ?? undefined)
      });
      return;
    }

    if (segments[0] === "conflicts" && segments[1] === "risks" && method === "GET") {
      const repoId = url.searchParams.get("repoId") ?? undefined;
      const taskRunId = url.searchParams.get("taskRunId") ?? undefined;
      const conflictRisks = taskRunId
        ? store.computeConflictRisksForTaskRun(taskRunId)
        : repoId
          ? store.computeRepoConflictRisks(repoId)
          : store.listRepos().flatMap((repo) => store.computeRepoConflictRisks(repo.id));
      sendJson(response, 200, { conflictRisks });
      return;
    }

    if (segments[0] === "merge-simulations") {
      if (method === "GET" && segments.length === 1) {
        sendJson(response, 200, {
          mergeSimulations: store.listMergeSimulations({
            repoId: url.searchParams.get("repoId") ?? undefined,
            taskRunId: url.searchParams.get("taskRunId") ?? undefined,
            branchLeaseId: url.searchParams.get("branchLeaseId") ?? undefined
          })
        });
        return;
      }

      if (method === "POST" && segments.length === 1) {
        const body = await readJson(request) as Record<string, unknown>;
        const branchLeaseId = stringValue(body.branchLeaseId);
        const lease = branchLeaseId ? store.getBranchLease(branchLeaseId) ?? notFound("branch lease", branchLeaseId) : undefined;
        const mode: MergeSimulationMode = body.mode === "local_git_merge_tree" ? "local_git_merge_tree" : "mock";
        const repoId = stringValue(body.repoId) ?? lease?.repoId;
        const baseRef = stringValue(body.baseRef) ?? lease?.baseBranch;
        const sourceRef = stringValue(body.sourceRef) ?? lease?.branchName;
        if (!repoId || !baseRef || !sourceRef) {
          sendJson(response, 400, { error: "invalid_merge_simulation_request", message: "repoId, baseRef, and sourceRef are required unless branchLeaseId supplies them." });
          return;
        }

        const simulator = mode === "local_git_merge_tree" ? new LocalGitDryRunMergeSimulator() : new MockMergeSimulator();
        const mergeSimulation = await simulator.simulate({
          repoId,
          repoPath: stringValue(body.repoPath),
          baseRef,
          sourceRef,
          targetRef: stringValue(body.targetRef) ?? baseRef,
          taskRunId: stringValue(body.taskRunId) ?? lease?.taskRunId,
          branchLeaseId,
          mode,
          requestedStatus: isMergeSimulationStatus(body.requestedStatus)
            ? body.requestedStatus
            : isMergeSimulationStatus(body.status)
              ? body.status
              : undefined
        });
        store.recordMergeSimulation(mergeSimulation);
        sendJson(response, 201, {
          mergeSimulation,
          mergeQueue: branchLeaseId
            ? store.listMergeQueueEntries(repoId).filter((entry) => entry.branchLeaseId === branchLeaseId)
            : []
        });
        return;
      }
    }

    if (segments[0] === "merge-queue") {
      if (method === "GET" && segments.length === 1) {
        const repoId = url.searchParams.get("repoId") ?? undefined;
        sendJson(response, 200, { mergeQueue: store.listMergeQueueEntries(repoId) });
        return;
      }
      const entryId = segments[1];
      if (!entryId) notFound("merge queue entry", "");
      if (method === "POST" && segments[2] === "mark-merged") {
        if (!store.getMergeQueueEntry(entryId)) notFound("merge queue entry", entryId);
        sendJson(response, 200, { mergeQueueEntry: store.markMergeQueueEntryMerged(entryId) });
        return;
      }
      if (method === "POST" && segments[2] === "cancel") {
        if (!store.getMergeQueueEntry(entryId)) notFound("merge queue entry", entryId);
        const body = await readJson(request) as { reason?: string };
        sendJson(response, 200, { mergeQueueEntry: store.cancelMergeQueueEntry(entryId, body.reason) });
        return;
      }
    }

    if (segments[0] === "git") {
      const gitService = context.gitIntegrationService;

      if (method === "GET" && segments[1] === "providers") {
        sendJson(response, 200, { providers: gitService.listProviders() });
        return;
      }

      if (method === "GET" && segments[1] === "config") {
        sendJson(response, 200, { config: gitService.getConfig() });
        return;
      }

      if (segments[1] === "repos") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { repos: gitService.listRepos() });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            sendJson(response, 201, { repo: gitService.createRepo(await readJson(request)) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_repo", message: error instanceof Error ? error.message : "Invalid repository" });
          }
          return;
        }

        const repoId = segments[2];
        if (!repoId) {
          sendJson(response, 400, { error: "missing_repo_id", message: "repo id is required." });
          return;
        }

        if (method === "GET" && segments.length === 3) {
          sendJson(response, 200, { repo: gitService.getRepo(repoId) ?? notFound("repo", repoId) });
          return;
        }

        if (segments[3] === "branches") {
          if (method === "GET") {
            sendJson(response, 200, { branches: await gitService.listBranches(repoId, url.searchParams.get("localPath") ?? undefined) });
            return;
          }
          if (method === "POST") {
            const body = await readJson(request) as Record<string, unknown>;
            const branchName = stringValue(body.branchName);
            if (!branchName) {
              sendJson(response, 400, { error: "invalid_branch_request", message: "branchName is required." });
              return;
            }
            const result = await gitService.createBranch(repoId, {
              branchName,
              baseBranch: stringValue(body.baseBranch),
              taskId: stringValue(body.taskId),
              taskRunId: stringValue(body.taskRunId),
              localPath: stringValue(body.localPath),
              files: Array.isArray(body.files) ? body.files.filter((file): file is string => typeof file === "string") : undefined,
              symbols: Array.isArray(body.symbols) ? body.symbols.filter((symbol): symbol is string => typeof symbol === "string") : undefined,
              tests: Array.isArray(body.tests) ? body.tests.filter((testPath): testPath is string => typeof testPath === "string") : undefined
            });
            sendJson(response, result.ok ? 201 : 409, result as unknown as JsonValue);
            return;
          }
        }

        if (segments[3] === "pull-requests") {
          if (method === "GET") {
            sendJson(response, 200, { pullRequests: gitService.listPullRequests(repoId) });
            return;
          }
          if (method === "POST") {
            const body = await readJson(request) as Record<string, unknown>;
            const taskId = stringValue(body.taskId);
            const branchName = stringValue(body.branchName);
            const title = stringValue(body.title);
            if (!taskId || !branchName || !title) {
              sendJson(response, 400, { error: "invalid_pull_request", message: "taskId, branchName, and title are required." });
              return;
            }
            const result = await gitService.createPullRequest(repoId, {
              taskId,
              taskRunId: stringValue(body.taskRunId),
              branchLeaseId: stringValue(body.branchLeaseId),
              branchName,
              baseBranch: stringValue(body.baseBranch),
              title,
              body: stringValue(body.body),
              localPath: stringValue(body.localPath)
            });
            sendJson(response, result.ok ? 201 : 409, result as unknown as JsonValue);
            return;
          }
        }
      }

      if (segments[1] === "pull-requests") {
        const pullRequestId = segments[2];
        if (!pullRequestId) {
          sendJson(response, 400, { error: "missing_pull_request_id", message: "pull request id is required." });
          return;
        }
        const pullRequest = gitService.getPullRequest(pullRequestId);
        if (!pullRequest) notFound("pull request", pullRequestId);
        if (method === "GET" && segments.length === 3) {
          sendJson(response, 200, { pullRequest });
          return;
        }
        if (method === "GET" && segments[3] === "changed-files") {
          const branchName = url.searchParams.get("branchName") ?? pullRequest.externalId?.replace(/^mock-pr_/, "");
          if (!branchName) {
            sendJson(response, 400, { error: "missing_branch_name", message: "branchName query parameter is required for changed-file inspection." });
            return;
          }
          sendJson(response, 200, await gitService.getChangedFiles(pullRequest.repoId, {
            branchName,
            baseBranch: url.searchParams.get("baseBranch") ?? undefined,
            localPath: url.searchParams.get("localPath") ?? undefined
          }) as unknown as JsonValue);
          return;
        }
      }

      if (method === "GET" && segments[1] === "audit") {
        sendJson(response, 200, { auditEvents: gitService.listGitAuditEvents() });
        return;
      }
    }

    if (segments[0] === "llm") {
      const llmService = context.llmGatewayService;

      if (method === "GET" && segments[1] === "providers") {
        sendJson(response, 200, { providers: llmService.listProviders() });
        return;
      }

      if (method === "GET" && segments[1] === "config") {
        sendJson(response, 200, { config: llmConfigToDto(llmService.getConfig()) });
        return;
      }

      if (segments[1] === "models") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { models: llmService.listModels().map(llmModelToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (!isLlmProviderKind(body.providerKind) || !isLlmModelStatus(body.status) || typeof body.id !== "string" || typeof body.displayName !== "string") {
              sendJson(response, 400, { error: "invalid_llm_model", message: "id, displayName, providerKind, and status are required." });
              return;
            }
            const model = llmService.registerModel({
              id: body.id,
              providerKind: body.providerKind,
              displayName: body.displayName,
              contextWindow: typeof body.contextWindow === "number" ? body.contextWindow : 16000,
              supportsTools: body.supportsTools === true,
              supportsStreaming: body.supportsStreaming === true,
              inputTokenCostUsd: typeof body.inputTokenCostUsd === "number" ? body.inputTokenCostUsd : undefined,
              outputTokenCostUsd: typeof body.outputTokenCostUsd === "number" ? body.outputTokenCostUsd : undefined,
              status: body.status,
              metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : {}
            });
            sendJson(response, 201, { model: llmModelToDto(model) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_llm_model", message: error instanceof Error ? error.message : "Invalid LLM model." });
          }
          return;
        }
        const modelId = decodeURIComponent(segments[2] ?? "");
        if (method === "GET" && segments.length === 3) {
          const model = llmService.getModel(modelId);
          if (!model) notFound("llm model", modelId);
          sendJson(response, 200, { model: llmModelToDto(model) });
          return;
        }
        if (method === "PATCH" && segments.length === 4 && segments[3] === "status") {
          const body = await readJson(request) as Record<string, unknown>;
          if (!isLlmModelStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_llm_model_status", message: "status must be active, disabled, or deprecated." });
            return;
          }
          try {
            sendJson(response, 200, { model: llmModelToDto(llmService.updateModelStatus(modelId, body.status)) });
          } catch (error) {
            sendJson(response, 404, { error: "llm_model_not_found", message: error instanceof Error ? error.message : "LLM model not found." });
          }
          return;
        }
      }

      if (segments[1] === "virtual-keys") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { virtualKeys: llmService.listVirtualKeys().map(virtualModelKeyToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (!isVirtualModelKeyStatus(body.status) || typeof body.ownerKind !== "string" || typeof body.ownerId !== "string" || typeof body.displayName !== "string") {
              sendJson(response, 400, { error: "invalid_virtual_model_key", message: "ownerKind, ownerId, displayName, and status are required." });
              return;
            }
            const allowedProviderKinds = Array.isArray(body.allowedProviderKinds)
              ? body.allowedProviderKinds.filter(isLlmProviderKind)
              : [];
            const allowedModelIds = Array.isArray(body.allowedModelIds)
              ? body.allowedModelIds.filter((value): value is string => typeof value === "string")
              : [];
            const key = llmService.createVirtualKey({
              ownerKind: body.ownerKind as "user" | "team" | "project" | "system",
              ownerId: body.ownerId,
              displayName: body.displayName,
              allowedProviderKinds,
              allowedModelIds,
              monthlyBudgetUsd: typeof body.monthlyBudgetUsd === "number" ? body.monthlyBudgetUsd : undefined,
              perTaskBudgetUsd: typeof body.perTaskBudgetUsd === "number" ? body.perTaskBudgetUsd : undefined,
              rpmLimit: typeof body.rpmLimit === "number" ? body.rpmLimit : undefined,
              tpmLimit: typeof body.tpmLimit === "number" ? body.tpmLimit : undefined,
              status: body.status
            });
            sendJson(response, 201, { virtualKey: virtualModelKeyToDto(key) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_virtual_model_key", message: error instanceof Error ? error.message : "Invalid virtual model key." });
          }
          return;
        }
        if (method === "PATCH" && segments.length === 4 && segments[3] === "status") {
          const body = await readJson(request) as Record<string, unknown>;
          if (!isVirtualModelKeyStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_virtual_model_key_status", message: "status must be active or disabled." });
            return;
          }
          try {
            sendJson(response, 200, { virtualKey: virtualModelKeyToDto(llmService.updateVirtualKeyStatus(segments[2], body.status)) });
          } catch (error) {
            sendJson(response, 404, { error: "virtual_model_key_not_found", message: error instanceof Error ? error.message : "Virtual model key not found." });
          }
          return;
        }
      }

      if (method === "POST" && segments[1] === "route") {
        const body = await readJson(request) as Record<string, unknown>;
        const taskId = stringValue(body.taskId);
        const taskRunId = stringValue(body.taskRunId);
        const prompt = stringValue(body.prompt);
        if (!taskId || !taskRunId || !prompt) {
          sendJson(response, 400, { error: "invalid_llm_route", message: "taskId, taskRunId, and prompt are required." });
          return;
        }
        const route = llmService.routeRequest({
          taskId,
          taskRunId,
          actorId: stringValue(body.actorId),
          modelRef: stringValue(body.modelRef),
          virtualKeyId: stringValue(body.virtualKeyId),
          prompt,
          budgetLimitUsd: typeof body.budgetLimitUsd === "number" ? body.budgetLimitUsd : undefined
        });
        sendJson(response, route.ok ? 200 : 409, {
          ok: route.ok,
          model: route.model ? llmModelToDto(route.model) : undefined,
          budgetDecision: route.budgetDecision ? budgetDecisionToDto(route.budgetDecision) : undefined,
          reason: route.reason
        });
        return;
      }

      if (method === "POST" && segments[1] === "completions") {
        const body = await readJson(request) as Record<string, unknown>;
        const taskId = stringValue(body.taskId);
        const taskRunId = stringValue(body.taskRunId);
        const prompt = stringValue(body.prompt);
        if (!taskId || !taskRunId || !prompt) {
          sendJson(response, 400, { error: "invalid_llm_completion", message: "taskId, taskRunId, and prompt are required." });
          return;
        }
        const result = await llmService.routeCompletion({
          taskId,
          taskRunId,
          actorId: stringValue(body.actorId),
          modelRef: stringValue(body.modelRef),
          virtualKeyId: stringValue(body.virtualKeyId),
          prompt,
          systemInstructions: stringValue(body.systemInstructions),
          maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
          temperature: typeof body.temperature === "number" ? body.temperature : undefined,
          budgetLimitUsd: typeof body.budgetLimitUsd === "number" ? body.budgetLimitUsd : undefined,
          repoId: stringValue(body.repoId)
        });
        sendJson(response, result.ok ? 201 : 409, {
          ok: result.ok,
          result: result.result ? llmCompletionResultToDto(result.result) : undefined,
          usageEvent: result.usageEvent,
          budgetDecision: result.budgetDecision ? budgetDecisionToDto(result.budgetDecision) : undefined,
          reason: result.reason
        });
        return;
      }

      if (method === "GET" && segments[1] === "usage") {
        sendJson(response, 200, { usageEvents: llmService.listUsageEvents() });
        return;
      }

      if (method === "GET" && segments[1] === "audit") {
        sendJson(response, 200, { auditEvents: llmService.listAuditEvents().map(llmAuditEventToDto) });
        return;
      }
    }

    if (segments[0] === "repos") {
      if (method === "POST" && segments.length === 1) {
        sendJson(response, 201, store.createRepo(await readJson(request)) as unknown as JsonValue);
        return;
      }
      if (method === "GET" && segments.length === 1) {
        sendJson(response, 200, { repos: store.listRepos() });
        return;
      }
      const repoId = segments[1];
      if (method === "GET" && segments.length === 2 && repoId) {
        sendJson(response, 200, store.getRepo(repoId) ?? notFound("repo", repoId) as unknown as JsonValue);
        return;
      }
      if (method === "GET" && segments[2] === "branches" && repoId) {
        sendJson(response, 200, {
          branches: store.listBranchLeases(repoId).map((lease) => ({
            branchName: lease.branchName,
            taskId: lease.taskId,
            status: lease.status
          }))
        });
        return;
      }
    }

    if (method === "GET" && url.pathname === "/skills") {
      sendJson(response, 200, { skills: registryService.listSkills().map(skillToDto) });
      return;
    }
    if (method === "GET" && url.pathname === "/harnesses") {
      sendJson(response, 200, { harnesses: registryService.listHarnesses().map(harnessToDto) });
      return;
    }
    if (method === "GET" && url.pathname === "/instructions") {
      sendJson(response, 200, { instructions: registryService.listInstructions().map(instructionToDto) });
      return;
    }
    if (method === "GET" && url.pathname === "/usage/events") {
      sendJson(response, 200, { usageEvents: store.listUsageEvents() });
      return;
    }
    if (method === "GET" && url.pathname === "/usage") {
      const taskId = url.searchParams.get("taskId") ?? undefined;
      sendJson(response, 200, {
        usageEvents: store.listUsageEvents().filter((event) => taskId === undefined || event.taskId === taskId)
      });
      return;
    }
    if (method === "GET" && url.pathname === "/audit-logs") {
      sendJson(response, 200, { auditLogs: store.listAuditLogs() });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    if (error instanceof AichestraError) {
      const statusCode = error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 400;
      sendJson(response, statusCode, {
        error: error.code,
        message: error.message
      });
      return;
    }
    sendJson(response, 500, {
      error: "internal_error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export function createApiServer(store: InMemoryAichestraStore = createSeededStore()) {
  const storage = createInMemoryStorageProvider({ store, repoRoot: process.cwd() });
  return createApiServerWithStorage(storage);
}

export function createApiServerWithStorage(storage: StorageProvider) {
  const store = storage.repositoryFactory.createDataStore();
  const policyService = new PolicyService();
  const securityService = new SecurityControlService({ policyService });
  const providerAbstractionService = new ProviderAbstractionService({ policyService });
  const registryService = createRegistryService({
    ...storage.repositoryFactory.createRegistryRepositories(),
    authorizer: new PolicyBackedRegistryMutationAuthorizer({ policyService })
  });
  const improvementServices = createImprovementServices(storage.repositoryFactory.createImprovementRepositories(), { policyService });
  const git = createGitProviderFromEnv();
  const gitIntegrationService = new GitIntegrationService({
    store,
    provider: git.provider,
    config: git.config,
    policyService
  });
  const llmGatewayService = createDefaultLlmGatewayService({
    usageRepository: store,
    policyService
  });
  const agentRunnerConfig = createAgentRunnerConfigFromEnv();
  const agentRunnerRepositories = createInMemoryAgentRunnerRepositories();
  const agentRunner = agentRunnerConfig.runnerKind === "mock"
    ? new MockAgentRunner(llmGatewayService)
    : createAgentRunnerFromConfig(agentRunnerConfig, {
      llmGateway: llmGatewayService,
      commandResultRepository: agentRunnerRepositories.commandExecutionResultRepository,
      workspaceManager: new LocalAgentWorkspaceManager({
        workspaceRoot: agentRunnerConfig.workspaceRoot,
        workspaceRepository: agentRunnerRepositories.workspaceRepository
      })
    });
  const agentRunnerService = new AgentRunnerService({
    runner: agentRunner,
    config: agentRunnerConfig,
    runRepository: agentRunnerRepositories.runRepository,
    auditRepository: agentRunnerRepositories.auditRepository,
    instructionAssemblyRepository: agentRunnerRepositories.instructionAssemblyRepository,
    commandExecutionResultRepository: agentRunnerRepositories.commandExecutionResultRepository,
    workspaceRepository: agentRunnerRepositories.workspaceRepository,
    policyService,
    securityService
  });
  return createServer((request, response) => {
    void handleRequest(request, response, {
      store,
      storageProvider: storage,
      gitIntegrationService,
      gitProviderConfig: git.config,
      llmGatewayService,
      agentRunnerService,
      agentRunnerConfig,
      registryService,
      improvementServices,
      policyService,
      providerAbstractionService,
      securityService
    });
  });
}

export function createApiStorageProviderFromEnv(env: Record<string, string | undefined> = process.env): StorageProvider {
  if (env.AICHESTRA_STORAGE_PROVIDER === "postgres") {
    return createPostgresStorageProviderFromEnv(env);
  }
  return createInMemoryStorageProvider({ repoRoot: process.cwd() });
}

function isMain(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

async function start(): Promise<void> {
  const host = process.env.AICHESTRA_API_HOST ?? "127.0.0.1";
  const port = Number(process.env.AICHESTRA_API_PORT ?? "3000");
  const storage = createApiStorageProviderFromEnv();
  const health = await storage.healthCheck();
  if (!health.healthy) {
    throw new Error(`Storage provider ${health.kind} is not healthy: ${health.message}`);
  }
  createApiServerWithStorage(storage).listen(port, host, () => {
    console.log(`aichestra-api listening on http://${host}:${port}`);
  });
}

if (isMain()) {
  void start().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

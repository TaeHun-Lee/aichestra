import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import {
  AuthorizationService,
  FutureOidcAuthProviderPlaceholder,
  FutureSamlAuthProviderPlaceholder,
  InMemoryAuthRepository,
  MockAuthProvider,
  RequestContextResolver,
  type Principal,
  type Actor,
  type Team,
  type Role,
  type Permission,
  type RoleBinding,
  type ServiceAccount
} from "@aichestra/auth";
import { PolicyService } from "@aichestra/policy";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";

function jsonHasSecretMaterial(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /sk-[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._~+/=-]+|ghp_|github_pat_|SESSION_SECRET=|JWT_SECRET=|PASSWORD=|auth\.json/.test(text);
}

function getJsonWithStatus(port: number, path: string, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJsonWithStatus(port: number, path: string, body: Record<string, unknown> = {}, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized),
        ...headers
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(serialized);
  });
}

async function withApiServer(run: (port: number) => Promise<void>): Promise<void> {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    await run(address.port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function createService(): AuthorizationService {
  const repository = new InMemoryAuthRepository();
  return new AuthorizationService({
    repository,
    provider: new MockAuthProvider({ repository }),
    policyService: new PolicyService()
  });
}

test("auth domain repositories create provider-neutral RBAC records without credential fields", () => {
  const repository = new InMemoryAuthRepository({
    principals: [],
    actors: [],
    teams: [],
    roles: [],
    permissions: [],
    roleBindings: [],
    serviceAccounts: [],
    identityProviders: []
  });
  const now = new Date("2026-05-12T00:00:00.000Z");
  const principal: Principal = {
    id: "principal_test",
    principalKind: "user",
    displayName: "Test Principal",
    email: "test@example.com",
    status: "active",
    createdAt: now,
    updatedAt: now,
    metadata: {}
  };
  const actor: Actor = {
    id: "actor_test",
    principalId: principal.id,
    actorKind: "human_user",
    displayName: "Test Actor",
    roles: ["viewer"],
    teams: ["team_test"],
    status: "active",
    createdAt: now,
    updatedAt: now,
    metadata: {}
  };
  const team: Team = { id: "team_test", name: "test", displayName: "Test Team", status: "active", metadata: {} };
  const permission: Permission = { id: "perm_dashboard_read", action: "dashboard.read", resourceKind: "dashboard", description: "Read dashboard.", riskLevel: "low" };
  const role: Role = { id: "role_viewer", name: "viewer", description: "Viewer.", permissions: [permission.id], status: "active", metadata: {} };
  const binding: RoleBinding = {
    id: "binding_test",
    principalId: principal.id,
    roleId: role.id,
    scope: { id: "scope_global", scopeKind: "global", description: "Global.", metadata: {} },
    status: "active",
    createdAt: now,
    updatedAt: now
  };
  const serviceAccount: ServiceAccount = {
    id: "svcacct_test",
    principalId: "principal_service",
    name: "test-runner",
    allowedScopes: [binding.scope],
    status: "active",
    createdAt: now,
    updatedAt: now,
    metadata: {}
  };

  repository.upsertPrincipal(principal);
  repository.upsertActor(actor);
  repository.upsertTeam(team);
  repository.upsertPermission(permission);
  repository.upsertRole(role);
  repository.upsertRoleBinding(binding);
  repository.upsertServiceAccount(serviceAccount);

  assert.equal(repository.getPrincipal(principal.id)?.displayName, "Test Principal");
  assert.equal(repository.getActor(actor.id)?.principalId, principal.id);
  assert.equal(repository.getTeam(team.id)?.name, "test");
  assert.equal(repository.getRole("viewer")?.permissions.includes(permission.id), true);
  assert.equal(repository.getPermission("dashboard.read")?.resourceKind, "dashboard");
  assert.equal(repository.listRoleBindings({ principalId: principal.id }).length, 1);
  assert.equal(repository.getServiceAccount(serviceAccount.id)?.name, "test-runner");
  assert.equal(jsonHasSecretMaterial(repository.listPrincipals()), false);
  assert.equal(jsonHasSecretMaterial(repository.listActors()), false);
  assert.equal(jsonHasSecretMaterial(repository.listServiceAccounts()), false);
});

test("MockAuthProvider resolves explicit mock actors and future providers stay disabled", () => {
  const repository = new InMemoryAuthRepository();
  const provider = new MockAuthProvider({ repository, defaultActorId: "user_demo_developer" });
  const context = provider.resolveAuthContext({ source: "test" });

  assert.equal(context.actor.id, "user_demo_developer");
  assert.equal(context.authMode, "mock");
  assert.equal(context.authenticated, true);
  assert.equal(context.metadata.isMockActor, true);
  assert.equal(context.roles.some((role) => role.name === "developer"), true);
  assert.equal(provider.validateActor(context.actor).ok, true);
  assert.throws(() => new FutureOidcAuthProviderPlaceholder().resolveAuthContext(), /disabled and not implemented/);
  assert.throws(() => new FutureSamlAuthProviderPlaceholder().resolveAuthContext(), /disabled and not implemented/);
});

test("AuthorizationService enforces RBAC, keeps policy denials authoritative, and audits decisions", () => {
  const service = createService();
  const viewer = service.getAuthContext({ actorId: "user_demo_viewer", source: "test" });
  const developer = service.getAuthContext({ actorId: "user_demo_developer", source: "test" });
  const reviewer = service.getAuthContext({ actorId: "user_demo_reviewer", source: "test" });
  const securityAdmin = service.getAuthContext({ actorId: "user_security_admin", source: "test" });
  const platformAdmin = service.getAuthContext({ actorId: "mock-admin", source: "test" });
  const serviceAccount = service.getAuthContext({ actorId: "svc_runner", source: "test" });
  const unknown = service.getAuthContext({ actorId: "does-not-exist", source: "test" });

  assert.equal(service.hasPermission(viewer, "dashboard.read", { resourceKind: "dashboard" }).allowed, true);
  assert.equal(service.hasPermission(viewer, "git.remote_operation", { resourceKind: "git_operation" }).allowed, false);
  assert.equal(service.hasPermission(developer, "task.create", { resourceKind: "task" }).allowed, true);
  assert.equal(service.hasPermission(developer, "task.run", { resourceKind: "task" }).allowed, true);
  assert.equal(service.hasPermission(developer, "secret.read", { resourceKind: "secret_scope" }).allowed, false);
  assert.equal(service.hasPermission(reviewer, "improvement.proposal.approve", { resourceKind: "improvement_proposal" }).allowed, true);
  assert.equal(service.hasPermission(securityAdmin, "security.audit.read", { resourceKind: "secret_scope" }).allowed, true);
  assert.equal(service.hasPermission(platformAdmin, "git.merge", { resourceKind: "git_operation" }).allowed, false);
  assert.match(service.hasPermission(platformAdmin, "git.merge", { resourceKind: "git_operation" }).reason, /policy_denied/);
  assert.equal(service.hasPermission(serviceAccount, "task.run", {
    resourceKind: "task",
    resourceId: "task_demo_backend",
    scope: { id: "scope_task_demo_backend", scopeKind: "task", scopeId: "task_demo_backend", description: "Task scope.", metadata: {} }
  }).allowed, true);
  assert.equal(service.hasPermission(serviceAccount, "task.run", {
    resourceKind: "task",
    resourceId: "task_other",
    scope: { id: "scope_task_other", scopeKind: "task", scopeId: "task_other", description: "Task scope.", metadata: {} }
  }).allowed, false);
  assert.equal(service.hasPermission(unknown, "dashboard.read", { resourceKind: "dashboard" }).allowed, false);
  assert.equal(service.listAuditEvents({ eventType: "authorization_denied" }).length > 0, true);
});

test("AuthContext maps roles, teams, principal, and mock mode into PolicySubject", () => {
  const service = createService();
  const context = service.getAuthContext({ actorId: "user_demo_developer", source: "test" });
  const subject = service.toPolicySubject(context);
  const denied = service.hasPermission(context, "secret.read", { resourceKind: "secret_scope" });

  assert.equal(subject.actorId, "user_demo_developer");
  assert.equal(subject.principalId, "principal_demo_developer");
  assert.equal(subject.actorKind, "human_user");
  assert.deepEqual(subject.roles, ["developer"]);
  assert.deepEqual(subject.teams, ["team_development"]);
  assert.equal(subject.authMode, "mock");
  assert.equal(subject.isMockActor, true);
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /permission_denied|policy_denied/);
});

test("RequestContextResolver creates explicit API, system, and test contexts", () => {
  const service = createService();
  const resolver = new RequestContextResolver(service);
  const apiRequest = { headers: { "x-aichestra-actor-id": "user_demo_viewer", "x-aichestra-correlation-id": "corr-auth-test" } } as unknown as IncomingMessage;
  const apiContext = resolver.resolveFromApiRequest(apiRequest);
  const systemContext = resolver.createSystemContext("unit-test");
  const testContext = resolver.createTestContext("user_demo_developer", { fixture: true });

  assert.equal(apiContext.source, "api");
  assert.equal(apiContext.authContext.actor.id, "user_demo_viewer");
  assert.equal(apiContext.correlationId, "corr-auth-test");
  assert.equal(apiContext.requestId.startsWith("req_"), true);
  assert.equal(systemContext.source, "system");
  assert.equal(systemContext.authContext.actor.id, "mock-admin");
  assert.equal(testContext.source, "test");
  assert.equal(testContext.authContext.actor.id, "user_demo_developer");
  assert.equal(testContext.requestId.startsWith("testreq_"), true);
});

test("auth API exposes mock-only status, RBAC read models, authorization checks, and no login or token endpoints", async () => {
  await withApiServer(async (port) => {
    const config = await getJsonWithStatus(port, "/auth/config");
    const me = await getJsonWithStatus(port, "/auth/me");
    const roles = await getJsonWithStatus(port, "/auth/roles");
    const permissions = await getJsonWithStatus(port, "/auth/permissions");
    const teams = await getJsonWithStatus(port, "/auth/teams");
    const actors = await getJsonWithStatus(port, "/auth/actors");
    const serviceAccounts = await getJsonWithStatus(port, "/auth/service-accounts");
    const roleBindings = await getJsonWithStatus(port, "/auth/role-bindings");
    const audit = await getJsonWithStatus(port, "/auth/audit");
    const check = await postJsonWithStatus(port, "/auth/authorize/check", {
      actorId: "user_demo_developer",
      action: "task.run",
      resourceKind: "task"
    });
    const viewerCheckDenied = await postJsonWithStatus(port, "/auth/authorize/check", {
      actorId: "user_demo_developer",
      action: "task.run",
      resourceKind: "task"
    }, { "x-aichestra-actor-id": "user_demo_viewer" });
    const login = await getJsonWithStatus(port, "/auth/login");
    const token = await getJsonWithStatus(port, "/auth/token");
    const password = await getJsonWithStatus(port, "/auth/password");

    assert.equal(config.statusCode, 200);
    assert.equal((config.body.config as { providerKind: string }).providerKind, "mock");
    assert.equal((config.body.config as { productionAuthEnabled: boolean }).productionAuthEnabled, false);
    assert.equal(me.statusCode, 200);
    assert.equal(((me.body.authContext as Record<string, unknown>).authMode), "mock");
    assert.equal((roles.body.roles as unknown[]).length > 0, true);
    assert.equal((permissions.body.permissions as unknown[]).length > 0, true);
    assert.equal((teams.body.teams as unknown[]).length > 0, true);
    assert.equal((actors.body.actors as unknown[]).length > 0, true);
    assert.equal((serviceAccounts.body.serviceAccounts as unknown[]).length > 0, true);
    assert.equal((roleBindings.body.roleBindings as unknown[]).length > 0, true);
    assert.equal(Array.isArray(audit.body.auditEvents), true);
    assert.equal(check.statusCode, 200);
    assert.equal(((check.body.decision as Record<string, unknown>).allowed), true);
    assert.equal(viewerCheckDenied.statusCode, 403);
    assert.equal(login.statusCode, 404);
    assert.equal(token.statusCode, 404);
    assert.equal(password.statusCode, 404);
    assert.equal(jsonHasSecretMaterial({ config, me, roles, permissions, teams, actors, serviceAccounts, roleBindings, audit, check }), false);
  });
});

test("health and dashboard expose auth visibility without secrets or production-auth claims", async () => {
  await withApiServer(async (port) => {
    const health = await getJsonWithStatus(port, "/health");
    const dashboardAuth = await getJsonWithStatus(port, "/dashboard/auth");
    const dashboardOverview = await getJsonWithStatus(port, "/dashboard/overview");

    assert.equal(health.statusCode, 200);
    assert.equal(((health.body.auth as Record<string, unknown>).providerKind), "mock");
    assert.equal(((health.body.auth as Record<string, unknown>).productionAuthEnabled), false);
    assert.equal(((health.body.auth as Record<string, unknown>).mockActorEnabled), true);
    assert.equal(dashboardAuth.statusCode, 200);
    assert.equal(((dashboardAuth.body.auth as Record<string, unknown>).warning as string).includes("not production authentication"), true);
    assert.equal((((dashboardAuth.body.auth as Record<string, unknown>).currentActor as Record<string, unknown>).authMode), "mock");
    assert.equal(dashboardOverview.statusCode, 200);
    assert.equal(((dashboardOverview.body.overview as Record<string, unknown>).metrics as Record<string, unknown>).authRoles as number > 0, true);
    assert.equal(jsonHasSecretMaterial({ health, dashboardAuth, dashboardOverview }), false);
  });
});

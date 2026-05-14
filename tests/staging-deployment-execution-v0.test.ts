import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  captureLocalStagingSignoffScope,
  createDeploymentReadinessService,
  createStagingSignoffScopeSnapshot,
  type StagingHumanSignoffEvidence,
  type StagingReleaseCandidateSignoffRole,
  type StagingSignoffScopeSnapshot
} from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { createWebServer } from "../apps/web/src/main.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-14T00:00:00.000Z");
const stagingSignoffRoles: StagingReleaseCandidateSignoffRole[] = [
  "engineering_owner",
  "platform_owner",
  "security_reviewer",
  "product_owner",
  "qa_reviewer",
  "release_manager"
];
const fixedScope = createStagingSignoffScopeSnapshot({
  reviewedCommitSha: "4056ac7ddb31d63687d5474ba39104d3969371d7",
  reviewedBranch: "codex/codex-work",
  scopeCapturedAt: fixedNow.toISOString()
});

function hasSecretOrEnvValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /postgres:\/\/|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|GITHUB_TOKEN=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|GITHUB_APP_PRIVATE_KEY=|GITHUB_APP_ID=|GITHUB_INSTALLATION_ID=|AICHESTRA_LLM_API_KEY=|LLM_API_KEY=|VAULT_TOKEN=|AICHESTRA_VAULT_TOKEN=|hvs\.stagingtoken|SESSION_SECRET=|JWT_SECRET=|Bearer\s+staging|sk-staging|ghp_staging|github_pat_|AWS_SECRET_ACCESS_KEY=|GCP_SECRET=|AZURE_KEY=|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
}

function getJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function getText(port: number, path: string): Promise<{ statusCode: number; body: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
          contentType: String(response.headers["content-type"] ?? "")
        });
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload).toString()
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(payload);
  });
}

async function withApiServer(run: (port: number) => Promise<void>, envPatch: Record<string, string | undefined> = {}): Promise<void> {
  const previousEnv = new Map(Object.keys(envPatch).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(envPatch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function withWebServer(run: (port: number) => Promise<void>): Promise<void> {
  const server = createWebServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function humanSignoff(
  role: StagingReleaseCandidateSignoffRole,
  status: StagingHumanSignoffEvidence["status"],
  patch: Partial<StagingHumanSignoffEvidence> = {}
): StagingHumanSignoffEvidence {
  return {
    role,
    required: true,
    status,
    approverName: `${role} reviewer`,
    signedAt: "2026-05-14T00:00:00Z",
    reviewedEvidence: [
      "docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md",
      "docs/roadmaps/staging-deployment-execution/signoff-evidence-checklist-v0.md",
      "docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md"
    ],
    reviewedCommitSha: fixedScope.reviewedCommitSha,
    reviewedBranch: fixedScope.reviewedBranch,
    reviewedScopeMethod: fixedScope.reviewedScopeMethod,
    reviewedDiffScope: fixedScope.reviewedDiffScope,
    scopeCapturedAt: fixedScope.scopeCapturedAt,
    scopeEvidencePath: fixedScope.scopeEvidencePath,
    validationEvidencePaths: fixedScope.validationEvidencePaths,
    signatureMethod: "recorded_human_evidence",
    evidenceSource: "test fixture explicit evidence",
    metadata: { fixture: true },
    ...patch
  };
}

function signoffScopePatch(scope: StagingSignoffScopeSnapshot): Partial<StagingHumanSignoffEvidence> {
  return {
    reviewedCommitSha: scope.reviewedCommitSha,
    reviewedBranch: scope.reviewedBranch,
    reviewedScopeMethod: scope.reviewedScopeMethod,
    reviewedDiffScope: scope.reviewedDiffScope,
    scopeCapturedAt: scope.scopeCapturedAt,
    scopeEvidencePath: scope.scopeEvidencePath,
    validationEvidencePaths: scope.validationEvidencePaths
  };
}

function withoutReviewedScope(): Partial<StagingHumanSignoffEvidence> {
  return {
    reviewedCommitSha: undefined,
    reviewedBranch: undefined,
    reviewedScopeMethod: undefined,
    reviewedDiffScope: undefined,
    scopeCapturedAt: undefined,
    scopeEvidencePath: undefined,
    validationEvidencePaths: undefined
  };
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function createLocalGitFixture(): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), "aichestra-signoff-scope-"));
  runGit(repo, ["init", "-b", "main"]);
  writeFileSync(path.join(repo, "README.md"), "initial\n", "utf8");
  runGit(repo, ["add", "README.md"]);
  runGit(repo, ["-c", "user.name=Aichestra Test", "-c", "user.email=test@example.invalid", "commit", "-m", "initial"]);
  return repo;
}

test("clean worktree scope capture uses commit SHA scope", async (t) => {
  const repo = createLocalGitFixture();
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  const scope = await captureLocalStagingSignoffScope({ cwd: repo, capturedAt: fixedNow });

  assert.equal(scope.reviewedCommitSha.length, 40);
  assert.equal(scope.reviewedBranch, "main");
  assert.equal(scope.reviewedScopeMethod, "commit_sha");
  assert.equal(scope.reviewedDiffScope.worktreeStatus, "clean");
  assert.deepEqual(scope.reviewedDiffScope.modifiedFiles, []);
  assert.deepEqual(scope.reviewedDiffScope.untrackedFiles, []);
  assert.equal(scope.scopeCapturedAt, fixedNow.toISOString());
  assert.match(scope.reviewedDiffScope.diffScopeHash ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.equal(hasSecretOrEnvValue(scope), false);
});

test("dirty worktree scope capture uses explicit diff scope", async (t) => {
  const repo = createLocalGitFixture();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  writeFileSync(path.join(repo, "README.md"), "changed\n", "utf8");

  const scope = await captureLocalStagingSignoffScope({ cwd: repo, capturedAt: fixedNow });

  assert.equal(scope.reviewedScopeMethod, "explicit_diff_scope");
  assert.equal(scope.reviewedDiffScope.worktreeStatus, "dirty");
  assert.deepEqual(scope.reviewedDiffScope.modifiedFiles, ["README.md"]);
  assert.deepEqual(scope.reviewedDiffScope.untrackedFiles, []);
  assert.equal(scope.reviewedDiffScope.diffNameStatus?.some((line) => line.includes("README.md")), true);
  assert.match(scope.reviewedDiffScope.diffScopeHash ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.equal(hasSecretOrEnvValue(scope), false);
});

test("untracked file scope capture records explicit diff scope without file contents", async (t) => {
  const repo = createLocalGitFixture();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  writeFileSync(path.join(repo, "local-secret-note.txt"), "AICHESTRA_LLM_API_KEY=sk-staging-secret\n", "utf8");

  const scope = await captureLocalStagingSignoffScope({ cwd: repo, capturedAt: fixedNow });

  assert.equal(scope.reviewedScopeMethod, "explicit_diff_scope");
  assert.equal(scope.reviewedDiffScope.worktreeStatus, "dirty");
  assert.deepEqual(scope.reviewedDiffScope.modifiedFiles, []);
  assert.deepEqual(scope.reviewedDiffScope.untrackedFiles, ["local-secret-note.txt"]);
  assert.equal(JSON.stringify(scope).includes("sk-staging-secret"), false);
  assert.equal(hasSecretOrEnvValue(scope), false);
});

test("scope capture redacts credential cache paths", async (t) => {
  const repo = createLocalGitFixture();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  mkdirSync(path.join(repo, ".codex"), { recursive: true });
  writeFileSync(path.join(repo, ".codex", "auth.json"), "{\"token\":\"sk-staging-secret\"}\n", "utf8");

  const scope = await captureLocalStagingSignoffScope({ cwd: repo, capturedAt: fixedNow });
  const serialized = JSON.stringify(scope);

  assert.equal(scope.reviewedScopeMethod, "explicit_diff_scope");
  assert.equal(scope.reviewedDiffScope.untrackedFiles.includes("[redacted-credential-cache-path]"), true);
  assert.equal(serialized.includes(".codex"), false);
  assert.equal(serialized.includes("auth.json"), false);
  assert.equal(serialized.includes("sk-staging-secret"), false);
  assert.equal(hasSecretOrEnvValue(scope), false);
});

test("staging execution models expose plan, steps, gates, go/no-go, rollback, and summary safely", () => {
  const service = createDeploymentReadinessService({ now: () => fixedNow });
  const plan = service.getStagingDeploymentExecutionPlan();
  const steps = service.listStagingDeploymentExecutionSteps();
  const gates = service.listStagingDeploymentExecutionGates();
  const validationGates = service.listStagingDeploymentExecutionGates({ category: "validation" });
  const decision = service.getStagingDeploymentGoNoGoDecision();
  const rollback = service.getStagingDeploymentRollbackPlan();
  const summary = service.getStagingDeploymentExecutionSummary();

  assert.equal(plan.id, "staging_deployment_execution_plan_v0");
  assert.equal(plan.status, "ready_for_signoff");
  assert.equal(plan.requiredSignoffs.length, 6);
  assert.equal(plan.deploymentSteps.length, 20);
  assert.equal(steps.length, 20);
  assert.equal(steps.some((step) => step.phase === "deployment_placeholder" && step.status === "future"), true);
  assert.equal(steps.some((step) => step.id === "staging_execution_step_05_collect_human_signoffs" && step.status === "blocked"), true);
  assert.equal(validationGates.every((gate) => gate.category === "validation"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_no_release_tag_deploy_side_effects" && gate.status === "pass" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_no_secret_no_env" && gate.status === "pass" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_human_signoff_collected" && gate.status === "fail" && gate.severity === "high"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_github_app_decision" && gate.status === "skipped"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_llm_decision" && gate.status === "skipped"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_vault_decision" && gate.status === "skipped"), true);
  assert.equal(decision.status, "not_ready");
  assert.equal(decision.pendingApprovals.length, 6);
  assert.equal(decision.blockers.includes("staging_execution_human_signoff_collected"), true);
  assert.equal(rollback.status, "ready_for_review");
  assert.equal(rollback.rollbackSteps.length, 10);
  assert.equal(summary.status, "v0_implemented");
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.planStatus, "ready_for_signoff");
  assert.equal(summary.goNoGoStatus, "not_ready");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.stagingDeployed, false);
  assert.equal(summary.deploymentExecuted, false);
  assert.equal(summary.releaseCreated, false);
  assert.equal(summary.gitTagCreated, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.remoteIntegrationTestsExecuted, false);
  assert.equal(summary.signoffPackAvailable, true);
  assert.equal(summary.requiredSignoffCount, 6);
  assert.equal(summary.pendingSignoffCount, 6);
  assert.equal(summary.approvedSignoffCount, 0);
  assert.equal(summary.signoffStatus, "pending");
  assert.equal(summary.actualDeploymentBlocked, true);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(hasSecretOrEnvValue({ plan, steps, gates, decision, rollback, summary }), false);
});

test("staging execution evaluation blocks validation failure, side effects, destructive Git, overclaims, and secret exposure", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_ALLOW_REMOTE_MERGE: "true",
      AICHESTRA_ALLOW_REMOTE_FORCE_PUSH: "true",
      AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE: "true"
    },
    stagingDeploymentExecutionOptions: {
      validationCommandStatus: "fail",
      failedValidationCommands: ["pnpm test"],
      diffCheckStatus: "fail",
      safeIntegrationScanStatus: "fail",
      noSecretExposureStatus: "fail",
      secretsExposed: true,
      envValuesExposed: true,
      deploymentExecuted: true,
      releaseCreated: true,
      gitTagCreated: true,
      externalCallsExecuted: true,
      productionReadyClaimed: true,
      stagingDeployedClaimed: true
    },
    now: () => fixedNow
  });

  const gates = service.listStagingDeploymentExecutionGates();
  const decision = service.getStagingDeploymentGoNoGoDecision();
  const summary = service.getStagingDeploymentExecutionSummary();

  assert.equal(gates.some((gate) => gate.id === "staging_execution_pnpm_test" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_git_diff_check" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_safe_integration_scan" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_no_secret_no_env" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_no_release_tag_deploy_side_effects" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_no_ready_overclaim" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_destructive_git_disabled" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(decision.status, "no_go");
  assert.equal(summary.planStatus, "blocked");
  assert.equal(summary.criticalBlockerCount > 0, true);
  assert.equal(summary.deploymentExecuted, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.noSecretsExposed, false);
  assert.equal(summary.envValuesExposed, true);
  assert.equal(summary.productionReadyClaimed, true);
  assert.equal(summary.stagingDeployedClaimed, true);
  assert.equal(hasSecretOrEnvValue({ gates, decision, summary }), false);
});

test("staging execution can reach go_with_warnings only after required mock signoffs are present", () => {
  const signoffStatuses = {
    engineering_owner: "approved_mock",
    platform_owner: "approved_mock",
    security_reviewer: "approved_mock",
    product_owner: "approved_mock",
    qa_reviewer: "approved_mock",
    release_manager: "approved_mock"
  } as const;
  const service = createDeploymentReadinessService({
    stagingDeploymentExecutionOptions: {
      signoffStatuses,
      validationCommandStatus: "pass",
      diffCheckStatus: "pass",
      safeIntegrationScanStatus: "pass",
      noSecretExposureStatus: "pass",
      releaseNotesPresent: true,
      rollbackPlanPresent: true
    },
    now: () => fixedNow
  });

  const plan = service.getStagingDeploymentExecutionPlan();
  const steps = service.listStagingDeploymentExecutionSteps();
  const decision = service.getStagingDeploymentGoNoGoDecision();
  const summary = service.getStagingDeploymentExecutionSummary();

  assert.equal(plan.status, "planned");
  assert.equal(steps.some((step) => step.id === "staging_execution_step_05_collect_human_signoffs" && step.status === "ready"), true);
  assert.equal(decision.pendingApprovals.length, 0);
  assert.equal(decision.blockers.length, 0);
  assert.equal(decision.status, "go_with_warnings");
  assert.equal(summary.pendingSignoffCount, 0);
  assert.equal(summary.signoffPackAvailable, true);
  assert.equal(summary.requiredSignoffCount, 6);
  assert.equal(summary.approvedSignoffCount, 0);
  assert.equal(summary.signoffStatus, "pending");
  assert.equal(summary.actualDeploymentBlocked, true);
  assert.equal(summary.goNoGoStatus, "go_with_warnings");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.stagingDeployed, false);
  assert.equal(hasSecretOrEnvValue({ plan, steps, decision, summary }), false);
});

test("staging signoff collection counts only explicit human evidence and keeps missing roles pending", () => {
  const service = createDeploymentReadinessService({
    stagingDeploymentExecutionOptions: {
      humanSignoffs: {
        engineering_owner: humanSignoff("engineering_owner", "approved"),
        security_reviewer: humanSignoff("security_reviewer", "rejected", { notes: "Security review rejected this staging execution." }),
        qa_reviewer: humanSignoff("qa_reviewer", "approved", { signedAt: undefined })
      }
    },
    now: () => fixedNow
  });

  const gates = service.listStagingDeploymentExecutionGates();
  const decision = service.getStagingDeploymentGoNoGoDecision();
  const summary = service.getStagingDeploymentExecutionSummary();
  const signoffGate = gates.find((gate) => gate.id === "staging_execution_human_signoff_collected");

  assert.equal(decision.status, "no_go");
  assert.equal(decision.reason, "A required human signoff was rejected.");
  assert.equal(decision.pendingApprovals.length, 4);
  assert.equal(summary.approvedSignoffCount, 1);
  assert.equal(summary.rejectedSignoffCount, 1);
  assert.equal(summary.pendingSignoffCount, 4);
  assert.equal(summary.missingRequiredSignoffCount, 4);
  assert.equal(summary.signoffStatus, "rejected");
  assert.equal(summary.actualDeploymentBlocked, true);
  assert.deepEqual((summary.metadata.invalidSignoffEvidenceRoles as string[]), ["qa_reviewer"]);
  assert.equal(signoffGate?.status, "fail");
  assert.equal(hasSecretOrEnvValue({ gates, decision, summary }), false);
});

test("complete real human signoff evidence updates counts without executing deployment", () => {
  const service = createDeploymentReadinessService({
    stagingDeploymentExecutionOptions: {
      humanSignoffs: Object.fromEntries(stagingSignoffRoles.map((role) => [role, humanSignoff(role, "approved")])) as Partial<Record<StagingReleaseCandidateSignoffRole, StagingHumanSignoffEvidence>>
    },
    now: () => fixedNow
  });

  const decision = service.getStagingDeploymentGoNoGoDecision();
  const summary = service.getStagingDeploymentExecutionSummary();

  assert.equal(decision.pendingApprovals.length, 0);
  assert.equal(decision.status, "go_with_warnings");
  assert.equal(summary.approvedSignoffCount, 6);
  assert.equal(summary.pendingSignoffCount, 0);
  assert.equal(summary.rejectedSignoffCount, 0);
  assert.equal(summary.signoffStatus, "approved");
  assert.equal(summary.actualDeploymentBlocked, true);
  assert.equal(summary.metadata.approvalAuditRequired, true);
  assert.equal(summary.deploymentExecuted, false);
  assert.equal(summary.stagingDeployed, false);
  assert.equal(summary.productionReady, false);
  assert.equal(hasSecretOrEnvValue({ decision, summary }), false);
});

test("scope-less human approvals remain collected but require scope revalidation", () => {
  const service = createDeploymentReadinessService({
    stagingDeploymentExecutionOptions: {
      humanSignoffs: Object.fromEntries(stagingSignoffRoles.map((role) => [
        role,
        humanSignoff(role, "approved", withoutReviewedScope())
      ])) as Partial<Record<StagingReleaseCandidateSignoffRole, StagingHumanSignoffEvidence>>
    },
    now: () => fixedNow
  });

  const decision = service.getStagingDeploymentGoNoGoDecision();
  const summary = service.getStagingDeploymentExecutionSummary();
  const scopeReview = service.getStagingHumanSignoffScopeReview(fixedScope);

  assert.equal(decision.pendingApprovals.length, 0);
  assert.equal(summary.approvedSignoffCount, 6);
  assert.equal(summary.pendingSignoffCount, 0);
  assert.equal(summary.signoffStatus, "approved");
  assert.equal(summary.actualDeploymentBlocked, true);
  assert.equal(scopeReview.status, "stale");
  assert.equal(scopeReview.staleRoles.length, 6);
  assert.equal(scopeReview.approvalAuditCanPass, false);
  assert.equal(scopeReview.actualDeploymentBlocked, true);
  assert.equal(hasSecretOrEnvValue({ decision, summary, scopeReview }), false);
});

test("scope mismatch keeps staging deployment blocked and marks revalidation stale", () => {
  const reviewedScope = createStagingSignoffScopeSnapshot({
    reviewedCommitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    reviewedBranch: "main",
    scopeCapturedAt: fixedNow.toISOString()
  });
  const currentScope = createStagingSignoffScopeSnapshot({
    reviewedCommitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    reviewedBranch: "main",
    modifiedFiles: ["packages/deployment-readiness/src/service.ts"],
    diffNameStatus: ["M\tpackages/deployment-readiness/src/service.ts"],
    scopeCapturedAt: fixedNow.toISOString()
  });
  const service = createDeploymentReadinessService({
    stagingDeploymentExecutionOptions: {
      humanSignoffs: Object.fromEntries(stagingSignoffRoles.map((role) => [
        role,
        humanSignoff(role, "approved", signoffScopePatch(reviewedScope))
      ])) as Partial<Record<StagingReleaseCandidateSignoffRole, StagingHumanSignoffEvidence>>
    },
    now: () => fixedNow
  });

  const review = service.getStagingHumanSignoffScopeReview(currentScope);
  const summary = service.getStagingDeploymentExecutionSummary();

  assert.equal(review.status, "stale");
  assert.equal(review.staleRoles.length, 6);
  assert.equal(review.pendingRoles.length, 0);
  assert.equal(review.approvalAuditCanPass, false);
  assert.equal(review.actualDeploymentBlocked, true);
  assert.equal(summary.actualDeploymentBlocked, true);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.stagingDeployed, false);
  assert.equal(hasSecretOrEnvValue({ review, summary }), false);
});

test("all six roles must have matching scope before approval audit can pass", () => {
  const currentScope = createStagingSignoffScopeSnapshot({
    reviewedCommitSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    reviewedBranch: "main",
    modifiedFiles: ["apps/api/src/main.ts"],
    diffNameStatus: ["M\tapps/api/src/main.ts"],
    scopeCapturedAt: fixedNow.toISOString()
  });
  const service = createDeploymentReadinessService({
    stagingDeploymentExecutionOptions: {
      humanSignoffs: Object.fromEntries(stagingSignoffRoles.map((role) => [
        role,
        humanSignoff(role, "approved", signoffScopePatch(currentScope))
      ])) as Partial<Record<StagingReleaseCandidateSignoffRole, StagingHumanSignoffEvidence>>
    },
    now: () => fixedNow
  });

  const review = service.getStagingHumanSignoffScopeReview(currentScope);
  const summary = service.getStagingDeploymentExecutionSummary();

  assert.equal(review.status, "matched");
  assert.equal(review.matchingRoleCount, 6);
  assert.equal(review.pendingRoles.length, 0);
  assert.equal(review.staleRoles.length, 0);
  assert.equal(review.rejectedRoles.length, 0);
  assert.equal(review.approvalAuditCanPass, true);
  assert.equal(summary.approvedSignoffCount, 6);
  assert.equal(summary.actualDeploymentBlocked, true);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.stagingDeployed, false);
  assert.equal(hasSecretOrEnvValue({ review, summary }), false);
});

test("staging signoff collection page records explicit approvals and rejections safely", async () => {
  await withApiServer(async (port) => {
    const page = await getText(port, "/staging/signoffs");
    assert.equal(page.statusCode, 200);
    assert.equal(page.contentType.includes("text/html"), true);
    assert.equal(page.body.includes("Staging Human Signoff Collection"), true);
    assert.equal(page.body.includes("Record Signoff"), true);
    assert.equal(page.body.includes("Current Repository Scope"), true);
    assert.equal(page.body.includes("reviewedScopeMethod="), true);
    assert.equal(page.body.includes("actualDeploymentBlocked=true"), true);

    const incomplete = await postJson(port, "/staging/signoffs/evidence", {
      role: "platform_owner",
      status: "approved",
      signatureMethod: "typed_name",
      reviewedEvidence: ["docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md"]
    });
    assert.equal(incomplete.statusCode, 400);
    assert.equal(incomplete.body.error, "invalid_staging_signoff_evidence");

    const approval = await postJson(port, "/staging/signoffs/evidence", {
      role: "engineering_owner",
      status: "approved",
      approverName: "Engineering Owner",
      signatureMethod: "typed_name",
      reviewedEvidence: ["docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md"],
      notes: "Reviewed staging signoff pack."
    });
    assert.equal(approval.statusCode, 201);
    assert.equal(typeof (approval.body.evidence as Record<string, unknown>).reviewedCommitSha, "string");
    assert.equal(typeof (approval.body.evidence as Record<string, unknown>).reviewedBranch, "string");
    assert.equal(["commit_sha", "explicit_diff_scope"].includes(String((approval.body.evidence as Record<string, unknown>).reviewedScopeMethod)), true);
    assert.equal(typeof (approval.body.evidence as Record<string, unknown>).scopeCapturedAt, "string");
    assert.equal((approval.body.evidence as Record<string, unknown>).scopeEvidencePath, "docs/roadmaps/staging-deployment-execution/signoff-scope-evidence-v0.md");
    assert.equal(Array.isArray((approval.body.evidence as Record<string, unknown>).validationEvidencePaths), true);
    assert.equal((approval.body.summary as Record<string, unknown>).approvedSignoffCount, 1);
    assert.equal((approval.body.summary as Record<string, unknown>).pendingSignoffCount, 5);
    assert.equal((approval.body.summary as Record<string, unknown>).actualDeploymentBlocked, true);
    assert.equal((approval.body.decision as Record<string, unknown>).status, "not_ready");
    assert.equal((approval.body.scopeReview as Record<string, unknown>).status, "pending");
    assert.equal((approval.body.scopeReview as Record<string, unknown>).matchingRoleCount, 1);
    assert.equal((approval.body.scopeReview as Record<string, unknown>).actualDeploymentBlocked, true);

    const rejection = await postJson(port, "/staging/signoffs/evidence", {
      role: "security_reviewer",
      status: "rejected",
      approverName: "Security Reviewer",
      signatureMethod: "ticket_comment",
      reviewedEvidence: ["docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md"],
      notes: "Rejected until the approval audit is rerun."
    });
    assert.equal(rejection.statusCode, 201);
    assert.equal((rejection.body.summary as Record<string, unknown>).approvedSignoffCount, 1);
    assert.equal((rejection.body.summary as Record<string, unknown>).rejectedSignoffCount, 1);
    assert.equal((rejection.body.summary as Record<string, unknown>).signoffStatus, "rejected");
    assert.equal((rejection.body.decision as Record<string, unknown>).status, "no_go");
    assert.equal((rejection.body.summary as Record<string, unknown>).actualDeploymentBlocked, true);

    const evidence = await getJson(port, "/staging/signoffs/evidence");
    assert.equal(evidence.statusCode, 200);
    assert.equal((evidence.body.evidence as unknown[]).length, 2);
    assert.equal(((evidence.body.summary as Record<string, unknown>).approvedSignoffCount), 1);
    assert.equal(((evidence.body.summary as Record<string, unknown>).rejectedSignoffCount), 1);
    assert.equal(typeof ((evidence.body.currentScope as Record<string, unknown>).reviewedCommitSha), "string");
    assert.equal((evidence.body.scopeReview as Record<string, unknown>).actualDeploymentBlocked, true);

    const summary = await getJson(port, "/readiness/staging-execution/summary");
    assert.equal((summary.body.summary as Record<string, unknown>).approvedSignoffCount, 1);
    assert.equal((summary.body.summary as Record<string, unknown>).rejectedSignoffCount, 1);
    assert.equal((summary.body.summary as Record<string, unknown>).actualDeploymentBlocked, true);
    assert.equal(hasSecretOrEnvValue({ page, incomplete, approval, rejection, evidence, summary }), false);
  });
});

test("web server exposes staging signoff collection on the dashboard port", async () => {
  await withWebServer(async (port) => {
    const page = await getText(port, "/staging/signoffs");
    assert.equal(page.statusCode, 200);
    assert.equal(page.contentType.includes("text/html"), true);
    assert.equal(page.body.includes("Staging Human Signoff Collection"), true);
    assert.equal(page.body.includes("Record Signoff"), true);
    assert.equal(page.body.includes("Current Repository Scope"), true);
    assert.equal(page.body.includes("reviewedScopeMethod="), true);
    assert.equal(page.body.includes("actualDeploymentBlocked=true"), true);

    const approval = await postJson(port, "/staging/signoffs/evidence", {
      role: "engineering_owner",
      status: "approved",
      approverName: "Engineering Owner",
      reviewedEvidence: ["docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md"],
      notes: "Reviewed through the web dashboard signoff page."
    });
    assert.equal(approval.statusCode, 201);
    assert.equal(typeof (approval.body.evidence as Record<string, unknown>).reviewedCommitSha, "string");
    assert.equal(["commit_sha", "explicit_diff_scope"].includes(String((approval.body.evidence as Record<string, unknown>).reviewedScopeMethod)), true);
    assert.equal((approval.body.evidence as Record<string, unknown>).signatureMethod, "typed_name");
    assert.equal((approval.body.evidence as Record<string, unknown>).scopeEvidencePath, "docs/roadmaps/staging-deployment-execution/signoff-scope-evidence-v0.md");
    assert.equal((approval.body.summary as Record<string, unknown>).approvedSignoffCount, 1);
    assert.equal((approval.body.summary as Record<string, unknown>).pendingSignoffCount, 5);
    assert.equal((approval.body.summary as Record<string, unknown>).actualDeploymentBlocked, true);

    const evidence = await getJson(port, "/staging/signoffs/evidence");
    assert.equal(evidence.statusCode, 200);
    assert.equal((evidence.body.evidence as unknown[]).length, 1);
    assert.equal((evidence.body.decision as Record<string, unknown>).status, "not_ready");
    assert.equal((evidence.body.scopeReview as Record<string, unknown>).status, "pending");
    assert.equal(hasSecretOrEnvValue({ page, approval, evidence }), false);
  });
});

test("staging execution APIs, dashboard panel, and health metadata are read-only and sanitized", async () => {
  await withApiServer(async (port) => {
    const plan = await getJson(port, "/readiness/staging-execution/plan");
    const steps = await getJson(port, "/readiness/staging-execution/steps");
    const gates = await getJson(port, "/readiness/staging-execution/gates?category=validation");
    const decision = await getJson(port, "/readiness/staging-execution/go-no-go");
    const rollback = await getJson(port, "/readiness/staging-execution/rollback");
    const summary = await getJson(port, "/readiness/staging-execution/summary");
    const health = await getJson(port, "/health");
    const dashboard = await getJson(port, "/dashboard/staging-execution");
    const writeAttempt = await postJson(port, "/readiness/staging-execution/summary");

    assert.equal(plan.statusCode, 200);
    assert.equal((plan.body.plan as Record<string, unknown>).id, "staging_deployment_execution_plan_v0");
    assert.equal(steps.statusCode, 200);
    assert.equal((steps.body.steps as unknown[]).length, 20);
    assert.equal(gates.statusCode, 200);
    assert.equal((gates.body.gates as Array<Record<string, unknown>>).every((gate) => gate.category === "validation"), true);
    assert.equal(decision.statusCode, 200);
    assert.equal((decision.body.decision as Record<string, unknown>).status, "not_ready");
    assert.equal(rollback.statusCode, 200);
    assert.equal(((rollback.body.rollback as Record<string, unknown>).rollbackSteps as unknown[]).length, 10);
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).status, "v0_implemented");
    assert.equal((summary.body.summary as Record<string, unknown>).signoffPackAvailable, true);
    assert.equal((summary.body.summary as Record<string, unknown>).requiredSignoffCount, 6);
    assert.equal((summary.body.summary as Record<string, unknown>).pendingSignoffCount, 6);
    assert.equal((summary.body.summary as Record<string, unknown>).approvedSignoffCount, 0);
    assert.equal((summary.body.summary as Record<string, unknown>).signoffStatus, "pending");
    assert.equal((summary.body.summary as Record<string, unknown>).actualDeploymentBlocked, true);
    assert.equal((summary.body.summary as Record<string, unknown>).deploymentExecuted, false);
    assert.equal((summary.body.summary as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).productionReady, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).stagingDeployed, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).deploymentExecuted, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).releaseCreated, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).gitTagCreated, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).signoffPackAvailable, true);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).requiredSignoffCount, 6);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).pendingSignoffCount, 6);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).approvedSignoffCount, 0);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).signoffStatus, "pending");
    assert.equal((health.body.stagingExecution as Record<string, unknown>).actualDeploymentBlocked, true);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).noSecretsExposed, true);
    assert.equal(dashboard.statusCode, 200);
    assert.equal(((dashboard.body.stagingExecution as Record<string, unknown>).signoffPack as Record<string, unknown>).status, "pending");
    assert.equal(((dashboard.body.stagingExecution as Record<string, unknown>).signoffPack as Record<string, unknown>).approvedRoleCount, 0);
    assert.equal(((dashboard.body.stagingExecution as Record<string, unknown>).signoffPack as Record<string, unknown>).actualDeploymentBlocked, true);
    assert.equal((dashboard.body.stagingExecution as Record<string, unknown>).noSecretStatus instanceof Object, true);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasSecretOrEnvValue({ plan, steps, gates, decision, rollback, summary, health, dashboard }), false);
  }, {
    AICHESTRA_DATABASE_URL: "postgres://user:password@example.invalid/aichestra",
    AICHESTRA_TEST_DATABASE_URL: "postgres://user:password@example.invalid/aichestra_test",
    GITHUB_TOKEN: "ghp_staging_token",
    GITHUB_APP_PRIVATE_KEY: "sk-staging-private-key",
    AICHESTRA_GITHUB_WEBHOOK_SECRET: "staging-webhook-secret",
    AICHESTRA_LLM_API_KEY: "sk-staging-llm",
    AICHESTRA_VAULT_TOKEN: "hvs.stagingtoken",
    SESSION_SECRET: "staging-session-secret",
    JWT_SECRET: "staging-jwt-secret"
  });
});

test("staging execution dashboard HTML renders planning status without secrets or deployment claims", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("Staging Deployment Execution Plan"), true);
  assert.equal(html.includes("Signoff pack"), true);
  assert.equal(html.includes("approved roles 0"), true);
  assert.equal(html.includes("Step sequence"), true);
  assert.equal(html.includes("Go/no-go decision"), true);
  assert.equal(html.includes("Optional integration decisions"), true);
  assert.equal(html.includes("Rollback readiness"), true);
  assert.equal(html.includes("deployment true"), false);
  assert.equal(html.includes("deployed true"), false);
  assert.equal(html.includes("Git tag created"), false);
  assert.equal(hasSecretOrEnvValue(html), false);
});

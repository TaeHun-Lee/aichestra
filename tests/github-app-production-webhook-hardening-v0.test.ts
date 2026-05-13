import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-13T00:00:00.000Z");

function hasUnsafeSecret(value: unknown): boolean {
  const text = JSON.stringify(value);
  return text.includes("ghp_") ||
    text.includes("github_pat_") ||
    text.includes("GITHUB_TOKEN=") ||
    text.includes("AICHESTRA_GITHUB_WEBHOOK_SECRET=") ||
    text.includes("GITHUB_APP_PRIVATE_KEY=") ||
    text.includes("-----BEGIN") ||
    text.includes("installation-token-secret") ||
    text.includes("webhook-secret-value") ||
    text.includes("auth.json");
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

function postJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "2"
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
    request.end("{}");
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

test("GitHub App planning models define least-privilege permissions and no production-ready claims", () => {
  const service = createDeploymentReadinessService({ now: () => fixedNow });
  const permissions = service.listGitHubAppPermissionMatrix();
  const summary = service.getGitHubWebhookHardeningSummary();
  const contentsWrite = permissions.find((entry) => entry.id === "permission_contents_write");

  assert.equal(summary.status, "v0_implemented");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.githubAppLiveEnabled, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(permissions.some((entry) => entry.githubPermissionName === "metadata" && entry.requiredLevel === "read"), true);
  assert.equal(contentsWrite?.requiredLevel, "write");
  assert.equal(contentsWrite?.requiredFor.includes("branch creation"), true);
  assert.equal(contentsWrite?.futureOnly, true);
  assert.equal(permissions.some((entry) => entry.githubPermissionName === "pull_requests" && entry.requiredLevel === "write"), true);
  assert.equal(permissions.some((entry) => entry.githubPermissionName === "workflows" && entry.requiredLevel === "none"), true);
  assert.equal(permissions.some((entry) => entry.githubPermissionName === "administration" && entry.requiredLevel === "none"), true);
  assert.equal(permissions.some((entry) => entry.githubPermissionName === "secrets" && entry.requiredLevel === "none"), true);
  assert.equal(permissions.some((entry) => entry.githubPermissionName === "deployments" && entry.requiredLevel === "none"), true);
  assert.equal(permissions.some((entry) => entry.requiredFor.toLowerCase().includes("merge")), false);
  assert.equal(hasUnsafeSecret({ summary, permissions }), false);
});

test("webhook event allowlist and replay classification stay read-model-only", () => {
  const service = createDeploymentReadinessService({ now: () => fixedNow });
  const events = service.listGitHubWebhookEventAllowlist();
  const first = service.classifyGitHubWebhookDelivery({
    deliveryId: "delivery-test",
    eventType: "pull_request",
    payloadHash: "sha256:first",
    signatureVerified: true,
    previousDeliveries: [],
    now: fixedNow
  });
  const duplicate = service.classifyGitHubWebhookDelivery({
    deliveryId: "delivery-test",
    eventType: "pull_request",
    payloadHash: "sha256:first",
    signatureVerified: true,
    previousDeliveries: [first],
    now: fixedNow
  });
  const replay = service.classifyGitHubWebhookDelivery({
    deliveryId: "delivery-test",
    eventType: "pull_request",
    payloadHash: "sha256:changed",
    signatureVerified: true,
    previousDeliveries: [first],
    now: fixedNow
  });

  assert.equal(events.some((event) => event.eventName === "ping" && event.supportStatus === "supported_now"), true);
  assert.equal(events.some((event) => event.eventName === "pull_request" && event.supportStatus === "supported_now"), true);
  assert.equal(events.some((event) => event.eventName === "installation" && event.supportStatus === "planned"), true);
  assert.equal(events.some((event) => event.eventName === "workflow_run" && event.supportStatus === "ignored"), true);
  assert.equal(events.some((event) => event.eventName === "deployment" && event.supportStatus === "denied"), true);
  assert.equal(events.every((event) => event.signatureVerificationRequired === true), true);
  assert.equal(events.flatMap((event) => event.sideEffects).some((effect) => effect.includes("merge") || effect.includes("delete_branch")), false);
  assert.equal(first.replayStatus, "first_seen");
  assert.equal(first.processingStatus, "pending");
  assert.equal(duplicate.replayStatus, "duplicate");
  assert.equal(duplicate.processingStatus, "ignored");
  assert.equal(replay.replayStatus, "replay_rejected");
  assert.equal(replay.processingStatus, "failed");
  assert.equal(hasUnsafeSecret({ events, first, duplicate, replay }), false);
});

test("GitHub App readiness APIs expose planning-only data and reject writes", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/github-app/summary");
    const permissions = await getJson(port, "/readiness/github-app/permissions");
    const events = await getJson(port, "/readiness/github-app/webhook-events");
    const replay = await getJson(port, "/readiness/github-app/replay-protection");
    const deadLetter = await getJson(port, "/readiness/github-app/dead-letter");
    const credentials = await getJson(port, "/readiness/github-app/credentials");
    const endpoint = await getJson(port, "/readiness/github-app/endpoint");
    const risks = await getJson(port, "/readiness/github-app/risks");
    const writeAttempt = await postJson(port, "/readiness/github-app/summary");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).productionReady, false);
    assert.equal((summary.body.summary as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).noSecretsExposed, true);
    assert.equal(permissions.statusCode, 200);
    assert.equal((permissions.body.permissions as Array<Record<string, unknown>>).some((entry) => entry.githubPermissionName === "workflows" && entry.requiredLevel === "none"), true);
    assert.equal(events.statusCode, 200);
    assert.equal((events.body.events as Array<Record<string, unknown>>).some((event) => event.eventName === "pull_request" && event.supportStatus === "supported_now"), true);
    assert.equal(replay.statusCode, 200);
    assert.equal((replay.body.plan as Record<string, unknown>).productionReady, false);
    assert.equal(deadLetter.statusCode, 200);
    assert.equal((deadLetter.body.plan as Record<string, unknown>).productionReady, false);
    assert.equal(credentials.statusCode, 200);
    assert.equal(endpoint.statusCode, 200);
    assert.equal((endpoint.body.endpoint as Record<string, unknown>).productionReady, false);
    assert.equal(risks.statusCode, 200);
    assert.equal((risks.body.risks as unknown[]).length > 0, true);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasUnsafeSecret({ summary, permissions, events, replay, deadLetter, credentials, endpoint, risks }), false);
  });
});

test("dashboard exposes GitHub App hardening panel without secrets or live integration", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/github-app");
    const panel = dashboard.body.githubApp as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal(((panel.noSecretStatus as Record<string, unknown>).noSecretsExposed), true);
    assert.equal(Array.isArray(panel.permissionMatrix), true);
    assert.equal(Array.isArray(panel.webhookEventAllowlist), true);
    assert.equal(Array.isArray(panel.blockers), true);
    assert.equal(hasUnsafeSecret(dashboard), false);
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("GitHub App / Webhook Hardening"), true);
  assert.equal(html.includes("production ready false"), true);
  assert.equal(html.includes("installation-token-secret"), false);
  assert.equal(html.includes("GITHUB_APP_PRIVATE_KEY"), false);
});

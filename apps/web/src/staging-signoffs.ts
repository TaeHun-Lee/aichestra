import type { IncomingMessage, ServerResponse } from "node:http";
import {
  captureLocalStagingSignoffScope,
  createDeploymentReadinessService,
  stagingDeploymentExecutionSummaryToDto,
  stagingDeploymentGoNoGoDecisionToDto,
  stagingHumanSignoffEvidenceToDto,
  stagingSignoffScopeEvidencePath,
  stagingSignoffValidationEvidencePaths,
  type DeploymentReadinessService,
  type StagingHumanSignoffEvidence,
  type StagingHumanSignoffStatus,
  type StagingReleaseCandidateSignoffRole,
  type StagingSignoffScopeReview,
  type StagingSignoffScopeSnapshot
} from "@aichestra/deployment-readiness";

type JsonValue = Record<string, unknown> | unknown[];

const stagingSignoffRoles: StagingReleaseCandidateSignoffRole[] = [
  "engineering_owner",
  "platform_owner",
  "security_reviewer",
  "product_owner",
  "qa_reviewer",
  "release_manager"
];

const stagingSignoffEvidencePaths = [
  "docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md",
  "docs/roadmaps/staging-deployment-execution/signoff-evidence-checklist-v0.md",
  "docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md",
  stagingSignoffScopeEvidencePath,
  "docs/audits/2026-05-14-staging-go-no-go-audit-v0.md",
  "docs/audits/2026-05-14-staging-release-candidate-audit-v0-rerun.md",
  "docs/audits/staging-rc-evidence-pack-v0.md",
  "docs/roadmaps/staging-release-candidate/release-notes-draft-v0.md",
  "docs/roadmaps/staging-release-candidate/rollback-evidence-v0.md",
  "docs/roadmaps/staging-deployment-execution/v0.md"
];

function sendJson(response: ServerResponse, statusCode: number, body: JsonValue): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function sendHtml(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
}

function sendRedirect(response: ServerResponse, location: string): void {
  response.writeHead(303, { location });
  response.end();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlValue(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return escapeHtml(fallback);
  if (Array.isArray(value)) return escapeHtml(value.map((item) => String(item)).join(", ") || fallback);
  return escapeHtml(String(value));
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function textArrayFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string" && value.trim().length > 0) return [value.trim()];
  return [];
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const raw = await readRawBody(request);
  if (raw.length === 0) return {};
  return JSON.parse(raw.toString("utf8"));
}

async function readRawBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readRequestBodyRecord(request: IncomingMessage): Promise<{ body: Record<string, unknown>; formEncoded: boolean }> {
  const contentType = request.headers["content-type"] ?? "";
  if (typeof contentType === "string" && contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams((await readRawBody(request)).toString("utf8"));
    const body: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) {
      const existing = body[key];
      if (existing === undefined) {
        body[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        body[key] = [existing, value];
      }
    }
    return { body, formEncoded: true };
  }
  return { body: recordValue(await readJson(request)), formEncoded: false };
}

function containsRawSecretField(body: Record<string, unknown>): boolean {
  return Object.entries(body).some(([key, value]) => {
    if (/^(value|secretValue|rawSecret|token|apiKey|credentialValue|password)$/i.test(key)) {
      return value !== undefined && value !== null && String(value).length > 0;
    }
    return typeof value === "string" && (/sk-[A-Za-z0-9_-]{8,}/.test(value) ||
      /ghp_[A-Za-z0-9_]{8,}/.test(value) ||
      /github_pat_[A-Za-z0-9_]{8,}/.test(value) ||
      /Bearer\s+[A-Za-z0-9._~+/=-]+/i.test(value) ||
      /[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*[^\s]+/i.test(value) ||
      /~\/\.codex\/auth\.json|~\/\.claude/i.test(value));
  });
}

function scopeFilesHtml(files: string[]): string {
  if (files.length === 0) return "<span>none</span>";
  return `<ul>${files.map((file) => `<li><code>${htmlValue(file)}</code></li>`).join("")}</ul>`;
}

function scopeRoleStatus(role: StagingReleaseCandidateSignoffRole, review: StagingSignoffScopeReview): string {
  if (review.rejectedRoles.includes(role)) return "rejected";
  if (review.staleRoles.includes(role)) return "stale";
  if (review.pendingRoles.includes(role)) return "pending";
  return "matched";
}

function stagingSignoffRoleValue(value: unknown): StagingReleaseCandidateSignoffRole | undefined {
  return stagingSignoffRoles.includes(value as StagingReleaseCandidateSignoffRole)
    ? value as StagingReleaseCandidateSignoffRole
    : undefined;
}

function stagingHumanSignoffStatusValue(value: unknown): StagingHumanSignoffStatus | undefined {
  return value === "approved" || value === "rejected" || value === "conditionally_approved" ? value : undefined;
}

function stagingHumanSignoffEvidenceFromBody(
  body: Record<string, unknown>,
  submittedAt: Date,
  currentScope: StagingSignoffScopeSnapshot
): { ok: true; evidence: StagingHumanSignoffEvidence } | { ok: false; error: string; message: string } {
  const role = stagingSignoffRoleValue(body.role);
  const status = stagingHumanSignoffStatusValue(body.status);
  if (!role) return { ok: false, error: "invalid_signoff_role", message: "role must be a required staging signoff role." };
  if (!status) return { ok: false, error: "invalid_signoff_status", message: "status must be approved, rejected, or conditionally_approved." };
  const reviewedEvidence = textArrayFromUnknown(body.reviewedEvidence);
  return {
    ok: true,
    evidence: {
      role,
      required: true,
      status,
      approverName: stringValue(body.approverName),
      approverContact: stringValue(body.approverContact),
      signedAt: stringValue(body.signedAt) ?? submittedAt.toISOString(),
      reviewedEvidence: reviewedEvidence.length > 0 ? reviewedEvidence : stagingSignoffEvidencePaths,
      reviewedCommitSha: currentScope.reviewedCommitSha,
      reviewedBranch: currentScope.reviewedBranch,
      reviewedScopeMethod: currentScope.reviewedScopeMethod,
      reviewedDiffScope: currentScope.reviewedDiffScope,
      scopeCapturedAt: currentScope.scopeCapturedAt,
      scopeEvidencePath: currentScope.scopeEvidencePath,
      validationEvidencePaths: currentScope.validationEvidencePaths,
      conditions: textArrayFromUnknown(body.conditions),
      notes: stringValue(body.notes),
      signatureMethod: stringValue(body.signatureMethod) ?? "typed_name",
      evidenceSource: stringValue(body.evidenceSource) ?? "staging_signoff_collection_ui",
      metadata: {
        submittedAt: submittedAt.toISOString(),
        submittedVia: "web_staging_signoff_collection_ui",
        localOnly: true,
        identityVerified: false,
        productionAuthImplemented: false,
        actualDeploymentAuthorized: false
      }
    }
  };
}

function renderStagingSignoffCollectionHtml(
  readiness: DeploymentReadinessService,
  currentScope: StagingSignoffScopeSnapshot,
  scopeReview: StagingSignoffScopeReview,
  message?: { kind: "ok" | "error"; text: string }
): string {
  const summary = readiness.getStagingDeploymentExecutionSummary();
  const decision = readiness.getStagingDeploymentGoNoGoDecision();
  const evidenceByRole = new Map(readiness.listStagingHumanSignoffEvidence().map((evidence) => [evidence.role, evidence]));
  const rows = stagingSignoffRoles.map((role) => {
    const evidence = evidenceByRole.get(role);
    return `<tr>
      <td><code>${htmlValue(role)}</code></td>
      <td>${htmlValue(evidence?.status ?? "pending")}</td>
      <td>${htmlValue(evidence?.approverName)}</td>
      <td>${htmlValue(evidence?.signedAt)}</td>
      <td>${htmlValue(scopeRoleStatus(role, scopeReview))}</td>
      <td>${htmlValue(evidence?.signatureMethod)}</td>
      <td>${htmlValue(evidence?.notes)}</td>
    </tr>`;
  }).join("");
  const evidenceChecks = stagingSignoffEvidencePaths.map((path) =>
    `<label class="check"><input type="checkbox" name="reviewedEvidence" value="${htmlValue(path)}" checked> <span>${htmlValue(path)}</span></label>`
  ).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Staging Human Signoff Collection</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #171a20; background: #f6f7fa; }
    body { margin: 0; }
    header { background: #ffffff; border-bottom: 1px solid #d9dee8; }
    main, .topbar { width: min(1120px, calc(100vw - 32px)); margin: 0 auto; }
    .topbar { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    nav { display: flex; gap: 14px; font-size: 14px; }
    a { color: #1b5d8f; text-decoration: none; }
    main { padding: 28px 0 42px; }
    h1 { margin: 0 0 18px; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 18px; letter-spacing: 0; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
    .metric, .panel { background: #ffffff; border: 1px solid #d9dee8; border-radius: 8px; }
    .metric { padding: 14px; }
    .label { color: #596372; font-size: 13px; margin-bottom: 7px; }
    .value { font-size: 24px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr); gap: 16px; align-items: start; }
    .panel { padding: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #edf0f5; vertical-align: top; }
    th { color: #596372; font-weight: 600; }
    form { display: grid; gap: 12px; }
    label { display: grid; gap: 6px; color: #313844; font-size: 14px; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #c9d1dc; border-radius: 6px; padding: 9px 10px; font: inherit; background: #ffffff; }
    textarea { min-height: 86px; resize: vertical; }
    button { border: 0; border-radius: 6px; background: #1f6f55; color: #ffffff; font-weight: 700; padding: 10px 14px; cursor: pointer; }
    .check { grid-template-columns: 20px minmax(0, 1fr); align-items: start; gap: 8px; color: #48505d; }
    .check input { width: 16px; margin-top: 2px; }
    .notice { margin-bottom: 16px; border-radius: 8px; padding: 12px 14px; border: 1px solid #d9dee8; background: #ffffff; }
    .notice.ok { border-color: #b8d9ca; background: #edf8f2; }
    .notice.error { border-color: #efb8b8; background: #fff0f0; }
    .safety { color: #596372; line-height: 1.45; }
    code { overflow-wrap: anywhere; }
    .scope-lists { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 12px; }
    .scope-lists ul { margin: 0; padding-left: 18px; color: #313844; }
    @media (max-width: 860px) { .metrics, .grid, .scope-lists { grid-template-columns: 1fr; } .topbar { align-items: flex-start; flex-direction: column; padding: 14px 0; } nav { flex-wrap: wrap; } }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <strong>Aichestra</strong>
      <nav>
        <a href="/">Dashboard</a>
        <a href="/staging/signoffs/evidence">Evidence JSON</a>
      </nav>
    </div>
  </header>
  <main>
    <h1>Staging Human Signoff Collection</h1>
    ${message ? `<div class="notice ${htmlValue(message.kind)}">${htmlValue(message.text)}</div>` : ""}
    <div class="metrics">
      <div class="metric"><div class="label">Decision</div><div class="value">${htmlValue(summary.goNoGoStatus)}</div></div>
      <div class="metric"><div class="label">Pending</div><div class="value">${htmlValue(summary.pendingSignoffCount)}</div></div>
      <div class="metric"><div class="label">Approved</div><div class="value">${htmlValue(summary.approvedSignoffCount)}</div></div>
      <div class="metric"><div class="label">Rejected</div><div class="value">${htmlValue(summary.rejectedSignoffCount)}</div></div>
    </div>
    <section class="panel" style="margin-bottom:16px">
      <h2>Current Repository Scope</h2>
      <div class="safety">
        HEAD=<code>${htmlValue(currentScope.reviewedCommitSha)}</code> /
        branch=<code>${htmlValue(currentScope.reviewedBranch)}</code> /
        worktree=${htmlValue(currentScope.reviewedDiffScope.worktreeStatus)} /
        reviewedScopeMethod=${htmlValue(currentScope.reviewedScopeMethod)} /
        scopeCapturedAt=${htmlValue(currentScope.scopeCapturedAt)} /
        scopeRevalidation=${htmlValue(scopeReview.status)}
      </div>
      <div class="scope-lists">
        <div><div class="label">Modified files</div>${scopeFilesHtml(currentScope.reviewedDiffScope.modifiedFiles)}</div>
        <div><div class="label">Untracked files</div>${scopeFilesHtml(currentScope.reviewedDiffScope.untrackedFiles)}</div>
      </div>
    </section>
    <div class="grid">
      <section class="panel">
        <h2>Required Roles</h2>
        <table>
          <thead><tr><th>Role</th><th>Status</th><th>Approver</th><th>Timestamp</th><th>Scope</th><th>Signature</th><th>Notes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
      <section class="panel">
        <h2>Record Signoff</h2>
        <form method="post" action="/staging/signoffs/evidence">
          <label>Role
            <select name="role" required>
              ${stagingSignoffRoles.map((role) => `<option value="${htmlValue(role)}">${htmlValue(role)}</option>`).join("")}
            </select>
          </label>
          <label>Decision
            <select name="status" required>
              <option value="approved">Approve</option>
              <option value="rejected">Reject</option>
              <option value="conditionally_approved">Conditionally approve</option>
            </select>
          </label>
          <label>Approver name<input name="approverName" autocomplete="name" required></label>
          <label>Approver contact<input name="approverContact" autocomplete="email"></label>
          <label>Signature method
            <select name="signatureMethod" required>
              <option value="typed_name">Typed name</option>
              <option value="ticket_comment">Ticket comment</option>
              <option value="meeting_record">Meeting record</option>
              <option value="email_approval">Email approval</option>
              <option value="other_recorded_method">Other recorded method</option>
            </select>
          </label>
          <label>Conditions<textarea name="conditions"></textarea></label>
          <label>Notes / rejection reason<textarea name="notes"></textarea></label>
          <div>
            <div class="label">Reviewed evidence</div>
            ${evidenceChecks}
          </div>
          <button type="submit">Record signoff</button>
        </form>
      </section>
    </div>
    <section class="panel" style="margin-top:16px">
      <h2>Safety State</h2>
      <div class="safety">
        actualDeploymentBlocked=${htmlValue(summary.actualDeploymentBlocked)} /
        productionReady=${htmlValue(summary.productionReady)} /
        stagingDeployed=${htmlValue(summary.stagingDeployed)} /
        deploymentExecuted=${htmlValue(summary.deploymentExecuted)} /
        scopeRevalidation=${htmlValue(scopeReview.status)} /
        approvalAuditCanPass=${htmlValue(scopeReview.approvalAuditCanPass)} /
        approvalAuditRequired=${htmlValue(summary.metadata.approvalAuditRequired, "true")} /
        blockers=${htmlValue(decision.blockers)}
      </div>
    </section>
  </main>
</body>
</html>`;
}

export function createStagingSignoffRouteHandler(readiness: DeploymentReadinessService = createDeploymentReadinessService()) {
  return async function handleStagingSignoffRoute(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
    const method = request.method ?? "GET";
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== "staging" || segments[1] !== "signoffs") return false;

    if (method === "GET" && segments.length === 2) {
      const currentScope = await captureLocalStagingSignoffScope({
        scopeEvidencePath: stagingSignoffScopeEvidencePath,
        validationEvidencePaths: stagingSignoffValidationEvidencePaths
      });
      const scopeReview = readiness.getStagingHumanSignoffScopeReview(currentScope);
      sendHtml(response, 200, renderStagingSignoffCollectionHtml(readiness, currentScope, scopeReview));
      return true;
    }
    if (method === "GET" && segments.length === 3 && segments[2] === "evidence") {
      const currentScope = await captureLocalStagingSignoffScope({
        scopeEvidencePath: stagingSignoffScopeEvidencePath,
        validationEvidencePaths: stagingSignoffValidationEvidencePaths
      });
      sendJson(response, 200, {
        evidence: readiness.listStagingHumanSignoffEvidence().map(stagingHumanSignoffEvidenceToDto),
        summary: stagingDeploymentExecutionSummaryToDto(readiness.getStagingDeploymentExecutionSummary()),
        decision: stagingDeploymentGoNoGoDecisionToDto(readiness.getStagingDeploymentGoNoGoDecision()),
        currentScope,
        scopeReview: readiness.getStagingHumanSignoffScopeReview(currentScope)
      });
      return true;
    }
    if (method === "POST" && segments.length === 3 && segments[2] === "evidence") {
      const { body, formEncoded } = await readRequestBodyRecord(request);
      if (containsRawSecretField(body)) {
        const message = "Signoff evidence must not include raw secrets, tokens, env values, or credential-cache paths.";
        if (formEncoded) {
          const currentScope = await captureLocalStagingSignoffScope({
            scopeEvidencePath: stagingSignoffScopeEvidencePath,
            validationEvidencePaths: stagingSignoffValidationEvidencePaths
          });
          sendHtml(response, 400, renderStagingSignoffCollectionHtml(
            readiness,
            currentScope,
            readiness.getStagingHumanSignoffScopeReview(currentScope),
            { kind: "error", text: message }
          ));
        } else {
          sendJson(response, 400, { error: "raw_secret_material_rejected", message });
        }
        return true;
      }
      const submittedAt = new Date();
      const currentScope = await captureLocalStagingSignoffScope({
        capturedAt: submittedAt,
        scopeEvidencePath: stagingSignoffScopeEvidencePath,
        validationEvidencePaths: stagingSignoffValidationEvidencePaths
      });
      const parsed = stagingHumanSignoffEvidenceFromBody(body, submittedAt, currentScope);
      if (!parsed.ok) {
        if (formEncoded) {
          sendHtml(response, 400, renderStagingSignoffCollectionHtml(
            readiness,
            currentScope,
            readiness.getStagingHumanSignoffScopeReview(currentScope),
            { kind: "error", text: parsed.message }
          ));
        } else {
          sendJson(response, 400, { error: parsed.error, message: parsed.message });
        }
        return true;
      }
      try {
        const evidence = readiness.recordStagingHumanSignoffEvidence(parsed.evidence);
        if (formEncoded) {
          sendRedirect(response, "/staging/signoffs");
        } else {
          sendJson(response, 201, {
            evidence: stagingHumanSignoffEvidenceToDto(evidence),
            summary: stagingDeploymentExecutionSummaryToDto(readiness.getStagingDeploymentExecutionSummary()),
            decision: stagingDeploymentGoNoGoDecisionToDto(readiness.getStagingDeploymentGoNoGoDecision()),
            currentScope,
            scopeReview: readiness.getStagingHumanSignoffScopeReview(currentScope)
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid staging signoff evidence.";
        if (formEncoded) {
          sendHtml(response, 400, renderStagingSignoffCollectionHtml(
            readiness,
            currentScope,
            readiness.getStagingHumanSignoffScopeReview(currentScope),
            { kind: "error", text: message }
          ));
        } else {
          sendJson(response, 400, { error: "invalid_staging_signoff_evidence", message });
        }
      }
      return true;
    }

    sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
      error: method === "GET" || method === "POST" ? "staging_signoff_route_not_found" : "method_not_allowed",
      message: "Staging signoff collection supports GET /staging/signoffs, GET /staging/signoffs/evidence, and POST /staging/signoffs/evidence."
    });
    return true;
  };
}

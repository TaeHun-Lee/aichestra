import http from "node:http";
import https from "node:https";

const baseUrl = process.env.AICHESTRA_API_BASE_URL ?? "http://127.0.0.1:3000";
const bearerToken = process.env.AICHESTRA_AUTH_BEARER_TOKEN;
const timeoutMs = Number(process.env.AICHESTRA_SMOKE_TIMEOUT_MS ?? "5000");

const checks = [
  { id: "health", path: "/health", requireOkStatus: true },
  { id: "production_foundation", path: "/readiness/production-foundation", requireOkStatus: false },
  { id: "auth_me", path: "/auth/me", requireOkStatus: true, auth: true }
];

if (!bearerToken) {
  console.error("AICHESTRA_AUTH_BEARER_TOKEN is required for the production foundation smoke test.");
  process.exit(1);
}

const results = [];
for (const check of checks) {
  const result = await requestJson(check.path, check.auth);
  results.push({
    id: check.id,
    statusCode: result.statusCode,
    ok: result.statusCode >= 200 && result.statusCode < 300,
    summary: summarize(check.id, result.body)
  });
}

const failed = results.filter((result) => !result.ok);
console.log(JSON.stringify({ baseUrl, results }, null, 2));
if (failed.length > 0) {
  process.exitCode = 1;
}

function requestJson(path, auth) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const client = url.protocol === "https:" ? https : http;
    const request = client.get({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      protocol: url.protocol,
      timeout: timeoutMs,
      headers: auth ? { authorization: `Bearer ${bearerToken}` } : {}
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(text) });
        } catch {
          resolve({ statusCode: response.statusCode ?? 0, body: { parseError: true } });
        }
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error(`Smoke check timed out after ${timeoutMs}ms: ${path}`));
    });
    request.on("error", reject);
  });
}

function summarize(id, body) {
  if (id === "health") {
    return {
      status: body.status,
      storageKind: body.storage?.kind,
      productionFoundationStatus: body.productionFoundation?.status,
      operationalStatus: body.productionFoundation?.operationalStatus
    };
  }
  if (id === "production_foundation") {
    const summary = body.summary ?? {};
    return {
      status: summary.status,
      operationalStatus: summary.operationalStatus,
      blockerCount: Array.isArray(summary.blockers) ? summary.blockers.length : 0,
      operationalBlockerCount: Array.isArray(summary.operationalBlockers) ? summary.operationalBlockers.length : 0
    };
  }
  if (id === "auth_me") {
    return {
      authenticated: body.authContext?.authenticated,
      authMode: body.authContext?.authMode,
      productionAuthEnabled: body.requestContext?.productionAuthEnabled
    };
  }
  return {};
}

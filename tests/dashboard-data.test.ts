import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardData } from "../apps/web/lib/mock-data.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

test("dashboard data exposes conflict manager v1 simulation assumptions", async () => {
  const data = await getDashboardData();

  assert.equal(data.activeLeases.length, 2);
  assert.equal(data.conflictRisks.length, 1);
  assert.equal(data.mergeQueue.length, 2);
  assert.equal(data.mergeSimulations.length, 2);
  assert.equal(data.registryOverview.activeSkills, 3);
  assert.equal(data.registryOverview.activeHarnesses, 3);
  assert.equal(data.registryOverview.activeInstructions, 3);
  assert.equal(Array.isArray(data.registryAuditLogs), true);
  assert.equal(data.registryApprovalQueue.some((item) => item.targetName === "auth-debugging"), true);
  assert.equal(data.registryRevisions.length >= 2, true);
  assert.equal(data.registryEvalResults.some((result) => result.evalName === "mock harness smoke"), true);
  assert.equal(data.registryPackages.some((manifest) => manifest.packageKind === "bundle"), true);
  assert.equal(data.registryVersionResolution.selected?.version, "1.0.0");
  assert.equal(data.registryPackageDiff.summary.includes("changed"), true);
  assert.equal(data.mergeQueue.every((entry) => entry.simulationStatus === "clean"), true);
  assert.equal(data.mergeQueue.some((entry) => entry.recommendation === "manual_review_required"), true);
  assert.equal(data.taskRuns.every((run) => (run.selectedSkillRefs?.length ?? 0) > 0), true);
  assert.equal(data.taskRuns.every((run) => run.selectedHarnessRef !== undefined), true);
});

test("rendered dashboard shows dry-run merge simulation status, queue recommendation, and registry data", async () => {
  const html = await renderDashboardHtml();

  assert.equal(html.includes("Dry-run Merge Simulations"), true);
  assert.equal(html.includes("safe_to_queue"), true);
  assert.equal(html.includes("manual_review_required"), true);
  assert.equal(html.includes("clean"), true);
  assert.equal(html.includes("Registry selection"), true);
  assert.equal(html.includes("auth-debugging"), true);
  assert.equal(html.includes("backend-node20"), true);
  assert.equal(html.includes("org-secure-coding-baseline"), true);
  assert.equal(html.includes("approval approved"), true);
  assert.equal(html.includes("checksum unverified"), true);
  assert.equal(html.includes("Registry Audit"), true);
  assert.equal(html.includes("Approval Queue"), true);
  assert.equal(html.includes("rollback is available through the API"), true);
  assert.equal(html.includes("Mock harness smoke eval passed."), true);
  assert.equal(html.includes("Registry Packages"), true);
  assert.equal(html.includes("Version resolution"), true);
  assert.equal(html.includes("Package diff"), true);
});

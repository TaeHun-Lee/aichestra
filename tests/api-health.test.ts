import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { sha256Checksum } from "@aichestra/registry";

function getJson(port: number, path: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, path: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized)
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(serialized);
  });
}

function postJsonWithStatus(port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized)
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

function patchJsonWithStatus(port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized)
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

test("API health returns the expected service payload", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const body = await getJson(address.port, "/health");
    assert.equal(body.status, "ok");
    assert.equal(body.service, "aichestra-api");
    assert.equal((body.storage as { kind: string; healthy: boolean }).kind, "in_memory");
    assert.equal((body.storage as { kind: string; healthy: boolean }).healthy, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("API returns 409 when a task already has an active run", async () => {
  const store = createSeededStore();
  const server = createApiServer(store);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const created = await postJson(address.port, "/tasks", {
      title: "Fix login timeout bug",
      repoId: "repo_demo_backend",
      targetBranch: "main"
    }) as { id: string };
    const activeRun = store.createTaskRun({
      taskId: created.id,
      attempt: 1,
      status: "running",
      agent: "codex",
      model: "mock-model"
    });

    const response = await postJsonWithStatus(address.port, `/tasks/${created.id}/run`);

    assert.equal(response.statusCode, 409);
    assert.equal(response.body.error, "conflict");
    assert.equal((response.body.message as string).includes(activeRun.id), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("API creates and runs a task through the mock vertical slice", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const created = await postJson(address.port, "/tasks", {
      title: "Fix login timeout bug",
      description: "Investigate and fix intermittent login timeout failures.",
      repoId: "repo_demo_backend",
      requestedBy: "user_demo_admin",
      preferredAgent: "mock-codex",
      targetBranch: "main",
      selectedModel: "mock-model",
      selectedSkillIds: ["skill_auth_debugging"],
      selectedHarnessId: "harness_backend_node20",
      budgetLimitUsd: 20
    });
    const task = created as { id: string; state: string };
    assert.equal(task.state, "draft");

    const run = await postJson(address.port, `/tasks/${task.id}/run`);
    assert.equal((run.task as { state: string }).state, "completed");
    assert.equal((run.result as { diffSummary: string }).diffSummary, "2 files changed, 18 insertions, 4 deletions");

    const usage = await getJson(address.port, `/usage?taskId=${task.id}`);
    assert.equal((usage.usageEvents as unknown[]).length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("API exposes registry lists, creation, status updates, and resolution", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const skills = await getJson(address.port, "/registry/skills") as { skills: { name: string; version: string; status: string }[] };
    const harnesses = await getJson(address.port, "/registry/harnesses") as { harnesses: { name: string; version: string; status: string }[] };
    const instructions = await getJson(address.port, "/registry/instructions") as { instructions: { name: string; version: string; status: string }[] };

    assert.equal(skills.skills.some((skill) => skill.name === "auth-debugging" && skill.version === "1.0.0"), true);
    assert.equal(harnesses.harnesses.some((harness) => harness.name === "backend-node20" && harness.status === "active"), true);
    assert.equal(instructions.instructions.some((instruction) => instruction.name === "org-secure-coding-baseline"), true);

    const createdSkill = await postJson(address.port, "/registry/skills", {
      name: "docs-polisher",
      version: "1.0.0",
      description: "Improve short documentation changes.",
      status: "draft",
      owner: "platform",
      compatibleAgents: ["codex"],
      compatibleModels: ["mock-model"],
      requiredTools: ["git"],
      requiredHarnesses: ["backend-node20"],
      invocationRules: ["Select for documentation-only polish tasks."],
      evalRefs: [],
      tags: ["docs"]
    }) as { skill: { name: string; status: string } };
    assert.equal(createdSkill.skill.name, "docs-polisher");
    assert.equal(createdSkill.skill.status, "draft");

    const invalidStatus = await patchJsonWithStatus(address.port, "/registry/skills/skill_auth_debugging/status", { status: "approved" });
    assert.equal(invalidStatus.statusCode, 400);
    assert.equal(invalidStatus.body.error, "invalid_status");

    const updatedStatus = await patchJsonWithStatus(address.port, "/registry/skills/skill_auth_debugging/status", { status: "deprecated" });
    assert.equal(updatedStatus.statusCode, 200);
    assert.equal(((updatedStatus.body.skill as Record<string, unknown>).status), "deprecated");

    const task = await postJson(address.port, "/tasks", {
      title: "Review conflict risk for auth files",
      repoId: "repo_demo_backend",
      targetBranch: "main"
    }) as { id: string };
    const resolution = await postJson(address.port, "/registry/resolve", { taskId: task.id }) as {
      resolution: {
        selectedSkills: { name: string; version: string }[];
        selectedHarness: { name: string; version: string };
        selectedInstructions: { name: string; version: string }[];
      };
    };

    assert.equal(resolution.resolution.selectedSkills.some((skill) => skill.name === "conflict-risk-reviewer"), true);
    assert.equal(resolution.resolution.selectedHarness.name, "backend-node20");
    assert.equal(resolution.resolution.selectedInstructions.some((instruction) => instruction.name === "org-secure-coding-baseline"), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("API exposes registry hardening audit, approval, eval, and checksum endpoints", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const approval = await patchJsonWithStatus(address.port, "/registry/skills/skill_auth_debugging/approval", {
      approvalStatus: "pending",
      reason: "needs review"
    });
    const evalUpdate = await patchJsonWithStatus(address.port, "/registry/skills/skill_auth_debugging/eval", {
      evalStatus: "failed",
      reason: "eval regression"
    });
    const invalidApproval = await patchJsonWithStatus(address.port, "/registry/skills/skill_auth_debugging/approval", {
      approvalStatus: "approved-ish"
    });
    const createdInstruction = await postJson(address.port, "/registry/instructions", {
      name: "api-body-checksum",
      version: "1.0.0",
      description: "API checksum verification fixture.",
      status: "active",
      approvalStatus: "approved",
      evalStatus: "passed",
      owner: "platform",
      type: "custom",
      scope: "repo",
      body: "api body",
      checksum: sha256Checksum("api body"),
      precedence: 99,
      appliesToAgents: ["codex"],
      appliesToRepos: ["repo_demo_backend"],
      appliesToDirectories: [],
      maxContextBytes: 2048
    }) as { instruction: { id: string; checksumStatus: string } };
    const verified = await postJson(address.port, `/registry/instructions/${createdInstruction.instruction.id}/verify-checksum`) as {
      instruction: { checksumStatus: string };
    };
    const audit = await getJson(address.port, "/registry/audit?targetKind=skill&targetId=skill_auth_debugging") as {
      auditLogs: { action: string; targetKind: string }[];
    };

    assert.equal(approval.statusCode, 200);
    assert.equal((approval.body.skill as { approvalStatus: string }).approvalStatus, "pending");
    assert.equal(evalUpdate.statusCode, 200);
    assert.equal((evalUpdate.body.skill as { evalStatus: string }).evalStatus, "failed");
    assert.equal(invalidApproval.statusCode, 400);
    assert.equal(invalidApproval.body.error, "invalid_approval_status");
    assert.equal(createdInstruction.instruction.checksumStatus, "unverified");
    assert.equal(verified.instruction.checksumStatus, "verified");
    assert.equal(audit.auditLogs.some((log) => log.action === "update" || log.action === "mark_eval_failed"), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("API exposes registry v2 history, rollback, approval queue, and eval result endpoints", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const approval = await patchJsonWithStatus(address.port, "/registry/skills/skill_auth_debugging/approval", {
      approvalStatus: "pending",
      reason: "needs queue visibility"
    });
    const history = await getJson(address.port, "/registry/skills/skill_auth_debugging/history") as {
      revisions: { revisionNumber: number; snapshotChecksum: string }[];
    };
    const queue = await getJson(address.port, "/registry/approval-queue") as {
      approvalQueue: { targetName: string; approvalStatus: string; recommendedAction: string }[];
    };
    const evalAttach = await postJsonWithStatus(address.port, "/registry/skills/skill_auth_debugging/eval-results", {
      evalName: "api manual eval",
      evalType: "manual",
      status: "passed",
      summary: "API-attached eval metadata.",
      source: "manual",
      updateEvalStatus: true
    });
    const evalResults = await getJson(address.port, "/registry/skills/skill_auth_debugging/eval-results") as {
      evalResults: { evalName: string; status: string }[];
    };
    const rollback = await postJsonWithStatus(address.port, "/registry/skills/skill_auth_debugging/rollback", {
      revisionNumber: 1,
      reason: "restore before Phase 3 v2 API test mutation"
    });
    const invalidRollback = await postJsonWithStatus(address.port, "/registry/skills/skill_auth_debugging/rollback", {
      revisionNumber: 999,
      reason: "bad revision"
    });
    const invalidEval = await postJsonWithStatus(address.port, "/registry/skills/skill_auth_debugging/eval-results", {
      evalName: "bad",
      evalType: "remote",
      status: "passed",
      summary: "bad",
      source: "manual"
    });

    assert.equal(approval.statusCode, 200);
    assert.equal(history.revisions.length, 2);
    assert.equal(history.revisions[0]?.revisionNumber, 1);
    assert.equal(history.revisions[0]?.snapshotChecksum.startsWith("sha256:"), true);
    assert.equal(queue.approvalQueue.some((item) => item.targetName === "auth-debugging" && item.approvalStatus === "pending"), true);
    assert.equal(evalAttach.statusCode, 201);
    assert.equal(evalResults.evalResults.some((item) => item.evalName === "api manual eval" && item.status === "passed"), true);
    assert.equal(rollback.statusCode, 200);
    assert.equal(((rollback.body.skill as Record<string, unknown>).approvalStatus), "approved");
    assert.equal(invalidRollback.statusCode, 400);
    assert.equal(invalidRollback.body.error, "rollback_failed");
    assert.equal(invalidEval.statusCode, 400);
    assert.equal(invalidEval.body.error, "invalid_eval_result");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("API exposes active leases, conflict risks, and merge queue actions", async () => {
  const store = createSeededStore();
  const server = createApiServer(store);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const firstTask = await postJson(address.port, "/tasks", {
      title: "Fix auth session timeout",
      repoId: "repo_demo_backend",
      targetBranch: "main"
    }) as { id: string };
    const secondTask = await postJson(address.port, "/tasks", {
      title: "Update auth session refresh",
      repoId: "repo_demo_backend",
      targetBranch: "main"
    }) as { id: string };

    const firstRun = await postJson(address.port, `/tasks/${firstTask.id}/run`) as { result: { taskRunId: string } };
    const secondRun = await postJson(address.port, `/tasks/${secondTask.id}/run`) as { result: { taskRunId: string }; task: { state: string } };

    const leases = await getJson(address.port, "/branches/leases?repoId=repo_demo_backend&status=active") as { branchLeases: { id: string; taskRunId: string }[] };
    const repoRisks = await getJson(address.port, "/conflicts/risks?repoId=repo_demo_backend") as { conflictRisks: { riskScore: number; riskLevel: string }[] };
    const runRisks = await getJson(address.port, `/conflicts/risks?taskRunId=${secondRun.result.taskRunId}`) as { conflictRisks: unknown[] };
    const queue = await getJson(address.port, "/merge-queue?repoId=repo_demo_backend") as { mergeQueue: { id: string; taskRunId: string; status: string; riskScore: number }[] };
    const firstQueueEntry = queue.mergeQueue.find((entry) => entry.taskRunId === firstRun.result.taskRunId);
    const secondLease = leases.branchLeases.find((lease) => lease.taskRunId === secondRun.result.taskRunId);
    assert.ok(firstQueueEntry);
    assert.ok(secondLease);

    const originalAllowedRepoPaths = process.env.AICHESTRA_ALLOWED_REPO_PATHS;
    process.env.AICHESTRA_ALLOWED_REPO_PATHS = "/tmp/aichestra-allowed-only";
    const rejectedLocalSimulation = await postJson(address.port, "/merge-simulations", {
      branchLeaseId: secondLease.id,
      mode: "local_git_merge_tree",
      repoPath: "/etc"
    }) as { error: string };
    if (originalAllowedRepoPaths === undefined) {
      delete process.env.AICHESTRA_ALLOWED_REPO_PATHS;
    } else {
      process.env.AICHESTRA_ALLOWED_REPO_PATHS = originalAllowedRepoPaths;
    }

    const simulation = await postJson(address.port, "/merge-simulations", {
      branchLeaseId: secondLease.id,
      status: "text_conflict"
    }) as { mergeSimulation: { status: string; conflictingFiles: string[] }; mergeQueue: { simulationStatus?: string; recommendation?: string }[] };
    const simulations = await getJson(address.port, `/merge-simulations?branchLeaseId=${secondLease.id}`) as { mergeSimulations: { status: string }[] };
    const queueAfterSimulation = await getJson(address.port, "/merge-queue?repoId=repo_demo_backend") as { mergeQueue: { taskRunId: string; simulationStatus?: string; recommendation?: string }[] };

    const merged = await postJson(address.port, `/merge-queue/${firstQueueEntry.id}/mark-merged`) as { mergeQueueEntry: { status: string } };
    const activeAfterMerge = await getJson(address.port, "/branches/leases?repoId=repo_demo_backend&status=active") as { branchLeases: unknown[] };

    assert.equal(secondRun.task.state, "review_required");
    assert.equal(leases.branchLeases.length, 2);
    assert.equal(repoRisks.conflictRisks[0]?.riskScore, 0.9);
    assert.equal(repoRisks.conflictRisks[0]?.riskLevel, "critical");
    assert.equal(runRisks.conflictRisks.length, 1);
    assert.equal(queue.mergeQueue.some((entry) => entry.status === "blocked" && entry.riskScore === 0.9), true);
    assert.equal(rejectedLocalSimulation.error, "repo_path_not_allowlisted");
    assert.equal(simulation.mergeSimulation.status, "text_conflict");
    assert.equal(simulation.mergeSimulation.conflictingFiles.includes("src/auth/session.ts"), true);
    assert.equal(simulation.mergeQueue[0]?.recommendation, "conflict_detected");
    assert.equal(simulations.mergeSimulations[0]?.status, "text_conflict");
    assert.equal(queueAfterSimulation.mergeQueue.some((entry) => entry.taskRunId === secondRun.result.taskRunId && entry.simulationStatus === "text_conflict"), true);
    assert.equal(merged.mergeQueueEntry.status, "merged");
    assert.equal(activeAfterMerge.branchLeases.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

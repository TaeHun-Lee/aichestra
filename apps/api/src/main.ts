import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { AichestraError, NotFoundError, isTaskStatus } from "@aichestra/core";
import type { BranchLeaseStatus, MergeSimulationMode, MergeSimulationStatus, Task } from "@aichestra/core";
import type { TaskStatus } from "@aichestra/core";
import { InMemoryAichestraStore, createSeededStore } from "@aichestra/db";
import { LocalGitDryRunMergeSimulator, MockMergeSimulator } from "@aichestra/git-adapter";
import {
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
import { runAgentTaskWorkflow } from "@aichestra/worker";

type RouteContext = {
  store: InMemoryAichestraStore;
  registryService: RegistryService;
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

async function handleRequest(request: IncomingMessage, response: ServerResponse, context: RouteContext): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean);
    const method = request.method ?? "GET";
    const store = context.store;
    const registryService = context.registryService;

    if (method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "aichestra-api" });
      return;
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
      if (method === "GET" && segments[2] === "runs") {
        sendJson(response, 200, { taskRuns: store.listTaskRuns(task.id) });
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
  const registryService = createRegistryService({
    skillRepository: store,
    harnessRepository: store,
    instructionRepository: store,
    auditRepository: {
      appendAuditLog: (input) => store.appendAuditLog(input),
      listAuditLogs: () => store.listRegistryAuditLogs(),
      listAuditLogsForTarget: (targetKind, targetId) => store.listAuditLogsForTarget(targetKind, targetId)
    },
    historyRepository: store,
    evalResultRepository: store,
    packageRepository: store,
    repoRoot: process.cwd()
  });
  return createServer((request, response) => {
    void handleRequest(request, response, { store, registryService });
  });
}

function isMain(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMain()) {
  const host = process.env.AICHESTRA_API_HOST ?? "127.0.0.1";
  const port = Number(process.env.AICHESTRA_API_PORT ?? "3000");
  createApiServer().listen(port, host, () => {
    console.log(`aichestra-api listening on http://${host}:${port}`);
  });
}

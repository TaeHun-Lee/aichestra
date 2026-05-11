import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createId, riskContributionForSimulationStatus } from "@aichestra/core";
import type { MergeSimulationRequest, MergeSimulator } from "@aichestra/core";
import type { MergeSimulationResult, MergeSimulationStatus } from "@aichestra/core";

const execFileAsync = promisify(execFile);
const outputLimit = 2000;

function sanitizeOutput(value: string | undefined, repoPath?: string): string | undefined {
  if (!value) return undefined;
  let sanitized = value
    .replace(/\r/g, "")
    .slice(0, outputLimit);
  if (repoPath) {
    const normalizedPath = repoPath.replaceAll("\\", "/");
    sanitized = sanitized
      .replaceAll(repoPath, "<repoPath>")
      .replaceAll(normalizedPath, "<repoPath>");
  }
  return sanitized;
}

function resultFromStatus(input: MergeSimulationRequest, status: MergeSimulationStatus, patch: Partial<MergeSimulationResult> = {}): MergeSimulationResult {
  const riskContribution = patch.riskContribution ?? riskContributionForSimulationStatus(status);

  return {
    id: patch.id ?? createId("merge_sim"),
    repoId: input.repoId,
    repoPath: input.repoPath,
    baseRef: input.baseRef,
    sourceRef: input.sourceRef,
    targetRef: input.targetRef,
    taskRunId: input.taskRunId,
    branchLeaseId: input.branchLeaseId,
    mode: input.mode,
    status,
    conflictingFiles: patch.conflictingFiles ?? [],
    changedFiles: patch.changedFiles ?? [],
    summary: patch.summary ?? `Mock merge simulation returned ${status}.`,
    rawCommandMetadata: patch.rawCommandMetadata,
    riskContribution,
    createdAt: patch.createdAt ?? new Date()
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function parseNameOnly(stdout: string): string[] {
  return uniqueSorted(stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
}

function parseConflictFiles(output: string): string[] {
  const files: string[] = [];
  for (const line of output.split(/\r?\n/)) {
    const stagedMatch = line.match(/^\d{6}\s+[0-9a-f]{40}\s+\d\t(.+)$/);
    if (stagedMatch?.[1]) {
      files.push(stagedMatch[1]);
      continue;
    }

    const conflictMatch = line.match(/^CONFLICT \([^)]+\): .* in (.+)$/);
    if (conflictMatch?.[1]) {
      files.push(conflictMatch[1]);
    }
  }
  return uniqueSorted(files);
}

async function git(repoPath: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync("git", ["-C", repoPath, ...args], {
      encoding: "utf8",
      windowsHide: true
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0
    };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
      exitCode: typeof execError.code === "number" ? execError.code : 1
    };
  }
}

export class MockMergeSimulator implements MergeSimulator {
  private status: MergeSimulationStatus;

  constructor(status: MergeSimulationStatus = "clean") {
    this.status = status;
  }

  async simulate(input: MergeSimulationRequest): Promise<MergeSimulationResult> {
    const status = input.requestedStatus ?? (input.sourceRef.includes("conflict") ? "text_conflict" : this.status);
    const conflictingFiles = status === "text_conflict" ? ["src/auth/session.ts"] : [];
    const changedFiles = status === "unavailable" ? [] : ["src/auth/session.ts", "tests/auth/session.test.ts"];

    return resultFromStatus(input, status, {
      conflictingFiles,
      changedFiles,
      summary: `Mock merge simulation for ${input.sourceRef} returned ${status}.`,
      rawCommandMetadata: {
        command: "mock merge simulation",
        exitCode: status === "failed" ? 1 : 0
      }
    });
  }
}

export class LocalGitDryRunMergeSimulator implements MergeSimulator {
  async simulate(input: MergeSimulationRequest): Promise<MergeSimulationResult> {
    if (!input.repoPath) {
      return resultFromStatus(input, "unavailable", {
        summary: "Local git dry-run merge simulation requires repoPath.",
        rawCommandMetadata: {
          command: "git merge-tree --write-tree",
          exitCode: 1,
          stderr: "repoPath is required"
        }
      });
    }

    const insideWorkTree = await git(input.repoPath, ["rev-parse", "--is-inside-work-tree"]);
    if (insideWorkTree.exitCode !== 0 || insideWorkTree.stdout.trim() !== "true") {
      return resultFromStatus(input, "unavailable", {
        summary: "Path is not a git work tree.",
        rawCommandMetadata: {
          command: "git rev-parse --is-inside-work-tree",
          exitCode: insideWorkTree.exitCode,
          stdout: sanitizeOutput(insideWorkTree.stdout, input.repoPath),
          stderr: sanitizeOutput(insideWorkTree.stderr, input.repoPath)
        }
      });
    }

    const targetRef = input.targetRef ?? input.baseRef;
    const sourceDiff = await git(input.repoPath, ["diff", "--name-only", input.baseRef, input.sourceRef]);
    const targetDiff = await git(input.repoPath, ["diff", "--name-only", input.baseRef, targetRef]);
    const changedFiles = uniqueSorted([
      ...parseNameOnly(sourceDiff.stdout),
      ...parseNameOnly(targetDiff.stdout)
    ]);

    const mergeTree = await git(input.repoPath, ["merge-tree", "--write-tree", targetRef, input.sourceRef]);
    const combinedOutput = `${mergeTree.stdout}\n${mergeTree.stderr}`;
    const conflictingFiles = parseConflictFiles(combinedOutput);

    if (mergeTree.exitCode === 0) {
      return resultFromStatus(input, "clean", {
        changedFiles,
        summary: `Local git dry-run merge simulation was clean for ${input.sourceRef} into ${targetRef}.`,
        rawCommandMetadata: {
          command: "git merge-tree --write-tree <targetRef> <sourceRef>",
          exitCode: mergeTree.exitCode,
          stdout: sanitizeOutput(mergeTree.stdout, input.repoPath),
          stderr: sanitizeOutput(mergeTree.stderr, input.repoPath)
        }
      });
    }

    if (conflictingFiles.length > 0 || combinedOutput.includes("CONFLICT")) {
      return resultFromStatus(input, "text_conflict", {
        conflictingFiles,
        changedFiles,
        summary: `Local git dry-run merge simulation found text conflicts for ${input.sourceRef} into ${targetRef}.`,
        rawCommandMetadata: {
          command: "git merge-tree --write-tree <targetRef> <sourceRef>",
          exitCode: mergeTree.exitCode,
          stdout: sanitizeOutput(mergeTree.stdout, input.repoPath),
          stderr: sanitizeOutput(mergeTree.stderr, input.repoPath)
        }
      });
    }

    return resultFromStatus(input, "failed", {
      changedFiles,
      summary: `Local git dry-run merge simulation failed for ${input.sourceRef} into ${targetRef}.`,
      rawCommandMetadata: {
        command: "git merge-tree --write-tree <targetRef> <sourceRef>",
        exitCode: mergeTree.exitCode,
        stdout: sanitizeOutput(mergeTree.stdout, input.repoPath),
        stderr: sanitizeOutput(mergeTree.stderr, input.repoPath)
      }
    });
  }
}

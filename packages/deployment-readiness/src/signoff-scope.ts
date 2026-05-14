import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import type {
  StagingHumanSignoffEvidence,
  StagingSignoffReviewedDiffScope,
  StagingSignoffScopeSnapshot
} from "./types.ts";

const execFileAsync = promisify(execFile);
const gitCommandTimeoutMs = 5000;
const maxGitOutputBuffer = 16 * 1024 * 1024;
const credentialCachePathPattern = /(^|[\s\\/])(?:\.codex[\\/]auth\.json|\.claude(?:[\\/]|$)|application_default_credentials\.json|credential-cache|credentials-cache)(?:$|[\s\\/])/iu;

export const stagingSignoffScopeEvidencePath = "docs/roadmaps/staging-deployment-execution/signoff-scope-evidence-v0.md";
export const stagingSignoffValidationEvidencePaths = [
  "docs/audits/2026-05-15-staging-deployment-approval-audit-v0.md",
  "docs/roadmaps/staging-deployment-execution/signoff-scope-evidence-v0.md",
  "docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md",
  "docs/roadmaps/staging-deployment-execution/signoff-evidence-checklist-v0.md",
  "docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md"
];

type GitScopeCommandResult = {
  stdout: string;
};

export type LocalStagingSignoffScopeCaptureOptions = {
  cwd?: string;
  capturedAt?: Date;
  scopeEvidencePath?: string;
  validationEvidencePaths?: string[];
};

export type StagingSignoffScopeSnapshotInput = {
  reviewedCommitSha: string;
  reviewedBranch: string;
  modifiedFiles?: string[];
  untrackedFiles?: string[];
  diffNameStatus?: string[];
  diffStat?: string[];
  diffContentHashes?: string[];
  scopeCapturedAt?: string;
  scopeEvidencePath?: string;
  validationEvidencePaths?: string[];
};

function stableUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function redactCredentialCachePath(value: string): string {
  return credentialCachePathPattern.test(value) ? "[redacted-credential-cache-path]" : value;
}

function cleanScopeValues(values: string[]): string[] {
  return stableUnique(values.map(redactCredentialCachePath));
}

function outputLines(value: string): string[] {
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function statusOutputLines(value: string): string[] {
  return value.split(/\r?\n/u).map((line) => line.trimEnd()).filter(Boolean);
}

function parseStatusPath(line: string): string | undefined {
  if (line.length < 4) return undefined;
  return line.slice(3).trim();
}

function parseModifiedFiles(statusLines: string[]): string[] {
  return cleanScopeValues(statusLines
    .filter((line) => !line.startsWith("?? "))
    .map(parseStatusPath)
    .filter((value): value is string => value !== undefined));
}

function parseUntrackedFiles(statusLines: string[]): string[] {
  return cleanScopeValues(statusLines
    .filter((line) => line.startsWith("?? "))
    .map(parseStatusPath)
    .filter((value): value is string => value !== undefined));
}

function hashParts(parts: string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function buildDiffScopeHash(input: {
  reviewedCommitSha: string;
  reviewedBranch: string;
  modifiedFiles: string[];
  untrackedFiles: string[];
  diffNameStatus: string[];
  diffStat: string[];
  diffContentHashes?: string[];
}): string {
  return hashParts([
    input.reviewedCommitSha,
    input.reviewedBranch,
    ...input.modifiedFiles.map((file) => `modified:${file}`),
    ...input.untrackedFiles.map((file) => `untracked:${file}`),
    ...input.diffNameStatus.map((line) => `name-status:${line}`),
    ...input.diffStat.map((line) => `stat:${line}`),
    ...(input.diffContentHashes ?? []).map((line) => `content-hash:${line}`)
  ]);
}

export function createStagingSignoffScopeSnapshot(input: StagingSignoffScopeSnapshotInput): StagingSignoffScopeSnapshot {
  const modifiedFiles = cleanScopeValues(input.modifiedFiles ?? []);
  const untrackedFiles = cleanScopeValues(input.untrackedFiles ?? []);
  const diffNameStatus = cleanScopeValues(input.diffNameStatus ?? []);
  const diffStat = cleanScopeValues(input.diffStat ?? []);
  const worktreeStatus = modifiedFiles.length > 0 || untrackedFiles.length > 0 ? "dirty" : "clean";
  const diffScope: StagingSignoffReviewedDiffScope = {
    worktreeStatus,
    modifiedFiles,
    untrackedFiles,
    diffNameStatus,
    diffStat,
    diffScopeHash: buildDiffScopeHash({
      reviewedCommitSha: input.reviewedCommitSha,
      reviewedBranch: input.reviewedBranch,
      modifiedFiles,
      untrackedFiles,
      diffNameStatus,
      diffStat,
      diffContentHashes: input.diffContentHashes
    })
  };
  return {
    reviewedCommitSha: input.reviewedCommitSha,
    reviewedBranch: input.reviewedBranch,
    reviewedScopeMethod: worktreeStatus === "clean" ? "commit_sha" : "explicit_diff_scope",
    reviewedDiffScope: diffScope,
    scopeCapturedAt: input.scopeCapturedAt ?? new Date().toISOString(),
    scopeEvidencePath: input.scopeEvidencePath ?? stagingSignoffScopeEvidencePath,
    validationEvidencePaths: stableUnique(input.validationEvidencePaths ?? stagingSignoffValidationEvidencePaths)
  };
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: maxGitOutputBuffer,
    timeout: gitCommandTimeoutMs,
    windowsHide: true
  }) as GitScopeCommandResult;
  return result.stdout;
}

async function safeGit(cwd: string, args: string[]): Promise<string> {
  try {
    return await git(cwd, args);
  } catch {
    return "";
  }
}

export async function captureLocalStagingSignoffScope(
  options: LocalStagingSignoffScopeCaptureOptions = {}
): Promise<StagingSignoffScopeSnapshot> {
  const cwd = options.cwd ?? process.cwd();
  const capturedAt = options.capturedAt ?? new Date();
  const reviewedCommitSha = (await git(cwd, ["rev-parse", "HEAD"])).trim();
  const reviewedBranch = (await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  const statusLines = statusOutputLines(await safeGit(cwd, ["status", "--porcelain=v1", "--untracked-files=all"]));
  const modifiedFiles = parseModifiedFiles(statusLines);
  const untrackedFiles = parseUntrackedFiles(statusLines);
  const unstagedNameStatus = outputLines(await safeGit(cwd, ["diff", "--name-status", "--"]));
  const stagedNameStatus = outputLines(await safeGit(cwd, ["diff", "--cached", "--name-status", "--"]));
  const diffNameStatus = stableUnique([
    ...statusLines,
    ...unstagedNameStatus,
    ...stagedNameStatus,
    ...untrackedFiles.map((file) => `??\t${file}`)
  ]);
  const diffStat = stableUnique([
    ...outputLines(await safeGit(cwd, ["diff", "--stat", "--"])),
    ...outputLines(await safeGit(cwd, ["diff", "--cached", "--stat", "--"])),
    untrackedFiles.length > 0 ? `untracked files: ${untrackedFiles.length}` : ""
  ].map(redactCredentialCachePath));

  return createStagingSignoffScopeSnapshot({
    reviewedCommitSha,
    reviewedBranch,
    modifiedFiles,
    untrackedFiles,
    diffNameStatus,
    diffStat,
    scopeCapturedAt: capturedAt.toISOString(),
    scopeEvidencePath: options.scopeEvidencePath,
    validationEvidencePaths: options.validationEvidencePaths
  });
}

export function signoffEvidenceHasScope(evidence: StagingHumanSignoffEvidence): boolean {
  return Boolean(
    evidence.reviewedCommitSha &&
    evidence.reviewedBranch &&
    evidence.reviewedScopeMethod &&
    evidence.reviewedDiffScope &&
    evidence.scopeCapturedAt &&
    evidence.scopeEvidencePath &&
    Array.isArray(evidence.validationEvidencePaths) &&
    evidence.validationEvidencePaths.length > 0
  );
}

export function signoffEvidenceScopeMatches(
  evidence: StagingHumanSignoffEvidence,
  currentScope: StagingSignoffScopeSnapshot
): boolean {
  if (!signoffEvidenceHasScope(evidence)) return false;
  return evidence.reviewedCommitSha === currentScope.reviewedCommitSha &&
    evidence.reviewedBranch === currentScope.reviewedBranch &&
    evidence.reviewedScopeMethod === currentScope.reviewedScopeMethod &&
    evidence.reviewedDiffScope?.worktreeStatus === currentScope.reviewedDiffScope.worktreeStatus &&
    evidence.reviewedDiffScope?.diffScopeHash === currentScope.reviewedDiffScope.diffScopeHash;
}

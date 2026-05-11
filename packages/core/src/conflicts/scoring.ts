import type {
  BranchLease,
  ConflictRecommendation,
  ConflictRisk,
  ConflictRiskLevel,
  MergeQueueRecommendation,
  MergeQueueStatus,
  MergeSimulationResult
} from "../domain/models.ts";

export type ConflictFileCategory = "critical" | "package" | "test" | "docs" | "source";

export type MergeQueueRiskDecision = {
  status: Extract<MergeQueueStatus, "ready" | "blocked">;
  reasons: string[];
  blockingReasons: string[];
  recommendation: MergeQueueRecommendation;
};

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "").toLowerCase();
}

function firstSegment(filePath: string): string {
  return normalizePath(filePath).split("/")[0] ?? "";
}

function hasSegment(filePath: string, segment: string): boolean {
  return normalizePath(filePath).split("/").includes(segment);
}

function isPackageFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return normalized === "package.json"
    || normalized === "pnpm-lock.yaml"
    || normalized === "yarn.lock"
    || normalized === "package-lock.json";
}

function isCriticalFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return normalized.startsWith(".github/workflows/")
    || normalized.startsWith("infra/")
    || normalized.startsWith("infrastructure/")
    || normalized.startsWith("terraform/")
    || normalized.startsWith("migrations/")
    || normalized.startsWith("db/migrations/")
    || normalized === "prisma/schema.prisma"
    || normalized.startsWith("schema/")
    || normalized.startsWith("auth/")
    || normalized.startsWith("security/")
    || hasSegment(normalized, "auth")
    || hasSegment(normalized, "security");
}

function isTestFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return normalized.includes(".test.")
    || normalized.includes(".spec.")
    || normalized.includes("/__tests__/")
    || normalized.startsWith("__tests__/")
    || normalized.startsWith("tests/")
    || normalized.startsWith("test/");
}

function isDocsFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return normalized.startsWith("docs/") || normalized.endsWith(".md");
}

export function classifyConflictFile(filePath: string): ConflictFileCategory {
  if (isPackageFile(filePath)) return "package";
  if (isTestFile(filePath)) return "test";
  if (isDocsFile(filePath)) return "docs";
  if (isCriticalFile(filePath)) return "critical";
  return "source";
}

export function conflictRiskLevel(score: number): ConflictRiskLevel {
  if (score === 0) return "none";
  if (score < 0.35) return "low";
  if (score < 0.65) return "medium";
  if (score < 0.85) return "high";
  return "critical";
}

export function conflictRecommendation(score: number): ConflictRecommendation {
  if (score === 0) return "safe";
  if (score < 0.35) return "monitor";
  if (score < 0.65) return "serialize";
  if (score < 0.85) return "block";
  return "human_review";
}

export function riskContributionForSimulationStatus(status: MergeSimulationResult["status"]): number {
  if (status === "clean") return 0.1;
  if (status === "text_conflict") return 0.8;
  if (status === "failed" || status === "unavailable") return 0.35;
  return 0;
}

function recommendationForRisk(score: number, reasons: string[]): ConflictRecommendation {
  if (score === 0 || (reasons.length === 1 && reasons[0] === "docs_file_overlap")) return "safe";
  if (score <= 0.1 && reasons.includes("dry_run_merge_clean")) return "safe";
  if (reasons.includes("same_top_level_directory_activity") || (reasons.length === 1 && reasons[0] === "test_file_overlap")) return "monitor";
  return conflictRecommendation(score);
}

function sortedOverlap(source: string[], target: string[]): string[] {
  const targetSet = new Set(target.map(normalizePath));
  return [...new Set(source.map(normalizePath).filter((file) => targetSet.has(file)))].sort();
}

function sameDirectoryRisk(source: string[], target: string[]): boolean {
  const directories = new Set(source.map(firstSegment).filter(Boolean));
  for (const directory of directories) {
    const sourceCount = source.filter((file) => firstSegment(file) === directory).length;
    const targetCount = target.filter((file) => firstSegment(file) === directory).length;
    if (targetCount > 0 && sourceCount + targetCount >= 3) {
      return true;
    }
  }
  return false;
}

export function computePairRiskScore(source: BranchLease, target: BranchLease): { overlapFiles: string[]; riskScore: number; reasons: string[] } {
  const overlapFiles = sortedOverlap(source.files, target.files);
  const reasons: string[] = [];
  let riskScore = 0;

  if (overlapFiles.length === 0) {
    if (sameDirectoryRisk(source.files, target.files)) {
      return {
        overlapFiles,
        riskScore: 0.35,
        reasons: ["same_top_level_directory_activity"]
      };
    }

    return {
      overlapFiles,
      riskScore: 0,
      reasons: ["no_overlap"]
    };
  }

  const categories = new Set(overlapFiles.map(classifyConflictFile));

  if (categories.has("critical")) {
    riskScore = Math.max(riskScore, 0.9);
    reasons.push("critical_path_overlap");
  }
  if (categories.has("package")) {
    riskScore = Math.max(riskScore, 0.75);
    reasons.push("package_or_lockfile_overlap");
  }
  if (categories.has("source")) {
    riskScore = Math.max(riskScore, 0.6);
    reasons.push("source_file_overlap");
  }
  if (categories.has("test")) {
    riskScore = Math.max(riskScore, 0.3);
    reasons.push("test_file_overlap");
  }
  if (categories.has("docs")) {
    riskScore = Math.max(riskScore, 0.1);
    reasons.push("docs_file_overlap");
  }

  return {
    overlapFiles,
    riskScore,
    reasons
  };
}

function combineSimulationRisk(
  riskScore: number,
  reasons: string[],
  simulation?: Pick<MergeSimulationResult, "status" | "riskContribution" | "summary">
): { riskScore: number; reasons: string[] } {
  if (!simulation) {
    return { riskScore, reasons };
  }

  const contribution = simulation.riskContribution;
  if (simulation.status === "clean") {
    return {
      riskScore: Math.max(riskScore, contribution),
      reasons: [...reasons.filter((reason) => reason !== "no_overlap"), "dry_run_merge_clean"]
    };
  }

  if (simulation.status === "text_conflict") {
    return {
      riskScore: Math.max(riskScore, contribution),
      reasons: [...reasons.filter((reason) => reason !== "no_overlap"), "dry_run_text_conflict"]
    };
  }

  return {
    riskScore: Math.max(riskScore, contribution),
    reasons: [...reasons.filter((reason) => reason !== "no_overlap"), `dry_run_${simulation.status}`]
  };
}

export function createConflictRisk(
  source: BranchLease,
  target: BranchLease,
  computedAt: Date = new Date(),
  simulation?: Pick<MergeSimulationResult, "status" | "riskContribution" | "summary">
): ConflictRisk {
  const [left, right] = source.id <= target.id ? [source, target] : [target, source];
  const scored = computePairRiskScore(left, right);
  const combined = combineSimulationRisk(scored.riskScore, scored.reasons, simulation);

  return {
    id: `risk_${left.id}_${right.id}`,
    repoId: left.repoId,
    sourceLeaseId: left.id,
    targetLeaseId: right.id,
    sourceTaskRunId: left.taskRunId,
    targetTaskRunId: right.taskRunId,
    overlapFiles: scored.overlapFiles,
    riskScore: combined.riskScore,
    riskLevel: conflictRiskLevel(combined.riskScore),
    reasons: combined.reasons,
    recommendation: recommendationForRisk(combined.riskScore, combined.reasons),
    simulationStatus: simulation?.status,
    simulationRiskContribution: simulation?.riskContribution,
    simulationSummary: simulation?.summary,
    computedAt
  };
}

export function mergeQueueDecision(
  riskScore: number,
  simulation?: Pick<MergeSimulationResult, "status" | "summary">
): MergeQueueRiskDecision {
  if (simulation?.status === "text_conflict") {
    return {
      status: "blocked",
      reasons: ["dry_run_text_conflict"],
      blockingReasons: ["conflict_detected"],
      recommendation: "conflict_detected"
    };
  }

  if (simulation?.status === "unavailable") {
    return {
      status: riskScore >= 0.5 ? "blocked" : "ready",
      reasons: ["dry_run_unavailable"],
      blockingReasons: riskScore >= 0.5 ? ["simulation_unavailable"] : [],
      recommendation: "simulation_unavailable"
    };
  }

  if (simulation?.status === "failed") {
    return {
      status: riskScore >= 0.5 ? "blocked" : "ready",
      reasons: ["dry_run_failed"],
      blockingReasons: riskScore >= 0.5 ? ["simulation_failed"] : [],
      recommendation: "manual_review_required"
    };
  }

  if (riskScore < 0.5) {
    return {
      status: "ready",
      reasons: riskScore === 0 ? ["no_active_overlap"] : ["low_conflict_risk"],
      blockingReasons: [],
      recommendation: simulation?.status === "clean" ? "safe_to_queue" : "ready_for_review"
    };
  }

  if (riskScore < 0.85) {
    return {
      status: "blocked",
      reasons: ["serialize_with_overlapping_branch"],
      blockingReasons: ["serialize_with_overlapping_branch"],
      recommendation: "requires_rebase"
    };
  }

  return {
    status: "blocked",
    reasons: ["human_review_required_for_critical_overlap"],
    blockingReasons: ["human_review_required_for_critical_overlap"],
    recommendation: "manual_review_required"
  };
}

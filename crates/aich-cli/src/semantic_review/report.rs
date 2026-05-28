use aich_core::{
    ChangeManifest, ChangedFile, CheckResult, CheckResultStatus, MergeAttempt, SemanticRiskLevel,
};
use aich_llm::{LocalSemanticReviewReport, ProposedPatch, SemanticConflictFinding};

use crate::command_line::ProcessCommandSpec;
use crate::manifest::{
    changed_files_missing_from_manifest, parse_manifest_diff_evidence, shared_contract_files,
};
use crate::CHANGE_MANIFEST_VALIDATION_STATUS;

pub(crate) fn build_local_semantic_review_report(
    manifest: &ChangeManifest,
    manifest_content: Option<&str>,
    manifest_hash_mismatch: bool,
    attempt: &MergeAttempt,
    changed_files: &[ChangedFile],
    check_results: &[CheckResult],
) -> LocalSemanticReviewReport {
    let mut findings = Vec::new();
    let mut required_actions = Vec::new();
    let mut suggested_tests = Vec::new();
    let mut uncertainty = vec![
        "The MVP local reviewer does not build a call graph or run a remote LLM provider."
            .to_string(),
        "Clean Git merge and passing checks do not prove business-level correctness.".to_string(),
    ];

    if manifest_content.is_none() {
        findings.push(SemanticConflictFinding {
            conflict_type: "manifest_mismatch".to_string(),
            files: vec![manifest.manifest_path.clone()],
            explanation: "The Change Manifest artifact recorded in the ledger is missing."
                .to_string(),
            confidence: "high".to_string(),
        });
        required_actions
            .push("Restore or regenerate the Change Manifest before approval.".to_string());
    }

    if manifest_hash_mismatch {
        findings.push(SemanticConflictFinding {
            conflict_type: "manifest_mismatch".to_string(),
            files: vec![manifest.manifest_path.clone()],
            explanation: "The Change Manifest artifact hash no longer matches the ledger record."
                .to_string(),
            confidence: "high".to_string(),
        });
        required_actions.push(
            "Inspect the manifest artifact for drift and regenerate completion evidence if needed."
                .to_string(),
        );
    }

    let manifest_evidence = manifest_content.and_then(|content| {
        match parse_manifest_diff_evidence(content) {
            Ok(evidence) => Some(evidence),
            Err(error) => {
                findings.push(SemanticConflictFinding {
                    conflict_type: "manifest_mismatch".to_string(),
                    files: vec![manifest.manifest_path.clone()],
                    explanation: format!(
                        "The Change Manifest could not be parsed as structured YAML diff evidence: {error}"
                    ),
                    confidence: "high".to_string(),
                });
                required_actions.push(
                    "Fix or regenerate the Change Manifest so changed files are listed in the structured YAML fields."
                        .to_string(),
                );
                None
            }
        }
    });
    let missing_manifest_files =
        changed_files_missing_from_manifest(changed_files, manifest_evidence.as_ref());
    if !missing_manifest_files.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "manifest_mismatch".to_string(),
            files: missing_manifest_files.clone(),
            explanation: "Actual changed files are not all represented in the Change Manifest."
                .to_string(),
            confidence: "high".to_string(),
        });
        required_actions.push(
            "Update the Change Manifest so it matches the actual diff before approval.".to_string(),
        );
    }

    if changed_files.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "unknown".to_string(),
            files: Vec::new(),
            explanation: "No changed-file evidence is available for this candidate.".to_string(),
            confidence: "high".to_string(),
        });
        required_actions
            .push("Re-run session completion so changed-file evidence is recorded.".to_string());
    }

    let failed_required_checks: Vec<String> = check_results
        .iter()
        .filter(|check| check.required && check.result == CheckResultStatus::Failed)
        .map(|check| check.name.clone())
        .collect();
    let failed_optional_checks: Vec<String> = check_results
        .iter()
        .filter(|check| !check.required && check.result == CheckResultStatus::Failed)
        .map(|check| check.name.clone())
        .collect();
    if !attempt.checks_passed || !failed_required_checks.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "test_gap".to_string(),
            files: Vec::new(),
            explanation: format!(
                "The verified candidate does not have a clean required check gate: {}",
                failed_required_checks.join(", ")
            ),
            confidence: "high".to_string(),
        });
        required_actions.push("Fix failing checks and run `aich preflight` again.".to_string());
    }
    if !failed_optional_checks.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "test_gap".to_string(),
            files: Vec::new(),
            explanation: format!(
                "Optional check(s) failed but did not block the preflight gate: {}",
                failed_optional_checks.join(", ")
            ),
            confidence: "medium".to_string(),
        });
        suggested_tests.push(
            "Review failed optional checks before approval if they cover relevant behavior."
                .to_string(),
        );
    }

    if check_results.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "test_gap".to_string(),
            files: Vec::new(),
            explanation: "No preflight check results are recorded for this merge attempt."
                .to_string(),
            confidence: "medium".to_string(),
        });
        required_actions.push("Run preflight with configured checks before approval.".to_string());
    }

    let shared_contract_files = shared_contract_files(changed_files);
    if !shared_contract_files.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "api_contract_change".to_string(),
            files: shared_contract_files.clone(),
            explanation:
                "The candidate touches shared API, schema, dependency, config, or migration surfaces."
                    .to_string(),
            confidence: "medium".to_string(),
        });
        required_actions.push(
            "Confirm compatibility assumptions and dependent call sites before approval."
                .to_string(),
        );
        suggested_tests.push(
            "Run targeted tests around the touched shared contract or config surface.".to_string(),
        );
    }

    if manifest.validation_status == CHANGE_MANIFEST_VALIDATION_STATUS {
        uncertainty.push(
            "The Change Manifest was generated from diff metadata, so intent details may be incomplete."
                .to_string(),
        );
    }

    suggested_tests.extend(check_results.iter().map(|check| {
        format!(
            "Keep `{}` green for the verified sandbox tree.",
            check.command
        )
    }));
    if suggested_tests.is_empty() {
        suggested_tests
            .push("Run the target repo's configured test/typecheck/lint gate.".to_string());
    }

    let risk_level = if findings.iter().any(|finding| {
        finding.confidence == "high"
            && matches!(
                finding.conflict_type.as_str(),
                "manifest_mismatch" | "unknown"
            )
    }) || !failed_required_checks.is_empty()
        || !attempt.checks_passed
    {
        SemanticRiskLevel::Blocked
    } else if !shared_contract_files.is_empty() {
        SemanticRiskLevel::High
    } else if manifest.validation_status == CHANGE_MANIFEST_VALIDATION_STATUS
        || check_results.is_empty()
    {
        SemanticRiskLevel::Medium
    } else {
        SemanticRiskLevel::Low
    };

    let summary = match risk_level {
        SemanticRiskLevel::Blocked => {
            "Semantic review found blocking evidence gaps or manifest/check mismatches.".to_string()
        }
        SemanticRiskLevel::High => {
            "No blocking evidence gap was found, but the candidate touches shared contract surfaces."
                .to_string()
        }
        SemanticRiskLevel::Medium => {
            "No direct blocker was found; review remains conservative because intent is generated from diff evidence."
                .to_string()
        }
        SemanticRiskLevel::Low => {
            "No direct semantic conflict was found from recorded manifest, diff, and check evidence."
                .to_string()
        }
    };

    LocalSemanticReviewReport {
        risk_level,
        summary,
        suspected_conflicts: findings,
        required_actions,
        suggested_tests,
        proposed_patch: ProposedPatch::unavailable(),
        uncertainty,
    }
}

pub(super) fn command_semantic_review_failure_report(
    summary: &str,
    detail: String,
    command_spec: &ProcessCommandSpec,
) -> LocalSemanticReviewReport {
    LocalSemanticReviewReport {
        risk_level: SemanticRiskLevel::Blocked,
        summary: summary.to_string(),
        suspected_conflicts: vec![SemanticConflictFinding {
            conflict_type: "reviewer_failure".to_string(),
            files: Vec::new(),
            explanation: detail.clone(),
            confidence: "high".to_string(),
        }],
        required_actions: vec![format!(
            "Fix semantic_review.command `{}` or switch semantic_review.adapter back to local, then rerun `aich review`.",
            command_spec.display()
        )],
        suggested_tests: Vec::new(),
        proposed_patch: ProposedPatch::unavailable(),
        uncertainty: vec![detail],
    }
}

pub(super) fn llm_semantic_review_failure_report(
    summary: &str,
    detail: String,
    provider: &str,
    command_spec: &ProcessCommandSpec,
) -> LocalSemanticReviewReport {
    LocalSemanticReviewReport {
        risk_level: SemanticRiskLevel::Blocked,
        summary: summary.to_string(),
        suspected_conflicts: vec![SemanticConflictFinding {
            conflict_type: "llm_reviewer_failure".to_string(),
            files: Vec::new(),
            explanation: detail.clone(),
            confidence: "high".to_string(),
        }],
        required_actions: vec![format!(
            "Fix semantic_review LLM provider `{provider}` command `{}` or switch semantic_review.adapter back to local, then rerun `aich review`.",
            command_spec.display()
        )],
        suggested_tests: Vec::new(),
        proposed_patch: ProposedPatch::unavailable(),
        uncertainty: vec![detail],
    }
}

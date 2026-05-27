use std::path::Path;

use aich_core::{
    ChangeManifest, ChangedFile, CheckResult, CheckResultStatus, MergeAttempt, Operator, PatchSet,
    SemanticRiskLevel, Session,
};

use crate::command_line::ProcessCommandSpec;
use crate::formatting::yaml_quote;
use crate::manifest::{
    changed_files_missing_from_manifest, parse_manifest_diff_evidence, shared_contract_files,
};
use crate::CHANGE_MANIFEST_VALIDATION_STATUS;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct SemanticConflictFinding {
    pub(crate) conflict_type: String,
    pub(crate) files: Vec<String>,
    pub(crate) explanation: String,
    pub(crate) confidence: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct LocalSemanticReviewReport {
    pub(crate) risk_level: SemanticRiskLevel,
    pub(crate) summary: String,
    pub(crate) suspected_conflicts: Vec<SemanticConflictFinding>,
    pub(crate) required_actions: Vec<String>,
    pub(crate) suggested_tests: Vec<String>,
    pub(crate) uncertainty: Vec<String>,
}

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

    let failed_checks: Vec<String> = check_results
        .iter()
        .filter(|check| check.result == CheckResultStatus::Failed)
        .map(|check| check.name.clone())
        .collect();
    if !attempt.checks_passed || !failed_checks.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "test_gap".to_string(),
            files: Vec::new(),
            explanation: format!(
                "The verified candidate does not have a clean check gate: {}",
                failed_checks.join(", ")
            ),
            confidence: "high".to_string(),
        });
        required_actions.push("Fix failing checks and run `aich preflight` again.".to_string());
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
    }) || !failed_checks.is_empty()
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
        uncertainty,
    }
}

pub(crate) struct SemanticReviewInput<'a> {
    pub(crate) reviewer_id: &'a str,
    pub(crate) llm_executed: bool,
    pub(crate) session: &'a Session,
    pub(crate) attempt: &'a MergeAttempt,
    pub(crate) manifest: &'a ChangeManifest,
    pub(crate) manifest_content: Option<&'a str>,
    pub(crate) patch_set: Option<&'a PatchSet>,
    pub(crate) changed_files: &'a [ChangedFile],
    pub(crate) check_results: &'a [CheckResult],
    pub(crate) config_path: &'a Path,
    pub(crate) prompt_path: &'a str,
    pub(crate) prompt_content: Option<&'a str>,
}

pub(super) fn render_semantic_review_input(input: SemanticReviewInput<'_>) -> String {
    let mut output = String::new();
    output.push_str("# Semantic Review Input\n\n");
    output.push_str(&format!("- reviewer: `{}`\n", input.reviewer_id));
    output.push_str(&format!("- llm_executed: `{}`\n", input.llm_executed));
    output.push_str(&format!("- session_id: `{}`\n", input.session.id));
    output.push_str(&format!("- goal: `{}`\n", input.session.goal));
    output.push_str(&format!("- merge_attempt_id: `{}`\n", input.attempt.id));
    output.push_str(&format!(
        "- verified_tree_id: `{}`\n",
        input.attempt.verified_tree_id.as_deref().unwrap_or("")
    ));
    output.push_str(&format!(
        "- verified_commit_id: `{}`\n",
        input.attempt.verified_commit_id.as_deref().unwrap_or("")
    ));
    output.push_str(&format!(
        "- config_path: `{}`\n",
        input.config_path.display()
    ));
    output.push_str(&format!("- prompt_path: `{}`\n", input.prompt_path));
    output.push_str("\n## Change Manifest\n\n");
    output.push_str(&format!("- id: `{}`\n", input.manifest.id));
    output.push_str(&format!("- path: `{}`\n", input.manifest.manifest_path));
    output.push_str(&format!(
        "- validation_status: `{}`\n\n",
        input.manifest.validation_status
    ));
    match input.manifest_content {
        Some(content) => {
            output.push_str("```yaml\n");
            output.push_str(content);
            if !content.ends_with('\n') {
                output.push('\n');
            }
            output.push_str("```\n\n");
        }
        None => output.push_str("_Manifest artifact could not be read._\n\n"),
    }

    output.push_str("## Diff Evidence\n\n");
    if let Some(patch_set) = input.patch_set {
        output.push_str(&format!("- patch_set_id: `{}`\n", patch_set.id));
        output.push_str(&format!("- base_commit: `{}`\n", patch_set.base_commit));
        output.push_str(&format!(
            "- head_commit: `{}`\n",
            patch_set.head_commit.as_deref().unwrap_or("")
        ));
        if let Some(diff_stat) = patch_set.diff_stat.as_deref() {
            output.push_str("\n```text\n");
            output.push_str(diff_stat);
            if !diff_stat.ends_with('\n') {
                output.push('\n');
            }
            output.push_str("```\n");
        }
    } else {
        output.push_str("_No patch set evidence is recorded._\n");
    }

    output.push_str("\n## Changed Files\n\n");
    if input.changed_files.is_empty() {
        output.push_str("- none recorded\n");
    } else {
        for file in input.changed_files {
            output.push_str(&format!("- `{}` ({})\n", file.path, file.change_type));
        }
    }

    output.push_str("\n## Check Results\n\n");
    if input.check_results.is_empty() {
        output.push_str("- none recorded\n");
    } else {
        for check in input.check_results {
            output.push_str(&format!(
                "- `{}`: {} via `{}`\n",
                check.name,
                check.result.as_str(),
                check.command
            ));
        }
    }

    output.push_str("\n## Prompt\n\n");
    match input.prompt_content {
        Some(content) => {
            output.push_str("```markdown\n");
            output.push_str(content);
            if !content.ends_with('\n') {
                output.push('\n');
            }
            output.push_str("```\n");
        }
        None => output.push_str("_Semantic review prompt artifact could not be read._\n"),
    }

    output
}

pub(crate) struct SemanticReviewReportMetadata<'a> {
    pub(crate) reviewer_id: &'a str,
    pub(crate) llm_executed: bool,
    pub(crate) input_artifact: &'a str,
}

pub(super) fn render_semantic_review_yaml(
    review_id: &str,
    session: &Session,
    attempt: &MergeAttempt,
    operator: &Operator,
    report: &LocalSemanticReviewReport,
    metadata: SemanticReviewReportMetadata<'_>,
) -> String {
    let mut output = String::new();
    output.push_str("semantic_review:\n");
    output.push_str(&format!("  id: {}\n", yaml_quote(review_id)));
    output.push_str(&format!("  session_id: {}\n", yaml_quote(&session.id)));
    output.push_str(&format!(
        "  merge_attempt_id: {}\n",
        yaml_quote(&attempt.id)
    ));
    output.push_str(&format!(
        "  reviewer: {}\n",
        yaml_quote(metadata.reviewer_id)
    ));
    output.push_str(&format!("  llm_executed: {}\n", metadata.llm_executed));
    output.push_str(&format!("  operator_id: {}\n", yaml_quote(&operator.id)));
    output.push_str(&format!(
        "  risk_level: {}\n",
        yaml_quote(report.risk_level.as_str())
    ));
    output.push_str(&format!("  summary: {}\n", yaml_quote(&report.summary)));
    output.push_str(&format!(
        "  input_artifact: {}\n",
        yaml_quote(metadata.input_artifact)
    ));
    output.push_str("  suspected_conflicts:\n");
    append_semantic_conflicts_yaml(&mut output, &report.suspected_conflicts, 4);
    output.push_str("  required_actions:\n");
    append_string_list_yaml(&mut output, &report.required_actions, 4);
    output.push_str("  suggested_tests:\n");
    append_string_list_yaml(&mut output, &report.suggested_tests, 4);
    output.push_str("  proposed_patch:\n");
    output.push_str("    available: false\n");
    output.push_str("    description: \"\"\n");
    output.push_str("    patch_artifact: \"\"\n");
    output.push_str("  uncertainty:\n");
    append_string_list_yaml(&mut output, &report.uncertainty, 4);
    output
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
        uncertainty: vec![detail],
    }
}

fn append_semantic_conflicts_yaml(
    output: &mut String,
    findings: &[SemanticConflictFinding],
    indent: usize,
) {
    if findings.is_empty() {
        output.push_str(&format!("{}[]\n", " ".repeat(indent)));
        return;
    }

    for finding in findings {
        output.push_str(&format!(
            "{}- type: {}\n",
            " ".repeat(indent),
            yaml_quote(&finding.conflict_type)
        ));
        output.push_str(&format!("{}  files:\n", " ".repeat(indent)));
        append_string_list_yaml(output, &finding.files, indent + 4);
        output.push_str(&format!("{}  symbols: []\n", " ".repeat(indent)));
        output.push_str(&format!(
            "{}  explanation: {}\n",
            " ".repeat(indent),
            yaml_quote(&finding.explanation)
        ));
        output.push_str(&format!(
            "{}  confidence: {}\n",
            " ".repeat(indent),
            yaml_quote(&finding.confidence)
        ));
    }
}

fn append_string_list_yaml(output: &mut String, values: &[String], indent: usize) {
    if values.is_empty() {
        output.push_str(&format!("{}[]\n", " ".repeat(indent)));
        return;
    }

    for value in values {
        output.push_str(&format!("{}- {}\n", " ".repeat(indent), yaml_quote(value)));
    }
}

use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Output, Stdio};

use aich_core::clock::now_millis;
use aich_core::{
    ChangeManifest, ChangedFile, CheckResult, CheckResultStatus, EventName, MergeAttempt,
    MergeAttemptStatus, NewEvent, Operator, PatchSet, SemanticReview, SemanticRiskLevel, Session,
};
use aich_ledger::MergeAttemptSemanticReviewUpdate;

use crate::command_line::{parse_process_command, strip_yaml_scalar, ProcessCommandSpec};
use crate::formatting::{
    display_path_for_ledger, json_escape, path_from_ledger, read_optional_text, sha256_hex,
    truncate_for_report, yaml_quote,
};
use crate::manifest::{
    changed_files_missing_from_manifest, parse_manifest_diff_evidence, shared_contract_files,
};
use crate::options::ReviewOptions;
use crate::session::ensure_session_not_abandoned;
use crate::{
    latest_merge_attempt, next_semantic_review_id, open_existing_ledger, resolve_active_operator,
    CliError, ReviewRunResult, CHANGE_MANIFEST_VALIDATION_STATUS, COMMAND_SEMANTIC_REVIEWER,
    LLM_SEMANTIC_REVIEWER, LOCAL_SEMANTIC_REVIEWER,
};

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

pub(crate) struct SemanticReviewAdapterRequest<'a> {
    pub(crate) repo_root: &'a Path,
    pub(crate) session: &'a Session,
    pub(crate) attempt: &'a MergeAttempt,
    pub(crate) manifest: &'a ChangeManifest,
    pub(crate) manifest_content: Option<&'a str>,
    pub(crate) manifest_hash_mismatch: bool,
    pub(crate) patch_set: Option<&'a PatchSet>,
    pub(crate) changed_files: &'a [ChangedFile],
    pub(crate) check_results: &'a [CheckResult],
    pub(crate) config_path: &'a Path,
    pub(crate) prompt_path: &'a str,
    pub(crate) prompt_content: Option<&'a str>,
}

pub(crate) trait SemanticReviewAdapter {
    fn reviewer_id(&self) -> &str;

    fn llm_executed(&self) -> bool;

    fn review(
        &self,
        request: &SemanticReviewAdapterRequest<'_>,
    ) -> Result<LocalSemanticReviewReport, CliError>;
}

struct LocalSemanticReviewAdapter;

impl SemanticReviewAdapter for LocalSemanticReviewAdapter {
    fn reviewer_id(&self) -> &str {
        LOCAL_SEMANTIC_REVIEWER
    }

    fn llm_executed(&self) -> bool {
        false
    }

    fn review(
        &self,
        request: &SemanticReviewAdapterRequest<'_>,
    ) -> Result<LocalSemanticReviewReport, CliError> {
        Ok(build_local_semantic_review_report(
            request.manifest,
            request.manifest_content,
            request.manifest_hash_mismatch,
            request.attempt,
            request.changed_files,
            request.check_results,
        ))
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
enum SemanticReviewAdapterKind {
    Local,
    Command,
    Llm,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct SemanticReviewAdapterConfig {
    kind: SemanticReviewAdapterKind,
    provider: Option<String>,
    reviewer_id: Option<String>,
    model: Option<String>,
    profile: Option<String>,
    command: Option<ProcessCommandSpec>,
}

struct CommandSemanticReviewAdapter {
    reviewer_id: String,
    command: ProcessCommandSpec,
}

impl CommandSemanticReviewAdapter {
    fn new(reviewer_id: String, command: ProcessCommandSpec) -> Self {
        Self {
            reviewer_id,
            command,
        }
    }
}

impl SemanticReviewAdapter for CommandSemanticReviewAdapter {
    fn reviewer_id(&self) -> &str {
        &self.reviewer_id
    }

    fn llm_executed(&self) -> bool {
        true
    }

    fn review(
        &self,
        request: &SemanticReviewAdapterRequest<'_>,
    ) -> Result<LocalSemanticReviewReport, CliError> {
        let review_input = render_semantic_review_input(SemanticReviewInput {
            reviewer_id: self.reviewer_id(),
            llm_executed: self.llm_executed(),
            session: request.session,
            attempt: request.attempt,
            manifest: request.manifest,
            manifest_content: request.manifest_content,
            patch_set: request.patch_set,
            changed_files: request.changed_files,
            check_results: request.check_results,
            config_path: request.config_path,
            prompt_path: request.prompt_path,
            prompt_content: request.prompt_content,
        });
        let output =
            match run_semantic_review_command(&self.command, &review_input, request.repo_root) {
                Ok(output) => output,
                Err(error) => {
                    return Ok(command_semantic_review_failure_report(
                        "Semantic review command could not run.",
                        error,
                        &self.command,
                    ));
                }
            };

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Ok(command_semantic_review_failure_report(
                "Semantic review command exited with a non-zero status.",
                format!(
                    "command `{}` exited with {}; stderr: {}",
                    self.command.display(),
                    output.status,
                    truncate_for_report(stderr.trim(), 1_000)
                ),
                &self.command,
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        match parse_semantic_review_command_report(&stdout) {
            Ok(report) => Ok(report),
            Err(error) => Ok(command_semantic_review_failure_report(
                "Semantic review command returned an invalid report.",
                format!(
                    "{error}; stdout: {}",
                    truncate_for_report(stdout.trim(), 1_000)
                ),
                &self.command,
            )),
        }
    }
}

struct LlmSemanticReviewAdapter {
    reviewer_id: String,
    provider: String,
    command: ProcessCommandSpec,
}

impl LlmSemanticReviewAdapter {
    fn new(reviewer_id: String, provider: String, command: ProcessCommandSpec) -> Self {
        Self {
            reviewer_id,
            provider,
            command,
        }
    }
}

impl SemanticReviewAdapter for LlmSemanticReviewAdapter {
    fn reviewer_id(&self) -> &str {
        &self.reviewer_id
    }

    fn llm_executed(&self) -> bool {
        true
    }

    fn review(
        &self,
        request: &SemanticReviewAdapterRequest<'_>,
    ) -> Result<LocalSemanticReviewReport, CliError> {
        let review_input = render_semantic_review_input(SemanticReviewInput {
            reviewer_id: self.reviewer_id(),
            llm_executed: self.llm_executed(),
            session: request.session,
            attempt: request.attempt,
            manifest: request.manifest,
            manifest_content: request.manifest_content,
            patch_set: request.patch_set,
            changed_files: request.changed_files,
            check_results: request.check_results,
            config_path: request.config_path,
            prompt_path: request.prompt_path,
            prompt_content: request.prompt_content,
        });
        let output =
            match run_semantic_review_command(&self.command, &review_input, request.repo_root) {
                Ok(output) => output,
                Err(error) => {
                    return Ok(llm_semantic_review_failure_report(
                        "Semantic review LLM adapter could not run.",
                        error,
                        &self.provider,
                        &self.command,
                    ));
                }
            };

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Ok(llm_semantic_review_failure_report(
                "Semantic review LLM adapter exited with a non-zero status.",
                format!(
                    "provider `{}` command `{}` exited with {}; stderr: {}",
                    self.provider,
                    self.command.display(),
                    output.status,
                    truncate_for_report(stderr.trim(), 1_000)
                ),
                &self.provider,
                &self.command,
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        match parse_semantic_review_command_report(&stdout) {
            Ok(report) => Ok(report),
            Err(error) => Ok(llm_semantic_review_failure_report(
                "Semantic review LLM adapter returned an invalid report.",
                format!(
                    "{error}; stdout: {}",
                    truncate_for_report(stdout.trim(), 1_000)
                ),
                &self.provider,
                &self.command,
            )),
        }
    }
}

pub(crate) fn run_review_with(options: &ReviewOptions) -> Result<ReviewRunResult, CliError> {
    let config_path = options.repo_root.join(".aichestra/config.yaml");
    if !config_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra config not found at {}; run `aich init` first",
            config_path.display()
        )));
    }

    match semantic_review_adapter_config_from_config(&config_path)? {
        SemanticReviewAdapterConfig {
            kind: SemanticReviewAdapterKind::Local,
            ..
        } => run_review_with_adapter(options, &LocalSemanticReviewAdapter),
        SemanticReviewAdapterConfig {
            kind: SemanticReviewAdapterKind::Command,
            reviewer_id,
            command,
            ..
        } => {
            let command = command.ok_or_else(|| {
                CliError::Usage(
                    "semantic_review.command must be configured when semantic_review.adapter is command"
                        .to_string(),
                )
            })?;
            let adapter = CommandSemanticReviewAdapter::new(
                reviewer_id.unwrap_or_else(|| COMMAND_SEMANTIC_REVIEWER.to_string()),
                command,
            );
            run_review_with_adapter(options, &adapter)
        }
        config @ SemanticReviewAdapterConfig {
            kind: SemanticReviewAdapterKind::Llm,
            ..
        } => {
            let provider = config.provider.as_deref().unwrap_or("codex").to_string();
            let command = llm_semantic_review_command_from_config(&config)?;
            let adapter = LlmSemanticReviewAdapter::new(
                config
                    .reviewer_id
                    .unwrap_or_else(|| format!("{provider}_{LLM_SEMANTIC_REVIEWER}")),
                provider,
                command,
            );
            run_review_with_adapter(options, &adapter)
        }
    }
}

pub(crate) fn run_review_with_adapter<A>(
    options: &ReviewOptions,
    adapter: &A,
) -> Result<ReviewRunResult, CliError>
where
    A: SemanticReviewAdapter,
{
    let aichestra_dir = options.repo_root.join(".aichestra");
    let config_path = aichestra_dir.join("config.yaml");
    if !config_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra config not found at {}; run `aich init` first",
            config_path.display()
        )));
    }

    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;
    let session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;
    ensure_session_not_abandoned(&session, "reviewed")?;
    let manifest = ledger
        .list_change_manifests(&session.id)?
        .into_iter()
        .last()
        .ok_or_else(|| {
            CliError::Usage(format!(
                "session '{}' has no Change Manifest; run `aich session complete {}` first",
                session.id, session.id
            ))
        })?;
    let attempt = latest_merge_attempt(&ledger, &session.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no preflight attempt; run `aich preflight {}` first",
            session.id, session.id
        ))
    })?;
    ensure_attempt_can_be_reviewed(&attempt)?;

    let patch_set = ledger.list_patch_sets(&session.id)?.into_iter().last();
    let changed_files = match patch_set.as_ref() {
        Some(patch_set) => ledger.list_changed_files(&patch_set.id)?,
        None => Vec::new(),
    };
    let check_results = ledger.list_check_results(&attempt.id)?;
    let manifest_path = path_from_ledger(&options.repo_root, &manifest.manifest_path);
    let manifest_content = read_optional_text(&manifest_path)?;
    let manifest_hash_mismatch = manifest_content
        .as_ref()
        .zip(manifest.manifest_hash.as_ref())
        .is_some_and(|(content, expected)| sha256_hex(content.as_bytes()) != *expected);
    let prompt_path = semantic_review_prompt_path_from_config(&config_path);
    let prompt_content = read_optional_text(&path_from_ledger(&options.repo_root, &prompt_path))?;
    let input = render_semantic_review_input(SemanticReviewInput {
        reviewer_id: adapter.reviewer_id(),
        llm_executed: adapter.llm_executed(),
        session: &session,
        attempt: &attempt,
        manifest: &manifest,
        manifest_content: manifest_content.as_deref(),
        patch_set: patch_set.as_ref(),
        changed_files: &changed_files,
        check_results: &check_results,
        config_path: &config_path,
        prompt_path: &prompt_path,
        prompt_content: prompt_content.as_deref(),
    });
    let adapter_request = SemanticReviewAdapterRequest {
        repo_root: &options.repo_root,
        session: &session,
        attempt: &attempt,
        manifest: &manifest,
        manifest_content: manifest_content.as_deref(),
        manifest_hash_mismatch,
        patch_set: patch_set.as_ref(),
        changed_files: &changed_files,
        check_results: &check_results,
        config_path: &config_path,
        prompt_path: &prompt_path,
        prompt_content: prompt_content.as_deref(),
    };
    let report = adapter.review(&adapter_request)?;
    let created_at_ms = now_millis();
    let review_id = next_semantic_review_id(created_at_ms);
    let artifact_dir = aichestra_dir
        .join("artifacts")
        .join("merge-attempts")
        .join(&attempt.id);
    fs::create_dir_all(&artifact_dir)?;
    let input_path = artifact_dir.join(format!("{review_id}-input.md"));
    let report_path = artifact_dir.join(format!("{review_id}.yaml"));
    fs::write(&input_path, input)?;
    let report_yaml = render_semantic_review_yaml(
        &review_id,
        &session,
        &attempt,
        &operator,
        &report,
        SemanticReviewReportMetadata {
            reviewer_id: adapter.reviewer_id(),
            llm_executed: adapter.llm_executed(),
            input_artifact: &display_path_for_ledger(&options.repo_root, &input_path),
        },
    );
    fs::write(&report_path, report_yaml)?;

    let semantic_review = SemanticReview {
        id: review_id,
        merge_attempt_id: attempt.id.clone(),
        risk_level: report.risk_level,
        report_path: Some(display_path_for_ledger(&options.repo_root, &report_path)),
        created_at_ms,
    };
    ledger.insert_semantic_review(&semantic_review)?;

    let block_levels = semantic_block_levels_from_config(&config_path)?;
    let blocked = block_levels.contains(&report.risk_level);
    ledger.update_merge_attempt_semantic_review(MergeAttemptSemanticReviewUpdate {
        id: &attempt.id,
        status: if blocked {
            MergeAttemptStatus::Blocked
        } else {
            MergeAttemptStatus::Verified
        },
        semantic_risk_level: report.risk_level,
        updated_at_ms: now_millis(),
    })?;
    ledger.append_event(
        &NewEvent::new(EventName::MergeSemanticReviewCompleted)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"semantic_review_id\":\"{}\",\"reviewer\":\"{}\",\"llm_executed\":{},\"risk_level\":\"{}\",\"blocked\":{}}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&semantic_review.id),
                json_escape(adapter.reviewer_id()),
                adapter.llm_executed(),
                report.risk_level.as_str(),
                blocked
            )),
    )?;
    if blocked {
        ledger.append_event(
            &NewEvent::new(EventName::MergeBlocked)
                .with_subject("merge_attempt", attempt.id.clone())
                .with_data_json(format!(
                    "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"reason\":\"semantic_review\",\"risk_level\":\"{}\"}}",
                    json_escape(&operator.id),
                    json_escape(&session.id),
                    report.risk_level.as_str()
                )),
        )?;
    }

    let merge_attempt = ledger
        .get_merge_attempt(&attempt.id)?
        .ok_or_else(|| CliError::Usage(format!("merge attempt '{}' does not exist", attempt.id)))?;

    Ok(ReviewRunResult {
        semantic_review,
        merge_attempt,
        operator,
        report_path,
        summary: report.summary,
        required_actions: report.required_actions,
        suggested_tests: report.suggested_tests,
        blocked,
    })
}

pub(crate) fn ensure_attempt_can_be_reviewed(attempt: &MergeAttempt) -> Result<(), CliError> {
    if attempt.status != MergeAttemptStatus::Verified {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is not verified; run `aich preflight {}` again",
            attempt.id, attempt.session_id
        )));
    }
    if !attempt.checks_passed {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' did not pass checks; fix the candidate and run preflight again",
            attempt.id
        )));
    }
    if attempt.verified_tree_id.as_deref().unwrap_or("").is_empty()
        || attempt
            .verified_commit_id
            .as_deref()
            .unwrap_or("")
            .is_empty()
    {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' has no verified tree/commit; run `aich preflight {}` again",
            attempt.id, attempt.session_id
        )));
    }

    Ok(())
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

struct SemanticReviewInput<'a> {
    reviewer_id: &'a str,
    llm_executed: bool,
    session: &'a Session,
    attempt: &'a MergeAttempt,
    manifest: &'a ChangeManifest,
    manifest_content: Option<&'a str>,
    patch_set: Option<&'a PatchSet>,
    changed_files: &'a [ChangedFile],
    check_results: &'a [CheckResult],
    config_path: &'a Path,
    prompt_path: &'a str,
    prompt_content: Option<&'a str>,
}

fn render_semantic_review_input(input: SemanticReviewInput<'_>) -> String {
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

struct SemanticReviewReportMetadata<'a> {
    reviewer_id: &'a str,
    llm_executed: bool,
    input_artifact: &'a str,
}

fn render_semantic_review_yaml(
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

fn run_semantic_review_command(
    command_spec: &ProcessCommandSpec,
    review_input: &str,
    working_dir: &Path,
) -> Result<Output, String> {
    let mut child = Command::new(&command_spec.program)
        .args(&command_spec.args)
        .current_dir(working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            format!(
                "failed to spawn semantic review command `{}`: {error}",
                command_spec.display()
            )
        })?;

    let write_result = match child.stdin.take() {
        Some(mut stdin) => stdin.write_all(review_input.as_bytes()).map_err(|error| {
            format!(
                "failed to write review input to semantic review command `{}` stdin: {error}",
                command_spec.display()
            )
        }),
        None => Err(format!(
            "failed to open stdin for semantic review command `{}`",
            command_spec.display()
        )),
    };

    let output = child.wait_with_output().map_err(|error| {
        format!(
            "failed to wait for semantic review command `{}`: {error}",
            command_spec.display()
        )
    })?;

    if let Err(error) = write_result {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "{error}; stderr: {}",
            truncate_for_report(stderr.trim(), 1_000)
        ));
    }

    Ok(output)
}

fn parse_semantic_review_command_report(output: &str) -> Result<LocalSemanticReviewReport, String> {
    #[derive(Copy, Clone, Eq, PartialEq)]
    enum Section {
        None,
        SuspectedConflicts,
        RequiredActions,
        SuggestedTests,
        Uncertainty,
    }

    #[derive(Copy, Clone, Eq, PartialEq)]
    enum ConflictList {
        Files,
        Symbols,
    }

    let yaml = semantic_review_yaml_from_command_output(output)?;
    let mut risk_level: Option<SemanticRiskLevel> = None;
    let mut summary: Option<String> = None;
    let mut suspected_conflicts = Vec::new();
    let mut required_actions = Vec::new();
    let mut suggested_tests = Vec::new();
    let mut uncertainty = Vec::new();
    let mut section = Section::None;
    let mut current_conflict: Option<SemanticConflictFinding> = None;
    let mut conflict_list: Option<ConflictList> = None;

    for line in yaml.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("```") {
            continue;
        }
        if trimmed == "semantic_review:" {
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("risk_level:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = Section::None;
            risk_level = Some(
                SemanticRiskLevel::parse(strip_yaml_scalar(value).as_str())
                    .map_err(|error| format!("invalid semantic_review.risk_level: {error}"))?,
            );
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("summary:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = Section::None;
            summary = Some(strip_yaml_scalar(value));
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("suspected_conflicts:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = if strip_yaml_scalar(value) == "[]" {
                Section::None
            } else {
                Section::SuspectedConflicts
            };
            conflict_list = None;
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("required_actions:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = if strip_yaml_scalar(value) == "[]" {
                Section::None
            } else {
                Section::RequiredActions
            };
            conflict_list = None;
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("suggested_tests:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = if strip_yaml_scalar(value) == "[]" {
                Section::None
            } else {
                Section::SuggestedTests
            };
            conflict_list = None;
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("uncertainty:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = if strip_yaml_scalar(value) == "[]" {
                Section::None
            } else {
                Section::Uncertainty
            };
            conflict_list = None;
            continue;
        }

        match section {
            Section::SuspectedConflicts => {
                if let Some(value) = trimmed.strip_prefix("- type:") {
                    push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
                    current_conflict = Some(SemanticConflictFinding {
                        conflict_type: strip_yaml_scalar(value),
                        files: Vec::new(),
                        explanation: String::new(),
                        confidence: "medium".to_string(),
                    });
                    conflict_list = None;
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("type:") {
                    let finding =
                        current_conflict.get_or_insert_with(default_semantic_conflict_finding);
                    finding.conflict_type = strip_yaml_scalar(value);
                    conflict_list = None;
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("files:") {
                    let _ = current_conflict.get_or_insert_with(default_semantic_conflict_finding);
                    conflict_list = if strip_yaml_scalar(value) == "[]" {
                        None
                    } else {
                        Some(ConflictList::Files)
                    };
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("symbols:") {
                    conflict_list = if strip_yaml_scalar(value) == "[]" {
                        None
                    } else {
                        Some(ConflictList::Symbols)
                    };
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("explanation:") {
                    let finding =
                        current_conflict.get_or_insert_with(default_semantic_conflict_finding);
                    finding.explanation = strip_yaml_scalar(value);
                    conflict_list = None;
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("confidence:") {
                    let finding =
                        current_conflict.get_or_insert_with(default_semantic_conflict_finding);
                    finding.confidence = strip_yaml_scalar(value);
                    conflict_list = None;
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("- ") {
                    if conflict_list == Some(ConflictList::Files) {
                        let finding =
                            current_conflict.get_or_insert_with(default_semantic_conflict_finding);
                        finding.files.push(strip_yaml_scalar(value));
                    }
                }
            }
            Section::RequiredActions => {
                append_command_report_list_item(trimmed, &mut required_actions)
            }
            Section::SuggestedTests => {
                append_command_report_list_item(trimmed, &mut suggested_tests)
            }
            Section::Uncertainty => append_command_report_list_item(trimmed, &mut uncertainty),
            Section::None => {}
        }
    }

    push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
    let risk_level = risk_level.ok_or_else(|| "missing semantic_review.risk_level".to_string())?;
    let summary = summary
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "missing semantic_review.summary".to_string())?;

    Ok(LocalSemanticReviewReport {
        risk_level,
        summary,
        suspected_conflicts,
        required_actions,
        suggested_tests,
        uncertainty,
    })
}

fn semantic_review_yaml_from_command_output(output: &str) -> Result<&str, String> {
    let start = output
        .find("semantic_review:")
        .ok_or_else(|| "missing semantic_review root".to_string())?;
    let yaml = &output[start..];
    Ok(yaml.find("\n```").map_or(yaml, |end| &yaml[..end]))
}

fn append_command_report_list_item(trimmed: &str, values: &mut Vec<String>) {
    if let Some(value) = trimmed.strip_prefix("- ") {
        values.push(strip_yaml_scalar(value));
    }
}

fn push_pending_conflict(
    conflicts: &mut Vec<SemanticConflictFinding>,
    current: &mut Option<SemanticConflictFinding>,
) {
    if let Some(mut finding) = current.take() {
        if finding.conflict_type.trim().is_empty() {
            finding.conflict_type = "unknown".to_string();
        }
        if finding.confidence.trim().is_empty() {
            finding.confidence = "medium".to_string();
        }
        conflicts.push(finding);
    }
}

fn default_semantic_conflict_finding() -> SemanticConflictFinding {
    SemanticConflictFinding {
        conflict_type: "unknown".to_string(),
        files: Vec::new(),
        explanation: String::new(),
        confidence: "medium".to_string(),
    }
}

fn command_semantic_review_failure_report(
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

fn llm_semantic_review_failure_report(
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

fn semantic_review_adapter_config_from_config(
    config_path: &Path,
) -> Result<SemanticReviewAdapterConfig, CliError> {
    let config = fs::read_to_string(config_path)?;
    let mut in_semantic_review = false;
    let mut kind: Option<SemanticReviewAdapterKind> = None;
    let mut legacy_provider: Option<String> = None;
    let mut reviewer_id: Option<String> = None;
    let mut model: Option<String> = None;
    let mut profile: Option<String> = None;
    let mut command_line: Option<String> = None;

    for line in config.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if !line.starts_with(' ') && trimmed.ends_with(':') {
            in_semantic_review = trimmed == "semantic_review:";
            continue;
        }

        if !in_semantic_review {
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("adapter:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                kind = Some(parse_semantic_review_adapter_kind(&value)?);
            }
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("reviewer_provider:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                legacy_provider = Some(value);
            }
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("reviewer_id:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                reviewer_id = Some(value);
            }
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("model:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                model = Some(value);
            }
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("profile:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                profile = Some(value);
            }
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("command:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                command_line = Some(value);
            }
        }
    }

    let kind = kind.unwrap_or_else(|| {
        if legacy_provider.as_deref() == Some("command") {
            SemanticReviewAdapterKind::Command
        } else {
            SemanticReviewAdapterKind::Local
        }
    });
    let command = command_line
        .as_deref()
        .map(|line| parse_process_command("semantic_review.command", line))
        .transpose()?;

    Ok(SemanticReviewAdapterConfig {
        kind,
        provider: legacy_provider,
        reviewer_id,
        model,
        profile,
        command,
    })
}

fn parse_semantic_review_adapter_kind(value: &str) -> Result<SemanticReviewAdapterKind, CliError> {
    match value.trim() {
        "local" => Ok(SemanticReviewAdapterKind::Local),
        "command" => Ok(SemanticReviewAdapterKind::Command),
        "llm" => Ok(SemanticReviewAdapterKind::Llm),
        other => Err(CliError::Usage(format!(
            "semantic_review.adapter must be 'local', 'command', or 'llm', got '{other}'"
        ))),
    }
}

fn llm_semantic_review_command_from_config(
    config: &SemanticReviewAdapterConfig,
) -> Result<ProcessCommandSpec, CliError> {
    if let Some(command) = config.command.clone() {
        return Ok(command);
    }

    let provider = config.provider.as_deref().unwrap_or("codex");
    match provider {
        "codex" => Ok(codex_semantic_review_command(
            config.model.as_deref(),
            config.profile.as_deref(),
        )),
        "custom" => Err(CliError::Usage(
            "semantic_review.command must be configured when semantic_review.adapter is llm and reviewer_provider is custom"
                .to_string(),
        )),
        other => Err(CliError::Usage(format!(
            "semantic_review.reviewer_provider '{other}' is not supported by the built-in LLM adapter; configure semantic_review.command or use adapter: command"
        ))),
    }
}

pub(crate) fn codex_semantic_review_command(
    model: Option<&str>,
    profile: Option<&str>,
) -> ProcessCommandSpec {
    let mut args = vec![
        "--ask-for-approval".to_string(),
        "never".to_string(),
        "exec".to_string(),
        "--sandbox".to_string(),
        "read-only".to_string(),
        "--skip-git-repo-check".to_string(),
        "--ephemeral".to_string(),
        "--color".to_string(),
        "never".to_string(),
    ];

    if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
        args.push("--model".to_string());
        args.push(model.to_string());
    }

    if let Some(profile) = profile.filter(|value| !value.trim().is_empty()) {
        args.push("--profile".to_string());
        args.push(profile.to_string());
    }

    args.push("-".to_string());

    ProcessCommandSpec {
        program: "codex".to_string(),
        args,
    }
}

fn semantic_review_prompt_path_from_config(config_path: &Path) -> String {
    let Ok(config) = fs::read_to_string(config_path) else {
        return ".aichestra/prompts/semantic-merge-review.md".to_string();
    };
    let mut in_semantic_review = false;

    for line in config.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if !line.starts_with(' ') && trimmed.ends_with(':') {
            in_semantic_review = trimmed == "semantic_review:";
            continue;
        }

        if in_semantic_review {
            if let Some(value) = trimmed.strip_prefix("prompt_path:") {
                let prompt_path = strip_yaml_scalar(value);
                if !prompt_path.trim().is_empty() {
                    return prompt_path;
                }
            }
        }
    }

    ".aichestra/prompts/semantic-merge-review.md".to_string()
}

fn semantic_block_levels_from_config(
    config_path: &Path,
) -> Result<Vec<SemanticRiskLevel>, CliError> {
    let config = fs::read_to_string(config_path)?;
    let mut block_levels = Vec::new();
    let mut in_semantic_review = false;
    let mut in_block_levels = false;

    for line in config.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if !line.starts_with(' ') && trimmed.ends_with(':') {
            in_semantic_review = trimmed == "semantic_review:";
            in_block_levels = false;
            continue;
        }

        if !in_semantic_review {
            continue;
        }

        if trimmed == "risk_block_levels:" {
            in_block_levels = true;
            continue;
        }

        if in_block_levels {
            if let Some(value) = trimmed.strip_prefix('-') {
                block_levels.push(
                    SemanticRiskLevel::parse(strip_yaml_scalar(value).as_str())
                        .map_err(CliError::Usage)?,
                );
            } else if !line.starts_with("    ") {
                in_block_levels = false;
            }
        }
    }

    if block_levels.is_empty() {
        block_levels.push(SemanticRiskLevel::Blocked);
    }

    Ok(block_levels)
}

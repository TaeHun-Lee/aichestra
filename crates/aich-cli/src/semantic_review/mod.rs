mod adapter;
mod config;
mod parser;
mod report;

use std::fs;

use aich_core::clock::now_millis;
use aich_core::{
    CheckResult, EventName, MergeAttempt, MergeAttemptStatus, NewEvent, SemanticReview,
};
use aich_ledger::MergeAttemptSemanticReviewUpdate;

use crate::formatting::{
    display_path_for_ledger, json_escape, path_from_ledger, read_optional_text, sha256_hex,
};
use crate::options::ReviewOptions;
use crate::session::ensure_session_not_abandoned;
use crate::{
    latest_merge_attempt, next_semantic_review_id, open_existing_ledger, resolve_active_operator,
    CliError, ReviewRunResult, COMMAND_SEMANTIC_REVIEWER, LLM_SEMANTIC_REVIEWER,
};

use adapter::{CommandSemanticReviewAdapter, LlmSemanticReviewAdapter, LocalSemanticReviewAdapter};
use config::{
    llm_semantic_review_command_from_config, semantic_block_levels_from_config,
    semantic_review_adapter_config_from_config, semantic_review_prompt_path_from_config,
    SemanticReviewAdapterConfig, SemanticReviewAdapterKind,
};
use report::{render_semantic_review_input, render_semantic_review_yaml};

pub(crate) use adapter::{SemanticReviewAdapter, SemanticReviewAdapterRequest};
#[cfg(test)]
pub(crate) use config::codex_semantic_review_command;
#[cfg(test)]
pub(crate) use report::{build_local_semantic_review_report, LocalSemanticReviewReport};
pub(crate) use report::{SemanticReviewInput, SemanticReviewReportMetadata};

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
    let check_results: Vec<CheckResult> = ledger.list_check_results(&attempt.id)?;
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

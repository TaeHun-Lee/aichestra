mod adapter;
mod config;
mod parser;
mod report;

use std::fs;
use std::path::Path;

use aich_core::clock::now_millis;
use aich_core::{
    ChangeManifest, CheckResult, EventName, MergeAttempt, MergeAttemptStatus, NewEvent,
    SemanticReview, Session, SessionStatus,
};
use aich_ledger::MergeAttemptSemanticReviewUpdate;
use aich_llm::{
    render_proposed_fix_plan_artifact, render_semantic_review_input, render_semantic_review_yaml,
    DiffPatchContext, RelatedChangeManifest, RelatedChangeManifestRelation, SemanticReviewInput,
    SemanticReviewReportMetadata,
};
use aich_merge::ensure_attempt_can_be_reviewed as merge_ensure_attempt_can_be_reviewed;

use crate::formatting::{
    display_path_for_ledger, json_escape, path_from_ledger, read_optional_text, sha256_hex,
};
use crate::manifest::parse_manifest_diff_patch_artifact;
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

pub(crate) use adapter::SemanticReviewAdapter;
pub(crate) use aich_llm::LocalSemanticReviewReport;
#[cfg(test)]
pub(crate) use aich_llm::ProposedPatch;
pub(crate) use aich_llm::SemanticReviewAdapterRequest;
#[cfg(test)]
pub(crate) use config::codex_semantic_review_command;
#[cfg(test)]
pub(crate) use report::build_local_semantic_review_report;

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
            timeout_ms,
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
                timeout_ms,
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
                config.timeout_ms,
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
    let diff_patch_context =
        diff_patch_context_from_manifest(&options.repo_root, manifest_content.as_deref())?;
    let related_manifests = related_change_manifests(&ledger, &options.repo_root, &session.id)?;
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
        diff_patch_context: diff_patch_context.as_ref(),
        changed_files: &changed_files,
        check_results: &check_results,
        related_manifests: &related_manifests,
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
        diff_patch_context: diff_patch_context.as_ref(),
        changed_files: &changed_files,
        check_results: &check_results,
        related_manifests: &related_manifests,
        config_path: &config_path,
        prompt_path: &prompt_path,
        prompt_content: prompt_content.as_deref(),
    };
    let created_at_ms = now_millis();
    let review_id = next_semantic_review_id(created_at_ms);
    let artifact_dir = aichestra_dir
        .join("artifacts")
        .join("merge-attempts")
        .join(&attempt.id);
    fs::create_dir_all(&artifact_dir)?;
    let mut report = adapter.review(&adapter_request)?;
    let input_path = artifact_dir.join(format!("{review_id}-input.md"));
    let report_path = artifact_dir.join(format!("{review_id}.yaml"));
    fs::write(&input_path, input)?;
    persist_proposed_patch_artifacts(&options.repo_root, &artifact_dir, &review_id, &mut report)?;
    let report_yaml = render_semantic_review_yaml(
        &review_id,
        &session,
        &attempt,
        &report,
        SemanticReviewReportMetadata {
            reviewer_id: adapter.reviewer_id(),
            llm_executed: adapter.llm_executed(),
            operator_id: &operator.id,
            input_artifact: &display_path_for_ledger(&options.repo_root, &input_path),
        },
    );
    fs::write(&report_path, report_yaml)?;

    let semantic_review = SemanticReview {
        id: review_id,
        merge_attempt_id: attempt.id.clone(),
        risk_level: report.risk_level,
        report_path: Some(display_path_for_ledger(&options.repo_root, &report_path)),
        proposed_patch_available: report.proposed_patch.available,
        fix_plan_artifact: report.proposed_patch.fix_plan_artifact.clone(),
        patch_artifact: report.proposed_patch.patch_artifact.clone(),
        created_at_ms,
    };
    let block_levels = semantic_block_levels_from_config(&config_path)?;
    let blocked = block_levels.contains(&report.risk_level);
    let tx = ledger.begin_immediate_transaction()?;
    ledger.insert_semantic_review(&semantic_review)?;

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
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"semantic_review_id\":\"{}\",\"reviewer\":\"{}\",\"llm_executed\":{},\"risk_level\":\"{}\",\"blocked\":{},\"proposed_patch_available\":{}}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&semantic_review.id),
                json_escape(adapter.reviewer_id()),
                adapter.llm_executed(),
                report.risk_level.as_str(),
                blocked,
                semantic_review.proposed_patch_available
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
    tx.commit()?;

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
        proposed_patch_available: report.proposed_patch.available,
        fix_plan_artifact: report.proposed_patch.fix_plan_artifact,
        patch_artifact: report.proposed_patch.patch_artifact,
        blocked,
    })
}

fn persist_proposed_patch_artifacts(
    repo_root: &Path,
    artifact_dir: &Path,
    review_id: &str,
    report: &mut LocalSemanticReviewReport,
) -> Result<(), CliError> {
    if !report.proposed_patch.available {
        report.proposed_patch.fix_plan_artifact = None;
        report.proposed_patch.patch_artifact = None;
        report.proposed_patch.patch = None;
        return Ok(());
    }

    let patch_artifact = match report.proposed_patch.patch.as_deref() {
        Some(patch) => {
            let patch_path = artifact_dir.join(format!("{review_id}-proposed.patch"));
            fs::write(&patch_path, patch)?;
            Some(display_path_for_ledger(repo_root, &patch_path))
        }
        None => None,
    };

    report.proposed_patch.patch_artifact = patch_artifact;
    let fix_plan_path = artifact_dir.join(format!("{review_id}-fix-plan.md"));
    fs::write(
        &fix_plan_path,
        render_proposed_fix_plan_artifact(review_id, report),
    )?;
    report.proposed_patch.fix_plan_artifact =
        Some(display_path_for_ledger(repo_root, &fix_plan_path));
    report.proposed_patch.patch = None;
    Ok(())
}

fn diff_patch_context_from_manifest(
    repo_root: &Path,
    manifest_content: Option<&str>,
) -> Result<Option<DiffPatchContext>, CliError> {
    let Some(manifest_content) = manifest_content else {
        return Ok(None);
    };
    let artifact_path = match parse_manifest_diff_patch_artifact(manifest_content) {
        Ok(Some(path)) => path,
        Ok(None) => return Ok(None),
        Err(error) => {
            return Ok(Some(DiffPatchContext::unavailable(
                "(unresolved from Change Manifest)",
                format!(
                    "Change Manifest YAML could not be parsed for diff_patch_artifact: {error}"
                ),
            )));
        }
    };
    let artifact_fs_path = path_from_ledger(repo_root, &artifact_path);

    match read_optional_text(&artifact_fs_path)? {
        Some(content) => Ok(Some(DiffPatchContext::from_content(artifact_path, content))),
        None => Ok(Some(DiffPatchContext::unavailable(
            artifact_path,
            "Diff patch artifact could not be read from the recorded path.",
        ))),
    }
}

fn related_change_manifests(
    ledger: &aich_ledger::Ledger,
    repo_root: &std::path::Path,
    current_session_id: &str,
) -> Result<Vec<RelatedChangeManifest>, CliError> {
    let mut related = Vec::new();

    for session in ledger.list_sessions()? {
        if session.id == current_session_id || session.status == SessionStatus::Abandoned {
            continue;
        }

        let attempts = ledger.list_merge_attempts(&session.id)?;
        let latest_attempt = attempts.last();
        let Some(relation) = related_manifest_relation(&session, latest_attempt) else {
            continue;
        };
        let Some(manifest) = ledger
            .list_change_manifests(&session.id)?
            .into_iter()
            .last()
        else {
            continue;
        };

        related.push(read_related_change_manifest(
            repo_root,
            session,
            latest_attempt,
            manifest,
            relation,
        )?);
    }

    Ok(related)
}

fn related_manifest_relation(
    session: &Session,
    latest_attempt: Option<&MergeAttempt>,
) -> Option<RelatedChangeManifestRelation> {
    if latest_attempt
        .map(|attempt| attempt.status == MergeAttemptStatus::Applied)
        .unwrap_or(false)
    {
        return Some(RelatedChangeManifestRelation::Applied);
    }

    if session.status == SessionStatus::Enqueued {
        return Some(RelatedChangeManifestRelation::Queued);
    }

    None
}

fn read_related_change_manifest(
    repo_root: &std::path::Path,
    session: Session,
    latest_attempt: Option<&MergeAttempt>,
    manifest: ChangeManifest,
    relation: RelatedChangeManifestRelation,
) -> Result<RelatedChangeManifest, CliError> {
    let manifest_path = path_from_ledger(repo_root, &manifest.manifest_path);
    let manifest_content = read_optional_text(&manifest_path)?;
    let manifest_hash_mismatch = manifest_content
        .as_ref()
        .zip(manifest.manifest_hash.as_ref())
        .is_some_and(|(content, expected)| sha256_hex(content.as_bytes()) != *expected);

    Ok(RelatedChangeManifest {
        relation,
        session_id: session.id,
        session_status: session.status.as_str().to_string(),
        goal: session.goal,
        base_commit: session.base_commit,
        head_commit: session.head_commit,
        latest_attempt_id: latest_attempt.map(|attempt| attempt.id.clone()),
        latest_attempt_status: latest_attempt.map(|attempt| attempt.status.as_str().to_string()),
        latest_attempt_main_before_commit: latest_attempt
            .map(|attempt| attempt.main_before_commit.clone()),
        latest_attempt_verified_commit_id: latest_attempt
            .and_then(|attempt| attempt.verified_commit_id.clone()),
        manifest_id: manifest.id,
        manifest_path: manifest.manifest_path,
        manifest_hash_mismatch,
        manifest_content,
    })
}

pub(crate) fn ensure_attempt_can_be_reviewed(attempt: &MergeAttempt) -> Result<(), CliError> {
    merge_ensure_attempt_can_be_reviewed(attempt)
        .map_err(|error| CliError::Usage(error.to_string()))
}

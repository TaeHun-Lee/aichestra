use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use aich_core::clock::now_millis;
use aich_core::{EventName, MergeAttemptStatus, NewEvent, Session, SessionStatus};
use aich_ledger::MergeAttemptResultUpdate;
use serde::Deserialize;

use crate::agent::run_agent_command;
use crate::approval::latest_approval;
use crate::command_line::parse_process_command;
use crate::config::provider_command_from_config;
use crate::formatting::{
    display_path_for_ledger, json_escape, path_from_ledger, read_optional_text,
};
use crate::options::SessionReworkOptions;
use crate::session::ensure_session_worktree_is_dedicated;
use crate::{
    latest_merge_attempt, open_existing_ledger, resolve_active_operator, CliError,
    SessionReworkResult,
};

static REWORK_COUNTER: AtomicU64 = AtomicU64::new(1);

pub(crate) fn run_session_rework_with(
    options: &SessionReworkOptions,
) -> Result<SessionReworkResult, CliError> {
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
    ensure_session_can_rework(&session)?;
    let attempt = latest_merge_attempt(&ledger, &session.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no merge attempt to rework; run `aich preflight {}` first",
            session.id, session.id
        ))
    })?;
    if matches!(
        attempt.status,
        MergeAttemptStatus::Applying | MergeAttemptStatus::Applied
    ) {
        return Err(CliError::Usage(format!(
            "session '{}' cannot be reworked while merge attempt '{}' is {}",
            session.id,
            attempt.id,
            attempt.status.as_str()
        )));
    }
    if latest_approval(&ledger, &attempt.id)?.is_some() {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is already approved; create a new session for additional work",
            attempt.id
        )));
    }

    let semantic_reviews = ledger.list_semantic_reviews(&attempt.id)?;
    let review = semantic_reviews
        .into_iter()
        .find(|review| review.id == options.review_id)
        .ok_or_else(|| {
            CliError::Usage(format!(
                "semantic review '{}' does not belong to latest merge attempt '{}'",
                options.review_id, attempt.id
            ))
        })?;
    if !review.proposed_patch_available {
        return Err(CliError::Usage(format!(
            "semantic review '{}' has no proposed patch or fix plan to rework",
            review.id
        )));
    }
    let Some(fix_plan_artifact) = review.fix_plan_artifact.as_deref() else {
        return Err(CliError::Usage(format!(
            "semantic review '{}' has no fix plan artifact",
            review.id
        )));
    };

    let worktree_path = path_from_ledger(&options.repo_root, &session.worktree_path);
    ensure_session_worktree_is_dedicated(&options.repo_root, &worktree_path)?;
    if !worktree_path.is_dir() {
        return Err(CliError::Usage(format!(
            "session '{}' worktree does not exist at {}",
            session.id,
            worktree_path.display()
        )));
    }

    let report_context = read_report_context(&options.repo_root, &review.report_path)?;
    let fix_plan_content = read_required_artifact(&options.repo_root, fix_plan_artifact)?;
    let patch_content = match review.patch_artifact.as_deref() {
        Some(path) => Some(read_required_artifact(&options.repo_root, path)?),
        None => None,
    };

    let command_line = provider_command_from_config(&config_path, &session.provider)?;
    let command = parse_process_command(
        &format!("providers.{}.command", session.provider),
        &command_line,
    )?;

    let started_at_ms = now_millis();
    let artifact_id = next_rework_id(started_at_ms);
    let artifacts = ReworkArtifacts::new(&aichestra_dir, &session.id, &artifact_id);
    fs::create_dir_all(&artifacts.artifact_dir)?;
    let input = render_rework_input(ReworkInput {
        session: &session,
        review_id: &review.id,
        merge_attempt_id: &attempt.id,
        report_context: &report_context,
        fix_plan_artifact,
        fix_plan_content: &fix_plan_content,
        patch_artifact: review.patch_artifact.as_deref(),
        patch_content: patch_content.as_deref(),
    });
    fs::write(&artifacts.input_path, &input)?;

    let tx = ledger.begin_immediate_transaction()?;
    ledger.update_merge_attempt_result(MergeAttemptResultUpdate {
        id: &attempt.id,
        status: MergeAttemptStatus::Blocked,
        verified_tree_id: attempt.verified_tree_id.as_deref(),
        verified_commit_id: attempt.verified_commit_id.as_deref(),
        checks_passed: attempt.checks_passed,
        semantic_risk_level: attempt.semantic_risk_level.as_deref(),
        updated_at_ms: started_at_ms,
    })?;
    ledger.update_session_status(&session.id, SessionStatus::Running, started_at_ms)?;
    ledger.append_event(
        &NewEvent::new(EventName::MergeBlocked)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"reason\":\"rework_started\",\"semantic_review_id\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&review.id)
            )),
    )?;
    ledger.append_event(
        &NewEvent::new(EventName::SessionReworkStarted)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"merge_attempt_id\":\"{}\",\"semantic_review_id\":\"{}\",\"artifact_dir\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&attempt.id),
                json_escape(&review.id),
                json_escape(&display_path_for_ledger(&options.repo_root, &artifacts.artifact_dir))
            )),
    )?;
    tx.commit()?;

    let output = match run_agent_command(&command, &input, &worktree_path) {
        Ok(output) => output,
        Err(error) => {
            fs::write(&artifacts.stderr_path, &error)?;
            append_rework_failed_event(
                &ledger,
                &operator.id,
                &session.id,
                &review.id,
                None,
                &error,
            )?;
            return Err(CliError::Usage(format!(
                "session rework command failed to run; artifacts: {}",
                artifacts.artifact_dir.display()
            )));
        }
    };

    fs::write(&artifacts.stdout_path, &output.stdout)?;
    fs::write(&artifacts.stderr_path, &output.stderr)?;
    fs::write(
        &artifacts.metadata_path,
        render_rework_metadata(&session, &review.id, &attempt.id, &command.display()),
    )?;

    let exit_code = output.status.code();
    if !output.status.success() {
        append_rework_failed_event(
            &ledger,
            &operator.id,
            &session.id,
            &review.id,
            exit_code,
            &format!("provider exited with {}", output.status),
        )?;
        return Err(CliError::Usage(format!(
            "session rework command exited with {}; artifacts: {}",
            output.status,
            artifacts.artifact_dir.display()
        )));
    }

    ledger.append_event(
        &NewEvent::new(EventName::SessionReworkCompleted)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"merge_attempt_id\":\"{}\",\"semantic_review_id\":\"{}\",\"exit_code\":{},\"artifact_dir\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&attempt.id),
                json_escape(&review.id),
                exit_code
                    .map(|code| code.to_string())
                    .unwrap_or_else(|| "null".to_string()),
                json_escape(&display_path_for_ledger(&options.repo_root, &artifacts.artifact_dir))
            )),
    )?;

    let session = ledger.get_session(&session.id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;

    Ok(SessionReworkResult {
        session,
        operator,
        merge_attempt: attempt,
        semantic_review: review,
        artifact_dir: artifacts.artifact_dir,
        input_path: artifacts.input_path,
        stdout_path: artifacts.stdout_path,
        stderr_path: artifacts.stderr_path,
        metadata_path: artifacts.metadata_path,
        exit_code,
        success: true,
    })
}

fn ensure_session_can_rework(session: &Session) -> Result<(), CliError> {
    if session.status == SessionStatus::Abandoned {
        return Err(CliError::Usage(format!(
            "session '{}' is abandoned and cannot be reworked",
            session.id
        )));
    }
    Ok(())
}

fn append_rework_failed_event(
    ledger: &aich_ledger::Ledger,
    operator_id: &str,
    session_id: &str,
    review_id: &str,
    exit_code: Option<i32>,
    error: &str,
) -> Result<(), CliError> {
    ledger.append_event(
        &NewEvent::new(EventName::SessionReworkFailed)
            .with_subject("session", session_id.to_string())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"semantic_review_id\":\"{}\",\"exit_code\":{},\"error\":\"{}\"}}",
                json_escape(operator_id),
                json_escape(review_id),
                exit_code
                    .map(|code| code.to_string())
                    .unwrap_or_else(|| "null".to_string()),
                json_escape(error)
            )),
    )?;
    Ok(())
}

#[derive(Debug, Default, Deserialize)]
struct StoredSemanticReviewDocument {
    semantic_review: StoredSemanticReviewReport,
}

#[derive(Debug, Default, Deserialize)]
struct StoredSemanticReviewReport {
    #[serde(default)]
    summary: String,
    #[serde(default)]
    required_actions: Vec<String>,
    #[serde(default)]
    suggested_tests: Vec<String>,
    #[serde(default)]
    proposed_patch: StoredProposedPatch,
}

#[derive(Debug, Default, Deserialize)]
struct StoredProposedPatch {
    #[serde(default)]
    description: String,
}

struct ReworkReportContext {
    summary: String,
    required_actions: Vec<String>,
    suggested_tests: Vec<String>,
    proposed_patch_description: String,
}

fn read_report_context(
    repo_root: &Path,
    report_path: &Option<String>,
) -> Result<ReworkReportContext, CliError> {
    let Some(report_path) = report_path.as_deref() else {
        return Err(CliError::Usage(
            "semantic review has no report artifact".to_string(),
        ));
    };
    let report_path = path_from_ledger(repo_root, report_path);
    let Some(content) = read_optional_text(&report_path)? else {
        return Err(CliError::Usage(format!(
            "semantic review report artifact is missing at {}",
            report_path.display()
        )));
    };
    let document: StoredSemanticReviewDocument =
        serde_yaml::from_str(&content).map_err(|error| {
            CliError::Usage(format!(
                "semantic review report at {} is invalid YAML: {error}",
                report_path.display()
            ))
        })?;
    Ok(ReworkReportContext {
        summary: document.semantic_review.summary,
        required_actions: document.semantic_review.required_actions,
        suggested_tests: document.semantic_review.suggested_tests,
        proposed_patch_description: document.semantic_review.proposed_patch.description,
    })
}

fn read_required_artifact(repo_root: &Path, path: &str) -> Result<String, CliError> {
    let artifact_path = path_from_ledger(repo_root, path);
    read_optional_text(&artifact_path)?.ok_or_else(|| {
        CliError::Usage(format!(
            "required rework artifact is missing at {}",
            artifact_path.display()
        ))
    })
}

struct ReworkInput<'a> {
    session: &'a Session,
    review_id: &'a str,
    merge_attempt_id: &'a str,
    report_context: &'a ReworkReportContext,
    fix_plan_artifact: &'a str,
    fix_plan_content: &'a str,
    patch_artifact: Option<&'a str>,
    patch_content: Option<&'a str>,
}

fn render_rework_input(input: ReworkInput<'_>) -> String {
    let mut output = String::new();
    output.push_str("# Aichestra Session Rework\n\n");
    output.push_str("Work only in the current session worktree. Do not edit the main worktree.\n");
    output.push_str("Apply the semantic review fix plan to this session branch only.\n");
    output.push_str("Do not approve, apply, merge to main, or clean up the session.\n\n");
    output.push_str(&format!("Session ID: {}\n", input.session.id));
    output.push_str(&format!("Goal: {}\n", input.session.goal));
    output.push_str(&format!("Provider: {}\n", input.session.provider));
    output.push_str(&format!("Branch: {}\n", input.session.branch));
    output.push_str(&format!("Base commit: {}\n", input.session.base_commit));
    output.push_str(&format!("Merge attempt: {}\n", input.merge_attempt_id));
    output.push_str(&format!("Semantic review: {}\n\n", input.review_id));

    output.push_str("## Review Summary\n\n");
    output.push_str(&input.report_context.summary);
    output.push_str("\n\n## Proposed Patch Description\n\n");
    if input
        .report_context
        .proposed_patch_description
        .trim()
        .is_empty()
    {
        output.push_str("_No description was provided._\n");
    } else {
        output.push_str(&input.report_context.proposed_patch_description);
        output.push('\n');
    }

    output.push_str("\n## Required Actions\n\n");
    append_markdown_list(&mut output, &input.report_context.required_actions);
    output.push_str("\n## Suggested Tests\n\n");
    append_markdown_list(&mut output, &input.report_context.suggested_tests);

    output.push_str("\n## Fix Plan Artifact\n\n");
    output.push_str(&format!("- path: `{}`\n\n", input.fix_plan_artifact));
    output.push_str("```markdown\n");
    output.push_str(input.fix_plan_content);
    if !input.fix_plan_content.ends_with('\n') {
        output.push('\n');
    }
    output.push_str("```\n");

    if let Some(patch_content) = input.patch_content {
        output.push_str("\n## Proposed Patch Artifact\n\n");
        output.push_str(&format!(
            "- path: `{}`\n\n",
            input.patch_artifact.unwrap_or("")
        ));
        output.push_str("```diff\n");
        output.push_str(patch_content);
        if !patch_content.ends_with('\n') {
            output.push('\n');
        }
        output.push_str("```\n");
    }

    output.push_str("\nWhen finished, leave the worktree changes for `aich session complete`.\n");
    output
}

fn append_markdown_list(output: &mut String, values: &[String]) {
    if values.is_empty() {
        output.push_str("- none\n");
        return;
    }
    for value in values {
        output.push_str(&format!("- {value}\n"));
    }
}

fn render_rework_metadata(
    session: &Session,
    review_id: &str,
    merge_attempt_id: &str,
    command: &str,
) -> String {
    format!(
        "{{\"session_id\":\"{}\",\"semantic_review_id\":\"{}\",\"merge_attempt_id\":\"{}\",\"provider\":\"{}\",\"command\":\"{}\"}}\n",
        json_escape(&session.id),
        json_escape(review_id),
        json_escape(merge_attempt_id),
        json_escape(&session.provider),
        json_escape(command)
    )
}

fn next_rework_id(created_at_ms: i64) -> String {
    let counter = REWORK_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{created_at_ms}-{counter}")
}

#[derive(Debug)]
struct ReworkArtifacts {
    artifact_dir: PathBuf,
    input_path: PathBuf,
    stdout_path: PathBuf,
    stderr_path: PathBuf,
    metadata_path: PathBuf,
}

impl ReworkArtifacts {
    fn new(aichestra_dir: &Path, session_id: &str, artifact_id: &str) -> Self {
        let artifact_dir = aichestra_dir
            .join("artifacts")
            .join("sessions")
            .join(session_id)
            .join("rework")
            .join(artifact_id);
        Self {
            input_path: artifact_dir.join("input.md"),
            stdout_path: artifact_dir.join("stdout.txt"),
            stderr_path: artifact_dir.join("stderr.txt"),
            metadata_path: artifact_dir.join("metadata.json"),
            artifact_dir,
        }
    }
}

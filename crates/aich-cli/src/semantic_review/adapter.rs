use std::io::Write;
use std::path::Path;
use std::process::{Command, Output, Stdio};

use aich_core::{ChangeManifest, ChangedFile, CheckResult, MergeAttempt, PatchSet, Session};

use crate::command_line::ProcessCommandSpec;
use crate::formatting::truncate_for_report;
use crate::{CliError, LOCAL_SEMANTIC_REVIEWER};

use super::parser::parse_semantic_review_command_report;
use super::report::{
    build_local_semantic_review_report, command_semantic_review_failure_report,
    llm_semantic_review_failure_report, render_semantic_review_input, DiffPatchContext,
    LocalSemanticReviewReport, RelatedChangeManifest, SemanticReviewInput,
};

pub(crate) struct SemanticReviewAdapterRequest<'a> {
    pub(crate) repo_root: &'a Path,
    pub(crate) session: &'a Session,
    pub(crate) attempt: &'a MergeAttempt,
    pub(crate) manifest: &'a ChangeManifest,
    pub(crate) manifest_content: Option<&'a str>,
    pub(crate) manifest_hash_mismatch: bool,
    pub(crate) patch_set: Option<&'a PatchSet>,
    pub(crate) diff_patch_context: Option<&'a DiffPatchContext>,
    pub(crate) changed_files: &'a [ChangedFile],
    pub(crate) check_results: &'a [CheckResult],
    pub(crate) related_manifests: &'a [RelatedChangeManifest],
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

pub(super) struct LocalSemanticReviewAdapter;

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

pub(super) struct CommandSemanticReviewAdapter {
    reviewer_id: String,
    command: ProcessCommandSpec,
}

impl CommandSemanticReviewAdapter {
    pub(super) fn new(reviewer_id: String, command: ProcessCommandSpec) -> Self {
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
            diff_patch_context: request.diff_patch_context,
            changed_files: request.changed_files,
            check_results: request.check_results,
            related_manifests: request.related_manifests,
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

pub(super) struct LlmSemanticReviewAdapter {
    reviewer_id: String,
    provider: String,
    command: ProcessCommandSpec,
}

impl LlmSemanticReviewAdapter {
    pub(super) fn new(reviewer_id: String, provider: String, command: ProcessCommandSpec) -> Self {
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
            diff_patch_context: request.diff_patch_context,
            changed_files: request.changed_files,
            check_results: request.check_results,
            related_manifests: request.related_manifests,
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

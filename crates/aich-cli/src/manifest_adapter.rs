use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use aich_core::{ChangedFile, ContextSnapshot, PatchSet, Session};
use aich_llm::{
    parse_change_manifest_command_output, render_change_manifest_input,
    ChangeManifestAgentRunInput, ChangeManifestInput,
};
use serde_yaml::{Mapping, Value};

use crate::command_line::{parse_process_command, ProcessCommandSpec};
use crate::config::{load_config, AichestraManifestConfig};
use crate::formatting::{
    display_path_for_ledger, path_from_ledger, read_optional_text, truncate_for_report,
};
use crate::manifest::{changed_files_missing_from_manifest, parse_manifest_diff_evidence};
use crate::{
    CliError, CHANGE_MANIFEST_COMMAND_STATUS, CHANGE_MANIFEST_LLM_STATUS,
    CHANGE_MANIFEST_VALIDATION_STATUS, COMMAND_CHANGE_MANIFEST_GENERATOR,
    GENERATED_CHANGE_MANIFEST_GENERATOR, LLM_CHANGE_MANIFEST_GENERATOR,
};

#[derive(Clone, Debug, Eq, PartialEq)]
enum ChangeManifestAdapterKind {
    Generated,
    Command,
    Llm,
}

impl ChangeManifestAdapterKind {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Generated => "generated",
            Self::Command => "command",
            Self::Llm => "llm",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ChangeManifestAdapterConfig {
    kind: ChangeManifestAdapterKind,
    provider: Option<String>,
    generator_id: Option<String>,
    model: Option<String>,
    profile: Option<String>,
    command: Option<ProcessCommandSpec>,
    timeout_ms: Option<u64>,
    prompt_path: String,
}

pub(crate) struct ChangeManifestBuildRequest<'a> {
    pub(crate) repo_root: &'a Path,
    pub(crate) aichestra_dir: &'a Path,
    pub(crate) config_path: &'a Path,
    pub(crate) artifact_dir: &'a Path,
    pub(crate) session: &'a Session,
    pub(crate) patch_set: &'a PatchSet,
    pub(crate) changed_files: &'a [ChangedFile],
    pub(crate) context_snapshot: &'a ContextSnapshot,
    pub(crate) generated_manifest: &'a str,
    pub(crate) diff_stat: &'a str,
    pub(crate) diff_patch: &'a str,
    pub(crate) diff_stat_path: &'a Path,
    pub(crate) diff_patch_path: &'a Path,
}

pub(crate) struct ChangeManifestBuildResult {
    pub(crate) content: String,
    pub(crate) validation_status: String,
}

pub(crate) fn build_change_manifest_content(
    request: ChangeManifestBuildRequest<'_>,
) -> Result<ChangeManifestBuildResult, CliError> {
    let config = change_manifest_adapter_config_from_config(request.config_path)?;
    match config.kind {
        ChangeManifestAdapterKind::Generated => Ok(ChangeManifestBuildResult {
            content: request.generated_manifest.to_string(),
            validation_status: CHANGE_MANIFEST_VALIDATION_STATUS.to_string(),
        }),
        ChangeManifestAdapterKind::Command | ChangeManifestAdapterKind::Llm => {
            build_provider_change_manifest(request, &config)
        }
    }
}

fn build_provider_change_manifest(
    request: ChangeManifestBuildRequest<'_>,
    config: &ChangeManifestAdapterConfig,
) -> Result<ChangeManifestBuildResult, CliError> {
    let command = match config.kind {
        ChangeManifestAdapterKind::Command => config.command.clone().ok_or_else(|| {
            CliError::Usage(
                "manifest.command must be configured when manifest.adapter is command".to_string(),
            )
        })?,
        ChangeManifestAdapterKind::Llm => llm_change_manifest_command_from_config(config)?,
        ChangeManifestAdapterKind::Generated => unreachable!(),
    };

    let generator_id = effective_generator_id(config);
    let validation_status = match config.kind {
        ChangeManifestAdapterKind::Command => CHANGE_MANIFEST_COMMAND_STATUS,
        ChangeManifestAdapterKind::Llm => CHANGE_MANIFEST_LLM_STATUS,
        ChangeManifestAdapterKind::Generated => CHANGE_MANIFEST_VALIDATION_STATUS,
    };
    let prompt_content =
        read_optional_text(&path_from_ledger(request.repo_root, &config.prompt_path))?;
    let latest_agent_run = latest_agent_run_input(
        request.repo_root,
        request.aichestra_dir,
        &request.session.id,
    )?;
    let adapter_input = render_change_manifest_input(ChangeManifestInput {
        generator_id: &generator_id,
        llm_executed: config.kind == ChangeManifestAdapterKind::Llm,
        session: request.session,
        patch_set: request.patch_set,
        changed_files: request.changed_files,
        context_snapshot: request.context_snapshot,
        generated_manifest: request.generated_manifest,
        diff_stat: request.diff_stat,
        diff_patch: request.diff_patch,
        diff_stat_path: request.diff_stat_path,
        diff_patch_path: request.diff_patch_path,
        prompt_path: &config.prompt_path,
        prompt_content: prompt_content.as_deref(),
        latest_agent_run: latest_agent_run.as_ref(),
    });

    let input_path = request.artifact_dir.join("change-manifest-input.md");
    let stdout_path = request.artifact_dir.join("change-manifest-stdout.txt");
    let stderr_path = request.artifact_dir.join("change-manifest-stderr.txt");
    let generated_draft_path = request.artifact_dir.join("change-manifest.generated.yaml");
    fs::write(&input_path, &adapter_input)?;
    fs::write(&generated_draft_path, request.generated_manifest)?;

    let output = run_change_manifest_command(
        &command,
        &adapter_input,
        request.repo_root,
        config.timeout_ms,
    )
    .map_err(|error| {
        CliError::Usage(format!(
            "Change Manifest {} adapter could not run command `{}`: {error}; input: {}",
            config.kind.as_str(),
            command.display(),
            input_path.display()
        ))
    })?;
    fs::write(&stdout_path, &output.stdout)?;
    fs::write(&stderr_path, &output.stderr)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(CliError::Usage(format!(
            "Change Manifest {} adapter command `{}` exited with {}; stderr: {}; input: {}; stdout: {}; stderr_artifact: {}",
            config.kind.as_str(),
            command.display(),
            output.status,
            truncate_for_report(stderr.trim(), 1_000),
            input_path.display(),
            stdout_path.display(),
            stderr_path.display()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let provider_manifest = parse_change_manifest_command_output(&stdout).map_err(|error| {
        CliError::Usage(format!(
            "Change Manifest {} adapter returned an invalid manifest: {error}; input: {}; stdout: {}; stderr: {}",
            config.kind.as_str(),
            input_path.display(),
            stdout_path.display(),
            stderr_path.display()
        ))
    })?;

    let content = trusted_change_manifest_content(
        &provider_manifest,
        TrustedManifestEvidence {
            repo_root: request.repo_root,
            session: request.session,
            patch_set: request.patch_set,
            context_snapshot: request.context_snapshot,
            diff_stat_path: request.diff_stat_path,
            diff_patch_path: request.diff_patch_path,
            validation_status,
            generator_id: &generator_id,
            adapter_kind: config.kind.as_str(),
        },
    )?;
    ensure_provider_manifest_matches_diff(
        &content,
        request.changed_files,
        config.kind.as_str(),
        &stdout_path,
    )?;

    Ok(ChangeManifestBuildResult {
        content,
        validation_status: validation_status.to_string(),
    })
}

struct TrustedManifestEvidence<'a> {
    repo_root: &'a Path,
    session: &'a Session,
    patch_set: &'a PatchSet,
    context_snapshot: &'a ContextSnapshot,
    diff_stat_path: &'a Path,
    diff_patch_path: &'a Path,
    validation_status: &'a str,
    generator_id: &'a str,
    adapter_kind: &'a str,
}

fn trusted_change_manifest_content(
    content: &str,
    evidence: TrustedManifestEvidence<'_>,
) -> Result<String, CliError> {
    let mut value = serde_yaml::from_str::<Value>(content).map_err(|error| {
        CliError::Usage(format!(
            "Change Manifest YAML could not be parsed after adapter output validation: {error}"
        ))
    })?;
    ensure_manifest_document(&value)?;

    set_nested_string(
        &mut value,
        &["change_manifest", "session_id"],
        &evidence.session.id,
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "goal"],
        &evidence.session.goal,
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "provider"],
        &evidence.session.provider,
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "branch"],
        &evidence.session.branch,
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "base_commit"],
        &evidence.session.base_commit,
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "head_commit"],
        evidence.patch_set.head_commit.as_deref().unwrap_or(""),
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "patch_id"],
        evidence.patch_set.patch_id.as_deref().unwrap_or(""),
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "evidence", "diff_stat_artifact"],
        &display_path_for_ledger(evidence.repo_root, evidence.diff_stat_path),
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "evidence", "diff_patch_artifact"],
        &display_path_for_ledger(evidence.repo_root, evidence.diff_patch_path),
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "evidence", "context_snapshot_hash"],
        &evidence.context_snapshot.snapshot_hash,
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "evidence", "validation_status"],
        evidence.validation_status,
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "evidence", "generator_id"],
        evidence.generator_id,
    );
    set_nested_string(
        &mut value,
        &["change_manifest", "evidence", "generator_adapter"],
        evidence.adapter_kind,
    );

    serde_yaml::to_string(&value).map_err(|error| {
        CliError::Usage(format!(
            "Change Manifest YAML could not be rendered after preserving trusted evidence: {error}"
        ))
    })
}

fn ensure_provider_manifest_matches_diff(
    content: &str,
    changed_files: &[ChangedFile],
    adapter_kind: &str,
    stdout_path: &Path,
) -> Result<(), CliError> {
    let evidence = parse_manifest_diff_evidence(content).map_err(|error| {
        CliError::Usage(format!(
            "Change Manifest {adapter_kind} adapter output could not be validated against diff evidence: {error}; stdout: {}",
            stdout_path.display()
        ))
    })?;
    let missing = changed_files_missing_from_manifest(changed_files, Some(&evidence));
    if missing.is_empty() {
        return Ok(());
    }

    Err(CliError::Usage(format!(
        "Change Manifest {adapter_kind} adapter output is missing changed file(s) from structured manifest evidence: {}. Fix the manifest generator output or switch manifest.adapter back to generated; stdout: {}",
        missing.join(", "),
        stdout_path.display()
    )))
}

fn latest_agent_run_input(
    repo_root: &Path,
    aichestra_dir: &Path,
    session_id: &str,
) -> Result<Option<ChangeManifestAgentRunInput>, CliError> {
    let runs_dir = aichestra_dir
        .join("artifacts")
        .join("sessions")
        .join(session_id)
        .join("runs");
    let entries = match fs::read_dir(&runs_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(CliError::Io(error)),
    };

    let mut run_dirs = Vec::new();
    for entry in entries {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            run_dirs.push(entry.path());
        }
    }
    run_dirs.sort_by(|left, right| left.file_name().cmp(&right.file_name()));
    let Some(run_dir) = run_dirs.pop() else {
        return Ok(None);
    };

    let input_path = run_dir.join("input.md");
    let stdout_path = run_dir.join("stdout.txt");
    let stderr_path = run_dir.join("stderr.txt");
    let metadata_path = run_dir.join("metadata.json");

    Ok(Some(ChangeManifestAgentRunInput {
        artifact_dir: display_path_for_ledger(repo_root, &run_dir),
        input_path: display_path_for_ledger(repo_root, &input_path),
        stdout_path: display_path_for_ledger(repo_root, &stdout_path),
        stderr_path: display_path_for_ledger(repo_root, &stderr_path),
        metadata_path: display_path_for_ledger(repo_root, &metadata_path),
        stdout_content: read_optional_text(&stdout_path)?,
        stderr_content: read_optional_text(&stderr_path)?,
    }))
}

fn change_manifest_adapter_config_from_config(
    config_path: &Path,
) -> Result<ChangeManifestAdapterConfig, CliError> {
    let manifest = manifest_config(config_path)?;
    let kind = trim_config_value(manifest.adapter)
        .map(|adapter| parse_manifest_adapter_kind(&adapter))
        .transpose()?
        .unwrap_or(ChangeManifestAdapterKind::Generated);
    let command = trim_config_value(manifest.command)
        .as_deref()
        .map(|line| parse_process_command("manifest.command", line))
        .transpose()?;
    let timeout_ms = manifest_timeout_ms(manifest.timeout_ms, manifest.timeout_seconds)?;
    let prompt_path = trim_config_value(manifest.prompt_path)
        .unwrap_or_else(|| ".aichestra/prompts/change-manifest.md".to_string());

    Ok(ChangeManifestAdapterConfig {
        kind,
        provider: trim_config_value(manifest.generator_provider),
        generator_id: trim_config_value(manifest.generator_id),
        model: trim_config_value(manifest.model),
        profile: trim_config_value(manifest.profile),
        command,
        timeout_ms,
        prompt_path,
    })
}

fn manifest_config(config_path: &Path) -> Result<AichestraManifestConfig, CliError> {
    Ok(load_config(config_path)?.manifest.unwrap_or_default())
}

fn parse_manifest_adapter_kind(value: &str) -> Result<ChangeManifestAdapterKind, CliError> {
    match value.trim() {
        "generated" | "local" => Ok(ChangeManifestAdapterKind::Generated),
        "command" => Ok(ChangeManifestAdapterKind::Command),
        "llm" => Ok(ChangeManifestAdapterKind::Llm),
        other => Err(CliError::Usage(format!(
            "manifest.adapter must be 'generated', 'command', or 'llm', got '{other}'"
        ))),
    }
}

fn llm_change_manifest_command_from_config(
    config: &ChangeManifestAdapterConfig,
) -> Result<ProcessCommandSpec, CliError> {
    if let Some(command) = config.command.clone() {
        return Ok(command);
    }

    let provider = config.provider.as_deref().unwrap_or("codex");
    match provider {
        "codex" => Ok(codex_change_manifest_command(
            config.model.as_deref(),
            config.profile.as_deref(),
        )),
        "custom" => Err(CliError::Usage(
            "manifest.command must be configured when manifest.adapter is llm and generator_provider is custom"
                .to_string(),
        )),
        other => Err(CliError::Usage(format!(
            "manifest.generator_provider '{other}' is not supported by the built-in LLM adapter; configure manifest.command or use adapter: command"
        ))),
    }
}

fn codex_change_manifest_command(model: Option<&str>, profile: Option<&str>) -> ProcessCommandSpec {
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

fn effective_generator_id(config: &ChangeManifestAdapterConfig) -> String {
    match config.kind {
        ChangeManifestAdapterKind::Generated => GENERATED_CHANGE_MANIFEST_GENERATOR.to_string(),
        ChangeManifestAdapterKind::Command => config
            .generator_id
            .clone()
            .unwrap_or_else(|| COMMAND_CHANGE_MANIFEST_GENERATOR.to_string()),
        ChangeManifestAdapterKind::Llm => {
            let provider = config.provider.as_deref().unwrap_or("codex");
            config
                .generator_id
                .clone()
                .unwrap_or_else(|| format!("{provider}_{LLM_CHANGE_MANIFEST_GENERATOR}"))
        }
    }
}

fn manifest_timeout_ms(
    timeout_ms: Option<u64>,
    timeout_seconds: Option<u64>,
) -> Result<Option<u64>, CliError> {
    match (timeout_ms, timeout_seconds) {
        (Some(_), Some(_)) => Err(CliError::Usage(
            "manifest must use only one of timeout_ms or timeout_seconds".to_string(),
        )),
        (Some(0), None) | (None, Some(0)) => Err(CliError::Usage(
            "manifest timeout must be greater than zero".to_string(),
        )),
        (Some(value), None) => Ok(Some(value)),
        (None, Some(value)) => value
            .checked_mul(1_000)
            .map(Some)
            .ok_or_else(|| CliError::Usage("manifest.timeout_seconds is too large".to_string())),
        (None, None) => Ok(None),
    }
}

fn trim_config_value(value: Option<String>) -> Option<String> {
    value.and_then(trim_string_value)
}

fn trim_string_value(value: String) -> Option<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn run_change_manifest_command(
    command_spec: &ProcessCommandSpec,
    adapter_input: &str,
    working_dir: &Path,
    timeout_ms: Option<u64>,
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
                "failed to spawn Change Manifest command `{}`: {error}",
                command_spec.display()
            )
        })?;

    let input = adapter_input.as_bytes().to_vec();
    let command_display = command_spec.display();
    let write_handle = match child.stdin.take() {
        Some(mut stdin) => thread::spawn(move || {
            stdin.write_all(&input).map_err(|error| {
                format!(
                    "failed to write Change Manifest input to command `{command_display}` stdin: {error}"
                )
            })
        }),
        None => {
            return Err(format!(
                "failed to open stdin for Change Manifest command `{}`",
                command_spec.display()
            ))
        }
    };

    let output_result = wait_with_optional_timeout(child, command_spec, timeout_ms);
    let write_result = write_handle.join().map_err(|_| {
        format!(
            "Change Manifest command `{}` stdin writer panicked",
            command_spec.display()
        )
    })?;
    let output = output_result?;

    if let Err(error) = write_result {
        if output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!(
                "{error}; stderr: {}",
                truncate_for_report(stderr.trim(), 1_000)
            ));
        }
    }

    Ok(output)
}

fn wait_with_optional_timeout(
    mut child: std::process::Child,
    command_spec: &ProcessCommandSpec,
    timeout_ms: Option<u64>,
) -> Result<Output, String> {
    let Some(timeout_ms) = timeout_ms else {
        return child.wait_with_output().map_err(|error| {
            format!(
                "failed to wait for Change Manifest command `{}`: {error}",
                command_spec.display()
            )
        });
    };

    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    loop {
        match child.try_wait() {
            Ok(Some(_status)) => {
                return child.wait_with_output().map_err(|error| {
                    format!(
                        "failed to collect Change Manifest command `{}` output: {error}",
                        command_spec.display()
                    )
                });
            }
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let output = child.wait_with_output().map_err(|error| {
                    format!(
                        "Change Manifest command `{}` timed out after {timeout_ms}ms and failed to collect output after kill: {error}",
                        command_spec.display()
                    )
                })?;
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!(
                    "Change Manifest command `{}` timed out after {timeout_ms}ms; stderr: {}",
                    command_spec.display(),
                    truncate_for_report(stderr.trim(), 1_000)
                ));
            }
            Ok(None) => thread::sleep(Duration::from_millis(10)),
            Err(error) => {
                return Err(format!(
                    "failed to wait for Change Manifest command `{}`: {error}",
                    command_spec.display()
                ));
            }
        }
    }
}

fn ensure_manifest_document(value: &Value) -> Result<(), CliError> {
    match nested_value(value, &["change_manifest"]) {
        Some(Value::Mapping(_)) => Ok(()),
        Some(_) => Err(CliError::Usage(
            "Change Manifest YAML top-level change_manifest value must be a mapping".to_string(),
        )),
        None => Err(CliError::Usage(
            "Change Manifest YAML must contain a top-level change_manifest mapping".to_string(),
        )),
    }
}

fn nested_value<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = value;
    for key in path {
        let mapping = match current {
            Value::Mapping(mapping) => mapping,
            _ => return None,
        };
        current = mapping.get(Value::String((*key).to_string()))?;
    }
    Some(current)
}

fn set_nested_string(root: &mut Value, path: &[&str], value: &str) {
    let Some((last, parents)) = path.split_last() else {
        return;
    };
    let parent = ensure_nested_mapping(root, parents);
    parent.insert(
        Value::String((*last).to_string()),
        Value::String(value.to_string()),
    );
}

fn ensure_nested_mapping<'a>(root: &'a mut Value, path: &[&str]) -> &'a mut Mapping {
    let mut current = root;
    for key in path {
        let mapping = ensure_mapping(current);
        let key_value = Value::String((*key).to_string());
        let needs_mapping = !matches!(mapping.get(&key_value), Some(Value::Mapping(_)));
        if needs_mapping {
            mapping.insert(key_value.clone(), Value::Mapping(Mapping::new()));
        }
        current = mapping
            .get_mut(&key_value)
            .expect("mapping value was just inserted");
    }
    ensure_mapping(current)
}

fn ensure_mapping(value: &mut Value) -> &mut Mapping {
    if !matches!(value, Value::Mapping(_)) {
        *value = Value::Mapping(Mapping::new());
    }
    match value {
        Value::Mapping(mapping) => mapping,
        _ => unreachable!(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn built_in_llm_manifest_command_uses_read_only_codex_exec() {
        let command = codex_change_manifest_command(Some("gpt-test"), Some("profile-test"));

        assert_eq!(command.program, "codex");
        assert!(command
            .args
            .windows(2)
            .any(|args| args == ["--sandbox", "read-only"]));
        assert!(command
            .args
            .windows(2)
            .any(|args| args == ["--model", "gpt-test"]));
        assert!(command
            .args
            .windows(2)
            .any(|args| args == ["--profile", "profile-test"]));
        assert_eq!(command.args.last().map(String::as_str), Some("-"));
    }
}

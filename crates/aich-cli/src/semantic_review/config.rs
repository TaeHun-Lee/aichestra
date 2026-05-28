use std::path::Path;

use aich_core::SemanticRiskLevel;

use crate::command_line::{parse_process_command, ProcessCommandSpec};
use crate::config::{load_config, AichestraSemanticReviewConfig};
use crate::CliError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) enum SemanticReviewAdapterKind {
    Local,
    Command,
    Llm,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct SemanticReviewAdapterConfig {
    pub(super) kind: SemanticReviewAdapterKind,
    pub(super) provider: Option<String>,
    pub(super) reviewer_id: Option<String>,
    pub(super) model: Option<String>,
    pub(super) profile: Option<String>,
    pub(super) command: Option<ProcessCommandSpec>,
    pub(super) timeout_ms: Option<u64>,
}

pub(super) fn semantic_review_adapter_config_from_config(
    config_path: &Path,
) -> Result<SemanticReviewAdapterConfig, CliError> {
    let semantic_review = semantic_review_config(config_path)?;
    let legacy_provider = trim_config_value(semantic_review.reviewer_provider);
    let kind = trim_config_value(semantic_review.adapter)
        .map(|adapter| parse_semantic_review_adapter_kind(&adapter))
        .transpose()?
        .unwrap_or_else(|| {
            if legacy_provider.as_deref() == Some("command") {
                SemanticReviewAdapterKind::Command
            } else {
                SemanticReviewAdapterKind::Local
            }
        });
    let command_line = trim_config_value(semantic_review.command);
    let command = command_line
        .as_deref()
        .map(|line| parse_process_command("semantic_review.command", line))
        .transpose()?;

    Ok(SemanticReviewAdapterConfig {
        kind,
        provider: legacy_provider,
        reviewer_id: trim_config_value(semantic_review.reviewer_id),
        model: trim_config_value(semantic_review.model),
        profile: trim_config_value(semantic_review.profile),
        command,
        timeout_ms: semantic_review_timeout_ms(
            semantic_review.timeout_ms,
            semantic_review.timeout_seconds,
        )?,
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

pub(super) fn llm_semantic_review_command_from_config(
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

pub(super) fn semantic_review_prompt_path_from_config(config_path: &Path) -> String {
    semantic_review_config(config_path)
        .ok()
        .and_then(|config| trim_config_value(config.prompt_path))
        .unwrap_or_else(|| ".aichestra/prompts/semantic-merge-review.md".to_string())
}

pub(super) fn semantic_block_levels_from_config(
    config_path: &Path,
) -> Result<Vec<SemanticRiskLevel>, CliError> {
    let semantic_review = semantic_review_config(config_path)?;
    let mut block_levels = semantic_review
        .risk_block_levels
        .unwrap_or_default()
        .into_iter()
        .filter_map(trim_string_value)
        .map(|level| SemanticRiskLevel::parse(&level).map_err(CliError::Usage))
        .collect::<Result<Vec<_>, _>>()?;

    if block_levels.is_empty() {
        block_levels.push(SemanticRiskLevel::Blocked);
    }

    Ok(block_levels)
}

fn semantic_review_config(config_path: &Path) -> Result<AichestraSemanticReviewConfig, CliError> {
    Ok(load_config(config_path)?
        .semantic_review
        .unwrap_or_default())
}

fn semantic_review_timeout_ms(
    timeout_ms: Option<u64>,
    timeout_seconds: Option<u64>,
) -> Result<Option<u64>, CliError> {
    match (timeout_ms, timeout_seconds) {
        (Some(_), Some(_)) => Err(CliError::Usage(
            "semantic_review must use only one of timeout_ms or timeout_seconds".to_string(),
        )),
        (Some(0), None) | (None, Some(0)) => Err(CliError::Usage(
            "semantic_review timeout must be greater than zero".to_string(),
        )),
        (Some(value), None) => Ok(Some(value)),
        (None, Some(value)) => value.checked_mul(1_000).map(Some).ok_or_else(|| {
            CliError::Usage("semantic_review.timeout_seconds is too large".to_string())
        }),
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

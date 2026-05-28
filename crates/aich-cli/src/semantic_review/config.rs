use std::path::Path;

use aich_core::{SemanticReview, SemanticRiskLevel};

use crate::command_line::{parse_process_command, ProcessCommandSpec};
use crate::config::{load_config, AichestraSemanticReviewConfig};
use crate::formatting::{path_from_ledger, read_optional_text, sha256_hex};
use crate::{CliError, COMMAND_SEMANTIC_REVIEWER, LLM_SEMANTIC_REVIEWER, LOCAL_SEMANTIC_REVIEWER};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) enum SemanticReviewAdapterKind {
    Local,
    Command,
    Llm,
}

impl SemanticReviewAdapterKind {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::Command => "command",
            Self::Llm => "llm",
        }
    }
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

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub(crate) enum SemanticReviewPolicyStaleReason {
    LegacySemanticReviewPolicyEvidence,
    SemanticReviewPolicyChanged,
}

impl SemanticReviewPolicyStaleReason {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::LegacySemanticReviewPolicyEvidence => "legacy_semantic_review_policy_evidence",
            Self::SemanticReviewPolicyChanged => "semantic_review_policy_changed",
        }
    }

    pub(crate) fn legacy_hint(self) -> Option<&'static str> {
        match self {
            Self::LegacySemanticReviewPolicyEvidence => Some(
                "This semantic review was created before review policy fingerprints were recorded.",
            ),
            Self::SemanticReviewPolicyChanged => None,
        }
    }
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

pub(crate) fn semantic_review_policy_fingerprint_from_config(
    repo_root: &Path,
    config_path: &Path,
) -> Result<String, CliError> {
    let adapter_config = semantic_review_adapter_config_from_config(config_path)?;
    let block_levels = semantic_block_levels_from_config(config_path)?;
    let prompt_path = semantic_review_prompt_path_from_config(config_path);
    let prompt_content = read_optional_text(&path_from_ledger(repo_root, &prompt_path))?;
    let effective_reviewer_id = effective_reviewer_id(&adapter_config);
    let effective_command = effective_adapter_command(&adapter_config)?;
    let timeout_ms = adapter_config
        .timeout_ms
        .as_ref()
        .map(|timeout_ms| timeout_ms.to_string());
    let configured_command = adapter_config
        .command
        .as_ref()
        .map(ProcessCommandSpec::display);

    let mut input = String::new();
    push_field(&mut input, "adapter_kind", adapter_config.kind.as_str());
    push_option_field(&mut input, "provider", adapter_config.provider.as_deref());
    push_field(&mut input, "effective_reviewer_id", &effective_reviewer_id);
    push_option_field(
        &mut input,
        "configured_reviewer_id",
        adapter_config.reviewer_id.as_deref(),
    );
    push_option_field(&mut input, "model", adapter_config.model.as_deref());
    push_option_field(&mut input, "profile", adapter_config.profile.as_deref());
    push_option_field(&mut input, "timeout_ms", timeout_ms.as_deref());
    push_option_field(
        &mut input,
        "configured_command",
        configured_command.as_deref(),
    );
    match effective_command.as_ref() {
        Some(command) => push_command(&mut input, "effective_command", command),
        None => push_field(&mut input, "effective_command", "none"),
    }
    let mut block_level_values = block_levels
        .iter()
        .map(|level| level.as_str())
        .collect::<Vec<_>>();
    block_level_values.sort();
    block_level_values.dedup();
    for level in block_level_values {
        push_field(&mut input, "risk_block_level", level);
    }
    push_field(&mut input, "prompt_path", &prompt_path);
    match prompt_content {
        Some(content) => push_field(
            &mut input,
            "prompt_content_hash",
            &sha256_hex(content.as_bytes()),
        ),
        None => push_field(&mut input, "prompt_content_hash", "missing"),
    }

    Ok(sha256_hex(input.as_bytes()))
}

pub(crate) fn semantic_review_policy_stale_reasons(
    review: &SemanticReview,
    current_fingerprint: &str,
) -> Vec<SemanticReviewPolicyStaleReason> {
    match review.semantic_review_policy_fingerprint.as_deref() {
        Some(stored) if stored == current_fingerprint => Vec::new(),
        Some(_) => vec![SemanticReviewPolicyStaleReason::SemanticReviewPolicyChanged],
        None => vec![SemanticReviewPolicyStaleReason::LegacySemanticReviewPolicyEvidence],
    }
}

pub(crate) fn ensure_semantic_review_policy_current(
    review: &SemanticReview,
    repo_root: &Path,
    config_path: &Path,
    session_id: &str,
) -> Result<(), CliError> {
    let current_fingerprint =
        semantic_review_policy_fingerprint_from_config(repo_root, config_path)?;
    let stale_reasons = semantic_review_policy_stale_reasons(review, &current_fingerprint);
    if stale_reasons.is_empty() {
        return Ok(());
    }

    let reasons = stale_reasons
        .iter()
        .map(|reason| reason.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    let legacy_hint = stale_reasons
        .iter()
        .find_map(|reason| reason.legacy_hint())
        .map(|hint| format!(" {hint}"));
    Err(CliError::Usage(format!(
        "Semantic review '{}' policy is stale ({reasons}).{} Run `aich review {}` again before approval or apply.",
        review.id,
        legacy_hint.unwrap_or_default(),
        session_id
    )))
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

fn effective_reviewer_id(config: &SemanticReviewAdapterConfig) -> String {
    match config.kind {
        SemanticReviewAdapterKind::Local => LOCAL_SEMANTIC_REVIEWER.to_string(),
        SemanticReviewAdapterKind::Command => config
            .reviewer_id
            .clone()
            .unwrap_or_else(|| COMMAND_SEMANTIC_REVIEWER.to_string()),
        SemanticReviewAdapterKind::Llm => {
            let provider = config.provider.as_deref().unwrap_or("codex");
            config
                .reviewer_id
                .clone()
                .unwrap_or_else(|| format!("{provider}_{LLM_SEMANTIC_REVIEWER}"))
        }
    }
}

fn effective_adapter_command(
    config: &SemanticReviewAdapterConfig,
) -> Result<Option<ProcessCommandSpec>, CliError> {
    match config.kind {
        SemanticReviewAdapterKind::Local => Ok(None),
        SemanticReviewAdapterKind::Command => Ok(config.command.clone()),
        SemanticReviewAdapterKind::Llm => llm_semantic_review_command_from_config(config).map(Some),
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

fn push_command(output: &mut String, prefix: &str, command: &ProcessCommandSpec) {
    push_field(output, &format!("{prefix}.program"), &command.program);
    for (index, arg) in command.args.iter().enumerate() {
        push_field(output, &format!("{prefix}.arg.{index}"), arg);
    }
}

fn push_field(output: &mut String, key: &str, value: &str) {
    output.push_str(key);
    output.push('\0');
    output.push_str(value);
    output.push('\0');
}

fn push_option_field(output: &mut String, key: &str, value: Option<&str>) {
    match value {
        Some(value) => {
            output.push_str(key);
            output.push_str("\0some\0");
            output.push_str(value);
            output.push('\0');
        }
        None => {
            output.push_str(key);
            output.push_str("\0none\0");
        }
    }
}

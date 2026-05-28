use std::collections::HashMap;
use std::fs;
use std::path::Path;

use serde::Deserialize;

use crate::CliError;

const DEFAULT_MAIN_BRANCH: &str = "main";
const DEFAULT_SESSION_BRANCH_PREFIX: &str = "aich/session";

pub(crate) const DEFAULT_CONFIG: &str = r#"project:
  name: aichestra-local-mvp
  mode: local-single-user

storage:
  sqlite_path: .aichestra/aichestra.db
  artifact_dir: .aichestra/artifacts
  worktree_dir: .aichestra/worktrees
  sandbox_dir: .aichestra/sandboxes

sessions:
  branch_prefix: aich/session
  require_dedicated_worktree: true
  disallow_main_worktree_for_llm: true
  completion_trigger: human_command

providers:
  codex:
    command: codex --ask-for-approval never exec --sandbox workspace-write --skip-git-repo-check --ephemeral --color never -

git:
  main_branch: main

auth:
  default_operator_id: local-user
  require_active_operator: true

merge:
  queue_mode: sequential
  sandbox_strategy: temporary_worktree
  apply_policy: verified_tree_only
  require_human_approval: true
  block_if_main_moved_after_preflight: true
  semantic_review_required: true

manifest:
  required: true
  validate_against_diff: true
  warn_on_context_hash_change: true
  block_on_manifest_diff_mismatch: false

checks:
  commands:
    - name: fmt
      command: cargo fmt --all -- --check
      required: true
      timeout_seconds: 600
    - name: clippy
      command: cargo clippy --all-targets -- -D warnings
      required: true
      timeout_seconds: 600
    - name: test
      command: cargo test --all
      required: true
      timeout_seconds: 600

semantic_review:
  adapter: local
  reviewer_id: local_mvp_static_reviewer
  prompt_path: .aichestra/prompts/semantic-merge-review.md
  timeout_seconds: 600
  risk_block_levels:
    - blocked
  allow_patch_suggestions: true
  auto_apply_patch_suggestions: false

context:
  files:
    - AGENTS.md
    - CLAUDE.md
    - .aichestra/config.yaml
    - .aichestra/prompts/change-manifest.md
    - .aichestra/prompts/semantic-merge-review.md
  hash_algorithm: sha256

safety:
  warn_if_main_dirty: true
  refuse_apply_if_main_dirty: true
  refuse_force_push_features: true
"#;

pub(crate) const DEFAULT_CHANGE_MANIFEST_PROMPT: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../.aichestra/prompts/change-manifest.md"
));
pub(crate) const DEFAULT_SEMANTIC_REVIEW_PROMPT: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../.aichestra/prompts/semantic-merge-review.md"
));
pub(crate) const DEFAULT_CHANGE_MANIFEST_TEMPLATE: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../.aichestra/templates/change-manifest.yaml"
));
pub(crate) const DEFAULT_CHANGE_MANIFEST_SCHEMA: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../.aichestra/schemas/change-manifest.schema.yaml"
));

#[derive(Clone, Debug, Default, Deserialize)]
pub(crate) struct AichestraConfig {
    pub(crate) git: Option<AichestraGitConfig>,
    pub(crate) providers: Option<HashMap<String, AichestraProviderConfig>>,
    pub(crate) sessions: Option<AichestraSessionConfig>,
    pub(crate) checks: Option<AichestraChecksConfig>,
    pub(crate) semantic_review: Option<AichestraSemanticReviewConfig>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct AichestraGitConfig {
    pub(crate) main_branch: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct AichestraProviderConfig {
    pub(crate) command: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct AichestraSessionConfig {
    pub(crate) branch_prefix: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub(crate) struct AichestraChecksConfig {
    pub(crate) commands: Option<Vec<AichestraCheckCommandConfig>>,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub(crate) struct AichestraCheckCommandConfig {
    pub(crate) name: Option<String>,
    pub(crate) command: Option<String>,
    pub(crate) required: Option<bool>,
    pub(crate) timeout_ms: Option<u64>,
    pub(crate) timeout_seconds: Option<u64>,
    pub(crate) env: Option<HashMap<String, String>>,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub(crate) struct AichestraSemanticReviewConfig {
    pub(crate) adapter: Option<String>,
    pub(crate) reviewer_provider: Option<String>,
    pub(crate) reviewer_id: Option<String>,
    pub(crate) model: Option<String>,
    pub(crate) profile: Option<String>,
    pub(crate) command: Option<String>,
    pub(crate) prompt_path: Option<String>,
    pub(crate) timeout_ms: Option<u64>,
    pub(crate) timeout_seconds: Option<u64>,
    pub(crate) risk_block_levels: Option<Vec<String>>,
}

pub(crate) fn load_config(config_path: &Path) -> Result<AichestraConfig, CliError> {
    let config = fs::read_to_string(config_path)?;
    serde_yaml::from_str(&config).map_err(|error| {
        CliError::Usage(format!(
            "Aichestra config at {} is invalid YAML: {error}",
            config_path.display()
        ))
    })
}

pub(crate) fn session_branch_prefix_from_config(config_path: &Path) -> Result<String, CliError> {
    let parsed = load_config(config_path)?;
    let configured = parsed
        .sessions
        .and_then(|sessions| sessions.branch_prefix)
        .unwrap_or_else(|| DEFAULT_SESSION_BRANCH_PREFIX.to_string());
    normalize_session_branch_prefix(&configured)
}

pub(crate) fn provider_command_from_config(
    config_path: &Path,
    provider: &str,
) -> Result<String, CliError> {
    let provider = provider.trim();
    if provider.is_empty() {
        return Err(CliError::Usage(
            "session provider must not be empty".to_string(),
        ));
    }

    let parsed = load_config(config_path)?;
    let Some(provider_config) = parsed
        .providers
        .and_then(|providers| providers.get(provider).cloned())
    else {
        return Err(CliError::Usage(format!(
            "provider '{provider}' is not configured; add providers.{provider}.command to {}",
            config_path.display()
        )));
    };
    let Some(command) = provider_config
        .command
        .filter(|command| !command.trim().is_empty())
    else {
        return Err(CliError::Usage(format!(
            "providers.{provider}.command must not be empty"
        )));
    };
    Ok(command)
}

pub(crate) fn main_branch_from_config(config_path: &Path) -> Result<String, CliError> {
    let parsed = load_config(config_path)?;
    let configured = parsed
        .git
        .and_then(|git| git.main_branch)
        .unwrap_or_else(|| DEFAULT_MAIN_BRANCH.to_string());
    normalize_main_branch_name(&configured)
}

fn normalize_main_branch_name(value: &str) -> Result<String, CliError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(CliError::Usage(
            "git.main_branch must not be empty".to_string(),
        ));
    }
    if let Some(branch) = trimmed.strip_prefix("refs/heads/") {
        let branch = branch.trim();
        if branch.is_empty() {
            return Err(CliError::Usage(
                "git.main_branch must name a local branch".to_string(),
            ));
        }
        return Ok(branch.to_string());
    }
    if trimmed.starts_with("refs/") {
        return Err(CliError::Usage(
            "git.main_branch must be a local branch name or refs/heads/<branch>".to_string(),
        ));
    }
    Ok(trimmed.to_string())
}

fn normalize_session_branch_prefix(value: &str) -> Result<String, CliError> {
    let trimmed = value.trim().trim_matches('/');
    if trimmed.is_empty() {
        return Err(CliError::Usage(
            "sessions.branch_prefix must not be empty".to_string(),
        ));
    }
    if trimmed.starts_with("refs/") {
        return Err(CliError::Usage(
            "sessions.branch_prefix must be a branch-name prefix, not a full ref".to_string(),
        ));
    }
    if trimmed.chars().any(char::is_whitespace) {
        return Err(CliError::Usage(
            "sessions.branch_prefix must not contain whitespace".to_string(),
        ));
    }
    Ok(trimmed.to_string())
}

pub(crate) fn main_branch_ref(main_branch: &str) -> String {
    format!("refs/heads/{main_branch}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_plain_main_branch_name() {
        assert_eq!(
            normalize_main_branch_name(" trunk ").expect("normalize"),
            "trunk"
        );
    }

    #[test]
    fn normalizes_heads_ref_to_branch_name() {
        assert_eq!(
            normalize_main_branch_name("refs/heads/main").expect("normalize"),
            "main"
        );
    }

    #[test]
    fn rejects_non_heads_ref_for_main_branch() {
        let err = normalize_main_branch_name("refs/tags/v1").unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("local branch")));
    }

    #[test]
    fn normalizes_session_branch_prefix() {
        assert_eq!(
            normalize_session_branch_prefix(" custom/session/ ").expect("normalize"),
            "custom/session"
        );
    }

    #[test]
    fn rejects_invalid_session_branch_prefix() {
        let err = normalize_session_branch_prefix("refs/heads/aich/session").unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("branch-name prefix")));
    }
}

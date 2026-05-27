use std::fs;
use std::path::Path;

use serde::Deserialize;

use crate::CliError;

const DEFAULT_MAIN_BRANCH: &str = "main";

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
    - name: clippy
      command: cargo clippy --all-targets -- -D warnings
      required: true
    - name: test
      command: cargo test --all
      required: true

semantic_review:
  adapter: local
  reviewer_id: local_mvp_static_reviewer
  prompt_path: .aichestra/prompts/semantic-merge-review.md
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

#[derive(Debug, Deserialize)]
struct AichestraConfig {
    git: Option<AichestraGitConfig>,
}

#[derive(Debug, Deserialize)]
struct AichestraGitConfig {
    main_branch: Option<String>,
}

pub(crate) fn main_branch_from_config(config_path: &Path) -> Result<String, CliError> {
    let config = fs::read_to_string(config_path)?;
    let parsed: AichestraConfig = serde_yaml::from_str(&config).map_err(|error| {
        CliError::Usage(format!(
            "Aichestra config at {} is invalid YAML: {error}",
            config_path.display()
        ))
    })?;
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
}

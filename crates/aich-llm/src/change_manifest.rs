use std::path::Path;

use aich_core::{ChangedFile, ContextSnapshot, PatchSet, Session};
use serde_yaml::Value;

const MANIFEST_TEXT_CONTEXT_MAX_CHARS: usize = 60_000;
const AGENT_LOG_CONTEXT_MAX_CHARS: usize = 20_000;

pub struct ChangeManifestInput<'a> {
    pub generator_id: &'a str,
    pub llm_executed: bool,
    pub session: &'a Session,
    pub patch_set: &'a PatchSet,
    pub changed_files: &'a [ChangedFile],
    pub context_snapshot: &'a ContextSnapshot,
    pub generated_manifest: &'a str,
    pub diff_stat: &'a str,
    pub diff_patch: &'a str,
    pub diff_stat_path: &'a Path,
    pub diff_patch_path: &'a Path,
    pub prompt_path: &'a str,
    pub prompt_content: Option<&'a str>,
    pub latest_agent_run: Option<&'a ChangeManifestAgentRunInput>,
}

pub struct ChangeManifestAgentRunInput {
    pub artifact_dir: String,
    pub input_path: String,
    pub stdout_path: String,
    pub stderr_path: String,
    pub metadata_path: String,
    pub stdout_content: Option<String>,
    pub stderr_content: Option<String>,
}

pub fn render_change_manifest_input(input: ChangeManifestInput<'_>) -> String {
    let mut output = String::new();
    output.push_str("# Change Manifest Generation Input\n\n");
    append_adapter_output_contract(&mut output);
    output.push_str(&format!("- generator: `{}`\n", input.generator_id));
    output.push_str(&format!("- llm_executed: `{}`\n", input.llm_executed));
    output.push_str(&format!("- session_id: `{}`\n", input.session.id));
    output.push_str(&format!("- goal: `{}`\n", input.session.goal));
    output.push_str(&format!("- provider: `{}`\n", input.session.provider));
    output.push_str(&format!("- branch: `{}`\n", input.session.branch));
    output.push_str(&format!("- base_commit: `{}`\n", input.session.base_commit));
    output.push_str(&format!(
        "- head_commit: `{}`\n",
        input.patch_set.head_commit.as_deref().unwrap_or("")
    ));
    output.push_str(&format!(
        "- patch_id: `{}`\n",
        input.patch_set.patch_id.as_deref().unwrap_or("")
    ));
    output.push_str(&format!(
        "- context_snapshot_hash: `{}`\n",
        input.context_snapshot.snapshot_hash
    ));
    output.push_str(&format!("- prompt_path: `{}`\n", input.prompt_path));

    output.push_str("\n## Generated Manifest Draft\n\n");
    output.push_str(
        "Use this generated draft as the starting point. You may improve intent, risk, test, purpose, semantic_impact, before, and after fields. Aichestra will preserve immutable identity and diff evidence fields after your response.\n\n",
    );
    output.push_str("```yaml\n");
    output.push_str(input.generated_manifest);
    if !input.generated_manifest.ends_with('\n') {
        output.push('\n');
    }
    output.push_str("```\n\n");

    output.push_str("## Diff Evidence\n\n");
    output.push_str(&format!(
        "- diff_stat_artifact: `{}`\n",
        input.diff_stat_path.display()
    ));
    output.push_str(&format!(
        "- diff_patch_artifact: `{}`\n",
        input.diff_patch_path.display()
    ));
    output.push_str("\n### Diff Stat\n\n");
    append_fenced_limited(
        &mut output,
        "text",
        input.diff_stat,
        MANIFEST_TEXT_CONTEXT_MAX_CHARS,
    );
    output.push_str("\n### Diff Patch\n\n");
    append_fenced_limited(
        &mut output,
        "diff",
        input.diff_patch,
        MANIFEST_TEXT_CONTEXT_MAX_CHARS,
    );

    output.push_str("\n## Changed Files\n\n");
    if input.changed_files.is_empty() {
        output.push_str("- none recorded\n");
    } else {
        for file in input.changed_files {
            output.push_str(&format!(
                "- `{}` ({}, symbols={})\n",
                file.path, file.change_type, file.symbols_json
            ));
        }
    }

    output.push_str("\n## Latest Session Agent Run\n\n");
    match input.latest_agent_run {
        Some(run) => append_agent_run(&mut output, run),
        None => output.push_str("_No `aich session run` artifacts were found for this session._\n"),
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
        None => output.push_str("_Change Manifest prompt artifact could not be read._\n"),
    }

    output
}

pub fn parse_change_manifest_command_output(output: &str) -> Result<String, String> {
    let yaml = change_manifest_yaml_from_command_output(output)?;
    let document: Value = serde_yaml::from_str(yaml)
        .map_err(|error| format!("invalid change_manifest YAML: {error}"))?;
    ensure_change_manifest_document(&document)?;
    let yaml = yaml.trim();
    if yaml.is_empty() {
        Err("empty change_manifest YAML".to_string())
    } else {
        Ok(format!("{yaml}\n"))
    }
}

fn change_manifest_yaml_from_command_output(output: &str) -> Result<&str, String> {
    let start = output
        .find("change_manifest:")
        .ok_or_else(|| "missing change_manifest root".to_string())?;
    let yaml = &output[start..];
    Ok(yaml.find("\n```").map_or(yaml, |end| &yaml[..end]).trim())
}

fn ensure_change_manifest_document(value: &Value) -> Result<(), String> {
    match value {
        Value::Mapping(mapping) => {
            match mapping.get(Value::String("change_manifest".to_string())) {
                Some(Value::Mapping(_)) => Ok(()),
                Some(_) => Err(
                    "Change Manifest YAML top-level change_manifest value must be a mapping"
                        .to_string(),
                ),
                None => Err(
                    "Change Manifest YAML must contain a top-level change_manifest mapping"
                        .to_string(),
                ),
            }
        }
        _ => Err("Change Manifest YAML document must be a mapping".to_string()),
    }
}

fn append_adapter_output_contract(output: &mut String) {
    output.push_str("## Adapter Output Contract\n\n");
    output.push_str(
        "Return only a YAML document. Do not include Markdown headings, prose, analysis notes, or fenced code blocks.\n",
    );
    output.push_str("The first non-whitespace characters of stdout must be `change_manifest:`.\n");
    output.push_str(
        "Declare every actual changed file in structured fields such as `changed_areas[].file`, `newly_created_files`, or `deleted_or_renamed_files`.\n",
    );
    output.push_str(
        "Do not invent tests or safety evidence. If tests were not run, say so in `tests.executed` or `uncertainty`.\n\n",
    );
    output.push_str("```yaml\n");
    output.push_str("change_manifest:\n");
    output.push_str("  intent:\n");
    output.push_str("    summary: \"\"\n");
    output.push_str("    reason: \"\"\n");
    output.push_str("    expected_behavior: []\n");
    output.push_str("    non_goals: []\n");
    output.push_str("  changed_areas: []\n");
    output.push_str("  newly_created_files: []\n");
    output.push_str("  deleted_or_renamed_files: []\n");
    output.push_str("  compatibility_notes:\n");
    output.push_str("    breaking_change: false\n");
    output.push_str("    migration_required: []\n");
    output.push_str("    backward_compatibility: \"\"\n");
    output.push_str("  tests:\n");
    output.push_str("    added: []\n");
    output.push_str("    executed: []\n");
    output.push_str("  risks:\n");
    output.push_str("    level: \"unknown\"\n");
    output.push_str("    items: []\n");
    output.push_str("  uncertainty: []\n");
    output.push_str("```\n\n");
}

fn append_agent_run(output: &mut String, run: &ChangeManifestAgentRunInput) {
    output.push_str(&format!("- artifact_dir: `{}`\n", run.artifact_dir));
    output.push_str(&format!("- input_path: `{}`\n", run.input_path));
    output.push_str(&format!("- stdout_path: `{}`\n", run.stdout_path));
    output.push_str(&format!("- stderr_path: `{}`\n", run.stderr_path));
    output.push_str(&format!("- metadata_path: `{}`\n", run.metadata_path));

    output.push_str("\n### Agent Stdout\n\n");
    match run.stdout_content.as_deref() {
        Some(content) => {
            append_fenced_limited(output, "text", content, AGENT_LOG_CONTEXT_MAX_CHARS)
        }
        None => output.push_str("_stdout artifact could not be read._\n"),
    }

    output.push_str("\n### Agent Stderr\n\n");
    match run.stderr_content.as_deref() {
        Some(content) => {
            append_fenced_limited(output, "text", content, AGENT_LOG_CONTEXT_MAX_CHARS)
        }
        None => output.push_str("_stderr artifact could not be read._\n"),
    }
}

fn append_fenced_limited(output: &mut String, language: &str, content: &str, max_chars: usize) {
    let original_chars = content.chars().count();
    let truncated = original_chars > max_chars;
    let included = if truncated {
        content.chars().take(max_chars).collect::<String>()
    } else {
        content.to_string()
    };
    output.push_str(&format!("```{language}\n"));
    output.push_str(&included);
    if !included.ends_with('\n') {
        output.push('\n');
    }
    if truncated {
        output.push_str("# ... truncated; inspect the artifact path for the full content.\n");
    }
    output.push_str("```\n");
}

#[cfg(test)]
mod tests {
    use super::*;
    use aich_core::{ContextSnapshot, PatchSet, Session, SessionStatus};

    #[test]
    fn parses_change_manifest_yaml_from_command_output() {
        let yaml = parse_change_manifest_command_output(
            r#"
notes before yaml
change_manifest:
  session_id: session-1
  changed_areas:
    - file: src/lib.rs
```ignored
"#,
        )
        .expect("parse manifest");

        assert!(yaml.starts_with("change_manifest:"));
        assert!(yaml.contains("src/lib.rs"));
        assert!(!yaml.contains("ignored"));
    }

    #[test]
    fn rejects_invalid_change_manifest_output() {
        let err = parse_change_manifest_command_output("no yaml").unwrap_err();
        assert_eq!(err, "missing change_manifest root");

        let err = parse_change_manifest_command_output("change_manifest: []").unwrap_err();
        assert!(err.contains("top-level change_manifest value must be a mapping"));
    }

    #[test]
    fn renders_manifest_generation_input_with_draft_diff_and_agent_artifacts() {
        let session = Session {
            id: "session-1".to_string(),
            goal: "update docs".to_string(),
            provider: "codex".to_string(),
            target_path: Some("README.md".to_string()),
            branch: "aich/session/session-1".to_string(),
            worktree_path: ".aichestra/worktrees/session-1".to_string(),
            base_commit: "base".to_string(),
            head_commit: Some("head".to_string()),
            status: SessionStatus::Enqueued,
            created_at_ms: 1,
            updated_at_ms: 2,
        };
        let patch_set = PatchSet {
            id: "patch-1".to_string(),
            session_id: session.id.clone(),
            base_commit: "base".to_string(),
            head_commit: Some("head".to_string()),
            patch_id: Some("head".to_string()),
            diff_stat: Some(" README.md | 1 +\n".to_string()),
            created_at_ms: 3,
        };
        let context_snapshot = ContextSnapshot {
            id: "context-1".to_string(),
            session_id: Some(session.id.clone()),
            hash_algorithm: "sha256".to_string(),
            snapshot_hash: "ctx".to_string(),
            created_at_ms: 4,
        };
        let changed_files = vec![ChangedFile::new("README.md", "modified")];
        let run = ChangeManifestAgentRunInput {
            artifact_dir: ".aichestra/artifacts/sessions/session-1/runs/run-1".to_string(),
            input_path: "input.md".to_string(),
            stdout_path: "stdout.txt".to_string(),
            stderr_path: "stderr.txt".to_string(),
            metadata_path: "metadata.json".to_string(),
            stdout_content: Some("agent says done".to_string()),
            stderr_content: Some(String::new()),
        };

        let rendered = render_change_manifest_input(ChangeManifestInput {
            generator_id: "test-generator",
            llm_executed: true,
            session: &session,
            patch_set: &patch_set,
            changed_files: &changed_files,
            context_snapshot: &context_snapshot,
            generated_manifest: "change_manifest:\n  session_id: session-1\n",
            diff_stat: " README.md | 1 +\n",
            diff_patch: "diff --git a/README.md b/README.md\n+new\n",
            diff_stat_path: Path::new(".aichestra/artifacts/diff.stat"),
            diff_patch_path: Path::new(".aichestra/artifacts/diff.patch"),
            prompt_path: ".aichestra/prompts/change-manifest.md",
            prompt_content: Some("Create manifest."),
            latest_agent_run: Some(&run),
        });

        assert!(rendered.contains("## Adapter Output Contract"));
        assert!(rendered.contains("## Generated Manifest Draft"));
        assert!(rendered.contains("agent says done"));
        assert!(rendered.contains("README.md"));
        assert!(rendered.contains("+new"));
    }
}

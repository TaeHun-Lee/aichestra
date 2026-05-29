use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use aich_core::{ChangeManifest, EventName, MergeAttemptStatus, NewEvent, Operator, Session};
use serde_yaml::{Mapping, Value};

use crate::approval::latest_approval;
use crate::formatting::{json_escape, path_from_ledger, read_optional_text, sha256_hex};
use crate::manifest::{changed_files_missing_from_manifest, parse_manifest_diff_evidence};
use crate::options::{ManifestEditOptions, ManifestShowOptions};
use crate::session::ensure_session_not_abandoned;
use crate::{
    latest_merge_attempt, open_existing_ledger, resolve_active_operator, CliError,
    CHANGE_MANIFEST_COMMAND_STATUS, CHANGE_MANIFEST_LLM_STATUS, CHANGE_MANIFEST_REVIEWED_STATUS,
};

const MANIFEST_GENERATION_INPUT_FILE: &str = "change-manifest-input.md";
const MANIFEST_GENERATION_STDOUT_FILE: &str = "change-manifest-stdout.txt";
const MANIFEST_GENERATION_STDERR_FILE: &str = "change-manifest-stderr.txt";
const MANIFEST_GENERATION_DRAFT_FILE: &str = "change-manifest.generated.yaml";

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct ManifestShowResult {
    pub(crate) session: Session,
    pub(crate) manifest: ChangeManifest,
    pub(crate) manifest_path: PathBuf,
    pub(crate) content: Option<String>,
    pub(crate) hash_status: String,
    pub(crate) yaml_status: String,
    pub(crate) diff_evidence_status: String,
    pub(crate) changed_files: Vec<String>,
    pub(crate) missing_files: Vec<String>,
    pub(crate) intent_summary: Option<String>,
    pub(crate) risk_level: Option<String>,
    pub(crate) generation_evidence: ManifestGenerationEvidence,
    pub(crate) next_validation_command: String,
    pub(crate) include_content: bool,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct ManifestGenerationEvidence {
    pub(crate) validation_status: Option<String>,
    pub(crate) generator_id: Option<String>,
    pub(crate) generator_adapter: Option<String>,
    pub(crate) artifacts: Vec<ManifestGenerationArtifact>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct ManifestGenerationArtifact {
    pub(crate) label: String,
    pub(crate) path: PathBuf,
    pub(crate) exists: bool,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct ManifestEditResult {
    pub(crate) session: Session,
    pub(crate) operator: Operator,
    pub(crate) manifest: ChangeManifest,
    pub(crate) manifest_path: PathBuf,
    pub(crate) changed_fields: Vec<String>,
    pub(crate) next_validation_command: String,
}

pub(crate) fn run_manifest_show(
    options: &ManifestShowOptions,
) -> Result<ManifestShowResult, CliError> {
    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;
    let manifest = latest_change_manifest(&ledger, &session.id)?;
    let patch_set = ledger.list_patch_sets(&session.id)?.into_iter().last();
    let changed_files = match patch_set.as_ref() {
        Some(patch_set) => ledger.list_changed_files(&patch_set.id)?,
        None => Vec::new(),
    };
    let changed_file_paths = changed_files
        .iter()
        .map(|file| file.path.clone())
        .collect::<Vec<_>>();
    let manifest_path = path_from_ledger(&options.repo_root, &manifest.manifest_path);
    let content = read_optional_text(&manifest_path)?;
    let hash_status = manifest_hash_status(content.as_deref(), manifest.manifest_hash.as_deref());

    let parsed_yaml = content
        .as_deref()
        .map(serde_yaml::from_str::<Value>)
        .transpose();
    let (yaml_value, yaml_status) = match parsed_yaml {
        Ok(Some(value)) => (Some(value), "ok".to_string()),
        Ok(None) => (None, "missing artifact".to_string()),
        Err(error) => (None, format!("invalid: {error}")),
    };
    let intent_summary = yaml_value
        .as_ref()
        .and_then(|value| nested_value_text(value, &["change_manifest", "intent", "summary"]));
    let risk_level = yaml_value
        .as_ref()
        .and_then(|value| nested_value_text(value, &["change_manifest", "risks", "level"]));
    let generation_evidence =
        manifest_generation_evidence(yaml_value.as_ref(), &manifest, &manifest_path);

    let (diff_evidence_status, missing_files) = match content.as_deref() {
        None => ("missing artifact".to_string(), Vec::new()),
        Some(content) => match parse_manifest_diff_evidence(content) {
            Ok(evidence) => {
                let missing = changed_files_missing_from_manifest(&changed_files, Some(&evidence));
                if missing.is_empty() {
                    ("ok".to_string(), missing)
                } else {
                    (
                        format!("missing {} changed file(s)", missing.len()),
                        missing,
                    )
                }
            }
            Err(error) => (format!("invalid YAML: {error}"), Vec::new()),
        },
    };

    let next_validation_command = next_validation_command(&ledger, &session.id)?;

    Ok(ManifestShowResult {
        session,
        manifest,
        manifest_path,
        content,
        hash_status,
        yaml_status,
        diff_evidence_status,
        changed_files: changed_file_paths,
        missing_files,
        intent_summary,
        risk_level,
        generation_evidence,
        next_validation_command,
        include_content: options.include_content,
    })
}

pub(crate) fn write_manifest_show<W: Write>(
    result: &ManifestShowResult,
    out: &mut W,
) -> Result<(), CliError> {
    writeln!(out, "Change Manifest")?;
    writeln!(out, "Session: {}", result.session.id)?;
    writeln!(out, "Status: {}", result.session.status.as_str())?;
    writeln!(out, "Goal: {}", result.session.goal)?;
    writeln!(out, "Manifest: {}", result.manifest.id)?;
    writeln!(out, "Path: {}", result.manifest_path.display())?;
    writeln!(out, "Ledger status: {}", result.manifest.validation_status)?;
    writeln!(out, "Hash: {}", result.hash_status)?;
    writeln!(out, "YAML: {}", result.yaml_status)?;
    writeln!(out, "Manifest vs diff: {}", result.diff_evidence_status)?;
    writeln!(out, "Changed files: {}", result.changed_files.len())?;
    for file in &result.changed_files {
        writeln!(out, "  - {file}")?;
    }
    if !result.missing_files.is_empty() {
        writeln!(out, "Missing from manifest:")?;
        for file in &result.missing_files {
            writeln!(out, "  - {file}")?;
        }
    }
    writeln!(
        out,
        "Intent summary: {}",
        result.intent_summary.as_deref().unwrap_or("-")
    )?;
    writeln!(
        out,
        "Risk level: {}",
        result.risk_level.as_deref().unwrap_or("-")
    )?;
    writeln!(out, "Generation evidence:")?;
    writeln!(
        out,
        "  validation_status: {}",
        result
            .generation_evidence
            .validation_status
            .as_deref()
            .unwrap_or("-")
    )?;
    writeln!(
        out,
        "  generator_id: {}",
        result
            .generation_evidence
            .generator_id
            .as_deref()
            .unwrap_or("-")
    )?;
    writeln!(
        out,
        "  generator_adapter: {}",
        result
            .generation_evidence
            .generator_adapter
            .as_deref()
            .unwrap_or("-")
    )?;
    if !result.generation_evidence.artifacts.is_empty() {
        writeln!(out, "  artifacts:")?;
        for artifact in &result.generation_evidence.artifacts {
            writeln!(
                out,
                "    - {}: {} ({})",
                artifact.label,
                artifact.path.display(),
                if artifact.exists {
                    "present"
                } else {
                    "missing"
                }
            )?;
        }
    }
    writeln!(
        out,
        "Next edit: aich manifest edit {} --set-intent-summary \"...\"",
        result.session.id
    )?;
    writeln!(out, "Next validation: {}", result.next_validation_command)?;

    if result.include_content {
        writeln!(out)?;
        writeln!(out, "--- change-manifest.yaml ---")?;
        match result.content.as_deref() {
            Some(content) => write!(out, "{content}")?,
            None => writeln!(out, "(missing artifact)")?,
        }
        if result
            .content
            .as_ref()
            .is_some_and(|content| !content.ends_with('\n'))
        {
            writeln!(out)?;
        }
    }

    Ok(())
}

pub(crate) fn run_manifest_edit(
    options: &ManifestEditOptions,
) -> Result<ManifestEditResult, CliError> {
    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;
    let session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;
    ensure_session_not_abandoned(&session, "edited")?;
    let mut manifest = latest_change_manifest(&ledger, &session.id)?;
    let manifest_path = path_from_ledger(&options.repo_root, &manifest.manifest_path);

    ensure_manifest_edit_allowed(&ledger, &session.id)?;

    let original_or_replacement = match options.content_file.as_ref() {
        Some(path) => fs::read_to_string(resolve_user_path(&options.repo_root, path))?,
        None => read_optional_text(&manifest_path)?.ok_or_else(|| {
            CliError::Usage(format!(
                "Change Manifest artifact is missing at {}; use --from-file to replace it",
                manifest_path.display()
            ))
        })?,
    };
    let mut yaml_value =
        serde_yaml::from_str::<Value>(&original_or_replacement).map_err(|error| {
            CliError::Usage(format!(
                "Change Manifest YAML could not be parsed for editing: {error}"
            ))
        })?;
    ensure_manifest_document(&yaml_value)?;

    let mut changed_fields = Vec::new();
    if options.content_file.is_some() {
        changed_fields.push("document".to_string());
    }
    if let Some(summary) = options.set_intent_summary.as_deref() {
        set_nested_string(
            &mut yaml_value,
            &["change_manifest", "intent", "summary"],
            summary.trim(),
        );
        changed_fields.push("intent.summary".to_string());
    }
    if let Some(risk_level) = options.set_risk_level.as_deref() {
        set_nested_string(
            &mut yaml_value,
            &["change_manifest", "risks", "level"],
            risk_level,
        );
        changed_fields.push("risks.level".to_string());
    }
    for risk in &options.add_risks {
        append_nested_sequence_string(
            &mut yaml_value,
            &["change_manifest", "risks", "items"],
            risk.trim(),
        );
    }
    if !options.add_risks.is_empty() {
        changed_fields.push("risks.items".to_string());
    }
    for test in &options.add_tests {
        append_nested_sequence_string(
            &mut yaml_value,
            &["change_manifest", "tests", "executed"],
            test.trim(),
        );
    }
    if !options.add_tests.is_empty() {
        changed_fields.push("tests.executed".to_string());
    }
    set_nested_string(
        &mut yaml_value,
        &["change_manifest", "evidence", "validation_status"],
        CHANGE_MANIFEST_REVIEWED_STATUS,
    );
    changed_fields.push("evidence.validation_status".to_string());

    let updated_content = serde_yaml::to_string(&yaml_value).map_err(|error| {
        CliError::Usage(format!(
            "Change Manifest YAML could not be rendered after editing: {error}"
        ))
    })?;
    let manifest_hash = sha256_hex(updated_content.as_bytes());

    if let Some(parent) = manifest_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&manifest_path, updated_content)?;

    let tx = ledger.begin_immediate_transaction()?;
    ledger.update_change_manifest(
        &manifest.id,
        Some(&manifest_hash),
        CHANGE_MANIFEST_REVIEWED_STATUS,
    )?;
    ledger.append_event(
        &NewEvent::new(EventName::ManifestUpdated)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"manifest_id\":\"{}\",\"manifest_path\":\"{}\",\"manifest_hash\":\"{}\",\"validation_status\":\"{}\",\"changed_fields\":{}}}",
                json_escape(&operator.id),
                json_escape(&manifest.id),
                json_escape(&manifest.manifest_path),
                json_escape(&manifest_hash),
                CHANGE_MANIFEST_REVIEWED_STATUS,
                json_string_array(&changed_fields)
            )),
    )?;
    tx.commit()?;

    manifest.manifest_hash = Some(manifest_hash);
    manifest.validation_status = CHANGE_MANIFEST_REVIEWED_STATUS.to_string();
    let next_validation_command = next_validation_command(&ledger, &session.id)?;

    Ok(ManifestEditResult {
        session,
        operator,
        manifest,
        manifest_path,
        changed_fields,
        next_validation_command,
    })
}

pub(crate) fn write_manifest_edit<W: Write>(
    result: &ManifestEditResult,
    out: &mut W,
) -> Result<(), CliError> {
    writeln!(out, "Updated Change Manifest")?;
    writeln!(out, "Session: {}", result.session.id)?;
    writeln!(out, "Operator: {}", result.operator.id)?;
    writeln!(out, "Manifest: {}", result.manifest.id)?;
    writeln!(out, "Path: {}", result.manifest_path.display())?;
    writeln!(
        out,
        "Hash: {}",
        result.manifest.manifest_hash.as_deref().unwrap_or("-")
    )?;
    writeln!(out, "Ledger status: {}", result.manifest.validation_status)?;
    writeln!(out, "Changed fields: {}", result.changed_fields.join(", "))?;
    writeln!(
        out,
        "Next: aich manifest show {} --content",
        result.session.id
    )?;
    writeln!(
        out,
        "Then rerun validation before approval: {}",
        result.next_validation_command
    )?;
    Ok(())
}

fn latest_change_manifest(
    ledger: &aich_ledger::Ledger,
    session_id: &str,
) -> Result<ChangeManifest, CliError> {
    ledger
        .list_change_manifests(session_id)?
        .into_iter()
        .last()
        .ok_or_else(|| {
            CliError::Usage(format!(
                "session '{session_id}' has no Change Manifest; run `aich session complete {session_id}` first"
            ))
        })
}

fn ensure_manifest_edit_allowed(
    ledger: &aich_ledger::Ledger,
    session_id: &str,
) -> Result<(), CliError> {
    let Some(attempt) = latest_merge_attempt(ledger, session_id)? else {
        return Ok(());
    };

    if matches!(
        attempt.status,
        MergeAttemptStatus::Applying | MergeAttemptStatus::Applied
    ) {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is {} and its Change Manifest cannot be edited",
            attempt.id,
            attempt.status.as_str()
        )));
    }
    if latest_approval(ledger, &attempt.id)?.is_some() {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is already approved; reopen or rework before editing its Change Manifest",
            attempt.id
        )));
    }

    Ok(())
}

fn next_validation_command(
    ledger: &aich_ledger::Ledger,
    session_id: &str,
) -> Result<String, CliError> {
    let Some(attempt) = latest_merge_attempt(ledger, session_id)? else {
        return Ok(format!("aich preflight {session_id}"));
    };

    if attempt.status == MergeAttemptStatus::Verified
        && attempt.checks_passed
        && attempt
            .verified_tree_id
            .as_deref()
            .is_some_and(|value| !value.is_empty())
        && attempt
            .verified_commit_id
            .as_deref()
            .is_some_and(|value| !value.is_empty())
    {
        Ok(format!("aich review {session_id}"))
    } else {
        Ok(format!("aich preflight {session_id}"))
    }
}

fn manifest_hash_status(content: Option<&str>, expected: Option<&str>) -> String {
    match (content, expected) {
        (None, _) => "missing artifact".to_string(),
        (Some(_), None) => "not recorded".to_string(),
        (Some(content), Some(expected)) => {
            let actual = sha256_hex(content.as_bytes());
            if actual == expected {
                "ok".to_string()
            } else {
                format!("mismatch: expected {expected}, actual {actual}")
            }
        }
    }
}

fn manifest_generation_evidence(
    yaml_value: Option<&Value>,
    manifest: &ChangeManifest,
    manifest_path: &Path,
) -> ManifestGenerationEvidence {
    let validation_status = yaml_value
        .and_then(|value| {
            nested_value_text(value, &["change_manifest", "evidence", "validation_status"])
        })
        .or_else(|| Some(manifest.validation_status.clone()));
    let generator_id = yaml_value.and_then(|value| {
        nested_value_text(value, &["change_manifest", "evidence", "generator_id"])
    });
    let generator_adapter = yaml_value.and_then(|value| {
        nested_value_text(value, &["change_manifest", "evidence", "generator_adapter"])
    });
    let artifacts = if manifest_was_provider_generated(
        manifest.validation_status.as_str(),
        validation_status.as_deref(),
        generator_adapter.as_deref(),
    ) {
        manifest_generation_artifacts(manifest_path)
    } else {
        Vec::new()
    };

    ManifestGenerationEvidence {
        validation_status,
        generator_id,
        generator_adapter,
        artifacts,
    }
}

fn manifest_was_provider_generated(
    ledger_status: &str,
    evidence_status: Option<&str>,
    generator_adapter: Option<&str>,
) -> bool {
    matches!(
        ledger_status,
        CHANGE_MANIFEST_COMMAND_STATUS | CHANGE_MANIFEST_LLM_STATUS
    ) || matches!(
        evidence_status,
        Some(CHANGE_MANIFEST_COMMAND_STATUS | CHANGE_MANIFEST_LLM_STATUS)
    ) || matches!(generator_adapter, Some("command" | "llm"))
}

fn manifest_generation_artifacts(manifest_path: &Path) -> Vec<ManifestGenerationArtifact> {
    let Some(artifact_dir) = manifest_path.parent() else {
        return Vec::new();
    };

    [
        ("input", MANIFEST_GENERATION_INPUT_FILE),
        ("stdout", MANIFEST_GENERATION_STDOUT_FILE),
        ("stderr", MANIFEST_GENERATION_STDERR_FILE),
        ("generated_draft", MANIFEST_GENERATION_DRAFT_FILE),
    ]
    .into_iter()
    .map(|(label, file_name)| {
        let path = artifact_dir.join(file_name);
        let exists = path.exists();
        ManifestGenerationArtifact {
            label: label.to_string(),
            path,
            exists,
        }
    })
    .collect()
}

fn resolve_user_path(repo_root: &Path, path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        repo_root.join(path)
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

fn nested_value_text(value: &Value, path: &[&str]) -> Option<String> {
    value_to_text(nested_value(value, path)?)
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

fn value_to_text(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Bool(value) => Some(value.to_string()),
        Value::Number(value) => Some(value.to_string()),
        Value::Null => Some("null".to_string()),
        _ => None,
    }
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

fn append_nested_sequence_string(root: &mut Value, path: &[&str], value: &str) {
    let Some((last, parents)) = path.split_last() else {
        return;
    };
    let parent = ensure_nested_mapping(root, parents);
    let key = Value::String((*last).to_string());
    let needs_sequence = !matches!(parent.get(&key), Some(Value::Sequence(_)));
    if needs_sequence {
        parent.insert(key.clone(), Value::Sequence(Vec::new()));
    }
    if let Some(Value::Sequence(sequence)) = parent.get_mut(&key) {
        sequence.push(Value::String(value.to_string()));
    }
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

fn json_string_array(values: &[String]) -> String {
    let mut output = String::from("[");
    for (index, value) in values.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }
        output.push('"');
        output.push_str(&json_escape(value));
        output.push('"');
    }
    output.push(']');
    output
}

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use aich_core::{
    ChangeManifest, ChangedFile, CheckResult, ContextSnapshot, MergeAttempt, PatchSet,
    SemanticReview, Session,
};
use aich_ledger::Ledger;
use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::formatting::{display_path_for_ledger, hex_lower, sha256_hex, yaml_quote};
use crate::{CliError, CHANGE_MANIFEST_VALIDATION_STATUS, CONTEXT_SNAPSHOT_FILES};

#[derive(Debug, Deserialize)]
struct ChangeManifestDocument {
    change_manifest: ParsedChangeManifest,
}

#[derive(Debug, Deserialize)]
struct ParsedChangeManifest {
    #[serde(default)]
    changed_areas: Vec<ParsedChangedArea>,
    #[serde(default)]
    newly_created_files: Vec<String>,
    #[serde(default)]
    deleted_or_renamed_files: Vec<String>,
    #[serde(default)]
    evidence: ParsedManifestEvidence,
}

#[derive(Debug, Deserialize)]
struct ParsedChangedArea {
    file: String,
}

#[derive(Debug, Default, Deserialize)]
struct ParsedManifestEvidence {
    diff_patch_artifact: Option<String>,
}

#[derive(Debug, Eq, PartialEq)]
pub(crate) struct ManifestDiffEvidence {
    changed_files: BTreeSet<String>,
}

pub(crate) fn parse_manifest_diff_evidence(content: &str) -> Result<ManifestDiffEvidence, String> {
    let document: ChangeManifestDocument =
        serde_yaml::from_str(content).map_err(|error| error.to_string())?;
    let mut changed_files = BTreeSet::new();

    for area in document.change_manifest.changed_areas {
        insert_manifest_file_path(&mut changed_files, &area.file);
    }
    for file in document.change_manifest.newly_created_files {
        insert_manifest_file_path(&mut changed_files, &file);
    }
    for file in document.change_manifest.deleted_or_renamed_files {
        insert_manifest_file_path(&mut changed_files, &file);
    }

    Ok(ManifestDiffEvidence { changed_files })
}

pub(crate) fn parse_manifest_diff_patch_artifact(content: &str) -> Result<Option<String>, String> {
    let document: ChangeManifestDocument =
        serde_yaml::from_str(content).map_err(|error| error.to_string())?;
    Ok(document
        .change_manifest
        .evidence
        .diff_patch_artifact
        .and_then(|path| {
            let path = normalize_manifest_file_path(&path);
            if path.is_empty() {
                None
            } else {
                Some(path)
            }
        }))
}

fn insert_manifest_file_path(changed_files: &mut BTreeSet<String>, path: &str) {
    let path = normalize_manifest_file_path(path);
    if !path.is_empty() {
        changed_files.insert(path);
    }
}

fn normalize_manifest_file_path(path: &str) -> String {
    path.trim().replace('\\', "/")
}

pub(crate) fn changed_files_missing_from_manifest(
    changed_files: &[ChangedFile],
    manifest_evidence: Option<&ManifestDiffEvidence>,
) -> Vec<String> {
    let Some(manifest_evidence) = manifest_evidence else {
        return Vec::new();
    };

    changed_files
        .iter()
        .filter(|file| {
            !manifest_evidence
                .changed_files
                .contains(&normalize_manifest_file_path(&file.path))
        })
        .map(|file| file.path.clone())
        .collect()
}

pub(crate) fn latest_change_manifest(
    ledger: &Ledger,
    session_id: &str,
) -> Result<Option<ChangeManifest>, CliError> {
    Ok(ledger.list_change_manifests(session_id)?.into_iter().last())
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct SemanticReviewEvidenceFingerprint {
    pub(crate) verified_candidate_fingerprint: String,
    pub(crate) changed_files_fingerprint: String,
    pub(crate) check_results_fingerprint: String,
    pub(crate) review_evidence_fingerprint: String,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub(crate) enum SemanticReviewStaleReason {
    LegacyReviewEvidence,
    ManifestChanged,
    VerifiedCandidateChanged,
    ChangedFilesChanged,
    CheckResultsChanged,
    ReviewEvidenceChanged,
}

impl SemanticReviewStaleReason {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::LegacyReviewEvidence => "legacy_review_evidence",
            Self::ManifestChanged => "manifest_changed",
            Self::VerifiedCandidateChanged => "verified_candidate_changed",
            Self::ChangedFilesChanged => "changed_files_changed",
            Self::CheckResultsChanged => "checks_changed",
            Self::ReviewEvidenceChanged => "review_evidence_changed",
        }
    }
}

pub(crate) fn semantic_review_evidence_fingerprint(
    manifest: &ChangeManifest,
    attempt: &MergeAttempt,
    changed_files: &[ChangedFile],
    check_results: &[CheckResult],
) -> SemanticReviewEvidenceFingerprint {
    let verified_candidate_fingerprint = verified_candidate_fingerprint(attempt);
    let changed_files_fingerprint = changed_files_fingerprint(changed_files);
    let check_results_fingerprint = check_results_fingerprint(check_results);
    let review_evidence_fingerprint = review_evidence_fingerprint(
        manifest,
        &verified_candidate_fingerprint,
        &changed_files_fingerprint,
        &check_results_fingerprint,
    );

    SemanticReviewEvidenceFingerprint {
        verified_candidate_fingerprint,
        changed_files_fingerprint,
        check_results_fingerprint,
        review_evidence_fingerprint,
    }
}

pub(crate) fn semantic_review_stale_reasons(
    review: &SemanticReview,
    manifest: &ChangeManifest,
    fingerprint: &SemanticReviewEvidenceFingerprint,
) -> Vec<SemanticReviewStaleReason> {
    let mut reasons = Vec::new();
    if review.change_manifest_id.as_deref() != Some(manifest.id.as_str()) {
        reasons.push(SemanticReviewStaleReason::ManifestChanged);
    }

    if match (
        review.change_manifest_hash.as_deref(),
        manifest.manifest_hash.as_deref(),
    ) {
        (Some(review_hash), Some(manifest_hash)) => review_hash != manifest_hash,
        _ => true,
    } {
        reasons.push(SemanticReviewStaleReason::ManifestChanged);
    }

    if review.verified_candidate_fingerprint.as_deref()
        != Some(fingerprint.verified_candidate_fingerprint.as_str())
    {
        reasons.push(SemanticReviewStaleReason::VerifiedCandidateChanged);
    }
    if review.changed_files_fingerprint.as_deref()
        != Some(fingerprint.changed_files_fingerprint.as_str())
    {
        reasons.push(SemanticReviewStaleReason::ChangedFilesChanged);
    }
    if review.check_results_fingerprint.as_deref()
        != Some(fingerprint.check_results_fingerprint.as_str())
    {
        reasons.push(SemanticReviewStaleReason::CheckResultsChanged);
    }
    if review.review_evidence_fingerprint.as_deref()
        != Some(fingerprint.review_evidence_fingerprint.as_str())
    {
        reasons.push(SemanticReviewStaleReason::ReviewEvidenceChanged);
    }

    if review.change_manifest_id.is_none()
        || review.change_manifest_hash.is_none()
        || review.verified_candidate_fingerprint.is_none()
        || review.changed_files_fingerprint.is_none()
        || review.check_results_fingerprint.is_none()
        || review.review_evidence_fingerprint.is_none()
    {
        reasons.push(SemanticReviewStaleReason::LegacyReviewEvidence);
    }

    reasons.sort_by_key(|reason| reason.as_str());
    reasons.dedup();
    reasons
}

pub(crate) fn ensure_semantic_review_evidence_current(
    review: &SemanticReview,
    manifest: &ChangeManifest,
    attempt: &MergeAttempt,
    changed_files: &[ChangedFile],
    check_results: &[CheckResult],
    session_id: &str,
    before_action: &str,
) -> Result<(), CliError> {
    let fingerprint =
        semantic_review_evidence_fingerprint(manifest, attempt, changed_files, check_results);
    let stale_reasons = semantic_review_stale_reasons(review, manifest, &fingerprint);
    if stale_reasons.is_empty() {
        return Ok(());
    }

    let reasons = stale_reasons
        .iter()
        .map(|reason| reason.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    Err(CliError::Usage(format!(
        "Semantic review '{}' is stale ({reasons}). Run `aich review {}` again before {before_action}.",
        review.id, session_id
    )))
}

pub(crate) fn shared_contract_files(changed_files: &[ChangedFile]) -> Vec<String> {
    changed_files
        .iter()
        .filter(|file| is_shared_contract_path(&file.path))
        .map(|file| file.path.clone())
        .collect()
}

fn verified_candidate_fingerprint(attempt: &MergeAttempt) -> String {
    let mut input = String::new();
    push_field(&mut input, "merge_attempt_id", &attempt.id);
    push_field(&mut input, "session_id", &attempt.session_id);
    push_field(&mut input, "status", attempt.status.as_str());
    push_field(
        &mut input,
        "main_before_commit",
        &attempt.main_before_commit,
    );
    push_field(&mut input, "candidate_commit", &attempt.candidate_commit);
    push_field(&mut input, "apply_strategy", &attempt.apply_strategy);
    push_option_field(
        &mut input,
        "check_policy_fingerprint",
        attempt.check_policy_fingerprint.as_deref(),
    );
    push_option_field(
        &mut input,
        "verified_tree_id",
        attempt.verified_tree_id.as_deref(),
    );
    push_option_field(
        &mut input,
        "verified_commit_id",
        attempt.verified_commit_id.as_deref(),
    );
    push_field(
        &mut input,
        "checks_passed",
        &attempt.checks_passed.to_string(),
    );
    sha256_hex(input.as_bytes())
}

fn changed_files_fingerprint(changed_files: &[ChangedFile]) -> String {
    let mut rows = changed_files
        .iter()
        .map(|file| {
            let mut row = String::new();
            push_field(&mut row, "path", &file.path);
            push_field(&mut row, "change_type", &file.change_type);
            push_field(&mut row, "symbols_json", &file.symbols_json);
            row
        })
        .collect::<Vec<_>>();
    rows.sort();
    sha256_hex(rows.join("\n").as_bytes())
}

fn check_results_fingerprint(check_results: &[CheckResult]) -> String {
    let mut rows = check_results
        .iter()
        .map(|check| {
            let mut row = String::new();
            push_field(&mut row, "id", &check.id);
            push_field(&mut row, "merge_attempt_id", &check.merge_attempt_id);
            push_field(&mut row, "name", &check.name);
            push_field(&mut row, "command", &check.command);
            push_field(&mut row, "required", &check.required.to_string());
            push_field(&mut row, "timed_out", &check.timed_out.to_string());
            push_field(&mut row, "result", check.result.as_str());
            push_option_field(
                &mut row,
                "stdout_artifact",
                check.stdout_artifact.as_deref(),
            );
            push_option_field(
                &mut row,
                "stderr_artifact",
                check.stderr_artifact.as_deref(),
            );
            push_field(&mut row, "created_at_ms", &check.created_at_ms.to_string());
            row
        })
        .collect::<Vec<_>>();
    rows.sort();
    sha256_hex(rows.join("\n").as_bytes())
}

fn review_evidence_fingerprint(
    manifest: &ChangeManifest,
    verified_candidate_fingerprint: &str,
    changed_files_fingerprint: &str,
    check_results_fingerprint: &str,
) -> String {
    let mut input = String::new();
    push_field(&mut input, "change_manifest_id", &manifest.id);
    push_option_field(
        &mut input,
        "change_manifest_hash",
        manifest.manifest_hash.as_deref(),
    );
    push_field(
        &mut input,
        "verified_candidate_fingerprint",
        verified_candidate_fingerprint,
    );
    push_field(
        &mut input,
        "changed_files_fingerprint",
        changed_files_fingerprint,
    );
    push_field(
        &mut input,
        "check_results_fingerprint",
        check_results_fingerprint,
    );
    sha256_hex(input.as_bytes())
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

fn is_shared_contract_path(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower == "cargo.toml"
        || lower == "cargo.lock"
        || lower.ends_with("/cargo.toml")
        || lower.ends_with("/cargo.lock")
        || lower.contains("migration")
        || lower.contains("schema")
        || lower.contains("config")
        || lower.contains("types")
        || lower.ends_with("/lib.rs")
        || lower.ends_with("/mod.rs")
}

pub(crate) fn context_snapshot_hash(repo_root: &Path) -> Result<String, CliError> {
    let mut hasher = Sha256::new();

    for relative_path in CONTEXT_SNAPSHOT_FILES {
        hasher.update(relative_path.as_bytes());
        hasher.update([0]);
        let path = repo_root.join(relative_path);
        match fs::read(&path) {
            Ok(bytes) => {
                hasher.update(b"present");
                hasher.update([0]);
                hasher.update(bytes);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                hasher.update(b"missing");
            }
            Err(error) => return Err(CliError::Io(error)),
        }
        hasher.update([0]);
    }

    Ok(hex_lower(&hasher.finalize()))
}

pub(crate) fn render_change_manifest(
    session: &Session,
    patch_set: &PatchSet,
    changed_files: &[ChangedFile],
    context_snapshot: &ContextSnapshot,
    diff_stat_path: &Path,
    diff_patch_path: &Path,
    repo_root: &Path,
) -> String {
    let created_files: Vec<&ChangedFile> = changed_files
        .iter()
        .filter(|file| file.change_type == "added")
        .collect();
    let deleted_or_renamed_files: Vec<&ChangedFile> = changed_files
        .iter()
        .filter(|file| file.change_type == "deleted" || file.change_type == "renamed")
        .collect();

    let mut output = String::new();
    output.push_str("change_manifest:\n");
    output.push_str(&format!("  session_id: {}\n", yaml_quote(&session.id)));
    output.push_str(&format!("  goal: {}\n", yaml_quote(&session.goal)));
    output.push_str(&format!("  provider: {}\n", yaml_quote(&session.provider)));
    output.push_str(&format!("  branch: {}\n", yaml_quote(&session.branch)));
    output.push_str(&format!(
        "  base_commit: {}\n",
        yaml_quote(&session.base_commit)
    ));
    output.push_str(&format!(
        "  head_commit: {}\n",
        yaml_quote(patch_set.head_commit.as_deref().unwrap_or(""))
    ));
    output.push_str(&format!(
        "  patch_id: {}\n",
        yaml_quote(patch_set.patch_id.as_deref().unwrap_or(""))
    ));
    output.push_str("  intent:\n");
    output.push_str("    summary: ");
    output.push_str(&yaml_quote(
        "Generated from the session goal and actual diff; review before semantic merge.",
    ));
    output.push('\n');
    output.push_str(&format!("    reason: {}\n", yaml_quote(&session.goal)));
    output.push_str("    expected_behavior: []\n");
    output.push_str("    non_goals: []\n");
    output.push_str("  changed_areas:\n");
    append_changed_areas_yaml(&mut output, changed_files, 4);
    output.push_str("  newly_created_files:\n");
    append_file_path_yaml(&mut output, &created_files, 4);
    output.push_str("  deleted_or_renamed_files:\n");
    append_file_path_yaml(&mut output, &deleted_or_renamed_files, 4);
    output.push_str("  compatibility_notes:\n");
    output.push_str("    breaking_change: false\n");
    output.push_str("    migration_required: []\n");
    output.push_str("    backward_compatibility: \"unknown until reviewed\"\n");
    output.push_str("  tests:\n");
    output.push_str("    added: []\n");
    output.push_str("    executed: []\n");
    output.push_str("  risks:\n");
    output.push_str("    level: \"unknown\"\n");
    output.push_str("    items:\n");
    output.push_str(
        "      - \"This manifest was generated from Git diff metadata and still needs human review.\"\n",
    );
    output.push_str("  uncertainty:\n");
    output.push_str(
        "    - \"Changed symbols are inferred with MVP diff heuristics; semantic impact still needs review.\"\n",
    );
    output.push_str("  evidence:\n");
    output.push_str(&format!(
        "    diff_stat_artifact: {}\n",
        yaml_quote(&display_path_for_ledger(repo_root, diff_stat_path))
    ));
    output.push_str(&format!(
        "    diff_patch_artifact: {}\n",
        yaml_quote(&display_path_for_ledger(repo_root, diff_patch_path))
    ));
    output.push_str(&format!(
        "    context_snapshot_hash: {}\n",
        yaml_quote(&context_snapshot.snapshot_hash)
    ));
    output.push_str(&format!(
        "    validation_status: {}\n",
        yaml_quote(CHANGE_MANIFEST_VALIDATION_STATUS)
    ));
    output
}

fn append_changed_areas_yaml(output: &mut String, changed_files: &[ChangedFile], indent: usize) {
    if changed_files.is_empty() {
        output.push_str(&format!("{}[]\n", " ".repeat(indent)));
        return;
    }

    for file in changed_files {
        output.push_str(&format!(
            "{}- file: {}\n",
            " ".repeat(indent),
            yaml_quote(&file.path)
        ));
        output.push_str(&format!(
            "{}  change_type: {}\n",
            " ".repeat(indent),
            yaml_quote(&file.change_type)
        ));
        output.push_str(&format!("{}  symbols:\n", " ".repeat(indent)));
        append_symbol_yaml(output, file, indent + 4);
        output.push_str(&format!(
            "{}  purpose: \"Detected by git diff during session completion.\"\n",
            " ".repeat(indent)
        ));
        output.push_str(&format!(
            "{}  semantic_impact: \"unknown\"\n",
            " ".repeat(indent)
        ));
        output.push_str(&format!("{}  before: \"\"\n", " ".repeat(indent)));
        output.push_str(&format!("{}  after: \"\"\n", " ".repeat(indent)));
    }
}

fn append_symbol_yaml(output: &mut String, file: &ChangedFile, indent: usize) {
    let symbols = changed_file_symbols(file);
    if symbols.is_empty() {
        output.push_str(&format!("{}[]\n", " ".repeat(indent)));
        return;
    }

    for symbol in symbols {
        output.push_str(&format!(
            "{}- {}\n",
            " ".repeat(indent),
            yaml_quote(&symbol)
        ));
    }
}

fn changed_file_symbols(file: &ChangedFile) -> Vec<String> {
    serde_yaml::from_str::<Vec<String>>(&file.symbols_json).unwrap_or_default()
}

fn append_file_path_yaml(output: &mut String, changed_files: &[&ChangedFile], indent: usize) {
    if changed_files.is_empty() {
        output.push_str(&format!("{}[]\n", " ".repeat(indent)));
        return;
    }

    for file in changed_files {
        output.push_str(&format!(
            "{}- {}\n",
            " ".repeat(indent),
            yaml_quote(&file.path)
        ));
    }
}

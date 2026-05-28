use std::path::Path;

use aich_core::{
    ChangeManifest, ChangedFile, CheckResult, MergeAttempt, PatchSet, SemanticRiskLevel, Session,
};
use serde::Deserialize;

pub const SEMANTIC_REVIEW_PATCH_CONTEXT_MAX_CHARS: usize = 60_000;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SemanticConflictFinding {
    pub conflict_type: String,
    pub files: Vec<String>,
    pub explanation: String,
    pub confidence: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LocalSemanticReviewReport {
    pub risk_level: SemanticRiskLevel,
    pub summary: String,
    pub suspected_conflicts: Vec<SemanticConflictFinding>,
    pub required_actions: Vec<String>,
    pub suggested_tests: Vec<String>,
    pub proposed_patch: ProposedPatch,
    pub uncertainty: Vec<String>,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct ProposedPatch {
    pub available: bool,
    pub description: Option<String>,
    pub patch: Option<String>,
    pub fix_plan_artifact: Option<String>,
    pub patch_artifact: Option<String>,
}

impl ProposedPatch {
    pub fn unavailable() -> Self {
        Self::default()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RelatedChangeManifestRelation {
    Applied,
    Queued,
}

impl RelatedChangeManifestRelation {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Applied => "applied",
            Self::Queued => "queued",
        }
    }

    pub fn title(&self) -> &'static str {
        match self {
            Self::Applied => "Applied",
            Self::Queued => "Queued",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelatedChangeManifest {
    pub relation: RelatedChangeManifestRelation,
    pub session_id: String,
    pub session_status: String,
    pub goal: String,
    pub base_commit: String,
    pub head_commit: Option<String>,
    pub latest_attempt_id: Option<String>,
    pub latest_attempt_status: Option<String>,
    pub latest_attempt_main_before_commit: Option<String>,
    pub latest_attempt_verified_commit_id: Option<String>,
    pub manifest_id: String,
    pub manifest_path: String,
    pub manifest_hash_mismatch: bool,
    pub manifest_content: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DiffPatchContext {
    pub artifact_path: String,
    pub content: Option<String>,
    pub truncated: bool,
    pub included_chars: usize,
    pub original_chars: Option<usize>,
    pub max_chars: usize,
    pub unavailable_reason: Option<String>,
}

impl DiffPatchContext {
    pub fn from_content(artifact_path: impl Into<String>, content: String) -> Self {
        let original_chars = content.chars().count();
        let truncated = original_chars > SEMANTIC_REVIEW_PATCH_CONTEXT_MAX_CHARS;
        let included = if truncated {
            content
                .chars()
                .take(SEMANTIC_REVIEW_PATCH_CONTEXT_MAX_CHARS)
                .collect()
        } else {
            content
        };
        let included_chars = if truncated {
            SEMANTIC_REVIEW_PATCH_CONTEXT_MAX_CHARS
        } else {
            original_chars
        };

        Self {
            artifact_path: artifact_path.into(),
            content: Some(included),
            truncated,
            included_chars,
            original_chars: Some(original_chars),
            max_chars: SEMANTIC_REVIEW_PATCH_CONTEXT_MAX_CHARS,
            unavailable_reason: None,
        }
    }

    pub fn unavailable(artifact_path: impl Into<String>, reason: impl Into<String>) -> Self {
        Self {
            artifact_path: artifact_path.into(),
            content: None,
            truncated: false,
            included_chars: 0,
            original_chars: None,
            max_chars: SEMANTIC_REVIEW_PATCH_CONTEXT_MAX_CHARS,
            unavailable_reason: Some(reason.into()),
        }
    }
}

pub struct SemanticReviewInput<'a> {
    pub reviewer_id: &'a str,
    pub llm_executed: bool,
    pub session: &'a Session,
    pub attempt: &'a MergeAttempt,
    pub manifest: &'a ChangeManifest,
    pub manifest_content: Option<&'a str>,
    pub patch_set: Option<&'a PatchSet>,
    pub diff_patch_context: Option<&'a DiffPatchContext>,
    pub changed_files: &'a [ChangedFile],
    pub check_results: &'a [CheckResult],
    pub related_manifests: &'a [RelatedChangeManifest],
    pub config_path: &'a Path,
    pub prompt_path: &'a str,
    pub prompt_content: Option<&'a str>,
}

pub struct SemanticReviewAdapterRequest<'a> {
    pub repo_root: &'a Path,
    pub session: &'a Session,
    pub attempt: &'a MergeAttempt,
    pub manifest: &'a ChangeManifest,
    pub manifest_content: Option<&'a str>,
    pub manifest_hash_mismatch: bool,
    pub patch_set: Option<&'a PatchSet>,
    pub diff_patch_context: Option<&'a DiffPatchContext>,
    pub changed_files: &'a [ChangedFile],
    pub check_results: &'a [CheckResult],
    pub related_manifests: &'a [RelatedChangeManifest],
    pub config_path: &'a Path,
    pub prompt_path: &'a str,
    pub prompt_content: Option<&'a str>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SemanticReviewReportMetadata<'a> {
    pub reviewer_id: &'a str,
    pub llm_executed: bool,
    pub operator_id: &'a str,
    pub input_artifact: &'a str,
}

pub fn render_semantic_review_input(input: SemanticReviewInput<'_>) -> String {
    let mut output = String::new();
    output.push_str("# Semantic Review Input\n\n");
    append_adapter_output_contract(&mut output, input.session, input.attempt);
    output.push_str(&format!("- reviewer: `{}`\n", input.reviewer_id));
    output.push_str(&format!("- llm_executed: `{}`\n", input.llm_executed));
    output.push_str(&format!("- session_id: `{}`\n", input.session.id));
    output.push_str(&format!("- goal: `{}`\n", input.session.goal));
    output.push_str(&format!("- merge_attempt_id: `{}`\n", input.attempt.id));
    output.push_str(&format!(
        "- verified_tree_id: `{}`\n",
        input.attempt.verified_tree_id.as_deref().unwrap_or("")
    ));
    output.push_str(&format!(
        "- verified_commit_id: `{}`\n",
        input.attempt.verified_commit_id.as_deref().unwrap_or("")
    ));
    output.push_str(&format!(
        "- config_path: `{}`\n",
        input.config_path.display()
    ));
    output.push_str(&format!("- prompt_path: `{}`\n", input.prompt_path));
    output.push_str("\n## Change Manifest\n\n");
    output.push_str(&format!("- id: `{}`\n", input.manifest.id));
    output.push_str(&format!("- path: `{}`\n", input.manifest.manifest_path));
    output.push_str(&format!(
        "- validation_status: `{}`\n\n",
        input.manifest.validation_status
    ));
    match input.manifest_content {
        Some(content) => {
            output.push_str("```yaml\n");
            output.push_str(content);
            if !content.ends_with('\n') {
                output.push('\n');
            }
            output.push_str("```\n\n");
        }
        None => output.push_str("_Manifest artifact could not be read._\n\n"),
    }

    output.push_str("## Related Change Manifests\n\n");
    if input.related_manifests.is_empty() {
        output.push_str("_No other applied or queued Change Manifests are recorded._\n");
    } else {
        output.push_str(
            "Use these other session manifests to look for stale assumptions, overlapping intent, and cross-session semantic conflicts.\n\n",
        );
        for related in input.related_manifests {
            append_related_change_manifest(&mut output, related);
        }
    }

    output.push_str("## Diff Evidence\n\n");
    if let Some(patch_set) = input.patch_set {
        output.push_str(&format!("- patch_set_id: `{}`\n", patch_set.id));
        output.push_str(&format!("- base_commit: `{}`\n", patch_set.base_commit));
        output.push_str(&format!(
            "- head_commit: `{}`\n",
            patch_set.head_commit.as_deref().unwrap_or("")
        ));
        if let Some(diff_stat) = patch_set.diff_stat.as_deref() {
            output.push_str("\n```text\n");
            output.push_str(diff_stat);
            if !diff_stat.ends_with('\n') {
                output.push('\n');
            }
            output.push_str("```\n");
        }
    } else {
        output.push_str("_No patch set evidence is recorded._\n");
    }

    append_diff_patch_context(&mut output, input.diff_patch_context);

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

    output.push_str("\n## Check Results\n\n");
    if input.check_results.is_empty() {
        output.push_str("- none recorded\n");
    } else {
        for check in input.check_results {
            output.push_str(&format!(
                "- `{}`: {} via `{}` (required={}, timed_out={})\n",
                check.name,
                check.result.as_str(),
                check.command,
                check.required,
                check.timed_out
            ));
        }
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
        None => output.push_str("_Semantic review prompt artifact could not be read._\n"),
    }

    output
}

pub fn render_semantic_review_yaml(
    review_id: &str,
    session: &Session,
    attempt: &MergeAttempt,
    report: &LocalSemanticReviewReport,
    metadata: SemanticReviewReportMetadata<'_>,
) -> String {
    let mut output = String::new();
    output.push_str("semantic_review:\n");
    output.push_str(&format!("  id: {}\n", yaml_quote(review_id)));
    output.push_str(&format!("  session_id: {}\n", yaml_quote(&session.id)));
    output.push_str(&format!(
        "  merge_attempt_id: {}\n",
        yaml_quote(&attempt.id)
    ));
    output.push_str(&format!(
        "  reviewer: {}\n",
        yaml_quote(metadata.reviewer_id)
    ));
    output.push_str(&format!("  llm_executed: {}\n", metadata.llm_executed));
    output.push_str(&format!(
        "  operator_id: {}\n",
        yaml_quote(metadata.operator_id)
    ));
    output.push_str(&format!(
        "  risk_level: {}\n",
        yaml_quote(report.risk_level.as_str())
    ));
    output.push_str(&format!("  summary: {}\n", yaml_quote(&report.summary)));
    output.push_str(&format!(
        "  input_artifact: {}\n",
        yaml_quote(metadata.input_artifact)
    ));
    output.push_str("  suspected_conflicts:\n");
    append_semantic_conflicts_yaml(&mut output, &report.suspected_conflicts, 4);
    output.push_str("  required_actions:\n");
    append_string_list_yaml(&mut output, &report.required_actions, 4);
    output.push_str("  suggested_tests:\n");
    append_string_list_yaml(&mut output, &report.suggested_tests, 4);
    append_proposed_patch_yaml(&mut output, &report.proposed_patch, 2);
    output.push_str("  uncertainty:\n");
    append_string_list_yaml(&mut output, &report.uncertainty, 4);
    output
}

pub fn render_proposed_fix_plan_artifact(
    review_id: &str,
    report: &LocalSemanticReviewReport,
) -> String {
    let mut output = String::new();
    output.push_str("# Semantic Review Proposed Fix\n\n");
    output.push_str(&format!("- review_id: `{review_id}`\n"));
    output.push_str(&format!("- risk_level: `{}`\n", report.risk_level.as_str()));
    output.push_str(&format!("- summary: {}\n", report.summary));
    if let Some(description) = report.proposed_patch.description.as_deref() {
        output.push_str(&format!("- proposed_patch: {description}\n"));
    } else {
        output.push_str(
            "- proposed_patch: Semantic reviewer requested rework without a description.\n",
        );
    }
    if let Some(patch_artifact) = report.proposed_patch.patch_artifact.as_deref() {
        output.push_str(&format!("- patch_artifact: `{patch_artifact}`\n"));
    }

    output.push_str("\n## Required Actions\n\n");
    append_markdown_list(&mut output, &report.required_actions);
    output.push_str("\n## Suggested Tests\n\n");
    append_markdown_list(&mut output, &report.suggested_tests);
    output.push_str("\n## Uncertainty\n\n");
    append_markdown_list(&mut output, &report.uncertainty);
    output
}

#[derive(Debug, Deserialize)]
struct SemanticReviewDocument {
    semantic_review: ParsedSemanticReview,
}

#[derive(Debug, Deserialize)]
struct ParsedSemanticReview {
    #[serde(default)]
    _id: Option<String>,
    #[serde(default)]
    _session_id: Option<String>,
    #[serde(default)]
    _merge_attempt_id: Option<String>,
    #[serde(default)]
    _reviewer: Option<String>,
    #[serde(default)]
    _llm_executed: Option<bool>,
    #[serde(default)]
    _operator_id: Option<String>,
    risk_level: String,
    summary: String,
    #[serde(default)]
    _input_artifact: Option<String>,
    #[serde(default)]
    suspected_conflicts: Vec<ParsedSemanticConflict>,
    #[serde(default)]
    required_actions: Vec<String>,
    #[serde(default)]
    suggested_tests: Vec<String>,
    #[serde(rename = "proposed_patch", default)]
    proposed_patch: Option<ParsedProposedPatch>,
    #[serde(default)]
    uncertainty: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ParsedSemanticConflict {
    #[serde(default, rename = "type")]
    conflict_type: String,
    #[serde(default)]
    files: Vec<String>,
    #[serde(default)]
    _symbols: Vec<String>,
    #[serde(default)]
    explanation: String,
    #[serde(default = "default_confidence")]
    confidence: String,
}

#[derive(Debug, Deserialize)]
struct ParsedProposedPatch {
    #[serde(default)]
    available: bool,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    patch_artifact: Option<String>,
    #[serde(default)]
    patch: Option<String>,
}

pub fn parse_semantic_review_command_report(
    output: &str,
) -> Result<LocalSemanticReviewReport, String> {
    let yaml = semantic_review_yaml_from_command_output(output)?;
    let document: SemanticReviewDocument = serde_yaml::from_str(yaml)
        .map_err(|error| format!("invalid semantic_review YAML: {error}"))?;
    let review = document.semantic_review;
    let risk_level = SemanticRiskLevel::parse(review.risk_level.trim())
        .map_err(|error| format!("invalid semantic_review.risk_level: {error}"))?;
    let summary = trim_required_field("semantic_review.summary", review.summary)?;

    Ok(LocalSemanticReviewReport {
        risk_level,
        summary,
        suspected_conflicts: review
            .suspected_conflicts
            .into_iter()
            .map(SemanticConflictFinding::from)
            .collect(),
        required_actions: normalize_string_list(review.required_actions),
        suggested_tests: normalize_string_list(review.suggested_tests),
        proposed_patch: ProposedPatch::from(review.proposed_patch),
        uncertainty: normalize_string_list(review.uncertainty),
    })
}

fn semantic_review_yaml_from_command_output(output: &str) -> Result<&str, String> {
    let start = output
        .find("semantic_review:")
        .ok_or_else(|| "missing semantic_review root".to_string())?;
    let yaml = &output[start..];
    Ok(yaml.find("\n```").map_or(yaml, |end| &yaml[..end]).trim())
}

fn trim_required_field(field: &str, value: String) -> Result<String, String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        Err(format!("missing {field}"))
    } else {
        Ok(trimmed)
    }
}

fn normalize_string_list(values: Vec<String>) -> Vec<String> {
    values
        .into_iter()
        .filter_map(|value| {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        })
        .collect()
}

fn default_confidence() -> String {
    "medium".to_string()
}

impl From<ParsedSemanticConflict> for SemanticConflictFinding {
    fn from(value: ParsedSemanticConflict) -> Self {
        let conflict_type = value.conflict_type.trim();
        let confidence = value.confidence.trim();
        Self {
            conflict_type: if conflict_type.is_empty() {
                "unknown".to_string()
            } else {
                conflict_type.to_string()
            },
            files: normalize_string_list(value.files),
            explanation: value.explanation.trim().to_string(),
            confidence: if confidence.is_empty() {
                default_confidence()
            } else {
                confidence.to_string()
            },
        }
    }
}

impl From<Option<ParsedProposedPatch>> for ProposedPatch {
    fn from(value: Option<ParsedProposedPatch>) -> Self {
        let Some(value) = value else {
            return ProposedPatch::unavailable();
        };

        let description = normalize_optional_string(value.description);
        let patch = normalize_optional_string(value.patch);
        let patch_artifact = normalize_optional_string(value.patch_artifact)
            .or_else(|| normalize_optional_string(value.path));

        ProposedPatch {
            available: value.available,
            description,
            patch,
            fix_plan_artifact: None,
            patch_artifact,
        }
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn append_diff_patch_context(output: &mut String, context: Option<&DiffPatchContext>) {
    output.push_str("\n## Patch Context\n\n");
    output.push_str(
        "Actual candidate patch hunks from the session completion artifact. Use this as diff evidence alongside the Change Manifest; if it is truncated, inspect the artifact path before making a high-confidence claim.\n\n",
    );

    let Some(context) = context else {
        output.push_str("_No diff patch artifact path is recorded in the Change Manifest._\n");
        return;
    };

    output.push_str(&format!("- artifact: `{}`\n", context.artifact_path));
    output.push_str(&format!("- max_chars: `{}`\n", context.max_chars));

    match context.content.as_deref() {
        Some(content) => {
            output.push_str(&format!(
                "- included: `{}`\n",
                if context.truncated {
                    "truncated"
                } else {
                    "full"
                }
            ));
            output.push_str(&format!("- included_chars: `{}`\n", context.included_chars));
            if let Some(original_chars) = context.original_chars {
                output.push_str(&format!("- original_chars: `{original_chars}`\n"));
            }
            output.push_str("\n```diff\n");
            output.push_str(content);
            if !content.ends_with('\n') {
                output.push('\n');
            }
            if context.truncated {
                output.push_str(
                    "\n# ... patch context truncated; inspect the artifact above for the full diff.\n",
                );
            }
            output.push_str("```\n");
        }
        None => {
            output.push_str(&format!(
                "- unavailable: `{}`\n",
                context.unavailable_reason.as_deref().unwrap_or("unknown")
            ));
        }
    }
}

fn append_adapter_output_contract(output: &mut String, session: &Session, attempt: &MergeAttempt) {
    output.push_str("## Adapter Output Contract\n\n");
    output.push_str(
        "Return only a YAML document. Do not include Markdown headings, prose, analysis notes, verdict text, or fenced code blocks.\n",
    );
    output.push_str("The first non-whitespace characters of stdout must be `semantic_review:`.\n");
    output.push_str("Choose exactly one risk_level: `low`, `medium`, `high`, or `blocked`.\n\n");
    output.push_str("```yaml\n");
    output.push_str("semantic_review:\n");
    output.push_str(&format!("  session_id: {}\n", yaml_quote(&session.id)));
    output.push_str(&format!(
        "  merge_attempt_id: {}\n",
        yaml_quote(&attempt.id)
    ));
    output.push_str("  risk_level: \"medium\"\n");
    output.push_str("  summary: \"\"\n");
    output.push_str("  suspected_conflicts: []\n");
    output.push_str("  required_actions: []\n");
    output.push_str("  suggested_tests: []\n");
    output.push_str("  proposed_patch:\n");
    output.push_str("    available: false\n");
    output.push_str("    description: \"\"\n");
    output.push_str("    patch_artifact: \"\"\n");
    output.push_str("    patch: \"\"\n");
    output.push_str("  uncertainty: []\n");
    output.push_str("```\n\n");
}

fn append_related_change_manifest(output: &mut String, related: &RelatedChangeManifest) {
    output.push_str(&format!(
        "### {} Manifest: {}\n\n",
        related.relation.title(),
        related.session_id
    ));
    output.push_str(&format!("- relation: `{}`\n", related.relation.as_str()));
    output.push_str(&format!("- session_status: `{}`\n", related.session_status));
    output.push_str(&format!("- goal: `{}`\n", related.goal));
    output.push_str(&format!("- base_commit: `{}`\n", related.base_commit));
    output.push_str(&format!(
        "- head_commit: `{}`\n",
        related.head_commit.as_deref().unwrap_or("")
    ));
    output.push_str(&format!(
        "- latest_attempt_id: `{}`\n",
        related.latest_attempt_id.as_deref().unwrap_or("")
    ));
    output.push_str(&format!(
        "- latest_attempt_status: `{}`\n",
        related.latest_attempt_status.as_deref().unwrap_or("")
    ));
    output.push_str(&format!(
        "- latest_attempt_main_before: `{}`\n",
        related
            .latest_attempt_main_before_commit
            .as_deref()
            .unwrap_or("")
    ));
    output.push_str(&format!(
        "- latest_attempt_verified_commit: `{}`\n",
        related
            .latest_attempt_verified_commit_id
            .as_deref()
            .unwrap_or("")
    ));
    output.push_str(&format!("- manifest_id: `{}`\n", related.manifest_id));
    output.push_str(&format!("- manifest_path: `{}`\n", related.manifest_path));
    output.push_str(&format!(
        "- manifest_hash_mismatch: `{}`\n\n",
        related.manifest_hash_mismatch
    ));
    match related.manifest_content.as_deref() {
        Some(content) => {
            output.push_str("```yaml\n");
            output.push_str(content);
            if !content.ends_with('\n') {
                output.push('\n');
            }
            output.push_str("```\n\n");
        }
        None => output.push_str("_Related manifest artifact could not be read._\n\n"),
    }
}

fn append_proposed_patch_yaml(output: &mut String, proposed_patch: &ProposedPatch, indent: usize) {
    let padding = " ".repeat(indent);
    output.push_str(&format!("{padding}proposed_patch:\n"));
    output.push_str(&format!(
        "{padding}  available: {}\n",
        proposed_patch.available
    ));
    output.push_str(&format!(
        "{padding}  description: {}\n",
        yaml_quote(proposed_patch.description.as_deref().unwrap_or(""))
    ));
    output.push_str(&format!(
        "{padding}  fix_plan_artifact: {}\n",
        yaml_quote(proposed_patch.fix_plan_artifact.as_deref().unwrap_or(""))
    ));
    output.push_str(&format!(
        "{padding}  patch_artifact: {}\n",
        yaml_quote(proposed_patch.patch_artifact.as_deref().unwrap_or(""))
    ));
}

fn append_semantic_conflicts_yaml(
    output: &mut String,
    findings: &[SemanticConflictFinding],
    indent: usize,
) {
    if findings.is_empty() {
        output.push_str(&format!("{}[]\n", " ".repeat(indent)));
        return;
    }

    for finding in findings {
        output.push_str(&format!(
            "{}- type: {}\n",
            " ".repeat(indent),
            yaml_quote(&finding.conflict_type)
        ));
        output.push_str(&format!("{}  files:\n", " ".repeat(indent)));
        append_string_list_yaml(output, &finding.files, indent + 4);
        output.push_str(&format!("{}  symbols: []\n", " ".repeat(indent)));
        output.push_str(&format!(
            "{}  explanation: {}\n",
            " ".repeat(indent),
            yaml_quote(&finding.explanation)
        ));
        output.push_str(&format!(
            "{}  confidence: {}\n",
            " ".repeat(indent),
            yaml_quote(&finding.confidence)
        ));
    }
}

fn append_string_list_yaml(output: &mut String, values: &[String], indent: usize) {
    if values.is_empty() {
        output.push_str(&format!("{}[]\n", " ".repeat(indent)));
        return;
    }

    for value in values {
        output.push_str(&format!("{}- {}\n", " ".repeat(indent), yaml_quote(value)));
    }
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

fn yaml_quote(value: &str) -> String {
    format!(
        "\"{}\"",
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_structured_yaml_report_with_conflicts() {
        let report = parse_semantic_review_command_report(
            r#"
```yaml
semantic_review:
  risk_level: high
  summary: >
    API surface changed and call sites should be checked.
  suspected_conflicts:
    - type: api_contract_change
      files:
        - src/auth.rs
      symbols:
        - login
      explanation: >
        The login signature changed.
      confidence: high
  required_actions:
    - "Audit call sites."
  suggested_tests:
    - "cargo test auth"
  proposed_patch:
    available: true
    description: "Update stale call sites."
    patch: |
      diff --git a/src/auth.rs b/src/auth.rs
      --- a/src/auth.rs
      +++ b/src/auth.rs
      @@ -1 +1 @@
      -old()
      +new()
  uncertainty:
    - "No call graph is available."
```
"#,
        )
        .expect("parse report");

        assert_eq!(report.risk_level, SemanticRiskLevel::High);
        assert_eq!(
            report.summary,
            "API surface changed and call sites should be checked."
        );
        assert_eq!(report.suspected_conflicts.len(), 1);
        assert_eq!(
            report.suspected_conflicts[0],
            SemanticConflictFinding {
                conflict_type: "api_contract_change".to_string(),
                files: vec!["src/auth.rs".to_string()],
                explanation: "The login signature changed.".to_string(),
                confidence: "high".to_string(),
            }
        );
        assert_eq!(
            report.required_actions,
            vec!["Audit call sites.".to_string()]
        );
        assert_eq!(report.suggested_tests, vec!["cargo test auth".to_string()]);
        assert!(report.proposed_patch.available);
        assert_eq!(
            report.proposed_patch.description.as_deref(),
            Some("Update stale call sites.")
        );
        assert!(report
            .proposed_patch
            .patch
            .as_deref()
            .unwrap_or("")
            .contains("+new()"));
        assert_eq!(
            report.uncertainty,
            vec!["No call graph is available.".to_string()]
        );
    }

    #[test]
    fn renders_review_input_report_yaml_and_fix_plan() {
        let session = Session {
            id: "session-1".to_string(),
            goal: "update app".to_string(),
            provider: "codex".to_string(),
            target_path: Some("app.txt".to_string()),
            branch: "aich/session/session-1".to_string(),
            worktree_path: ".aichestra/worktrees/session-1".to_string(),
            base_commit: "base".to_string(),
            head_commit: Some("head".to_string()),
            status: aich_core::SessionStatus::Enqueued,
            created_at_ms: 1,
            updated_at_ms: 2,
        };
        let attempt = MergeAttempt {
            id: "merge-1".to_string(),
            session_id: session.id.clone(),
            status: aich_core::MergeAttemptStatus::Verified,
            main_before_commit: "main".to_string(),
            candidate_commit: "head".to_string(),
            apply_strategy: "merge_no_ff_commit".to_string(),
            check_policy_fingerprint: Some("check-policy".to_string()),
            verified_tree_id: Some("tree".to_string()),
            verified_commit_id: Some("verified".to_string()),
            checks_passed: true,
            semantic_risk_level: Some("low".to_string()),
        };
        let manifest = ChangeManifest {
            id: "manifest-1".to_string(),
            session_id: session.id.clone(),
            manifest_path: ".aichestra/artifacts/change-manifest.yaml".to_string(),
            manifest_hash: None,
            validation_status: "generated_from_diff".to_string(),
            created_at_ms: 3,
        };
        let patch_set = PatchSet {
            id: "patch-1".to_string(),
            session_id: session.id.clone(),
            base_commit: "base".to_string(),
            head_commit: Some("head".to_string()),
            patch_id: Some("head".to_string()),
            diff_stat: Some(" app.txt | 1 +\n".to_string()),
            created_at_ms: 4,
        };
        let changed_files = vec![ChangedFile::new("app.txt", "modified")];
        let check_results = vec![CheckResult {
            id: "check-1".to_string(),
            merge_attempt_id: attempt.id.clone(),
            name: "test".to_string(),
            command: "cargo test --all".to_string(),
            required: true,
            timed_out: false,
            result: aich_core::CheckResultStatus::Passed,
            stdout_artifact: None,
            stderr_artifact: None,
            created_at_ms: 5,
        }];
        let diff_context = DiffPatchContext::from_content(
            ".aichestra/artifacts/sessions/session-1/diff.patch",
            "diff --git a/app.txt b/app.txt\n@@ -1 +1 @@\n+new\n".to_string(),
        );

        let input = render_semantic_review_input(SemanticReviewInput {
            reviewer_id: "reviewer",
            llm_executed: true,
            session: &session,
            attempt: &attempt,
            manifest: &manifest,
            manifest_content: Some("change_manifest:\n  session_id: session-1\n"),
            patch_set: Some(&patch_set),
            diff_patch_context: Some(&diff_context),
            changed_files: &changed_files,
            check_results: &check_results,
            related_manifests: &[],
            config_path: Path::new(".aichestra/config.yaml"),
            prompt_path: ".aichestra/prompts/semantic-merge-review.md",
            prompt_content: Some("Return YAML."),
        });
        assert!(input.contains("## Adapter Output Contract"));
        assert!(input.contains("## Patch Context"));
        assert!(input.contains("+new"));

        let mut report = LocalSemanticReviewReport {
            risk_level: SemanticRiskLevel::Low,
            summary: "Looks isolated.".to_string(),
            suspected_conflicts: Vec::new(),
            required_actions: vec!["Inspect app.txt".to_string()],
            suggested_tests: vec!["cargo test --all".to_string()],
            proposed_patch: ProposedPatch::unavailable(),
            uncertainty: Vec::new(),
        };
        let yaml = render_semantic_review_yaml(
            "review-1",
            &session,
            &attempt,
            &report,
            SemanticReviewReportMetadata {
                reviewer_id: "reviewer",
                llm_executed: true,
                operator_id: "local-user",
                input_artifact: ".aichestra/artifacts/input.md",
            },
        );
        assert!(yaml.contains("operator_id: \"local-user\""));
        assert!(yaml.contains("summary: \"Looks isolated.\""));

        report.proposed_patch.available = true;
        report.proposed_patch.description = Some("Follow-up wording fix.".to_string());
        let fix_plan = render_proposed_fix_plan_artifact("review-1", &report);
        assert!(fix_plan.contains("# Semantic Review Proposed Fix"));
        assert!(fix_plan.contains("Follow-up wording fix."));
    }

    #[test]
    fn rejects_invalid_yaml_shape() {
        let err = parse_semantic_review_command_report(
            r#"
semantic_review:
  risk_level: medium
  summary: "ok"
  suspected_conflicts: "not a list"
"#,
        )
        .unwrap_err();

        assert!(err.contains("invalid semantic_review YAML"));

        let err = parse_semantic_review_command_report(
            r#"
semantic_review:
  risk_level: medium
  summary: "ok"
  proposed_patch: "not a proposed patch object"
"#,
        )
        .unwrap_err();

        assert!(err.contains("invalid semantic_review YAML"));
    }

    #[test]
    fn rejects_missing_or_invalid_required_fields() {
        let err = parse_semantic_review_command_report("no yaml").unwrap_err();
        assert_eq!(err, "missing semantic_review root");

        let err = parse_semantic_review_command_report(
            r#"
semantic_review:
  risk_level: critical
  summary: "bad risk"
"#,
        )
        .unwrap_err();
        assert!(err.contains("invalid semantic_review.risk_level"));

        let err = parse_semantic_review_command_report(
            r#"
semantic_review:
  risk_level: medium
  summary: "   "
"#,
        )
        .unwrap_err();
        assert_eq!(err, "missing semantic_review.summary");
    }
}

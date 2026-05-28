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

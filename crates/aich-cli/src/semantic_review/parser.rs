use aich_core::SemanticRiskLevel;
use serde::Deserialize;

use super::report::{LocalSemanticReviewReport, SemanticConflictFinding};

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
    _proposed_patch: Option<ParsedProposedPatch>,
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
    _available: bool,
    #[serde(default)]
    _description: Option<String>,
    #[serde(default)]
    _path: Option<String>,
    #[serde(default)]
    _patch_artifact: Option<String>,
}

pub(super) fn parse_semantic_review_command_report(
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
    available: false
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
  risk_level: low
  summary: ok
  suspected_conflicts: "not a list"
"#,
        )
        .unwrap_err();

        assert!(err.contains("invalid semantic_review YAML"));

        let err = parse_semantic_review_command_report(
            r#"
semantic_review:
  risk_level: low
  summary: ok
  proposed_patch: "not a proposed patch object"
"#,
        )
        .unwrap_err();

        assert!(err.contains("invalid semantic_review YAML"));
    }

    #[test]
    fn rejects_missing_or_invalid_required_fields() {
        let missing_summary = parse_semantic_review_command_report(
            r#"
semantic_review:
  risk_level: low
  summary: ""
"#,
        )
        .unwrap_err();
        assert!(missing_summary.contains("missing semantic_review.summary"));

        let invalid_risk = parse_semantic_review_command_report(
            r#"
semantic_review:
  risk_level: safe
  summary: "invalid risk"
"#,
        )
        .unwrap_err();
        assert!(invalid_risk.contains("invalid semantic_review.risk_level"));
    }
}

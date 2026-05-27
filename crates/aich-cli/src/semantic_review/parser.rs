use aich_core::SemanticRiskLevel;

use crate::command_line::strip_yaml_scalar;

use super::report::{LocalSemanticReviewReport, SemanticConflictFinding};

pub(super) fn parse_semantic_review_command_report(
    output: &str,
) -> Result<LocalSemanticReviewReport, String> {
    #[derive(Copy, Clone, Eq, PartialEq)]
    enum Section {
        None,
        SuspectedConflicts,
        RequiredActions,
        SuggestedTests,
        Uncertainty,
    }

    #[derive(Copy, Clone, Eq, PartialEq)]
    enum ConflictList {
        Files,
        Symbols,
    }

    let yaml = semantic_review_yaml_from_command_output(output)?;
    let mut risk_level: Option<SemanticRiskLevel> = None;
    let mut summary: Option<String> = None;
    let mut suspected_conflicts = Vec::new();
    let mut required_actions = Vec::new();
    let mut suggested_tests = Vec::new();
    let mut uncertainty = Vec::new();
    let mut section = Section::None;
    let mut current_conflict: Option<SemanticConflictFinding> = None;
    let mut conflict_list: Option<ConflictList> = None;

    for line in yaml.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("```") {
            continue;
        }
        if trimmed == "semantic_review:" {
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("risk_level:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = Section::None;
            risk_level = Some(
                SemanticRiskLevel::parse(strip_yaml_scalar(value).as_str())
                    .map_err(|error| format!("invalid semantic_review.risk_level: {error}"))?,
            );
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("summary:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = Section::None;
            summary = Some(strip_yaml_scalar(value));
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("suspected_conflicts:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = if strip_yaml_scalar(value) == "[]" {
                Section::None
            } else {
                Section::SuspectedConflicts
            };
            conflict_list = None;
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("required_actions:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = if strip_yaml_scalar(value) == "[]" {
                Section::None
            } else {
                Section::RequiredActions
            };
            conflict_list = None;
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("suggested_tests:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = if strip_yaml_scalar(value) == "[]" {
                Section::None
            } else {
                Section::SuggestedTests
            };
            conflict_list = None;
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("uncertainty:") {
            push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
            section = if strip_yaml_scalar(value) == "[]" {
                Section::None
            } else {
                Section::Uncertainty
            };
            conflict_list = None;
            continue;
        }

        match section {
            Section::SuspectedConflicts => {
                if let Some(value) = trimmed.strip_prefix("- type:") {
                    push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
                    current_conflict = Some(SemanticConflictFinding {
                        conflict_type: strip_yaml_scalar(value),
                        files: Vec::new(),
                        explanation: String::new(),
                        confidence: "medium".to_string(),
                    });
                    conflict_list = None;
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("type:") {
                    let finding =
                        current_conflict.get_or_insert_with(default_semantic_conflict_finding);
                    finding.conflict_type = strip_yaml_scalar(value);
                    conflict_list = None;
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("files:") {
                    let _ = current_conflict.get_or_insert_with(default_semantic_conflict_finding);
                    conflict_list = if strip_yaml_scalar(value) == "[]" {
                        None
                    } else {
                        Some(ConflictList::Files)
                    };
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("symbols:") {
                    conflict_list = if strip_yaml_scalar(value) == "[]" {
                        None
                    } else {
                        Some(ConflictList::Symbols)
                    };
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("explanation:") {
                    let finding =
                        current_conflict.get_or_insert_with(default_semantic_conflict_finding);
                    finding.explanation = strip_yaml_scalar(value);
                    conflict_list = None;
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("confidence:") {
                    let finding =
                        current_conflict.get_or_insert_with(default_semantic_conflict_finding);
                    finding.confidence = strip_yaml_scalar(value);
                    conflict_list = None;
                    continue;
                }

                if let Some(value) = trimmed.strip_prefix("- ") {
                    if conflict_list == Some(ConflictList::Files) {
                        let finding =
                            current_conflict.get_or_insert_with(default_semantic_conflict_finding);
                        finding.files.push(strip_yaml_scalar(value));
                    }
                }
            }
            Section::RequiredActions => {
                append_command_report_list_item(trimmed, &mut required_actions)
            }
            Section::SuggestedTests => {
                append_command_report_list_item(trimmed, &mut suggested_tests)
            }
            Section::Uncertainty => append_command_report_list_item(trimmed, &mut uncertainty),
            Section::None => {}
        }
    }

    push_pending_conflict(&mut suspected_conflicts, &mut current_conflict);
    let risk_level = risk_level.ok_or_else(|| "missing semantic_review.risk_level".to_string())?;
    let summary = summary
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "missing semantic_review.summary".to_string())?;

    Ok(LocalSemanticReviewReport {
        risk_level,
        summary,
        suspected_conflicts,
        required_actions,
        suggested_tests,
        uncertainty,
    })
}

fn semantic_review_yaml_from_command_output(output: &str) -> Result<&str, String> {
    let start = output
        .find("semantic_review:")
        .ok_or_else(|| "missing semantic_review root".to_string())?;
    let yaml = &output[start..];
    Ok(yaml.find("\n```").map_or(yaml, |end| &yaml[..end]))
}

fn append_command_report_list_item(trimmed: &str, values: &mut Vec<String>) {
    if let Some(value) = trimmed.strip_prefix("- ") {
        values.push(strip_yaml_scalar(value));
    }
}

fn push_pending_conflict(
    conflicts: &mut Vec<SemanticConflictFinding>,
    current: &mut Option<SemanticConflictFinding>,
) {
    if let Some(mut finding) = current.take() {
        if finding.conflict_type.trim().is_empty() {
            finding.conflict_type = "unknown".to_string();
        }
        if finding.confidence.trim().is_empty() {
            finding.confidence = "medium".to_string();
        }
        conflicts.push(finding);
    }
}

fn default_semantic_conflict_finding() -> SemanticConflictFinding {
    SemanticConflictFinding {
        conflict_type: "unknown".to_string(),
        files: Vec::new(),
        explanation: String::new(),
        confidence: "medium".to_string(),
    }
}

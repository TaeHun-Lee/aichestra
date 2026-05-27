use std::error::Error;
use std::fmt::{Display, Formatter};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MergeAttemptStatus {
    Pending,
    PreflightRunning,
    Verified,
    Blocked,
    Applying,
    Applied,
}

impl MergeAttemptStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::PreflightRunning => "preflight_running",
            Self::Verified => "verified",
            Self::Blocked => "blocked",
            Self::Applying => "applying",
            Self::Applied => "applied",
        }
    }

    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "pending" => Ok(Self::Pending),
            "preflight_running" => Ok(Self::PreflightRunning),
            "verified" => Ok(Self::Verified),
            "blocked" => Ok(Self::Blocked),
            "applying" => Ok(Self::Applying),
            "applied" => Ok(Self::Applied),
            other => Err(format!("unknown merge attempt status '{other}'")),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MergeAttempt {
    pub id: String,
    pub session_id: String,
    pub status: MergeAttemptStatus,
    pub main_before_commit: String,
    pub candidate_commit: String,
    pub apply_strategy: String,
    pub verified_tree_id: Option<String>,
    pub verified_commit_id: Option<String>,
    pub checks_passed: bool,
    pub semantic_risk_level: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueLock {
    pub name: String,
    pub holder_id: String,
    pub operation: String,
    pub session_id: Option<String>,
    pub acquired_at_ms: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Approval {
    pub id: String,
    pub merge_attempt_id: String,
    pub approved_by: String,
    pub approved_verified_tree_id: String,
    pub approved_verified_commit_id: String,
    pub created_at_ms: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CheckResultStatus {
    Passed,
    Failed,
}

impl CheckResultStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Passed => "passed",
            Self::Failed => "failed",
        }
    }

    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "passed" => Ok(Self::Passed),
            "failed" => Ok(Self::Failed),
            other => Err(format!("unknown check result status '{other}'")),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CheckResult {
    pub id: String,
    pub merge_attempt_id: String,
    pub name: String,
    pub command: String,
    pub required: bool,
    pub timed_out: bool,
    pub result: CheckResultStatus,
    pub stdout_artifact: Option<String>,
    pub stderr_artifact: Option<String>,
    pub created_at_ms: i64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SemanticRiskLevel {
    Low,
    Medium,
    High,
    Blocked,
}

impl SemanticRiskLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
            Self::Blocked => "blocked",
        }
    }

    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "low" => Ok(Self::Low),
            "medium" => Ok(Self::Medium),
            "high" => Ok(Self::High),
            "blocked" => Ok(Self::Blocked),
            other => Err(format!("unknown semantic risk level '{other}'")),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SemanticReview {
    pub id: String,
    pub merge_attempt_id: String,
    pub risk_level: SemanticRiskLevel,
    pub report_path: Option<String>,
    pub created_at_ms: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VerifiedTreeViolation {
    AttemptNotVerified {
        status: String,
    },
    ChecksNotPassed,
    ApprovalAttemptMismatch {
        approval_attempt_id: String,
        merge_attempt_id: String,
    },
    MainMoved {
        expected: String,
        actual: String,
    },
    MissingVerifiedTree,
    MissingVerifiedCommit,
    VerifiedTreeMismatch {
        expected: String,
        approved: String,
    },
    VerifiedCommitMismatch {
        expected: String,
        approved: String,
    },
}

impl Display for VerifiedTreeViolation {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AttemptNotVerified { status } => {
                write!(f, "merge attempt is not verified; status is {status}")
            }
            Self::ChecksNotPassed => write!(f, "merge attempt checks have not passed"),
            Self::ApprovalAttemptMismatch {
                approval_attempt_id,
                merge_attempt_id,
            } => write!(
                f,
                "approval targets merge attempt {approval_attempt_id}, not {merge_attempt_id}"
            ),
            Self::MainMoved { expected, actual } => {
                write!(
                    f,
                    "main moved after preflight: expected {expected}, got {actual}"
                )
            }
            Self::MissingVerifiedTree => write!(f, "merge attempt has no verified tree id"),
            Self::MissingVerifiedCommit => write!(f, "merge attempt has no verified commit id"),
            Self::VerifiedTreeMismatch { expected, approved } => write!(
                f,
                "approved tree {approved} does not match verified tree {expected}"
            ),
            Self::VerifiedCommitMismatch { expected, approved } => write!(
                f,
                "approved commit {approved} does not match verified commit {expected}"
            ),
        }
    }
}

impl Error for VerifiedTreeViolation {}

pub fn assert_verified_candidate_can_apply(
    attempt: &MergeAttempt,
    approval: &Approval,
    current_main_commit: &str,
) -> Result<(), VerifiedTreeViolation> {
    if attempt.status != MergeAttemptStatus::Verified {
        return Err(VerifiedTreeViolation::AttemptNotVerified {
            status: attempt.status.as_str().to_string(),
        });
    }

    if !attempt.checks_passed {
        return Err(VerifiedTreeViolation::ChecksNotPassed);
    }

    if approval.merge_attempt_id != attempt.id {
        return Err(VerifiedTreeViolation::ApprovalAttemptMismatch {
            approval_attempt_id: approval.merge_attempt_id.clone(),
            merge_attempt_id: attempt.id.clone(),
        });
    }

    if attempt.main_before_commit != current_main_commit {
        return Err(VerifiedTreeViolation::MainMoved {
            expected: attempt.main_before_commit.clone(),
            actual: current_main_commit.to_string(),
        });
    }

    let verified_tree_id = attempt
        .verified_tree_id
        .as_deref()
        .filter(|value| !value.is_empty())
        .ok_or(VerifiedTreeViolation::MissingVerifiedTree)?;
    let verified_commit_id = attempt
        .verified_commit_id
        .as_deref()
        .filter(|value| !value.is_empty())
        .ok_or(VerifiedTreeViolation::MissingVerifiedCommit)?;

    if approval.approved_verified_tree_id != verified_tree_id {
        return Err(VerifiedTreeViolation::VerifiedTreeMismatch {
            expected: verified_tree_id.to_string(),
            approved: approval.approved_verified_tree_id.clone(),
        });
    }

    if approval.approved_verified_commit_id != verified_commit_id {
        return Err(VerifiedTreeViolation::VerifiedCommitMismatch {
            expected: verified_commit_id.to_string(),
            approved: approval.approved_verified_commit_id.clone(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn verified_attempt() -> MergeAttempt {
        MergeAttempt {
            id: "merge-1".to_string(),
            session_id: "session-1".to_string(),
            status: MergeAttemptStatus::Verified,
            main_before_commit: "main-a".to_string(),
            candidate_commit: "candidate-b".to_string(),
            apply_strategy: "verified_commit".to_string(),
            verified_tree_id: Some("tree-c".to_string()),
            verified_commit_id: Some("commit-d".to_string()),
            checks_passed: true,
            semantic_risk_level: Some("low".to_string()),
        }
    }

    fn matching_approval() -> Approval {
        Approval {
            id: "approval-1".to_string(),
            merge_attempt_id: "merge-1".to_string(),
            approved_by: "local-user".to_string(),
            approved_verified_tree_id: "tree-c".to_string(),
            approved_verified_commit_id: "commit-d".to_string(),
            created_at_ms: 1,
        }
    }

    #[test]
    fn accepts_approval_for_same_verified_tree_and_main_commit() {
        assert!(assert_verified_candidate_can_apply(
            &verified_attempt(),
            &matching_approval(),
            "main-a"
        )
        .is_ok());
    }

    #[test]
    fn rejects_apply_when_main_moved_after_preflight() {
        let err = assert_verified_candidate_can_apply(
            &verified_attempt(),
            &matching_approval(),
            "main-new",
        )
        .unwrap_err();

        assert!(matches!(err, VerifiedTreeViolation::MainMoved { .. }));
    }

    #[test]
    fn rejects_approval_for_different_tree() {
        let mut approval = matching_approval();
        approval.approved_verified_tree_id = "other-tree".to_string();

        let err = assert_verified_candidate_can_apply(&verified_attempt(), &approval, "main-a")
            .unwrap_err();

        assert!(matches!(
            err,
            VerifiedTreeViolation::VerifiedTreeMismatch { .. }
        ));
    }
}

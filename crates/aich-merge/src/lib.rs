use std::error::Error;
use std::fmt::{Display, Formatter};

use aich_core::{
    Approval, CheckResult, CheckResultStatus, MergeAttempt, MergeAttemptStatus, SemanticReview,
    SemanticRiskLevel, Session, SessionStatus,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueCandidateStatus {
    Enqueued,
    PreflightRunning,
    Applying,
    Verified,
    Approved,
    Blocked,
}

impl QueueCandidateStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Enqueued => "enqueued",
            Self::PreflightRunning => "preflight_running",
            Self::Applying => "applying",
            Self::Verified => "verified",
            Self::Approved => "approved",
            Self::Blocked => "blocked",
        }
    }
}

pub fn queue_candidate_status(
    session: &Session,
    latest_attempt: Option<&MergeAttempt>,
    latest_approval: Option<&Approval>,
) -> Option<QueueCandidateStatus> {
    if session.status == SessionStatus::Abandoned {
        return None;
    }

    match latest_attempt {
        Some(attempt) => match attempt.status {
            MergeAttemptStatus::PreflightRunning => Some(QueueCandidateStatus::PreflightRunning),
            MergeAttemptStatus::Applying => Some(QueueCandidateStatus::Applying),
            MergeAttemptStatus::Blocked
                if session.status == SessionStatus::Enqueued
                    && session.head_commit.as_deref()
                        != Some(attempt.candidate_commit.as_str()) =>
            {
                Some(QueueCandidateStatus::Enqueued)
            }
            MergeAttemptStatus::Blocked => Some(QueueCandidateStatus::Blocked),
            MergeAttemptStatus::Verified if latest_approval.is_some() => {
                Some(QueueCandidateStatus::Approved)
            }
            MergeAttemptStatus::Verified => Some(QueueCandidateStatus::Verified),
            MergeAttemptStatus::Pending if session.status == SessionStatus::Enqueued => {
                Some(QueueCandidateStatus::Enqueued)
            }
            MergeAttemptStatus::Applied => None,
            MergeAttemptStatus::Pending => None,
        },
        None if session.status == SessionStatus::Enqueued => Some(QueueCandidateStatus::Enqueued),
        None => None,
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueBlockedReason {
    SemanticReview,
    ChecksFailed,
    MechanicalConflict,
    Unknown,
}

impl QueueBlockedReason {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::SemanticReview => "semantic_review",
            Self::ChecksFailed => "checks_failed",
            Self::MechanicalConflict => "mechanical_conflict",
            Self::Unknown => "unknown",
        }
    }
}

pub fn infer_queue_blocked_reason(
    attempt: &MergeAttempt,
    latest_review: Option<&SemanticReview>,
    check_results: &[CheckResult],
) -> QueueBlockedReason {
    if latest_review
        .map(|review| review.risk_level == SemanticRiskLevel::Blocked)
        .unwrap_or(false)
    {
        QueueBlockedReason::SemanticReview
    } else if check_results
        .iter()
        .any(|check| check.required && check.result == CheckResultStatus::Failed)
    {
        QueueBlockedReason::ChecksFailed
    } else if attempt.verified_commit_id.is_none() || attempt.verified_tree_id.is_none() {
        QueueBlockedReason::MechanicalConflict
    } else {
        QueueBlockedReason::Unknown
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AttemptReviewReadinessError {
    AttemptNotVerified {
        attempt_id: String,
        session_id: String,
        status: String,
    },
    ChecksNotPassed {
        attempt_id: String,
    },
    MissingVerifiedTreeOrCommit {
        attempt_id: String,
        session_id: String,
    },
}

impl Display for AttemptReviewReadinessError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AttemptNotVerified {
                attempt_id,
                session_id,
                ..
            } => write!(
                f,
                "merge attempt '{attempt_id}' is not verified; run `aich preflight {session_id}` again"
            ),
            Self::ChecksNotPassed { attempt_id } => write!(
                f,
                "merge attempt '{attempt_id}' did not pass checks; fix the candidate and run preflight again"
            ),
            Self::MissingVerifiedTreeOrCommit {
                attempt_id,
                session_id,
            } => write!(
                f,
                "merge attempt '{attempt_id}' has no verified tree/commit; run `aich preflight {session_id}` again"
            ),
        }
    }
}

impl Error for AttemptReviewReadinessError {}

pub fn ensure_attempt_can_be_reviewed(
    attempt: &MergeAttempt,
) -> Result<(), AttemptReviewReadinessError> {
    if attempt.status != MergeAttemptStatus::Verified {
        return Err(AttemptReviewReadinessError::AttemptNotVerified {
            attempt_id: attempt.id.clone(),
            session_id: attempt.session_id.clone(),
            status: attempt.status.as_str().to_string(),
        });
    }
    if !attempt.checks_passed {
        return Err(AttemptReviewReadinessError::ChecksNotPassed {
            attempt_id: attempt.id.clone(),
        });
    }
    if attempt.verified_tree_id.as_deref().unwrap_or("").is_empty()
        || attempt
            .verified_commit_id
            .as_deref()
            .unwrap_or("")
            .is_empty()
    {
        return Err(AttemptReviewReadinessError::MissingVerifiedTreeOrCommit {
            attempt_id: attempt.id.clone(),
            session_id: attempt.session_id.clone(),
        });
    }

    Ok(())
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AttemptApprovalReadinessError {
    Review(AttemptReviewReadinessError),
    MissingSemanticRisk {
        attempt_id: String,
        session_id: String,
    },
    SemanticRiskBlocked {
        attempt_id: String,
    },
}

impl Display for AttemptApprovalReadinessError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Review(error) => Display::fmt(error, f),
            Self::MissingSemanticRisk {
                attempt_id,
                session_id,
            } => write!(
                f,
                "merge attempt '{attempt_id}' has no semantic risk result; run `aich review {session_id}` first"
            ),
            Self::SemanticRiskBlocked { attempt_id } => {
                write!(f, "merge attempt '{attempt_id}' is blocked by semantic review")
            }
        }
    }
}

impl Error for AttemptApprovalReadinessError {}

impl From<AttemptReviewReadinessError> for AttemptApprovalReadinessError {
    fn from(value: AttemptReviewReadinessError) -> Self {
        Self::Review(value)
    }
}

pub fn ensure_attempt_can_be_approved(
    attempt: &MergeAttempt,
) -> Result<(), AttemptApprovalReadinessError> {
    ensure_attempt_can_be_reviewed(attempt)?;
    if attempt
        .semantic_risk_level
        .as_deref()
        .unwrap_or("")
        .is_empty()
    {
        return Err(AttemptApprovalReadinessError::MissingSemanticRisk {
            attempt_id: attempt.id.clone(),
            session_id: attempt.session_id.clone(),
        });
    }
    if attempt.semantic_risk_level.as_deref() == Some(SemanticRiskLevel::Blocked.as_str()) {
        return Err(AttemptApprovalReadinessError::SemanticRiskBlocked {
            attempt_id: attempt.id.clone(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(status: SessionStatus, head_commit: Option<&str>) -> Session {
        Session {
            id: "session-1".to_string(),
            goal: "test".to_string(),
            provider: "codex".to_string(),
            target_path: None,
            branch: "aich/session/session-1".to_string(),
            worktree_path: ".aichestra/worktrees/session-1".to_string(),
            base_commit: "base".to_string(),
            head_commit: head_commit.map(str::to_string),
            status,
            created_at_ms: 1,
            updated_at_ms: 1,
        }
    }

    fn attempt(status: MergeAttemptStatus) -> MergeAttempt {
        let verified = matches!(
            status,
            MergeAttemptStatus::Verified
                | MergeAttemptStatus::Applying
                | MergeAttemptStatus::Applied
        );
        MergeAttempt {
            id: "merge-1".to_string(),
            session_id: "session-1".to_string(),
            status,
            main_before_commit: "main".to_string(),
            candidate_commit: "head".to_string(),
            apply_strategy: "merge_no_ff_commit".to_string(),
            check_policy_fingerprint: Some("check-policy".to_string()),
            verified_tree_id: verified.then(|| "tree".to_string()),
            verified_commit_id: verified.then(|| "verified".to_string()),
            checks_passed: verified,
            semantic_risk_level: verified.then(|| "medium".to_string()),
        }
    }

    fn check(required: bool, result: CheckResultStatus) -> CheckResult {
        CheckResult {
            id: "check-1".to_string(),
            merge_attempt_id: "merge-1".to_string(),
            name: "test".to_string(),
            command: "cargo test --all".to_string(),
            required,
            timed_out: false,
            result,
            stdout_artifact: None,
            stderr_artifact: None,
            created_at_ms: 1,
        }
    }

    fn review(risk_level: SemanticRiskLevel) -> SemanticReview {
        SemanticReview {
            id: "review-1".to_string(),
            merge_attempt_id: "merge-1".to_string(),
            risk_level,
            report_path: None,
            change_manifest_id: None,
            change_manifest_hash: None,
            verified_candidate_fingerprint: None,
            changed_files_fingerprint: None,
            check_results_fingerprint: None,
            review_evidence_fingerprint: None,
            proposed_patch_available: false,
            fix_plan_artifact: None,
            patch_artifact: None,
            created_at_ms: 1,
        }
    }

    #[test]
    fn reports_human_queue_statuses() {
        let enqueued = session(SessionStatus::Enqueued, Some("head"));
        assert_eq!(
            queue_candidate_status(&enqueued, None, None),
            Some(QueueCandidateStatus::Enqueued)
        );
        assert_eq!(
            queue_candidate_status(
                &enqueued,
                Some(&attempt(MergeAttemptStatus::PreflightRunning)),
                None
            ),
            Some(QueueCandidateStatus::PreflightRunning)
        );
        assert_eq!(
            queue_candidate_status(&enqueued, Some(&attempt(MergeAttemptStatus::Blocked)), None),
            Some(QueueCandidateStatus::Blocked)
        );
        assert_eq!(
            queue_candidate_status(
                &session(SessionStatus::Enqueued, Some("new-head")),
                Some(&attempt(MergeAttemptStatus::Blocked)),
                None
            ),
            Some(QueueCandidateStatus::Enqueued)
        );
        assert_eq!(
            queue_candidate_status(
                &session(SessionStatus::Abandoned, Some("head")),
                Some(&attempt(MergeAttemptStatus::Verified)),
                None
            ),
            None
        );
    }

    #[test]
    fn infers_blocked_reason_from_merge_evidence() {
        assert_eq!(
            infer_queue_blocked_reason(
                &attempt(MergeAttemptStatus::Blocked),
                Some(&review(SemanticRiskLevel::Blocked)),
                &[]
            ),
            QueueBlockedReason::SemanticReview
        );
        assert_eq!(
            infer_queue_blocked_reason(
                &attempt(MergeAttemptStatus::Blocked),
                None,
                &[check(true, CheckResultStatus::Failed)]
            ),
            QueueBlockedReason::ChecksFailed
        );
        assert_eq!(
            infer_queue_blocked_reason(&attempt(MergeAttemptStatus::Blocked), None, &[]),
            QueueBlockedReason::MechanicalConflict
        );
    }

    #[test]
    fn validates_review_and_approval_readiness() {
        let ready = attempt(MergeAttemptStatus::Verified);
        assert!(ensure_attempt_can_be_reviewed(&ready).is_ok());
        assert!(ensure_attempt_can_be_approved(&ready).is_ok());

        let mut missing_risk = ready.clone();
        missing_risk.semantic_risk_level = None;
        assert!(matches!(
            ensure_attempt_can_be_approved(&missing_risk),
            Err(AttemptApprovalReadinessError::MissingSemanticRisk { .. })
        ));

        let blocked = MergeAttempt {
            semantic_risk_level: Some("blocked".to_string()),
            ..ready
        };
        assert!(matches!(
            ensure_attempt_can_be_approved(&blocked),
            Err(AttemptApprovalReadinessError::SemanticRiskBlocked { .. })
        ));
    }
}

use crate::clock::now_millis;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EventName {
    RepoInitialized,
    SessionCreated,
    WorktreeCreated,
    SessionStarted,
    SessionAgentStarted,
    SessionAgentCompleted,
    SessionAgentFailed,
    SessionCompleted,
    SessionAbandoned,
    SessionCleaned,
    ContextSnapshotCreated,
    FilesChanged,
    PatchsetCreated,
    ManifestCreated,
    ManifestValidated,
    MergePreflightStarted,
    MergeMechanicalCompleted,
    MergeSemanticReviewCompleted,
    CheckCompleted,
    ApprovalRequested,
    ApprovalApproved,
    ApprovalRejected,
    MergeApplied,
    MergeBlocked,
    MergeQueueUnlocked,
}

impl EventName {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::RepoInitialized => "repo.initialized",
            Self::SessionCreated => "session.created",
            Self::WorktreeCreated => "worktree.created",
            Self::SessionStarted => "session.started",
            Self::SessionAgentStarted => "session.agent.started",
            Self::SessionAgentCompleted => "session.agent.completed",
            Self::SessionAgentFailed => "session.agent.failed",
            Self::SessionCompleted => "session.completed",
            Self::SessionAbandoned => "session.abandoned",
            Self::SessionCleaned => "session.cleaned",
            Self::ContextSnapshotCreated => "context.snapshot.created",
            Self::FilesChanged => "files.changed",
            Self::PatchsetCreated => "patchset.created",
            Self::ManifestCreated => "manifest.created",
            Self::ManifestValidated => "manifest.validated",
            Self::MergePreflightStarted => "merge.preflight.started",
            Self::MergeMechanicalCompleted => "merge.mechanical.completed",
            Self::MergeSemanticReviewCompleted => "merge.semantic_review.completed",
            Self::CheckCompleted => "check.completed",
            Self::ApprovalRequested => "approval.requested",
            Self::ApprovalApproved => "approval.approved",
            Self::ApprovalRejected => "approval.rejected",
            Self::MergeApplied => "merge.applied",
            Self::MergeBlocked => "merge.blocked",
            Self::MergeQueueUnlocked => "merge.queue_unlocked",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewEvent {
    pub name: EventName,
    pub subject_type: Option<String>,
    pub subject_id: Option<String>,
    pub data_json: String,
    pub created_at_ms: i64,
}

impl NewEvent {
    pub fn new(name: EventName) -> Self {
        Self {
            name,
            subject_type: None,
            subject_id: None,
            data_json: "{}".to_string(),
            created_at_ms: now_millis(),
        }
    }

    pub fn with_subject(
        mut self,
        subject_type: impl Into<String>,
        subject_id: impl Into<String>,
    ) -> Self {
        self.subject_type = Some(subject_type.into());
        self.subject_id = Some(subject_id.into());
        self
    }

    pub fn with_data_json(mut self, data_json: impl Into<String>) -> Self {
        self.data_json = data_json.into();
        self
    }
}

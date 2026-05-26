#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SessionStatus {
    Created,
    Running,
    Completed,
    Noop,
    Enqueued,
    Blocked,
    Abandoned,
}

impl SessionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Running => "running",
            Self::Completed => "completed",
            Self::Noop => "noop",
            Self::Enqueued => "enqueued",
            Self::Blocked => "blocked",
            Self::Abandoned => "abandoned",
        }
    }

    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "created" => Ok(Self::Created),
            "running" => Ok(Self::Running),
            "completed" => Ok(Self::Completed),
            "noop" => Ok(Self::Noop),
            "enqueued" => Ok(Self::Enqueued),
            "blocked" => Ok(Self::Blocked),
            "abandoned" => Ok(Self::Abandoned),
            other => Err(format!("unknown session status '{other}'")),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Session {
    pub id: String,
    pub goal: String,
    pub provider: String,
    pub target_path: Option<String>,
    pub branch: String,
    pub worktree_path: String,
    pub base_commit: String,
    pub head_commit: Option<String>,
    pub status: SessionStatus,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

impl Session {
    pub fn new(
        id: impl Into<String>,
        goal: impl Into<String>,
        provider: impl Into<String>,
        branch: impl Into<String>,
        worktree_path: impl Into<String>,
        base_commit: impl Into<String>,
        created_at_ms: i64,
    ) -> Self {
        Self {
            id: id.into(),
            goal: goal.into(),
            provider: provider.into(),
            target_path: None,
            branch: branch.into(),
            worktree_path: worktree_path.into(),
            base_commit: base_commit.into(),
            head_commit: None,
            status: SessionStatus::Created,
            created_at_ms,
            updated_at_ms: created_at_ms,
        }
    }
}

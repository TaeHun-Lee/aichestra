#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OperatorRole {
    Owner,
    Maintainer,
    Reviewer,
}

impl OperatorRole {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Owner => "owner",
            Self::Maintainer => "maintainer",
            Self::Reviewer => "reviewer",
        }
    }

    pub fn parse(value: &str) -> Result<Self, String> {
        match value.trim().to_ascii_lowercase().as_str() {
            "owner" => Ok(Self::Owner),
            "maintainer" => Ok(Self::Maintainer),
            "reviewer" => Ok(Self::Reviewer),
            other => Err(format!("unknown operator role '{other}'")),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OperatorStatus {
    Active,
    Disabled,
}

impl OperatorStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Disabled => "disabled",
        }
    }

    pub fn parse(value: &str) -> Result<Self, String> {
        match value.trim().to_ascii_lowercase().as_str() {
            "active" => Ok(Self::Active),
            "disabled" => Ok(Self::Disabled),
            other => Err(format!("unknown operator status '{other}'")),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Operator {
    pub id: String,
    pub display_name: String,
    pub role: OperatorRole,
    pub status: OperatorStatus,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

impl Operator {
    pub fn new(
        id: impl Into<String>,
        display_name: impl Into<String>,
        role: OperatorRole,
        created_at_ms: i64,
    ) -> Result<Self, String> {
        let id = id.into();
        let display_name = display_name.into();

        if id.trim().is_empty() {
            return Err("operator id must not be empty".to_string());
        }

        if display_name.trim().is_empty() {
            return Err("operator display name must not be empty".to_string());
        }

        Ok(Self {
            id,
            display_name,
            role,
            status: OperatorStatus::Active,
            created_at_ms,
            updated_at_ms: created_at_ms,
        })
    }

    pub fn is_active(&self) -> bool {
        self.status == OperatorStatus::Active
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PatchSet {
    pub id: String,
    pub session_id: String,
    pub base_commit: String,
    pub head_commit: Option<String>,
    pub patch_id: Option<String>,
    pub diff_stat: Option<String>,
    pub created_at_ms: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChangedFile {
    pub path: String,
    pub change_type: String,
    pub symbols_json: String,
}

impl ChangedFile {
    pub fn new(path: impl Into<String>, change_type: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            change_type: change_type.into(),
            symbols_json: "[]".to_string(),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContextSnapshot {
    pub id: String,
    pub session_id: Option<String>,
    pub hash_algorithm: String,
    pub snapshot_hash: String,
    pub created_at_ms: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChangeManifest {
    pub id: String,
    pub session_id: String,
    pub manifest_path: String,
    pub manifest_hash: Option<String>,
    pub validation_status: String,
    pub created_at_ms: i64,
}

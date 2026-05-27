pub mod schema;

use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs;
use std::path::Path;

use aich_core::{
    Approval, ChangeManifest, ChangedFile, CheckResult, CheckResultStatus, ContextSnapshot,
    EventName, MergeAttempt, MergeAttemptStatus, NewEvent, Operator, OperatorRole, OperatorStatus,
    PatchSet, QueueLock, SemanticReview, SemanticRiskLevel, Session, SessionStatus,
};
use rusqlite::{params, types::Type, Connection, Row};

#[derive(Debug)]
pub enum LedgerError {
    Io(std::io::Error),
    Sql(rusqlite::Error),
    Domain(String),
}

impl Display for LedgerError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(error) => write!(f, "io error: {error}"),
            Self::Sql(error) => write!(f, "sqlite error: {error}"),
            Self::Domain(error) => write!(f, "{error}"),
        }
    }
}

impl Error for LedgerError {}

impl From<std::io::Error> for LedgerError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<rusqlite::Error> for LedgerError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Sql(value)
    }
}

pub type Result<T> = std::result::Result<T, LedgerError>;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventRecord {
    pub id: i64,
    pub name: String,
    pub subject_type: Option<String>,
    pub subject_id: Option<String>,
    pub data_json: String,
    pub created_at_ms: i64,
}

pub struct Ledger {
    conn: Connection,
}

pub struct MergeAttemptResultUpdate<'a> {
    pub id: &'a str,
    pub status: MergeAttemptStatus,
    pub verified_tree_id: Option<&'a str>,
    pub verified_commit_id: Option<&'a str>,
    pub checks_passed: bool,
    pub semantic_risk_level: Option<&'a str>,
    pub updated_at_ms: i64,
}

pub struct MergeAttemptSemanticReviewUpdate<'a> {
    pub id: &'a str,
    pub status: MergeAttemptStatus,
    pub semantic_risk_level: SemanticRiskLevel,
    pub updated_at_ms: i64,
}

impl Ledger {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(path)?;
        let ledger = Self { conn };
        ledger.initialize_schema()?;
        Ok(ledger)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let ledger = Self { conn };
        ledger.initialize_schema()?;
        Ok(ledger)
    }

    pub fn initialize_schema(&self) -> Result<()> {
        self.conn.execute_batch(schema::SCHEMA_SQL)?;
        self.ensure_column(
            "check_results",
            "required",
            "ALTER TABLE check_results ADD COLUMN required INTEGER NOT NULL DEFAULT 1",
        )?;
        self.ensure_column(
            "check_results",
            "timed_out",
            "ALTER TABLE check_results ADD COLUMN timed_out INTEGER NOT NULL DEFAULT 0",
        )?;
        Ok(())
    }

    fn ensure_column(&self, table: &str, column: &str, alter_sql: &str) -> Result<()> {
        let mut stmt = self.conn.prepare(&format!("PRAGMA table_info({table})"))?;
        let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;

        for existing in columns {
            if existing? == column {
                return Ok(());
            }
        }

        self.conn.execute(alter_sql, [])?;
        Ok(())
    }

    pub fn upsert_operator(&self, operator: &Operator) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO operators (
              id, display_name, role, status, created_at_ms, updated_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(id) DO UPDATE SET
              display_name = excluded.display_name,
              role = excluded.role,
              status = excluded.status,
              updated_at_ms = excluded.updated_at_ms
            "#,
            params![
                &operator.id,
                &operator.display_name,
                operator.role.as_str(),
                operator.status.as_str(),
                operator.created_at_ms,
                operator.updated_at_ms,
            ],
        )?;
        Ok(())
    }

    pub fn get_operator(&self, id: &str) -> Result<Option<Operator>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, display_name, role, status, created_at_ms, updated_at_ms
            FROM operators
            WHERE id = ?1
            "#,
        )?;

        let mut rows = stmt.query(params![id])?;
        let Some(row) = rows.next()? else {
            return Ok(None);
        };

        operator_from_row(row).map(Some).map_err(LedgerError::Sql)
    }

    pub fn list_operators(&self) -> Result<Vec<Operator>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, display_name, role, status, created_at_ms, updated_at_ms
            FROM operators
            ORDER BY id ASC
            "#,
        )?;

        let rows = stmt.query_map([], operator_from_row)?;

        let mut operators = Vec::new();
        for row in rows {
            operators.push(row?);
        }
        Ok(operators)
    }

    pub fn insert_session(&self, session: &Session) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO sessions (
              id, goal, provider, target_path, branch, worktree_path, base_commit,
              head_commit, status, created_at_ms, updated_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                &session.id,
                &session.goal,
                &session.provider,
                &session.target_path,
                &session.branch,
                &session.worktree_path,
                &session.base_commit,
                &session.head_commit,
                session.status.as_str(),
                session.created_at_ms,
                session.updated_at_ms,
            ],
        )?;
        Ok(())
    }

    pub fn get_session(&self, id: &str) -> Result<Option<Session>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, goal, provider, target_path, branch, worktree_path, base_commit,
                   head_commit, status, created_at_ms, updated_at_ms
            FROM sessions
            WHERE id = ?1
            "#,
        )?;

        let mut rows = stmt.query(params![id])?;
        let Some(row) = rows.next()? else {
            return Ok(None);
        };

        let status_value: String = row.get(8)?;
        let status = SessionStatus::parse(&status_value).map_err(LedgerError::Domain)?;

        Ok(Some(Session {
            id: row.get(0)?,
            goal: row.get(1)?,
            provider: row.get(2)?,
            target_path: row.get(3)?,
            branch: row.get(4)?,
            worktree_path: row.get(5)?,
            base_commit: row.get(6)?,
            head_commit: row.get(7)?,
            status,
            created_at_ms: row.get(9)?,
            updated_at_ms: row.get(10)?,
        }))
    }

    pub fn update_session_status(
        &self,
        id: &str,
        status: SessionStatus,
        updated_at_ms: i64,
    ) -> Result<()> {
        let rows = self.conn.execute(
            r#"
            UPDATE sessions
            SET status = ?2, updated_at_ms = ?3
            WHERE id = ?1
            "#,
            params![id, status.as_str(), updated_at_ms],
        )?;

        if rows == 0 {
            return Err(LedgerError::Domain(format!(
                "session '{id}' does not exist"
            )));
        }

        Ok(())
    }

    pub fn update_session_completion(
        &self,
        id: &str,
        status: SessionStatus,
        head_commit: Option<&str>,
        updated_at_ms: i64,
    ) -> Result<()> {
        let rows = self.conn.execute(
            r#"
            UPDATE sessions
            SET status = ?2, head_commit = ?3, updated_at_ms = ?4
            WHERE id = ?1
            "#,
            params![id, status.as_str(), head_commit, updated_at_ms],
        )?;

        if rows == 0 {
            return Err(LedgerError::Domain(format!(
                "session '{id}' does not exist"
            )));
        }

        Ok(())
    }

    pub fn list_sessions(&self) -> Result<Vec<Session>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, goal, provider, target_path, branch, worktree_path, base_commit,
                   head_commit, status, created_at_ms, updated_at_ms
            FROM sessions
            ORDER BY created_at_ms ASC, id ASC
            "#,
        )?;

        let rows = stmt.query_map([], |row| {
            let status_value: String = row.get(8)?;
            let status = SessionStatus::parse(&status_value).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    8,
                    rusqlite::types::Type::Text,
                    Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
                )
            })?;

            Ok(Session {
                id: row.get(0)?,
                goal: row.get(1)?,
                provider: row.get(2)?,
                target_path: row.get(3)?,
                branch: row.get(4)?,
                worktree_path: row.get(5)?,
                base_commit: row.get(6)?,
                head_commit: row.get(7)?,
                status,
                created_at_ms: row.get(9)?,
                updated_at_ms: row.get(10)?,
            })
        })?;

        let mut sessions = Vec::new();
        for row in rows {
            sessions.push(row?);
        }
        Ok(sessions)
    }

    pub fn insert_patch_set(
        &self,
        patch_set: &PatchSet,
        changed_files: &[ChangedFile],
    ) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO patch_sets (
              id, session_id, base_commit, head_commit, patch_id, diff_stat, created_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
            params![
                &patch_set.id,
                &patch_set.session_id,
                &patch_set.base_commit,
                &patch_set.head_commit,
                &patch_set.patch_id,
                &patch_set.diff_stat,
                patch_set.created_at_ms,
            ],
        )?;

        for changed_file in changed_files {
            self.conn.execute(
                r#"
                INSERT INTO changed_files (
                  patch_set_id, path, change_type, symbols_json
                )
                VALUES (?1, ?2, ?3, ?4)
                "#,
                params![
                    &patch_set.id,
                    &changed_file.path,
                    &changed_file.change_type,
                    &changed_file.symbols_json,
                ],
            )?;
        }

        Ok(())
    }

    pub fn list_patch_sets(&self, session_id: &str) -> Result<Vec<PatchSet>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, session_id, base_commit, head_commit, patch_id, diff_stat, created_at_ms
            FROM patch_sets
            WHERE session_id = ?1
            ORDER BY created_at_ms ASC, id ASC
            "#,
        )?;

        let rows = stmt.query_map(params![session_id], |row| {
            Ok(PatchSet {
                id: row.get(0)?,
                session_id: row.get(1)?,
                base_commit: row.get(2)?,
                head_commit: row.get(3)?,
                patch_id: row.get(4)?,
                diff_stat: row.get(5)?,
                created_at_ms: row.get(6)?,
            })
        })?;

        let mut patch_sets = Vec::new();
        for row in rows {
            patch_sets.push(row?);
        }
        Ok(patch_sets)
    }

    pub fn list_changed_files(&self, patch_set_id: &str) -> Result<Vec<ChangedFile>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT path, change_type, symbols_json
            FROM changed_files
            WHERE patch_set_id = ?1
            ORDER BY id ASC
            "#,
        )?;

        let rows = stmt.query_map(params![patch_set_id], |row| {
            Ok(ChangedFile {
                path: row.get(0)?,
                change_type: row.get(1)?,
                symbols_json: row.get(2)?,
            })
        })?;

        let mut changed_files = Vec::new();
        for row in rows {
            changed_files.push(row?);
        }
        Ok(changed_files)
    }

    pub fn insert_context_snapshot(&self, snapshot: &ContextSnapshot) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO context_snapshots (
              id, session_id, hash_algorithm, snapshot_hash, created_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                &snapshot.id,
                &snapshot.session_id,
                &snapshot.hash_algorithm,
                &snapshot.snapshot_hash,
                snapshot.created_at_ms,
            ],
        )?;
        Ok(())
    }

    pub fn list_context_snapshots(&self, session_id: &str) -> Result<Vec<ContextSnapshot>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, session_id, hash_algorithm, snapshot_hash, created_at_ms
            FROM context_snapshots
            WHERE session_id = ?1
            ORDER BY created_at_ms ASC, id ASC
            "#,
        )?;

        let rows = stmt.query_map(params![session_id], |row| {
            Ok(ContextSnapshot {
                id: row.get(0)?,
                session_id: row.get(1)?,
                hash_algorithm: row.get(2)?,
                snapshot_hash: row.get(3)?,
                created_at_ms: row.get(4)?,
            })
        })?;

        let mut snapshots = Vec::new();
        for row in rows {
            snapshots.push(row?);
        }
        Ok(snapshots)
    }

    pub fn insert_change_manifest(&self, manifest: &ChangeManifest) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO change_manifests (
              id, session_id, manifest_path, manifest_hash, validation_status, created_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
            params![
                &manifest.id,
                &manifest.session_id,
                &manifest.manifest_path,
                &manifest.manifest_hash,
                &manifest.validation_status,
                manifest.created_at_ms,
            ],
        )?;
        Ok(())
    }

    pub fn list_change_manifests(&self, session_id: &str) -> Result<Vec<ChangeManifest>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, session_id, manifest_path, manifest_hash, validation_status, created_at_ms
            FROM change_manifests
            WHERE session_id = ?1
            ORDER BY created_at_ms ASC, id ASC
            "#,
        )?;

        let rows = stmt.query_map(params![session_id], |row| {
            Ok(ChangeManifest {
                id: row.get(0)?,
                session_id: row.get(1)?,
                manifest_path: row.get(2)?,
                manifest_hash: row.get(3)?,
                validation_status: row.get(4)?,
                created_at_ms: row.get(5)?,
            })
        })?;

        let mut manifests = Vec::new();
        for row in rows {
            manifests.push(row?);
        }
        Ok(manifests)
    }

    pub fn insert_merge_attempt(
        &self,
        attempt: &MergeAttempt,
        created_at_ms: i64,
        updated_at_ms: i64,
    ) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO merge_attempts (
              id, session_id, status, main_before_commit, candidate_commit, apply_strategy,
              verified_tree_id, verified_commit_id, checks_passed, semantic_risk_level,
              created_at_ms, updated_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            "#,
            params![
                &attempt.id,
                &attempt.session_id,
                attempt.status.as_str(),
                &attempt.main_before_commit,
                &attempt.candidate_commit,
                &attempt.apply_strategy,
                &attempt.verified_tree_id,
                &attempt.verified_commit_id,
                if attempt.checks_passed { 1_i64 } else { 0_i64 },
                &attempt.semantic_risk_level,
                created_at_ms,
                updated_at_ms,
            ],
        )?;
        Ok(())
    }

    pub fn update_merge_attempt_result(&self, update: MergeAttemptResultUpdate<'_>) -> Result<()> {
        let rows = self.conn.execute(
            r#"
            UPDATE merge_attempts
            SET status = ?2,
                verified_tree_id = ?3,
                verified_commit_id = ?4,
                checks_passed = ?5,
                semantic_risk_level = ?6,
                updated_at_ms = ?7
            WHERE id = ?1
            "#,
            params![
                update.id,
                update.status.as_str(),
                update.verified_tree_id,
                update.verified_commit_id,
                if update.checks_passed { 1_i64 } else { 0_i64 },
                update.semantic_risk_level,
                update.updated_at_ms,
            ],
        )?;

        if rows == 0 {
            return Err(LedgerError::Domain(format!(
                "merge attempt '{}' does not exist",
                update.id
            )));
        }

        Ok(())
    }

    pub fn update_merge_attempt_semantic_review(
        &self,
        update: MergeAttemptSemanticReviewUpdate<'_>,
    ) -> Result<()> {
        let rows = self.conn.execute(
            r#"
            UPDATE merge_attempts
            SET status = ?2,
                semantic_risk_level = ?3,
                updated_at_ms = ?4
            WHERE id = ?1
            "#,
            params![
                update.id,
                update.status.as_str(),
                update.semantic_risk_level.as_str(),
                update.updated_at_ms,
            ],
        )?;

        if rows == 0 {
            return Err(LedgerError::Domain(format!(
                "merge attempt '{}' does not exist",
                update.id
            )));
        }

        Ok(())
    }

    pub fn update_merge_attempt_status(
        &self,
        id: &str,
        status: MergeAttemptStatus,
        updated_at_ms: i64,
    ) -> Result<()> {
        let rows = self.conn.execute(
            r#"
            UPDATE merge_attempts
            SET status = ?2,
                updated_at_ms = ?3
            WHERE id = ?1
            "#,
            params![id, status.as_str(), updated_at_ms],
        )?;

        if rows == 0 {
            return Err(LedgerError::Domain(format!(
                "merge attempt '{id}' does not exist"
            )));
        }

        Ok(())
    }

    pub fn get_merge_attempt(&self, id: &str) -> Result<Option<MergeAttempt>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, session_id, status, main_before_commit, candidate_commit, apply_strategy,
                   verified_tree_id, verified_commit_id, checks_passed, semantic_risk_level
            FROM merge_attempts
            WHERE id = ?1
            "#,
        )?;

        let mut rows = stmt.query(params![id])?;
        let Some(row) = rows.next()? else {
            return Ok(None);
        };

        merge_attempt_from_row(row)
            .map(Some)
            .map_err(LedgerError::Sql)
    }

    pub fn list_merge_attempts(&self, session_id: &str) -> Result<Vec<MergeAttempt>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, session_id, status, main_before_commit, candidate_commit, apply_strategy,
                   verified_tree_id, verified_commit_id, checks_passed, semantic_risk_level
            FROM merge_attempts
            WHERE session_id = ?1
            ORDER BY created_at_ms ASC, id ASC
            "#,
        )?;

        let rows = stmt.query_map(params![session_id], merge_attempt_from_row)?;

        let mut attempts = Vec::new();
        for row in rows {
            attempts.push(row?);
        }
        Ok(attempts)
    }

    pub fn insert_semantic_review(&self, review: &SemanticReview) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO semantic_reviews (
              id, merge_attempt_id, risk_level, report_path, created_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                &review.id,
                &review.merge_attempt_id,
                review.risk_level.as_str(),
                &review.report_path,
                review.created_at_ms,
            ],
        )?;
        Ok(())
    }

    pub fn list_semantic_reviews(&self, merge_attempt_id: &str) -> Result<Vec<SemanticReview>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, merge_attempt_id, risk_level, report_path, created_at_ms
            FROM semantic_reviews
            WHERE merge_attempt_id = ?1
            ORDER BY created_at_ms ASC, id ASC
            "#,
        )?;

        let rows = stmt.query_map(params![merge_attempt_id], semantic_review_from_row)?;

        let mut reviews = Vec::new();
        for row in rows {
            reviews.push(row?);
        }
        Ok(reviews)
    }

    pub fn insert_check_result(&self, check_result: &CheckResult) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO check_results (
              id, merge_attempt_id, name, command, required, timed_out, result, stdout_artifact, stderr_artifact,
              created_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            "#,
            params![
                &check_result.id,
                &check_result.merge_attempt_id,
                &check_result.name,
                &check_result.command,
                if check_result.required { 1_i64 } else { 0_i64 },
                if check_result.timed_out { 1_i64 } else { 0_i64 },
                check_result.result.as_str(),
                &check_result.stdout_artifact,
                &check_result.stderr_artifact,
                check_result.created_at_ms,
            ],
        )?;
        Ok(())
    }

    pub fn list_check_results(&self, merge_attempt_id: &str) -> Result<Vec<CheckResult>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, merge_attempt_id, name, command, result, stdout_artifact, stderr_artifact,
                   created_at_ms, required, timed_out
            FROM check_results
            WHERE merge_attempt_id = ?1
            ORDER BY created_at_ms ASC, id ASC
            "#,
        )?;

        let rows = stmt.query_map(params![merge_attempt_id], |row| {
            let result_value: String = row.get(4)?;
            let required: i64 = row.get(8)?;
            let timed_out: i64 = row.get(9)?;
            let result = CheckResultStatus::parse(&result_value).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    4,
                    Type::Text,
                    Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
                )
            })?;

            Ok(CheckResult {
                id: row.get(0)?,
                merge_attempt_id: row.get(1)?,
                name: row.get(2)?,
                command: row.get(3)?,
                required: required != 0,
                timed_out: timed_out != 0,
                result,
                stdout_artifact: row.get(5)?,
                stderr_artifact: row.get(6)?,
                created_at_ms: row.get(7)?,
            })
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    pub fn insert_approval(&self, approval: &Approval) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO approvals (
              id, merge_attempt_id, approved_by, approved_verified_tree_id,
              approved_verified_commit_id, decision, created_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5, 'approved', ?6)
            "#,
            params![
                &approval.id,
                &approval.merge_attempt_id,
                &approval.approved_by,
                &approval.approved_verified_tree_id,
                &approval.approved_verified_commit_id,
                approval.created_at_ms,
            ],
        )?;
        Ok(())
    }

    pub fn list_approvals(&self, merge_attempt_id: &str) -> Result<Vec<Approval>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, merge_attempt_id, approved_by, approved_verified_tree_id,
                   approved_verified_commit_id, created_at_ms
            FROM approvals
            WHERE merge_attempt_id = ?1
              AND decision = 'approved'
            ORDER BY created_at_ms ASC, id ASC
            "#,
        )?;

        let rows = stmt.query_map(params![merge_attempt_id], |row| {
            Ok(Approval {
                id: row.get(0)?,
                merge_attempt_id: row.get(1)?,
                approved_by: row.get(2)?,
                approved_verified_tree_id: row.get(3)?,
                approved_verified_commit_id: row.get(4)?,
                created_at_ms: row.get(5)?,
            })
        })?;

        let mut approvals = Vec::new();
        for row in rows {
            approvals.push(row?);
        }
        Ok(approvals)
    }

    pub fn try_acquire_queue_lock(&self, lock: &QueueLock) -> Result<bool> {
        let rows = self.conn.execute(
            r#"
            INSERT OR IGNORE INTO queue_locks (
              name, holder_id, operation, session_id, acquired_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                &lock.name,
                &lock.holder_id,
                &lock.operation,
                &lock.session_id,
                lock.acquired_at_ms,
            ],
        )?;

        Ok(rows == 1)
    }

    pub fn get_queue_lock(&self, name: &str) -> Result<Option<QueueLock>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT name, holder_id, operation, session_id, acquired_at_ms
            FROM queue_locks
            WHERE name = ?1
            "#,
        )?;

        let mut rows = stmt.query(params![name])?;
        let Some(row) = rows.next()? else {
            return Ok(None);
        };

        Ok(Some(QueueLock {
            name: row.get(0)?,
            holder_id: row.get(1)?,
            operation: row.get(2)?,
            session_id: row.get(3)?,
            acquired_at_ms: row.get(4)?,
        }))
    }

    pub fn release_queue_lock(&self, name: &str, holder_id: &str) -> Result<bool> {
        let rows = self.conn.execute(
            r#"
            DELETE FROM queue_locks
            WHERE name = ?1
              AND holder_id = ?2
            "#,
            params![name, holder_id],
        )?;

        Ok(rows == 1)
    }

    pub fn append_event(&self, event: &NewEvent) -> Result<i64> {
        self.conn.execute(
            r#"
            INSERT INTO event_log (
              event_name, subject_type, subject_id, data_json, created_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                event.name.as_str(),
                &event.subject_type,
                &event.subject_id,
                &event.data_json,
                event.created_at_ms,
            ],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    pub fn list_events(&self) -> Result<Vec<EventRecord>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, event_name, subject_type, subject_id, data_json, created_at_ms
            FROM event_log
            ORDER BY id ASC
            "#,
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(EventRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                subject_type: row.get(2)?,
                subject_id: row.get(3)?,
                data_json: row.get(4)?,
                created_at_ms: row.get(5)?,
            })
        })?;

        let mut events = Vec::new();
        for row in rows {
            events.push(row?);
        }
        Ok(events)
    }

    pub fn event_count(&self) -> Result<i64> {
        let count = self
            .conn
            .query_row("SELECT COUNT(*) FROM event_log", [], |row| row.get(0))?;
        Ok(count)
    }

    pub fn recent_events(&self, limit: usize) -> Result<Vec<EventRecord>> {
        if limit == 0 {
            return Ok(Vec::new());
        }

        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, event_name, subject_type, subject_id, data_json, created_at_ms
            FROM event_log
            ORDER BY id DESC
            LIMIT ?1
            "#,
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(EventRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                subject_type: row.get(2)?,
                subject_id: row.get(3)?,
                data_json: row.get(4)?,
                created_at_ms: row.get(5)?,
            })
        })?;

        let mut events = Vec::new();
        for row in rows {
            events.push(row?);
        }
        Ok(events)
    }

    pub fn record_repo_initialized(&self, repo_root: &Path) -> Result<i64> {
        let event = NewEvent::new(EventName::RepoInitialized)
            .with_subject("repo", repo_root.display().to_string());
        self.append_event(&event)
    }
}

fn operator_from_row(row: &Row<'_>) -> rusqlite::Result<Operator> {
    let role_value: String = row.get(2)?;
    let role = OperatorRole::parse(&role_value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            2,
            Type::Text,
            Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
        )
    })?;

    let status_value: String = row.get(3)?;
    let status = OperatorStatus::parse(&status_value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            3,
            Type::Text,
            Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
        )
    })?;

    Ok(Operator {
        id: row.get(0)?,
        display_name: row.get(1)?,
        role,
        status,
        created_at_ms: row.get(4)?,
        updated_at_ms: row.get(5)?,
    })
}

fn merge_attempt_from_row(row: &Row<'_>) -> rusqlite::Result<MergeAttempt> {
    let status_value: String = row.get(2)?;
    let status = MergeAttemptStatus::parse(&status_value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            2,
            Type::Text,
            Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
        )
    })?;
    let checks_passed: i64 = row.get(8)?;

    Ok(MergeAttempt {
        id: row.get(0)?,
        session_id: row.get(1)?,
        status,
        main_before_commit: row.get(3)?,
        candidate_commit: row.get(4)?,
        apply_strategy: row.get(5)?,
        verified_tree_id: row.get(6)?,
        verified_commit_id: row.get(7)?,
        checks_passed: checks_passed != 0,
        semantic_risk_level: row.get(9)?,
    })
}

fn semantic_review_from_row(row: &Row<'_>) -> rusqlite::Result<SemanticReview> {
    let risk_value: String = row.get(2)?;
    let risk_level = SemanticRiskLevel::parse(&risk_value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            2,
            Type::Text,
            Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
        )
    })?;

    Ok(SemanticReview {
        id: row.get(0)?,
        merge_attempt_id: row.get(1)?,
        risk_level,
        report_path: row.get(3)?,
        created_at_ms: row.get(4)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use aich_core::clock::now_millis;
    use std::env;
    use std::process;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

    fn unique_db_path() -> std::path::PathBuf {
        let counter = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        env::temp_dir().join(format!(
            "aich-ledger-test-{}-{}-{}.db",
            process::id(),
            now_millis(),
            counter
        ))
    }

    fn table_columns(ledger: &Ledger, table: &str) -> Vec<String> {
        let mut stmt = ledger
            .conn
            .prepare(&format!("PRAGMA table_info({table})"))
            .expect("table info");
        stmt.query_map([], |row| row.get::<_, String>(1))
            .expect("query columns")
            .map(|column| column.expect("column"))
            .collect()
    }

    #[test]
    fn initializes_schema_and_round_trips_session_and_event() {
        let db_path = unique_db_path();
        let ledger = Ledger::open(&db_path).expect("open ledger");
        let now = now_millis();
        let session = Session::new(
            "session-1",
            "test goal",
            "codex",
            "aich/session-1/test",
            ".aichestra/worktrees/session-1",
            "base-commit",
            now,
        );

        ledger.insert_session(&session).expect("insert session");
        let loaded = ledger
            .get_session("session-1")
            .expect("get session")
            .expect("session exists");
        assert_eq!(loaded, session);

        ledger
            .update_session_status("session-1", SessionStatus::Running, now + 1)
            .expect("update status");
        let updated = ledger
            .get_session("session-1")
            .expect("get updated session")
            .expect("session exists");
        assert_eq!(updated.status, SessionStatus::Running);

        let sessions = ledger.list_sessions().expect("list sessions");
        assert_eq!(sessions.len(), 1);

        let event_id = ledger
            .append_event(
                &NewEvent::new(EventName::SessionCreated).with_subject("session", "session-1"),
            )
            .expect("append event");
        assert_eq!(event_id, 1);

        let events = ledger.list_events().expect("list events");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].name, "session.created");
        assert_eq!(ledger.event_count().expect("event count"), 1);
        assert_eq!(
            ledger.recent_events(1).expect("recent events")[0].name,
            "session.created"
        );

        drop(ledger);
        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn migrates_existing_check_results_metadata_columns() {
        let db_path = unique_db_path();
        let conn = Connection::open(&db_path).expect("open raw db");
        conn.execute_batch(
            r#"
            CREATE TABLE check_results (
              id TEXT PRIMARY KEY,
              merge_attempt_id TEXT NOT NULL,
              name TEXT NOT NULL,
              command TEXT NOT NULL,
              result TEXT NOT NULL,
              stdout_artifact TEXT,
              stderr_artifact TEXT,
              created_at_ms INTEGER NOT NULL
            );
            "#,
        )
        .expect("create old check_results table");
        drop(conn);

        let ledger = Ledger::open(&db_path).expect("open ledger");
        let columns = table_columns(&ledger, "check_results");

        assert!(columns.contains(&"required".to_string()));
        assert!(columns.contains(&"timed_out".to_string()));

        drop(ledger);
        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn round_trips_operator() {
        let db_path = unique_db_path();
        let ledger = Ledger::open(&db_path).expect("open ledger");
        let now = now_millis();
        let mut operator = Operator::new("alice", "Alice Reviewer", OperatorRole::Reviewer, now)
            .expect("operator");

        ledger.upsert_operator(&operator).expect("upsert operator");
        let loaded = ledger
            .get_operator("alice")
            .expect("get operator")
            .expect("operator exists");
        assert_eq!(loaded, operator);

        operator.role = OperatorRole::Maintainer;
        operator.updated_at_ms = now + 1;
        ledger.upsert_operator(&operator).expect("update operator");

        let operators = ledger.list_operators().expect("list operators");
        assert_eq!(operators.len(), 1);
        assert_eq!(operators[0].role, OperatorRole::Maintainer);

        drop(ledger);
        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn round_trips_completion_records() {
        let db_path = unique_db_path();
        let ledger = Ledger::open(&db_path).expect("open ledger");
        let now = now_millis();
        let session = Session::new(
            "session-2",
            "finish work",
            "codex",
            "aich/session-2/test",
            ".aichestra/worktrees/session-2",
            "base-commit",
            now,
        );
        ledger.insert_session(&session).expect("insert session");

        ledger
            .update_session_completion(
                "session-2",
                SessionStatus::Enqueued,
                Some("head-commit"),
                now + 1,
            )
            .expect("complete session");
        let completed = ledger
            .get_session("session-2")
            .expect("get session")
            .expect("session exists");
        assert_eq!(completed.status, SessionStatus::Enqueued);
        assert_eq!(completed.head_commit.as_deref(), Some("head-commit"));

        let patch_set = PatchSet {
            id: "patch-1".to_string(),
            session_id: "session-2".to_string(),
            base_commit: "base-commit".to_string(),
            head_commit: Some("head-commit".to_string()),
            patch_id: Some("head-commit".to_string()),
            diff_stat: Some("1 file changed".to_string()),
            created_at_ms: now + 2,
        };
        let changed_files = vec![ChangedFile::new("src/lib.rs", "modified")];
        ledger
            .insert_patch_set(&patch_set, &changed_files)
            .expect("insert patch set");

        let snapshot = ContextSnapshot {
            id: "snapshot-1".to_string(),
            session_id: Some("session-2".to_string()),
            hash_algorithm: "sha256".to_string(),
            snapshot_hash: "hash".to_string(),
            created_at_ms: now + 3,
        };
        ledger
            .insert_context_snapshot(&snapshot)
            .expect("insert snapshot");

        let manifest = ChangeManifest {
            id: "manifest-1".to_string(),
            session_id: "session-2".to_string(),
            manifest_path: ".aichestra/artifacts/sessions/session-2/change-manifest.yaml"
                .to_string(),
            manifest_hash: Some("manifest-hash".to_string()),
            validation_status: "generated_from_diff".to_string(),
            created_at_ms: now + 4,
        };
        ledger
            .insert_change_manifest(&manifest)
            .expect("insert manifest");

        assert_eq!(
            ledger
                .list_patch_sets("session-2")
                .expect("list patch sets"),
            vec![patch_set]
        );
        assert_eq!(
            ledger
                .list_changed_files("patch-1")
                .expect("list changed files"),
            changed_files
        );
        assert_eq!(
            ledger
                .list_context_snapshots("session-2")
                .expect("list snapshots"),
            vec![snapshot]
        );
        assert_eq!(
            ledger
                .list_change_manifests("session-2")
                .expect("list manifests"),
            vec![manifest]
        );

        let mut attempt = MergeAttempt {
            id: "merge-1".to_string(),
            session_id: "session-2".to_string(),
            status: MergeAttemptStatus::PreflightRunning,
            main_before_commit: "main-before".to_string(),
            candidate_commit: "head-commit".to_string(),
            apply_strategy: "merge_no_ff_commit".to_string(),
            verified_tree_id: None,
            verified_commit_id: None,
            checks_passed: false,
            semantic_risk_level: None,
        };
        ledger
            .insert_merge_attempt(&attempt, now + 5, now + 5)
            .expect("insert merge attempt");
        ledger
            .update_merge_attempt_result(MergeAttemptResultUpdate {
                id: "merge-1",
                status: MergeAttemptStatus::Verified,
                verified_tree_id: Some("tree-1"),
                verified_commit_id: Some("verified-commit"),
                checks_passed: true,
                semantic_risk_level: None,
                updated_at_ms: now + 6,
            })
            .expect("update merge attempt");
        attempt.status = MergeAttemptStatus::Verified;
        attempt.verified_tree_id = Some("tree-1".to_string());
        attempt.verified_commit_id = Some("verified-commit".to_string());
        attempt.checks_passed = true;

        let check_result = CheckResult {
            id: "check-1".to_string(),
            merge_attempt_id: "merge-1".to_string(),
            name: "test".to_string(),
            command: "cargo test --all".to_string(),
            required: true,
            timed_out: false,
            result: CheckResultStatus::Passed,
            stdout_artifact: Some(".aichestra/artifacts/stdout".to_string()),
            stderr_artifact: Some(".aichestra/artifacts/stderr".to_string()),
            created_at_ms: now + 7,
        };
        ledger
            .insert_check_result(&check_result)
            .expect("insert check result");
        let semantic_review = SemanticReview {
            id: "review-1".to_string(),
            merge_attempt_id: "merge-1".to_string(),
            risk_level: SemanticRiskLevel::Medium,
            report_path: Some(".aichestra/artifacts/review.yaml".to_string()),
            created_at_ms: now + 8,
        };
        ledger
            .insert_semantic_review(&semantic_review)
            .expect("insert semantic review");
        ledger
            .update_merge_attempt_semantic_review(MergeAttemptSemanticReviewUpdate {
                id: "merge-1",
                status: MergeAttemptStatus::Verified,
                semantic_risk_level: SemanticRiskLevel::Medium,
                updated_at_ms: now + 9,
            })
            .expect("update semantic risk");
        attempt.semantic_risk_level = Some("medium".to_string());

        assert_eq!(
            ledger
                .get_merge_attempt("merge-1")
                .expect("get merge attempt"),
            Some(attempt.clone())
        );
        assert_eq!(
            ledger
                .list_merge_attempts("session-2")
                .expect("list merge attempts"),
            vec![attempt.clone()]
        );
        assert_eq!(
            ledger
                .list_check_results("merge-1")
                .expect("list check results"),
            vec![check_result]
        );
        assert_eq!(
            ledger
                .list_semantic_reviews("merge-1")
                .expect("list semantic reviews"),
            vec![semantic_review]
        );

        let approval = Approval {
            id: "approval-1".to_string(),
            merge_attempt_id: "merge-1".to_string(),
            approved_by: "local-user".to_string(),
            approved_verified_tree_id: "tree-1".to_string(),
            approved_verified_commit_id: "verified-commit".to_string(),
            created_at_ms: now + 10,
        };
        ledger.insert_approval(&approval).expect("insert approval");
        assert_eq!(
            ledger.list_approvals("merge-1").expect("list approvals"),
            vec![approval]
        );

        ledger
            .update_merge_attempt_status("merge-1", MergeAttemptStatus::Applied, now + 11)
            .expect("mark applied");
        attempt.status = MergeAttemptStatus::Applied;
        assert_eq!(
            ledger
                .get_merge_attempt("merge-1")
                .expect("get applied attempt"),
            Some(attempt)
        );

        let lock = QueueLock {
            name: "merge-queue".to_string(),
            holder_id: "holder-1".to_string(),
            operation: "preflight".to_string(),
            session_id: Some("session-2".to_string()),
            acquired_at_ms: now + 12,
        };
        assert!(ledger
            .try_acquire_queue_lock(&lock)
            .expect("acquire queue lock"));
        assert!(!ledger
            .try_acquire_queue_lock(&QueueLock {
                holder_id: "holder-2".to_string(),
                ..lock.clone()
            })
            .expect("second queue lock blocked"));
        assert_eq!(
            ledger
                .get_queue_lock("merge-queue")
                .expect("get queue lock"),
            Some(lock.clone())
        );
        assert!(ledger
            .release_queue_lock("merge-queue", "holder-1")
            .expect("release queue lock"));
        assert_eq!(
            ledger
                .get_queue_lock("merge-queue")
                .expect("queue lock released"),
            None
        );

        drop(ledger);
        let _ = fs::remove_file(db_path);
    }
}

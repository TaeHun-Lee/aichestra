pub mod schema;

use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs;
use std::path::Path;

use aich_core::{EventName, NewEvent, Session, SessionStatus};
use rusqlite::{params, Connection};

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
        Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;
    use aich_core::clock::now_millis;
    use std::env;
    use std::process;

    fn unique_db_path() -> std::path::PathBuf {
        env::temp_dir().join(format!(
            "aich-ledger-test-{}-{}.db",
            process::id(),
            now_millis()
        ))
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
}

use std::io::Write;

use aich_ledger::Ledger;

use crate::cleanup_state::cleaned_session_ids;
use crate::formatting::short_hash;
use crate::options::StatusOptions;
use crate::{ledger_path, CliError};
pub(crate) fn render_status<W: Write>(
    options: &StatusOptions,
    out: &mut W,
) -> Result<(), CliError> {
    let db_path = ledger_path(&options.repo_root, &options.db_path);
    if !db_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra ledger not found at {}; run `aich init` first",
            db_path.display()
        )));
    }

    let ledger = Ledger::open(&db_path)?;
    let operators = ledger.list_operators()?;
    let sessions = ledger.list_sessions()?;
    let cleaned_sessions = cleaned_session_ids(&ledger)?;
    let event_count = ledger.event_count()?;
    let recent_events = ledger.recent_events(options.recent_events_limit)?;

    writeln!(out, "Aichestra status")?;
    writeln!(out, "Repo: {}", options.repo_root.display())?;
    writeln!(out, "Ledger: {}", db_path.display())?;
    writeln!(out, "Operators: {}", operators.len())?;
    writeln!(out, "Sessions: {}", sessions.len())?;

    if sessions.is_empty() {
        writeln!(out, "No sessions recorded.")?;
    } else {
        for session in sessions {
            writeln!(out, "- {} [{}]", session.id, session.status.as_str())?;
            writeln!(out, "  provider: {}", session.provider)?;
            writeln!(out, "  branch: {}", session.branch)?;
            writeln!(out, "  worktree: {}", session.worktree_path)?;
            if cleaned_sessions.contains(&session.id) {
                writeln!(out, "  cleanup: cleaned")?;
            }
            writeln!(
                out,
                "  target: {}",
                session.target_path.as_deref().unwrap_or("-")
            )?;
            writeln!(out, "  base: {}", short_hash(&session.base_commit))?;
            if let Some(head_commit) = session.head_commit.as_deref() {
                writeln!(out, "  head: {}", short_hash(head_commit))?;
            }
        }
    }

    writeln!(out, "Events: {event_count}")?;
    if !recent_events.is_empty() {
        writeln!(out, "Recent events:")?;
        for event in recent_events {
            let subject = match (event.subject_type.as_deref(), event.subject_id.as_deref()) {
                (Some(subject_type), Some(subject_id)) => {
                    format!(" {subject_type}:{subject_id}")
                }
                (Some(subject_type), None) => format!(" {subject_type}"),
                _ => String::new(),
            };
            writeln!(out, "- #{} {}{}", event.id, event.name, subject)?;
        }
    }

    Ok(())
}

use std::collections::HashSet;

use aich_core::EventName;
use aich_ledger::Ledger;

use crate::CliError;

pub(crate) fn cleaned_session_ids(ledger: &Ledger) -> Result<HashSet<String>, CliError> {
    let cleaned_ids = ledger
        .list_events()?
        .into_iter()
        .filter(|event| {
            event.name == EventName::SessionCleaned.as_str()
                && event.subject_type.as_deref() == Some("session")
        })
        .filter_map(|event| event.subject_id)
        .collect();
    Ok(cleaned_ids)
}

pub(crate) fn session_is_cleaned(ledger: &Ledger, session_id: &str) -> Result<bool, CliError> {
    Ok(cleaned_session_ids(ledger)?.contains(session_id))
}

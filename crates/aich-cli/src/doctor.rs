use std::io::Write;
use std::path::{Path, PathBuf};

use aich_core::clock::now_millis;
use aich_core::MergeAttemptStatus;
use aich_ledger::Ledger;

use crate::options::DoctorOptions;
use crate::queue::{format_duration_ms, is_queue_lock_stale, queue_entries, queue_lock_age_ms};
use crate::{ledger_path, CliError, DEFAULT_OPERATOR_ID, MERGE_QUEUE_LOCK_NAME};
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum DoctorSeverity {
    Ok,
    Warning,
    Error,
}

impl DoctorSeverity {
    fn as_str(self) -> &'static str {
        match self {
            Self::Ok => "ok",
            Self::Warning => "warning",
            Self::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct DoctorCheck {
    severity: DoctorSeverity,
    name: String,
    detail: String,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct DoctorRunResult {
    repo_root: PathBuf,
    db_path: PathBuf,
    checks: Vec<DoctorCheck>,
}

impl DoctorRunResult {
    pub(crate) fn warning_count(&self) -> usize {
        self.checks
            .iter()
            .filter(|check| check.severity == DoctorSeverity::Warning)
            .count()
    }

    pub(crate) fn error_count(&self) -> usize {
        self.checks
            .iter()
            .filter(|check| check.severity == DoctorSeverity::Error)
            .count()
    }

    pub(crate) fn result_label(&self) -> &'static str {
        if self.error_count() > 0 {
            "error"
        } else if self.warning_count() > 0 {
            "warning"
        } else {
            "ok"
        }
    }
}

pub(crate) fn run_doctor(options: &DoctorOptions) -> Result<DoctorRunResult, CliError> {
    let db_path = ledger_path(&options.repo_root, &options.db_path);
    let aichestra_dir = options.repo_root.join(".aichestra");
    let mut checks = Vec::new();

    add_doctor_path_check(
        &mut checks,
        "config",
        &aichestra_dir.join("config.yaml"),
        "file",
    );
    add_doctor_path_check(
        &mut checks,
        "artifacts",
        &aichestra_dir.join("artifacts"),
        "dir",
    );
    add_doctor_path_check(
        &mut checks,
        "sandboxes",
        &aichestra_dir.join("sandboxes"),
        "dir",
    );
    add_doctor_path_check(
        &mut checks,
        "worktrees",
        &aichestra_dir.join("worktrees"),
        "dir",
    );

    if !db_path.is_file() {
        add_doctor_check(
            &mut checks,
            DoctorSeverity::Error,
            "ledger",
            format!("missing SQLite ledger at {}", db_path.display()),
        );
        return Ok(DoctorRunResult {
            repo_root: options.repo_root.clone(),
            db_path,
            checks,
        });
    }

    let ledger = match Ledger::open(&db_path) {
        Ok(ledger) => {
            add_doctor_check(
                &mut checks,
                DoctorSeverity::Ok,
                "ledger",
                format!("opened {}", db_path.display()),
            );
            ledger
        }
        Err(error) => {
            add_doctor_check(
                &mut checks,
                DoctorSeverity::Error,
                "ledger",
                format!("failed to open {}: {error}", db_path.display()),
            );
            return Ok(DoctorRunResult {
                repo_root: options.repo_root.clone(),
                db_path,
                checks,
            });
        }
    };

    match ledger.get_operator(DEFAULT_OPERATOR_ID) {
        Ok(Some(operator)) if operator.status.as_str() == "active" => add_doctor_check(
            &mut checks,
            DoctorSeverity::Ok,
            "operator",
            format!("default operator {DEFAULT_OPERATOR_ID} is active"),
        ),
        Ok(Some(operator)) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Warning,
            "operator",
            format!(
                "default operator {DEFAULT_OPERATOR_ID} is {}",
                operator.status.as_str()
            ),
        ),
        Ok(None) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Error,
            "operator",
            format!("default operator {DEFAULT_OPERATOR_ID} is missing"),
        ),
        Err(error) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Error,
            "operator",
            format!("failed to read operators: {error}"),
        ),
    }

    match queue_entries(&ledger) {
        Ok(entries) => {
            add_doctor_check(
                &mut checks,
                DoctorSeverity::Ok,
                "queue",
                format!("{} candidate(s) need queue attention", entries.len()),
            );
            for entry in entries.iter().filter(|entry| {
                entry
                    .latest_attempt
                    .as_ref()
                    .map(|attempt| attempt.status == MergeAttemptStatus::Applying)
                    .unwrap_or(false)
            }) {
                let attempt_id = entry
                    .latest_attempt
                    .as_ref()
                    .map(|attempt| attempt.id.as_str())
                    .unwrap_or("-");
                add_doctor_check(
                    &mut checks,
                    DoctorSeverity::Warning,
                    "apply recovery",
                    format!(
                        "session {} merge attempt {} is applying; run `aich apply {}` to retry or finalize recovery. If a stale queue lock remains, run `aich queue unlock --force --reason \"stale apply recovery\"` first.",
                        entry.session.id, attempt_id, entry.session.id
                    ),
                );
            }
        }
        Err(error) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Error,
            "queue",
            format!("failed to read queue entries: {error}"),
        ),
    }

    match ledger.get_queue_lock(MERGE_QUEUE_LOCK_NAME) {
        Ok(Some(lock)) => {
            let now = now_millis();
            let age_ms = queue_lock_age_ms(&lock, now);
            let stale = is_queue_lock_stale(&lock, now);
            add_doctor_check(
                &mut checks,
                if stale {
                    DoctorSeverity::Warning
                } else {
                    DoctorSeverity::Ok
                },
                "queue lock",
                format!(
                    "{} held by {} for {} on session {}",
                    if stale { "stale" } else { "active" },
                    lock.holder_id,
                    lock.operation,
                    lock.session_id.as_deref().unwrap_or("-")
                ),
            );
            add_doctor_check(
                &mut checks,
                if stale {
                    DoctorSeverity::Warning
                } else {
                    DoctorSeverity::Ok
                },
                "queue lock age",
                format_duration_ms(age_ms),
            );
        }
        Ok(None) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Ok,
            "queue lock",
            "free".to_string(),
        ),
        Err(error) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Error,
            "queue lock",
            format!("failed to read queue lock: {error}"),
        ),
    }

    Ok(DoctorRunResult {
        repo_root: options.repo_root.clone(),
        db_path,
        checks,
    })
}

pub(crate) fn render_doctor<W: Write>(
    result: &DoctorRunResult,
    out: &mut W,
) -> Result<(), CliError> {
    writeln!(out, "Aichestra doctor")?;
    writeln!(out, "Repo: {}", result.repo_root.display())?;
    writeln!(out, "Ledger: {}", result.db_path.display())?;
    for check in &result.checks {
        writeln!(
            out,
            "[{}] {}: {}",
            check.severity.as_str(),
            check.name,
            check.detail
        )?;
    }
    writeln!(
        out,
        "Summary: warnings={} errors={}",
        result.warning_count(),
        result.error_count()
    )?;
    writeln!(out, "Result: {}", result.result_label())?;
    Ok(())
}

fn add_doctor_path_check(checks: &mut Vec<DoctorCheck>, name: &str, path: &Path, kind: &str) {
    let ok = match kind {
        "dir" => path.is_dir(),
        "file" => path.is_file(),
        _ => path.exists(),
    };
    if ok {
        add_doctor_check(
            checks,
            DoctorSeverity::Ok,
            name,
            format!("found {}", path.display()),
        );
    } else {
        add_doctor_check(
            checks,
            DoctorSeverity::Error,
            name,
            format!("missing {kind} at {}", path.display()),
        );
    }
}

fn add_doctor_check(
    checks: &mut Vec<DoctorCheck>,
    severity: DoctorSeverity,
    name: impl Into<String>,
    detail: impl Into<String>,
) {
    checks.push(DoctorCheck {
        severity,
        name: name.into(),
        detail: detail.into(),
    });
}

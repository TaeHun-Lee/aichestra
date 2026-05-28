use std::path::{Path, PathBuf};

use aich_core::OperatorRole;

use crate::{usage_text, CliError};

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct InitOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct StatusOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) recent_events_limit: usize,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct QueueOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct QueueUnlockOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) force: bool,
    pub(crate) reason: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct DoctorOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct SessionStartOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) goal: String,
    pub(crate) provider: String,
    pub(crate) target_path: Option<String>,
    pub(crate) operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct SessionCompleteOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct SessionRunOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct SessionReworkOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) review_id: String,
    pub(crate) operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct SessionReopenOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct SessionAbandonOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct SessionCleanupOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct SessionPruneOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) applied: bool,
    pub(crate) inactive: bool,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct PreflightOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct ReviewOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct ManifestShowOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) include_content: bool,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct ManifestEditOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) operator_id: Option<String>,
    pub(crate) set_intent_summary: Option<String>,
    pub(crate) set_risk_level: Option<String>,
    pub(crate) add_risks: Vec<String>,
    pub(crate) add_tests: Vec<String>,
    pub(crate) content_file: Option<PathBuf>,
}

impl ManifestEditOptions {
    pub(crate) fn has_edit(&self) -> bool {
        self.set_intent_summary.is_some()
            || self.set_risk_level.is_some()
            || !self.add_risks.is_empty()
            || !self.add_tests.is_empty()
            || self.content_file.is_some()
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct ApproveOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) operator_id: Option<String>,
    pub(crate) accept_current: bool,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct RejectOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) operator_id: Option<String>,
    pub(crate) reason: String,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct ApplyOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) session_id: String,
    pub(crate) operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct AuthWhoamiOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct OperatorAddOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
    pub(crate) id: String,
    pub(crate) display_name: Option<String>,
    pub(crate) role: OperatorRole,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct OperatorListOptions {
    pub(crate) repo_root: PathBuf,
    pub(crate) db_path: Option<PathBuf>,
}

pub(crate) fn normalize_args<I, S>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: Into<String>,
{
    let mut args: Vec<String> = args.into_iter().map(Into::into).collect();
    if args
        .first()
        .map(|arg| arg.ends_with("aich") || arg.ends_with("aich.exe"))
        .unwrap_or(false)
    {
        args.remove(0);
    }
    args
}

pub(crate) fn parse_init_options(args: &[String], cwd: &Path) -> Result<InitOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown init option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(InitOptions { repo_root, db_path })
}

pub(crate) fn parse_status_options(args: &[String], cwd: &Path) -> Result<StatusOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut recent_events_limit = 5;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--recent-events" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage(
                        "--recent-events requires a number".to_string(),
                    ));
                };
                recent_events_limit = value.parse::<usize>().map_err(|_| {
                    CliError::Usage("--recent-events requires a non-negative number".to_string())
                })?;
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown status option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(StatusOptions {
        repo_root,
        db_path,
        recent_events_limit,
    })
}

pub(crate) fn parse_doctor_options(args: &[String], cwd: &Path) -> Result<DoctorOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown doctor option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(DoctorOptions { repo_root, db_path })
}

pub(crate) fn parse_queue_options(args: &[String], cwd: &Path) -> Result<QueueOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown queue option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(QueueOptions { repo_root, db_path })
}

pub(crate) fn parse_queue_unlock_options(
    args: &[String],
    cwd: &Path,
) -> Result<QueueUnlockOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut force = false;
    let mut reason = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--reason" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--reason requires text".to_string()));
                };
                reason = Some(value.clone());
            }
            "--force" => {
                force = true;
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown queue unlock option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    if !force {
        return Err(CliError::Usage(
            "queue unlock requires --force because it can release an active merge queue lock"
                .to_string(),
        ));
    }

    Ok(QueueUnlockOptions {
        repo_root,
        db_path,
        force,
        reason,
    })
}

pub(crate) fn parse_session_start_options(
    args: &[String],
    cwd: &Path,
) -> Result<SessionStartOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut goal = None;
    let mut provider = "codex".to_string();
    let mut target_path = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--goal" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--goal requires text".to_string()));
                };
                goal = Some(value.clone());
            }
            "--provider" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage(
                        "--provider requires a provider".to_string(),
                    ));
                };
                provider = value.clone();
            }
            "--target" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--target requires a path".to_string()));
                };
                target_path = Some(value.clone());
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown session start option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    let Some(goal) = goal.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage("session start requires --goal".to_string()));
    };

    Ok(SessionStartOptions {
        repo_root,
        db_path,
        goal,
        provider,
        target_path,
        operator_id,
    })
}

pub(crate) fn parse_session_complete_options(
    args: &[String],
    cwd: &Path,
) -> Result<SessionCompleteOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown session complete option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "session complete accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "session complete requires <session-id>".to_string(),
        ));
    };

    Ok(SessionCompleteOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

pub(crate) fn parse_session_run_options(
    args: &[String],
    cwd: &Path,
) -> Result<SessionRunOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if !value.starts_with('-') && session_id.is_none() => {
                session_id = Some(value.to_string());
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown session run option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id else {
        return Err(CliError::Usage(
            "session run requires <session-id>".to_string(),
        ));
    };

    Ok(SessionRunOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

pub(crate) fn parse_session_rework_options(
    args: &[String],
    cwd: &Path,
) -> Result<SessionReworkOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut review_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "--review" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage(
                        "--review requires a semantic review id".to_string(),
                    ));
                };
                review_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if !value.starts_with('-') && session_id.is_none() => {
                session_id = Some(value.to_string());
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown session rework option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "session rework requires <session-id>".to_string(),
        ));
    };
    let Some(review_id) = review_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "session rework requires --review <semantic-review-id>".to_string(),
        ));
    };

    Ok(SessionReworkOptions {
        repo_root,
        db_path,
        session_id,
        review_id,
        operator_id,
    })
}

pub(crate) fn parse_session_reopen_options(
    args: &[String],
    cwd: &Path,
) -> Result<SessionReopenOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown session reopen option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "session reopen accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "session reopen requires <session-id>".to_string(),
        ));
    };

    Ok(SessionReopenOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

pub(crate) fn parse_session_abandon_options(
    args: &[String],
    cwd: &Path,
) -> Result<SessionAbandonOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown session abandon option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "session abandon accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "session abandon requires <session-id>".to_string(),
        ));
    };

    Ok(SessionAbandonOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

pub(crate) fn parse_session_cleanup_options(
    args: &[String],
    cwd: &Path,
) -> Result<SessionCleanupOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown session cleanup option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "session cleanup accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "session cleanup requires <session-id>".to_string(),
        ));
    };

    Ok(SessionCleanupOptions {
        repo_root,
        db_path,
        session_id,
    })
}

pub(crate) fn parse_session_prune_options(
    args: &[String],
    cwd: &Path,
) -> Result<SessionPruneOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut applied = false;
    let mut inactive = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--applied" => {
                applied = true;
            }
            "--inactive" => {
                inactive = true;
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown session prune option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    if !applied && !inactive {
        return Err(CliError::Usage(
            "session prune requires --applied or --inactive to avoid removing active session worktrees"
                .to_string(),
        ));
    }

    Ok(SessionPruneOptions {
        repo_root,
        db_path,
        applied,
        inactive,
    })
}

pub(crate) fn parse_preflight_options(
    args: &[String],
    cwd: &Path,
) -> Result<PreflightOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown preflight option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "preflight accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "preflight requires <session-id>".to_string(),
        ));
    };

    Ok(PreflightOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

pub(crate) fn parse_review_options(args: &[String], cwd: &Path) -> Result<ReviewOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown review option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "review accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage("review requires <session-id>".to_string()));
    };

    Ok(ReviewOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

pub(crate) fn parse_manifest_show_options(
    args: &[String],
    cwd: &Path,
) -> Result<ManifestShowOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut include_content = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--content" => {
                include_content = true;
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown manifest show option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "manifest show accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "manifest show requires <session-id>".to_string(),
        ));
    };

    Ok(ManifestShowOptions {
        repo_root,
        db_path,
        session_id,
        include_content,
    })
}

pub(crate) fn parse_manifest_edit_options(
    args: &[String],
    cwd: &Path,
) -> Result<ManifestEditOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut set_intent_summary = None;
    let mut set_risk_level = None;
    let mut add_risks = Vec::new();
    let mut add_tests = Vec::new();
    let mut content_file = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "--set-intent-summary" => {
                index += 1;
                let Some(value) = args.get(index).filter(|value| !value.trim().is_empty()) else {
                    return Err(CliError::Usage(
                        "--set-intent-summary requires text".to_string(),
                    ));
                };
                set_intent_summary = Some(value.clone());
            }
            "--set-risk-level" => {
                index += 1;
                let Some(value) = args.get(index).filter(|value| !value.trim().is_empty()) else {
                    return Err(CliError::Usage(
                        "--set-risk-level requires low|medium|high|blocked|unknown".to_string(),
                    ));
                };
                let normalized = value.trim().to_ascii_lowercase();
                if !matches!(
                    normalized.as_str(),
                    "low" | "medium" | "high" | "blocked" | "unknown"
                ) {
                    return Err(CliError::Usage(
                        "--set-risk-level requires low|medium|high|blocked|unknown".to_string(),
                    ));
                }
                set_risk_level = Some(normalized);
            }
            "--add-risk" => {
                index += 1;
                let Some(value) = args.get(index).filter(|value| !value.trim().is_empty()) else {
                    return Err(CliError::Usage("--add-risk requires text".to_string()));
                };
                add_risks.push(value.clone());
            }
            "--add-test" => {
                index += 1;
                let Some(value) = args.get(index).filter(|value| !value.trim().is_empty()) else {
                    return Err(CliError::Usage("--add-test requires text".to_string()));
                };
                add_tests.push(value.clone());
            }
            "--from-file" => {
                index += 1;
                let Some(value) = args.get(index).filter(|value| !value.trim().is_empty()) else {
                    return Err(CliError::Usage("--from-file requires a path".to_string()));
                };
                content_file = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown manifest edit option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "manifest edit accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "manifest edit requires <session-id>".to_string(),
        ));
    };

    let options = ManifestEditOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
        set_intent_summary,
        set_risk_level,
        add_risks,
        add_tests,
        content_file,
    };
    if !options.has_edit() {
        return Err(CliError::Usage(
            "manifest edit requires --set-intent-summary, --set-risk-level, --add-risk, --add-test, or --from-file".to_string(),
        ));
    }

    Ok(options)
}

pub(crate) fn parse_approve_options(
    args: &[String],
    cwd: &Path,
) -> Result<ApproveOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut accept_current = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "--accept-current" => {
                accept_current = true;
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown approve option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "approve accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage("approve requires <session-id>".to_string()));
    };

    Ok(ApproveOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
        accept_current,
    })
}

pub(crate) fn parse_reject_options(args: &[String], cwd: &Path) -> Result<RejectOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut reason = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "--reason" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--reason requires text".to_string()));
                };
                reason = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown reject option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "reject accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage("reject requires <session-id>".to_string()));
    };
    let Some(reason) = reason.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "reject requires --reason TEXT so the blocked candidate has recovery context"
                .to_string(),
        ));
    };

    Ok(RejectOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
        reason,
    })
}

pub(crate) fn parse_apply_options(args: &[String], cwd: &Path) -> Result<ApplyOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown apply option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "apply accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage("apply requires <session-id>".to_string()));
    };

    Ok(ApplyOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

pub(crate) fn parse_auth_whoami_options(
    args: &[String],
    cwd: &Path,
) -> Result<AuthWhoamiOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown auth whoami option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(AuthWhoamiOptions {
        repo_root,
        db_path,
        operator_id,
    })
}

pub(crate) fn parse_operator_add_options(
    args: &[String],
    cwd: &Path,
) -> Result<OperatorAddOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut id = None;
    let mut display_name = None;
    let mut role = OperatorRole::Reviewer;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--id" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--id requires an operator id".to_string()));
                };
                id = Some(value.clone());
            }
            "--name" | "--display-name" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--name requires text".to_string()));
                };
                display_name = Some(value.clone());
            }
            "--role" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--role requires a role".to_string()));
                };
                role = OperatorRole::parse(value).map_err(CliError::Usage)?;
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown auth operator add option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    let Some(id) = id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "auth operator add requires --id".to_string(),
        ));
    };

    if matches!(display_name.as_deref(), Some(value) if value.trim().is_empty()) {
        return Err(CliError::Usage("--name must not be empty".to_string()));
    }

    Ok(OperatorAddOptions {
        repo_root,
        db_path,
        id,
        display_name,
        role,
    })
}

pub(crate) fn parse_operator_list_options(
    args: &[String],
    cwd: &Path,
) -> Result<OperatorListOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown auth operator list option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(OperatorListOptions { repo_root, db_path })
}

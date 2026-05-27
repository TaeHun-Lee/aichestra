use std::collections::{BTreeMap, BTreeSet};

use crate::{
    current_branch_name, git_diff_has_changes, run_git_stdout, run_git_success,
    run_git_success_with_config, NativeGitWorktreeManager, WorktreeError,
};
use std::path::PathBuf;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitChangedFile {
    pub path: String,
    pub change_type: String,
    pub symbols_json: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompleteSessionWorktreeRequest {
    pub session_id: String,
    pub worktree_path: PathBuf,
    pub session_branch: String,
    pub main_branch: String,
    pub base_commit: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompletedSessionWorktree {
    pub head_commit: String,
    pub diff_stat: String,
    pub diff_patch: String,
    pub changed_files: Vec<GitChangedFile>,
    pub committed_worktree_changes: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CompleteSessionWorktreeOutcome {
    NoChanges { head_commit: String },
    Changes(CompletedSessionWorktree),
}

pub trait SessionWorktreeCompleter {
    fn complete_session_worktree(
        &self,
        request: &CompleteSessionWorktreeRequest,
    ) -> Result<CompleteSessionWorktreeOutcome, WorktreeError>;
}

impl SessionWorktreeCompleter for NativeGitWorktreeManager {
    fn complete_session_worktree(
        &self,
        request: &CompleteSessionWorktreeRequest,
    ) -> Result<CompleteSessionWorktreeOutcome, WorktreeError> {
        validate_complete_session_worktree_request(request)?;
        ensure_session_worktree_branch(request)?;

        let mut committed_worktree_changes = false;
        let status = run_git_stdout(
            &request.worktree_path,
            &["status", "--porcelain", "--untracked-files=all"],
        )?;

        if !status.trim().is_empty() {
            run_git_success(&request.worktree_path, &["add", "-A"])?;
            if git_diff_has_changes(&request.worktree_path, &["--cached"])? {
                run_git_success_with_config(
                    &request.worktree_path,
                    &[
                        "commit",
                        "-m",
                        &format!("aich: complete {}", request.session_id),
                    ],
                )?;
                committed_worktree_changes = true;
            }
        }

        let head_commit = run_git_stdout(&request.worktree_path, &["rev-parse", "HEAD"])?
            .trim()
            .to_string();
        if head_commit.is_empty() {
            return Err(WorktreeError::InvalidRequest(
                "git rev-parse HEAD returned an empty commit id".to_string(),
            ));
        }

        if !git_diff_has_changes(
            &request.worktree_path,
            &[&request.base_commit, &head_commit],
        )? {
            return Ok(CompleteSessionWorktreeOutcome::NoChanges { head_commit });
        }

        let name_status = run_git_stdout(
            &request.worktree_path,
            &["diff", "--name-status", &request.base_commit, &head_commit],
        )?;
        let diff_stat = run_git_stdout(
            &request.worktree_path,
            &["diff", "--stat", &request.base_commit, &head_commit],
        )?;
        let diff_patch = run_git_stdout(
            &request.worktree_path,
            &["diff", "--patch", &request.base_commit, &head_commit],
        )?;

        Ok(CompleteSessionWorktreeOutcome::Changes(
            CompletedSessionWorktree {
                head_commit,
                diff_stat,
                changed_files: parse_changed_files(&name_status, &diff_patch),
                diff_patch,
                committed_worktree_changes,
            },
        ))
    }
}

pub fn validate_complete_session_worktree_request(
    request: &CompleteSessionWorktreeRequest,
) -> Result<(), WorktreeError> {
    if request.session_id.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "session id is required".to_string(),
        ));
    }
    if request.base_commit.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "base commit is required".to_string(),
        ));
    }
    if request.session_branch.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "session branch is required".to_string(),
        ));
    }
    if request.main_branch.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "main branch is required".to_string(),
        ));
    }
    if request.worktree_path.as_os_str().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "worktree path is required".to_string(),
        ));
    }
    if !request.worktree_path.exists() {
        return Err(WorktreeError::InvalidRequest(format!(
            "session worktree does not exist at {}",
            request.worktree_path.display()
        )));
    }

    Ok(())
}

fn ensure_session_worktree_branch(
    request: &CompleteSessionWorktreeRequest,
) -> Result<(), WorktreeError> {
    let current_branch = current_branch_name(&request.worktree_path)?;
    match current_branch.as_deref() {
        Some(branch) if branch == request.main_branch => Err(WorktreeError::InvalidRequest(
            format!(
                "session worktree is on configured main branch '{branch}'; refuse to complete from main"
            ),
        )),
        Some(branch) if branch == request.session_branch => Ok(()),
        Some(branch) => Err(WorktreeError::InvalidRequest(format!(
            "session worktree is on branch '{branch}', expected session branch '{}'",
            request.session_branch
        ))),
        None => Err(WorktreeError::InvalidRequest(format!(
            "session worktree is detached; expected session branch '{}'",
            request.session_branch
        ))),
    }
}

pub(crate) fn parse_name_status(output: &str) -> Vec<GitChangedFile> {
    output
        .lines()
        .filter_map(|line| {
            let mut parts = line.split('\t');
            let status = parts.next()?;
            let first_path = parts.next()?;
            let path = if status.starts_with('R') || status.starts_with('C') {
                parts.next().unwrap_or(first_path)
            } else {
                first_path
            };

            Some(GitChangedFile {
                path: path.to_string(),
                change_type: change_type_from_name_status(status).to_string(),
                symbols_json: "[]".to_string(),
            })
        })
        .collect()
}

pub(crate) fn parse_changed_files(name_status: &str, diff_patch: &str) -> Vec<GitChangedFile> {
    let symbols_by_path = changed_symbols_by_path(diff_patch);
    let mut files = parse_name_status(name_status);
    for file in &mut files {
        if let Some(symbols) = symbols_by_path.get(&file.path) {
            file.symbols_json = json_string_array(symbols);
        }
    }
    files
}

fn change_type_from_name_status(status: &str) -> &'static str {
    match status.chars().next() {
        Some('A') => "added",
        Some('D') => "deleted",
        Some('M') => "modified",
        Some('R') => "renamed",
        Some('C') => "copied",
        Some('T') => "type_changed",
        Some('U') => "unmerged",
        _ => "changed",
    }
}

fn changed_symbols_by_path(diff_patch: &str) -> BTreeMap<String, Vec<String>> {
    let mut current_path: Option<String> = None;
    let mut symbols: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();

    for line in diff_patch.lines() {
        if let Some(path) = diff_git_b_path(line) {
            current_path = Some(path.to_string());
            continue;
        }
        if let Some(path) = line.strip_prefix("+++ b/") {
            if path != "/dev/null" {
                current_path = Some(path.to_string());
            }
            continue;
        }

        let Some(path) = current_path.as_deref() else {
            continue;
        };

        if let Some(context) = hunk_header_context(line) {
            insert_symbol_candidate(&mut symbols, path, context);
            continue;
        }

        if (line.starts_with('+') || line.starts_with('-'))
            && !line.starts_with("+++")
            && !line.starts_with("---")
        {
            insert_symbol_candidate(&mut symbols, path, &line[1..]);
        }
    }

    symbols
        .into_iter()
        .map(|(path, values)| (path, values.into_iter().collect()))
        .collect()
}

fn diff_git_b_path(line: &str) -> Option<&str> {
    let rest = line.strip_prefix("diff --git ")?;
    let mut parts = rest.split_whitespace();
    let _a_path = parts.next()?;
    let b_path = parts.next()?;
    b_path.strip_prefix("b/")
}

fn hunk_header_context(line: &str) -> Option<&str> {
    if !line.starts_with("@@") {
        return None;
    }
    let end = line.rfind("@@")?;
    let context = line[end + 2..].trim();
    if context.is_empty() {
        None
    } else {
        Some(context)
    }
}

fn insert_symbol_candidate(
    symbols: &mut BTreeMap<String, BTreeSet<String>>,
    path: &str,
    line: &str,
) {
    if let Some(symbol) = symbol_from_declaration(line) {
        symbols.entry(path.to_string()).or_default().insert(symbol);
    }
}

fn symbol_from_declaration(line: &str) -> Option<String> {
    let line = line.trim();
    if line.is_empty() || line.starts_with("//") || line.starts_with('#') {
        return None;
    }

    let normalized = line
        .trim_start_matches("pub ")
        .trim_start_matches("pub(crate) ")
        .trim_start_matches("pub(super) ")
        .trim_start_matches("export ")
        .trim_start_matches("default ")
        .trim_start_matches("async ")
        .trim();

    for keyword in [
        "fn", "struct", "enum", "trait", "mod", "type", "const", "static",
    ] {
        if let Some(name) = symbol_name_after_keyword(normalized, keyword) {
            return Some(name);
        }
    }

    if let Some(value) = normalized.strip_prefix("impl ") {
        let name = clean_symbol_name(value);
        if !name.is_empty() {
            return Some(format!("impl {name}"));
        }
    }

    for keyword in ["function", "class", "interface", "def", "func"] {
        if let Some(name) = symbol_name_after_keyword(normalized, keyword) {
            return Some(name);
        }
    }

    for keyword in ["const", "let", "var"] {
        if let Some(name) = symbol_name_after_keyword(normalized, keyword) {
            return Some(name);
        }
    }

    None
}

fn symbol_name_after_keyword(line: &str, keyword: &str) -> Option<String> {
    let value = line.strip_prefix(keyword)?;
    if !value.starts_with(char::is_whitespace) {
        return None;
    }
    let name = clean_symbol_name(value.trim());
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

fn clean_symbol_name(value: &str) -> String {
    value
        .trim_start_matches("async ")
        .trim_start_matches("unsafe ")
        .trim()
        .chars()
        .take_while(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | ':' | '<' | '>' | '\''))
        .collect::<String>()
        .to_string()
}

fn json_string_array(values: &[String]) -> String {
    if values.is_empty() {
        return "[]".to_string();
    }

    let mut output = String::from("[");
    for (index, value) in values.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }
        output.push('"');
        output.push_str(&json_escape(value));
        output.push('"');
    }
    output.push(']');
    output
}

fn json_escape(value: &str) -> String {
    let mut output = String::new();
    for ch in value.chars() {
        match ch {
            '\\' => output.push_str("\\\\"),
            '"' => output.push_str("\\\""),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            other if other.is_control() => output.push_str(&format!("\\u{:04x}", other as u32)),
            other => output.push(other),
        }
    }
    output
}

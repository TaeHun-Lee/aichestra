use super::*;
use crate::complete::{parse_changed_files, parse_name_status};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn rejects_session_worktree_equal_to_main_worktree() {
    let request = CreateWorktreeRequest {
        repo_path: PathBuf::from("repo"),
        main_worktree_path: PathBuf::from("repo"),
        session_id: "session-1".to_string(),
        branch: "aich/session-1/test".to_string(),
        base_ref: "main".to_string(),
        worktree_path: PathBuf::from("repo"),
    };

    let err = validate_worktree_request(&request).unwrap_err();
    assert!(matches!(err, WorktreeError::InvalidRequest(_)));
}

#[test]
fn accepts_dedicated_session_worktree() {
    let request = CreateWorktreeRequest {
        repo_path: PathBuf::from("repo"),
        main_worktree_path: PathBuf::from("repo"),
        session_id: "session-1".to_string(),
        branch: "aich/session-1/test".to_string(),
        base_ref: "main".to_string(),
        worktree_path: PathBuf::from(".aichestra/worktrees/session-1"),
    };

    validate_worktree_request(&request).expect("valid request");
}

#[test]
fn parses_name_status_into_changed_files() {
    let files = parse_name_status(
        "M\tsrc/lib.rs\nA\tREADME.md\nD\told.txt\nR100\told_name.rs\tnew_name.rs\n",
    );

    assert_eq!(
        files,
        vec![
            GitChangedFile {
                path: "src/lib.rs".to_string(),
                change_type: "modified".to_string(),
                symbols_json: "[]".to_string(),
            },
            GitChangedFile {
                path: "README.md".to_string(),
                change_type: "added".to_string(),
                symbols_json: "[]".to_string(),
            },
            GitChangedFile {
                path: "old.txt".to_string(),
                change_type: "deleted".to_string(),
                symbols_json: "[]".to_string(),
            },
            GitChangedFile {
                path: "new_name.rs".to_string(),
                change_type: "renamed".to_string(),
                symbols_json: "[]".to_string(),
            },
        ]
    );
}

#[test]
fn extracts_changed_symbols_from_patch() {
    let files = parse_changed_files(
        "M\tsrc/lib.rs\nA\tsrc/app.ts\n",
        r#"diff --git a/src/lib.rs b/src/lib.rs
index 1111111..2222222 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -1,3 +1,8 @@ pub fn existing()
+pub fn login(user: User) -> bool {
+    true
+}
+struct SessionState {
+}
diff --git a/src/app.ts b/src/app.ts
new file mode 100644
--- /dev/null
+++ b/src/app.ts
@@ -0,0 +1,3 @@
+export class AppShell {}
+export const routeTable = []
"#,
    );

    assert_eq!(files.len(), 2);
    assert_eq!(
        files[0],
        GitChangedFile {
            path: "src/lib.rs".to_string(),
            change_type: "modified".to_string(),
            symbols_json: "[\"SessionState\",\"existing\",\"login\"]".to_string(),
        }
    );
    assert_eq!(
        files[1],
        GitChangedFile {
            path: "src/app.ts".to_string(),
            change_type: "added".to_string(),
            symbols_json: "[\"AppShell\",\"routeTable\"]".to_string(),
        }
    );
}

#[test]
fn native_preflight_verifies_merge_commit_and_runs_checks() {
    let temp_dir = unique_temp_dir("aich-git-preflight-verified");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);
    let main_before = git(&repo, &["rev-parse", "HEAD"]);

    git(&repo, &["checkout", "-q", "-b", "candidate"]);
    fs::write(repo.join("file.txt"), "base\ncandidate\n").expect("write candidate file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "candidate"]);
    let candidate_commit = git(&repo, &["rev-parse", "HEAD"]);
    git(&repo, &["checkout", "-q", "main"]);

    let sandbox_path = repo.join(".aichestra/sandboxes/preflight-verified");
    let outcome = NativeGitWorktreeManager
        .run_preflight(&PreflightRequest {
            repo_path: repo.clone(),
            sandbox_path: sandbox_path.clone(),
            session_id: "session-1".to_string(),
            main_before_commit: main_before,
            candidate_commit,
            check_commands: vec![CheckCommand {
                name: "clean".to_string(),
                program: "git".to_string(),
                args: vec![
                    "diff".to_string(),
                    "--exit-code".to_string(),
                    "HEAD".to_string(),
                ],
                required: true,
                timeout_ms: None,
                env: Vec::new(),
            }],
        })
        .expect("preflight");

    let verified = match outcome {
        PreflightOutcome::Verified(verified) => verified,
        PreflightOutcome::Blocked(blocked) => panic!("unexpected block: {blocked:?}"),
    };
    assert_eq!(verified.checks.len(), 1);
    assert!(verified.checks[0].passed);
    assert_eq!(
        verified.verified_commit_id,
        git(&sandbox_path, &["rev-parse", "HEAD"])
    );
    assert_eq!(
        verified.verified_tree_id,
        git(&sandbox_path, &["rev-parse", "HEAD^{tree}"])
    );
    assert_eq!(
        fs::read_to_string(sandbox_path.join("file.txt")).expect("read sandbox file"),
        "base\ncandidate\n"
    );

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_apply_fast_forwards_to_verified_commit() {
    let temp_dir = unique_temp_dir("aich-git-apply-verified");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join(".gitignore"), ".aichestra/\n").expect("write gitignore");
    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", ".gitignore", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);
    let main_before = git(&repo, &["rev-parse", "HEAD"]);

    git(&repo, &["checkout", "-q", "-b", "candidate"]);
    fs::write(repo.join("file.txt"), "base\ncandidate\n").expect("write candidate file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "candidate"]);
    let candidate_commit = git(&repo, &["rev-parse", "HEAD"]);
    git(&repo, &["checkout", "-q", "main"]);

    let sandbox_path = repo.join(".aichestra/sandboxes/preflight-apply");
    let outcome = NativeGitWorktreeManager
        .run_preflight(&PreflightRequest {
            repo_path: repo.clone(),
            sandbox_path,
            session_id: "session-1".to_string(),
            main_before_commit: main_before,
            candidate_commit,
            check_commands: vec![CheckCommand {
                name: "status".to_string(),
                program: "git".to_string(),
                args: vec!["status".to_string(), "--short".to_string()],
                required: true,
                timeout_ms: None,
                env: Vec::new(),
            }],
        })
        .expect("preflight");
    let verified = match outcome {
        PreflightOutcome::Verified(verified) => verified,
        PreflightOutcome::Blocked(blocked) => panic!("unexpected block: {blocked:?}"),
    };

    let applied = NativeGitWorktreeManager
        .apply_verified_commit(&ApplyVerifiedCommitRequest {
            repo_path: repo.clone(),
            main_branch: "main".to_string(),
            verified_commit_id: verified.verified_commit_id.clone(),
            verified_tree_id: verified.verified_tree_id.clone(),
        })
        .expect("apply verified commit");

    assert_eq!(applied.applied_commit_id, verified.verified_commit_id);
    assert_eq!(applied.applied_tree_id, verified.verified_tree_id);
    assert_eq!(
        fs::read_to_string(repo.join("file.txt")).expect("read main file"),
        "base\ncandidate\n"
    );

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_ref_commit_reads_configured_main_ref() {
    let temp_dir = unique_temp_dir("aich-git-main-ref");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "trunk"]);
    let trunk_commit = git(&repo, &["rev-parse", "HEAD"]);

    let resolved = NativeGitWorktreeManager
        .ref_commit(&repo, "refs/heads/trunk")
        .expect("resolve trunk ref");

    assert_eq!(resolved.commit_id, trunk_commit);

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_complete_refuses_configured_main_branch() {
    let temp_dir = unique_temp_dir("aich-git-complete-main-refused");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);
    let base_commit = git(&repo, &["rev-parse", "HEAD"]);

    let err = NativeGitWorktreeManager
        .complete_session_worktree(&CompleteSessionWorktreeRequest {
            session_id: "session-1".to_string(),
            worktree_path: repo.clone(),
            session_branch: "aich/session/session-1".to_string(),
            main_branch: "main".to_string(),
            base_commit,
        })
        .unwrap_err();

    assert!(
        matches!(err, WorktreeError::InvalidRequest(message) if message.contains("configured main branch"))
    );

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_complete_refuses_in_progress_merge() {
    let temp_dir = unique_temp_dir("aich-git-complete-in-progress-merge");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);
    let base_commit = git(&repo, &["rev-parse", "HEAD"]);

    let session_worktree = repo.join(".aichestra/worktrees/session-1");
    git(
        &repo,
        &[
            "worktree",
            "add",
            "-b",
            "aich/session/session-1",
            &session_worktree.display().to_string(),
            &base_commit,
        ],
    );

    fs::write(session_worktree.join("file.txt"), "session\n").expect("write session file");
    git(&session_worktree, &["add", "file.txt"]);
    git(&session_worktree, &["commit", "-q", "-m", "session change"]);

    fs::write(repo.join("file.txt"), "main\n").expect("write main file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "main change"]);

    let merge = Command::new("git")
        .arg("-C")
        .arg(&session_worktree)
        .args(["merge", "main"])
        .output()
        .expect("run conflicting merge");
    assert!(
        !merge.status.success(),
        "merge unexpectedly succeeded\nstdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&merge.stdout),
        String::from_utf8_lossy(&merge.stderr)
    );

    let err = NativeGitWorktreeManager
        .complete_session_worktree(&CompleteSessionWorktreeRequest {
            session_id: "session-1".to_string(),
            worktree_path: session_worktree,
            session_branch: "aich/session/session-1".to_string(),
            main_branch: "main".to_string(),
            base_commit,
        })
        .unwrap_err();

    assert!(matches!(
        err,
        WorktreeError::InvalidRequest(message)
            if message.contains("in-progress Git operation (merge)")
                && message.contains("finish the merge and commit")
                && message.contains("git merge --abort")
    ));

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_apply_refuses_wrong_main_branch_checkout() {
    let temp_dir = unique_temp_dir("aich-git-apply-wrong-branch");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);
    git(&repo, &["checkout", "-q", "-b", "feature"]);

    let err = NativeGitWorktreeManager
        .apply_verified_commit(&ApplyVerifiedCommitRequest {
            repo_path: repo.clone(),
            main_branch: "main".to_string(),
            verified_commit_id: "dummy-commit".to_string(),
            verified_tree_id: "dummy-tree".to_string(),
        })
        .unwrap_err();

    assert!(
        matches!(err, WorktreeError::InvalidRequest(message) if message.contains("expected configured main branch"))
    );

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_cleanup_removes_session_worktree_branch_and_sandbox() {
    let temp_dir = unique_temp_dir("aich-git-cleanup-session");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);
    let base_commit = git(&repo, &["rev-parse", "HEAD"]);
    let session_worktree = repo.join(".aichestra/worktrees/session-1");
    let sandbox_worktree = repo.join(".aichestra/sandboxes/merge-1");
    git(
        &repo,
        &[
            "worktree",
            "add",
            "-b",
            "aich/session/session-1",
            &session_worktree.display().to_string(),
            &base_commit,
        ],
    );
    git(
        &repo,
        &[
            "worktree",
            "add",
            "--detach",
            &sandbox_worktree.display().to_string(),
            &base_commit,
        ],
    );

    let outcome = NativeGitWorktreeManager
        .cleanup_session_worktree(&CleanupSessionWorktreeRequest {
            repo_path: repo.clone(),
            main_worktree_path: repo.clone(),
            session_id: "session-1".to_string(),
            branch: "aich/session/session-1".to_string(),
            worktree_path: session_worktree.clone(),
            sandbox_paths: vec![sandbox_worktree.clone()],
            force_branch_delete: false,
        })
        .expect("cleanup");

    assert!(outcome.session_worktree_removed);
    assert!(outcome.branch_deleted);
    assert_eq!(
        outcome.sandbox_worktrees_removed,
        vec![sandbox_worktree.clone()]
    );
    assert!(!session_worktree.exists());
    assert!(!sandbox_worktree.exists());
    let branch_verify = Command::new("git")
        .arg("-C")
        .arg(&repo)
        .args(["rev-parse", "--verify", "refs/heads/aich/session/session-1"])
        .output()
        .expect("verify branch");
    assert!(!branch_verify.status.success());

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_cleanup_force_deletes_unmerged_session_branch() {
    let temp_dir = unique_temp_dir("aich-git-cleanup-force-session");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);
    let base_commit = git(&repo, &["rev-parse", "HEAD"]);
    let session_worktree = repo.join(".aichestra/worktrees/session-1");
    git(
        &repo,
        &[
            "worktree",
            "add",
            "-b",
            "aich/session/session-1",
            &session_worktree.display().to_string(),
            &base_commit,
        ],
    );
    fs::write(session_worktree.join("candidate.txt"), "candidate\n").expect("write candidate file");
    git(&session_worktree, &["add", "candidate.txt"]);
    git(&session_worktree, &["commit", "-q", "-m", "candidate"]);

    let outcome = NativeGitWorktreeManager
        .cleanup_session_worktree(&CleanupSessionWorktreeRequest {
            repo_path: repo.clone(),
            main_worktree_path: repo.clone(),
            session_id: "session-1".to_string(),
            branch: "aich/session/session-1".to_string(),
            worktree_path: session_worktree.clone(),
            sandbox_paths: Vec::new(),
            force_branch_delete: true,
        })
        .expect("cleanup");

    assert!(outcome.session_worktree_removed);
    assert!(outcome.branch_deleted);
    assert!(!session_worktree.exists());
    let branch_verify = Command::new("git")
        .arg("-C")
        .arg(&repo)
        .args(["rev-parse", "--verify", "refs/heads/aich/session/session-1"])
        .output()
        .expect("verify branch");
    assert!(!branch_verify.status.success());

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_cleanup_refuses_dirty_session_worktree() {
    let temp_dir = unique_temp_dir("aich-git-cleanup-dirty-session");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);
    let base_commit = git(&repo, &["rev-parse", "HEAD"]);
    let session_worktree = repo.join(".aichestra/worktrees/session-1");
    git(
        &repo,
        &[
            "worktree",
            "add",
            "-b",
            "aich/session/session-1",
            &session_worktree.display().to_string(),
            &base_commit,
        ],
    );
    fs::write(session_worktree.join("scratch.txt"), "dirty\n").expect("dirty file");

    let err = NativeGitWorktreeManager
        .cleanup_session_worktree(&CleanupSessionWorktreeRequest {
            repo_path: repo.clone(),
            main_worktree_path: repo.clone(),
            session_id: "session-1".to_string(),
            branch: "aich/session/session-1".to_string(),
            worktree_path: session_worktree.clone(),
            sandbox_paths: Vec::new(),
            force_branch_delete: false,
        })
        .unwrap_err();
    assert!(matches!(err, WorktreeError::InvalidRequest(message) if message.contains("dirty")));

    git(
        &repo,
        &[
            "worktree",
            "remove",
            "--force",
            &session_worktree.display().to_string(),
        ],
    );
    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_cleanup_prunes_registered_worktree_when_directory_is_missing() {
    let temp_dir = unique_temp_dir("aich-git-cleanup-stale-session");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);
    let base_commit = git(&repo, &["rev-parse", "HEAD"]);
    let session_worktree = repo.join(".aichestra/worktrees/session-1");
    git(
        &repo,
        &[
            "worktree",
            "add",
            "-b",
            "aich/session/session-1",
            &session_worktree.display().to_string(),
            &base_commit,
        ],
    );
    fs::remove_dir_all(&session_worktree).expect("remove worktree dir");

    let outcome = NativeGitWorktreeManager
        .cleanup_session_worktree(&CleanupSessionWorktreeRequest {
            repo_path: repo.clone(),
            main_worktree_path: repo.clone(),
            session_id: "session-1".to_string(),
            branch: "aich/session/session-1".to_string(),
            worktree_path: session_worktree.clone(),
            sandbox_paths: Vec::new(),
            force_branch_delete: false,
        })
        .expect("cleanup");

    assert!(outcome.session_worktree_removed);
    assert!(outcome.branch_deleted);
    let worktree_list = git(&repo, &["worktree", "list", "--porcelain"]);
    assert!(!worktree_list
        .lines()
        .any(|line| line == format!("worktree {}", session_worktree.display())));

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_preflight_blocks_mechanical_conflict() {
    let temp_dir = unique_temp_dir("aich-git-preflight-conflict");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);

    git(&repo, &["checkout", "-q", "-b", "candidate"]);
    fs::write(repo.join("file.txt"), "candidate\n").expect("write candidate file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "candidate"]);
    let candidate_commit = git(&repo, &["rev-parse", "HEAD"]);

    git(&repo, &["checkout", "-q", "main"]);
    fs::write(repo.join("file.txt"), "main\n").expect("write main file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "main change"]);
    let main_before = git(&repo, &["rev-parse", "HEAD"]);

    let outcome = NativeGitWorktreeManager
        .run_preflight(&PreflightRequest {
            repo_path: repo.clone(),
            sandbox_path: repo.join(".aichestra/sandboxes/preflight-conflict"),
            session_id: "session-1".to_string(),
            main_before_commit: main_before,
            candidate_commit,
            check_commands: vec![CheckCommand {
                name: "status".to_string(),
                program: "git".to_string(),
                args: vec!["status".to_string(), "--short".to_string()],
                required: true,
                timeout_ms: None,
                env: Vec::new(),
            }],
        })
        .expect("preflight");

    let blocked = match outcome {
        PreflightOutcome::Blocked(blocked) => blocked,
        PreflightOutcome::Verified(verified) => panic!("unexpected verified: {verified:?}"),
    };
    assert_eq!(blocked.reason, "mechanical_conflict");
    assert_eq!(blocked.conflict_files, vec!["file.txt".to_string()]);
    assert!(blocked.checks.is_empty());

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_preflight_blocks_failed_checks_after_creating_verified_tree() {
    let temp_dir = unique_temp_dir("aich-git-preflight-check-fail");
    let repo = init_test_repo(&temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);
    let main_before = git(&repo, &["rev-parse", "HEAD"]);

    git(&repo, &["checkout", "-q", "-b", "candidate"]);
    fs::write(repo.join("file.txt"), "base\ncandidate\n").expect("write candidate file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "candidate"]);
    let candidate_commit = git(&repo, &["rev-parse", "HEAD"]);
    git(&repo, &["checkout", "-q", "main"]);

    let outcome = NativeGitWorktreeManager
        .run_preflight(&PreflightRequest {
            repo_path: repo,
            sandbox_path: temp_dir.join("sandbox-check-fail"),
            session_id: "session-1".to_string(),
            main_before_commit: main_before,
            candidate_commit,
            check_commands: vec![CheckCommand {
                name: "changed-from-main".to_string(),
                program: "git".to_string(),
                args: vec![
                    "diff".to_string(),
                    "--quiet".to_string(),
                    "HEAD~1".to_string(),
                    "HEAD".to_string(),
                ],
                required: true,
                timeout_ms: None,
                env: Vec::new(),
            }],
        })
        .expect("preflight");

    let blocked = match outcome {
        PreflightOutcome::Blocked(blocked) => blocked,
        PreflightOutcome::Verified(verified) => panic!("unexpected verified: {verified:?}"),
    };
    assert_eq!(blocked.reason, "checks_failed");
    assert!(blocked.verified_tree_id.is_some());
    assert!(blocked.verified_commit_id.is_some());
    assert_eq!(blocked.checks.len(), 1);
    assert!(!blocked.checks[0].passed);

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_preflight_records_optional_failed_checks_without_blocking() {
    let temp_dir = unique_temp_dir("aich-git-preflight-optional-check");
    let (repo, main_before, candidate_commit) = prepare_mergeable_candidate(&temp_dir);

    let outcome = NativeGitWorktreeManager
        .run_preflight(&PreflightRequest {
            repo_path: repo,
            sandbox_path: temp_dir.join("sandbox-optional-check"),
            session_id: "session-1".to_string(),
            main_before_commit: main_before,
            candidate_commit,
            check_commands: vec![CheckCommand {
                name: "advisory-diff".to_string(),
                program: "git".to_string(),
                args: vec![
                    "diff".to_string(),
                    "--quiet".to_string(),
                    "HEAD~1".to_string(),
                    "HEAD".to_string(),
                ],
                required: false,
                timeout_ms: None,
                env: Vec::new(),
            }],
        })
        .expect("preflight");

    let verified = match outcome {
        PreflightOutcome::Verified(verified) => verified,
        PreflightOutcome::Blocked(blocked) => panic!("unexpected block: {blocked:?}"),
    };
    assert_eq!(verified.checks.len(), 1);
    assert!(!verified.checks[0].required);
    assert!(!verified.checks[0].passed);

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_preflight_passes_check_environment_to_sandbox_process() {
    let temp_dir = unique_temp_dir("aich-git-preflight-check-env");
    let (repo, main_before, candidate_commit) = prepare_mergeable_candidate(&temp_dir);

    let outcome = NativeGitWorktreeManager
        .run_preflight(&PreflightRequest {
            repo_path: repo,
            sandbox_path: temp_dir.join("sandbox-check-env"),
            session_id: "session-1".to_string(),
            main_before_commit: main_before,
            candidate_commit,
            check_commands: vec![env_check_command()],
        })
        .expect("preflight");

    let verified = match outcome {
        PreflightOutcome::Verified(verified) => verified,
        PreflightOutcome::Blocked(blocked) => panic!("unexpected block: {blocked:?}"),
    };
    assert!(verified.checks[0].passed);

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

#[test]
fn native_preflight_blocks_required_timed_out_check() {
    let temp_dir = unique_temp_dir("aich-git-preflight-check-timeout");
    let (repo, main_before, candidate_commit) = prepare_mergeable_candidate(&temp_dir);

    let outcome = NativeGitWorktreeManager
        .run_preflight(&PreflightRequest {
            repo_path: repo,
            sandbox_path: temp_dir.join("sandbox-check-timeout"),
            session_id: "session-1".to_string(),
            main_before_commit: main_before,
            candidate_commit,
            check_commands: vec![timeout_check_command()],
        })
        .expect("preflight");

    let blocked = match outcome {
        PreflightOutcome::Blocked(blocked) => blocked,
        PreflightOutcome::Verified(verified) => panic!("unexpected verified: {verified:?}"),
    };
    assert_eq!(blocked.reason, "checks_failed");
    assert!(blocked.checks[0].required);
    assert!(blocked.checks[0].timed_out);
    assert!(!blocked.checks[0].passed);
    assert!(blocked.checks[0].stderr.contains("timed out"));

    fs::remove_dir_all(temp_dir).expect("remove temp repo");
}

fn unique_temp_dir(name: &str) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_millis();
    let path = env::temp_dir().join(format!("{name}-{}-{millis}", std::process::id()));
    fs::create_dir_all(&path).expect("create temp dir");
    path
}

fn init_test_repo(temp_dir: &Path) -> PathBuf {
    let repo = temp_dir.join("repo");
    fs::create_dir_all(&repo).expect("create repo dir");
    let output = Command::new("git")
        .arg("init")
        .arg("-q")
        .arg(&repo)
        .output()
        .expect("run git init");
    assert!(
        output.status.success(),
        "git init failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    git(&repo, &["config", "user.name", "Aichestra Test"]);
    git(
        &repo,
        &["config", "user.email", "aichestra-test@example.invalid"],
    );
    git(&repo, &["config", "core.autocrlf", "false"]);
    git(&repo, &["config", "core.eol", "lf"]);
    repo
}

fn prepare_mergeable_candidate(temp_dir: &Path) -> (PathBuf, String, String) {
    let repo = init_test_repo(temp_dir);

    fs::write(repo.join("file.txt"), "base\n").expect("write base file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "initial"]);
    git(&repo, &["branch", "-M", "main"]);
    let main_before = git(&repo, &["rev-parse", "HEAD"]);

    git(&repo, &["checkout", "-q", "-b", "candidate"]);
    fs::write(repo.join("file.txt"), "base\ncandidate\n").expect("write candidate file");
    git(&repo, &["add", "file.txt"]);
    git(&repo, &["commit", "-q", "-m", "candidate"]);
    let candidate_commit = git(&repo, &["rev-parse", "HEAD"]);
    git(&repo, &["checkout", "-q", "main"]);

    (repo, main_before, candidate_commit)
}

#[cfg(windows)]
fn env_check_command() -> CheckCommand {
    CheckCommand {
        name: "env-check".to_string(),
        program: "powershell".to_string(),
        args: vec![
            "-NoProfile".to_string(),
            "-Command".to_string(),
            "if ($env:AICH_CHECK_MODE -eq 'sandbox') { exit 0 } else { exit 17 }".to_string(),
        ],
        required: true,
        timeout_ms: None,
        env: vec![("AICH_CHECK_MODE".to_string(), "sandbox".to_string())],
    }
}

#[cfg(not(windows))]
fn env_check_command() -> CheckCommand {
    CheckCommand {
        name: "env-check".to_string(),
        program: "sh".to_string(),
        args: vec![
            "-c".to_string(),
            "test \"$AICH_CHECK_MODE\" = sandbox".to_string(),
        ],
        required: true,
        timeout_ms: None,
        env: vec![("AICH_CHECK_MODE".to_string(), "sandbox".to_string())],
    }
}

#[cfg(windows)]
fn timeout_check_command() -> CheckCommand {
    CheckCommand {
        name: "timeout-check".to_string(),
        program: "powershell".to_string(),
        args: vec![
            "-NoProfile".to_string(),
            "-Command".to_string(),
            "Start-Sleep -Milliseconds 1000".to_string(),
        ],
        required: true,
        timeout_ms: Some(50),
        env: Vec::new(),
    }
}

#[cfg(not(windows))]
fn timeout_check_command() -> CheckCommand {
    CheckCommand {
        name: "timeout-check".to_string(),
        program: "sh".to_string(),
        args: vec!["-c".to_string(), "sleep 1".to_string()],
        required: true,
        timeout_ms: Some(50),
        env: Vec::new(),
    }
}

fn git(repo: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .expect("run git");
    assert!(
        output.status.success(),
        "git {:?} failed\nstdout:\n{}\nstderr:\n{}",
        args,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

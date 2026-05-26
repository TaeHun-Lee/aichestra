pub const SCHEMA_SQL: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '1')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  provider TEXT NOT NULL,
  target_path TEXT,
  branch TEXT NOT NULL UNIQUE,
  worktree_path TEXT NOT NULL UNIQUE,
  base_commit TEXT NOT NULL,
  head_commit TEXT,
  status TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS patch_sets (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  base_commit TEXT NOT NULL,
  head_commit TEXT,
  patch_id TEXT,
  diff_stat TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS changed_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patch_set_id TEXT NOT NULL REFERENCES patch_sets(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  change_type TEXT NOT NULL,
  symbols_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS context_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  hash_algorithm TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS change_manifests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  manifest_path TEXT NOT NULL,
  manifest_hash TEXT,
  validation_status TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS merge_attempts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  main_before_commit TEXT NOT NULL,
  candidate_commit TEXT NOT NULL,
  apply_strategy TEXT NOT NULL,
  verified_tree_id TEXT,
  verified_commit_id TEXT,
  checks_passed INTEGER NOT NULL DEFAULT 0,
  semantic_risk_level TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  CHECK (
    status NOT IN ('verified', 'applied')
    OR (
      verified_tree_id IS NOT NULL
      AND length(verified_tree_id) > 0
      AND verified_commit_id IS NOT NULL
      AND length(verified_commit_id) > 0
    )
  )
);

CREATE TABLE IF NOT EXISTS semantic_reviews (
  id TEXT PRIMARY KEY,
  merge_attempt_id TEXT NOT NULL REFERENCES merge_attempts(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL,
  report_path TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS check_results (
  id TEXT PRIMARY KEY,
  merge_attempt_id TEXT NOT NULL REFERENCES merge_attempts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  result TEXT NOT NULL,
  stdout_artifact TEXT,
  stderr_artifact TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  merge_attempt_id TEXT NOT NULL REFERENCES merge_attempts(id) ON DELETE CASCADE,
  approved_by TEXT NOT NULL,
  approved_verified_tree_id TEXT NOT NULL,
  approved_verified_commit_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  CHECK (decision IN ('approved', 'rejected')),
  CHECK (length(approved_verified_tree_id) > 0),
  CHECK (length(approved_verified_commit_id) > 0)
);

CREATE TABLE IF NOT EXISTS event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_log_subject
  ON event_log(subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_merge_attempts_session
  ON merge_attempts(session_id, created_at_ms);

PRAGMA user_version = 1;
"#;

-- Aichestra persistent storage schema v0/v1 skeleton.
-- Persistent DB v1 can run this migration explicitly through scripts/db/migrate.mjs.
-- The default runtime remains in-memory unless AICHESTRA_STORAGE_PROVIDER=postgres is configured.

CREATE TABLE IF NOT EXISTS repos (
  id text PRIMARY KEY,
  provider text NOT NULL,
  owner text NOT NULL,
  name text NOT NULL,
  default_branch text NOT NULL,
  remote_url text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repos_provider_status ON repos (provider, status);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  status text NOT NULL,
  requester_user_id text NOT NULL,
  repo_id text NOT NULL,
  base_branch text NOT NULL,
  branch_name text,
  selected_agent text,
  selected_model text,
  selected_skill_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_harness_id text,
  instruction_set_id text,
  budget_limit_usd numeric,
  conflict_risk_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_repo_status ON tasks (repo_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_requester ON tasks (requester_user_id);

CREATE TABLE IF NOT EXISTS task_runs (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES tasks(id),
  attempt integer NOT NULL,
  status text NOT NULL,
  agent text NOT NULL,
  model text NOT NULL,
  model_provider text,
  selected_skill_id text,
  skill_version text,
  selected_harness_id text,
  harness_version text,
  selected_skill_refs jsonb,
  selected_harness_ref jsonb,
  selected_instruction_refs jsonb,
  registry_resolution_warnings jsonb,
  registry_resolution_errors jsonb,
  instruction_set_id text,
  started_at timestamptz,
  finished_at timestamptz,
  result_summary text,
  changed_files jsonb,
  diff_summary text,
  pull_request_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, attempt)
);

CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs (task_id);
CREATE INDEX IF NOT EXISTS idx_task_runs_status ON task_runs (status);

CREATE TABLE IF NOT EXISTS pull_requests (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES tasks(id),
  repo_id text NOT NULL,
  provider text NOT NULL,
  external_id text,
  url text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pull_requests_task ON pull_requests (task_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_status ON pull_requests (repo_id, status);

CREATE TABLE IF NOT EXISTS instruction_sets (
  id text PRIMARY KEY,
  task_run_id text NOT NULL REFERENCES task_runs(id),
  artifacts jsonb NOT NULL,
  assembled_hash text NOT NULL,
  max_context_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instruction_sets_run ON instruction_sets (task_run_id);

CREATE TABLE IF NOT EXISTS usage_ledger_entries (
  id text PRIMARY KEY,
  task_id text REFERENCES tasks(id),
  task_run_id text REFERENCES task_runs(id),
  user_id text NOT NULL,
  repo_id text,
  provider text NOT NULL,
  model text,
  event_type text NOT NULL,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric,
  latency_ms integer,
  skill_version text,
  harness_version text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_task ON usage_ledger_entries (task_id);
CREATE INDEX IF NOT EXISTS idx_usage_run ON usage_ledger_entries (task_run_id);
CREATE INDEX IF NOT EXISTS idx_usage_provider_time ON usage_ledger_entries (provider, created_at);

CREATE TABLE IF NOT EXISTS llm_models (
  id text PRIMARY KEY,
  provider_kind text NOT NULL,
  display_name text NOT NULL,
  context_window integer NOT NULL,
  supports_tools boolean NOT NULL,
  supports_streaming boolean NOT NULL,
  input_token_cost_usd numeric,
  output_token_cost_usd numeric,
  status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_models_provider_status ON llm_models (provider_kind, status);

CREATE TABLE IF NOT EXISTS virtual_model_keys (
  id text PRIMARY KEY,
  owner_kind text NOT NULL,
  owner_id text NOT NULL,
  display_name text NOT NULL,
  allowed_provider_kinds jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_model_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  monthly_budget_usd numeric,
  per_task_budget_usd numeric,
  rpm_limit integer,
  tpm_limit integer,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_virtual_model_keys_owner ON virtual_model_keys (owner_kind, owner_id);
CREATE INDEX IF NOT EXISTS idx_virtual_model_keys_status ON virtual_model_keys (status);

CREATE TABLE IF NOT EXISTS llm_audit_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  task_id text,
  task_run_id text,
  actor_id text,
  provider_kind text NOT NULL,
  model_id text,
  result text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_audit_task ON llm_audit_events (task_id, task_run_id);
CREATE INDEX IF NOT EXISTS idx_llm_audit_provider_model ON llm_audit_events (provider_kind, model_id);

CREATE TABLE IF NOT EXISTS llm_gateway_requests (
  id text PRIMARY KEY,
  task_id text,
  task_run_id text,
  provider_kind text NOT NULL,
  model_id text NOT NULL,
  status text NOT NULL,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric,
  finish_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_gateway_requests_task ON llm_gateway_requests (task_id, task_run_id);
CREATE INDEX IF NOT EXISTS idx_llm_gateway_requests_provider_model ON llm_gateway_requests (provider_kind, model_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  actor_user_id text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  task_id text,
  repo_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_events (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_task ON audit_events (task_id);

CREATE TABLE IF NOT EXISTS branch_leases (
  id text PRIMARY KEY,
  task_id text NOT NULL,
  task_run_id text NOT NULL,
  repo_id text NOT NULL,
  branch_id text NOT NULL,
  branch_name text NOT NULL,
  base_branch text NOT NULL,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  symbols jsonb NOT NULL DEFAULT '[]'::jsonb,
  tests jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  expires_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branch_leases_repo_status ON branch_leases (repo_id, status);
CREATE INDEX IF NOT EXISTS idx_branch_leases_run ON branch_leases (task_run_id);

CREATE TABLE IF NOT EXISTS merge_simulation_results (
  id text PRIMARY KEY,
  repo_id text NOT NULL,
  repo_path text,
  base_ref text NOT NULL,
  source_ref text NOT NULL,
  target_ref text,
  task_run_id text,
  branch_lease_id text,
  mode text NOT NULL,
  status text NOT NULL,
  conflicting_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  changed_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text NOT NULL,
  raw_command_metadata jsonb,
  risk_contribution numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merge_sim_repo ON merge_simulation_results (repo_id);
CREATE INDEX IF NOT EXISTS idx_merge_sim_run ON merge_simulation_results (task_run_id);
CREATE INDEX IF NOT EXISTS idx_merge_sim_lease ON merge_simulation_results (branch_lease_id);

CREATE TABLE IF NOT EXISTS merge_queue_entries (
  id text PRIMARY KEY,
  repo_id text NOT NULL,
  task_id text NOT NULL,
  task_run_id text NOT NULL,
  branch_lease_id text NOT NULL,
  pull_request_id text NOT NULL,
  pull_request_url text NOT NULL,
  branch_name text NOT NULL,
  priority integer NOT NULL,
  risk_score numeric NOT NULL,
  conflict_risk_score numeric NOT NULL,
  status text NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocking_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text NOT NULL,
  simulation_status text,
  last_simulation_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  merged_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_merge_queue_repo_status ON merge_queue_entries (repo_id, status);
CREATE INDEX IF NOT EXISTS idx_merge_queue_priority ON merge_queue_entries (priority);

CREATE TABLE IF NOT EXISTS skills (
  id text PRIMARY KEY,
  name text NOT NULL,
  version text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  approval_status text NOT NULL,
  eval_status text NOT NULL,
  owner text NOT NULL,
  compatible_agents jsonb NOT NULL,
  compatible_models jsonb,
  required_tools jsonb NOT NULL,
  required_harnesses jsonb NOT NULL,
  invocation_rules jsonb NOT NULL,
  instruction_ref jsonb,
  instruction_body text,
  eval_refs jsonb NOT NULL,
  dependencies jsonb,
  tags jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

CREATE TABLE IF NOT EXISTS harnesses (
  id text PRIMARY KEY,
  name text NOT NULL,
  version text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  approval_status text NOT NULL,
  eval_status text NOT NULL,
  owner text NOT NULL,
  runtime_type text NOT NULL,
  runtime_image text,
  allowed_tools jsonb NOT NULL,
  allowed_mcp_servers jsonb NOT NULL,
  secret_scopes jsonb NOT NULL,
  network_policy jsonb NOT NULL,
  test_commands jsonb NOT NULL,
  compatible_agents jsonb NOT NULL,
  instruction_loading_policy jsonb NOT NULL,
  dependencies jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

CREATE TABLE IF NOT EXISTS instructions (
  id text PRIMARY KEY,
  name text NOT NULL,
  version text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  approval_status text NOT NULL,
  eval_status text NOT NULL,
  owner text NOT NULL,
  type text NOT NULL,
  scope text NOT NULL,
  path text,
  body text,
  checksum text NOT NULL,
  checksum_algorithm text NOT NULL,
  checksum_status text NOT NULL,
  checksum_verified_at timestamptz,
  precedence integer NOT NULL,
  applies_to_agents jsonb NOT NULL,
  applies_to_repos jsonb NOT NULL,
  applies_to_directories jsonb NOT NULL,
  dependencies jsonb,
  max_context_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

CREATE INDEX IF NOT EXISTS idx_registry_skill_status ON skills (status, approval_status, eval_status);
CREATE INDEX IF NOT EXISTS idx_registry_harness_status ON harnesses (status, approval_status, eval_status);
CREATE INDEX IF NOT EXISTS idx_registry_instruction_status ON instructions (status, approval_status, eval_status, checksum_status);

CREATE TABLE IF NOT EXISTS registry_audit_logs (
  id text PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL,
  target_kind text NOT NULL,
  target_id text NOT NULL,
  target_name text NOT NULL,
  target_version text NOT NULL,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_audit_target ON registry_audit_logs (target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_registry_audit_actor ON registry_audit_logs (actor_id);

CREATE TABLE IF NOT EXISTS registry_revisions (
  id text PRIMARY KEY,
  target_kind text NOT NULL,
  target_id text NOT NULL,
  target_name text NOT NULL,
  target_version text NOT NULL,
  revision_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  snapshot_checksum text NOT NULL,
  change_reason text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  source_audit_log_id text,
  UNIQUE (target_kind, target_id, revision_number)
);

CREATE TABLE IF NOT EXISTS registry_packages (
  id text PRIMARY KEY,
  schema_version text NOT NULL,
  package_kind text NOT NULL,
  name text NOT NULL,
  version text NOT NULL,
  description text NOT NULL,
  owner text NOT NULL,
  manifest_version text NOT NULL,
  entries jsonb NOT NULL,
  dependencies jsonb NOT NULL,
  checksum text NOT NULL,
  checksum_algorithm text NOT NULL,
  created_by text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

CREATE TABLE IF NOT EXISTS registry_eval_results (
  id text PRIMARY KEY,
  target_kind text NOT NULL,
  target_id text NOT NULL,
  target_name text NOT NULL,
  target_version text NOT NULL,
  eval_name text NOT NULL,
  eval_type text NOT NULL,
  status text NOT NULL,
  score numeric,
  max_score numeric,
  summary text NOT NULL,
  details text,
  attached_by text NOT NULL,
  source text NOT NULL,
  artifact_ref text,
  attached_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_eval_target ON registry_eval_results (target_kind, target_id);

CREATE TABLE IF NOT EXISTS failure_signals (
  id text PRIMARY KEY,
  source_type text NOT NULL,
  source_id text NOT NULL,
  task_id text,
  task_run_id text,
  target_kind text NOT NULL,
  target_ref text,
  severity text NOT NULL,
  category text NOT NULL,
  summary text NOT NULL,
  details text,
  observed_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_failure_signals_target ON failure_signals (target_kind, target_ref);
CREATE INDEX IF NOT EXISTS idx_failure_signals_category ON failure_signals (category, severity);

CREATE TABLE IF NOT EXISTS failure_clusters (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  target_kind text NOT NULL,
  target_ref text,
  signal_ids jsonb NOT NULL,
  severity text NOT NULL,
  status text NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS improvement_candidates (
  id text PRIMARY KEY,
  source_cluster_id text NOT NULL,
  target_kind text NOT NULL,
  target_id text NOT NULL,
  target_name text NOT NULL,
  target_version text NOT NULL,
  candidate_type text NOT NULL,
  priority text NOT NULL,
  summary text NOT NULL,
  evidence jsonb NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS improvement_proposals (
  id text PRIMARY KEY,
  candidate_id text NOT NULL,
  target_kind text NOT NULL,
  target_id text NOT NULL,
  target_name text NOT NULL,
  target_version text NOT NULL,
  proposed_change_type text NOT NULL,
  proposed_patch jsonb,
  proposed_summary text NOT NULL,
  rationale text NOT NULL,
  safety_notes jsonb NOT NULL,
  status text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS draft_registry_changes (
  id text PRIMARY KEY,
  proposal_id text NOT NULL,
  target_kind text NOT NULL,
  target_id text NOT NULL,
  target_name text NOT NULL,
  target_version text NOT NULL,
  change_type text NOT NULL,
  draft_payload jsonb NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposal_readiness (
  proposal_id text PRIMARY KEY,
  ready_for_review boolean NOT NULL,
  required_eval_ids jsonb NOT NULL,
  required_approval boolean NOT NULL,
  required_canary boolean NOT NULL,
  blocking_reasons jsonb NOT NULL,
  safety_policy_id text NOT NULL,
  latest_decision text,
  eval_status text,
  canary_ready boolean,
  draft_change_status text,
  evaluated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS proposal_governance_decisions (
  id text PRIMARY KEY,
  proposal_id text NOT NULL,
  actor_id text NOT NULL,
  decision text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_decisions_proposal ON proposal_governance_decisions (proposal_id, created_at);

CREATE TABLE IF NOT EXISTS proposal_eval_runs (
  id text PRIMARY KEY,
  proposal_id text NOT NULL,
  eval_requirement_id text NOT NULL,
  status text NOT NULL,
  summary text NOT NULL,
  score numeric,
  max_score numeric,
  attached_by text NOT NULL,
  attached_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS canary_readiness (
  proposal_id text PRIMARY KEY,
  required boolean NOT NULL,
  ready boolean NOT NULL,
  blocking_reasons jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS proposal_apply_gates (
  proposal_id text PRIMARY KEY,
  can_apply boolean NOT NULL,
  blocking_reasons jsonb NOT NULL,
  required_approval boolean NOT NULL,
  required_eval_passed boolean NOT NULL,
  required_canary_ready boolean NOT NULL,
  safety_policy_id text NOT NULL,
  evaluated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS improvement_governance_audit_events (
  id text PRIMARY KEY,
  action text NOT NULL,
  proposal_id text,
  draft_registry_change_id text,
  actor_id text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_improvement_governance_audit_proposal ON improvement_governance_audit_events (proposal_id, created_at);

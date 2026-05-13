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

CREATE TABLE IF NOT EXISTS git_webhook_verification_results (
  id text PRIMARY KEY,
  delivery_id text NOT NULL,
  verified boolean NOT NULL,
  reason text NOT NULL,
  algorithm text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_git_webhook_verification_delivery ON git_webhook_verification_results (delivery_id, created_at);

CREATE TABLE IF NOT EXISTS git_webhook_events (
  id text PRIMARY KEY,
  provider_kind text NOT NULL,
  event_type text NOT NULL,
  delivery_id text NOT NULL,
  repo_ref text NOT NULL,
  action text,
  payload_hash text NOT NULL,
  signature_verified boolean NOT NULL,
  status text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  task_id text,
  task_run_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_git_webhook_events_delivery ON git_webhook_events (delivery_id);
CREATE INDEX IF NOT EXISTS idx_git_webhook_events_repo_status ON git_webhook_events (repo_ref, status);
CREATE INDEX IF NOT EXISTS idx_git_webhook_events_type_time ON git_webhook_events (event_type, received_at);

CREATE TABLE IF NOT EXISTS git_pull_request_sync_states (
  id text PRIMARY KEY,
  repo_ref text NOT NULL,
  repo_id text,
  pull_request_number integer NOT NULL,
  provider_pull_request_id text,
  pull_request_id text,
  task_id text,
  task_run_id text,
  branch_lease_id text,
  merge_queue_entry_id text,
  state text NOT NULL,
  head_branch text NOT NULL,
  base_branch text NOT NULL,
  latest_sha text,
  changed_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  labels jsonb,
  mergeable_state text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  source_event_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (repo_ref, pull_request_number)
);

CREATE INDEX IF NOT EXISTS idx_git_pr_sync_repo_state ON git_pull_request_sync_states (repo_ref, state);
CREATE INDEX IF NOT EXISTS idx_git_pr_sync_repo_id ON git_pull_request_sync_states (repo_id);
CREATE INDEX IF NOT EXISTS idx_git_pr_sync_task_run ON git_pull_request_sync_states (task_id, task_run_id);

CREATE TABLE IF NOT EXISTS git_branch_sync_states (
  id text PRIMARY KEY,
  repo_ref text NOT NULL,
  repo_id text,
  branch_name text NOT NULL,
  latest_sha text,
  exists boolean NOT NULL,
  protected_branch boolean,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  source_event_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (repo_ref, branch_name)
);

CREATE INDEX IF NOT EXISTS idx_git_branch_sync_repo_exists ON git_branch_sync_states (repo_ref, exists);
CREATE INDEX IF NOT EXISTS idx_git_branch_sync_repo_id ON git_branch_sync_states (repo_id);

CREATE TABLE IF NOT EXISTS git_webhook_audit_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  delivery_id text,
  repo_ref text,
  result text NOT NULL,
  reason text,
  sanitized_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_git_webhook_audit_event_type ON git_webhook_audit_events (event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_git_webhook_audit_delivery ON git_webhook_audit_events (delivery_id);
CREATE INDEX IF NOT EXISTS idx_git_webhook_audit_repo ON git_webhook_audit_events (repo_ref, created_at);

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

-- Enterprise Provider Abstraction v0 schema skeleton. Runtime remains in-memory in v0.
CREATE TABLE IF NOT EXISTS provider_catalog_entries (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  vendor text NOT NULL,
  kind text NOT NULL,
  auth jsonb NOT NULL,
  supported_models jsonb NOT NULL DEFAULT '[]'::jsonb,
  billing_mode text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL,
  policy_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_audit_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  actor_id text,
  task_id text,
  task_run_id text,
  provider_id text NOT NULL,
  provider_kind text NOT NULL,
  auth_type text NOT NULL,
  operation text NOT NULL,
  result text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

-- Local Agent Protocol v1 schema skeleton. Runtime remains in-memory until a
-- future persistent protocol repository task wires these tables.
CREATE TABLE IF NOT EXISTS local_agent_registrations (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  host_id text NOT NULL,
  display_name text NOT NULL,
  agent_version text NOT NULL,
  platform text NOT NULL,
  status text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  registered_at timestamptz NOT NULL,
  last_seen_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_provider_catalog_kind_status ON provider_catalog_entries (kind, status);
CREATE INDEX IF NOT EXISTS idx_provider_audit_provider ON provider_audit_events (provider_id, created_at);
CREATE INDEX IF NOT EXISTS idx_provider_audit_task ON provider_audit_events (task_id, task_run_id);
CREATE INDEX IF NOT EXISTS idx_local_agent_registrations_user_status ON local_agent_registrations (user_id, status);
CREATE INDEX IF NOT EXISTS idx_local_agent_registrations_host ON local_agent_registrations (host_id);
CREATE INDEX IF NOT EXISTS idx_local_agent_registrations_last_seen ON local_agent_registrations (last_seen_at);

CREATE TABLE IF NOT EXISTS local_agent_sessions (
  id text PRIMARY KEY,
  agent_id text NOT NULL,
  user_id text NOT NULL,
  status text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_local_agent_sessions_agent_status ON local_agent_sessions (agent_id, status);
CREATE INDEX IF NOT EXISTS idx_local_agent_sessions_user_status ON local_agent_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_local_agent_sessions_expires ON local_agent_sessions (expires_at);

CREATE TABLE IF NOT EXISTS local_agent_channels (
  id text PRIMARY KEY,
  agent_id text NOT NULL,
  user_id text NOT NULL,
  channel_kind text NOT NULL,
  status text NOT NULL,
  handshake_status text NOT NULL,
  created_at timestamptz NOT NULL,
  established_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_local_agent_channels_agent_status ON local_agent_channels (agent_id, status);
CREATE INDEX IF NOT EXISTS idx_local_agent_channels_user_status ON local_agent_channels (user_id, status);
CREATE INDEX IF NOT EXISTS idx_local_agent_channels_kind_status ON local_agent_channels (channel_kind, status);
CREATE INDEX IF NOT EXISTS idx_local_agent_channels_expires ON local_agent_channels (expires_at);

CREATE TABLE IF NOT EXISTS local_agent_handshakes (
  id text PRIMARY KEY,
  channel_id text NOT NULL,
  agent_id text NOT NULL,
  challenge text NOT NULL,
  response_status text NOT NULL,
  issued_at timestamptz NOT NULL,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_local_agent_handshakes_channel ON local_agent_handshakes (channel_id);
CREATE INDEX IF NOT EXISTS idx_local_agent_handshakes_agent_status ON local_agent_handshakes (agent_id, response_status);
CREATE INDEX IF NOT EXISTS idx_local_agent_handshakes_expires ON local_agent_handshakes (expires_at);

CREATE TABLE IF NOT EXISTS local_agent_capability_advertisements (
  id text PRIMARY KEY,
  agent_id text NOT NULL,
  agent_version text NOT NULL,
  platform text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  supported_provider_templates jsonb NOT NULL DEFAULT '[]'::jsonb,
  supported_parser_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  supported_consent_levels jsonb NOT NULL DEFAULT '[]'::jsonb,
  supported_sandbox_kinds jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_timeout_ms integer NOT NULL,
  supports_streaming boolean NOT NULL,
  supports_cancellation boolean NOT NULL,
  advertised_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_agent_capability_advertisements_agent ON local_agent_capability_advertisements (agent_id, advertised_at);
CREATE INDEX IF NOT EXISTS idx_local_agent_capability_advertisements_version ON local_agent_capability_advertisements (agent_version);

CREATE TABLE IF NOT EXISTS local_cli_compatibility_entries (
  id text PRIMARY KEY,
  vendor text NOT NULL,
  command text NOT NULL,
  version_range text NOT NULL,
  provider_template_id text NOT NULL,
  parser_mode text NOT NULL,
  stdout_policy text NOT NULL,
  stderr_policy text NOT NULL,
  supported boolean NOT NULL,
  notes text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_cli_compatibility_entries_template ON local_cli_compatibility_entries (provider_template_id);
CREATE INDEX IF NOT EXISTS idx_local_cli_compatibility_entries_vendor_command ON local_cli_compatibility_entries (vendor, command);
CREATE INDEX IF NOT EXISTS idx_local_cli_compatibility_entries_supported ON local_cli_compatibility_entries (supported);

CREATE TABLE IF NOT EXISTS local_cli_compatibility_results (
  id text PRIMARY KEY,
  provider_id text NOT NULL,
  agent_id text NOT NULL,
  command text NOT NULL,
  reported_version text,
  compatible boolean NOT NULL,
  reason text NOT NULL,
  parser_mode text NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_cli_compatibility_results_agent ON local_cli_compatibility_results (agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_local_cli_compatibility_results_provider ON local_cli_compatibility_results (provider_id, created_at);
CREATE INDEX IF NOT EXISTS idx_local_cli_compatibility_results_compatible ON local_cli_compatibility_results (compatible);

CREATE TABLE IF NOT EXISTS local_agent_invocation_envelopes (
  id text PRIMARY KEY,
  task_id text,
  task_run_id text,
  provider_id text NOT NULL,
  local_agent_id text NOT NULL,
  workspace_ref text NOT NULL,
  instruction_set_hash text,
  prompt_ref text,
  required_consent_level text NOT NULL,
  sandbox_profile_id text,
  network_policy_id text,
  redaction_policy_id text,
  secret_scope_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeout_ms integer NOT NULL,
  signature_status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_agent_envelopes_provider ON local_agent_invocation_envelopes (provider_id, created_at);
CREATE INDEX IF NOT EXISTS idx_local_agent_envelopes_agent ON local_agent_invocation_envelopes (local_agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_local_agent_envelopes_task ON local_agent_invocation_envelopes (task_id, task_run_id);

CREATE TABLE IF NOT EXISTS local_agent_invocations (
  id text PRIMARY KEY,
  envelope_id text NOT NULL,
  state text NOT NULL,
  status_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  exit_code integer,
  redaction_applied boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_local_agent_invocations_envelope ON local_agent_invocations (envelope_id);
CREATE INDEX IF NOT EXISTS idx_local_agent_invocations_state ON local_agent_invocations (state, created_at);

CREATE TABLE IF NOT EXISTS local_agent_consent_requests (
  id text PRIMARY KEY,
  invocation_id text NOT NULL,
  user_id text NOT NULL,
  provider_id text,
  workspace_ref text,
  consent_level text NOT NULL,
  requested_capability_kinds jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeout_ms integer,
  safety_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text NOT NULL,
  requested_at timestamptz NOT NULL,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_local_agent_consent_requests_invocation ON local_agent_consent_requests (invocation_id);
CREATE INDEX IF NOT EXISTS idx_local_agent_consent_requests_user_level ON local_agent_consent_requests (user_id, consent_level);
CREATE INDEX IF NOT EXISTS idx_local_agent_consent_requests_expires ON local_agent_consent_requests (expires_at);

CREATE TABLE IF NOT EXISTS local_agent_consent_decisions (
  id text PRIMARY KEY,
  consent_request_id text NOT NULL,
  user_id text NOT NULL,
  decision text NOT NULL,
  reason text,
  decided_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_local_agent_consent_decisions_request ON local_agent_consent_decisions (consent_request_id);
CREATE INDEX IF NOT EXISTS idx_local_agent_consent_decisions_user_decision ON local_agent_consent_decisions (user_id, decision);
CREATE INDEX IF NOT EXISTS idx_local_agent_consent_decisions_decided ON local_agent_consent_decisions (decided_at);

CREATE TABLE IF NOT EXISTS local_agent_invocation_streams (
  id text PRIMARY KEY,
  invocation_id text NOT NULL,
  state text NOT NULL,
  event_count integer NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_local_agent_invocation_streams_invocation ON local_agent_invocation_streams (invocation_id);
CREATE INDEX IF NOT EXISTS idx_local_agent_invocation_streams_state ON local_agent_invocation_streams (state, started_at);

CREATE TABLE IF NOT EXISTS local_agent_stream_events (
  id text PRIMARY KEY,
  stream_id text NOT NULL,
  invocation_id text NOT NULL,
  sequence integer NOT NULL,
  source text NOT NULL,
  type text NOT NULL,
  payload_preview jsonb NOT NULL,
  redacted boolean NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_agent_stream_events_stream_sequence ON local_agent_stream_events (stream_id, sequence);
CREATE INDEX IF NOT EXISTS idx_local_agent_stream_events_invocation_sequence ON local_agent_stream_events (invocation_id, sequence);
CREATE INDEX IF NOT EXISTS idx_local_agent_stream_events_source_type ON local_agent_stream_events (source, type);

CREATE TABLE IF NOT EXISTS local_agent_normalized_events (
  id text PRIMARY KEY,
  invocation_id text NOT NULL,
  source text NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL,
  redacted boolean NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_agent_events_invocation ON local_agent_normalized_events (invocation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_local_agent_events_source_type ON local_agent_normalized_events (source, type);

CREATE TABLE IF NOT EXISTS local_agent_protocol_audit_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  actor_id text,
  agent_id text,
  invocation_id text,
  task_id text,
  task_run_id text,
  result text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_agent_protocol_audit_event_type ON local_agent_protocol_audit_events (event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_local_agent_protocol_audit_agent ON local_agent_protocol_audit_events (agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_local_agent_protocol_audit_invocation ON local_agent_protocol_audit_events (invocation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_local_agent_protocol_audit_task ON local_agent_protocol_audit_events (task_id, task_run_id);

CREATE TABLE IF NOT EXISTS agent_runs (
  id text PRIMARY KEY,
  task_id text NOT NULL,
  task_run_id text NOT NULL,
  runner_kind text NOT NULL,
  status text NOT NULL,
  diff_summary text NOT NULL,
  changed_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  test_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  llm_gateway_request_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_ledger_entry_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  audit_event_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_task ON agent_runs (task_id, task_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_runner_status ON agent_runs (runner_kind, status);

CREATE TABLE IF NOT EXISTS agent_run_audit_events (
  id text PRIMARY KEY,
  task_id text NOT NULL,
  task_run_id text NOT NULL,
  runner_kind text NOT NULL,
  event_type text NOT NULL,
  result text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_audit_task ON agent_run_audit_events (task_id, task_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_run_audit_event_type ON agent_run_audit_events (event_type, created_at);

CREATE TABLE IF NOT EXISTS instruction_assemblies (
  id text PRIMARY KEY,
  task_id text NOT NULL,
  task_run_id text NOT NULL,
  selected_instruction_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_skill_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_harness_ref jsonb NOT NULL,
  instruction_set_hash text NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instruction_assemblies_task ON instruction_assemblies (task_id, task_run_id);
CREATE INDEX IF NOT EXISTS idx_instruction_assemblies_hash ON instruction_assemblies (instruction_set_hash);

CREATE TABLE IF NOT EXISTS agent_workspaces (
  id text PRIMARY KEY,
  root_path text NOT NULL,
  mode text NOT NULL,
  task_id text NOT NULL,
  task_run_id text NOT NULL,
  cleanup_policy text NOT NULL,
  status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_workspaces_task ON agent_workspaces (task_id, task_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_workspaces_status ON agent_workspaces (status, created_at);

CREATE TABLE IF NOT EXISTS command_execution_results (
  id text PRIMARY KEY,
  task_id text NOT NULL,
  task_run_id text NOT NULL,
  agent_run_id text NOT NULL,
  executor_kind text NOT NULL,
  status text NOT NULL,
  command text NOT NULL,
  args jsonb NOT NULL DEFAULT '[]'::jsonb,
  exit_code integer,
  stdout_preview text NOT NULL,
  stderr_preview text NOT NULL,
  stdout_bytes integer NOT NULL,
  stderr_bytes integer NOT NULL,
  duration_ms integer NOT NULL,
  blocked_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_command_execution_results_run ON command_execution_results (agent_run_id);
CREATE INDEX IF NOT EXISTS idx_command_execution_results_task ON command_execution_results (task_id, task_run_id);
CREATE INDEX IF NOT EXISTS idx_command_execution_results_status ON command_execution_results (status, created_at);

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

-- Policy-as-code v0 audit skeleton. Runtime remains in-memory until a future
-- persistent policy repository task wires this table behind the policy package.
CREATE TABLE IF NOT EXISTS policy_decision_audit_entries (
  id text PRIMARY KEY,
  policy_decision_id text NOT NULL,
  action text NOT NULL,
  resource_kind text NOT NULL,
  resource_id text,
  actor_id text,
  allowed boolean NOT NULL,
  decision text NOT NULL,
  reason text NOT NULL,
  matched_rule_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  task_id text,
  task_run_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_decision_audit_decision ON policy_decision_audit_entries (policy_decision_id);
CREATE INDEX IF NOT EXISTS idx_policy_decision_audit_action ON policy_decision_audit_entries (action, created_at);
CREATE INDEX IF NOT EXISTS idx_policy_decision_audit_actor ON policy_decision_audit_entries (actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_policy_decision_audit_task_run ON policy_decision_audit_entries (task_id, task_run_id);

-- Secrets and Sandbox Design v0 schema skeleton. Runtime remains in-memory
-- until a future persistent security repository task wires these tables.
CREATE TABLE IF NOT EXISTS secret_refs (
  id text PRIMARY KEY,
  provider text NOT NULL,
  name text NOT NULL,
  scope text NOT NULL,
  description text,
  status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secret_refs_provider_status ON secret_refs (provider, status);
CREATE INDEX IF NOT EXISTS idx_secret_refs_scope ON secret_refs (scope);

CREATE TABLE IF NOT EXISTS secret_scopes (
  id text PRIMARY KEY,
  name text NOT NULL,
  allowed_resource_kinds jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_provider_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_repo_ids jsonb,
  allowed_runner_kinds jsonb,
  max_ttl_seconds integer NOT NULL,
  requires_approval boolean NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_secret_scopes_requires_approval ON secret_scopes (requires_approval);

CREATE TABLE IF NOT EXISTS secret_leases (
  id text PRIMARY KEY,
  secret_ref_id text NOT NULL,
  scope_id text NOT NULL,
  task_id text,
  task_run_id text,
  actor_id text,
  status text NOT NULL,
  issued_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  reason text
);

CREATE INDEX IF NOT EXISTS idx_secret_leases_ref ON secret_leases (secret_ref_id);
CREATE INDEX IF NOT EXISTS idx_secret_leases_scope ON secret_leases (scope_id);
CREATE INDEX IF NOT EXISTS idx_secret_leases_task_run ON secret_leases (task_id, task_run_id);
CREATE INDEX IF NOT EXISTS idx_secret_leases_actor ON secret_leases (actor_id);
CREATE INDEX IF NOT EXISTS idx_secret_leases_status ON secret_leases (status);

CREATE TABLE IF NOT EXISTS secret_access_decisions (
  id text PRIMARY KEY,
  allowed boolean NOT NULL,
  decision text NOT NULL,
  reason text NOT NULL,
  secret_ref_id text,
  scope_id text,
  task_id text,
  task_run_id text,
  actor_id text,
  policy_decision_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secret_access_decisions_ref ON secret_access_decisions (secret_ref_id, created_at);
CREATE INDEX IF NOT EXISTS idx_secret_access_decisions_scope ON secret_access_decisions (scope_id, created_at);
CREATE INDEX IF NOT EXISTS idx_secret_access_decisions_actor ON secret_access_decisions (actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_secret_access_decisions_task_run ON secret_access_decisions (task_id, task_run_id);

CREATE TABLE IF NOT EXISTS sandbox_profiles (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  allow_network boolean NOT NULL,
  allow_file_write boolean NOT NULL,
  allow_shell_execution boolean NOT NULL,
  allow_git_remote boolean NOT NULL,
  allow_secrets boolean NOT NULL,
  allowed_commands jsonb NOT NULL DEFAULT '[]'::jsonb,
  denied_commands jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  denied_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  network_policy_ref text,
  max_runtime_ms integer NOT NULL,
  max_output_bytes integer NOT NULL,
  cleanup_policy text NOT NULL,
  status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sandbox_profiles_kind_status ON sandbox_profiles (kind, status);

CREATE TABLE IF NOT EXISTS sandbox_sessions (
  id text PRIMARY KEY,
  profile_id text NOT NULL,
  task_id text,
  task_run_id text,
  runner_kind text,
  workspace_id text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cleanup_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_profile ON sandbox_sessions (profile_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_task_run ON sandbox_sessions (task_id, task_run_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_runner_status ON sandbox_sessions (runner_kind, status);

CREATE TABLE IF NOT EXISTS sandbox_decisions (
  id text PRIMARY KEY,
  allowed boolean NOT NULL,
  decision text NOT NULL,
  reason text NOT NULL,
  profile_id text NOT NULL,
  task_id text,
  task_run_id text,
  actor_id text,
  policy_decision_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_decisions_profile ON sandbox_decisions (profile_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sandbox_decisions_task_run ON sandbox_decisions (task_id, task_run_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_decisions_actor ON sandbox_decisions (actor_id, created_at);

CREATE TABLE IF NOT EXISTS network_egress_policies (
  id text PRIMARY KEY,
  name text NOT NULL,
  default_action text NOT NULL,
  allowed_hosts jsonb NOT NULL DEFAULT '[]'::jsonb,
  denied_hosts jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_ports jsonb NOT NULL DEFAULT '[]'::jsonb,
  denied_ports jsonb NOT NULL DEFAULT '[]'::jsonb,
  allow_localhost boolean NOT NULL,
  allow_private_network boolean NOT NULL,
  status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_network_egress_policies_status ON network_egress_policies (status, default_action);

CREATE TABLE IF NOT EXISTS redaction_policies (
  id text PRIMARY KEY,
  name text NOT NULL,
  mask_bearer_tokens boolean NOT NULL,
  mask_api_keys boolean NOT NULL,
  mask_credential_paths boolean NOT NULL,
  mask_env_dumps boolean NOT NULL,
  mask_provider_tokens boolean NOT NULL,
  max_preview_bytes integer NOT NULL,
  retention_class text NOT NULL,
  status text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_redaction_policies_status ON redaction_policies (status, retention_class);

CREATE TABLE IF NOT EXISTS security_audit_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  actor_id text,
  task_id text,
  task_run_id text,
  target_id text,
  target_kind text NOT NULL,
  result text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_events (event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_target ON security_audit_events (target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_actor ON security_audit_events (actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_task_run ON security_audit_events (task_id, task_run_id);

# Policy Runtime PoC Golden Decision Tests v0

Status: planning/readiness only
Runtime impact: none

These are documentation/readiness seed cases for a future offline golden harness. They do not execute OPA, Cedar, JSON/YAML bundles, external policy services, or dynamic policy code.

Update: Policy Runtime PoC Golden Test Harness v1 now implements the offline deterministic StaticPolicyEngine comparison in `packages/policy/src/golden-cases.ts`, `packages/policy/src/golden-harness.ts`, and `tests/policy-runtime-golden-harness-v1.test.ts`. Policy Runtime Shadow Evaluation Planning v1 defines how future candidate runtime outputs will be compared against that static baseline without changing enforcement. This v0 document remains the planning source for expected case intent.

| Case | Expected outcome | Notes |
|---|---|---|
| Git remote merge denied | deny | `git.merge` remains unsupported and denied for all actors. |
| Force push denied | deny | Force push is outside Real Git Adapter v2 and must deny as destructive Git. |
| `secret.read` denied | deny | Raw secret reads are never allowed. |
| Credential cache read denied | deny | Provider-owned caches such as local CLI auth caches are never read. |
| Runner secret injection denied | deny | Runner secret injection is denied in default runtime. |
| MCP critical tool denied | deny | Critical/high-risk MCP tools, write/deploy tools, network tools, and secret tools deny. |
| LLM remote completion requires gates | deny unless all gates pass | Remote completion needs remote LLM gates, completion gate, model allowlist, credential metadata, budget, Auth/RBAC, and Policy allow. |
| LLM fallback bounded | deny unless enabled and bounded | Fallback is disabled by default and must never bypass provider/model/budget gates. |
| Vault secret resolution requires Auth/RBAC plus Policy plus path allowlist | allow_when_gated | Allow only after Vault gates, active SecretRef, Auth/RBAC, Policy, lease, and allowlisted path checks. Never expose values. |
| Registry pending approval excluded | exclude | Resolver must exclude pending approval entries and preserve lifecycle/approval/eval/checksum gates. |
| Governance apply gate denied | deny | `improvement.apply` remains blocked and auto-apply remains false. |
| Dashboard viewer cannot see secret-adjacent details | deny raw secret-adjacent view, allow sanitized read | Viewers may see safe counts/status only, not raw secret-adjacent details. |
| `security_admin` can view audit metadata but not raw secrets | deny raw secret view, allow sanitized metadata future | Security admins may view sanitized audit metadata, not raw secrets, prompts, provider outputs, or webhook payloads. |
| Service account cannot bypass policy | deny when gates missing | Service accounts are attribution subjects only and cannot bypass policy. |
| Tenant scope mismatch denied in future | deny | Future production tenant mismatch must deny once tenant enforcement exists. |

## Required Future Harness Properties

- Fixture inputs use the normalized contract from `policy-io-contract-v0.md`.
- Expected outputs include decision, reason, rule id, bundle id/version, obligations, audit metadata, and redaction requirements.
- Every fixture is deterministic and metadata-only.
- Unknown actions deny.
- Missing inputs deny.
- Tenant mismatch denies in future enforcement fixtures.
- Secret exposure tests fail on raw tokens, env values, credential cache paths, raw prompts, raw provider responses, and raw webhook payloads.

No runtime policy evaluator tests are implemented by this document. Golden Harness v1 implements static golden harness tests only, and Shadow Evaluation Planning v1 implements readiness metadata only; neither executes OPA/Rego, Cedar, signed JSON/YAML bundles, external policy services, candidate runtimes, or dynamic policy code.

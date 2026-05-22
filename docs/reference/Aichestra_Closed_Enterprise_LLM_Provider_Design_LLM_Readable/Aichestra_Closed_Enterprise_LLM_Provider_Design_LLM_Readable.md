---
title: Aichestra Closed Enterprise LLM Provider Integration Design (LLM-readable version)
language: ko-KR
as_of: '2026-05-11'
document_type: machine_readable_design_spec
canonical_formats:
- markdown
- json
- schema.json
---

# Aichestra 폐쇄 기업형 LLM Provider 통합 설계 - LLM 인식 가능 문서

## LLM_PARSE_INSTRUCTIONS

- 이 문서는 LLM/에이전트가 그대로 읽고 설계 판단, 구현 계획, 코드 생성에 활용할 수 있도록 작성된 구조화 문서입니다.
- `MUST`, `SHOULD`, `MAY`, `MUST NOT` 의미: MUST는 필수, SHOULD는 권장, MAY는 선택, MUST NOT은 금지입니다.
- Markdown 본문은 사람과 LLM을 위한 canonical 설명이고, 하단의 YAML/TypeScript/JSON 예시는 구현 템플릿입니다.
- 약관/정책 관련 내용은 제품 설계상 안전 가드레일이며 법률 자문이 아닙니다. 실제 출시 전 Provider별 최신 약관과 enterprise 계약을 확인해야 합니다.
- Provider credential 파일이나 OAuth cache를 직접 읽는 설계는 금지입니다. Local CLI Provider는 CLI 프로세스 실행과 입출력 브로커링만 담당합니다.

## 1. Executive Summary

**One sentence:** Aichestra는 폐쇄 기업형 LLM을 API Key, OAuth/WIF/IAM, 또는 사용자 로컬 CLI 실행 방식으로 Provider화할 수 있으나, 인증과 실행 책임을 분리하고 Local Agent를 통해 사용자 소유 세션을 안전하게 브로커링해야 한다.

**Core decision:** Provider를 cloud_api, oauth_api, workload_identity, cloud_iam, local_cli, pty_interactive_fallback로 분류하고, 인증은 CredentialManager/TokenResolver, 실행은 ProviderAdapter/CliRunner, 정책은 PolicyEngine으로 분리한다.

### Preferred integration order
- 1. 공식 API/SDK 직접 연동
- 2. 공식 OAuth/WIF/Cloud IAM 인증 흐름
- 3. 공식 headless/non-interactive CLI 모드
- 4. 공식 Agent SDK/MCP/plugin 인터페이스
- 5. PTY 기반 interactive terminal automation은 최후의 수단

### Critical rules
- Aichestra는 ~/.codex/auth.json, ~/.claude credential 파일, Google credential cache 등 Provider 소유 credential을 직접 읽지 않는다.
- Aichestra Cloud는 사용자의 로컬 CLI 토큰을 서버로 업로드하지 않는다.
- Gemini CLI OAuth 세션은 제3자 backend 접근 우회 수단으로 piggyback하지 않는다.
- Codex ChatGPT 로그인 세션은 사용자 로컬 신뢰 환경의 CLI 실행에만 사용하고, 자동화/CI/CD는 API key 또는 공식 권장 경로를 사용한다.
- Local CLI Provider는 사용자 컴퓨터에서 실행되는 Aichestra Local Agent가 필요하다.

## 2. Scope / Non-goals

### Scope
- API Key 기반 폐쇄 기업형 LLM Provider
- OAuth / Workload Identity / Cloud IAM 기반 Provider
- 사용자 컴퓨터에 설치된 Claude Code, Codex CLI, Gemini CLI 등 Local CLI Provider
- PTY 기반 interactive terminal fallback
- 보안/운영/정책/스키마/구현 청사진

### Non-goals
- 각 Provider의 약관을 우회하는 인증 방법 설계
- 사용자의 로컬 credential cache를 직접 읽거나 복사하는 설계
- 단일 사용자의 CLI 세션을 여러 사용자에게 재판매/중계하는 설계

## 3. Architecture

### Components

#### Aichestra UI

Responsibilities:
- 작업 생성
- 결과 표시
- 사용자 승인 UI
- Provider 선택 UI

#### Aichestra Cloud Orchestrator

Responsibilities:
- 워크플로 라우팅
- 정책 평가
- 감사 이벤트 수집
- 멀티 Provider fallback

Must not:
- 사용자 로컬 CLI credential을 저장
- 사용자 대신 OAuth cache를 읽어 API 호출

#### Aichestra Local Agent

Responsibilities:
- 사용자 PC에서 CLI 실행
- stdin/stdout/stderr 브로커링
- workspace sandbox
- 프로세스 종료/timeout 관리
- 로컬 승인 프롬프트

Required for:
- local_cli
- pty_interactive_fallback

#### CredentialManager

Responsibilities:
- API key secret 참조
- OAuth token refresh
- WIF token exchange
- Cloud IAM ADC/STS 연결
- credential access audit

Principle: ProviderAdapter가 credential 원본을 직접 보지 않게 한다.

#### TokenResolver

Responsibilities:
- Provider별 auth header 또는 env allowlist 생성
- 토큰 만료 전 refresh
- credential type별 정책 enforcement

#### ProviderAdapter

Responsibilities:
- API 호출 또는 CLI 실행 요청을 표준 InvocationResult로 정규화
- stream event 정규화
- error mapping

#### PolicyEngine

Responsibilities:
- 파일 접근 범위
- shell 실행 권한
- 네트워크 권한
- 도구 승인
- 민감정보 redaction
- rate/cost limits

#### AuditLogger

Responsibilities:
- who/what/when/where/which-provider 기록
- credential 비저장
- stdout/stderr 민감정보 redaction 후 저장

### Cloud API flow
- User submits task in Aichestra UI
- Orchestrator selects cloud_api ProviderAdapter
- PolicyEngine validates task and data classification
- CredentialManager resolves API key or bearer token reference
- ProviderAdapter calls model API
- StreamNormalizer emits standard events to UI and workflow engine
- AuditLogger records non-secret metadata and usage

### OAuth/WIF/IAM flow
- User or workload has an approved identity path
- TokenResolver obtains access token through OAuth/WIF/IAM flow
- ProviderAdapter receives only request headers or temporary env references
- API call proceeds under workspace/project/service-account attribution
- Usage and cost are attributed to the Provider workspace/cloud project/subscription, not to Aichestra unless Aichestra owns the credential

### Local CLI flow
- User installs and logs into Claude Code/Codex CLI/Gemini CLI on local machine
- Aichestra Local Agent detects command availability without reading credential caches
- Aichestra sends an InvocationRequest to Local Agent
- Local Agent runs official headless CLI mode using spawn/exec without shell injection
- stdin passes prompt/context; stdout/stderr are streamed back and normalized
- Local Agent enforces allowed directories, timeout, process limits, and user approval

## 4. Provider Auth Types

### api_key

Description: 정적 API key를 secret manager/env reference로 제공한다.

Best for:
- 빠른 시작
- 서버 단일 테넌트
- CI/CD where provider recommends API key

Risks:
- 장기 secret 유출
- rotation 필요
- 권한 과다 부여

### oauth_user

Description: 사용자 계정 기반 OAuth 또는 브라우저 로그인 세션을 통해 Provider를 사용한다.

Best for:
- 사용자 개인/팀 구독 세션
- 로컬 CLI 앱
- 사용자 귀속 작업

Risks:
- 제3자 backend piggyback 오해
- 토큰 cache 취급 위험
- 조직 정책 위반 가능성

### device_code

Description: 브라우저 callback이 어려운 터미널/SSH/컨테이너 환경에서 device code 방식으로 로그인한다.

Best for:
- 원격 개발환경
- headless host bootstrap

Risks:
- 사용자 승인 UX 필요
- 토큰 복사/공유 금지

### workload_identity

Description: IdP가 발행한 OIDC/JWT를 Provider의 access token으로 교환하는 short-lived credential 방식이다.

Best for:
- 클라우드 workload
- Kubernetes
- GitHub Actions
- CI/CD
- 정적 API key 제거

Risks:
- IdP trust rule misconfiguration
- upstream long-lived secret dependency

### cloud_iam

Description: AWS IAM, Google Cloud ADC/service account, Azure/Foundry identity 등 cloud-native identity를 사용한다.

Best for:
- Vertex AI
- Bedrock
- Azure/OpenAI/Foundry
- enterprise cloud perimeter

Risks:
- 권한 범위 과대
- cloud project billing attribution 혼동

### external_cli_session

Description: 사용자 로컬 CLI가 이미 Provider 인증을 완료했다고 보고, Aichestra는 credential을 읽지 않고 CLI 프로세스만 실행한다.

Best for:
- Bring-your-own-authenticated-CLI
- 사용자 PC의 Claude Code/Codex/Gemini CLI 활용

Risks:
- CLI version drift
- interactive prompt hang
- stderr/stdout parsing differences
- Provider 약관/정책 검토 필요

## 5. Provider Matrix

| Provider | Modes | Adapter | Billing Attribution | Notes |

|---|---|---|---|---|

| Claude API | api_key, workload_identity | cloud_api_provider | Anthropic Console workspace / service account / API key owner | WIF는 정적 API key를 줄이는 production-friendly 방식이다. |

| Claude Code CLI | external_cli_session, oauth_user, api_key, cloud_iam via Bedrock/Vertex/Foundry | local_cli_provider | 사용자의 Claude subscription/team/console/cloud provider config | 가능하면 --bare는 CI/script 재현성에 유리하지만 OAuth/keychain reads를 skip하므로 인증 경로를 별도로 설계해야 한다. |

| OpenAI API / Codex API key workflows | api_key | cloud_api_provider or local_cli_provider for codex exec | OpenAI Platform account / project | Codex CLI programmatic workflows는 공식 문서상 API key 인증이 권장된다. |

| Codex CLI | external_cli_session, oauth_user via ChatGPT login, api_key | local_cli_provider | ChatGPT workspace/subscription 또는 OpenAI Platform API key | stderr는 progress, stdout은 final message 또는 JSONL event stream으로 처리한다. / auth.json은 password처럼 취급하고 Aichestra가 읽거나 업로드하지 않는다. |

| Gemini API | api_key, oauth_user, cloud_iam | cloud_api_provider | Google AI Studio / Google Cloud project | API key가 기본 시작점이고, stricter access control이 필요하면 OAuth/Cloud IAM을 고려한다. |

| Gemini CLI | external_cli_session, oauth_user via Google sign-in, api_key, vertex_ai | local_cli_provider with strict policy | 사용자 Google account/API key/Vertex AI project | Gemini CLI OAuth piggybacking을 backend 우회 인증 수단으로 쓰지 않는다. / Headless 환경에서는 API key 또는 Vertex AI 경로가 권장된다. |

| Vertex AI / Bedrock / Microsoft Foundry | cloud_iam, workload_identity, api_key depending provider | cloud_iam_provider or llm_gateway_provider | cloud project/account/subscription | 기업 보안 perimeter, IAM, audit logging과 결합하기 좋다. |

| Other enterprise LLM CLI | external_cli_session, pty_interactive_fallback, api_key if available | local_cli_provider if headless exists; pty_interactive_fallback only if unavoidable | vendor-specific | 공식 non-interactive mode와 machine-readable output이 있는지 먼저 확인한다. |



## 6. Local CLI Provider Contract

### Preconditions
- Aichestra Local Agent is installed and running on the user machine.
- The CLI command is installed and discoverable in PATH or configured commandPath.
- The user has already authenticated the CLI through the vendor-supported flow.
- Aichestra is authorized by the user to launch the CLI for this workspace/task.

### MUST DO
- Use spawn/exec with shell=false where possible.
- Pass prompt/context via stdin or safe argv template.
- Normalize stdout/stderr separately.
- Set timeout and cancellation controls.
- Enforce allowed directories and workspace boundaries.
- Provide consent prompts for file writes, shell execution, network-sensitive tasks, and danger modes.
- Redact secrets before storing logs.
- Record CLI version, command path, adapter version, cwd, policy result, and exitCode.

### MUST NOT DO
- Do not read vendor credential files or OS keychain entries.
- Do not upload local credential cache to Aichestra Cloud.
- Do not use a user CLI login to serve other users.
- Do not default to danger-full-access, yolo, auto-approve-all, or equivalent.
- Do not scrape terminal UI if a headless/machine-readable mode exists.

### stdout/stderr policy

- `stdout`: final result or machine-readable event stream depending on CLI flags

- `stderr`: progress logs, warnings, retry notices, interactive prompt detection, or errors

- `exit_code`: primary success/failure signal combined with parser result


### Preferred command modes

- `claude`: mode=`headless`, args=`['-p', '{{prompt}}', '--output-format', 'json']`

- `claude_stream`: mode=`streaming`, args=`['-p', '{{prompt}}', '--output-format', 'stream-json', '--verbose', '--include-partial-messages']`

- `codex`: mode=`headless`, args=`['exec', '{{prompt}}']`

- `codex_jsonl`: mode=`streaming`, args=`['exec', '--json', '{{prompt}}']`

- `gemini`: mode=`headless`, args=`['-p', '{{prompt}}', '--output-format', 'json']`



## 7. Configuration Schema and Examples

### TypeScript provider types

```ts
type ProviderKind =
  | "cloud_api"
  | "oauth_api"
  | "workload_identity_api"
  | "cloud_iam"
  | "local_cli"
  | "pty_interactive_fallback";

type ProviderAuth =
  | { type: "api_key"; envKey?: string; secretRef?: string }
  | { type: "oauth_user"; provider: "openai_codex" | "google" | "anthropic" | string; scopes?: string[] }
  | { type: "device_code"; provider: "openai_codex" | "google" | string }
  | { type: "workload_identity"; provider: "anthropic" | "google" | "azure" | "aws" | string; ruleId?: string; serviceAccount?: string }
  | { type: "cloud_iam"; provider: "vertex_ai" | "bedrock" | "azure_foundry" | string; project?: string; region?: string }
  | { type: "external_cli_session"; credentialAccess: "never_read_tokens" };

interface LocalCliProvider {
  id: string;
  kind: "local_cli";
  vendor: "anthropic" | "openai" | "google" | string;
  command: "claude" | "codex" | "gemini" | string;
  commandPath?: string;
  auth: Extract<ProviderAuth, { type: "external_cli_session" }>;
  cwdPolicy: {
    type: "workspace_only" | "user_selected_dir";
    allowedDirs: string[];
  };
  invocation: {
    argsTemplate: string[];
    stdinMode: "none" | "prompt" | "context" | "prompt_and_context";
    stdoutParser: "raw" | "json" | "jsonl" | "ndjson";
    stderrPolicy: "progress_log" | "error_only" | "error_and_progress";
  };
  safety: {
    requireUserConsent: boolean;
    allowShellExecution: boolean;
    allowFileWrite: boolean;
    timeoutMs: number;
  };
}

interface TokenResolver {
  getAuthHeaders(providerId: string): Promise<Record<string, string>>;
  getSafeEnvironment(providerId: string): Promise<Record<string, string>>;
  refreshIfNeeded(providerId: string): Promise<void>;
}

interface CliRunner {
  run(request: InvocationRequest, provider: LocalCliProvider): AsyncIterable<NormalizedEvent>;
  cancel(taskId: string): Promise<void>;
}
```

### YAML provider catalog example

```yaml
providers:
- id: claude-api-wif
  kind: workload_identity_api
  vendor: anthropic
  model: claude-sonnet-latest
  auth:
    type: workload_identity
    provider: anthropic
    federationRuleId: fdrl_xxx
    serviceAccountId: svac_xxx
    workspaceId: wrkspc_xxx
  billingMode: provider_workspace
  policy:
    dataClass:
    - internal
    - confidential
    maxOutputTokens: 8192
- id: claude-code-local
  kind: local_cli
  vendor: anthropic
  command: claude
  auth:
    type: external_cli_session
    credentialAccess: never_read_tokens
  invocation:
    argsTemplate:
    - -p
    - '{{prompt}}'
    - --output-format
    - stream-json
    - --verbose
    - --include-partial-messages
    stdinMode: context
    stdoutParser: ndjson
    stderrPolicy: progress_log
  safety:
    requireUserConsent: true
    allowShellExecution: false
    allowFileWrite: false
    timeoutMs: 300000
- id: codex-local-jsonl
  kind: local_cli
  vendor: openai
  command: codex
  auth:
    type: external_cli_session
    credentialAccess: never_read_tokens
  invocation:
    argsTemplate:
    - exec
    - --json
    - '{{prompt}}'
    stdinMode: context
    stdoutParser: jsonl
    stderrPolicy: progress_log
  safety:
    requireUserConsent: true
    allowShellExecution: false
    allowFileWrite: false
    timeoutMs: 300000
- id: gemini-cli-local
  kind: local_cli
  vendor: google
  command: gemini
  auth:
    type: external_cli_session
    credentialAccess: never_read_tokens
  invocation:
    argsTemplate:
    - -p
    - '{{prompt}}'
    - --output-format
    - json
    stdinMode: context
    stdoutParser: json
    stderrPolicy: error_and_progress
  safety:
    requireUserConsent: true
    allowShellExecution: false
    allowFileWrite: false
    timeoutMs: 300000
  policyNotes:
  - Do not piggyback Gemini CLI OAuth as a backend credential. Use only user-owned
    local execution or official API key/Vertex path.
- id: vertex-gemini-cloud
  kind: cloud_iam
  vendor: google
  model: gemini-pro-or-latest-approved
  auth:
    type: cloud_iam
    provider: vertex_ai
    project: my-gcp-project
    location: us-central1
  billingMode: cloud_project
```

## 8. Implementation Blueprint

### Node.js Local Agent CLI runner example

```ts
import { spawn } from "node:child_process";

export async function runCliProvider(input: {
  command: string;
  args: string[];
  stdin?: string;
  cwd: string;
  timeoutMs: number;
  envAllowList?: Record<string, string>;
}): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      shell: false,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        USERPROFILE: process.env.USERPROFILE ?? "",
        ...input.envAllowList,
      },
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("CLI provider timed out"));
    }, input.timeoutMs);

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
      // emit NormalizedEvent: source=stdout
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
      // emit NormalizedEvent: source=stderr
    });

    child.on("error", err => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", exitCode => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode });
    });

    if (input.stdin) child.stdin.write(input.stdin);
    child.stdin.end();
  });
}
```

### Parser strategy

- `raw`: return stdout as text; store stderr as progress/error log

- `json`: parse stdout as single JSON document; fail if invalid unless fallbackRaw=true

- `jsonl/ndjson`: split stdout by lines; parse each non-empty line as JSON event; normalize to Aichestra event schema

- `pty`: strip ANSI; detect prompts; mark unstable; use only when no headless mode exists


### Prompt passing strategy
- Prefer stdin for large context and argv for short instruction.
- Use vendor command pattern where instruction and piped context semantics are documented.
- Never concatenate untrusted text into shell command strings; use argv array.
- Limit stdin size; store larger context in allowed workspace files and reference paths explicitly.

## 9. Security Model

### Trust boundaries

| Boundary | Risk | Control |
|---|---|---|

| Aichestra Cloud <-> Local Agent | remote command execution on user machine | mutual auth, user consent, scoped task tokens, signed updates, audit |

| Local Agent <-> CLI process | unwanted file/shell access | cwd allowlist, sandbox, CLI permission flags, timeout, no danger mode default |

| CLI process <-> Provider backend | credential leakage or policy violation | Provider-owned auth; Aichestra never reads token cache; use official modes |

| stdout/stderr <-> Aichestra logs | sensitive output storage | redaction, retention limits, opt-out log persistence |


### Credential handling rules
- Secrets live in secret manager, cloud IAM, or Provider CLI credential storage, not in ProviderAdapter config.
- Local Agent may inherit a minimal env allowlist; it must not dump env vars in logs.
- TokenResolver returns derived headers/env only, not raw long-lived secrets unless absolutely necessary and scoped.
- Provider credential files are treated as opaque and vendor-owned.

### Consent levels

| Level | Requires | Default |
|---|---|---|

| read_only | workspace read access approval | True |

| workspace_write | file modification approval or explicit workflow permission | False |

| shell_execution | command allowlist and per-command approval for risky commands | False |

| network_or_secret_access | explicit user/org policy approval | False |

| danger_full_access | isolated sandbox/CI runner and admin policy | False |


### Provider-specific policy notes

#### Gemini
- Aichestra may run Gemini CLI locally for the signed-in user in a user-owned context.
- Aichestra must not harvest or piggyback Gemini CLI OAuth credentials to access Google backend services as an API proxy.
- For third-party backend or multi-user agent use, prefer Gemini API key, Vertex AI, or another official Google-supported authentication path.

#### Codex
- Aichestra may run codex exec locally for the signed-in user when user consent and workspace boundaries are enforced.
- Aichestra must treat ~/.codex/auth.json as a password-equivalent credential and never read/upload it.
- For automated CI/CD or server-side workflows, prefer API key auth or official Codex automation path.

#### Claude
- Aichestra may run claude -p locally for user-owned workflows.
- Aichestra should prefer structured output flags for reliable parsing.
- For production API workloads, prefer Anthropic API key, WIF, or cloud provider identity rather than scraping CLI credentials.

## 10. Decision Rules

- IF Aichestra is pure web app with no local agent THEN local_cli_provider is not available; use API/OAuth/WIF/IAM only.

- IF User wants to use their own installed Claude Code/Codex/Gemini CLI THEN Install/use Aichestra Local Agent and local_cli_provider.

- IF CLI has official non-interactive/headless mode THEN Use it instead of PTY screen automation.

- IF CLI has JSON/JSONL/stream-json output THEN Enable machine-readable output and parse events.

- IF Provider prohibits OAuth piggybacking or terms are unclear THEN Do not use CLI OAuth as a backend credential; use official API key/Cloud IAM path.

- IF Workload is CI/CD or server-side automation THEN Prefer API key, WIF, or Cloud IAM over user interactive OAuth session.

- IF Task requires file writes or shell execution THEN Require explicit policy grant and user/org approval.

- IF Provider adapter cannot prove output parser correctness THEN Fail closed or return raw output with unstable flag; do not silently misparse.



## 11. Testing and Readiness

### unit_tests
- Auth union config validation rejects missing credentialAccess=never_read_tokens for local_cli.
- Args templating never invokes shell and escapes user text by argv boundaries.
- JSON/JSONL parsers reject malformed output with clear error.
- Secret redactor masks API keys, bearer tokens, paths configured as sensitive, and env dumps.

### integration_tests
- claude -p mock/real dry-run returns parseable JSON or stream-json events.
- codex exec mock/real dry-run captures stdout final message and stderr progress separately.
- codex exec --json parse test emits JSONL events and maps item/error lifecycle correctly.
- gemini -p --output-format json parse test returns JSON object and handles auth errors.
- timeout kills child process and cleans child process tree.
- workspace allowlist blocks cwd outside approved paths.

### security_tests
- Local Agent cannot read ~/.codex/auth.json or ~/.claude credentials through its normal adapter APIs.
- A malicious prompt cannot expand command args into shell execution.
- danger mode requires admin policy and explicit user approval.
- logs contain no raw bearer tokens, API keys, or OAuth caches.

### operational_checks
- Record CLI version at adapter startup.
- Maintain a compatibility matrix per CLI version.
- Expose fallback behavior when a CLI changes output format.
- Provide a user-facing disconnect/logout explanation without manipulating vendor credentials directly.

## 12. Migration Plan

### Phase 0 - Provider abstraction cleanup
- Introduce ProviderKind and ProviderAuth union
- Move secrets to CredentialManager
- Define InvocationRequest/InvocationResult

### Phase 1 - API/OAuth/WIF/IAM support
- Implement api_key provider
- Implement OAuth/WIF TokenResolver
- Implement cloud_iam provider adapters
- Add cost/rate attribution metadata

### Phase 2 - Local Agent and CLI Provider MVP
- Build Local Agent with signed communication
- Implement claude/codex/gemini adapters using headless commands
- Add stdout/stderr streaming and parsers
- Add cwd allowlist and timeout

### Phase 3 - Policy hardening
- Consent UI
- secret redaction
- sandbox/permission presets
- org policy templates
- audit dashboard

### Phase 4 - Enterprise rollout
- SSO/device management for Local Agent
- version compatibility matrix
- admin-managed provider catalog
- support for LLM gateway and cloud IAM routing

## 13. Open Questions
- Aichestra Local Agent를 Electron/Tauri 데스크톱 앱으로 배포할지, 별도 daemon/CLI로 배포할지 결정해야 한다.
- 각 Provider의 최신 약관과 enterprise 계약에서 로컬 CLI 자동화가 허용되는 범위를 법무/보안팀이 확인해야 한다.
- 사용자 로컬 작업 결과를 Aichestra Cloud에 어느 정도 저장할지 retention 정책을 정해야 한다.
- interactive PTY fallback을 제품 기능으로 공개할지, 내부 experimental로 제한할지 결정해야 한다.

## 14. Machine-readable Design Object

The following JSON object is a compact representation of the design. For full JSON, use the `.json` file.

```json
{
  "title": "Aichestra Closed Enterprise LLM Provider Integration Design (LLM-readable version)",
  "as_of": "2026-05-11",
  "provider_kinds": [
    "cloud_api",
    "oauth_api",
    "workload_identity_api",
    "cloud_iam",
    "local_cli",
    "pty_interactive_fallback"
  ],
  "critical_rules": [
    "Aichestra는 ~/.codex/auth.json, ~/.claude credential 파일, Google credential cache 등 Provider 소유 credential을 직접 읽지 않는다.",
    "Aichestra Cloud는 사용자의 로컬 CLI 토큰을 서버로 업로드하지 않는다.",
    "Gemini CLI OAuth 세션은 제3자 backend 접근 우회 수단으로 piggyback하지 않는다.",
    "Codex ChatGPT 로그인 세션은 사용자 로컬 신뢰 환경의 CLI 실행에만 사용하고, 자동화/CI/CD는 API key 또는 공식 권장 경로를 사용한다.",
    "Local CLI Provider는 사용자 컴퓨터에서 실행되는 Aichestra Local Agent가 필요하다."
  ],
  "preferred_modes_by_cli": {
    "claude": {
      "mode": "headless",
      "args": [
        "-p",
        "{{prompt}}",
        "--output-format",
        "json"
      ]
    },
    "claude_stream": {
      "mode": "streaming",
      "args": [
        "-p",
        "{{prompt}}",
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages"
      ]
    },
    "codex": {
      "mode": "headless",
      "args": [
        "exec",
        "{{prompt}}"
      ]
    },
    "codex_jsonl": {
      "mode": "streaming",
      "args": [
        "exec",
        "--json",
        "{{prompt}}"
      ]
    },
    "gemini": {
      "mode": "headless",
      "args": [
        "-p",
        "{{prompt}}",
        "--output-format",
        "json"
      ]
    }
  }
}
```

## 15. References

- [anthropic_claude_code_programmatic_usage] Claude Code Docs - Run Claude Code programmatically: https://code.claude.com/docs/en/headless

  - claude -p runs non-interactively

  - --output-format supports text/json/stream-json

  - stdin piping and JSON/streaming output are supported

  - --bare changes credential/config loading behavior

- [anthropic_claude_code_authentication] Claude Code Docs - Authentication: https://code.claude.com/docs/en/iam

  - Claude Code supports Claude.ai, Teams/Enterprise, Console, Bedrock, Vertex AI, and Microsoft Foundry authentication patterns

  - credential storage locations and precedence must be treated as provider-owned

- [anthropic_api_authentication_wif] Claude API Docs - Authentication and Workload Identity Federation: https://platform.claude.com/docs/en/manage-claude/authentication

  - Claude API supports API key and Workload Identity Federation

  - WIF exchanges an IdP-issued identity token at POST /v1/oauth/token for a short-lived access token

- [openai_codex_authentication] OpenAI Developers - Codex Authentication: https://developers.openai.com/codex/auth

  - Codex CLI/App/IDE can authenticate with ChatGPT or API key

  - API key usage is billed through OpenAI Platform at standard API rates

  - programmatic Codex CLI workflows are recommended to use API key auth

  - ~/.codex/auth.json contains access tokens and must be treated like a password

- [openai_codex_noninteractive] OpenAI Developers - Codex Non-interactive mode: https://developers.openai.com/codex/noninteractive

  - codex exec runs Codex from scripts and CI without opening the interactive TUI

  - progress is streamed to stderr and final agent message to stdout

  - --json produces JSON Lines event stream

  - stdin can be used as prompt or context

  - default sandbox is read-only and danger-full-access should be controlled

- [google_gemini_api_oauth] Google AI for Developers - Gemini API OAuth quickstart: https://ai.google.dev/gemini-api/docs/oauth

  - Gemini API can use API keys and OAuth where stricter access controls are needed

- [google_gemini_cli_authentication] Gemini CLI - Authentication: https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/authentication.mdx

  - Gemini CLI supports Sign in with Google, Gemini API key, and Vertex AI paths

  - headless mode recommends Gemini API key or Vertex AI

  - credentials are cached locally after Google sign-in

- [google_gemini_cli_configuration] Gemini CLI - Configuration: https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html

  - gemini --prompt / -p invokes non-interactive mode

  - --output-format json returns machine-readable JSON output

  - --sandbox enables sandbox mode

- [google_gemini_cli_faq_oauth_piggyback] Gemini CLI FAQ - third-party OAuth piggyback warning: https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/faq.md

  - third-party harvesting or piggybacking on Gemini CLI OAuth to access backend services is prohibited by Google policy

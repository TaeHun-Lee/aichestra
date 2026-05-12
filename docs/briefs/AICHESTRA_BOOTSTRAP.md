# Aichestra 프로젝트 초안 작성 지시문 for Codex

이 문서는 Codex에게 Aichestra 프로젝트의 초기 저장소 구조, 핵심 설계, MVP 범위, 구현 우선순위, 품질 기준을 지시하기 위한 단일 문서다.
Codex는 이 문서를 프로젝트의 최상위 지시문으로 간주하고, 빈 저장소 또는 초기 저장소에서 Aichestra의 실행 가능한 초안을 생성해야 한다.

---

## 0. Codex 작업 방식

너는 이 저장소의 초기 구현을 맡은 소프트웨어 아키텍트 겸 시니어 엔지니어다.

작업 목표는 완성된 제품을 한 번에 구현하는 것이 아니라, 다음을 만족하는 **명확하고 확장 가능한 MVP 골격**을 만드는 것이다.

1. 중앙집권형 LLM/AgentOps Control Plane의 핵심 도메인 모델을 정의한다.
2. 사용자, 모델 사용량, Git 작업, Skill, Harness, Instruction Artifact를 관리할 수 있는 구조를 만든다.
3. 실제 외부 연동은 mock 또는 adapter interface로 시작하되, 나중에 GitHub, LiteLLM, Temporal, Kubernetes, MCP Gateway로 확장하기 쉬운 구조를 만든다.
4. 실행 가능한 API, worker, web dashboard의 최소 버전을 만든다.
5. 모든 핵심 설계 의사결정을 문서화한다.

작업 중 반드시 지켜야 할 원칙:

- 기존 파일이 있으면 먼저 읽고, 의도를 파악한 뒤 최소 변경한다.
- 빈 저장소라면 아래 구조를 새로 만든다.
- 비밀키, 토큰, 실제 API key를 만들거나 저장하지 않는다.
- 외부 서비스 호출은 기본적으로 mock 처리한다.
- 실제 LLM 호출, GitHub write, production DB 접근은 환경변수가 명시적으로 설정된 경우에만 가능하게 한다.
- MVP에서는 복잡한 기능을 완성하려 하지 말고, interface, type, schema, state machine, mock implementation을 우선 만든다.
- 모든 새 기능에는 최소한의 테스트를 추가한다.
- README와 docs를 항상 코드와 함께 갱신한다.
- TypeScript 타입, zod schema, DB schema가 서로 어긋나지 않게 한다.
- 실행 가능한 상태를 우선시한다. `pnpm install`, `pnpm lint`, `pnpm test`가 통과해야 한다.

---

## 1. 프로젝트 이름과 한 줄 정의

프로젝트 이름: **Aichestra**

한 줄 정의:

> Aichestra는 조직 내 개발자와 AI coding agent가 사용하는 모델, API 키, 구독/사용량, Git 브랜치, PR, Skill, Harness, Instruction Artifact, MCP tool 접근을 중앙에서 정책화·관측·오케스트레이션하는 AgentOps Control Plane이다.

핵심 포지셔닝:

- AI coding tool 자체가 아니다.
- Codex, Claude Code, Copilot, Aider, Cursor 같은 도구를 대체하지 않는다.
- 여러 AI agent와 여러 개발자가 같은 코드베이스에서 협업할 때 필요한 중앙 운영 계층이다.
- 핵심 가치는 **비용 관리 + 브랜치/충돌 관리 + Skill/Harness/Instruction 표준화 + 실행 관측 + 정책 강제**다.

---

## 2. 문제 정의

AI를 사용한 업무에서 협업을 어렵게 만드는 문제가 있다.

### 2.1 모델 구독과 API 사용량의 파편화

사용자마다 사용하는 폐쇄형 모델, API key, 구독 플랜, 팀별 예산, provider 권한이 다르다.
그 결과 조직은 다음 질문에 답하기 어렵다.

- 누가 어떤 모델을 얼마나 사용했는가?
- 이 작업 또는 이 PR에 든 LLM 비용은 얼마인가?
- 특정 repo에서 어떤 모델이 가장 성공률이 높은가?
- 개인 API key와 조직 API key가 혼재될 때 보안과 비용을 어떻게 관리할 것인가?

### 2.2 동일 코드베이스에 대한 병렬 AI 작업 충돌

여러 사용자가 같은 repo에서 동시에 AI agent에게 작업을 시키면 다음 문제가 생긴다.

- 여러 agent가 같은 파일이나 같은 symbol을 수정한다.
- PR merge conflict가 늘어난다.
- 테스트는 각각 통과했지만 함께 merge하면 깨진다.
- 작업 순서, merge queue, rebase, conflict resolution을 누가 관리해야 하는지 불분명하다.

### 2.3 Skill, Harness, Instruction의 불일치

사용자마다 AI에게 주는 지시문, Skill, 실행 환경, MCP tool, 테스트 명령, sandbox 권한이 다르다.

- 어떤 사용자는 `CLAUDE.md`를 쓴다.
- 어떤 사용자는 `AGENTS.md`를 쓴다.
- 어떤 사용자는 개인 prompt를 쓴다.
- 어떤 agent는 다른 MCP server를 쓴다.
- 어떤 runner는 다른 Node/Python 버전을 쓴다.

결과적으로 같은 작업도 사람마다 결과가 다르고, 실패 원인을 추적하기 어렵다.

---

## 3. 제품 목표

Aichestra의 목표는 다음 세 가지를 중앙에서 해결하는 것이다.

### 3.1 모델·구독·API 사용량 중앙관리

- 사용자별 provider account 관리
- 조직 API key와 사용자 BYOK 관리
- virtual key 발급
- 모델 allowlist/blocklist
- 사용자/팀/repo/task별 예산 관리
- 모든 LLM call에 `task_id`, `repo_id`, `branch`, `skill_version`, `harness_version`를 태깅
- 비용, token, latency, success rate를 usage ledger에 기록

### 3.2 Git branch와 AI PR 충돌 관리

- 모든 AI 작업은 별도 branch와 worktree에서 실행
- 작업 시작 전 수정 예상 파일/symbol에 대한 intent lease 생성
- 활성 작업 간 conflict risk 계산
- dry-run merge와 test simulation 수행
- PR 생성, CI 추적, conflict detection
- 자동 rebase 또는 conflict resolver agent 실행
- 위험도가 높은 변경은 human review로 escalation

### 3.3 Skill, Harness, Instruction 중앙관리와 자동 개선

- Skill Registry: 작업별 재사용 workflow 관리
- Harness Registry: agent 실행 환경 관리
- Instruction Registry: `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, project rules, org baseline prompt 관리
- Prompt Assembly Engine: agent/model/task에 맞는 instruction set 조립
- Trace/Eval 기반으로 실패 패턴을 수집하고 Skill/Harness 개선안 제안
- 자동 개선안은 eval, canary, approval을 거친 뒤 배포

---

## 4. MVP 범위

초기 버전은 “실제 운영 가능한 최소 골격”을 목표로 한다.

### 4.1 반드시 구현할 것

1. TypeScript monorepo 생성
2. API 서버
3. Worker
4. Web dashboard
5. Postgres schema 또는 ORM schema
6. 핵심 domain model
7. Task state machine
8. Mock LLM Gateway
9. Mock Git Provider adapter
10. Skill Registry v0
11. Harness Registry v0
12. Instruction Registry v0
13. Usage Ledger v0
14. Audit Log v0
15. 문서화

### 4.2 MVP에서 mock으로 둘 것

- 실제 LLM provider 호출
- 실제 GitHub App write
- 실제 Kubernetes Job 생성
- 실제 MCP Gateway
- 실제 conflict resolver agent
- 실제 Temporal cluster
- 실제 SSO/SCIM

### 4.3 MVP에서 제외할 것

- 완전한 enterprise RBAC
- production-ready billing
- 실제 OAuth token delegation
- 실제 multi-cloud deployment
- 고급 graph visualization
- 자동 Skill 개선의 완전 구현
- 실제 Firecracker sandbox
- 실제 MCP server marketplace

---

## 5. 추천 기술 스택

MVP는 빠른 구현과 타입 일관성을 위해 TypeScript monorepo로 시작한다.

### 5.1 기본 스택

- Package manager: `pnpm`
- Monorepo: `pnpm workspaces`
- Language: TypeScript
- API: NestJS 또는 Fastify
- Web: Next.js
- DB: Postgres
- ORM: Prisma 또는 Drizzle
- Validation: zod
- Worker: Node.js worker process
- Workflow: MVP에서는 자체 state machine, 추후 Temporal adapter
- Test: Vitest
- Lint/format: ESLint + Prettier
- Container: Docker Compose
- Observability: structured logs 우선, 추후 OpenTelemetry

### 5.2 장기 확장 스택

- Workflow Engine: Temporal
- Runtime: Kubernetes Jobs
- Strong sandbox: Firecracker
- Event Bus: NATS 또는 Kafka
- LLM Gateway: LiteLLM 또는 자체 OpenAI-compatible proxy
- Policy: OPA/Rego 또는 Cedar
- Secrets: Vault 또는 cloud secret manager
- Artifact Registry: OCI registry
- Git Provider: GitHub App, 이후 GitLab/Bitbucket
- Trace/Eval: Langfuse류 또는 자체 trace store

---

## 6. 목표 아키텍처

```text
User / Admin
  ↓
Web Console / CLI / IDE Plugin / Slack
  ↓
Aichestra Backend API
  ├─ Auth / RBAC
  ├─ Policy Engine
  ├─ Task Orchestrator
  ├─ Model Router
  ├─ Git / Branch / PR Manager
  ├─ Skill Registry
  ├─ Harness Registry
  ├─ Instruction Registry
  ├─ MCP Gateway Adapter
  └─ Usage / Audit / Trace
  ↓
Worker / Workflow Engine
  ↓
Agent Runner
  ├─ LLM Gateway
  ├─ Git Provider
  ├─ MCP Gateway
  ├─ Skill Loader
  ├─ Harness Loader
  └─ Instruction Resolver
  ↓
External Systems
  ├─ OpenAI / Anthropic / Gemini / Bedrock
  ├─ GitHub / GitLab / Bitbucket
  ├─ CI System
  ├─ MCP Servers
  └─ Secret Manager
```

MVP에서는 external systems를 mock adapter로 대체한다.

---

## 7. 핵심 개념 정의

### 7.1 Task

사용자가 AI에게 맡긴 하나의 작업이다.

예:

- “로그인 타임아웃 버그 수정”
- “Jest 실패 원인 분석 후 수정”
- “payments service의 session store 리팩터링”
- “PR conflict 해결”

필드 예시:

```ts
type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  requesterUserId: string;
  repoId: string;
  baseBranch: string;
  branchName?: string;
  selectedAgent?: AgentKind;
  selectedModel?: string;
  selectedSkillIds: string[];
  selectedHarnessId?: string;
  instructionSetId?: string;
  budgetLimitUsd?: number;
  conflictRiskScore?: number;
  createdAt: Date;
  updatedAt: Date;
};
```

### 7.2 TaskRun

Task의 실제 실행 단위다.
하나의 Task는 여러 번 재시도될 수 있으므로 Task와 TaskRun을 분리한다.

```ts
type TaskRun = {
  id: string;
  taskId: string;
  attempt: number;
  status: TaskRunStatus;
  agent: AgentKind;
  model: string;
  harnessVersion: string;
  startedAt?: Date;
  finishedAt?: Date;
  resultSummary?: string;
  errorMessage?: string;
};
```

### 7.3 ProviderAccount

사용자 또는 조직이 연결한 LLM provider 계정이다.

```ts
type ProviderAccount = {
  id: string;
  ownerType: "user" | "team" | "organization";
  ownerId: string;
  provider: "openai" | "anthropic" | "google" | "aws_bedrock" | "azure_openai" | "local";
  authMode: "org_api_key" | "user_byok" | "delegated_oauth" | "local_session";
  displayName: string;
  status: "active" | "disabled" | "expired";
};
```

### 7.4 VirtualKey

LLM Gateway에 노출되는 내부 가상 키다.

```ts
type VirtualKey = {
  id: string;
  providerAccountId: string;
  ownerUserId?: string;
  ownerTeamId?: string;
  allowedModels: string[];
  monthlyBudgetUsd?: number;
  perTaskBudgetUsd?: number;
  rpmLimit?: number;
  tpmLimit?: number;
  status: "active" | "revoked";
};
```

### 7.5 Repo

연결된 코드 저장소다.

```ts
type Repo = {
  id: string;
  provider: "github" | "gitlab" | "bitbucket" | "local";
  owner: string;
  name: string;
  defaultBranch: string;
  remoteUrl?: string;
  status: "active" | "disabled";
};
```

### 7.6 BranchLease

AI 작업이 수정할 것으로 예상되는 영역이다.

```ts
type BranchLease = {
  id: string;
  taskId: string;
  repoId: string;
  branchName: string;
  baseBranch: string;
  files: string[];
  symbols: string[];
  tests: string[];
  riskLevel: "low" | "medium" | "high";
  expiresAt?: Date;
};
```

### 7.7 SkillPackage

특정 작업을 수행하기 위한 재사용 가능한 workflow다.

```ts
type SkillPackage = {
  id: string;
  name: string;
  version: string;
  description: string;
  compatibleAgents: AgentKind[];
  requiredTools: string[];
  requiredHarnessKinds: string[];
  instructionPath: string;
  evalStatus: "unknown" | "passed" | "failed";
  approvalStatus: "draft" | "approved" | "deprecated";
};
```

### 7.8 HarnessPackage

Agent가 실행되는 환경과 권한을 정의한다.

```ts
type HarnessPackage = {
  id: string;
  name: string;
  version: string;
  runtimeKind: "docker" | "kubernetes" | "firecracker" | "local";
  image?: string;
  allowedTools: string[];
  allowedMcpServers: string[];
  secretScopes: string[];
  networkMode: "disabled" | "allowlist" | "unrestricted";
  testCommands: string[];
  approvalStatus: "draft" | "approved" | "deprecated";
};
```

### 7.9 InstructionArtifact

Codex의 `AGENTS.md`, Claude의 `CLAUDE.md`, Cursor rules, 조직 baseline prompt 등 지속 지시문을 나타낸다.

```ts
type InstructionArtifact = {
  id: string;
  name: string;
  type:
    | "agents_md"
    | "claude_md"
    | "agent_md"
    | "cursor_rules"
    | "org_baseline"
    | "team_baseline"
    | "repo_rule"
    | "directory_rule"
    | "user_preference"
    | "custom";
  scope: "organization" | "team" | "repo" | "directory" | "user" | "task";
  path?: string;
  contentHash: string;
  version: string;
  ownerId?: string;
  allowedAgents: AgentKind[];
  precedence: number;
  approvalStatus: "draft" | "approved" | "deprecated";
};
```

### 7.10 InstructionSet

특정 TaskRun에 실제로 주입된 instruction들의 조합이다.

```ts
type InstructionSet = {
  id: string;
  taskRunId: string;
  artifacts: {
    artifactId: string;
    version: string;
    contentHash: string;
    source: string;
  }[];
  assembledHash: string;
  maxContextBytes: number;
};
```

### 7.11 UsageEvent

LLM 호출, MCP tool call, runner 실행 비용을 기록한다.

```ts
type UsageEvent = {
  id: string;
  taskId?: string;
  taskRunId?: string;
  userId: string;
  repoId?: string;
  provider: string;
  model?: string;
  eventType: "llm_call" | "mcp_tool_call" | "runner_runtime" | "ci_runtime";
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  latencyMs?: number;
  skillVersion?: string;
  harnessVersion?: string;
  createdAt: Date;
};
```

### 7.12 AuditLog

보안과 감사 목적의 기록이다.

```ts
type AuditLog = {
  id: string;
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId: string;
  taskId?: string;
  repoId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};
```

---

## 8. Task 상태 기계

MVP에서는 Task status를 명확히 정의한다.

```ts
type TaskStatus =
  | "draft"
  | "planned"
  | "policy_blocked"
  | "queued"
  | "branch_created"
  | "running"
  | "testing"
  | "pr_draft_ready"
  | "pr_opened"
  | "ci_pending"
  | "ci_failed"
  | "conflict_detected"
  | "conflict_fixing"
  | "review_required"
  | "merge_ready"
  | "merged"
  | "failed"
  | "cancelled";
```

기본 workflow:

```text
draft
  → planned
  → queued
  → branch_created
  → running
  → testing
  → pr_draft_ready
  → pr_opened
  → ci_pending
  → merge_ready
  → merged
```

실패/분기:

```text
planned → policy_blocked
testing → failed
ci_pending → ci_failed
pr_opened → conflict_detected
conflict_detected → conflict_fixing
conflict_fixing → review_required
review_required → merge_ready
```

---

## 9. Repository 구조

빈 저장소라면 다음 구조를 만든다.

```text
.
├─ AGENTS.md
├─ README.md
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ docker-compose.yml
├─ .env.example
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ modules/
│  │  │  │  ├─ tasks/
│  │  │  │  ├─ repos/
│  │  │  │  ├─ providers/
│  │  │  │  ├─ usage/
│  │  │  │  ├─ skills/
│  │  │  │  ├─ harnesses/
│  │  │  │  ├─ instructions/
│  │  │  │  └─ audit/
│  │  │  └─ health/
│  │  └─ package.json
│  ├─ worker/
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ workflows/
│  │  │  └─ activities/
│  │  └─ package.json
│  ├─ web/
│  │  ├─ app/
│  │  ├─ components/
│  │  ├─ lib/
│  │  └─ package.json
│  └─ runner/
│     ├─ src/
│     │  ├─ main.ts
│     │  ├─ agents/
│     │  ├─ git/
│     │  ├─ llm/
│     │  └─ instructions/
│     └─ package.json
├─ packages/
│  ├─ core/
│  │  ├─ src/
│  │  │  ├─ domain/
│  │  │  ├─ events/
│  │  │  ├─ schemas/
│  │  │  └─ index.ts
│  │  └─ package.json
│  ├─ db/
│  │  ├─ prisma/
│  │  │  └─ schema.prisma
│  │  ├─ src/
│  │  └─ package.json
│  ├─ adapters/
│  │  ├─ src/
│  │  │  ├─ git/
│  │  │  ├─ llm/
│  │  │  ├─ policy/
│  │  │  ├─ mcp/
│  │  │  └─ secrets/
│  │  └─ package.json
│  └─ testing/
│     ├─ src/
│     └─ package.json
├─ docs/
│  ├─ architecture.md
│  ├─ mvp-scope.md
│  ├─ domain-model.md
│  ├─ task-state-machine.md
│  ├─ security-model.md
│  ├─ instruction-layer.md
│  ├─ skill-registry.md
│  ├─ harness-registry.md
│  └─ adr/
│     ├─ 0001-typescript-monorepo.md
│     ├─ 0002-mock-first-adapters.md
│     └─ 0003-instruction-layer-separation.md
└─ tests/
   └─ fixtures/
```

---

## 10. 최상위 AGENTS.md 생성 지침

저장소 루트에 `AGENTS.md`를 만든다. 내용은 간결하게 유지한다.

필수 포함 내용:

```markdown
# AGENTS.md

## Project

This repository contains Aichestra, an AgentOps control plane for coordinating LLM usage, AI coding agents, Git branches, PRs, skills, harnesses, and persistent instruction artifacts.

## Working agreements

- Prefer small, typed, testable changes.
- Do not introduce real external API calls by default.
- Use mock adapters unless an environment variable explicitly enables a real provider.
- Never create or store secrets in the repository.
- Keep domain types in `packages/core`.
- Keep external integrations behind adapter interfaces in `packages/adapters`.
- Keep docs updated when changing architecture or domain models.
- Run lint and tests before finishing a task.

## MVP focus

The MVP should provide:
- Task creation and state tracking.
- Mock Git branch/PR management.
- Mock LLM usage tracking.
- Skill, Harness, and Instruction registries.
- Usage ledger and audit log.
- Minimal web dashboard.

## Commands

- Install: `pnpm install`
- Lint: `pnpm lint`
- Test: `pnpm test`
- Dev API: `pnpm --filter @aichestra/api dev`
- Dev worker: `pnpm --filter @aichestra/worker dev`
- Dev web: `pnpm --filter @aichestra/web dev`

## Architecture rules

- Task execution must go through the Task Orchestrator.
- Model calls must go through the LLM Gateway interface.
- Tool calls must go through MCP Gateway interfaces.
- Git writes must go through the Git Provider interface.
- Instruction files such as AGENTS.md and CLAUDE.md are Instruction Artifacts, not Harnesses.
- Harnesses define runtime, permissions, tools, secrets, network, and instruction loading behavior.
```

---

## 11. API 설계

MVP API는 REST로 시작한다. OpenAPI 문서를 나중에 추가할 수 있게 route를 명확히 만든다.

### 11.1 Health

```text
GET /health
```

응답:

```json
{
  "status": "ok",
  "service": "aichestra-api"
}
```

### 11.2 Tasks

```text
POST /tasks
GET /tasks
GET /tasks/:id
POST /tasks/:id/plan
POST /tasks/:id/start
POST /tasks/:id/cancel
```

`POST /tasks` body:

```json
{
  "title": "Fix login timeout bug",
  "description": "Investigate and fix intermittent login timeout.",
  "repoId": "repo_123",
  "baseBranch": "main",
  "selectedAgent": "codex",
  "selectedModel": "mock-model",
  "selectedSkillIds": ["skill_auth_debugging"],
  "selectedHarnessId": "harness_backend_node20",
  "budgetLimitUsd": 20
}
```

### 11.3 Repos

```text
POST /repos
GET /repos
GET /repos/:id
GET /repos/:id/branches
GET /repos/:id/conflict-risks
```

### 11.4 Providers and Virtual Keys

```text
POST /provider-accounts
GET /provider-accounts
POST /virtual-keys
GET /virtual-keys
PATCH /virtual-keys/:id/revoke
```

### 11.5 Skills

```text
POST /skills
GET /skills
GET /skills/:id
PATCH /skills/:id/approve
PATCH /skills/:id/deprecate
```

### 11.6 Harnesses

```text
POST /harnesses
GET /harnesses
GET /harnesses/:id
PATCH /harnesses/:id/approve
PATCH /harnesses/:id/deprecate
```

### 11.7 Instructions

```text
POST /instructions
GET /instructions
GET /instructions/:id
POST /instruction-sets/resolve
```

### 11.8 Usage and Audit

```text
GET /usage/events
GET /usage/summary
GET /audit-logs
```

---

## 12. Adapter Interface 설계

실제 외부 연동은 모두 adapter interface 뒤에 둔다.

### 12.1 LLM Gateway

```ts
export interface LlmGateway {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  estimateCost(request: LlmCompletionRequest): Promise<CostEstimate>;
}

export type LlmCompletionRequest = {
  taskId?: string;
  taskRunId?: string;
  userId: string;
  provider: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  metadata: Record<string, string>;
};

export type LlmCompletionResponse = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
};
```

MVP 구현:

- `MockLlmGateway`
- 입력 metadata를 검증한다.
- 고정 응답을 반환한다.
- UsageEvent를 생성할 수 있게 결과를 반환한다.

### 12.2 Git Provider

```ts
export interface GitProvider {
  createBranch(input: CreateBranchInput): Promise<CreateBranchResult>;
  createPullRequest(input: CreatePullRequestInput): Promise<CreatePullRequestResult>;
  getPullRequest(input: GetPullRequestInput): Promise<PullRequestSnapshot>;
  simulateMerge(input: SimulateMergeInput): Promise<MergeSimulationResult>;
}
```

MVP 구현:

- `MockGitProvider`
- branch name을 생성하고 상태를 저장한다.
- PR 생성은 mock URL을 반환한다.
- merge simulation은 파일 overlap 기반으로 mock conflict를 반환한다.

### 12.3 Policy Engine

```ts
export interface PolicyEngine {
  authorize(input: PolicyDecisionInput): Promise<PolicyDecision>;
}

export type PolicyDecision = {
  allowed: boolean;
  reason?: string;
  requiredApprovals?: string[];
};
```

MVP 구현:

- `AllowAllPolicyEngine`
- 단, 위험한 scope 예시는 block할 수 있게 fixture policy를 둔다.

### 12.4 MCP Gateway

```ts
export interface McpGateway {
  callTool(input: McpToolCallInput): Promise<McpToolCallResult>;
}
```

MVP 구현:

- `MockMcpGateway`
- tool call을 audit log로 남길 수 있는 shape만 만든다.

### 12.5 Secrets Broker

```ts
export interface SecretsBroker {
  getScopedSecret(input: ScopedSecretRequest): Promise<ScopedSecret>;
}
```

MVP 구현:

- 실제 secret을 반환하지 않는다.
- mock token string만 반환한다.
- `.env.example`에 필요한 env var 이름만 둔다.

---

## 13. Worker / Workflow 설계

MVP worker는 Temporal 없이 자체 state machine으로 구현한다.
하지만 나중에 Temporal로 옮기기 쉽게 `Workflow`와 `Activity` 개념을 분리한다.

### 13.1 RunAgentTaskWorkflow

```text
RunAgentTaskWorkflow(taskId)
  1. Load task
  2. Check policy
  3. Resolve skill set
  4. Resolve harness
  5. Resolve instruction set
  6. Create branch lease
  7. Create branch through GitProvider
  8. Start mock runner
  9. Record mock LLM usage
  10. Run mock tests
  11. Create PR draft
  12. Simulate merge
  13. Update task status
```

### 13.2 상태별 기록

각 단계는 다음을 남긴다.

- Task status update
- AuditLog
- UsageEvent, 필요한 경우
- structured log
- error message

### 13.3 실패 처리

- policy 실패: `policy_blocked`
- branch 생성 실패: `failed`
- runner 실패: `failed`
- test 실패: `ci_failed` 또는 `failed`
- merge conflict: `conflict_detected`
- human review 필요: `review_required`

---

## 14. Web Dashboard MVP

Next.js 앱은 최소한 다음 화면을 제공한다.

### 14.1 Dashboard

- 총 task 수
- running task 수
- conflict_detected task 수
- 이번 달 mock cost
- 최근 task 목록

### 14.2 Tasks

- Task list
- Task detail
- status timeline
- selected model/agent/skill/harness
- branch name
- PR URL
- usage summary

### 14.3 Registries

- Skills list
- Harnesses list
- Instructions list

MVP에서는 디자인보다 구조가 중요하다.
간단한 table과 detail page로 충분하다.

---

## 15. DB Schema 초안

Prisma를 사용한다면 `packages/db/prisma/schema.prisma`에 다음 모델을 만든다.
정확한 문법은 구현 시 조정해도 되지만, 아래 엔티티는 반드시 포함한다.

```prisma
model User {
  id        String   @id
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Team {
  id        String   @id
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ProviderAccount {
  id          String   @id
  ownerType   String
  ownerId     String
  provider    String
  authMode    String
  displayName String
  status      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model VirtualKey {
  id                String   @id
  providerAccountId String
  allowedModels     Json
  monthlyBudgetUsd  Float?
  perTaskBudgetUsd  Float?
  rpmLimit          Int?
  tpmLimit          Int?
  status            String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model Repo {
  id            String   @id
  provider      String
  owner         String
  name          String
  defaultBranch String
  remoteUrl     String?
  status        String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Task {
  id                String   @id
  title             String
  description       String?
  status            String
  requesterUserId   String
  repoId            String
  baseBranch        String
  branchName        String?
  selectedAgent     String?
  selectedModel     String?
  selectedSkillIds  Json
  selectedHarnessId String?
  instructionSetId  String?
  budgetLimitUsd    Float?
  conflictRiskScore Float?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model TaskRun {
  id             String   @id
  taskId          String
  attempt         Int
  status          String
  agent           String
  model           String
  harnessVersion  String?
  startedAt       DateTime?
  finishedAt      DateTime?
  resultSummary   String?
  errorMessage    String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model BranchLease {
  id         String   @id
  taskId     String
  repoId     String
  branchName String
  baseBranch String
  files      Json
  symbols    Json
  tests      Json
  riskLevel  String
  expiresAt  DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model PullRequest {
  id          String   @id
  taskId      String
  repoId      String
  provider    String
  externalId  String?
  url         String?
  status      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model SkillPackage {
  id                String   @id
  name              String
  version           String
  description       String
  compatibleAgents  Json
  requiredTools     Json
  requiredHarnesses Json
  instructionPath   String?
  evalStatus        String
  approvalStatus    String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model HarnessPackage {
  id                String   @id
  name              String
  version           String
  runtimeKind       String
  image             String?
  allowedTools      Json
  allowedMcpServers Json
  secretScopes      Json
  networkMode       String
  testCommands      Json
  approvalStatus    String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model InstructionArtifact {
  id             String   @id
  name           String
  type           String
  scope          String
  path           String?
  contentHash    String
  version        String
  ownerId        String?
  allowedAgents  Json
  precedence     Int
  approvalStatus String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model InstructionSet {
  id              String   @id
  taskRunId        String
  artifacts         Json
  assembledHash     String
  maxContextBytes   Int
  createdAt         DateTime @default(now())
}

model UsageEvent {
  id             String   @id
  taskId          String?
  taskRunId       String?
  userId          String
  repoId          String?
  provider        String
  model           String?
  eventType       String
  inputTokens     Int?
  outputTokens    Int?
  costUsd         Float?
  latencyMs       Int?
  skillVersion    String?
  harnessVersion  String?
  createdAt       DateTime @default(now())
}

model AuditLog {
  id          String   @id
  actorUserId String?
  action      String
  targetType  String
  targetId    String
  taskId      String?
  repoId      String?
  metadata    Json
  createdAt   DateTime @default(now())
}
```

---

## 16. Instruction Layer 설계

`CLAUDE.md`, `AGENTS.md`, `AGENT.md`, `.cursorrules`, project rules, org baseline prompt는 Harness 자체가 아니라 **Instruction Artifact**다.

Harness는 다음을 정의한다.

- 어떤 instruction source를 로드할지
- agent별로 어떤 파일명을 인식할지
- 어떤 우선순위로 조립할지
- context byte limit을 어떻게 적용할지
- 충돌이 있을 때 warning 또는 block할지

Prompt Assembly Engine은 다음을 수행한다.

```text
Task
  ↓
repo, directory, agent, model 확인
  ↓
적용 가능한 InstructionArtifact 수집
  ↓
org → team → repo → directory → user → skill → task 순서로 조립
  ↓
policy 위반 검사
  ↓
context budget 검사
  ↓
assembled instruction set hash 생성
  ↓
TaskRun에 기록
```

권장 authority 순서:

```text
1. Platform policy
2. Organization instruction
3. Team instruction
4. Harness instruction-loading rule
5. Repository instruction
6. Directory instruction
7. User preference
8. Skill instruction
9. Task prompt
```

중요:

- 보안·권한·배포 제한은 instruction만으로 강제하지 않는다.
- 그런 규칙은 Policy Engine, Sandbox, MCP Gateway, Git Manager에서 실제로 강제한다.
- instruction은 agent 행동을 유도하지만, 강제 집행 계층이 아니다.

---

## 17. Skill Registry 설계

Skill은 특정 작업을 위한 재사용 workflow다.

예시 Skill 구조:

```text
.agents/
└─ skills/
   └─ jest-test-fixer/
      ├─ SKILL.md
      ├─ references/
      ├─ scripts/
      └─ assets/
```

예시 `SKILL.md`:

```markdown
---
name: jest-test-fixer
description: Use this skill when a Jest test is failing and the task is to diagnose and fix the test or production code with minimal changes.
---

# Jest Test Fixer

## Workflow

1. Read the failing test output.
2. Identify whether the failure is caused by production code, test setup, or outdated expectation.
3. Inspect the smallest relevant source files.
4. Make minimal changes.
5. Run the targeted test.
6. If successful, run the related test suite.
7. Summarize the cause and the fix.
```

Aichestra의 Skill Registry는 이 Skill을 다음 metadata와 함께 관리한다.

- name
- version
- description
- compatibleAgents
- requiredTools
- requiredHarnesses
- evalStatus
- approvalStatus
- instructionPath

---

## 18. Harness Registry 설계

Harness는 agent 실행 환경을 정의한다.

예시:

```yaml
apiVersion: aichestra.dev/v1
kind: Harness
metadata:
  name: backend-node20
  version: 0.1.0
spec:
  runtime:
    type: docker
    image: node:20
  tools:
    cli:
      - git
      - node
      - pnpm
      - ripgrep
    agents:
      - codex
      - claude-code
      - aider
  instructionLoading:
    enabled: true
    maxCombinedInstructionBytes: 65536
    sources:
      - org
      - repo
      - directory
      - skill
      - task
  tests:
    smoke:
      - pnpm lint
      - pnpm test
  network:
    mode: allowlist
    allow:
      - github.com
      - registry.npmjs.org
  secrets:
    scopes:
      - github_pr_write
      - package_registry_read
  policies:
    maxRuntimeMinutes: 45
    requireApprovalFor:
      - ".github/workflows/**"
      - "infra/**"
```

MVP에서는 YAML parser까지 완성하지 않아도 된다.
대신 HarnessPackage DB 모델과 zod schema를 만들고, fixture harness를 seed한다.

---

## 19. Git / Branch / Conflict Manager 설계

모든 AI 작업 branch는 다음 규칙을 따른다.

```text
ai/{taskId}/{agent}/{slug}
```

예:

```text
ai/task_123/codex/fix-login-timeout
```

Conflict risk 계산 MVP:

```ts
risk = weightedScore({
  fileOverlap,
  symbolOverlap,
  testOverlap,
  diffSize,
  schemaOrInfraTouched,
  dryRunMergeConflict
});
```

MVP에서는 mock 방식으로 다음을 구현한다.

- 같은 파일을 lease한 활성 task가 있으면 risk 상승
- `infra/**`, `.github/workflows/**`, `schema/**`는 high risk
- high risk면 `review_required`
- mock merge simulation이 conflict를 반환하면 `conflict_detected`

---

## 20. Usage Ledger 설계

모든 LLM 호출과 runner 실행은 UsageEvent로 기록한다.

LLM call metadata에는 반드시 다음이 포함되어야 한다.

```json
{
  "task_id": "task_123",
  "task_run_id": "run_456",
  "repo_id": "repo_789",
  "branch": "ai/task_123/codex/fix-login-timeout",
  "agent": "codex",
  "model": "mock-model",
  "skill_versions": "auth-debugging@0.1.0",
  "harness_version": "backend-node20@0.1.0",
  "instruction_set_hash": "sha256:..."
}
```

이 데이터를 통해 나중에 다음 질문에 답할 수 있어야 한다.

- 어떤 모델이 merge 성공률이 높은가?
- 어떤 Skill이 비용 대비 효과가 좋은가?
- 어떤 Harness에서 실패가 많이 나는가?
- 어떤 repo에서 AI 작업 충돌이 많이 나는가?

---

## 21. Security Model MVP

MVP에서도 다음 원칙을 코드와 문서에 반영한다.

1. 실제 secret은 저장하지 않는다.
2. `.env.example`만 제공한다.
3. 외부 provider 호출은 기본 비활성화한다.
4. 모든 외부 연동은 adapter interface 뒤에 둔다.
5. Git write, MCP tool call, LLM call은 audit 대상이다.
6. instruction은 강제 보안 계층이 아니다.
7. policy engine 결과가 block이면 workflow는 실행되지 않는다.
8. dangerous paths를 수정하는 작업은 human review 상태로 보낸다.

Dangerous path 예시:

```text
.github/workflows/**
infra/**
terraform/**
schema/**
migrations/**
auth/**
payments/**
```

---

## 22. Seed Data

초기 seed data를 제공한다.

### 22.1 Users

```json
[
  {
    "id": "user_demo_admin",
    "email": "admin@example.com",
    "name": "Demo Admin"
  }
]
```

### 22.2 Repo

```json
[
  {
    "id": "repo_demo_backend",
    "provider": "local",
    "owner": "demo",
    "name": "backend",
    "defaultBranch": "main",
    "status": "active"
  }
]
```

### 22.3 Skill

```json
[
  {
    "id": "skill_auth_debugging",
    "name": "auth-debugging",
    "version": "0.1.0",
    "description": "Diagnose authentication and session-related bugs with minimal changes.",
    "compatibleAgents": ["codex", "claude-code", "aider"],
    "requiredTools": ["git", "ripgrep"],
    "requiredHarnesses": ["backend-node20"],
    "evalStatus": "unknown",
    "approvalStatus": "approved"
  }
]
```

### 22.4 Harness

```json
[
  {
    "id": "harness_backend_node20",
    "name": "backend-node20",
    "version": "0.1.0",
    "runtimeKind": "docker",
    "image": "node:20",
    "allowedTools": ["git", "node", "pnpm", "ripgrep"],
    "allowedMcpServers": [],
    "secretScopes": ["github_pr_write"],
    "networkMode": "allowlist",
    "testCommands": ["pnpm lint", "pnpm test"],
    "approvalStatus": "approved"
  }
]
```

### 22.5 Instruction Artifact

```json
[
  {
    "id": "instr_org_baseline",
    "name": "org-secure-coding-baseline",
    "type": "org_baseline",
    "scope": "organization",
    "contentHash": "sha256:demo",
    "version": "0.1.0",
    "allowedAgents": ["codex", "claude-code", "aider"],
    "precedence": 10,
    "approvalStatus": "approved"
  }
]
```

---

## 23. 첫 번째 구현 순서

Codex는 다음 순서로 작업하라.

### Step 1. 저장소 상태 확인

- 현재 디렉터리의 파일 목록을 확인한다.
- 기존 package manager, framework, README가 있는지 확인한다.
- 비어 있지 않다면 기존 구조를 존중한다.

### Step 2. Monorepo 기본 구조 생성

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.env.example`
- `README.md`
- `AGENTS.md`
- `docs/` 기본 문서
- `apps/`와 `packages/` 생성

### Step 3. Core domain types 생성

`packages/core`에 다음을 만든다.

- domain types
- zod schemas
- task status constants
- domain events
- shared errors
- ID helper

### Step 4. DB schema 생성

`packages/db`에 Prisma schema 또는 선택한 ORM schema를 만든다.

- 위 DB 모델 반영
- seed script 추가
- mock/dev DB를 위한 docker-compose 추가

### Step 5. Adapter interfaces 생성

`packages/adapters`에 interface와 mock 구현을 만든다.

- `LlmGateway`
- `GitProvider`
- `PolicyEngine`
- `McpGateway`
- `SecretsBroker`

### Step 6. API 서버 생성

`apps/api`에 최소 API를 만든다.

- `/health`
- `/tasks`
- `/repos`
- `/skills`
- `/harnesses`
- `/instructions`
- `/usage/events`
- `/audit-logs`

MVP에서는 DB 연동이 준비되지 않았으면 in-memory repository를 사용해도 된다.
하지만 DB repository interface를 분리해 나중에 교체 가능하게 한다.

### Step 7. Worker 생성

`apps/worker`에 `RunAgentTaskWorkflow`를 구현한다.

- mock workflow
- status transition
- usage event 생성
- audit log 생성
- mock branch 생성
- mock PR 생성
- mock merge simulation

### Step 8. Runner 생성

`apps/runner`에 agent runner skeleton을 만든다.

- `AgentRunner` interface
- `MockAgentRunner`
- instruction set 로딩 함수
- LLM gateway 호출 mock
- test command mock

### Step 9. Web dashboard 생성

`apps/web`에 최소 화면을 만든다.

- Dashboard
- Task list
- Task detail
- Skill list
- Harness list
- Instruction list

### Step 10. 테스트 추가

최소 테스트:

- task status transition test
- instruction resolver precedence test
- mock LLM gateway usage metadata test
- mock Git conflict risk test
- API health test

### Step 11. 문서 업데이트

다음 문서를 작성한다.

- `docs/foundations/architecture.md`
- `docs/foundations/domain-model.md`
- `docs/foundations/task-state-machine.md`
- `docs/foundations/instruction-layer.md`
- `docs/foundations/security-model.md`
- `docs/foundations/mvp-scope.md`
- ADR 3개

---

## 24. Acceptance Criteria

초기 작업이 완료되려면 다음을 만족해야 한다.

### 24.1 실행 기준

```bash
pnpm install
pnpm lint
pnpm test
```

위 명령이 통과해야 한다.

### 24.2 API 기준

```bash
pnpm --filter @aichestra/api dev
```

실행 후 다음이 가능해야 한다.

```bash
curl http://localhost:3000/health
```

응답:

```json
{
  "status": "ok",
  "service": "aichestra-api"
}
```

Task 생성 API가 동작해야 한다.

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix login timeout bug",
    "repoId": "repo_demo_backend",
    "baseBranch": "main",
    "selectedAgent": "codex",
    "selectedModel": "mock-model",
    "selectedSkillIds": ["skill_auth_debugging"],
    "selectedHarnessId": "harness_backend_node20",
    "budgetLimitUsd": 20
  }'
```

### 24.3 Workflow 기준

Worker가 task를 처리하면 다음 상태 중 하나로 전환되어야 한다.

- `pr_draft_ready`
- `review_required`
- `conflict_detected`
- `failed`

MVP에서는 실제 PR을 만들지 않고 mock PR URL을 반환해도 된다.

### 24.4 Web 기준

Web dashboard에서 다음을 볼 수 있어야 한다.

- 최근 task
- task status
- selected agent/model
- selected skill/harness
- mock cost
- mock PR URL

### 24.5 문서 기준

README에 다음이 있어야 한다.

- 프로젝트 설명
- 아키텍처 요약
- 설치 방법
- 실행 방법
- 테스트 방법
- MVP 범위
- 보안 주의사항
- 다음 단계

---

## 25. 구현 시 피해야 할 것

- 모든 기능을 한 번에 완성하려 하지 말 것
- 실제 OpenAI/Anthropic/GitHub API를 기본값으로 호출하지 말 것
- token이나 secret을 코드에 넣지 말 것
- domain model 없이 UI부터 만들지 말 것
- adapter 없이 provider-specific 코드를 직접 API에 넣지 말 것
- instruction과 policy를 혼동하지 말 것
- Harness와 Skill을 혼동하지 말 것
- Task와 TaskRun을 혼동하지 말 것
- branch/PR 상태를 task status에만 섞어 저장하지 말 것
- 테스트 없이 workflow transition을 만들지 말 것

---

## 26. 장기 Roadmap 문서화 항목

MVP 구현 후 docs에 다음 roadmap을 남긴다.

### Phase 1

- GitHub App 실제 연동
- LiteLLM Gateway 연동
- Postgres persistence 완성
- 기본 usage dashboard

### Phase 2

- Conflict Risk Graph
- Merge Queue
- CI webhook integration
- 실제 branch/worktree runner

### Phase 3

- Skill Registry 고도화
- Harness YAML parser
- Instruction Assembly Engine 고도화
- MCP Gateway policy

### Phase 4

- Temporal workflow
- Kubernetes agent runner
- Vault secrets broker
- OpenTelemetry trace

### Phase 5

- Auto-improvement loop
- Skill eval suite
- Harness canary rollout
- Enterprise SSO/SCIM/RBAC
- GitLab/Bitbucket 지원

---

## 27. Codex에게 주는 최종 명령

이제 이 문서를 기준으로 Aichestra의 초기 저장소 초안을 생성하라.

우선순위는 다음이다.

1. 실행 가능한 TypeScript monorepo 구조
2. core domain model과 zod schema
3. mock adapter 기반 API
4. task workflow skeleton
5. Skill/Harness/Instruction registry skeleton
6. usage/audit 기록 구조
7. 최소 web dashboard
8. 문서와 테스트

외부 연동은 mock으로 유지하라.
실제 provider integration은 adapter interface와 TODO 문서만 남겨라.
작업이 끝나면 변경 요약, 생성한 파일 목록, 실행한 테스트, 남은 TODO를 보고하라.

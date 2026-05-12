# Aichestra Codex Next Steps 지시문

이 문서는 `AICHESTRA_BOOTSTRAP.md`를 기반으로 Codex가 생성한 Aichestra 초기 초안을 **검수하고, 안정화하고, 첫 번째 작동 가능한 vertical slice를 구현**하도록 지시하기 위한 단일 문서다.

Codex는 이 문서를 저장소 루트에 추가한 뒤, 아래 지시를 순서대로 수행해야 한다.

---

## 0. 이 문서의 목적

현재 상태는 다음이라고 가정한다.

1. 저장소 루트에 `AICHESTRA_BOOTSTRAP.md`가 추가되어 있다.
2. Codex가 이 문서를 읽고 Aichestra 프로젝트 초안을 생성했다.
3. 이제 다음 단계로 넘어가기 전에 생성된 scaffold의 품질을 검수하고, 실행 가능한 최소 end-to-end 흐름을 구현해야 한다.

이번 작업의 목표는 화려한 기능을 많이 추가하는 것이 아니다.

이번 작업의 목표는 다음 네 가지다.

1. 현재 scaffold가 `AICHESTRA_BOOTSTRAP.md`의 요구사항을 얼마나 만족하는지 확인한다.
2. 아키텍처 경계가 무너진 부분을 찾아 문서화한다.
3. 빌드, 테스트, 타입체크, 린트가 통과하도록 최소 안정화한다.
4. mock adapter만 사용해서 첫 번째 MVP vertical slice를 구현한다.

---

## 1. Codex 작업 원칙

너는 이 저장소의 두 번째 구현 단계를 맡은 시니어 엔지니어다.

반드시 다음 원칙을 지켜라.

- 먼저 기존 파일을 읽고 현재 구조를 이해한다.
- `AICHESTRA_BOOTSTRAP.md`를 반드시 읽고, 그 문서를 현재 작업의 상위 요구사항으로 간주한다.
- 루트 `AGENTS.md`가 있으면 반드시 읽고 따른다.
- 루트 `AGENTS.md`가 없으면 이번 작업에서 생성한다.
- 실제 OpenAI, Anthropic, GitHub, GitLab, Jira, Slack, MCP, Vault, Kubernetes, Temporal API를 호출하지 않는다.
- 외부 연동은 모두 interface와 mock adapter로만 구현한다.
- 비밀키, token, API key, OAuth credential을 생성하거나 저장하지 않는다.
- 환경변수 없이도 테스트가 실행되어야 한다.
- 모든 provider-specific 코드는 adapter interface 뒤에 둔다.
- API handler 안에 orchestration 로직을 직접 넣지 않는다.
- domain model, workflow, adapter, registry, policy, API, UI의 책임을 분리한다.
- 테스트 가능한 순수 로직을 우선한다.
- 새로운 기능을 추가하면 최소 테스트를 추가한다.
- README, AGENTS.md, docs를 코드 변경과 함께 갱신한다.
- 작업이 끝나면 validation command를 실행하고 결과를 보고한다.

---

## 2. 이번 작업에서 절대 하지 말 것

다음은 이번 단계의 명시적 제외 범위다.

- 실제 GitHub App 구현
- 실제 GitHub branch/PR 생성
- 실제 OpenAI/Anthropic API 호출
- 실제 LiteLLM 연동
- 실제 Temporal workflow 서버 연동
- 실제 Kubernetes Job 실행
- 실제 Firecracker sandbox 실행
- 실제 MCP server 호출
- 실제 Vault 또는 cloud secrets 연동
- 실제 결제/과금 시스템
- 실제 사용자 SSO/SCIM 연동
- 복잡한 drag-and-drop UI
- production-ready auth 구현
- multi-tenant security 완성

이번 단계에서는 **mock 기반으로 제품의 뼈대와 흐름을 증명**하는 것이 목적이다.

---

## 3. 작업 진행 방식

Codex는 아래 세 단계를 순서대로 수행한다.

```text
Phase 1: Scaffold audit
Phase 2: Scaffold stabilization
Phase 3: First MVP vertical slice
```

단, Phase 1에서 심각한 구조 문제가 발견되면 Phase 3로 바로 넘어가지 말고, 먼저 Phase 2에서 안정화해야 한다.

---

# Phase 1. Scaffold Audit

## 1.1 읽어야 할 파일

먼저 다음 파일을 읽어라.

```text
AICHESTRA_BOOTSTRAP.md
AGENTS.md
README.md
package.json
pnpm-workspace.yaml
tsconfig.json
apps/**
packages/**
docs/**
infra/**
```

파일이 없으면 없는 것으로 기록하라. 없는 파일을 무조건 문제로 보지는 말고, 현재 scaffold의 의도를 파악하라.

---

## 1.2 생성해야 할 감사 보고서

다음 파일을 생성하라.

```text
docs/audits/2026-05-11-bootstrap-gap-report.md
```

이 보고서는 반드시 다음 섹션을 포함해야 한다.

```md
# Bootstrap Gap Report

## Summary

## Current repository structure

## Implemented requirements

## Missing requirements

## Architecture boundary violations

## Validation command results

## Risky or premature implementations

## Recommended next changes

## Decision

One of:
- Proceed to vertical slice
- Stabilize scaffold first
- Stop and ask for human review
```

---

## 1.3 감사 기준

다음 항목을 기준으로 현재 scaffold를 평가하라.

### Repository structure

아래와 유사한 책임 분리가 있는가?

```text
apps/
  api/
  web/
  worker/

packages/
  core/
  db/
  policy/
  git-adapter/
  llm-gateway/
  runner/
  registry/
  shared/

docs/
infra/
AGENTS.md
README.md
```

완전히 같은 디렉터리명일 필요는 없다. 하지만 다음 책임은 분리되어 있어야 한다.

| 책임 | 설명 |
|---|---|
| core domain | Task, TaskRun, Skill, Harness, InstructionArtifact 같은 순수 도메인 모델 |
| API | HTTP endpoint, request/response schema |
| worker | 장기 작업, workflow, task execution |
| git adapter | branch, worktree, PR, conflict check 추상화 |
| LLM gateway | model provider, usage, budget, mock completion 추상화 |
| registry | Skill, Harness, Instruction 관리 |
| policy | 권한, 예산, 허용 모델, merge 정책 판단 |
| web | dashboard skeleton |
| db | schema, migration, seed 또는 in-memory persistence |

---

### Architecture boundary

다음 위반이 있는지 확인하라.

- API handler가 직접 mock agent를 실행한다.
- API handler가 직접 GitHub/OpenAI 호출을 한다.
- worker가 HTTP request object에 의존한다.
- core domain이 framework, database, UI에 의존한다.
- Skill, Harness, Instruction 개념이 하나의 타입에 섞여 있다.
- Task 상태 전이가 문자열 난사 방식으로 흩어져 있다.
- usage ledger가 task, model, skill, harness와 연결되지 않는다.
- 테스트 없이 UI만 구현되어 있다.

---

### Validation commands

가능하면 다음 명령을 실행하라.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

만약 저장소가 `pnpm`이 아닌 `npm`, `yarn`, `bun`을 사용하도록 되어 있다면, 기존 package manager를 존중하라. 단, 실제로 어떤 명령을 사용했는지 `docs/audits/2026-05-11-bootstrap-gap-report.md`에 기록하라.

---

# Phase 2. Scaffold Stabilization

Phase 1에서 아래 중 하나라도 발견되면 Phase 3 구현 전에 먼저 안정화한다.

```text
AGENTS.md 없음
README 실행 방법 없음
lint/typecheck/test/build 명령 없음
core domain model 없음
mock adapter 없음
API와 worker 책임이 심하게 섞임
외부 API 호출이 테스트나 기본 실행 경로에 포함됨
```

## 2.1 AGENTS.md 보강 또는 생성

루트 `AGENTS.md`가 없거나 부실하면 다음 내용을 포함하도록 생성 또는 보강하라.

```md
# AGENTS.md

## Project

Aichestra is an LLM/agent orchestration control plane for collaborative AI-assisted software development.

## Non-negotiable rules

- Do not call real external APIs in tests or default development flows.
- Keep OpenAI, Anthropic, GitHub, MCP, Vault, Temporal, and Kubernetes behavior behind interfaces.
- Use mock adapters for the MVP vertical slice.
- Do not store secrets in source code.
- Keep core domain logic framework-independent.
- Add or update tests for behavior changes.
- Keep README and docs aligned with code.

## Validation

Run the following before claiming the task is complete:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

If the project uses another package manager, update this section to match the actual commands.

## Architecture boundaries

- `packages/core` owns domain models and pure business logic.
- `apps/api` exposes HTTP APIs and does not contain orchestration logic.
- `apps/worker` owns workflow execution.
- `packages/git-adapter` abstracts Git provider behavior.
- `packages/llm-gateway` abstracts model providers and usage accounting.
- `packages/registry` owns Skill, Harness, and Instruction registries.
- `packages/policy` owns policy decisions.
```

---

## 2.2 README 보강

README에는 최소한 다음이 있어야 한다.

```md
# Aichestra

## What this project is

## MVP scope

## What is intentionally mocked

## Repository structure

## Local setup

## Validation commands

## First vertical slice

## Security notes
```

---

## 2.3 기본 validation command 추가

`package.json` 또는 workspace 설정에 다음 명령을 맞춰라.

```json
{
  "scripts": {
    "lint": "...",
    "typecheck": "...",
    "test": "...",
    "build": "..."
  }
}
```

명령이 아직 실질적인 검사를 많이 하지 않아도 된다. 하지만 다음 조건을 만족해야 한다.

- 명령이 존재한다.
- 명령이 기본 scaffold에서 성공한다.
- 실패한다면 명확한 이유가 있어야 한다.
- 테스트는 최소 하나 이상 존재해야 한다.

---

# Phase 3. First MVP Vertical Slice

Phase 3의 목표는 다음 흐름이 mock 기반으로 end-to-end 동작하게 만드는 것이다.

```text
User creates a task
  → policy is checked
  → model, harness, skill, instruction set are selected
  → mock branch is prepared
  → mock agent run creates a deterministic diff summary
  → mock tests pass
  → mock PR is created
  → usage ledger records mock token/cost data
  → task is marked completed
  → web dashboard can show the task status
```

---

## 3.1 Core domain models

다음 도메인 모델을 추가하거나 보강하라.

```text
Task
TaskRun
TaskState
Agent
ModelProvider
ModelSelection
Skill
Harness
InstructionArtifact
InstructionSet
Branch
PullRequest
UsageLedgerEntry
PolicyDecision
ConflictRisk
```

가능하면 `packages/core` 또는 이에 준하는 순수 도메인 package에 둔다.

---

## 3.2 Task state machine

다음 상태 전이를 구현하라.

```text
created
policy_checked
model_selected
context_prepared
branch_prepared
agent_running
diff_generated
tests_passed
pr_created
completed
failed
```

허용 전이는 명시적으로 관리하라.

예:

```text
created -> policy_checked
policy_checked -> model_selected
model_selected -> context_prepared
context_prepared -> branch_prepared
branch_prepared -> agent_running
agent_running -> diff_generated
diff_generated -> tests_passed
tests_passed -> pr_created
pr_created -> completed
any non-terminal state -> failed
```

테스트해야 할 것:

- 정상 전이는 성공한다.
- 불가능한 전이는 실패한다.
- terminal state 이후 전이는 실패한다.
- failed 상태에는 failure reason이 남는다.

---

## 3.3 Mock adapters

다음 mock adapter를 구현하라.

```text
MockPolicyEngine
MockModelRouter
MockInstructionResolver
MockSkillRegistry
MockHarnessRegistry
MockGitProvider
MockAgentRunner
MockTestRunner
MockPullRequestProvider
MockUsageLedger
```

각 adapter는 실제 외부 API를 호출하지 않아야 한다.

---

## 3.4 Adapter interface 예시

구현 언어와 기존 구조에 맞게 조정하되, 다음 개념은 유지하라.

```ts
export interface PolicyEngine {
  checkTaskPermission(input: CheckTaskPermissionInput): Promise<PolicyDecision>;
}

export interface ModelRouter {
  selectModel(input: ModelSelectionInput): Promise<ModelSelection>;
}

export interface GitProvider {
  prepareBranch(input: PrepareBranchInput): Promise<Branch>;
  createPullRequest(input: CreatePullRequestInput): Promise<PullRequest>;
  estimateConflictRisk(input: ConflictRiskInput): Promise<ConflictRisk>;
}

export interface AgentRunner {
  runTask(input: AgentRunInput): Promise<AgentRunResult>;
}

export interface UsageLedger {
  record(entry: UsageLedgerEntry): Promise<void>;
  listByTask(taskId: string): Promise<UsageLedgerEntry[]>;
}
```

---

## 3.5 API endpoints

다음 endpoint를 추가하거나 보강하라.

```text
POST /tasks
GET /tasks
GET /tasks/:id
POST /tasks/:id/run
GET /tasks/:id/runs
GET /usage?taskId=:taskId
```

### POST /tasks request 예시

```json
{
  "title": "Fix login timeout bug",
  "description": "Investigate and fix intermittent login timeout failures.",
  "repoId": "repo_backend",
  "requestedBy": "user_demo",
  "preferredAgent": "mock-codex",
  "targetBranch": "main"
}
```

### POST /tasks response 예시

```json
{
  "id": "task_001",
  "state": "created",
  "title": "Fix login timeout bug"
}
```

---

## 3.6 Worker flow

`POST /tasks/:id/run` 또는 worker trigger가 다음 순서로 동작해야 한다.

```text
1. Load task
2. Check policy
3. Select model
4. Resolve instruction set
5. Select skill
6. Select harness
7. Prepare mock branch
8. Run mock agent
9. Generate deterministic diff summary
10. Run mock tests
11. Create mock PR
12. Record usage ledger entry
13. Mark task completed
```

Mock agent result는 deterministic해야 한다.

예:

```json
{
  "summary": "Mock agent generated a patch plan for Fix login timeout bug.",
  "changedFiles": [
    "src/auth/session.ts",
    "tests/auth/session.test.ts"
  ],
  "diffSummary": "2 files changed, 18 insertions, 4 deletions"
}
```

---

## 3.7 Usage ledger

usage ledger는 최소 다음 필드를 가져야 한다.

```text
id
taskId
taskRunId
userId
repoId
agentId
modelProvider
modelName
skillId
skillVersion
harnessId
harnessVersion
inputTokens
outputTokens
costUsd
latencyMs
createdAt
```

이번 단계에서는 mock 값을 사용한다.

예:

```json
{
  "inputTokens": 1200,
  "outputTokens": 450,
  "costUsd": 0.032,
  "latencyMs": 800
}
```

---

## 3.8 Skill, Harness, Instruction 분리

반드시 다음 세 개념을 분리하라.

```text
Skill = 특정 작업을 수행하기 위한 reusable workflow
Harness = agent를 실행하는 runtime, tool, secret, network, test 환경
InstructionArtifact = AGENTS.md, CLAUDE.md, project rules, org baseline prompt 같은 지속 지시문
```

나쁜 구현:

```text
Skill 타입 안에 Docker image, network policy, AGENTS.md 내용을 모두 넣음
Harness 타입 안에 모든 prompt와 task 지시문을 넣음
InstructionArtifact를 단순 string 배열로만 취급하고 provenance/version을 잃음
```

좋은 구현:

```text
TaskRun
  ├─ Skill reference
  ├─ Harness reference
  ├─ InstructionSet reference
  └─ UsageLedgerEntry
```

---

## 3.9 Web dashboard

복잡한 UI는 필요 없다. 최소한 다음 화면을 구현하라.

```text
/tasks
  - task list
  - title
  - state
  - selected agent
  - selected model
  - selected skill
  - selected harness
  - mock PR link
  - mock cost

/tasks/:id
  - task details
  - task run timeline
  - usage ledger entries
  - changed files
  - diff summary
  - mock PR link
```

UI가 Next.js인지 다른 framework인지는 기존 scaffold를 따른다.

---

## 3.10 Tests

최소 다음 테스트를 추가하라.

```text
Task state transition test
Invalid state transition test
Mock workflow success test
Policy denial test
Usage ledger attribution test
Instruction/Skill/Harness separation test
```

테스트는 외부 API, network, real credential에 의존하지 않아야 한다.

---

## 3.11 Acceptance criteria

작업이 완료되었다고 말하려면 다음을 만족해야 한다.

```text
[ ] docs/audits/2026-05-11-bootstrap-gap-report.md가 생성되어 있다.
[ ] 루트 AGENTS.md가 존재하고 실제 검증 명령을 포함한다.
[ ] README가 로컬 실행 방법과 MVP 범위를 설명한다.
[ ] Task, TaskRun, Skill, Harness, InstructionArtifact 모델이 존재한다.
[ ] mock adapter만으로 task run이 completed 상태까지 진행된다.
[ ] usage ledger가 task, model, skill, harness와 연결되어 기록된다.
[ ] API에서 task 생성, 목록, 상세, 실행이 가능하다.
[ ] web dashboard에서 task 상태와 mock PR/cost를 볼 수 있다.
[ ] 외부 API를 기본 실행 경로에서 호출하지 않는다.
[ ] lint가 통과한다.
[ ] typecheck가 통과한다.
[ ] test가 통과한다.
[ ] build가 통과한다.
```

---

## 4. 최종 결과 보고 형식

Codex는 작업 마지막에 다음 형식으로 요약하라.

```md
## Completed

- ...

## Changed files

- ...

## Validation results

- pnpm lint: pass/fail
- pnpm typecheck: pass/fail
- pnpm test: pass/fail
- pnpm build: pass/fail

## Notes

- ...

## Recommended next task

- ...
```

실패한 명령이 있으면 실패 원인과 수정 방향을 명확히 써라. 실패를 숨기지 마라.

---

## 5. 다음 단계 추천

이번 작업이 성공하면 다음 작업은 아래 순서가 좋다.

```text
1. Conflict Manager v0
   - file overlap 기반 conflict risk score
   - active branch graph
   - merge queue skeleton

2. Registry v0 확장
   - Skill Registry CRUD
   - Harness Registry CRUD
   - Instruction Registry CRUD
   - version pinning

3. LLM Gateway v0
   - provider interface
   - mock cost calculation
   - budget policy
   - usage ledger dashboard

4. Git Provider v0
   - GitHub adapter interface
   - mock에서 real adapter로 점진적 확장
   - webhook schema skeleton

5. Real runner experiment
   - Codex CLI 또는 Claude Code 중 하나만 선택
   - local sandbox에서 제한적으로 실행
   - no-secret logging 검증
```

---

# Codex에게 바로 줄 명령문

아래 명령문을 Codex에게 그대로 전달해도 된다.

```text
Read AICHESTRA_BOOTSTRAP.md, AGENTS.md, and AICHESTRA_CODEX_NEXT_STEPS.md.

Then execute the next-step plan in AICHESTRA_CODEX_NEXT_STEPS.md.

Start with Phase 1 by creating docs/audits/2026-05-11-bootstrap-gap-report.md.
If the scaffold has critical blockers, perform Phase 2 stabilization first.
If the scaffold is stable enough, implement Phase 3: the first MVP vertical slice using mock adapters only.

Do not call real external APIs.
Do not add real GitHub, OpenAI, Anthropic, MCP, Vault, Temporal, or Kubernetes integrations yet.
Keep all provider behavior behind interfaces.
Ensure the final result passes lint, typecheck, test, and build.
Update README and AGENTS.md if commands or architecture changed.
At the end, report completed work, changed files, validation results, and the recommended next task.
```

---

# 별도 감사 전용 명령문

구현 전에 감사만 먼저 시키고 싶다면 아래 명령문을 사용하라.

```text
Read AICHESTRA_BOOTSTRAP.md, AGENTS.md, and AICHESTRA_CODEX_NEXT_STEPS.md.

Only execute Phase 1: Scaffold Audit.
Create docs/audits/2026-05-11-bootstrap-gap-report.md with implemented items, missing items, architecture boundary violations, validation command results, risky premature implementations, and recommended next changes.

Do not modify application code in this step.
Do not implement new features.
Do not call real external APIs.
```

---

# 구현 전용 명령문

이미 감사 보고서를 확인했고 바로 구현하고 싶다면 아래 명령문을 사용하라.

```text
Read docs/audits/2026-05-11-bootstrap-gap-report.md, AICHESTRA_BOOTSTRAP.md, AGENTS.md, and AICHESTRA_CODEX_NEXT_STEPS.md.

Implement Phase 2 stabilization if needed, then Phase 3: the first MVP vertical slice using mock adapters only.

The vertical slice must support:
- creating a task
- running the mock orchestration workflow
- selecting mock model, skill, harness, and instruction set
- preparing a mock branch
- generating a deterministic mock diff summary
- creating a mock PR
- recording usage ledger entries
- showing task status and mock cost in the web dashboard

Do not call real external APIs.
Keep provider integrations behind interfaces.
Add tests for task state transitions, mock workflow success, policy denial, usage ledger attribution, and Skill/Harness/Instruction separation.
Ensure lint, typecheck, test, and build pass.
```

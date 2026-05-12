# Aichestra 기술 스택 및 동작 설계도

> 기준: mock-first AgentOps Control Plane. Phase 1~2는 current milestone 기준 완료, Phase 3는 Registry hardening/packaging 단계, Phase 4는 draft-only auto-improvement v0까지의 설계를 포함한다.

## 1. 전체 구조

```mermaid
flowchart TB
  subgraph UI[사용자 접점]
    Web[Web Console]
    CLI[CLI]
    IDE[IDE Plugin]
    Chat[Slack/Jira/Linear]
  end

  subgraph CP[Aichestra Control Plane]
    API[Backend API\nDTO/Validation/Task API]
    Worker[Worker / Workflow\nTaskRun state machine]
    Policy[Policy / RBAC\nmutation, model, tool gates]
    Registry[Registry Resolver\nSkill/Harness/Instruction]
    Conflict[Conflict Manager\nBranchLease/Risk/Queue]
    Improve[Auto-improvement\nFailureCluster -> Draft Proposal]
  end

  subgraph SVC[서비스/어댑터]
    LLM[LLM Gateway\nmodel routing + usage]
    Git[Git Adapter\nmock/local + future provider]
    Agent[Agent Runner\nmock -> Codex/Claude/Aider]
    MCP[MCP Gateway\ntool governance]
  end

  subgraph DATA[상태/관측]
    DB[(Persistent Store\nTask/Usage/Registry/Audit)]
    Trace[(Trace/Event\nFailureSignal/Cost/Quality)]
    Package[(Package Store\nManifest/Import/Export)]
    Dash[Dashboard State]
  end

  Web --> API
  CLI --> API
  IDE --> API
  Chat --> API
  API --> Policy
  API --> Worker
  Worker --> Registry
  Worker --> Conflict
  Worker --> LLM
  Worker --> Git
  Worker --> Agent
  Agent --> MCP
  LLM --> DB
  Git --> DB
  Registry --> DB
  Conflict --> DB
  Worker --> Trace
  Conflict --> Trace
  Improve --> DB
  Trace --> Improve
  DB --> Dash
```

## 2. TaskRun 실행 흐름

```mermaid
sequenceDiagram
  participant U as User/UI
  participant API as Backend API
  participant W as Worker
  participant P as Policy/RBAC
  participant R as RegistryResolver
  participant G as Git/Conflict
  participant A as AgentRunner
  participant L as LLMGateway
  participant D as Store/Trace

  U->>API: Create Task / Run Task
  API->>P: authorize actor and requested operation
  API->>W: start TaskRun
  W->>R: resolve Skill/Harness/Instruction
  R-->>W: selected refs + warnings
  W->>G: prepare branch lease and risk context
  W->>A: run agent with resolved context
  A->>L: model calls through gateway, if any
  A-->>W: diff summary + changed files
  W->>G: risk scoring / dry-run simulation / queue recommendation
  W->>D: usage ledger + task run result + audit/trace
  API-->>U: status / dashboard data
```

## 3. Registry 구조

```mermaid
flowchart LR
  Skill[Skill Registry\nworkflow capability]
  Harness[Harness Registry\nruntime/tools/network]
  Instruction[Instruction Registry\nAGENTS.md/CLAUDE.md/context]
  Resolver[Registry Resolver\nversion + approval/eval/checksum gates]
  Snapshot[TaskRun Registry Snapshot]
  Audit[Audit + History + Rollback]
  Package[Package Manifest\nImport/Export/Semver/Diff]
  Improve[Draft Improvement Proposal]

  Skill --> Resolver
  Harness --> Resolver
  Instruction --> Resolver
  Audit --> Resolver
  Package --> Resolver
  Resolver --> Snapshot
  Improve -.draft only.-> Skill
  Improve -.draft only.-> Harness
  Improve -.draft only.-> Instruction
```

## 4. Conflict Manager 구조

```mermaid
flowchart LR
  Lease[BranchLease\nactive files/symbols]
  Overlap[File Overlap Risk\ndeterministic scoring]
  Sim[Local Dry-run Merge\nclean/text_conflict/failed/unavailable]
  Risk[ConflictRisk\nscore + reasons]
  Queue[MergeQueueEntry\nready/blocked/review]

  Lease --> Overlap --> Sim --> Risk --> Queue
```

## 5. Auto-improvement v0 안전 루프

```mermaid
flowchart TB
  Signal[FailureSignal]
  Cluster[FailureCluster]
  Candidate[ImprovementCandidate]
  Proposal[ImprovementProposal]
  Draft[DraftRegistryChange]
  Readiness[ProposalReadiness]
  Policy[SafetyPolicy\nallowAutoApply=false]

  Signal --> Cluster --> Candidate --> Proposal --> Draft
  Proposal --> Readiness
  Policy --> Readiness
  Readiness -->|blocked until approval/eval/canary| Proposal
```

## 6. 핵심 원칙

- 모든 실행 결과는 `taskRunId`에 귀속한다.
- `Skill`, `Harness`, `InstructionArtifact`는 절대 하나의 타입으로 뭉치지 않는다.
- prompt instruction은 정책을 대체하지 않는다. 권한과 안전은 Policy/Runtime/Gateway에서 강제한다.
- Auto-improvement v0는 proposal과 draft change만 만들고 active registry를 자동 변경하지 않는다.
- 실제 LLM/Git/MCP/Secrets/Runtime 연동은 interface 뒤에 붙인다.

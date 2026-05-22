# Aichestra Docs

이 디렉터리는 Aichestra의 설계, 구현 계획, 감사 기록을 보관합니다. 문서가 기능 설명을 반복해서 흩어지지 않도록, 현재 상태와 운영 경계는 `reference/`의 통합 문서를 우선 참조합니다.

## 먼저 볼 문서

1. [briefs/AICHESTRA_BOOTSTRAP.md](briefs/AICHESTRA_BOOTSTRAP.md) - 원본 제품/아키텍처 부트스트랩.
2. [reference/mvp-scope.md](reference/mvp-scope.md) - 현재 MVP에 포함된 것과 명시적으로 제외된 것.
3. [reference/feature-status.md](reference/feature-status.md) - 구현된 slice별 상태와 mock-first/disabled-by-default 경계.
4. [reference/configuration.md](reference/configuration.md) - 실제 통합을 막는 환경 변수 gate와 실행 예시.
5. [reference/mock-skeleton-inventory.md](reference/mock-skeleton-inventory.md) - mock, metadata-only, readiness-only scaffold 분류.

## 디렉터리 역할

| 경로 | 역할 | 정리 원칙 |
| --- | --- | --- |
| `briefs/` | 원본 브리프와 작업 지시서 | canonical 입력 문서로 유지하고 자주 수정하지 않음 |
| `foundations/` | 도메인 모델, 보안, Auth/RBAC, 저장소, 관측성처럼 여러 기능이 공유하는 개념 | 기능별 진행 상황을 반복 설명하지 않고 불변 개념 위주로 유지 |
| `features/` | 기능별 계획/완료 문서 | 한 기능은 `docs/features/<slug>/` 아래에 모으고, 완료 후 중복된 긴 설명은 `reference/feature-status.md`로 합침 |
| `roadmaps/` | 단계별 추진 계획과 production/staging readiness 계획 | 미래 계획과 실행 순서만 남기고, 이미 구현된 상세 상태는 reference로 이동 |
| `audits/` | 날짜가 중요한 감사/증거/검토 기록 | 삭제보다 시계열 보존을 기본으로 하되, 새 종합 감사가 생기면 README에는 최신/대표 감사만 링크 |
| `reference/` | 현재 상태, 설정, matrix, inventory, 외부 설계 자료 | 중복 설명을 흡수하는 통합 색인. 주요 문서는 아래 Reference 섹션 참조 |
| `runbooks/` | 사람이 직접 실행하는 검증/운영 절차 | 명령, 기대 결과, 실패 시 조치만 짧게 기록하고 설계 설명은 reference/roadmaps에 둠 |
| `adr/` | Architecture Decision Records | 결정 배경과 결과만 짧게 기록 |

## 대표 기능 문서

기능별 최신 문서는 각 feature 폴더의 완료 문서(`v0.md`, `v1.md`, `v2.md`, `v3.md`)를 기준으로 봅니다. 전체 상태 요약은 [reference/feature-status.md](reference/feature-status.md)가 우선입니다.

- [features/conflict-manager/](features/conflict-manager/)
- [features/merge-queue-policy/](features/merge-queue-policy/)
- [features/conflict-resolution-assistant/](features/conflict-resolution-assistant/)
- [features/pr-ownership-handoff/](features/pr-ownership-handoff/)
- [features/real-merge-execution-policy/](features/real-merge-execution-policy/)
- [features/real-git-adapter/](features/real-git-adapter/)
- [features/llm-gateway/](features/llm-gateway/)
- [features/local-agent-runner/](features/local-agent-runner/)
- [features/registry/](features/registry/)
- [features/dashboard/](features/dashboard/)

나머지 feature 폴더도 같은 규칙을 따릅니다. 새 기능을 추가할 때는 `docs/features/<slug>/v0-plan.md`로 시작하고, 구현 완료 후 `v0.md` 또는 다음 버전 문서로 닫습니다.

## 대표 로드맵

- [roadmaps/real-integration-roadmap.md](roadmaps/real-integration-roadmap.md)
- [roadmaps/real-integration-foundation-v0-plan.md](roadmaps/real-integration-foundation-v0-plan.md)
- [roadmaps/production-deployment-readiness/](roadmaps/production-deployment-readiness/)
- [roadmaps/auth-rbac-production/](roadmaps/auth-rbac-production/)
- [roadmaps/secret-backend-migration/](roadmaps/secret-backend-migration/)
- [roadmaps/policy-bundle-runtime-poc/](roadmaps/policy-bundle-runtime-poc/)
- [roadmaps/staging-deployment-profile/](roadmaps/staging-deployment-profile/)
- [roadmaps/staging-release-candidate/](roadmaps/staging-release-candidate/)
- [roadmaps/staging-deployment-execution/](roadmaps/staging-deployment-execution/)

## 대표 Runbook

- [runbooks/production-foundation-smoke.md](runbooks/production-foundation-smoke.md)

## Reference

통합 상태 문서:

- [reference/mvp-scope.md](reference/mvp-scope.md) - MVP 포함/제외 범위.
- [reference/feature-status.md](reference/feature-status.md) - 구현 slice별 상태와 mock-first/disabled-by-default 경계.
- [reference/configuration.md](reference/configuration.md) - 환경 변수, integration gate, 실행 예시.
- [reference/mock-skeleton-inventory.md](reference/mock-skeleton-inventory.md) - mock/metadata/readiness-only maturity 분류.

Inventory / matrix:

- [reference/runtime-component-inventory.md](reference/runtime-component-inventory.md)
- [reference/environment-gate-matrix.md](reference/environment-gate-matrix.md)
- [reference/dashboard-read-model-inventory.md](reference/dashboard-read-model-inventory.md)
- [reference/audit-source-inventory.md](reference/audit-source-inventory.md)
- [reference/durable-collaboration-store-inventory.md](reference/durable-collaboration-store-inventory.md)
- [reference/production-rbac-permission-matrix.md](reference/production-rbac-permission-matrix.md)
- [reference/github-app-permission-matrix.md](reference/github-app-permission-matrix.md)
- [reference/github-webhook-event-allowlist.md](reference/github-webhook-event-allowlist.md)
- [reference/policy-domain-mapping.md](reference/policy-domain-mapping.md)
- [reference/staging-environment-gate-matrix.md](reference/staging-environment-gate-matrix.md)

Scope / auth / readiness:

- [reference/request-context-propagation-inventory.md](reference/request-context-propagation-inventory.md)
- [reference/api-authcontext-middleware-inventory.md](reference/api-authcontext-middleware-inventory.md)
- [reference/service-account-actor-boundary-inventory.md](reference/service-account-actor-boundary-inventory.md)
- [reference/registry-governance-request-context-inventory.md](reference/registry-governance-request-context-inventory.md)
- [reference/tenant-repo-provider-scope-inventory.md](reference/tenant-repo-provider-scope-inventory.md)
- [reference/tenant-scope-enforcement-inventory.md](reference/tenant-scope-enforcement-inventory.md)
- [reference/dashboard-tenant-scope-inventory.md](reference/dashboard-tenant-scope-inventory.md)
- [reference/readiness-tenant-scope-inventory.md](reference/readiness-tenant-scope-inventory.md)
- [reference/dashboard-role-visibility-matrix.md](reference/dashboard-role-visibility-matrix.md)
- [reference/readiness-role-visibility-matrix.md](reference/readiness-role-visibility-matrix.md)

외부 원본/변환 자료:

- `reference/Aichestra_Closed_Enterprise_LLM_Provider_Design.docx`
- `reference/Aichestra_Closed_Enterprise_LLM_Provider_Design.pdf`
- `reference/Aichestra_Closed_Enterprise_LLM_Provider_Design_LLM_Readable/Aichestra_Closed_Enterprise_LLM_Provider_Design_LLM_Readable.md`
- `reference/Aichestra_Closed_Enterprise_LLM_Provider_Design_LLM_Readable/Aichestra_Closed_Enterprise_LLM_Provider_Design_LLM_Readable.json`
- `reference/Aichestra_Closed_Enterprise_LLM_Provider_Design_LLM_Readable/Aichestra_Closed_Enterprise_LLM_Provider_Design_LLM_Readable.schema.json`

## 감사/증거 기록

감사 문서는 구현 당시의 판단과 근거를 보존하는 기록입니다. 최신 상태 판단은 감사 문서 하나만 보지 말고 [reference/feature-status.md](reference/feature-status.md), [reference/mvp-scope.md](reference/mvp-scope.md), 최신 감사 문서를 함께 확인합니다.

대표 감사:

- [audits/2026-05-14-staging-go-no-go-audit-v0.md](audits/2026-05-14-staging-go-no-go-audit-v0.md)
- [audits/2026-05-14-staging-release-candidate-audit-v0.md](audits/2026-05-14-staging-release-candidate-audit-v0.md)
- [audits/2026-05-12-final-audit-synthesis.md](audits/2026-05-12-final-audit-synthesis.md)
- [audits/2026-05-12-audit-remediation.codex.md](audits/2026-05-12-audit-remediation.codex.md)
- [audits/current-state-design-conformance-audit.md](audits/current-state-design-conformance-audit.md)

## 작성 규칙

- 기능 설명은 feature 문서에 쓰고, 여러 기능을 가로지르는 현재 상태 요약은 `reference/feature-status.md`에 합칩니다.
- 환경 변수, integration gate, 실행 예시는 `reference/configuration.md`에 합칩니다.
- MVP 포함/제외 목록은 `reference/mvp-scope.md`에 합칩니다.
- 새 감사는 `docs/audits/YYYY-MM-DD-<topic>.md` 형식을 사용합니다.
- 단일 기능 감사는 `docs/features/<slug>/audits/`에 둘 수 있습니다.
- 외부 원본 자료는 원본과 최소 canonical 변환본만 보관합니다. 같은 내용의 `txt/jsonl/yaml/llms.txt` 같은 중복 변환본은 추가하지 않습니다.

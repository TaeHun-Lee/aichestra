# SecretRef-backed Provider Credentials v1 완료 검수

> **검토일**: 2026-05-13
> **대상**: 커밋 `625fe14`(`feat: ing`) 시점 — `a1c158d feat: secretref-provider-credentials-v1 & audit` 이후의 실제 코드/테스트/문서 상태
> **작성자**: Claude (claude-opus-4-7)
> **선행 감사**: [`2026-05-12-secretref-provider-credentials-v1-audit.claude.md`](2026-05-12-secretref-provider-credentials-v1-audit.claude.md)
> **검수 목적**: SecretRef-backed Provider Credentials v1 구현이 완료(`v1_implemented`)로 인정 가능한지 판정
> **검증 결과**: lint pass · typecheck pass · build pass · 전체 테스트 197/3 fail (실패 3건은 SecretRef와 무관한 사전 결함) · `tests/secretref-provider-credentials-v1.test.ts` 격리 실행 10/10 pass

---

## 1. 최종 판정

**`v1_complete_with_minor_followups`**

핵심 흐름(SecretRef → AuthZ/Policy → Lease → EnvSecretProvider → transient credential → audit/redaction), GitHub/LLM/Webhook SecretRef-first 통합, API/Health/Dashboard non-secret 노출, 그리고 전용 테스트 10건이 모두 spec과 일치하게 구현·통과되었으나, (1) 무관 영역(MCP/dashboard read-model v0)에서 3건의 사전 결함이 잔존하고, (2) 신선한 워크스페이스에서 `pnpm install` 없이 typecheck가 실패했으며, (3) 일부 negative-path 테스트(legacy fallback 우회 시도 등)가 누락되어 minor follow-up이 필요합니다.

---

## 2. 전체 요약

- **구현 완료도**: 명세된 코드/DTO/Audit/API/Health/Dashboard 모두 구현됨. `SecretRef.value` 필드 자체가 존재하지 않고 envKey만 보유.
- **설계 일치도**: `SecretRef → AuthZ → Policy(provider/git/llm.credential.resolve, secret.lease.request, secret.lease.issue) → EnvSecretProvider → transient adapter-only value` 흐름이 `service.ts:236–952`에 그대로 구현되어 있어 plan.md와 v1.md의 흐름 도식과 일치.
- **테스트 충분성**: 핵심 시나리오 10건 모두 PASS. 다만 “legacy env fallback이 disabled/revoked SecretRef를 우회하지 못함”을 단정할 직접 assertion이 부재(혼합 환경 테스트 누락).
- **문서 충분성**: v1.md/v1-plan.md 모두 광범위. legacy fallback 위험은 “Known Limitations”에 한 줄 명시 — 약간 보강 여지 있음.
- **secret leakage 위험**: SecretRef v1 경로(메인 5개 API, /health, /dashboard/security, audit, GitHub/LLM provider config) 전부 PASS. 단 MCP Gateway는 별개 문제로 sk-/ghp_ 패턴이 결과 출력에 노출되는 사전 결함 잔존(테스트 fail로 드러남).
- **mock-first/safe default 유지 여부**: 유지. `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER`가 false면 EnvSecretProvider가 어떤 env도 읽지 않으며, 기본 `MockGitProvider`/`MockLLMProvider` 그대로.
- **legacy fallback 리스크**: SecretRef가 설정된 경우 legacy로 우회되지 않음(`provider-factory.ts:155–185`, `providers.ts:709–756` 모두 SecretRef-first 후 명시적 status 반환). SecretRef 미설정 시에만 legacy env 사용. v2에서는 legacy 경로에 audit 이벤트와 명시적 deprecation flag 권장.
- **production readiness 판단**: Production-ready 아님. 인메모리 저장소, env-only secret backend, no rotation, no Vault/cloud secret manager — 문서가 명확히 명시하며 v1 spec 그대로.

---

## 3. 완료 기준 체크리스트

| 영역 | 항목 | 결과 | 근거 위치 | 비고 |
|------|------|------|----------|-----|
| SecretRef | provider/kind/envKey/status 표현 | PASS | `packages/security/src/types.ts:25–37` | `value` 필드 없음, status enum=`active`/`disabled`/`revoked` |
| SecretRef | 생성/상태변경/검증 | PASS | `packages/security/src/service.ts:140–230` | raw secret material/cache path 거부, envKey safe pattern 검증 |
| EnvSecretProvider | 기본 비활성화 | PASS | `packages/security/src/credentials.ts:21–25, 36–38` | `enabled ?? false`, disabled시 즉시 blocked 반환 |
| EnvSecretProvider | enable flag + allowlist 강제 | PASS | `credentials.ts:45–47, 56–63` | `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true` + `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` 매칭 필요 |
| CredentialManager | SecretRef → AuthZ → Policy → Lease → adapter-only value | PASS | `service.ts:641–952` | 5개 게이트(authorization, purpose policy, credential policy, lease.request, lease.issue) 통과 후에만 env 접근 |
| CredentialManager | public DTO에서 value 제거 | PASS | `service.ts:236–240` `dto.ts:45–58` | `resolveCredential()`는 value drop, internal 전용 메서드만 transient value 반환 |
| GitHub | SecretRef 우선, legacy 우회 차단 | PASS | `packages/adapters/src/git/provider-factory.ts:155–185` | `_SECRET_REF` 설정시 resolver 통해서만 토큰 획득; 실패시 blocked/denied/missing 반환(legacy로 fallback 안 함) |
| GitHub | env-only fallback은 SecretRef 미설정 시에만 | PASS | `provider-factory.ts:180–184` | 명시적으로 `_SECRET_REF`가 없을 때만 `AICHESTRA_GITHUB_TOKEN` 사용 |
| LLM | SecretRef 우선 + remote 게이트 잔존 | PASS | `packages/llm-gateway/src/providers.ts:709–756`, `gateway.ts:742–762` | OpenAI-compatible provider는 remoteLlmEnabled+remoteCompletionEnabled+baseUrl+apiKey+모델 allowlist 모두 충족할 때만 호출; SecretRef 실패 시 routing이 `credentials_blocked` |
| API | secret value 미노출 | PASS | `apps/api/src/main.ts:1086–1178`, `:430–437` | `containsRawSecretField`로 raw token 거부, resolve/check는 `resolveCredential`(value 미포함) 사용 |
| API | DTO validation | PASS | `main.ts:1100–1108, 1127–1133, 1141–1148` | id/name/provider/secretKind 필수, status enum 검증, purpose enum 검증 |
| Health/Dashboard | status만 노출 | PASS | `main.ts:558–679`, `apps/api/src/dashboard-read-model.ts:450–485`, `apps/web/src/render.ts:384–385` | credentialManagerKind, envSecretProviderEnabled, configured-flag, source/status 노출. 값/env-key 미노출. |
| Audit/Redaction | token/api-key/cache-path/bearer redaction | PASS | `packages/security/src/redaction.ts:17–46`, `service.ts:1218–1247`, `llm-gateway/src/providers.ts:808–822` | sk-/ghp_/github_pat_/AIza/Bearer/env dump/`~/.codex/auth.json`/`~/.claude`/GOOGLE_APPLICATION_CREDENTIALS 모두 커버 |
| Audit | resolve 성공/실패 audit | PASS | `service.ts:649–666, 902–940, 963–984` | `credential_resolution_requested/_allowed/_denied/_missing/_revoked` + `credential_value_redacted` 이벤트 기록 |
| Tests | 핵심 시나리오 | PASS | `tests/secretref-provider-credentials-v1.test.ts:157–625` | 10/10 PASS (격리 실행 확인) |
| Tests | legacy fallback 우회 negative test | PARTIAL | 동상 | SecretRef-first 동작은 검증되나, 동시에 legacy env가 설정된 상태에서 “revoked SecretRef가 legacy로 우회되지 않음”을 명시적으로 단언하는 테스트는 없음 |
| Docs | v1 범위/제한/legacy fallback/Vault 등 미구현 명시 | PASS | `docs/foundations/secretref-provider-credentials/v1.md:1–158`, `v1-plan.md:1–109` | 범위/safe default/원칙/API/health/dashboard/제한사항/Out-of-scope 모두 명시 |

---

## 4. 발견된 문제

### Issue #1: pre-existing 테스트 3건 실패 (SecretRef와 무관)
- 심각도: **Medium**(SecretRef v1 자체에 대한 직접 결함 아님, 하지만 회귀 신호 차단을 위한 정리 필요)
- 분류: 테스트 인프라 / 사전 결함
- 근거 위치:
  - `tests/dashboard-read-model-v0.test.ts:171` — `ApiDashboardDataProvider.fetchImpl`가 `notStrictEqual(actual, undefined)`에서 fail
  - `tests/mcp-gateway-v0.test.ts:166` — MCP tool 결과의 `hasSecret(...)`가 `true`(redaction 미적용)
  - `tests/mcp-gateway-v0.test.ts:289` — API/dashboard 응답 `hasSecret` true
- 현재 동작: 격리 실행 시에도 동일하게 fail → SecretRef 테스트의 `process.env` 변경에 의한 오염이 아님(테스트가 finally에서 복원함)
- 기대 동작: PASS 또는 SecretRef v1과 분리된 별도 이슈로 트래킹
- 문제 설명: secretref-provider-credentials-v1.test.ts는 격리 실행 시 10/10 PASS. 따라서 v1 완료 판정에 대한 blocking issue는 아니나, MCP Gateway는 도구 입력/출력에 들어온 `AICHESTRA_GITHUB_TOKEN=ghp_hidden` 같은 문자열을 redaction하지 않는다는 점이 드러남. 이는 v1.md의 “secret value 어디에서도 노출 금지” 원칙의 **확장된 경계** 문제.
- 영향: SecretRef v1 자체는 깨끗하나, 동일한 redaction 정책을 사용해야 하는 MCP Gateway는 누설 경로 보유.
- 권장 수정: 별도 follow-up 이슈로 분리 — MCP Gateway에 `applySecurityRedaction` 적용 또는 invocation output sanitization.
- 필요 테스트: 이미 있음(`mcp-gateway-v0.test.ts:151, 256`). 통과시키는 작업 필요.

### Issue #2: 신선한 워크스페이스에서 typecheck가 missing-module로 실패
- 심각도: **Low**
- 분류: 빌드/환경 인프라
- 근거 위치: 첫 `pnpm typecheck` 실행 시 `Cannot find module '@aichestra/auth'`, `'@aichestra/mcp-gateway'` — `node_modules/@aichestra/`에 두 패키지가 symlink되지 않은 상태였음. `pnpm install --frozen-lockfile` 실행 후 정상화.
- 현재 동작: 일부 환경에서 워크스페이스 symlink 누락
- 기대 동작: 첫 clone/checkout 후에도 즉시 typecheck PASS
- 문제 설명: pnpm-lock.yaml/pnpm-workspace.yaml 자체는 일관됨. node_modules가 부분 상태로 남은 것이 원인. `package.json`의 `prepare` 또는 `postinstall`로 보강 가능.
- 영향: 신규 기여자나 fresh CI에서 혼란 가능.
- 권장 수정: README/AGENTS.md에 "fresh checkout 후 `pnpm install` 필수" 안내 추가, 또는 `prepare` 스크립트로 자동화.
- 필요 테스트: CI에 `pnpm install --frozen-lockfile && pnpm typecheck` 단계가 이미 있다면 PASS. 없다면 추가.

### Issue #3: `revoked` SecretRef + legacy env 동시 존재 시 우회 차단을 명시적으로 검증하는 테스트 부재
- 심각도: **Low**
- 분류: 테스트 부족
- 근거 위치: `tests/secretref-provider-credentials-v1.test.ts:367–371` — revoked SecretRef는 `githubCredentialStatus: "denied"`까지만 단언하며, 이때 환경에 `AICHESTRA_GITHUB_TOKEN`이 동시에 존재해도 우회되지 않는지를 직접 단언하지 않음.
- 현재 동작: 코드(`provider-factory.ts:160–179`)는 `_SECRET_REF`가 설정되어 있으면 resolver 결과만 사용하고 legacy 경로로 떨어지지 않음. 즉 우회 불가. 테스트로도 입증되어 있긴 하나 “동시 설정 환경”에서의 명시적 negative case가 더 강한 회귀 안전장치가 됨.
- 기대 동작: 동일 환경에서 `runtime.config.githubCredentialStatus === "denied"`이면서 `runtime.config.githubCredentialSource === "secret_ref"`(legacy로 떨어지지 않음)임을 단언.
- 권장 수정: 기존 테스트의 revoked 케이스에 단언 1줄 추가 + LLM도 동일.
- 필요 테스트: `assert.equal(revoked.config.githubCredentialSource, "secret_ref")`

### Issue #4: legacy env fallback에 대한 audit/감사 시그널 부재
- 심각도: **Low** (v1 Known Limitations에서 호환성 목적으로 허용된 동작)
- 분류: legacy fallback risk / 감사 사각지대
- 근거 위치: `provider-factory.ts:180–184`, `providers.ts:739–747` — legacy env 사용 시 `SecurityControlService.audit`에 이벤트 기록 없음(설정 시점에서 GitProviderRuntimeConfig만 갱신).
- 현재 동작: legacy env로 토큰을 사용해도 security audit log에 흔적 없음.
- 기대 동작(v2): `credential_legacy_env_fallback_used` 같은 metadata-only 이벤트로 감사 기록.
- 권장 수정(v2): SecurityControlService에 legacy fallback 보고 API 추가 또는 GitIntegrationService/LLMGatewayService 시작 시점에 audit 이벤트 기록.
- 필요 테스트(v2): legacy 사용 시 audit 이벤트 단언.

### Issue #5: 문서의 “legacy fallback 위험” 서술이 한 문장에 한정
- 심각도: **Low**
- 분류: 문서 부족
- 근거 위치: `docs/foundations/secretref-provider-credentials/v1.md:154` — Known Limitations에 “Legacy direct env fallback remains supported for compatibility when no `*_SECRET_REF` is configured” 한 줄.
- 기대 동작: legacy fallback의 정확한 트리거(`*_SECRET_REF` 미설정), 미감사 사실, v2 deprecation 계획을 한 단락으로 분리.
- 권장 수정: “Legacy Env Fallback” 섹션을 추가하고 v2 deprecation roadmap 한 줄.

---

## 5. Legacy fallback 판정

| 질문 | 판정 | 근거 | 권장 조치 |
|------|------|------|----------|
| SecretRef resolve 실패 시 legacy fallback 허용 여부 | **불허** | `provider-factory.ts:160–179`, `providers.ts:714–737` — `_SECRET_REF` 설정 시 resolver 결과만 사용, missing/denied/revoked는 그대로 반환 | 유지 |
| disabled/revoked SecretRef가 legacy fallback으로 우회 가능한지 | **불가능** | revoked SecretRef는 `status: "denied"` 반환, legacy 경로 분기 없음 (test:367–371에서 입증) | 우회 불가 — negative test 1줄 추가 권장 |
| EnvSecretProvider disabled 상태에서도 direct env fallback 가능한지 | **`*_SECRET_REF` 미설정 시에만 가능** | EnvSecretProvider disabled여도 `_SECRET_REF`가 없으면 factory가 `process.env.AICHESTRA_GITHUB_TOKEN`/`AICHESTRA_LLM_API_KEY`를 직접 읽음 — 의도된 “호환성 fallback” | v1에서는 의도된 동작, v2에서 audit/deprecation 추가 |
| v1에서 허용 가능한지 | **조건부 가능** | 문서에 명시되어 있고 SecretRef-first 경로가 우회되지 않으므로 v1 spec 부합 | 허용 |
| v2에서 제거 또는 강한 gate가 필요한지 | **필요** | 감사 사각지대 + 호환성 명목의 무기한 잔존 위험 | v2: deprecation flag(`AICHESTRA_ALLOW_LEGACY_ENV_CREDENTIALS=false` default), legacy 사용 시 audit 강제 |

---

## 6. Secret 노출 경로 점검

| 경로 | 노출 가능성 | 현재 방어 | 결과 | 권장 조치 |
|------|----------:|----------|------|----------|
| API response | 없음 | `containsRawSecretField` 입력 차단(main.ts:430), `secretRefToDto/credentialResolutionResultToDto`에서 value drop, `sanitizeDtoMetadata`로 token/secret/key/credential/prompt 키 redact | PASS | 유지 |
| /health response | 없음 | `getConfig()`만 노출(value/env key는 `allowedSecretEnvKeyCount`처럼 count로만), `productionSecretInjection: false` | PASS | 유지 |
| dashboard read model | 없음 | `dashboard-read-model.ts:450–485` `sanitizeDashboardObject/Array`만 사용, `rawValuesExposed: false` 라벨 | PASS | 유지 |
| audit log | 없음 | `service.ts:1110–1117` recordAudit가 `sanitizeMetadata`를 강제 적용; 별도 `credential_value_redacted` 이벤트로 redaction 사실까지 감사 | PASS | 유지 |
| application log | 확인 필요 | 명시적 console 로깅 경로 미발견. `console.error(error.message)`(main.ts:3794)는 startup 전용 | PASS | 코드 리뷰 시 신규 logger 도입에 redaction wrapper 강제 |
| exception message | 없음 | `Error(validation.errors.join("; "))` 메시지에 raw secret 노출 가능 키워드(`raw secret material`/`credential cache paths`)는 분류 라벨이며 값 미포함 | PASS | 유지 |
| validation error | 없음 | API 400 응답이 “Credential ref rejected”로만 표기, 구체 값 미반환 | PASS | 유지 |
| test snapshot | 없음 | 테스트는 `noSecretValue(...)` 헬퍼로 모든 응답에 sentinel 문자열 부재를 단언(`tests/...test.ts:66–74`) | PASS | 유지 |
| provider error propagation | 없음 | `redactLlmText`(providers.ts:808)가 OpenAI 응답/에러 메시지 모두 redact 후 reason 문자열로 변환 | PASS | 유지 |

---

## 7. 테스트 실행 결과

| 명령 | 결과 | 비고 |
|------|------|------|
| pnpm lint | **pass** | `lint passed` |
| pnpm typecheck | **pass** | 단, fresh 워크스페이스에서 `@aichestra/auth`/`@aichestra/mcp-gateway` symlink 누락으로 첫 시도 실패 → `pnpm install --frozen-lockfile` 후 정상화 |
| pnpm test | **fail (197 pass / 3 fail / 4 skip)** | 실패 3건 모두 SecretRef v1과 무관: `dashboard-read-model-v0.test.ts:143`, `mcp-gateway-v0.test.ts:151`, `mcp-gateway-v0.test.ts:256` (각각 격리 실행에서도 동일하게 실패 — 사전 결함) |
| `node --test tests/secretref-provider-credentials-v1.test.ts` | **pass (10/10)** | 격리 실행 시 모든 SecretRef v1 테스트 통과 |
| pnpm build | **pass** | `build passed` |
| git diff --check | **pass** | 출력 없음(공백/whitespace 이슈 없음) |

스킵된 테스트:
- `postgres storage provider satisfies repository contracts`(`AICHESTRA_TEST_DATABASE_URL` 미설정으로 skip — 의도된 conditional skip)
- 그 외 3건: 환경 의존 테스트(런타임/연동 게이트가 명시적으로 설정되지 않은 경우 self-skip)

---

## 8. 누락 테스트 목록

| 테스트명 | 누락 이유 | 우선순위 | 권장 위치 |
|---------|----------|--------|----------|
| `revoked GitHub SecretRef does not silently fall back to AICHESTRA_GITHUB_TOKEN even when both are set` | 동시 설정 환경에서 우회 불가 명시 단언 부재 | Medium | `tests/secretref-provider-credentials-v1.test.ts` (Real Git Adapter 케이스 확장) |
| `revoked LLM SecretRef does not silently fall back to AICHESTRA_LLM_API_KEY even when both are set` | 동상 | Medium | 동상 |
| `EnvSecretProvider disabled but legacy AICHESTRA_*_TOKEN set: legacy fallback works only when *_SECRET_REF unset` | 호환성 동작의 boundary 단언 부재 | Medium | 동상 |
| `API POST /security/credentials/refs rejects malformed envKey (lowercase, with dash, with =value)` | envKey 검증은 service 레이어에서 수행되나 API 레이어 negative path 단언 부재 | Low | 동상 |
| `provider_api_call purpose end-to-end` | `provider_api_call`/`webhook_verification_future` purpose enum은 검증되나 흐름 테스트 없음 | Low | 동상 |
| `audit event for legacy env fallback usage` | 현재 미구현, v2에서 추가 시 회귀 안전 | v2 후 작성 | 동상 |

---

## 9. 문서 보강 필요 사항

| 문서 | 부족한 내용 | 심각도 | 권장 보강 |
|------|------------|------|----------|
| `docs/foundations/secretref-provider-credentials/v1.md` | “Legacy Env Fallback” 별도 섹션 — 트리거 조건(`*_SECRET_REF` 미설정), audit 미기록 사실, v2 deprecation 로드맵 | Low | Known Limitations 위에 1단락 추가 |
| `v1.md` / `AGENTS.md` | EnvSecretProvider가 활성화돼도 `*_SECRET_REF`가 없으면 legacy 경로가 그대로 동작한다는 사실을 “Configuration Examples” 표로 명시 | Low | 표 1개(SecretRef set/unset × Env provider on/off → 결과 매트릭스) |
| `README.md` 또는 `AGENTS.md` | fresh checkout 시 `pnpm install` 필수(workspace symlink 복구 목적) | Low | 한 문장 추가 |

---

## 10. 최종 권고

**`2. v1_implemented 유지 가능하지만 minor follow-up issue 생성 필요`**

근거: SecretRef v1의 spec(mock-first, safe default, env provider 기본 비활성화, allowlist, secret value 비노출, audit/redaction, GitHub/LLM SecretRef-first, legacy fallback 위험 문서화, Vault/cloud manager/BYOK/OAuth/WIF/IAM 미구현 명시)이 전부 충족되었고, 전용 테스트 10건이 모두 통과하며, secret 노출 경로 점검 결과 모든 v1 경계에서 PASS. blocking 결함 없음.

다음 작업 우선순위 권고:
1. **SecretRef v1 hardening (가장 먼저)** — Issue #3, #4, #5 처리(legacy fallback 단언 테스트 2건 + audit 이벤트 + 문서 단락 1개). 작업량 작고 v1 안전망을 강화.
2. **Secrets/Sandbox v1** — production-ready 방향. SecretRef 모델은 이미 깔려 있으므로 Vault/cloud secret manager adapter 추가 자연스러움.
3. **MCP Gateway redaction follow-up** — Issue #1의 MCP tool output redaction(Secret leakage 경로). SecretRef와 별개 이슈로 분리해 처리.
4. (보조) **Node/pnpm/Volta engine 정리** — Issue #2 환경 안정화. Volta 핀과 `pnpm install` 자동화 안내.

Real Git Adapter v2 / LLM Gateway v2 multi-provider routing / Policy-as-code v1은 현재 SecretRef v1의 안전성에 의존하므로, 위 1번을 먼저 처리한 뒤 진행해도 손해 없음.

---

## 검수 원칙 적용 노트

- secret value 노출 가능성: 9개 경로(§6) 전수 점검, blocking 누설 없음.
- mock-first/safe default: 기본 비활성화 + AICHESTRA_ENABLE_ENV_SECRET_PROVIDER 강제 — 깨지는 지점 없음.
- disabled/revoked + legacy fallback 우회: 코드상 불가능, 단 명시 negative test 1건 누락(Issue #3).
- 테스트 pass에만 의존하지 않음: 격리 실행/`Object.defineProperty` 트랩/redaction 패턴/audit 이벤트 enum/문서 cross-check 전부 검증.
- 코드/테스트/문서/API/dashboard/health 일관성: 일치 — `credentialManagerKind: "secretref_env_v1"` 라벨이 service/health/dashboard에 동일 노출.
- 추측 회피: legacy fallback 우회 불가 단언은 코드 라인 인용으로 입증(`provider-factory.ts:160–179`).

> 이번 검수에서는 새로운 구현 제안보다 “v1 완료로 인정 가능한가?”가 우선이었으며, blocking issue 0건, non-blocking issue 5건을 분리해 위 Issue #1~#5로 정리했습니다.

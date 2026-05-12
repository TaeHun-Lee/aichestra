# SecretRef-backed Provider Credentials v1 보안 감사

> **검토일**: 2026-05-12
> **대상**: 커밋 `75adac9` 이후 SecretRef v1 추가분
> **작성자**: Claude (claude-opus-4-7)
> **선행 감사**: [`2026-05-12-audit_claude_01.html`](2026-05-12-audit_claude_01.html), [`2026-05-12-ai-behavior-audit.claude.md`](2026-05-12-ai-behavior-audit.claude.md)
> **검증 결과**: lint/typecheck/test(167/170)/build pass — 본 audit은 코드 정독 기반

---

## 1. 전체 요약

### 평가
**전반적 품질 우수.** SecretRef → 정책 → lease → transient internal value → audit/redaction 흐름이 설계대로 구현되어 있고, secret value가 외부 응답·audit·dashboard·health에 노출되지 않는 핵심 계약은 코드와 테스트로 강하게 보장됩니다. 특히 다음은 **설계 대비 개선 구현**:

- `resolveCredential`(public) vs `resolveCredentialForInternalUse`(internal) 명시 분리. value 분기를 destructure로 강제 제거 (`packages/security/src/service.ts:227–231`).
- 정책 게이트 3단(`provider.credential.resolve` → `secret.lease.request` → `secret.lease.issue`)이 env 읽기 **전에** 적용됨 (`service.ts:696–774`).
- `disabled`/`revoked` 검사가 정책·env 호출 전에 단축평가 (`service.ts:664–682`).
- API의 `containsRawSecretField` + 서비스의 `hasRawSecretMaterial` + redaction의 패턴 매칭 — 다층 방어.
- 테스트의 `Object.defineProperty(env, "CUSTOM_SECRET", { get() { throw } })` 트랩(`tests/secretref-provider-credentials-v1.test.ts:267–272`)으로 "정책 거부 시 env가 절대 읽히지 않음"을 능동 검증.

### 가장 위험한 5가지

1. **[High] SecretRef 메타데이터 중첩 raw secret 우회 가능** — `metadata: { provider: { token: "ghp_xxx" } }`처럼 한 단계 이상 nested된 raw secret은 API/서비스 양쪽 검사를 통과하고 저장 + DTO 노출됨 (Issue #SR1).
2. **[Medium] EnvSecretProvider allowlist 비어있을 때 fail-open** — `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true`인데 `AICHESTRA_ALLOWED_SECRET_ENV_KEYS`가 빈 문자열/미설정이면 모든 env key를 읽음 (`packages/security/src/credentials.ts:45`) (Issue #SR2).
3. **[Medium] `requestLease` audit 결과 라벨 버그** — issued 케이스에서도 `secret_lease_requested` 이벤트가 `result: "blocked"` 하드코딩 (`service.ts:286`) → 감사 로그 신뢰성 저하 (Issue #SR3).
4. **[High][잔존] credential 변이 API에 인증/권한 0건** — 누구나 `POST /security/credentials/refs`로 SecretRef 생성·status 변경 가능, `actorId`는 body 입력 (이전 감사 #2/#4와 동일 패턴 — 재확인 필요).
5. **[Medium] LLM 메타데이터 sanitize 일관성 미해결** — git-adapter / dashboard / security 모듈은 재귀 sanitize지만 LLM Gateway는 여전히 shallow (이전 감사 #9, 본 audit에서 미해결).

### 즉시 수정이 필요한 항목
- #SR1 (nested metadata 우회) — 서비스 `hasRawSecretMaterial` + `sanitizeMetadata` 재귀화
- #SR2 (allowlist fail-open) — 빈 allowlist일 때 deny로 변경, 또는 enable 시 allowlist 필수화
- #SR3 (audit 라벨 버그) — issued 케이스에서 `result: "allowed"` 또는 `"created"`로 변경
- 인증/권한 (이전 #2/#4) — 본 v1 작업과 별개로 즉시 처리 권장

### v2로 넘겨도 되는 항목
- Vault/cloud secret manager 통합
- Legacy direct env fallback 제거 (전환 PR로)
- credential persistence (Postgres SecretRef 저장)
- BYOK / OAuth / WIF / IAM
- Postgres credential repository contract test

### 치명적 문제 여부
**즉시 secret value를 외부로 누출시키는 치명적 결함은 발견되지 않음.** Nested metadata 우회(#SR1)는 실제 위협이 되려면 공격자가 변이 API에 접근할 수 있어야 하는데, 그 시점이면 이미 인증 부재(이전 #4)가 더 큰 문제. 즉, "현재 mock-first/dev-first 단계"에서는 v1 허용 가능하나, "외부 노출 환경"으로 가기 전에 #SR1·#SR2·인증 3건은 반드시 닫아야 함.

---

## 2. 설계-구현 추적 매트릭스

| 설계 항목 | 기대 동작 | 현재 구현 위치 | 실제 동작 | 일치 여부 | 심각도 |
|---|---|---|---|---|---|
| SecretRef provider/kind/envKey/status 모델 | 메타데이터만, raw value 없음 | `packages/security/src/types.ts:23–35` | 일치 — value 필드 0 | 일치 | — |
| disabled/revoked 차단 | resolve 전 단축평가 | `service.ts:664–682` | OK — 정책 호출 전 차단 | 일치 | — |
| `EnvSecretProvider` 기본 비활성 | flag 없으면 false | `credentials.ts:22, 36–38, 59` | OK — `enabled ?? false`, env 읽기 차단 | 일치 | — |
| allowlist 강제 | 지정된 env key만 | `credentials.ts:45–47` | **부분** — `length > 0`일 때만 enforced; 빈 allowlist는 통과 | 부분 일치 | **Medium** |
| 단일 env key 한정 | 명시된 envKey만 | `credentials.ts:48` | OK — `this.env[secretRef.envKey]` 1회 read | 일치 | — |
| API에서 raw secret 거부 | top-level value/token/secret/key 차단 | `apps/api/src/main.ts:306–313` | **부분** — top-level + 일부 string 패턴; nested 객체 미검사 | 부분 일치 | **High** |
| 서비스에서 raw secret 거부 | metadata에 raw 차단 | `service.ts:1030–1038, 1090–1099` | **부분** — 메타데이터 top-level만 검사 + sanitize도 shallow | 부분 일치 | **High** |
| `resolveCredential` value 비노출 | public DTO에 value 없음 | `service.ts:227–231` (destructure 제거), `dto.ts:45–57` | OK — `containsSecretMaterial: false` 고정 | 일치 | **개선 구현** |
| `resolveCredentialForInternalUse` value 전달 | adapter 경계만 | `providers.ts:473`, `provider-factory.ts:164` | OK — Git/LLM factory 내부에서만 사용 | 일치 | — |
| GitHub `*_SECRET_REF` 우선 | SecretRef 설정 시 legacy 무시 | `provider-factory.ts:160–179` | OK — SecretRef 설정되면 legacy 경로 미진입, fail 시 fallback 안함 | 일치 | **개선 구현** |
| LLM `*_SECRET_REF` 우선 | 동일 | `providers.ts:463–488` | OK | 일치 | **개선 구현** |
| disabled SecretRef → legacy fallback 차단 | 우회 금지 | `provider-factory.ts:160–179` | OK — `if (config.githubTokenSecretRef)` 분기에서 결과 그대로 반환 | 일치 | — |
| EnvSecretProvider 비활성 → legacy direct env | env_secret_provider와 무관하게 legacy 작동 | `provider-factory.ts:180–183`, `providers.ts:488–495` | OK (의도) — legacy는 env_secret_provider 게이트와 독립 | 일치 (의도) | Medium (위험성) |
| audit `secret_lease_requested` 결과 | 이슈된 lease는 allowed | `service.ts:282–296` | **불일치** — `result: "blocked"` 하드코딩 | 잘못된 구현 | **Medium** |
| credential 변이 API 인증 | 신뢰 actor 필요 | (없음) | 미구현 | 미구현 | **High (잔존)** |
| `PATCH .../status`로 active 재활성화 차단 | revoked는 단방향 | `service.ts:195–221` | **부분** — revoked → active 전이 가드 없음 | 부분 일치 | **Medium** |
| Health/Dashboard에 value 노출 0 | OK | `apps/api/src/main.ts:498–510`, `dashboard-read-model.ts:344–370` | OK — config 메타만, sanitize 통과 | 일치 | — |
| audit/redaction 패턴 | bearer/api key/credential cache | `redaction.ts:17–44`, `service.ts:1076–1088` | OK — `sk-`, `ghp_`, `github_pat_`, `AIza`, `Bearer`, `~/.codex`, `~/.claude` 모두 커버 | 일치 | **개선 구현** |
| Sanitize 일관성 (기존 audit #9) | 모든 모듈이 동일 깊이 | `llm-gateway/gateway.ts:811` (얕음) vs `git-adapter/service.ts:892`, `shared/dashboard-read-models.ts:205+`, `security/redaction.ts:60–74` (재귀) | **불일치** — LLM Gateway만 shallow | 부분 일치 | **Medium (잔존)** |
| `secretRefToDto`에 envKey 노출 | 이름 노출 OK, value 금지 | `dto.ts:18–34` | OK (이름만) — 단 정보 disclosure | 일치 (의도) | Low |
| `containsSecretMaterial: false` 표시 | 응답 명시 | `dto.ts:32, 41, 55, 69` | OK | 일치 | **개선 구현** |
| 테스트의 능동 누출 검사 | env getter trap | `tests/secretref-provider-credentials-v1.test.ts:267–272` | OK — env가 정책 전에 읽히면 throw | 일치 | **개선 구현** |

---

## 3. 발견된 이슈 목록

### Issue #SR1: SecretRef 메타데이터 nested raw secret 우회

- **분류**: 보안 / secret leakage / validation 부족
- **심각도**: **High**
- **확신도**: 높음
- **관련 설계**: `docs/foundations/secretref-provider-credentials/v1.md` 18행 — "API create/update paths reject raw token fields, credential cache paths, and raw secret-like metadata."
- **현재 구현**:
  - API: `apps/api/src/main.ts:306–313` `containsRawSecretField` — body의 top-level만 검사
  - 서비스: `packages/security/src/service.ts:1030–1038` `hasRawSecretMaterial` — `Object.entries(metadata).some(...)` top-level만
  - Sanitize: `service.ts:1090–1099` `sanitizeMetadata` — top-level만
  - DTO: `packages/security/src/dto.ts:127–135` `sanitizeDtoMetadata` — top-level만
- **문제점**: `metadata: { provider: { token: "ghp_realtoken" } }`처럼 1단 이상 nested된 raw secret이 4개 검사 모두 통과 → 저장 → `GET /security/credentials/refs`로 그대로 반환됨.
- **실패 시나리오**:
  ```bash
  curl -X POST .../security/credentials/refs -d '{
    "id":"secretref_x","name":"x","provider":"env","secretKind":"github_token",
    "envKey":"AICHESTRA_GITHUB_TOKEN","scope":"scope_env_provider_credentials",
    "metadata":{"creds":{"token":"ghp_REALTOKEN_HERE"}}
  }'
  curl .../security/credentials/refs   # ← ghp_REALTOKEN_HERE 노출
  ```
- **영향**: SecretRef 모델의 핵심 계약("never contains raw secret values")이 깨짐. 추후 SecretRef가 dashboard·audit export에 흘러갈 때 secret 노출.
- **권장 수정**:
  - `hasRawSecretMaterial`을 재귀화 — 모든 깊이의 key/value에 대해 검사.
  - `sanitizeMetadata`(security 내부 + DTO 내부)도 재귀화 → `packages/shared`에서 통합 헬퍼로 이전 권장.
  - API `containsRawSecretField`도 동일 헬퍼 사용.
- **추가 테스트**: `hasRawSecretMaterial detects nested raw token in metadata`, `dto strips nested raw token from metadata`, `POST /security/credentials/refs rejects nested raw secret in metadata`.

---

### Issue #SR2: EnvSecretProvider 빈 allowlist 시 fail-open

- **분류**: 보안 / policy bypass / safe default
- **심각도**: **Medium**
- **확신도**: 높음
- **관련 설계**: v1.md 31행 — "If `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` is configured, the `SecretRef.envKey` must be in the allowlist." 현재 문구가 "if configured"로 빈 allowlist 처리를 명시하지 않음.
- **현재 구현**: `packages/security/src/credentials.ts:45–47`
  ```ts
  if (this.allowedEnvKeys.length > 0 && !this.allowedEnvKeys.includes(secretRef.envKey)) {
    return { ok: false, status: "denied", reason: "env_key_not_allowlisted" };
  }
  ```
- **문제점**: `length > 0`일 때만 검사 → `enabled=true`인데 allowedEnvKeys가 빈 배열이면 SecretRef의 어떤 envKey든 읽음.
- **실패 시나리오**: 운영자가 `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true`만 설정하고 `AICHESTRA_ALLOWED_SECRET_ENV_KEYS`를 설정/오타. 모든 env key 읽기 가능 → SecretRef의 envKey만 바꾸면 임의 env 변수(`HOME`, `USER`, `OPENAI_API_KEY` 등) 값을 transient credential value로 가져갈 수 있음.
- **영향**: 안전 기본값 위반. Defense-in-depth가 깨짐.
- **권장 수정**:
  - `if (this.allowedEnvKeys.length === 0 || !this.allowedEnvKeys.includes(secretRef.envKey)) { return deny }` 로 변경 (fail-closed).
  - 또는 `EnvSecretProvider` 생성자에서 `enabled=true`인데 `allowedEnvKeys=[]`면 throw.
  - v1.md를 "enable 시 allowlist는 필수, 빈 값이면 deny" 로 명시.
- **추가 테스트**: `EnvSecretProvider with empty allowlist denies all reads when enabled`.

---

### Issue #SR3: `requestLease` audit 이벤트 결과 라벨이 항상 "blocked"

- **분류**: 운영 리스크 / 로깅 정확성
- **심각도**: **Medium**
- **확신도**: 높음
- **관련 설계**: audit는 정확한 결과를 기록해야 함. `secret_lease_issued_mock`/`secret_lease_denied`는 별도 이벤트로 정확하지만, `secret_lease_requested`는 결과 레이블링이 의도된 듯.
- **현재 구현**: `packages/security/src/service.ts:282–296`
  ```ts
  this.recordAudit({
    eventType: "secret_lease_requested",
    result: "blocked",   // ← issued여도 blocked로 기록
    ...
  });
  ```
- **문제점**: 이슈된 lease 요청도 `result: "blocked"`로 기록됨 → 감사 로그를 result로 필터링하면 issued 요청을 잃거나 잘못 분류함.
- **실패 시나리오**: 보안 운영자가 `result=blocked`로 audit을 쿼리해 "거절된 시도" 통계를 뽑으면 정상 issued 케이스가 다 섞여 노이즈 폭증.
- **영향**: 감사 신뢰성, 알림 정확도.
- **권장 수정**: `result: status === "issued" ? "allowed" : "blocked"`로 변경. 또는 `secret_lease_requested` 이벤트는 `result: "allowed"`(요청 자체는 처리됨)로 통일하고, 결과는 후속 `secret_lease_issued_mock`/`secret_lease_denied`에서 표현.
- **추가 테스트**: `secret_lease_requested audit reflects issued vs denied outcome`.

---

### Issue #SR4: revoked SecretRef 재활성화(active) 차단 없음

- **분류**: 설계 불일치 / 운영 리스크
- **심각도**: Medium
- **확신도**: 높음
- **관련 설계**: 명시 없음. 일반적 보안 모델: revoke는 단방향(영구 무효화), disable은 양방향. v1.md 16행에 단순히 `active|disabled|revoked` 나열만.
- **현재 구현**: `service.ts:195–221` `updateSecretRefStatus` — 어떤 상태에서 어떤 상태로든 자유 전이.
- **문제점**: `revoked` 상태로 봉인된 SecretRef를 같은(또는 침해된) actor가 `PATCH .../status {status:"active"}`로 되돌리면 다시 사용 가능. revoke의 의미가 약화됨.
- **실패 시나리오**:
  1. 운영자가 token 유출 우려로 SecretRef revoke
  2. 공격자(또는 잘못된 자동화)가 status를 active로 되돌림
  3. 다시 credential 발급
- **영향**: revoke의 단방향 보안 보장 부재.
- **권장 수정**: `if (current.status === "revoked" && status !== "revoked") throw` 가드 추가. 문서에도 명시.
- **추가 테스트**: `revoked SecretRef cannot be re-activated`.

---

### Issue #SR5: SecretRef 변이 API에 인증·권한 부재 (잔존, 이전 #2/#4)

- **분류**: 보안 / 인증 부재
- **심각도**: **High** (운영 단계 진입 시 Critical)
- **확신도**: 높음
- **관련 설계**: 본 v1 plan은 인증/권한 명세 없음. 이전 audit-remediation에 이슈로 등록됨.
- **현재 구현**: `apps/api/src/main.ts:651–696` 모든 credential 변이 라우트가 미들웨어 0건. `actorId`는 body 입력값.
- **문제점**: 누구든 `POST /security/credentials/refs`로 임의 SecretRef 생성, `PATCH .../status`로 임의 상태 변경, `actorId`도 위조.
- **실패 시나리오**: 외부 노출 환경에서 공격자가 `secretRef_xxx`를 disabled로 만들어 운영 차단(DoS), 혹은 새 SecretRef 등록 후 envKey allowlist의 키와 일치시켜 자신의 ref로 credential 발급 트리거.
- **영향**: 거버넌스/감사 무력화.
- **권장 수정**: 본 v1 작업과 별개로 인증 미들웨어 + 권한기 결선 우선 처리. 단기적으로 `X-Aichestra-Actor` trusted 헤더 강제.

---

### Issue #SR6: LLM Gateway sanitize 여전히 shallow (이전 #9 잔존)

- **분류**: 보안 / sanitize 일관성
- **심각도**: Medium
- **확신도**: 높음
- **현재 구현**: `packages/llm-gateway/src/gateway.ts:811–819` — top-level key 이름만 검사. 본 v1 작업에서 변경 없음.
- **문제점**: SecretRef 쪽은 좋은 sanitize를 추가했지만 LLM Gateway audit·usage 메타는 여전히 nested secret 통과 가능.
- **권장 수정**: `packages/security/src/redaction.ts`의 `sanitizeSecurityMetadata`(line 56–74)를 `packages/shared`로 옮기고 LLM Gateway·git-adapter·dashboard·security 4곳 모두 사용. 패턴/키 목록 한 곳에서 관리.
- **추가 테스트**: `LLM gateway sanitizeMetadata redacts nested keys`.

---

### Issue #SR7: `secretRefToDto`가 envKey 이름을 항상 노출

- **분류**: 정보 disclosure (낮은 심각도)
- **심각도**: Low
- **확신도**: 높음
- **현재 구현**: `dto.ts:24` — `envKey: secretRef.envKey` 그대로 노출. `envKeyConfigured: Boolean(secretRef.envKey)`도 함께.
- **문제점**: 인증 없는 `GET /security/credentials/refs`에서 모든 envKey 이름이 노출 → 공격자에게 credential 매핑 정보 제공.
- **영향**: 단일 leak는 아니지만 인증 부재(#SR5)와 결합 시 surface mapping 도움.
- **권장 수정**: 두 가지 옵션 (a) DTO에서 `envKey` 제거하고 `envKeyConfigured`만 유지(엄격), (b) 권한 분리 — admin role만 envKey 이름 조회 가능. 인증이 들어오기 전에는 (a).
- **추가 테스트**: `secretRefToDto omits envKey when caller lacks credential.read.admin`.

---

### Issue #SR8: `validateSecretRef`가 매 resolve마다 재호출되어 audit 폭증

- **분류**: 운영 리스크 / 노이즈
- **심각도**: Low
- **확신도**: 중간
- **현재 구현**: `service.ts:684` — `resolveCredentialInternal`마다 `validateSecretRef` 호출 → line 144–156에서 audit `secret_ref_validated` 이벤트 매번 기록.
- **문제점**: credential resolve가 빈번한 워크플로우에서 audit 테이블이 같은 SecretRef에 대한 validated 이벤트로 가득 참. resolve 자체의 audit과 중복.
- **권장 수정**: validate를 createSecretRef 시점에만 audit. resolve 시 validation은 silent (실패 시에만 audit).

---

## 4. Legacy fallback 별도 판단

| 질문 | 판단 |
|---|---|
| 1. SecretRef 설정 + resolve 실패 시 legacy fallback 허용? | **불가 (현재 구현이 올바름).** `provider-factory.ts:160–179`와 `providers.ts:463–472`는 `*_SECRET_REF`가 설정되면 legacy 경로 진입을 차단하고 결과를 그대로 반환. SecretRef → legacy 자동 fallback은 disabled/revoked 상태 우회로 즉시 사고. **계속 막아야 함.** v1 doc에도 이 동작을 명시 권장. |
| 2. disabled/revoked 상태에서 legacy fallback 우회 가능? | **현재 불가능.** 위 1번과 동일 메커니즘. `if (config.githubTokenSecretRef)` 분기 안에서 종료되므로 disabled/revoked 결과가 fallback으로 흘러가지 않음. **테스트는 부족** — `tests:310–313`이 status만 검증, "legacy env가 설정돼 있어도 안 읽힘"을 명시 검증하는 케이스 추가 권장. |
| 3. EnvSecretProvider disabled여도 legacy direct env가 remote credential로 사용? | **예 (의도된 동작).** Legacy `AICHESTRA_GITHUB_TOKEN`/`AICHESTRA_LLM_API_KEY`는 EnvSecretProvider 게이트와 독립. **이건 legacy 호환성을 위한 설계지만 위험.** Defense-in-depth 부재 — env provider를 비활성화한 운영자는 "credential resolve가 다 비활성"이라고 오인할 수 있음. v1.md 60/74행에 명시되어 있긴 하나 운영자 시각에서 명확히 "EnvSecretProvider disable ≠ legacy disable" 임을 강조 필요. |
| 4. v1에서 허용 가능? | **조건부 허용.** mock-first/dev-first 단계에서는 OK. **즉시 막아야 할 항목은 #SR1, #SR2, #SR5(인증).** Legacy fallback 자체는 v1 호환성 의도 — 명시적으로 막지 않아도 됨. |
| 5. v2에서 어떻게 제거/gate? | **3-단계 전환 권장**: (a) v2 도입 시 deprecation warning — `AICHESTRA_GITHUB_TOKEN` 사용 시 startup log + audit 이벤트 발생. (b) v2.1에 `AICHESTRA_DISABLE_LEGACY_CREDENTIAL_ENV=true` opt-in으로 legacy 차단. (c) v3에서 legacy 경로 코드 제거. 동시에 EnvSecretProvider 자체도 "production: 사용 금지"로 더 명확히 격리. |

---

## 5. Secret 노출 경로 점검

| 경로 | 노출 가능성 | 현재 방어 | 부족한 점 | 권장 조치 |
|---|---:|---|---|---|
| API response (`GET /security/credentials/refs`) | 낮음 | `secretRefToDto`가 value 미포함 | nested metadata 우회(#SR1), envKey 이름 노출(#SR7) | 재귀 sanitize, envKey 가시성 게이팅 |
| API response (`POST /security/credentials/resolve/check`) | 낮음 | public method가 destructure로 value 제거 | — | OK |
| API response (`POST /security/credentials/refs`) | 중간 | top-level + 일부 패턴 차단 | nested 우회(#SR1) | 재귀 검사 |
| Health (`/health`) | 매우 낮음 | config 메타·boolean 플래그만 | — | OK |
| Dashboard (`/dashboard/security`) | 낮음 | `sanitizeDashboardArray` 재귀 | secretRefs의 envKey 노출(#SR7) | 게이팅 |
| Audit log | 낮음 | `sanitizeSecurityMetadata` 재귀 + 패턴 redaction | requestLease 라벨 버그(#SR3), validate 폭증(#SR8) | 라벨 수정, validate audit 축소 |
| Application log | 낮음 | console.log 직접 호출 거의 없음 | grep 결과 직접 logging 0건 — 양호 | — |
| Exception message | 중간 | `error instanceof Error ? error.message : ...` 패턴 | `applySecurityRedaction`이 exception message에 적용되지 않음 | API/service throw 메시지에도 redaction 적용 |
| Validation error | 낮음 | "raw secret material" 류 generic 메시지 | OK — 입력값을 echo하지 않음 | OK |
| Test snapshot | 낮음 | `noSecretValue` helper로 능동 검증 | 양호 | OK |
| DTO serialization | 낮음 | `containsSecretMaterial: false` 명시 | — | OK |
| Provider error propagation | 중간 | `git-adapter/service.ts:892`의 sanitizeMetadata 재귀 | LLM Gateway는 shallow(#SR6) | 통합 sanitize |
| Git adapter boundary | 낮음 | `provider-factory.ts:101` token이 GitHubGitProvider 내부에만 머묾, audit은 `git-adapter/service.ts`가 sanitize | github-client.ts에 raw token이 `Authorization: Bearer ...`로 흘러감 — 정상이나 디버그 로그 추가 시 위험 | 향후 디버그 로그 추가 시 redaction 강제 |
| LLM provider boundary | 낮음 | `providers.ts:332`에서 OpenAICompatibleLLMProvider에만 전달 | 이전 audit #22 (apiKey 객체 필드 보관) 잔존 | lazy 전달로 변경 검토 |

---

## 6. 테스트 보강 제안

### SecretRef model/status
| 테스트명 | 입력/조건 | 기대 | 우선순위 |
|---|---|---|---|
| `hasRawSecretMaterial detects nested raw token` | `metadata: { creds: { token: "ghp_xxx" } }` | createSecretRef throws | **High (#SR1)** |
| `dto strips nested raw token from metadata` | 위 동일 | DTO 직렬화 결과에 ghp_ 부재 | **High (#SR1)** |
| `revoked SecretRef cannot be re-activated` | revoke 후 PATCH status=active | throw | Medium (#SR4) |

### EnvSecretProvider gate
| 테스트명 | 입력/조건 | 기대 | 우선순위 |
|---|---|---|---|
| `EnvSecretProvider with empty allowlist denies all reads` | `enabled=true, allowedEnvKeys=[]` | `reason: "env_key_not_allowlisted"` (또는 enable 시 throw) | **High (#SR2)** |
| `EnvSecretProvider does NOT enumerate process.env` | `Object.keys(process.env)` spy | spy 호출 0 | Medium |

### CredentialManager resolve flow
| 테스트명 | 입력/조건 | 기대 | 우선순위 |
|---|---|---|---|
| `secret_lease_requested audit reflects issued outcome` | resolve 성공 케이스 | audit `result: "allowed"` | Medium (#SR3) |
| `validateSecretRef NOT audited on every resolve` | 같은 ref를 100번 resolve | `secret_ref_validated` 이벤트 1건만 | Low (#SR8) |

### Legacy fallback risk
| 테스트명 | 입력/조건 | 기대 | 우선순위 |
|---|---|---|---|
| `SecretRef set + resolver fails + AICHESTRA_GITHUB_TOKEN set → no legacy fallback` | 둘 다 설정, resolver throws/fails | github client 미생성, token undefined | **High** (회귀 방지) |
| `SecretRef revoked + legacy env set → no fallback` | 위 동일 | 동일 | **High** |
| `EnvSecretProvider disabled + AICHESTRA_LLM_API_KEY set → legacy used (intended)` | env provider off, legacy on | legacy로 처리되며 audit에 `legacy_env_api_key_configured` 기록 | Medium (의도 동작 명시) |

### Audit/redaction
| 테스트명 | 입력/조건 | 기대 | 우선순위 |
|---|---|---|---|
| `LLM gateway sanitizeMetadata redacts nested keys` | `metadata: { provider: { apiKey: "sk-..." } }` | `[redacted]` | **High (#SR6)** |
| `applySecurityRedaction handles uppercase/case variants` | `BEARER xxxxx`, `Sk-xxxx` | redacted | Medium |
| `redaction does not corrupt non-secret strings` | "this is just text" | unchanged | Low |

### API non-secret response
| 테스트명 | 입력/조건 | 기대 | 우선순위 |
|---|---|---|---|
| `POST /security/credentials/refs rejects nested raw secret` | nested metadata | 400 + `raw_secret_value_rejected` | **High (#SR1)** |
| `secretRefToDto omits envKey when caller lacks credential.read.admin` | (인증 도입 후) | envKey absent | Low → Medium (#SR7) |

### Negative/malformed
| 테스트명 | 입력/조건 | 기대 | 우선순위 |
|---|---|---|---|
| `POST /security/credentials/refs with array as raw value` | `body.value = ["ghp_xxx"]` | 400 | Medium |
| `POST /security/credentials/refs with bigint envKey` | typeof bigint | 400 | Low |
| `PATCH .../status with unknown status` | status="frozen" | 400 | Low (이미 부분 검증됨) |

---

## 7. 문서 보강 제안

`docs/foundations/secretref-provider-credentials/v1.md` 기준:

| 누락/보강 필요 | 현재 상태 | 권장 추가 |
|---|---|---|
| `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` 빈 값 처리 명시 | "If configured, ..."만 | "Empty allowlist denies all reads when enable flag is true" 명시 (#SR2 fix와 함께) |
| Legacy fallback 위험 강조 | 60/74행에 한 줄씩 | 별도 섹션 "Legacy fallback risks" — 어떤 케이스에서 작동하는지 표로 정리 + EnvSecretProvider disable과 무관함을 명시 (#SR1 + Q3) |
| disabled/revoked 단방향 정책 | 명시 없음 | "revoked is one-way; disabled may be re-activated" 명시 (#SR4 fix 후) |
| 인증/권한 부재 경고 | 없음 | "Production: credential mutation APIs MUST be behind authenticated/authorized middleware. v1 ships without auth" 박스 처리 |
| envKey 노출 정책 | 없음 | "DTO exposes envKey name (not value). Treat as confidential metadata; gate behind admin role in production" (#SR7) |
| sanitize 통합 계획 | 언급 없음 | "v2: unify sanitize across security/git-adapter/llm-gateway/dashboard via packages/shared helper" (#SR6) |
| v2 migration path | "Real Git Adapter v2 / webhook planning, or LLM Gateway v2 multi-provider routing" 한 줄 | 별도 섹션 — legacy fallback 단계적 제거 3단계, EnvSecretProvider 격리, Vault/cloud SM 통합 순서 |
| 운영자 env 설정 가이드 | 산발적 | 별도 "Operator Setup Checklist" 섹션 — 기본 mock vs 실 LLM/Git 활성화 시 필요 env 매트릭스 |
| "secret value가 어디에도 저장/노출 안 된다" 보장 범위 | 산발적 | `containsSecretMaterial: false` 보장 범위와 nested metadata 한계(#SR1 fix 후) 명확화 |

`v1-plan.md`는 대부분 이미 v1.md로 옮겨졌으므로 plan 갱신은 불필요. plan을 **closed/superseded** 상태로 표시 권장.

---

## 8. 다음 작업 추천

| 순위 | 작업 | 이유 | 난이도 | 효과 |
|---|---|---|---|---|
| **1** | **SecretRef-backed Provider Credentials v1 hardening** (#SR1, #SR2, #SR3, #SR4 + 누락 테스트) | 보안 리스크 #1 (#SR1 nested 우회), safe default 위반 #2 (#SR2) — 현재 audit으로 발견된 결함을 v1.1로 즉시 닫는 게 가장 비용 효율적. 테스트도 함께 추가 가능. | Low–Medium | 즉시 보안 게이트 강화. v2 시작 전에 깨끗한 baseline. |
| **2** | **Sanitize 통합 helper 추출** (#SR6 + 이전 #9) | LLM Gateway sanitize shallow가 잔존. 1번과 함께 묶으면 패턴 한 곳 관리. | Low | 향후 모든 신규 audit 경로가 자동으로 안전. |
| **3** | **인증/권한 미들웨어 + actor 신뢰 헤더** (#SR5 + 이전 #2/#4) | v1의 가장 큰 잔존 위험. credential 변이 API뿐 아니라 전체 mutating route에 영향. | Medium | 외부 노출 환경 진입 가능. governance/audit actor가 진정성 갖춤. |
| 4 | **Real Git Adapter v2 / webhook planning** | 1~3 완료 후가 안전. 외부 호출이 늘어날수록 sanitize·인증·credential 게이트의 누수 위험 ↑ | Medium (설계) | webhook/이벤트 기반 자동화 가능. |
| 5 | **LLM Gateway v2 multi-provider routing** | 같은 이유로 1~3 후. 새 provider별 credential 패턴이 늘어남. | Medium | Anthropic/OpenAI/Bedrock 등 분기 가능. |
| 6 | Secrets/Sandbox v1 (실 sandbox runtime) | secret 흐름이 안정된 후. | High | 실 LLM 활성화 직전 필수. |
| 7 | Policy-as-code v1 | 정책 게이트 자체는 v0가 잘 동작. 우선도 낮음. | Medium | 룰 동적 관리. |
| **별건** | **Node/pnpm/Volta engine 정리** (Node 20 warning) | pnpm output에 Node 20 warning이 남는 환경 이슈. shell rc 정렬 + `pnpm config` 검토. 보안 리스크 아님 | Low | 빌드 로그 깨끗. |

---

## 마무리 종합 판단

본 v1 구현은 **mock-first/safe default 원칙을 잘 지켰고**, secret value가 외부 응답에 노출되지 않는 핵심 계약을 강하게 보장합니다. SecretRef 우선 흐름과 disabled/revoked 차단도 정확합니다. 다만:

- **Nested metadata 우회(#SR1)** 는 명백한 검사 빈틈으로 v1.1 패치 권장
- **빈 allowlist fail-open(#SR2)** 는 안전 기본값 원칙 위반으로 즉시 수정
- **인증 부재(#SR5)** 는 v1 범위는 아니지만 external 노출 전 반드시 차단
- 나머지(#SR3 라벨 버그, #SR4 revoked 단방향, #SR6 sanitize 통합, #SR7 envKey 노출, #SR8 validate audit 폭증)는 Medium~Low로 v1.1 또는 v2에서 순차 처리

v2(Real Git Adapter v2 / LLM Gateway v2)로 넘어가기 전에 위 1번 작업(v1.1 hardening)을 끝내는 게 모든 후속 작업의 안전 baseline을 확보합니다.

# 2026-04-09 JD Pipeline Redesign - Phase 4

## Goal

남아 있던 엔지니어링 리뷰 항목 4개를 운영 가능한 수준으로 닫는다.

- dedupe 공통화
- source config schema validation
- source 단위 scan lock / UPSERT 성격의 race hardening
- auth/session 정리

## Scope

### 1. Job dedupe 공통화

- `src/lib/job-dedupe.ts`에 공용 dedupe 규칙을 둔다.
- dedupe 우선순위는 `(source, source_id) -> raw_url -> fingerprint` 순서로 본다.
- 수동 등록과 스캔 저장이 같은 helper를 사용한다.
- 신규 DB에서는 중복이 없을 때만 `raw_url`, `(source, source_id)` unique index를 생성한다.

### 2. Scan source config validation

- `src/lib/scan-source-config.ts`에 scanner config parser/validator를 둔다.
- 저장 시점(`POST/PUT /api/scan/sources`)에 config를 canonical JSON으로 정규화한다.
- 실행 시점(`POST /api/scan/run`, `POST /api/scan/run/:sourceId`)에 저장된 JSON을 다시 검증한다.
- malformed JSON과 invalid schema는 `400 invalid source config` 계약으로 통일한다.

### 3. Source-level scan lock / race hardening

- `scan_source_locks` 테이블로 source 단위 lock을 둔다.
- 같은 source에 대해 동시에 scan이 들어오면 `ScanAlreadyRunningError`를 던지고 route는 `409`로 응답한다.
- DB duplicate 판정은 저장 트랜잭션 안에서 다시 수행한다.
- 트랜잭션 안에서 duplicate가 확인되면 해당 item만 skip하고 run 전체는 계속 완료한다.

### 4. Auth/session 정리

- `src/lib/auth.ts`는 stateless signed token 대신 DB-backed opaque session id를 사용한다.
- 로그인 시 `sessions` row를 생성하고, proxy는 row 존재 + 만료 여부를 확인한다.
- 로그아웃 시 cookie 삭제와 함께 `sessions` row도 삭제한다.
- public path는 prefix match가 아니라 exact match로 줄인다.

## Verification

- unit/integration tests:
  - auth session persistence
  - proxy exact public path behavior
  - source config validation
  - single-source scan conflict handling
  - manual job fingerprint dedupe
- repository checks:
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## Deferred

- scan pagination / truncated metadata
- source config의 채널별 richer schema
- session rotation / idle timeout
- 기존 DB에 이미 중복 row가 있는 경우의 offline reconciliation

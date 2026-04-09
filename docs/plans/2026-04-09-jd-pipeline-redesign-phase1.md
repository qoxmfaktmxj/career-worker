# JD Pipeline Redesign Phase 1 Implementation Plan

> 작성일: 2026-04-09
> 기준 문서: `docs/specs/2026-04-09-jd-pipeline-redesign.md`
> 범위: 상세 JD 분리와 AI 입력 경로 교체

## 1. 목표

Phase 1은 "상세 JD가 없는 상태에서 AI를 돌리지 않는다"를 코드와 저장 모델로 강제하는 단계다.

이번 단계의 산출물:

- jobs 저장 구조에 `listing` / `detail` 분리
- scanner orchestration에서 detail fetch 단계 추가
- job detail API 응답 확장
- AI route 전제조건 강화
- 레거시 `raw_file` 호환 유지

## 2. 구현 순서

### Step 1. 파일 저장소 확장

대상 파일:

- `src/lib/job-file-store.ts`
- 신규 테스트 파일

할 일:

- `jobs/raw` 대신 `jobs/listings`, `jobs/details`, `jobs/normalized` 기준 helper 추가
- `saveListingJob`, `readListingJob`, `deleteListingJob`
- `saveDetailJob`, `readDetailJob`, `deleteDetailJob`
- 기존 `readRawJob(jobId)`는 레거시 호환용 래퍼로 유지하거나 제거 범위를 테스트로 보호

완료 조건:

- 경로 검증이 디렉터리별로 분리됨
- 한글 포함 Markdown을 `utf-8`로 읽고 쓸 수 있음

### Step 2. 스키마 마이그레이션 추가

대상 파일:

- `src/lib/db.ts`
- DB 테스트

할 일:

- `jobs`에 아래 칼럼 추가
  - `listing_file`
  - `detail_file`
  - `detail_collected_at`
  - `detail_status`
  - `deadline_text`
  - `deadline_date`
  - `deadline_parse_status`
- 레거시 row fallback 규칙 문서화

완료 조건:

- 신규 DB와 기존 DB 모두 부팅 시 에러 없이 migration 통과

### Step 3. scanner/detail fetch 계약 추가

대상 파일:

- `src/scanners/types.ts`
- `src/scanners/saramin.ts`
- `src/scanners/jobkorea.ts`
- `src/scanners/remember.ts`
- `src/scanners/orchestrator.ts`

할 일:

- `ScanResult.raw_text`를 `listing_text`로 개명
- scanner interface에 선택적 `fetchDetail(result)` 추가
- 채널별 기본 detail fetch 구현
  - 당장 추출이 어려운 채널은 listing 기반 fallback이 아니라 `detail missing`을 명시
- orchestrator가
  - listing file 저장
  - detail fetch 시도
  - 성공 시 detail file 저장
  - 실패 시 `detail_status='failed'` 또는 `missing`
  - `workflow_status`는 이번 단계에서 없으므로 최소한 `detail_status`만 정확히 기록

완료 조건:

- scan 결과가 listing/detail 저장 상태를 분리해서 남김

### Step 4. job 조회 응답 확장

대상 파일:

- `src/app/api/jobs/[jobId]/route.ts`
- job detail 관련 UI 테스트

할 일:

- DB row의 `listing_file`, `detail_file`, `detail_status`를 읽음
- 응답에
  - `listingContent`
  - `detailContent`
  - `detail_status`
를 추가
- 레거시 row는 `raw_file` 기준 fallback

완료 조건:

- UI가 detail 유무를 분기할 수 있음

### Step 5. AI route 전제조건 강화

대상 파일:

- `src/app/api/jobs/[jobId]/evaluate/route.ts`
- `src/app/api/jobs/[jobId]/generate-answers/route.ts`
- `src/app/api/jobs/[jobId]/generate-resume/route.ts`
- `src/app/api/jobs/[jobId]/generate-reply/route.ts`
- 관련 테스트

할 일:

- 공통 helper 추가
  - job row + detail file resolve
  - detail 미준비 시 structured error 반환
- evaluate/generate-*는 `detailContent`를 우선 사용
- 레거시 row에서 detail이 없으면 AI 호출하지 않고 실패 응답

권장 응답:

- 상태코드 `409`
- `error = "job_detail_not_ready"`

완료 조건:

- listing-only 데이터로는 AI가 절대 실행되지 않음

### Step 6. UI 최소 대응

대상 파일:

- `src/app/jobs/[jobId]/page.tsx`

할 일:

- 원문 JD 영역을 `상세 JD` 기준으로 노출
- detail이 없으면 안내 문구 표시
- AI 액션 버튼은 detail 미준비면 비활성화

완료 조건:

- 사용자가 왜 생성이 막혔는지 화면에서 바로 이해 가능

## 3. 테스트 계획

필수 테스트:

- `job-file-store`
  - listing/detail 저장/조회/삭제
  - 경로 이탈 방지
- `db`
  - 신규 칼럼 migration
- `orchestrator`
  - detail fetch 성공 시 listing/detail 둘 다 저장
  - detail fetch 실패 시 job row는 생성되지만 detail은 비어 있음
- `evaluate route`
  - detail ready면 OpenClaw 호출
  - detail missing이면 409 반환
- `generate-* routes`
  - detail missing 가드
- UI
  - detail missing 안내
  - AI 버튼 비활성화

검증 명령:

```bash
npm run lint
npm run test
npm run build
```

QA:

- 로컬 서버에서 job detail 화면 열기
- detail 있는 job / 없는 job 모두 확인
- detail 없는 job에서 AI 버튼이 막히는지 확인

## 4. 리스크

- 채널별 상세 파싱이 불안정할 수 있다.
- 레거시 `raw_file` 데이터는 모두 상세 JD가 아니므로 AI 실행이 갑자기 막히는 job이 생긴다.
- 이 변화는 의도된 품질 방어이지만, 사용자 입장에서는 "전에는 되던 기능이 막힘"처럼 보일 수 있다.

대응:

- UI에서 상세 수집 미완료 메시지를 명확히 표시
- 테스트 fixture에 legacy row를 포함해 fallback 동작을 확인

## 5. Phase 2 예정

- `fit_status`, `workflow_status`, `application_status` 분리
- `deadline_text`, `deadline_date`, `deadline_parse_status` 집계 전환
- stats/jobs list 쿼리 교체

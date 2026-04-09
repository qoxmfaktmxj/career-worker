# Career Worker JD Pipeline Redesign

> 작성일: 2026-04-09
> 상태: 승인됨
> 목적: 공고 상세 수집, 상태 축 분리, 산출물 버저닝을 포함한 채용 파이프라인 저장 모델 재정의

---

## 1. 배경

현재 파이프라인은 세 가지 구조적 결함이 있다.

1. 스캐너가 공고 목록 요약만 저장하는데도 이를 "원문 JD"처럼 다뤄서 AI 평가와 생성 품질이 낮다.
2. `jobs.status` 하나에 적합도, 작업 진행 상태, 지원 상태를 함께 넣어서 통계와 화면 흐름이 깨진다.
3. 산출물 파일명과 DB 버전이 서로 독립적으로 움직여 재생성 시 덮어쓰기와 메타데이터 불일치가 발생한다.

이번 문서는 위 세 문제를 단계적으로 해소하기 위한 저장 모델과 API 계약을 정의한다.

---

## 2. 목표

### 2.1 이번 리디자인의 목표

- 목록 스냅샷과 공고 상세 본문을 분리 저장한다.
- AI 평가와 생성은 공고 상세 본문이 있을 때만 실행한다.
- `fit`, `workflow`, `application` 상태 축을 분리한다.
- `deadline_text`와 `deadline_date`를 분리해 채널별 파싱 오차를 흡수한다.
- 산출물은 파일 경로와 버전이 항상 1:1로 대응되게 저장한다.

### 2.2 이번 단계에서 하지 않는 것

- 전체 채널 pagination 완성
- 다중 사용자 인증 재설계
- 비동기 워커 큐 도입
- 전체 UI 재설계

---

## 3. 핵심 개념

### 3.1 Job document 분리

공고 데이터는 아래 세 층으로 관리한다.

- `listing_snapshot`: 검색 결과 카드에서 얻은 요약 정보
- `detail_content`: 실제 공고 상세 본문
- `normalized_payload`: AI나 후속 처리에 쓰기 위한 구조화 결과

목록 수집 직후에는 `listing_snapshot`만 있을 수 있다. 이 상태에서 상세 수집이 성공하면 `detail_content`가 채워진다.

### 3.2 상태 축 분리

기존 `status` 하나를 아래 세 칼럼으로 분리한다.

- `fit_status`
  - `unreviewed`
  - `filtered_out`
  - `passed`
  - `matched`
  - `low_fit`
  - `evaluation_failed`
- `workflow_status`
  - `idle`
  - `detail_pending`
  - `detail_ready`
  - `generating`
  - `draft_ready`
  - `generation_failed`
- `application_status`
  - `not_started`
  - `applied`
  - `hold`
  - `withdrawn`
  - `closed`

통계는 `fit_status`와 `application_status`를 기준으로 계산하고, 생성 버튼 노출은 `workflow_status`를 기준으로 판단한다.

### 3.3 마감일 분리

- `deadline_text`: 채널에서 본 원문 문자열
- `deadline_date`: `YYYY-MM-DD` 형식의 정규화 값, 실패 시 `NULL`
- `deadline_parse_status`: `parsed | missing | invalid`

UI는 기본적으로 `deadline_text`를 보여주고, 정렬/필터/통계는 `deadline_date`를 사용한다.

### 3.4 산출물 버전 모델

산출물은 아래 규칙을 따른다.

- 파일명은 `timestamp + version + short-id`를 포함한다.
- `(job_id, type, language)` 단위로 version을 증가시킨다.
- DB row 하나가 파일 하나만 가리킨다.
- 재생성은 기존 row를 덮지 않고 새 버전을 만든다.

---

## 4. 데이터 모델 변경

### 4.1 jobs 테이블

기존 칼럼 유지:

- `job_id`
- `source`
- `source_id`
- `company`
- `position`
- `location`
- `employment_type`
- `company_size`
- `employee_count`
- `raw_url`
- `salary_text`
- `fit_score`
- `fit_reason`
- `risks`
- `recommended_stories`
- `questions_detected`
- `filter_reason`
- `memo`

신규 칼럼:

- `listing_file TEXT`
- `detail_file TEXT`
- `detail_collected_at TEXT`
- `detail_status TEXT DEFAULT 'missing'`
- `deadline_text TEXT`
- `deadline_date TEXT`
- `deadline_parse_status TEXT DEFAULT 'missing'`
- `fit_status TEXT DEFAULT 'unreviewed'`
- `workflow_status TEXT DEFAULT 'idle'`
- `application_status TEXT DEFAULT 'not_started'`

호환 칼럼:

- `raw_file TEXT`
  - 1차 단계에서는 읽기 호환용으로 유지
  - 신규 쓰기는 `listing_file`, `detail_file` 중심

### 4.2 outputs 테이블

기존 칼럼 유지:

- `job_id`
- `type`
- `file_path`
- `language`
- `version`
- `created_at`

신규 제약:

- `(job_id, type, language, version)` unique index 추가

### 4.3 fingerprints / dedupe

이번 단계에서는 스키마를 크게 바꾸지 않는다. 다만 이후 단계에서 아래 중 하나를 선택한다.

- `fingerprint` 계산 규칙 강화
- `(source, source_id)` unique 보강

---

## 5. 파일 저장 규칙

### 5.1 jobs 디렉터리

```text
jobs/
  listings/
    JOB-0001.md
  details/
    JOB-0001.md
  normalized/
    JOB-0001.json
```

`listings/JOB-0001.md`

- 검색 결과 카드 기준 요약
- 채널, URL, 수집 시각, 노출 필드 요약 포함

`details/JOB-0001.md`

- 실제 공고 본문
- 상세 수집 실패 시 파일이 없을 수 있음

### 5.2 outputs 디렉터리

예시:

```text
outputs/resumes/20260409T102233_JOB-0001_v2_a1b2c3_ko.md
```

규칙:

- UTC timestamp 포함
- `jobId`
- `v{version}`
- 짧은 랜덤 suffix
- `language`

---

## 6. 스캔 파이프라인

### 6.1 1차 단계의 표준 흐름

1. scanner가 listing 결과를 수집한다.
2. listing 기준 fingerprint를 계산한다.
3. dedupe를 통과한 결과만 job row를 만든다.
4. `listing_file`을 저장한다.
5. channel detail fetcher가 `raw_url` 기반 상세 본문을 추가 수집한다.
6. 상세 수집 성공 시 `detail_file`, `detail_collected_at`, `detail_status='ready'`를 기록한다.
7. 상세 수집 실패 시 `detail_status='failed'`, `workflow_status='detail_pending'`로 둔다.
8. 1차 필터를 통과하면 `fit_status='passed'`, 아니면 `fit_status='filtered_out'`.
9. 상세가 준비된 건은 `workflow_status='detail_ready'`, 아니면 `detail_pending`.

### 6.2 상세 수집 실패 정책

- scan 전체를 실패로 돌리지 않는다.
- 개별 공고 단위 실패로 기록한다.
- listing 데이터는 유지한다.
- AI 액션은 `detail_status='ready'`가 아니면 막는다.

---

## 7. AI 액션 계약

### 7.1 공통 전제조건

모든 AI 액션은 아래를 만족해야 한다.

- 대상 job 존재
- `detail_status='ready'`
- `detail_file` 존재 및 읽기 가능

실패 응답:

```json
{
  "error": "job_detail_not_ready",
  "message": "공고 상세 본문이 없어 AI 작업을 실행할 수 없습니다."
}
```

### 7.2 Evaluate

입력:

- `profile.yml`
- `master_resume.md`
- `detail_file`
- 보조 정보로 `listing_file`

출력:

- `fit_score`
- `fit_reason`
- `risks`
- `recommended_stories`
- `questions_detected`
- `fit_status = matched | low_fit`

### 7.3 Generate answers

추가 전제조건:

- `questions_detected` non-empty

출력:

- 새 `outputs` row
- `workflow_status = draft_ready`

### 7.4 Generate resume

추가 전제조건:

- 평가 결과가 존재해야 함

출력:

- 새 `outputs` row
- `workflow_status = draft_ready`

### 7.5 Generate reply

추가 전제조건:

- `message`
- `channel`

출력:

- 새 `outputs` row
- `workflow_status = draft_ready`

---

## 8. API 응답 변경

### 8.1 GET /api/jobs/:jobId

반환 필드 추가:

- `listingContent`
- `detailContent`
- `detail_status`
- `fit_status`
- `workflow_status`
- `application_status`
- `deadline_text`
- `deadline_date`
- `deadline_parse_status`

호환:

- 기존 `rawContent`는 1차에서 `detailContent ?? listingContent`로 유지 가능
- UI는 신규 필드로 점진 전환

### 8.2 GET /api/jobs/stats

집계 기준:

- `matched_count`: `fit_status='matched'`
- `deadline_soon_count`: `application_status='not_started'` 이고 `deadline_date`가 오늘 이후 3일 이내

---

## 9. 마이그레이션 원칙

1. 신규 칼럼 추가 중심으로 시작한다.
2. 기존 데이터는 가능한 한 유지한다.
3. `raw_file`만 있는 레거시 row는 아래 규칙으로 해석한다.
   - `listing_file = raw_file`
   - `detail_file = NULL`
   - `detail_status = 'missing'`
4. 신규 스캔부터는 `listing_file`과 `detail_file`을 분리 저장한다.

---

## 10. 1차 구현 범위

이번 브랜치에서 반드시 포함할 것:

- `listing_file`, `detail_file`, `detail_status` 기반 저장 흐름
- jobs file store를 `listings/`, `details/`, `normalized/` 구조로 확장
- scanner/orchestrator에서 detail fetch hook 추가
- `GET /api/jobs/:jobId` 응답 확장
- evaluate/generate-* 라우트가 `detail_file`을 우선 사용하도록 변경
- detail 미준비 시 명시적 409/400 에러 응답
- 관련 단위/통합 테스트

이번 브랜치에서 제외:

- 상태축 3분리 전체 마이그레이션
- outputs versioning 전면 개편
- dedupe/unique constraint 보강

---

## 11. 성공 기준

- 새로 수집한 job은 listing과 detail 파일이 분리 저장된다.
- detail 수집 실패 job은 목록에는 보이되 AI 액션은 막힌다.
- evaluate/generate-*가 listing 요약이 아니라 detail 본문을 읽는다.
- 레거시 row는 깨지지 않고 조회된다.
- 테스트로 listing-only / detail-ready / detail-missing 경로가 모두 검증된다.

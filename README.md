# Career Worker

개인용 채용 공고 작업 도구입니다.  
Next.js 16, React 19, SQLite, 로컬 파일 저장소를 기준으로 동작합니다.

현재 구현 범위는 다음 흐름까지 연결되어 있습니다.

1. 비밀번호 로그인
2. 수집원 등록
3. 공고 스캔 실행
4. 룰 기반 1차 필터링
5. 공고 상세에서 AI 적합도 평가
6. 답변팩, 맞춤 이력서, 리크루터 답장 초안 생성
7. 산출물 조회 및 삭제

## 현재 상태

이 저장소는 단순 스캐폴딩 단계는 지났고, 로컬에서 시연 가능한 MVP 상태입니다.

- 대시보드, 공고 목록/상세, 수집원, 프로필, 산출물 화면이 있습니다.
- 스캔, 공고 조회, AI 액션, 프로필, 산출물 API가 구현되어 있습니다.
- SQLite 스키마 초기화와 마이그레이션이 포함되어 있습니다.
- 세션은 DB 만료 검증까지 포함해 체크합니다.

최근 반영된 안정화 작업은 아래와 같습니다.

- `questions_detected`를 DB에 저장하고 답변팩 생성 시 실제 문항을 사용합니다.
- 수집 이력이 있는 수집원은 삭제되지 않도록 막습니다.
- 공고 ID는 `COUNT(*) + 1` 대신 랜덤 기반으로 생성합니다.
- 스캔 중 raw 파일 저장이 실패하면 DB insert를 롤백하고 생성된 파일도 정리합니다.
- 단일 수집원 스캔 실패는 500 JSON으로 응답합니다.
- 존재하지 않는 공고 업데이트는 404를 반환합니다.
- UI에서 실제로 없는 `cover_letter` 생성 기능 필터는 제거했습니다.

## 남은 제약

아래 항목은 아직 남아 있는 리스크입니다.

- `openclaw` CLI가 로컬에 없어 실연동 검증은 아직 하지 못했습니다.
- 현재 저장되는 JD는 상세 공고 전문이 아니라 목록/카드 수준 요약입니다.
- JobKorea, Remember 스캐너는 HTML 셀렉터 변화에 민감합니다.
- `next build`는 통과하지만 Turbopack NFT warning 1건이 남아 있습니다.
- 수집원 설정은 기본적으로 `keywords` 중심이며, 채널별 세부 설정 UI는 아직 얕습니다.

## 주요 화면

- `/login`: 비밀번호 로그인
- `/`: 대시보드, 통계, 최근 매칭 공고, 전체 스캔 실행
- `/jobs`: 공고 목록, 상태/채널/검색 필터
- `/jobs/[jobId]`: 공고 상세, AI 평가, 답변팩/이력서/답장 생성
- `/sources`: 수집원 등록, 목록, 최근 스캔 이력
- `/profile`: 프로필 파일 편집
- `/outputs`: 생성 산출물 조회, 복사, 삭제

## 주요 API

- `POST /api/auth`
- `GET /api/jobs`
- `GET /api/jobs/stats`
- `GET /api/jobs/:jobId`
- `PUT /api/jobs/:jobId`
- `POST /api/jobs/:jobId/evaluate`
- `POST /api/jobs/:jobId/generate-answers`
- `POST /api/jobs/:jobId/generate-resume`
- `POST /api/jobs/:jobId/generate-reply`
- `GET /api/outputs`
- `GET /api/outputs/:id`
- `DELETE /api/outputs/:id`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/scan/sources`
- `POST /api/scan/sources`
- `PUT /api/scan/sources/:id`
- `DELETE /api/scan/sources/:id`
- `POST /api/scan/run`
- `POST /api/scan/run/:sourceId`
- `GET /api/scan/history`

## 수집 채널

- Saramin API 기반 스캐너
- JobKorea HTML 파서
- Remember HTML 파서

## 기술 스택

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- SQLite (`better-sqlite3`)
- Cheerio
- Vitest
- Markdown/YAML 파일 저장 (`gray-matter`, `js-yaml`)

## 프로젝트 구조

```text
src/
  app/
    api/
    jobs/
    login/
    outputs/
    profile/
    sources/
  components/
  lib/
  prompts/
  scanners/
data/
jobs/
outputs/
profile/
templates/
tests/
docs/
```

## 로컬 실행

### 1. 설치

```bash
npm install
```

### 2. 환경 변수 준비

`.env.example`을 복사해서 `.env`를 만듭니다.

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

필수 값:

- `AUTH_PASSWORD`: 로그인 비밀번호
- `SESSION_SECRET`: 세션 서명용 시크릿

선택 값:

- `SARAMIN_API_KEY`: Saramin 자동 수집 시 필요, 없어도 `/jobs`의 직접 등록과 기존 공고 검토는 가능
- `OPENCLAW_TIMEOUT`: OpenClaw 호출 타임아웃
- `PORT`: `.env.example` 기본값은 `3010`이지만 현재 `npm run dev`, `npm run start` 스크립트는 `3010`으로 고정
- `DATA_DIR`, `PROFILE_DIR`, `JOBS_DIR`, `OUTPUTS_DIR`: 기본 상대 경로 또는 절대 경로

### 3. 개발 서버 실행

```bash
npm run dev
```

기본 접속 주소:

- [http://localhost:3010](http://localhost:3010)

`3010` 포트가 이미 사용 중이면 현재 스크립트 대신 아래처럼 직접 실행해야 합니다.

```bash
npx next dev -p 3011
```

AI 생성 액션까지 확인하려면 `SARAMIN_API_KEY`와 별개로 `openclaw` CLI도 설치되어 있어야 합니다.

## 테스트와 빌드

```bash
npm run lint
npm run test
npm run build
```

## 데이터 저장 방식

- SQLite DB: `data/*.db`
- 원문 JD: `jobs/raw/*.md`
- 정규화 JSON: `jobs/normalized/*.json`
- 생성 산출물: `outputs/**/*.md`
- 프로필 파일: `profile/*`

관리 대상 프로필 파일은 아래 6개입니다.

- `profile.yml`
- `master_resume.md`
- `career_story.md`
- `story_bank.md`
- `answer_bank.md`
- `links.md`

## AI 동작 방식

AI 액션은 프롬프트 템플릿과 `openclaw` CLI를 사용합니다.

- 공고 적합도 평가
- 답변팩 생성
- 맞춤 이력서 초안 생성
- 리크루터 답장 초안 생성

주의:

- `openclaw`가 설치되지 않으면 AI 액션은 동작하지 않습니다.
- 자동 스캔만으로 AI 평가가 연속 실행되지는 않습니다. 공고 상세에서 수동 실행합니다.

## 문서

- 설계서: [docs/specs/2026-04-07-career-worker-design.md](docs/specs/2026-04-07-career-worker-design.md)
- 구현 계획: [docs/plans/2026-04-07-career-worker-implementation.md](docs/plans/2026-04-07-career-worker-implementation.md)

## 다음 우선순위

1. `openclaw` 실연동 검증
2. 상세 JD 전문 수집 및 문항 추출 강화
3. 채널별 설정 UI 확장
4. 스캐너 실사이트 회귀 테스트 보강
5. Turbopack warning 정리

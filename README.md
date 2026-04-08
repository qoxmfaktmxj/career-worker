# Career Worker

단일 사용자를 위한 채용 공고 수집, 선별, AI 평가 보조 도구입니다.  
Next.js 16, React 19, SQLite, 파일 기반 프로필/산출물 저장소를 사용합니다.

현재 기준으로는 다음 흐름이 동작합니다.

1. 비밀번호 로그인
2. 수집원 등록
3. 공고 스캔 실행
4. 룰 기반 1차 필터링
5. 공고 상세에서 AI 평가 / 답변팩 / 맞춤 이력서 / 리크루터 답장 생성
6. 산출물 조회 및 삭제

## 현재 상태

이 저장소는 더 이상 스캐폴딩 단계가 아닙니다.  
대시보드, 공고 목록/상세, 수집원, 프로필, 산출물 화면과 관련 API가 구현되어 있어 로컬 데모와 수동 운영은 가능한 상태입니다.

다만 "완전히 끝났다"고 보긴 어렵습니다. 현재 남아 있는 주요 항목은 아래와 같습니다.

- `openclaw` CLI가 로컬에 없어 실연동 스모크 테스트를 아직 하지 못했습니다.
- 스캔 시 저장되는 JD는 상세 공고 전문이 아니라 카드/목록 수준 요약입니다.
- `JOB-0001` 형태의 ID를 `COUNT(*) + 1`로 만들고 있어 삭제나 동시 실행에 취약합니다.
- 수집원 삭제와 스캔 이력 FK 정합성은 추가 보강이 필요합니다.
- 잡코리아/리멤버 HTML 파서는 실제 DOM 변경에 민감하므로 실사이트 검증이 더 필요합니다.
- `next build` 시 Turbopack NFT warning 1건이 남아 있지만 빌드는 성공합니다.

## 주요 기능

### UI

- `/login`: 비밀번호 로그인
- `/`: 대시보드, 통계, 최근 매칭 공고, 전체 스캔 실행
- `/jobs`: 공고 목록, 상태/채널/검색 필터
- `/jobs/[jobId]`: 공고 원문, AI 평가, 답변팩/이력서/답장 생성
- `/sources`: 수집원 등록, 수집원 목록, 최근 스캔 이력
- `/profile`: 프로필 YAML/Markdown 편집
- `/outputs`: 생성 산출물 조회, 타입 필터, 본문 확인

### API

- `POST /api/auth`
- `GET /api/jobs`
- `GET /api/jobs/stats`
- `GET /api/jobs/:jobId`
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

### 수집 채널

- 사람인 API 기반 스캐너
- 잡코리아 HTML 파서
- 리멤버 HTML 파서

## 기술 스택

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- SQLite (`better-sqlite3`)
- Cheerio 기반 HTML 파싱
- Markdown/YAML 파일 저장 (`gray-matter`, `js-yaml`)
- Vitest

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

### 2. 환경변수 준비

`.env.example`을 복사해 `.env`를 만듭니다.

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

- `SARAMIN_API_KEY`: 사람인 API 사용 시 필요
- `OPENCLAW_TIMEOUT`: OpenClaw 호출 타임아웃
- `PORT`: 기본값 `3010`
- `DATA_DIR`, `PROFILE_DIR`, `JOBS_DIR`, `OUTPUTS_DIR`: 상대 경로 또는 절대 경로

### 3. 개발 서버 실행

```bash
npm run dev
```

기본 접속 주소:

- [http://localhost:3010](http://localhost:3010)

## 테스트와 빌드

```bash
npm run lint
npm run test
npm run build
```

현재 기준 최근 검증 결과:

- `npm run lint` 통과
- `npm run test` 54 passing
- `npm run build` 통과

## 데이터 저장 방식

- SQLite DB: `data/career-worker.db`
- 수집한 원문 JD: `jobs/raw/*.md`
- 생성 산출물: `outputs/*.md`
- 프로필 자산: `profile/`

프로필은 아래 파일만 허용합니다.

- `profile.yml`
- `master_resume.md`
- `career_story.md`
- `story_bank.md`
- `answer_bank.md`
- `links.md`

## AI 동작 방식

AI 관련 액션은 내부 프롬프트 템플릿과 `openclaw` CLI를 사용합니다.

- 공고 적합도 평가
- 답변팩 생성
- 맞춤 이력서 초안 생성
- 리크루터 답장 초안 생성

주의:

- `openclaw`가 설치되지 않으면 AI 액션 라우트는 정상 동작하지 않습니다.
- 현재 자동 스캔 뒤에 AI 평가가 연쇄 실행되지는 않습니다. 공고 상세에서 수동 실행하는 구조입니다.

## 문서

- 설계서: [docs/specs/2026-04-07-career-worker-design.md](docs/specs/2026-04-07-career-worker-design.md)
- 구현 계획: [docs/plans/2026-04-07-career-worker-implementation.md](docs/plans/2026-04-07-career-worker-implementation.md)

## 다음 우선순위

현재 코드 기준으로 남은 후속 작업 우선순위는 아래가 적절합니다.

1. `openclaw` 실연동 검증
2. 상세 JD 전문 수집과 문항 데이터 저장
3. 공고 ID 생성 및 스캔 저장 정합성 보강
4. 수집원 관리 UI를 백엔드 기능 수준까지 확장
5. 운영 문서와 배포 문서 정리

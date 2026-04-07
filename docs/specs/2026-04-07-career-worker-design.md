# Career Worker - 설계서

> 작성일: 2026-04-07
> 상태: 확정
> 목적: 한국 채용 플랫폼 자동 공고 수집 + 적합도 선별 + 자소서 생성 보조 시스템

---

## 1. 프로젝트 개요

### 1.1 핵심 가치

이 앱은 "자소서 생성기"가 아니라 **내 프로필에 맞는 공고를 자동으로 찾아서 선별해주는 개인 리크루터**다.

- 자동 수집 → 적합도 선별 → 필요시 자소서 생성
- 자동 지원이 아니라 **자동 수집 + 자동 선별 + 수동 지원**
- 원본 career-ops 철학(포털 자동 스캔, 배치 평가, 단일 트래커)을 한국 채용 시장에 맞게 재설계

### 1.2 대상 채널

| 채널 | 수집 방식 | 우선순위 |
|------|-----------|----------|
| 사람인 | 공식 API (access-key) | 1순위 |
| 잡코리아 | HTML 파서 (cheerio) | 2순위 |
| 리멤버 | 공개 보드 파서 | 3순위 |
| 비즈니스피플 | 리드 소스 (수동 URL 등록) | 후순위 |
| LinkedIn | 리크루터 응답/아웃리치 위주 | 후순위 |

블라인드하이어는 2025년 3월 서비스 종료로 제외.

### 1.3 기술 스택

| 항목 | 선택 | 근거 |
|------|------|------|
| Frontend + API | Next.js (App Router, TypeScript) | 풀스택 한 덩어리, 마이그레이션 비용 방지 |
| DB | SQLite (WAL 모드) | 개인용, 서버 DB 불필요, 파일 1개 |
| 파일 저장 | MD/JSON/YAML | 버전 관리, 사람이 직접 편집 가능 |
| AI 실행 | OpenClaw CLI (`openclaw agent --json`) | 같은 서버, API 키 불필요 |
| 인증 | 단순 비밀번호 + 세션 쿠키 | 단일 사용자, 개인 도구 |
| 배포 | Linux 서버 + PM2 + Nginx | Docker보다 단순, OpenClaw 접근 용이 |
| 도메인 | career.minseok91.cloud | 외부 접속, HTTPS |

---

## 2. 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│                  career.minseok91.cloud                    │
│                    (Nginx/Caddy HTTPS)                     │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                   Next.js (App Router)                     │
│                                                            │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │  Pages (UI)   │  │ Route Handlers │  │  Middleware    │  │
│  │  - Dashboard  │  │ /api/scan/*    │  │  (비밀번호)    │  │
│  │  - Jobs       │  │ /api/jobs/*    │  │               │  │
│  │  - Sources    │  │ /api/profile   │  │               │  │
│  │  - Profile    │  │ /api/outputs/* │  │               │  │
│  │  - Outputs    │  │ /api/run/*     │  │               │  │
│  └──────────────┘  └───────┬───────┘  └───────────────┘  │
└────────────────────────────┼─────────────────────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                  ▼
┌────────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Scanners       │  │   SQLite      │  │  파일 시스템      │
│                 │  │               │  │                  │
│ saramin_scanner │  │ sources       │  │ profile/*.md,yml │
│  (공식 API)     │  │ jobs          │  │ jobs/raw/*.md    │
│ jobkorea_scanner│  │ fingerprints  │  │ jobs/norm/*.json │
│  (HTML 파서)    │  │ scan_runs     │  │ outputs/**/*.md  │
│ remember_scanner│  │ outputs       │  │ prompts/*.md     │
│  (공개 보드)    │  │               │  │                  │
└────────┬────────┘  └──────────────┘  └──────────────────┘
         │
         │ (2차 평가 대상만)
         ▼
┌──────────────────────────────────────┐
│  OpenClaw CLI (같은 서버)              │
│  openclaw agent --message "..." --json│
│  → fit_score, risks, stories 반환     │
└──────────────────────────────────────┘
```

### 2.1 핵심 데이터 흐름

```
[1] 스캔 실행 (수동 버튼 or 예약)
    │
    ▼
[2] Scanner가 채널별 공고 수집
    사람인: API 호출 (키워드, 지역, 직무코드)
    잡코리아: HTML 파싱
    리멤버: 공개 보드 파싱
    │
    ▼
[3] 중복 제거 (URL + 회사명 + 포지션 fingerprint)
    SQLite job_fingerprints 테이블 대조
    │
    ▼
[4] 1차 필터 (룰 기반, AI 없음)
    → status: collected / filtered_out
    │
    ▼
[5] 2차 평가 (OpenClaw, 1차 통과분만)
    → fit_score, fit_reason, risks, recommended_stories
    → status: evaluated / matched / low_fit
    │
    ▼
[6] 대시보드에 결과 표시
    총 수집 | 신규 | 적합 | 마감임박 | 종료
    │
    ▼
[7] 사용자가 고른 공고만 자소서/이력서 생성
    "답변 생성" 클릭 → OpenClaw 호출 → outputs/ 저장
```

### 2.2 AI 호출 비용 절감 구조

- 전체 수집 공고의 대부분은 1차 룰 필터에서 탈락
- OpenClaw는 1차 통과분에만 호출 (예: 100개 수집 → 20개 통과 → 20개만 AI 평가)
- 자소서 생성은 사용자가 선택한 것만

---

## 3. 폴더 구조

```
career-worker/
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── README.md
│
├── docs/
│   └── specs/                      # 설계 문서 (push 대상)
│
├── src/
│   ├── middleware.ts               # 비밀번호 인증 (Next.js 규칙: src/ 직하)
│   │
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Dashboard
│   │   │
│   │   ├── jobs/
│   │   │   ├── page.tsx            # 공고 목록
│   │   │   └── [jobId]/
│   │   │       └── page.tsx        # 공고 상세 + 자소서 생성
│   │   │
│   │   ├── sources/
│   │   │   └── page.tsx            # 수집원 관리 + 스캔 실행
│   │   │
│   │   ├── profile/
│   │   │   └── page.tsx            # 프로필 편집
│   │   │
│   │   ├── outputs/
│   │   │   └── page.tsx            # 산출물 보기
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx            # 로그인
│   │   │
│   │   └── api/                    # Route Handlers
│   │       ├── auth/route.ts
│   │       ├── scan/
│   │       │   ├── run/route.ts
│   │       │   ├── run/[sourceId]/route.ts
│   │       │   ├── sources/route.ts
│   │       │   ├── sources/[id]/route.ts
│   │       │   └── history/route.ts
│   │       ├── jobs/
│   │       │   ├── route.ts
│   │       │   ├── stats/route.ts
│   │       │   └── [jobId]/
│   │       │       ├── route.ts
│   │       │       ├── evaluate/route.ts
│   │       │       ├── generate-answers/route.ts
│   │       │       ├── generate-resume/route.ts
│   │       │       └── generate-reply/route.ts
│   │       ├── profile/route.ts
│   │       └── outputs/
│   │           ├── route.ts
│   │           └── [id]/route.ts
│   │
│   ├── lib/                        # 공통 라이브러리
│   │   ├── db.ts                   # SQLite 연결 + 초기화
│   │   ├── auth.ts                 # 비밀번호 검증
│   │   ├── openclaw.ts             # OpenClaw CLI 래퍼
│   │   ├── file-store.ts           # 파일 읽기/쓰기 유틸
│   │   └── filters.ts             # 1차 룰 기반 필터
│   │
│   ├── scanners/                   # 채널별 수집기
│   │   ├── base-scanner.ts         # 공통 인터페이스
│   │   ├── saramin.ts              # 사람인 API
│   │   ├── jobkorea.ts             # 잡코리아 HTML 파서
│   │   └── remember.ts            # 리멤버 공개 보드 파서
│   │
│   ├── prompts/                    # OpenClaw 프롬프트 템플릿
│   │   ├── evaluate-fit.md
│   │   ├── summarize-jd.md
│   │   ├── generate-answer-pack.md
│   │   ├── generate-resume.md
│   │   └── recruiter-reply.md
│   │
│   └── components/                 # React 컴포넌트
│       ├── ui/
│       ├── dashboard/
│       ├── jobs/
│       ├── sources/
│       ├── profile/
│       └── outputs/
│
├── data/                           # SQLite DB 파일
│   └── career.db
│
├── profile/                        # 사용자 데이터
│   ├── master_resume.md
│   ├── profile.yml
│   ├── career_story.md
│   ├── story_bank.md
│   ├── answer_bank.md
│   └── links.md
│
├── jobs/
│   ├── raw/
│   └── normalized/
│
├── outputs/
│   ├── resumes/
│   ├── cover_letters/
│   ├── answer_packs/
│   └── recruiter_replies/
│
└── templates/
    ├── normalized-job.schema.json
    ├── answer-pack.template.md
    └── resume.template.md
```

### 3.1 구조 원칙

- `src/` = 시스템 코드 (초기 1회 구축)
- `profile/`, `jobs/`, `outputs/` = 운영 데이터 (평소 변경)
- `data/career.db` = SQLite 파일 (자동 관리)
- `docs/specs/` = 설계 문서 (push 대상, 수정 근거용)
- `src/scanners/` = 채널별 수집기 분리, 새 채널은 파일 하나 추가

---

## 4. SQLite 스키마

```sql
-- 수집원 설정
CREATE TABLE sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channel     TEXT NOT NULL,          -- saramin, jobkorea, remember
  name        TEXT NOT NULL,          -- "사람인 백엔드 서울"
  config      TEXT NOT NULL,          -- JSON: 검색 키워드, 지역, 직무코드 등
  enabled     INTEGER DEFAULT 1,
  last_scan   TEXT,                   -- ISO datetime
  created_at  TEXT DEFAULT (datetime('now'))
);

-- 수집된 공고
CREATE TABLE jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id          TEXT UNIQUE NOT NULL,   -- JOB-0001
  source          TEXT NOT NULL,          -- saramin, jobkorea, remember
  source_id       TEXT,                   -- 원본 사이트 공고 ID
  company         TEXT NOT NULL,
  position        TEXT NOT NULL,
  location        TEXT,
  employment_type TEXT,
  company_size    TEXT,                   -- 대기업, 중견, 스타트업 등
  employee_count  INTEGER,
  raw_url         TEXT,
  deadline        TEXT,                   -- ISO date
  salary_text     TEXT,
  status          TEXT DEFAULT 'collected',
  fit_score       REAL,
  fit_reason      TEXT,
  risks           TEXT,                   -- JSON array
  recommended_stories TEXT,               -- JSON array
  raw_file        TEXT,                   -- jobs/raw/JOB-0001.md
  normalized_file TEXT,                   -- jobs/normalized/JOB-0001.json
  filter_reason   TEXT,                   -- 1차 필터 탈락 사유
  memo            TEXT,                   -- 사용자 메모
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- 중복 방지 fingerprint
CREATE TABLE job_fingerprints (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT UNIQUE NOT NULL,
  job_id      TEXT NOT NULL,
  source      TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES jobs(job_id)
);

-- 스캔 실행 이력
CREATE TABLE scan_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id       INTEGER NOT NULL,
  started_at      TEXT DEFAULT (datetime('now')),
  finished_at     TEXT,
  status          TEXT DEFAULT 'running',
  total_found     INTEGER DEFAULT 0,
  new_count       INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  filtered_count  INTEGER DEFAULT 0,
  passed_count    INTEGER DEFAULT 0,
  error_message   TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

-- 생성된 산출물
CREATE TABLE outputs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id      TEXT NOT NULL,
  type        TEXT NOT NULL,          -- answer_pack, resume, cover_letter, recruiter_reply
  file_path   TEXT NOT NULL,
  language    TEXT DEFAULT 'ko',
  version     INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES jobs(job_id)
);

-- 세션
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,        -- crypto.randomUUID()
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- 인덱스
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_deadline ON jobs(deadline);
CREATE INDEX idx_jobs_source ON jobs(source);
CREATE INDEX idx_jobs_fit_score ON jobs(fit_score);
CREATE INDEX idx_fingerprints_fp ON job_fingerprints(fingerprint);
CREATE INDEX idx_scan_runs_source ON scan_runs(source_id);
CREATE INDEX idx_outputs_job ON outputs(job_id);
```

### 4.1 상태 흐름

```
수집 → 1차 필터
  ├─ filtered_out (탈락 + 사유 기록)
  └─ passed → 2차 AI 평가
       ├─ low_fit (점수 낮음)
       └─ matched (적합)
            └─ 사용자 선택 시
                 generating → draft_ready
                   ├─ applied (지원 완료)
                   ├─ hold (보류)
                   └─ withdrawn (철회)
```

---

## 5. API 설계

```
인증
  POST   /api/auth                    비밀번호 로그인 → 세션 쿠키 발급

스캔
  GET    /api/scan/sources            수집원 목록
  POST   /api/scan/sources            수집원 추가
  PUT    /api/scan/sources/:id        수집원 수정
  DELETE /api/scan/sources/:id        수집원 삭제
  POST   /api/scan/run                스캔 실행 (전체 or 특정 source)
  POST   /api/scan/run/:sourceId      특정 수집원만 스캔
  GET    /api/scan/history            스캔 실행 이력

공고
  GET    /api/jobs                    목록 (필터: status, source, fit_score, deadline)
  GET    /api/jobs/stats              대시보드 집계
  GET    /api/jobs/:jobId             상세
  PUT    /api/jobs/:jobId             상태/메모 수정
  POST   /api/jobs/:jobId/evaluate           2차 AI 평가
  POST   /api/jobs/:jobId/generate-answers   자소서 생성
  POST   /api/jobs/:jobId/generate-resume    맞춤 이력서 생성
  POST   /api/jobs/:jobId/generate-reply     리크루터 답장 생성

프로필
  GET    /api/profile                 profile.yml + 각 md 파일
  PUT    /api/profile                 파일 저장

산출물
  GET    /api/outputs                 목록 (필터: job_id, type)
  GET    /api/outputs/:id             파일 내용 반환
  DELETE /api/outputs/:id             삭제
```

### 5.1 설계 포인트

- 스캔 실행은 동기식으로 시작. 오래 걸리면 나중에 비동기 전환.
- 2차 AI 평가는 공고 1건씩. 배치 평가는 2차에서 추가.
- `/api/jobs/stats`는 대시보드 전용. SQLite 집계 쿼리 1방.
- 프로필은 파일 직접 읽기/쓰기. SQLite 안 거침.

---

## 6. 1차 필터 (룰 기반)

### 6.1 필터 조건

```yaml
포함 키워드 (OR — 하나만 맞아도 통과):
  개발 계열:
    - Java, Spring, 백엔드, 풀스택, React, JavaScript
    - TypeScript, Node, Python, PostgreSQL, Oracle
  전환/혁신:
    - AI, AX, DX, 디지털전환, 현대화, 클라우드전환
    - 레거시현대화, AI활용, AI도입, 생성형AI
  도메인:
    - 업무시스템, ERP, MES, SCM, 물류, 커머스, 핀테크
    - 게임 (AX/DX 맥락 포함)

제외 키워드 (AND — 전부 해당하면 탈락):
  - "신입만", "신입 한정", "인턴만"
  - (경력 무관, 경력/신입 동시 모집은 통과)

지역:
  - 서울 전체, 판교, 경기도 전체, 재택/원격

기업 규모:
  제외: "소기업", "중소기업", 사원수 100명 미만
  통과: 대기업, 중견기업, 공기업, 외국계, 스타트업
  규모 정보 없음 → 통과 (2차 AI에서 판단)

경력:
  신입만 제외, 나머지 전부 통과

채용형태:
  정규직, 계약직, 전환형 계약직 전부 통과
```

### 6.2 게임 산업 특수 로직

```
if (포지션 or JD에 "게임" 포함) {
  if (AI/AX/DX/현대화/전환 키워드도 함께 포함) → 통과
  else → filtered_out (reason: "게임 단독, AX/DX 키워드 없음")
}
```

---

## 7. Scanner 설계

### 7.1 공통 인터페이스

```typescript
interface ScanResult {
  source: string;
  source_id: string;
  company: string;
  position: string;
  location: string;
  employment_type: string;
  company_size?: string;
  employee_count?: number;
  raw_url: string;
  deadline?: string;
  salary_text?: string;
  raw_text: string;
  questions?: string[];
}

interface ScannerConfig {
  keywords: string[];
  location_codes: string[];
  exclude_keywords: string[];
  min_career_years?: number;
}

interface BaseScanner {
  name: string;
  scan(config: ScannerConfig): Promise<ScanResult[]>;
}
```

### 7.2 채널별 구현

**사람인 (공식 API)**
- 호출: `GET https://oapi.saramin.co.kr/recruit-search`
- 인증: access-key (환경변수)
- 파라미터: keywords, loc_cd, job_cd, sort, count
- 제한: 일 500회
- 자소서 문항은 API에 없을 수 있음 → 상세 페이지 파싱 필요시 2차

**잡코리아 (HTML 파서)**
- 도구: cheerio (서버 사이드 HTML 파싱)
- 수집: 회사명, 포지션, 지역, 마감일, 기업규모, 모집요강
- rate limit: 요청 간 1-2초 딜레이

**리멤버 (공개 보드 파서)**
- 도구: cheerio
- 수집: 회사명, 포지션, 주요업무, 자격요건, 우대사항, 채용절차
- 지원은 리멤버 앱에서 직접

### 7.3 스캔 → 필터 → 저장 흐름

```
POST /api/scan/run
  ├─ sources에서 enabled=1 조회
  ├─ 채널별 scanner.scan(config)
  ├─ 각 결과:
  │   ├─ fingerprint 생성: hash(raw_url + company + position)
  │   ├─ 중복 대조 → skip
  │   ├─ 1차 룰 필터
  │   │   ├─ 탈락 → INSERT (status: filtered_out, filter_reason)
  │   │   └─ 통과 → INSERT (status: passed)
  │   ├─ jobs/raw/JOB-xxxx.md 저장
  │   └─ fingerprint INSERT
  ├─ scan_runs 기록
  └─ 응답: { total, new, duplicate, filtered, passed }
```

---

## 8. OpenClaw 연동

### 8.1 호출 방식

```typescript
// src/lib/openclaw.ts
// child_process.execFile로 실행
// openclaw agent --message "..." --json
// 같은 서버 내부, 네트워크 지연 없음

interface OpenClawResponse {
  success: boolean;
  data: any;
  raw?: string;
  error?: string;
}
```

### 8.2 프롬프트 구성

**평가 (evaluate-fit.md)**
```json
{
  "fit_score": 4.3,
  "fit_reason": "...",
  "strengths": ["..."],
  "risks": ["..."],
  "recommended_stories": ["S001", "S003"],
  "questions_detected": ["지원동기를...", "문제해결..."],
  "summary": "..."
}
```

**자소서 생성 (generate-answer-pack.md)**
```json
{
  "answers": [
    {
      "question": "지원동기를 작성해주세요",
      "versions": { "300": "...", "500": "...", "800": "...", "1200": "..." },
      "used_stories": ["S001"]
    }
  ]
}
```

**맞춤 이력서 (generate-resume.md)**
```json
{
  "resume_md": "...",
  "highlights": ["..."],
  "adjusted_sections": ["..."]
}
```

**리크루터 답장 (recruiter-reply.md)**
```json
{
  "reply_ko": "...",
  "reply_en": "...",
  "tone": "professional",
  "key_points": ["..."]
}
```

### 8.3 에러 처리

- OpenClaw CLI 타임아웃 → UI에 "AI 응답 시간 초과, 재시도" 표시
- JSON 파싱 실패 → raw 응답 파일 저장, 수동 확인 가능
- OpenClaw 프로세스 에러 → stderr 로깅 + UI에 에러 메시지

### 8.4 프롬프트 관리 원칙

- 프롬프트는 `src/prompts/*.md` 파일로 관리 (코드에 하드코딩 안 함)
- 프로필 데이터는 조합 시 동적 주입
- 프롬프트 수정만으로 AI 출력 품질 튜닝 가능 (코드 변경 불필요)

---

## 9. 페이지 & UI

### 9.1 Dashboard (`/`)

```
┌──────────────────────────────────────────────┐
│  Career Worker                    [스캔 실행]  │
├──────────┬──────────┬──────────┬─────────────┤
│ 총 수집   │ 신규     │ 적합     │ 마감임박     │
│   342    │   12    │   28    │    5 (D≤3)  │
├──────────┴──────────┴──────────┴─────────────┤
│  적합 공고 (fit_score 높은 순)                   │
│  회사 | 포지션 | 채널 | 마감일 | 점수            │
├──────────────────────────────────────────────┤
│  마감 임박 (D-3 이내)                           │
│  회사 | 포지션 | 채널 | 마감일 | 점수            │
└──────────────────────────────────────────────┘
```

### 9.2 Jobs (`/jobs`)

- 필터: 상태, 채널, 점수, 검색
- 테이블: 회사, 포지션, 채널, 마감일, 규모, 점수, 상태

### 9.3 Job Detail (`/jobs/[jobId]`)

- 좌: 원문 JD (raw md)
- 우: AI 평가 결과 (fit_score, 적합 이유, 리스크, 추천 스토리)
- 하단: [AI 평가 실행] [자소서 생성] [이력서 생성] 버튼
- 생성된 산출물 목록 + 보기/복사 버튼

### 9.4 Sources (`/sources`)

- 수집원 CRUD
- 스캔 실행 버튼
- 최근 스캔 이력 (수집/신규/통과 수)

### 9.5 Profile (`/profile`)

- 탭: 기본정보, 이력서, 커리어스토리, 스토리뱅크, 답변뱅크, 링크, 필터설정
- 마크다운 에디터로 파일 직접 편집

### 9.6 Outputs (`/outputs`)

- 필터: 전체, 자소서, 이력서, 리크루터답장
- 보기/복사/삭제

### 9.7 UI 설계 원칙

- 구체적 디자인은 `/ui-ux-pro-max` + 비주얼 컴패니언으로 구체화
- 복사 버튼 중요 — 자소서를 채용 사이트에 붙여넣기
- 모바일 대응은 2차

---

## 10. 인증

```
흐름:
  1. 첫 접속 → /login 리다이렉트
  2. 비밀번호 입력 → POST /api/auth
  3. .env의 AUTH_PASSWORD와 비교
  4. 일치 → HttpOnly 세션 쿠키 (7일 유효)
  5. middleware.ts에서 /api/auth, /login 제외 전부 보호
  6. 세션: crypto.randomUUID() → SQLite sessions 테이블

보안:
  - 비밀번호는 .env에만 저장
  - 코드/설계문서에 절대 포함 안 함
```

---

## 11. 배포

```
인터넷 → Nginx (HTTPS, Let's Encrypt) → localhost:3010 → Next.js (PM2)

.env.example:
  AUTH_PASSWORD=
  SESSION_SECRET=
  SARAMIN_API_KEY=
  OPENCLAW_TIMEOUT=60000
  PORT=3010
  NODE_ENV=production
  DATA_DIR=./data
  PROFILE_DIR=./profile
  JOBS_DIR=./jobs
  OUTPUTS_DIR=./outputs

.gitignore (보안):
  .env
  data/career.db*
  profile/
  outputs/
  jobs/raw/
  jobs/normalized/
```

PM2 선택 이유: Docker보다 단순하고, OpenClaw CLI가 호스트에 설치되어 있으므로 컨테이너 안에서 호스트 CLI 접근하는 복잡성을 피함.

Docker Compose는 선택 옵션으로 유지 (필요시 전환 가능).

---

## 12. 참고

- 원본 레포: [career-ops](https://github.com/santifer/career-ops) (MIT)
- 참고 범위: 평가 파이프라인 개념, tracker 단일 진실원천, proof point/story bank 축적
- 제외: 해외 ATS 스캐너, Claude Code 전용 모드, Go TUI, 대량 배치

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2026-04-07 | 초기 설계서 작성 |

# Career Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한국 채용 플랫폼 자동 공고 수집 + 적합도 선별 + 자소서 생성 보조 웹앱 구축

**Architecture:** Next.js App Router 풀스택. SQLite(better-sqlite3)로 메타데이터, 파일 시스템으로 콘텐츠(MD/JSON/YAML) 저장. 채널별 Scanner가 공고를 수집하면 룰 기반 1차 필터 → OpenClaw CLI 2차 AI 평가 → 사용자 선택 시 자소서/이력서 생성.

**Tech Stack:** Next.js 14+, TypeScript, better-sqlite3, cheerio, Tailwind CSS, Vitest

**설계서:** `docs/specs/2026-04-07-career-worker-design.md`

---

## File Structure

```
career-worker/
├── src/
│   ├── middleware.ts                         # 인증 미들웨어
│   ├── app/
│   │   ├── layout.tsx                        # 루트 레이아웃 + 네비게이션
│   │   ├── page.tsx                          # Dashboard
│   │   ├── login/page.tsx                    # 로그인
│   │   ├── jobs/page.tsx                     # 공고 목록
│   │   ├── jobs/[jobId]/page.tsx             # 공고 상세
│   │   ├── sources/page.tsx                  # 수집원 관리
│   │   ├── profile/page.tsx                  # 프로필 편집
│   │   ├── outputs/page.tsx                  # 산출물 보기
│   │   └── api/
│   │       ├── auth/route.ts                 # 로그인 API
│   │       ├── scan/run/route.ts             # 스캔 실행
│   │       ├── scan/run/[sourceId]/route.ts  # 개별 스캔
│   │       ├── scan/sources/route.ts         # 수집원 CRUD
│   │       ├── scan/sources/[id]/route.ts    # 수집원 개별
│   │       ├── scan/history/route.ts         # 스캔 이력
│   │       ├── jobs/route.ts                 # 공고 목록/등록
│   │       ├── jobs/stats/route.ts           # 대시보드 집계
│   │       ├── jobs/[jobId]/route.ts         # 공고 상세/수정
│   │       ├── jobs/[jobId]/evaluate/route.ts
│   │       ├── jobs/[jobId]/generate-answers/route.ts
│   │       ├── jobs/[jobId]/generate-resume/route.ts
│   │       ├── jobs/[jobId]/generate-reply/route.ts
│   │       ├── profile/route.ts              # 프로필 CRUD
│   │       └── outputs/route.ts              # 산출물 목록
│   │           └── [id]/route.ts             # 산출물 개별
│   ├── lib/
│   │   ├── db.ts                             # SQLite 연결 + 스키마 초기화
│   │   ├── auth.ts                           # 세션 생성/검증
│   │   ├── openclaw.ts                       # OpenClaw CLI 래퍼
│   │   ├── file-store.ts                     # 파일 읽기/쓰기 유틸
│   │   ├── filters.ts                        # 1차 룰 기반 필터
│   │   └── job-id.ts                         # JOB-xxxx ID 생성
│   ├── scanners/
│   │   ├── types.ts                          # ScanResult, ScannerConfig 타입
│   │   ├── saramin.ts                        # 사람인 API 스캐너
│   │   ├── jobkorea.ts                       # 잡코리아 HTML 파서
│   │   ├── remember.ts                       # 리멤버 공개 보드 파서
│   │   └── orchestrator.ts                   # 스캔 실행 + 필터 + 저장 오케스트레이션
│   ├── prompts/
│   │   ├── evaluate-fit.md
│   │   ├── generate-answer-pack.md
│   │   ├── generate-resume.md
│   │   └── recruiter-reply.md
│   └── components/
│       ├── nav.tsx                           # 사이드바/상단 네비게이션
│       ├── stat-card.tsx                     # 대시보드 통계 카드
│       ├── job-table.tsx                     # 공고 테이블 (재사용)
│       ├── job-filters.tsx                   # 필터 UI
│       ├── markdown-editor.tsx               # 마크다운 편집기
│       ├── copy-button.tsx                   # 클립보드 복사 버튼
│       └── loading-button.tsx                # AI 작업용 로딩 버튼
├── data/                                     # .gitignore
├── profile/                                  # .gitignore (개인정보)
│   ├── master_resume.md
│   ├── profile.yml
│   ├── career_story.md
│   ├── story_bank.md
│   ├── answer_bank.md
│   └── links.md
├── jobs/raw/                                 # .gitignore
├── jobs/normalized/                          # .gitignore
├── outputs/                                  # .gitignore
├── templates/
│   ├── normalized-job.schema.json
│   ├── answer-pack.template.md
│   └── resume.template.md
├── tests/
│   ├── lib/
│   │   ├── db.test.ts
│   │   ├── filters.test.ts
│   │   ├── openclaw.test.ts
│   │   └── file-store.test.ts
│   └── scanners/
│       ├── saramin.test.ts
│       ├── jobkorea.test.ts
│       ├── remember.test.ts
│       └── orchestrator.test.ts
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── tailwind.config.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`, `postcss.config.js`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd C:/Users/kms/Desktop/dev/career-worker
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

선택지가 나오면: App Router=Yes, src/=Yes, Tailwind=Yes, import alias=@/*

- [ ] **Step 2: Install dependencies**

```bash
npm install better-sqlite3 cheerio js-yaml gray-matter crypto-js
npm install -D @types/better-sqlite3 @types/js-yaml vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Create .env.example**

```bash
# 인증
AUTH_PASSWORD=
SESSION_SECRET=

# 사람인 API
SARAMIN_API_KEY=

# OpenClaw
OPENCLAW_TIMEOUT=60000

# 서버
PORT=3010
NODE_ENV=production

# 데이터 경로
DATA_DIR=./data
PROFILE_DIR=./profile
JOBS_DIR=./jobs
OUTPUTS_DIR=./outputs
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
.next/
.env
data/
profile/
outputs/
jobs/raw/
jobs/normalized/
*.db
*.db-wal
*.db-shm
```

- [ ] **Step 6: Create directory structure**

```bash
mkdir -p src/lib src/scanners src/prompts src/components
mkdir -p src/app/api/auth src/app/api/scan/run src/app/api/scan/sources src/app/api/scan/history
mkdir -p src/app/api/jobs/stats src/app/api/profile src/app/api/outputs
mkdir -p src/app/login src/app/jobs src/app/sources src/app/profile src/app/outputs
mkdir -p data profile jobs/raw jobs/normalized
mkdir -p outputs/resumes outputs/cover_letters outputs/answer_packs outputs/recruiter_replies
mkdir -p templates tests/lib tests/scanners
```

- [ ] **Step 7: Add test script to package.json**

package.json의 scripts에 추가:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 8: Verify setup**

```bash
npm run dev
# http://localhost:3010 접속 확인
npm run test
# vitest 실행 확인 (테스트 없어서 0 pass)
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: initialize Next.js project with TypeScript, Tailwind, Vitest"
```

---

## Task 2: SQLite Database Layer

**Files:**
- Create: `src/lib/db.ts`
- Test: `tests/lib/db.test.ts`

- [ ] **Step 1: Write failing test for DB initialization**

```typescript
// tests/lib/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

const TEST_DB_PATH = path.join(__dirname, '../../data/test.db')

describe('Database', () => {
  beforeEach(() => {
    // 테스트 전 DB 삭제
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
    // 환경변수 세팅
    process.env.DATA_DIR = path.join(__dirname, '../../data')
    process.env.DB_NAME = 'test.db'
  })

  afterEach(() => {
    // DB 닫기 위해 모듈 캐시 초기화
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
  })

  it('should create all tables on init', async () => {
    const { getDb } = await import('@/lib/db')
    const db = getDb()

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[]

    const tableNames = tables.map((t) => t.name)
    expect(tableNames).toContain('sources')
    expect(tableNames).toContain('jobs')
    expect(tableNames).toContain('job_fingerprints')
    expect(tableNames).toContain('scan_runs')
    expect(tableNames).toContain('outputs')
    expect(tableNames).toContain('sessions')
    db.close()
  })

  it('should enable WAL mode', async () => {
    const { getDb } = await import('@/lib/db')
    const db = getDb()

    const result = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
    expect(result.journal_mode).toBe('wal')
    db.close()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/lib/db.test.ts
```

Expected: FAIL — `@/lib/db` does not exist

- [ ] **Step 3: Implement db.ts**

```typescript
// src/lib/db.ts
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dataDir = process.env.DATA_DIR || './data'
  const dbName = process.env.DB_NAME || 'career.db'
  const dbPath = path.join(dataDir, dbName)

  // data 디렉터리 없으면 생성
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initSchema(db)
  return db
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      channel     TEXT NOT NULL,
      name        TEXT NOT NULL,
      config      TEXT NOT NULL,
      enabled     INTEGER DEFAULT 1,
      last_scan   TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id          TEXT UNIQUE NOT NULL,
      source          TEXT NOT NULL,
      source_id       TEXT,
      company         TEXT NOT NULL,
      position        TEXT NOT NULL,
      location        TEXT,
      employment_type TEXT,
      company_size    TEXT,
      employee_count  INTEGER,
      raw_url         TEXT,
      deadline        TEXT,
      salary_text     TEXT,
      status          TEXT DEFAULT 'collected',
      fit_score       REAL,
      fit_reason      TEXT,
      risks           TEXT,
      recommended_stories TEXT,
      raw_file        TEXT,
      normalized_file TEXT,
      filter_reason   TEXT,
      memo            TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_fingerprints (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      fingerprint TEXT UNIQUE NOT NULL,
      job_id      TEXT NOT NULL,
      source      TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(job_id)
    );

    CREATE TABLE IF NOT EXISTS scan_runs (
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

    CREATE TABLE IF NOT EXISTS outputs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id      TEXT NOT NULL,
      type        TEXT NOT NULL,
      file_path   TEXT NOT NULL,
      language    TEXT DEFAULT 'ko',
      version     INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(job_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_deadline ON jobs(deadline);
    CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
    CREATE INDEX IF NOT EXISTS idx_jobs_fit_score ON jobs(fit_score);
    CREATE INDEX IF NOT EXISTS idx_fingerprints_fp ON job_fingerprints(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_scan_runs_source ON scan_runs(source_id);
    CREATE INDEX IF NOT EXISTS idx_outputs_job ON outputs(job_id);
  `)
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/lib/db.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/lib/db.test.ts
git commit -m "feat: add SQLite database layer with schema initialization"
```

---

## Task 3: Authentication System

**Files:**
- Create: `src/lib/auth.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/api/auth/route.ts`

- [ ] **Step 1: Write failing test for auth**

```typescript
// tests/lib/auth.test.ts (추가 내용은 아래에)
// auth.ts의 createSession, validateSession, deleteSession 테스트
import { describe, it, expect, beforeEach } from 'vitest'

// DB 모킹을 위해 테스트용 환경 세팅
const TEST_PASSWORD = 'test-pass-123'

describe('Auth', () => {
  beforeEach(() => {
    process.env.AUTH_PASSWORD = TEST_PASSWORD
    process.env.DATA_DIR = './data'
    process.env.DB_NAME = 'test-auth.db'
  })

  it('should reject wrong password', async () => {
    const { verifyPassword } = await import('@/lib/auth')
    expect(verifyPassword('wrong')).toBe(false)
  })

  it('should accept correct password', async () => {
    const { verifyPassword } = await import('@/lib/auth')
    expect(verifyPassword(TEST_PASSWORD)).toBe(true)
  })

  it('should create and validate session', async () => {
    const { createSession, validateSession } = await import('@/lib/auth')
    const sessionId = createSession()
    expect(sessionId).toBeTruthy()
    expect(validateSession(sessionId)).toBe(true)
  })

  it('should reject expired session', async () => {
    const { validateSession } = await import('@/lib/auth')
    expect(validateSession('nonexistent-id')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/lib/auth.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement auth.ts**

```typescript
// src/lib/auth.ts
import { getDb } from './db'
import crypto from 'crypto'

export function verifyPassword(input: string): boolean {
  const stored = process.env.AUTH_PASSWORD
  if (!stored) return false
  return input === stored
}

export function createSession(): string {
  const db = getDb()
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7일

  db.prepare('INSERT INTO sessions (id, expires_at) VALUES (?, ?)').run(id, expiresAt)
  return id
}

export function validateSession(sessionId: string): boolean {
  if (!sessionId) return false
  const db = getDb()
  const row = db
    .prepare('SELECT id, expires_at FROM sessions WHERE id = ?')
    .get(sessionId) as { id: string; expires_at: string } | undefined

  if (!row) return false
  return new Date(row.expires_at) > new Date()
}

export function deleteSession(sessionId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

// 만료된 세션 정리
export function cleanExpiredSessions(): void {
  const db = getDb()
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run()
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/lib/auth.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Implement middleware.ts**

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 공개 경로는 통과
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 정적 파일 통과
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  // 세션 쿠키 확인
  const sessionId = request.cookies.get('session_id')?.value
  if (!sessionId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 세션 검증은 API route에서 DB 접근 필요 → 쿠키 존재만 확인
  // (실제 검증은 각 API route에서 수행하거나, edge-compatible 검증 추가)
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 6: Implement login API route**

```typescript
// src/app/api/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSession, deleteSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { password } = body

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다' }, { status: 401 })
  }

  const sessionId = createSession()
  const response = NextResponse.json({ success: true })

  response.cookies.set('session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7일
    path: '/',
  })

  return response
}

export async function DELETE(request: NextRequest) {
  const sessionId = request.cookies.get('session_id')?.value
  if (sessionId) deleteSession(sessionId)

  const response = NextResponse.json({ success: true })
  response.cookies.delete('session_id')
  return response
}
```

- [ ] **Step 7: Implement login page**

```tsx
// src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/')
    } else {
      setError('비밀번호가 틀렸습니다')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-80">
        <h1 className="text-xl font-bold mb-6 text-center">Career Worker</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full p-3 border rounded mb-4"
          autoFocus
        />
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts src/middleware.ts src/app/api/auth/route.ts src/app/login/page.tsx tests/lib/auth.test.ts
git commit -m "feat: add password authentication with session cookies"
```

---

## Task 4: File Store Utility

**Files:**
- Create: `src/lib/file-store.ts`, `src/lib/job-id.ts`
- Test: `tests/lib/file-store.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/lib/file-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

const TEST_DIR = path.join(__dirname, '../../.test-files')

describe('FileStore', () => {
  beforeEach(() => {
    process.env.JOBS_DIR = path.join(TEST_DIR, 'jobs')
    process.env.OUTPUTS_DIR = path.join(TEST_DIR, 'outputs')
    process.env.PROFILE_DIR = path.join(TEST_DIR, 'profile')
    fs.mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('should save and read raw job file', async () => {
    const { saveRawJob, readRawJob } = await import('@/lib/file-store')
    saveRawJob('JOB-0001', '# Test JD\nSome content')
    const content = readRawJob('JOB-0001')
    expect(content).toContain('# Test JD')
  })

  it('should save and read normalized job JSON', async () => {
    const { saveNormalizedJob, readNormalizedJob } = await import('@/lib/file-store')
    const data = { job_id: 'JOB-0001', company: 'Test' }
    saveNormalizedJob('JOB-0001', data)
    const result = readNormalizedJob('JOB-0001')
    expect(result.company).toBe('Test')
  })

  it('should save output file and return path', async () => {
    const { saveOutput } = await import('@/lib/file-store')
    const filePath = saveOutput('JOB-0001', 'answer_pack', '# 답변\ncontent', 'ko')
    expect(filePath).toContain('JOB-0001')
    expect(fs.existsSync(path.join(TEST_DIR, 'outputs', filePath))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/lib/file-store.test.ts
```

- [ ] **Step 3: Implement job-id.ts**

```typescript
// src/lib/job-id.ts
import { getDb } from './db'

export function generateJobId(): string {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number }
  const next = row.count + 1
  return `JOB-${String(next).padStart(4, '0')}`
}
```

- [ ] **Step 4: Implement file-store.ts**

```typescript
// src/lib/file-store.ts
import fs from 'fs'
import path from 'path'

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function jobsDir(): string {
  return process.env.JOBS_DIR || './jobs'
}

function outputsDir(): string {
  return process.env.OUTPUTS_DIR || './outputs'
}

function profileDir(): string {
  return process.env.PROFILE_DIR || './profile'
}

// --- Raw Jobs ---

export function saveRawJob(jobId: string, content: string): string {
  const dir = path.join(jobsDir(), 'raw')
  ensureDir(dir)
  const filePath = `raw/${jobId}.md`
  fs.writeFileSync(path.join(jobsDir(), filePath), content, 'utf-8')
  return filePath
}

export function readRawJob(jobId: string): string {
  const filePath = path.join(jobsDir(), 'raw', `${jobId}.md`)
  return fs.readFileSync(filePath, 'utf-8')
}

// --- Normalized Jobs ---

export function saveNormalizedJob(jobId: string, data: Record<string, unknown>): string {
  const dir = path.join(jobsDir(), 'normalized')
  ensureDir(dir)
  const filePath = `normalized/${jobId}.json`
  fs.writeFileSync(path.join(jobsDir(), filePath), JSON.stringify(data, null, 2), 'utf-8')
  return filePath
}

export function readNormalizedJob(jobId: string): Record<string, unknown> {
  const filePath = path.join(jobsDir(), 'normalized', `${jobId}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

// --- Outputs ---

export function saveOutput(
  jobId: string,
  type: string,
  content: string,
  lang: string = 'ko'
): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const typeDir = type === 'answer_pack' ? 'answer_packs'
    : type === 'resume' ? 'resumes'
    : type === 'cover_letter' ? 'cover_letters'
    : 'recruiter_replies'

  const dir = path.join(outputsDir(), typeDir)
  ensureDir(dir)

  const fileName = `${date}_${jobId}_${type}_${lang}.md`
  fs.writeFileSync(path.join(dir, fileName), content, 'utf-8')
  return path.join(typeDir, fileName)
}

export function readOutput(relativePath: string): string {
  return fs.readFileSync(path.join(outputsDir(), relativePath), 'utf-8')
}

// --- Profile ---

export function readProfileFile(fileName: string): string {
  const filePath = path.join(profileDir(), fileName)
  if (!fs.existsSync(filePath)) return ''
  return fs.readFileSync(filePath, 'utf-8')
}

export function writeProfileFile(fileName: string, content: string): void {
  ensureDir(profileDir())
  fs.writeFileSync(path.join(profileDir(), fileName), content, 'utf-8')
}

export function listProfileFiles(): string[] {
  const dir = profileDir()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md') || f.endsWith('.yml'))
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test -- tests/lib/file-store.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/file-store.ts src/lib/job-id.ts tests/lib/file-store.test.ts
git commit -m "feat: add file store utility for jobs, outputs, profile"
```

---

## Task 5: Rule-Based Filter Engine

**Files:**
- Create: `src/lib/filters.ts`
- Test: `tests/lib/filters.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/filters.test.ts
import { describe, it, expect } from 'vitest'
import { applyFilter, type FilterConfig, type JobCandidate } from '@/lib/filters'

const defaultConfig: FilterConfig = {
  include_keywords: ['Java', 'Spring', '백엔드', '풀스택', 'React', 'AI', 'AX', 'DX', '디지털전환'],
  exclude_keywords: ['신입만', '신입 한정', '인턴만'],
  locations: ['서울', '판교', '경기', '재택', '원격'],
  exclude_company_sizes: ['소기업', '중소기업'],
  min_employee_count: 100,
  allow_startup: true,
  exclude_entry_only: true,
}

function makeJob(overrides: Partial<JobCandidate> = {}): JobCandidate {
  return {
    position: '백엔드 개발자',
    raw_text: 'Java Spring Boot 경력 3년 이상',
    location: '서울 강남구',
    company_size: '대기업',
    employee_count: 500,
    employment_type: '정규직',
    ...overrides,
  }
}

describe('Filter Engine', () => {
  it('should pass job matching include keywords', () => {
    const result = applyFilter(makeJob(), defaultConfig)
    expect(result.passed).toBe(true)
  })

  it('should reject job with no matching keywords', () => {
    const result = applyFilter(
      makeJob({ position: 'iOS 개발자', raw_text: 'Swift UIKit 개발' }),
      defaultConfig
    )
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('키워드')
  })

  it('should reject 소기업', () => {
    const result = applyFilter(makeJob({ company_size: '소기업' }), defaultConfig)
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('기업규모')
  })

  it('should reject 중소기업 under 100 employees', () => {
    const result = applyFilter(
      makeJob({ company_size: '중소기업', employee_count: 50 }),
      defaultConfig
    )
    expect(result.passed).toBe(false)
  })

  it('should pass 스타트업', () => {
    const result = applyFilter(
      makeJob({ company_size: '스타트업', employee_count: 30 }),
      defaultConfig
    )
    expect(result.passed).toBe(true)
  })

  it('should reject 신입만', () => {
    const result = applyFilter(
      makeJob({ raw_text: 'Java Spring Boot 신입만 지원 가능' }),
      defaultConfig
    )
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('신입')
  })

  it('should pass 경력/신입 both', () => {
    const result = applyFilter(
      makeJob({ raw_text: 'Java 경력/신입 모두 가능' }),
      defaultConfig
    )
    expect(result.passed).toBe(true)
  })

  it('should reject wrong location', () => {
    const result = applyFilter(makeJob({ location: '부산' }), defaultConfig)
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('지역')
  })

  it('should pass game + AX keyword combo', () => {
    const result = applyFilter(
      makeJob({ position: '게임 AX 개발자', raw_text: '게임 산업 AI 전환 프로젝트' }),
      defaultConfig
    )
    expect(result.passed).toBe(true)
  })

  it('should reject game without AX/DX keyword', () => {
    const result = applyFilter(
      makeJob({ position: '게임 클라이언트 개발자', raw_text: 'Unity C# 게임 개발' }),
      defaultConfig
    )
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('게임')
  })

  it('should pass when company_size is unknown', () => {
    const result = applyFilter(
      makeJob({ company_size: undefined, employee_count: undefined }),
      defaultConfig
    )
    expect(result.passed).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/lib/filters.test.ts
```

- [ ] **Step 3: Implement filters.ts**

```typescript
// src/lib/filters.ts

export interface FilterConfig {
  include_keywords: string[]
  exclude_keywords: string[]
  locations: string[]
  exclude_company_sizes: string[]
  min_employee_count: number
  allow_startup: boolean
  exclude_entry_only: boolean
}

export interface JobCandidate {
  position: string
  raw_text: string
  location?: string
  company_size?: string
  employee_count?: number
  employment_type?: string
}

export interface FilterResult {
  passed: boolean
  reason?: string
}

const GAME_KEYWORDS = ['게임']
const AX_DX_KEYWORDS = ['AI', 'AX', 'DX', '디지털전환', '현대화', '클라우드전환', '레거시현대화', 'AI활용', 'AI도입', '생성형AI']

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

function containsAny(text: string, keywords: string[]): boolean {
  const norm = normalize(text)
  return keywords.some((kw) => norm.includes(normalize(kw)))
}

function isEntryOnly(text: string): boolean {
  // "신입만", "신입 한정", "인턴만" 이 있되, "경력" 이 같이 있으면 통과
  const norm = normalize(text)
  const hasEntryOnly = ['신입만', '신입한정', '인턴만'].some((kw) => norm.includes(kw))
  if (!hasEntryOnly) return false
  // "경력" 이 같이 있으면 경력/신입 동시 모집 → 통과
  return !norm.includes('경력')
}

export function applyFilter(job: JobCandidate, config: FilterConfig): FilterResult {
  const combinedText = `${job.position} ${job.raw_text}`

  // 1. 제외 키워드 (신입만)
  if (config.exclude_entry_only && isEntryOnly(combinedText)) {
    return { passed: false, reason: '신입만/인턴만 공고' }
  }

  // 2. 게임 산업 특수 로직
  if (containsAny(combinedText, GAME_KEYWORDS)) {
    if (!containsAny(combinedText, AX_DX_KEYWORDS)) {
      return { passed: false, reason: '게임 단독, AX/DX 키워드 없음' }
    }
    // 게임 + AX/DX → 통과 (다른 조건도 체크)
  }

  // 3. 포함 키워드 매칭
  if (!containsAny(combinedText, config.include_keywords)) {
    return { passed: false, reason: '매칭 키워드 없음' }
  }

  // 4. 지역 매칭
  if (job.location) {
    const locationMatch = config.locations.some((loc) =>
      normalize(job.location!).includes(normalize(loc))
    )
    if (!locationMatch) {
      return { passed: false, reason: `지역 불일치: ${job.location}` }
    }
  }

  // 5. 기업 규모
  if (job.company_size) {
    const isStartup = normalize(job.company_size).includes('스타트업')

    if (isStartup && config.allow_startup) {
      // 스타트업은 허용
    } else if (config.exclude_company_sizes.some((s) =>
      normalize(job.company_size!).includes(normalize(s))
    )) {
      return { passed: false, reason: `기업규모 제외: ${job.company_size}` }
    } else if (
      !isStartup &&
      job.employee_count !== undefined &&
      job.employee_count < config.min_employee_count
    ) {
      return { passed: false, reason: `사원수 ${job.employee_count}명 (기준: ${config.min_employee_count}명)` }
    }
  }

  return { passed: true }
}
```

- [ ] **Step 4: Run test to verify all pass**

```bash
npm run test -- tests/lib/filters.test.ts
```

Expected: 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/filters.ts tests/lib/filters.test.ts
git commit -m "feat: add rule-based job filter engine with keyword, location, company size logic"
```

---

## Task 6: OpenClaw CLI Wrapper

**Files:**
- Create: `src/lib/openclaw.ts`
- Test: `tests/lib/openclaw.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/lib/openclaw.test.ts
import { describe, it, expect, vi } from 'vitest'
import { buildPrompt, parseOpenClawResponse } from '@/lib/openclaw'

describe('OpenClaw Wrapper', () => {
  it('should build prompt from template and variables', () => {
    const template = '다음 JD를 평가하세요:\n\n{{jd}}\n\n내 프로필:\n{{profile}}'
    const vars = { jd: 'Java 백엔드 개발자', profile: '3년차 개발자' }
    const result = buildPrompt(template, vars)
    expect(result).toContain('Java 백엔드 개발자')
    expect(result).toContain('3년차 개발자')
    expect(result).not.toContain('{{')
  })

  it('should parse valid JSON response', () => {
    const raw = '{"fit_score": 4.3, "fit_reason": "good match"}'
    const result = parseOpenClawResponse(raw)
    expect(result.success).toBe(true)
    expect(result.data.fit_score).toBe(4.3)
  })

  it('should handle invalid JSON gracefully', () => {
    const raw = 'This is not JSON but some text response'
    const result = parseOpenClawResponse(raw)
    expect(result.success).toBe(false)
    expect(result.raw).toBe(raw)
  })

  it('should extract JSON from mixed text response', () => {
    const raw = 'Here is the result:\n```json\n{"fit_score": 3.5}\n```\nDone.'
    const result = parseOpenClawResponse(raw)
    expect(result.success).toBe(true)
    expect(result.data.fit_score).toBe(3.5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/lib/openclaw.test.ts
```

- [ ] **Step 3: Implement openclaw.ts**

```typescript
// src/lib/openclaw.ts
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const execFileAsync = promisify(execFile)

export interface OpenClawResponse {
  success: boolean
  data: Record<string, unknown>
  raw?: string
  error?: string
}

export function buildPrompt(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return result
}

export function parseOpenClawResponse(raw: string): OpenClawResponse {
  // 1. 직접 JSON 파싱 시도
  try {
    const data = JSON.parse(raw)
    return { success: true, data }
  } catch {
    // 2. ```json ... ``` 블록에서 추출 시도
    const jsonMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1].trim())
        return { success: true, data }
      } catch {
        // fall through
      }
    }

    // 3. { 로 시작하는 블록 추출 시도
    const braceMatch = raw.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      try {
        const data = JSON.parse(braceMatch[0])
        return { success: true, data }
      } catch {
        // fall through
      }
    }

    return { success: false, data: {}, raw }
  }
}

export async function callOpenClaw(message: string): Promise<OpenClawResponse> {
  const timeout = parseInt(process.env.OPENCLAW_TIMEOUT || '60000', 10)

  try {
    const { stdout, stderr } = await execFileAsync(
      'openclaw',
      ['agent', '--message', message, '--json'],
      { timeout, maxBuffer: 10 * 1024 * 1024 }
    )

    if (stderr) {
      console.error('[OpenClaw stderr]', stderr)
    }

    return parseOpenClawResponse(stdout)
  } catch (err: unknown) {
    const error = err as Error & { killed?: boolean }
    if (error.killed) {
      return { success: false, data: {}, error: 'OpenClaw 응답 시간 초과' }
    }
    return { success: false, data: {}, error: error.message }
  }
}

export function loadPromptTemplate(promptName: string): string {
  const promptPath = path.join(process.cwd(), 'src', 'prompts', `${promptName}.md`)
  return fs.readFileSync(promptPath, 'utf-8')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/lib/openclaw.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/openclaw.ts tests/lib/openclaw.test.ts
git commit -m "feat: add OpenClaw CLI wrapper with prompt builder and response parser"
```

---

## Task 7: Scanner Types + Saramin Scanner

**Files:**
- Create: `src/scanners/types.ts`, `src/scanners/saramin.ts`
- Test: `tests/scanners/saramin.test.ts`

- [ ] **Step 1: Create scanner types**

```typescript
// src/scanners/types.ts
export interface ScanResult {
  source: string
  source_id: string
  company: string
  position: string
  location: string
  employment_type: string
  company_size?: string
  employee_count?: number
  raw_url: string
  deadline?: string
  salary_text?: string
  raw_text: string
  questions?: string[]
}

export interface ScannerConfig {
  keywords: string[]
  location_codes: string[]
  exclude_keywords: string[]
}

export interface Scanner {
  name: string
  scan(config: ScannerConfig): Promise<ScanResult[]>
}
```

- [ ] **Step 2: Write failing test for Saramin scanner**

```typescript
// tests/scanners/saramin.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseSaraminResponse } from '@/scanners/saramin'

// 사람인 API 응답 예시 (실제 구조 기반)
const mockApiResponse = {
  jobs: {
    count: 2,
    job: [
      {
        id: '12345',
        company: { detail: { name: '카카오' } },
        position: {
          title: '백엔드 개발자',
          location: { name: '서울 > 강남구' },
          'job-type': { name: '정규직' },
          'experience-level': { name: '경력 3~5년' },
        },
        'opening-timestamp': 1712448000,
        'expiration-timestamp': 1713052800,
        'close-type': { name: '접수마감일' },
        salary: { name: '면접 후 결정' },
        url: 'https://saramin.co.kr/job/12345',
      },
      {
        id: '67890',
        company: { detail: { name: '네이버' } },
        position: {
          title: 'AI 플랫폼 엔지니어',
          location: { name: '경기 > 성남시 분당구' },
          'job-type': { name: '정규직' },
          'experience-level': { name: '경력 5년 이상' },
        },
        'opening-timestamp': 1712448000,
        'expiration-timestamp': 1713657600,
        'close-type': { name: '접수마감일' },
        salary: { name: '회사내규에 따름' },
        url: 'https://saramin.co.kr/job/67890',
      },
    ],
  },
}

describe('Saramin Scanner', () => {
  it('should parse API response into ScanResult array', () => {
    const results = parseSaraminResponse(mockApiResponse)
    expect(results).toHaveLength(2)
    expect(results[0].company).toBe('카카오')
    expect(results[0].source).toBe('saramin')
    expect(results[0].source_id).toBe('12345')
    expect(results[0].position).toBe('백엔드 개발자')
    expect(results[0].location).toContain('서울')
  })

  it('should handle empty response', () => {
    const results = parseSaraminResponse({ jobs: { count: 0, job: [] } })
    expect(results).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test -- tests/scanners/saramin.test.ts
```

- [ ] **Step 4: Implement saramin.ts**

```typescript
// src/scanners/saramin.ts
import type { Scanner, ScannerConfig, ScanResult } from './types'

interface SaraminJob {
  id: string
  company: { detail: { name: string } }
  position: {
    title: string
    location: { name: string }
    'job-type': { name: string }
    'experience-level': { name: string }
  }
  'opening-timestamp': number
  'expiration-timestamp': number
  'close-type': { name: string }
  salary: { name: string }
  url: string
}

interface SaraminApiResponse {
  jobs: {
    count: number
    job: SaraminJob[]
  }
}

export function parseSaraminResponse(response: SaraminApiResponse): ScanResult[] {
  const jobs = response.jobs?.job || []

  return jobs.map((job) => {
    const deadline = job['expiration-timestamp']
      ? new Date(job['expiration-timestamp'] * 1000).toISOString().split('T')[0]
      : undefined

    return {
      source: 'saramin',
      source_id: job.id,
      company: job.company?.detail?.name || '',
      position: job.position?.title || '',
      location: job.position?.location?.name || '',
      employment_type: job.position?.['job-type']?.name || '',
      raw_url: job.url || '',
      deadline,
      salary_text: job.salary?.name || '',
      raw_text: [
        job.position?.title,
        job.position?.['experience-level']?.name,
        job.position?.location?.name,
        job.salary?.name,
      ].filter(Boolean).join('\n'),
    }
  })
}

export const saraminScanner: Scanner = {
  name: 'saramin',

  async scan(config: ScannerConfig): Promise<ScanResult[]> {
    const apiKey = process.env.SARAMIN_API_KEY
    if (!apiKey) throw new Error('SARAMIN_API_KEY not set')

    const params = new URLSearchParams({
      'access-key': apiKey,
      keywords: config.keywords.join(' '),
      count: '100',
      sort: 'pd', // 최신순
    })

    // 지역 코드가 있으면 추가
    if (config.location_codes.length > 0) {
      params.set('loc_cd', config.location_codes.join(','))
    }

    const url = `https://oapi.saramin.co.kr/recruit-search?${params}`
    const res = await fetch(url)

    if (!res.ok) {
      throw new Error(`Saramin API error: ${res.status} ${res.statusText}`)
    }

    const data: SaraminApiResponse = await res.json()
    return parseSaraminResponse(data)
  },
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test -- tests/scanners/saramin.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/scanners/types.ts src/scanners/saramin.ts tests/scanners/saramin.test.ts
git commit -m "feat: add Saramin API scanner with response parser"
```

---

## Task 8: JobKorea + Remember Scanners

**Files:**
- Create: `src/scanners/jobkorea.ts`, `src/scanners/remember.ts`
- Test: `tests/scanners/jobkorea.test.ts`, `tests/scanners/remember.test.ts`

- [ ] **Step 1: Write JobKorea parser test with sample HTML**

```typescript
// tests/scanners/jobkorea.test.ts
import { describe, it, expect } from 'vitest'
import { parseJobKoreaHtml } from '@/scanners/jobkorea'

// 잡코리아 검색 결과 HTML 구조 (실제 DOM 기반 간소화)
const sampleHtml = `
<div class="list-default">
  <div class="list-item">
    <div class="post-list-info">
      <a href="/Recruit/GI_Read/12345" class="title">
        <span>백엔드 개발자 (Java/Spring)</span>
      </a>
      <a href="/Company/1111" class="name">카카오</a>
    </div>
    <div class="post-list-info-detail">
      <p class="option">
        <span class="exp">경력 3~5년</span>
        <span class="loc">서울 강남구</span>
        <span class="edu">대졸 이상</span>
      </p>
      <p class="date">~04/20(일)</p>
    </div>
  </div>
</div>
`

describe('JobKorea Scanner', () => {
  it('should parse search result HTML', () => {
    const results = parseJobKoreaHtml(sampleHtml)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].company).toBe('카카오')
    expect(results[0].position).toContain('백엔드')
    expect(results[0].source).toBe('jobkorea')
  })
})
```

- [ ] **Step 2: Write Remember parser test**

```typescript
// tests/scanners/remember.test.ts
import { describe, it, expect } from 'vitest'
import { parseRememberHtml } from '@/scanners/remember'

const sampleHtml = `
<div class="job-card">
  <a href="/jobs/12345" class="job-card-link">
    <h3 class="job-title">풀스택 개발자</h3>
    <p class="company-name">네이버</p>
    <p class="location">서울</p>
    <p class="deadline">~2026.04.20</p>
  </a>
</div>
`

describe('Remember Scanner', () => {
  it('should parse job listing HTML', () => {
    const results = parseRememberHtml(sampleHtml)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].company).toBe('네이버')
    expect(results[0].source).toBe('remember')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm run test -- tests/scanners/jobkorea.test.ts tests/scanners/remember.test.ts
```

- [ ] **Step 4: Implement jobkorea.ts**

```typescript
// src/scanners/jobkorea.ts
import * as cheerio from 'cheerio'
import type { Scanner, ScannerConfig, ScanResult } from './types'

export function parseJobKoreaHtml(html: string): ScanResult[] {
  const $ = cheerio.load(html)
  const results: ScanResult[] = []

  $('.list-item').each((_, el) => {
    const $el = $(el)
    const titleEl = $el.find('.title span').first()
    const companyEl = $el.find('.name').first()
    const linkEl = $el.find('.title').first()
    const href = linkEl.attr('href') || ''
    const sourceId = href.match(/GI_Read\/(\d+)/)?.[1] || ''

    const position = titleEl.text().trim()
    const company = companyEl.text().trim()
    const location = $el.find('.loc').text().trim()
    const experience = $el.find('.exp').text().trim()
    const dateText = $el.find('.date').text().trim()

    if (!position || !company) return

    results.push({
      source: 'jobkorea',
      source_id: sourceId,
      company,
      position,
      location,
      employment_type: '',
      raw_url: href.startsWith('http') ? href : `https://www.jobkorea.co.kr${href}`,
      deadline: dateText,
      raw_text: [position, experience, location].filter(Boolean).join('\n'),
    })
  })

  return results
}

export const jobkoreaScanner: Scanner = {
  name: 'jobkorea',

  async scan(config: ScannerConfig): Promise<ScanResult[]> {
    const keyword = config.keywords.join(' ')
    const url = `https://www.jobkorea.co.kr/Search/?stext=${encodeURIComponent(keyword)}&tabType=recruit`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CareerWorker/1.0)',
      },
    })

    if (!res.ok) throw new Error(`JobKorea fetch error: ${res.status}`)

    const html = await res.text()

    // rate limit: 1초 대기
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return parseJobKoreaHtml(html)
  },
}
```

- [ ] **Step 5: Implement remember.ts**

```typescript
// src/scanners/remember.ts
import * as cheerio from 'cheerio'
import type { Scanner, ScannerConfig, ScanResult } from './types'

export function parseRememberHtml(html: string): ScanResult[] {
  const $ = cheerio.load(html)
  const results: ScanResult[] = []

  $('.job-card').each((_, el) => {
    const $el = $(el)
    const linkEl = $el.find('a').first()
    const href = linkEl.attr('href') || ''
    const sourceId = href.match(/jobs\/(\d+)/)?.[1] || ''

    const position = $el.find('.job-title').text().trim()
    const company = $el.find('.company-name').text().trim()
    const location = $el.find('.location').text().trim()
    const deadline = $el.find('.deadline').text().trim()

    if (!position || !company) return

    results.push({
      source: 'remember',
      source_id: sourceId,
      company,
      position,
      location,
      employment_type: '',
      raw_url: href.startsWith('http') ? href : `https://career.rememberapp.co.kr${href}`,
      deadline,
      raw_text: [position, location].filter(Boolean).join('\n'),
    })
  })

  return results
}

export const rememberScanner: Scanner = {
  name: 'remember',

  async scan(config: ScannerConfig): Promise<ScanResult[]> {
    const keyword = config.keywords.join(' ')
    const url = `https://career.rememberapp.co.kr/search?query=${encodeURIComponent(keyword)}`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CareerWorker/1.0)',
      },
    })

    if (!res.ok) throw new Error(`Remember fetch error: ${res.status}`)

    const html = await res.text()
    return parseRememberHtml(html)
  },
}
```

**참고:** 잡코리아와 리멤버의 실제 HTML 구조는 실행 시점에 확인 후 파서 조정 필요. 위 코드는 일반적인 구조 기반이며, 실제 사이트의 DOM 셀렉터는 브라우저에서 확인 후 수정해야 함.

- [ ] **Step 6: Run tests**

```bash
npm run test -- tests/scanners/
```

Expected: 모든 scanner 테스트 PASS

- [ ] **Step 7: Commit**

```bash
git add src/scanners/jobkorea.ts src/scanners/remember.ts tests/scanners/jobkorea.test.ts tests/scanners/remember.test.ts
git commit -m "feat: add JobKorea HTML parser and Remember board parser scanners"
```

---

## Task 9: Scan Orchestrator

**Files:**
- Create: `src/scanners/orchestrator.ts`
- Test: `tests/scanners/orchestrator.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/scanners/orchestrator.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { processResults } from '@/scanners/orchestrator'
import type { ScanResult } from '@/scanners/types'
import type { FilterConfig } from '@/lib/filters'

const defaultFilter: FilterConfig = {
  include_keywords: ['Java', 'Spring', '백엔드'],
  exclude_keywords: ['신입만'],
  locations: ['서울', '판교', '경기'],
  exclude_company_sizes: ['소기업', '중소기업'],
  min_employee_count: 100,
  allow_startup: true,
  exclude_entry_only: true,
}

const mockResults: ScanResult[] = [
  {
    source: 'saramin',
    source_id: '111',
    company: '카카오',
    position: 'Java 백엔드 개발자',
    location: '서울 강남구',
    employment_type: '정규직',
    raw_url: 'https://saramin.co.kr/111',
    raw_text: 'Java Spring Boot 경력 3년',
  },
  {
    source: 'saramin',
    source_id: '222',
    company: 'iOS회사',
    position: 'iOS 개발자',
    location: '서울',
    employment_type: '정규직',
    raw_url: 'https://saramin.co.kr/222',
    raw_text: 'Swift UIKit iOS 개발',
  },
]

describe('Scan Orchestrator', () => {
  beforeEach(() => {
    process.env.DATA_DIR = './data'
    process.env.DB_NAME = 'test-orchestrator.db'
    process.env.JOBS_DIR = './.test-jobs'
  })

  it('should separate passed and filtered results', () => {
    const { passed, filtered } = processResults(mockResults, defaultFilter)
    expect(passed).toHaveLength(1)
    expect(passed[0].company).toBe('카카오')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].company).toBe('iOS회사')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/scanners/orchestrator.test.ts
```

- [ ] **Step 3: Implement orchestrator.ts**

```typescript
// src/scanners/orchestrator.ts
import crypto from 'crypto'
import { getDb } from '@/lib/db'
import { applyFilter, type FilterConfig } from '@/lib/filters'
import { saveRawJob } from '@/lib/file-store'
import { generateJobId } from '@/lib/job-id'
import { saraminScanner } from './saramin'
import { jobkoreaScanner } from './jobkorea'
import { rememberScanner } from './remember'
import type { Scanner, ScanResult } from './types'

const SCANNERS: Record<string, Scanner> = {
  saramin: saraminScanner,
  jobkorea: jobkoreaScanner,
  remember: rememberScanner,
}

function makeFingerprint(result: ScanResult): string {
  const input = `${result.raw_url}|${result.company}|${result.position}`
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32)
}

export function processResults(
  results: ScanResult[],
  filterConfig: FilterConfig
): { passed: ScanResult[]; filtered: ScanResult[] } {
  const passed: ScanResult[] = []
  const filtered: ScanResult[] = []

  for (const result of results) {
    const filterResult = applyFilter(
      {
        position: result.position,
        raw_text: result.raw_text,
        location: result.location,
        company_size: result.company_size,
        employee_count: result.employee_count,
      },
      filterConfig
    )

    if (filterResult.passed) {
      passed.push(result)
    } else {
      filtered.push({ ...result, _filterReason: filterResult.reason } as ScanResult & { _filterReason?: string })
    }
  }

  return { passed, filtered }
}

export interface ScanRunResult {
  total_found: number
  new_count: number
  duplicate_count: number
  filtered_count: number
  passed_count: number
}

export async function runScan(
  sourceId: number,
  channel: string,
  config: Record<string, unknown>,
  filterConfig: FilterConfig
): Promise<ScanRunResult> {
  const db = getDb()
  const scanner = SCANNERS[channel]
  if (!scanner) throw new Error(`Unknown channel: ${channel}`)

  // scan_runs 기록 시작
  const run = db
    .prepare('INSERT INTO scan_runs (source_id, status) VALUES (?, ?)')
    .run(sourceId, 'running')
  const runId = run.lastInsertRowid

  try {
    const scannerConfig = {
      keywords: (config.keywords as string[]) || [],
      location_codes: (config.location_codes as string[]) || [],
      exclude_keywords: (config.exclude_keywords as string[]) || [],
    }

    const results = await scanner.scan(scannerConfig)
    const stats: ScanRunResult = {
      total_found: results.length,
      new_count: 0,
      duplicate_count: 0,
      filtered_count: 0,
      passed_count: 0,
    }

    for (const result of results) {
      const fp = makeFingerprint(result)

      // 중복 체크
      const existing = db
        .prepare('SELECT id FROM job_fingerprints WHERE fingerprint = ?')
        .get(fp)

      if (existing) {
        stats.duplicate_count++
        continue
      }

      // 1차 필터
      const filterResult = applyFilter(
        {
          position: result.position,
          raw_text: result.raw_text,
          location: result.location,
          company_size: result.company_size,
          employee_count: result.employee_count,
        },
        filterConfig
      )

      const jobId = generateJobId()
      const status = filterResult.passed ? 'passed' : 'filtered_out'

      // jobs 테이블 INSERT
      db.prepare(`
        INSERT INTO jobs (job_id, source, source_id, company, position, location,
          employment_type, company_size, employee_count, raw_url, deadline,
          salary_text, status, filter_reason, raw_file)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        jobId, result.source, result.source_id, result.company,
        result.position, result.location, result.employment_type,
        result.company_size || null, result.employee_count || null,
        result.raw_url, result.deadline || null, result.salary_text || null,
        status, filterResult.reason || null, `raw/${jobId}.md`
      )

      // fingerprint INSERT
      db.prepare('INSERT INTO job_fingerprints (fingerprint, job_id, source) VALUES (?, ?, ?)')
        .run(fp, jobId, result.source)

      // raw 파일 저장
      const rawContent = [
        `# ${result.company} - ${result.position}`,
        `- source: ${result.source}`,
        `- url: ${result.raw_url}`,
        `- collected_at: ${new Date().toISOString()}`,
        '',
        '# 원문 JD',
        result.raw_text,
      ].join('\n')
      saveRawJob(jobId, rawContent)

      if (filterResult.passed) {
        stats.passed_count++
        stats.new_count++
      } else {
        stats.filtered_count++
        stats.new_count++
      }
    }

    // scan_runs 완료
    db.prepare(`
      UPDATE scan_runs SET status = 'completed', finished_at = datetime('now'),
        total_found = ?, new_count = ?, duplicate_count = ?, filtered_count = ?, passed_count = ?
      WHERE id = ?
    `).run(stats.total_found, stats.new_count, stats.duplicate_count,
      stats.filtered_count, stats.passed_count, runId)

    // source last_scan 갱신
    db.prepare("UPDATE sources SET last_scan = datetime('now') WHERE id = ?").run(sourceId)

    return stats
  } catch (err) {
    const error = err as Error
    db.prepare("UPDATE scan_runs SET status = 'failed', finished_at = datetime('now'), error_message = ? WHERE id = ?")
      .run(error.message, runId)
    throw err
  }
}
```

- [ ] **Step 4: Run test**

```bash
npm run test -- tests/scanners/orchestrator.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scanners/orchestrator.ts tests/scanners/orchestrator.test.ts
git commit -m "feat: add scan orchestrator with fingerprint dedup, filter, and DB persistence"
```

---

## Task 10: Scan API Routes

**Files:**
- Create: `src/app/api/scan/sources/route.ts`, `src/app/api/scan/sources/[id]/route.ts`, `src/app/api/scan/run/route.ts`, `src/app/api/scan/run/[sourceId]/route.ts`, `src/app/api/scan/history/route.ts`

- [ ] **Step 1: Implement sources CRUD**

```typescript
// src/app/api/scan/sources/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const sources = db.prepare('SELECT * FROM sources ORDER BY created_at DESC').all()
  return NextResponse.json(sources)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { channel, name, config } = body

  if (!channel || !name || !config) {
    return NextResponse.json({ error: 'channel, name, config 필수' }, { status: 400 })
  }

  const db = getDb()
  const result = db
    .prepare('INSERT INTO sources (channel, name, config) VALUES (?, ?, ?)')
    .run(channel, name, JSON.stringify(config))

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}
```

```typescript
// src/app/api/scan/sources/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const db = getDb()

  const sets: string[] = []
  const values: unknown[] = []

  if (body.name !== undefined) { sets.push('name = ?'); values.push(body.name) }
  if (body.config !== undefined) { sets.push('config = ?'); values.push(JSON.stringify(body.config)) }
  if (body.enabled !== undefined) { sets.push('enabled = ?'); values.push(body.enabled ? 1 : 0) }

  if (sets.length === 0) return NextResponse.json({ error: '변경할 내용 없음' }, { status: 400 })

  values.push(id)
  db.prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return NextResponse.json({ success: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM sources WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Implement scan run route**

```typescript
// src/app/api/scan/run/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { runScan } from '@/scanners/orchestrator'
import type { FilterConfig } from '@/lib/filters'

// 기본 필터 설정 (profile.yml에서 로드할 수 있도록 나중에 확장)
const DEFAULT_FILTER: FilterConfig = {
  include_keywords: [
    'Java', 'Spring', '백엔드', '풀스택', 'React', 'JavaScript', 'TypeScript',
    'Node', 'Python', 'PostgreSQL', 'Oracle',
    'AI', 'AX', 'DX', '디지털전환', '현대화', '클라우드전환',
    '레거시현대화', 'AI활용', 'AI도입', '생성형AI',
    '업무시스템', 'ERP', 'MES', 'SCM', '물류', '커머스', '핀테크',
  ],
  exclude_keywords: ['신입만', '신입 한정', '인턴만'],
  locations: ['서울', '판교', '경기', '재택', '원격'],
  exclude_company_sizes: ['소기업', '중소기업'],
  min_employee_count: 100,
  allow_startup: true,
  exclude_entry_only: true,
}

export async function POST() {
  const db = getDb()
  const sources = db.prepare('SELECT * FROM sources WHERE enabled = 1').all() as Array<{
    id: number; channel: string; config: string
  }>

  const results = []

  for (const source of sources) {
    try {
      const config = JSON.parse(source.config)
      const result = await runScan(source.id, source.channel, config, DEFAULT_FILTER)
      results.push({ source_id: source.id, channel: source.channel, ...result })
    } catch (err) {
      const error = err as Error
      results.push({ source_id: source.id, channel: source.channel, error: error.message })
    }
  }

  return NextResponse.json({ results })
}
```

```typescript
// src/app/api/scan/run/[sourceId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { runScan } from '@/scanners/orchestrator'

// DEFAULT_FILTER는 위 route.ts와 동일 → 공통 모듈로 추출 가능
// 간결함을 위해 여기서는 import 가정

export async function POST(_: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params
  const db = getDb()
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId) as {
    id: number; channel: string; config: string
  } | undefined

  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

  const config = JSON.parse(source.config)

  // 필터 설정은 공통 모듈에서 가져오도록 리팩토링
  const { DEFAULT_FILTER } = await import('../route')

  const result = await runScan(source.id, source.channel, config, DEFAULT_FILTER)
  return NextResponse.json(result)
}
```

- [ ] **Step 3: Implement scan history route**

```typescript
// src/app/api/scan/history/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const history = db
    .prepare(`
      SELECT sr.*, s.name as source_name, s.channel
      FROM scan_runs sr
      JOIN sources s ON sr.source_id = s.id
      ORDER BY sr.started_at DESC
      LIMIT 50
    `)
    .all()

  return NextResponse.json(history)
}
```

- [ ] **Step 4: Verify dev server works**

```bash
npm run dev
# curl http://localhost:3010/api/scan/sources 확인
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/scan/
git commit -m "feat: add scan API routes (sources CRUD, run, history)"
```

---

## Task 11: Jobs API Routes

**Files:**
- Create: `src/app/api/jobs/route.ts`, `src/app/api/jobs/stats/route.ts`, `src/app/api/jobs/[jobId]/route.ts`

- [ ] **Step 1: Implement jobs list + stats**

```typescript
// src/app/api/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const source = searchParams.get('source')
  const minScore = searchParams.get('min_score')
  const search = searchParams.get('search')

  const db = getDb()
  let query = 'SELECT * FROM jobs WHERE 1=1'
  const params: unknown[] = []

  if (status) { query += ' AND status = ?'; params.push(status) }
  if (source) { query += ' AND source = ?'; params.push(source) }
  if (minScore) { query += ' AND fit_score >= ?'; params.push(parseFloat(minScore)) }
  if (search) {
    query += ' AND (company LIKE ? OR position LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  // filtered_out은 기본적으로 숨김
  if (!status) { query += " AND status != 'filtered_out'" }

  query += ' ORDER BY created_at DESC LIMIT 200'

  const jobs = db.prepare(query).all(...params)
  return NextResponse.json(jobs)
}
```

```typescript
// src/app/api/jobs/stats/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  const total = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status != 'filtered_out'").get() as { count: number }
  const newJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'passed'").get() as { count: number }
  const matched = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'matched'").get() as { count: number }
  const deadlineSoon = db.prepare(`
    SELECT COUNT(*) as count FROM jobs
    WHERE status IN ('passed', 'matched')
    AND deadline IS NOT NULL
    AND deadline >= date('now')
    AND deadline <= date('now', '+3 days')
  `).get() as { count: number }
  const expired = db.prepare(`
    SELECT COUNT(*) as count FROM jobs
    WHERE deadline IS NOT NULL AND deadline < date('now')
    AND status NOT IN ('filtered_out', 'applied', 'withdrawn')
  `).get() as { count: number }

  return NextResponse.json({
    total: total.count,
    new_jobs: newJobs.count,
    matched: matched.count,
    deadline_soon: deadlineSoon.count,
    expired: expired.count,
  })
}
```

- [ ] **Step 2: Implement job detail + update**

```typescript
// src/app/api/jobs/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { readRawJob } from '@/lib/file-store'

export async function GET(_: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const db = getDb()
  const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId)

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // raw 파일 내용도 함께 반환
  let rawContent = ''
  try { rawContent = readRawJob(jobId) } catch { /* file may not exist */ }

  // outputs 조회
  const outputs = db.prepare('SELECT * FROM outputs WHERE job_id = ? ORDER BY created_at DESC').all(jobId)

  return NextResponse.json({ ...job as object, rawContent, outputs })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const body = await request.json()
  const db = getDb()

  const sets: string[] = ["updated_at = datetime('now')"]
  const values: unknown[] = []

  if (body.status !== undefined) { sets.push('status = ?'); values.push(body.status) }
  if (body.memo !== undefined) { sets.push('memo = ?'); values.push(body.memo) }

  values.push(jobId)
  db.prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE job_id = ?`).run(...values)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/jobs/
git commit -m "feat: add jobs API routes (list, stats, detail, update)"
```

---

## Task 12: AI Action Routes (evaluate, generate)

**Files:**
- Create: `src/app/api/jobs/[jobId]/evaluate/route.ts`, `src/app/api/jobs/[jobId]/generate-answers/route.ts`, `src/app/api/jobs/[jobId]/generate-resume/route.ts`, `src/app/api/jobs/[jobId]/generate-reply/route.ts`
- Create: `src/prompts/evaluate-fit.md`, `src/prompts/generate-answer-pack.md`, `src/prompts/generate-resume.md`, `src/prompts/recruiter-reply.md`

- [ ] **Step 1: Create prompt templates**

```markdown
<!-- src/prompts/evaluate-fit.md -->
당신은 채용 공고 적합도 평가 전문가입니다.

## 내 프로필
{{profile}}

## 내 핵심역량
{{skills}}

## 공고 원문
{{jd}}

## 지시사항
위 공고가 내 프로필에 얼마나 적합한지 평가하세요.
반드시 아래 JSON 형식으로만 응답하세요.

```json
{
  "fit_score": (1.0~5.0 소수점 한 자리),
  "fit_reason": "(한 줄 요약)",
  "strengths": ["내가 이 공고에 맞는 이유 1", "이유 2"],
  "risks": ["부족한 점 1", "부족한 점 2"],
  "recommended_stories": ["S001", "S003"],
  "questions_detected": ["감지된 자소서 문항 1", "문항 2"],
  "summary": "(3줄 요약)"
}
```
```

```markdown
<!-- src/prompts/generate-answer-pack.md -->
당신은 한국어 자소서 작성 전문가입니다.

## 내 프로필
{{profile}}

## 내 커리어 스토리
{{career_story}}

## 관련 사례
{{stories}}

## 기존 답변 톤 참고
{{answer_bank}}

## 공고 정보
{{jd}}

## 감지된 문항
{{questions}}

## 지시사항
각 문항에 대해 300자, 500자, 800자, 1200자 버전을 작성하세요.
담백하고 실무형 톤으로, 과장하지 않고 결과와 근거 중심으로 작성하세요.
반드시 아래 JSON 형식으로만 응답하세요.

```json
{
  "answers": [
    {
      "question": "문항 내용",
      "versions": {
        "300": "300자 답변",
        "500": "500자 답변",
        "800": "800자 답변",
        "1200": "1200자 답변"
      },
      "used_stories": ["S001"]
    }
  ]
}
```
```

```markdown
<!-- src/prompts/generate-resume.md -->
당신은 맞춤형 이력서 재구성 전문가입니다.

## 내 이력서 원본
{{resume}}

## 공고 정보
{{jd}}

## 적합도 평가 결과
{{evaluation}}

## 지시사항
공고에 맞게 이력서를 재구성하세요. 경력 순서, 강조점, 키워드를 조정하세요.
반드시 아래 JSON 형식으로만 응답하세요.

```json
{
  "resume_md": "(마크다운 전문)",
  "highlights": ["강조한 포인트 1", "포인트 2"],
  "adjusted_sections": ["변경 내용 1", "변경 내용 2"]
}
```
```

```markdown
<!-- src/prompts/recruiter-reply.md -->
당신은 리크루터/스카우트 메시지 답장 전문가입니다.

## 내 프로필
{{profile}}

## 받은 메시지
{{message}}

## 채널
{{channel}}

## 지시사항
프로페셔널하고 담백한 톤으로 답장을 작성하세요.
반드시 아래 JSON 형식으로만 응답하세요.

```json
{
  "reply_ko": "(한국어 답장)",
  "reply_en": "(영어 답장, LinkedIn용)",
  "tone": "professional",
  "key_points": ["포인트 1", "포인트 2"]
}
```
```

- [ ] **Step 2: Implement evaluate route**

```typescript
// src/app/api/jobs/[jobId]/evaluate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { readRawJob } from '@/lib/file-store'
import { readProfileFile } from '@/lib/file-store'
import { callOpenClaw, buildPrompt, loadPromptTemplate } from '@/lib/openclaw'

export async function POST(_: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const db = getDb()
  const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId) as Record<string, unknown> | undefined

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const rawJd = readRawJob(jobId)
    const profile = readProfileFile('profile.yml')
    const skills = readProfileFile('master_resume.md')

    const template = loadPromptTemplate('evaluate-fit')
    const prompt = buildPrompt(template, { profile, skills, jd: rawJd })
    const response = await callOpenClaw(prompt)

    if (!response.success) {
      return NextResponse.json({ error: response.error || 'AI 응답 파싱 실패', raw: response.raw }, { status: 500 })
    }

    const data = response.data
    db.prepare(`
      UPDATE jobs SET
        status = CASE WHEN ? >= 3.5 THEN 'matched' ELSE 'low_fit' END,
        fit_score = ?, fit_reason = ?, risks = ?,
        recommended_stories = ?, updated_at = datetime('now')
      WHERE job_id = ?
    `).run(
      data.fit_score, data.fit_score,
      data.fit_reason,
      JSON.stringify(data.risks || []),
      JSON.stringify(data.recommended_stories || []),
      jobId
    )

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Implement generate-answers route**

```typescript
// src/app/api/jobs/[jobId]/generate-answers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { readRawJob, readProfileFile, saveOutput } from '@/lib/file-store'
import { callOpenClaw, buildPrompt, loadPromptTemplate } from '@/lib/openclaw'

export async function POST(_: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const db = getDb()

  try {
    const rawJd = readRawJob(jobId)
    const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId) as Record<string, unknown>
    const profile = readProfileFile('profile.yml')
    const careerStory = readProfileFile('career_story.md')
    const storyBank = readProfileFile('story_bank.md')
    const answerBank = readProfileFile('answer_bank.md')

    const questions = job.recommended_stories
      ? JSON.stringify(JSON.parse(job.recommended_stories as string))
      : '자동 감지'

    const template = loadPromptTemplate('generate-answer-pack')
    const prompt = buildPrompt(template, {
      profile, career_story: careerStory, stories: storyBank,
      answer_bank: answerBank, jd: rawJd, questions,
    })

    const response = await callOpenClaw(prompt)
    if (!response.success) {
      return NextResponse.json({ error: response.error || 'AI 응답 실패', raw: response.raw }, { status: 500 })
    }

    // 마크다운 형식으로 변환 후 파일 저장
    const answers = response.data.answers as Array<Record<string, unknown>>
    let md = `# 자소서 답변 - ${job.company} ${job.position}\n\n`
    for (const a of answers || []) {
      md += `## ${a.question}\n\n`
      const versions = a.versions as Record<string, string>
      for (const [len, text] of Object.entries(versions || {})) {
        md += `### ${len}자\n${text}\n\n`
      }
    }

    const filePath = saveOutput(jobId, 'answer_pack', md, 'ko')
    db.prepare('INSERT INTO outputs (job_id, type, file_path) VALUES (?, ?, ?)').run(jobId, 'answer_pack', filePath)
    db.prepare("UPDATE jobs SET status = 'draft_ready', updated_at = datetime('now') WHERE job_id = ?").run(jobId)

    return NextResponse.json({ success: true, file_path: filePath, data: response.data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Implement generate-resume + generate-reply routes**

같은 패턴. 프롬프트 템플릿 + OpenClaw 호출 + 파일 저장 + DB 갱신.

```typescript
// src/app/api/jobs/[jobId]/generate-resume/route.ts
// 패턴 동일: loadPromptTemplate('generate-resume') → buildPrompt → callOpenClaw → saveOutput('resume')

// src/app/api/jobs/[jobId]/generate-reply/route.ts
// 패턴 동일: loadPromptTemplate('recruiter-reply') → buildPrompt → callOpenClaw → saveOutput('recruiter_reply')
// 추가: request body에서 { message, channel } 받음
```

구현 코드는 generate-answers와 동일한 구조. 프롬프트 변수와 출력 타입만 다름.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/jobs/ src/prompts/
git commit -m "feat: add AI action routes (evaluate, generate answers/resume/reply) with prompts"
```

---

## Task 13: Profile + Outputs API Routes

**Files:**
- Create: `src/app/api/profile/route.ts`, `src/app/api/outputs/route.ts`, `src/app/api/outputs/[id]/route.ts`

- [ ] **Step 1: Implement profile route**

```typescript
// src/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readProfileFile, writeProfileFile, listProfileFiles } from '@/lib/file-store'

export async function GET() {
  const files = listProfileFiles()
  const profile: Record<string, string> = {}

  for (const file of files) {
    profile[file] = readProfileFile(file)
  }

  return NextResponse.json({ files, profile })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { fileName, content } = body

  if (!fileName || content === undefined) {
    return NextResponse.json({ error: 'fileName, content 필수' }, { status: 400 })
  }

  // 보안: profile 디렉터리 밖으로 나가는 경로 차단
  if (fileName.includes('..') || fileName.includes('/')) {
    return NextResponse.json({ error: '잘못된 파일명' }, { status: 400 })
  }

  writeProfileFile(fileName, content)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Implement outputs routes**

```typescript
// src/app/api/outputs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('job_id')
  const type = searchParams.get('type')

  const db = getDb()
  let query = 'SELECT o.*, j.company, j.position FROM outputs o JOIN jobs j ON o.job_id = j.job_id WHERE 1=1'
  const params: unknown[] = []

  if (jobId) { query += ' AND o.job_id = ?'; params.push(jobId) }
  if (type) { query += ' AND o.type = ?'; params.push(type) }

  query += ' ORDER BY o.created_at DESC LIMIT 100'

  const outputs = db.prepare(query).all(...params)
  return NextResponse.json(outputs)
}
```

```typescript
// src/app/api/outputs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { readOutput } from '@/lib/file-store'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const output = db.prepare('SELECT * FROM outputs WHERE id = ?').get(id) as { file_path: string } | undefined

  if (!output) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const content = readOutput(output.file_path)
  return NextResponse.json({ ...output, content })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM outputs WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/profile/ src/app/api/outputs/
git commit -m "feat: add profile and outputs API routes"
```

---

## Task 14: App Layout + Navigation

**Files:**
- Create: `src/app/layout.tsx`, `src/components/nav.tsx`

- [ ] **Step 1: Implement navigation component**

```tsx
// src/components/nav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: '📊' },
  { href: '/jobs', label: '공고', icon: '📋' },
  { href: '/sources', label: '수집원', icon: '🔍' },
  { href: '/profile', label: '프로필', icon: '👤' },
  { href: '/outputs', label: '산출물', icon: '📄' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="w-56 bg-gray-900 text-white min-h-screen p-4">
      <h1 className="text-lg font-bold mb-8 px-2">Career Worker</h1>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm
                  ${active ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Implement root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Career Worker',
  description: '개인 채용 공고 수집 & 자소서 생성 도우미',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="flex">
          <Nav />
          <main className="flex-1 p-6 bg-gray-50 min-h-screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/components/nav.tsx
git commit -m "feat: add app layout with sidebar navigation"
```

---

## Task 15: Dashboard Page

**Files:**
- Create: `src/app/page.tsx`, `src/components/stat-card.tsx`, `src/components/job-table.tsx`

- [ ] **Step 1: Implement stat card component**

```tsx
// src/components/stat-card.tsx
interface StatCardProps {
  label: string
  value: number
  color?: string
}

export function StatCard({ label, value, color = 'blue' }: StatCardProps) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-sm opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}
```

- [ ] **Step 2: Implement job table component**

```tsx
// src/components/job-table.tsx
import Link from 'next/link'

interface Job {
  job_id: string
  company: string
  position: string
  source: string
  deadline: string | null
  fit_score: number | null
  status: string
  company_size: string | null
}

interface JobTableProps {
  jobs: Job[]
  showScore?: boolean
}

function dDay(deadline: string | null): string {
  if (!deadline) return '상시'
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (diff < 0) return '마감'
  if (diff === 0) return 'D-Day'
  return `D-${diff}`
}

export function JobTable({ jobs, showScore = true }: JobTableProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="py-2 px-3">회사</th>
          <th className="py-2 px-3">포지션</th>
          <th className="py-2 px-3">채널</th>
          <th className="py-2 px-3">마감</th>
          {showScore && <th className="py-2 px-3">점수</th>}
          <th className="py-2 px-3">상태</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.job_id} className="border-b hover:bg-gray-100">
            <td className="py-2 px-3">
              <Link href={`/jobs/${job.job_id}`} className="text-blue-600 hover:underline">
                {job.company}
              </Link>
            </td>
            <td className="py-2 px-3">{job.position}</td>
            <td className="py-2 px-3">{job.source}</td>
            <td className="py-2 px-3">{dDay(job.deadline)}</td>
            {showScore && <td className="py-2 px-3">{job.fit_score ?? '-'}</td>}
            <td className="py-2 px-3">
              <span className="px-2 py-0.5 rounded text-xs bg-gray-200">{job.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 3: Implement dashboard page**

```tsx
// src/app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { StatCard } from '@/components/stat-card'
import { JobTable } from '@/components/job-table'

interface Stats {
  total: number
  new_jobs: number
  matched: number
  deadline_soon: number
  expired: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, new_jobs: 0, matched: 0, deadline_soon: 0, expired: 0 })
  const [matchedJobs, setMatchedJobs] = useState([])
  const [scanning, setScanning] = useState(false)

  const loadData = async () => {
    const [statsRes, jobsRes] = await Promise.all([
      fetch('/api/jobs/stats'),
      fetch('/api/jobs?status=matched'),
    ])
    setStats(await statsRes.json())
    setMatchedJobs(await jobsRes.json())
  }

  useEffect(() => { loadData() }, [])

  const handleScan = async () => {
    setScanning(true)
    await fetch('/api/scan/run', { method: 'POST' })
    await loadData()
    setScanning(false)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {scanning ? '스캔 중...' : '스캔 실행'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="총 수집" value={stats.total} color="blue" />
        <StatCard label="신규" value={stats.new_jobs} color="green" />
        <StatCard label="적합" value={stats.matched} color="yellow" />
        <StatCard label="마감임박 (D≤3)" value={stats.deadline_soon} color="red" />
      </div>

      <h2 className="text-lg font-semibold mb-3">적합 공고</h2>
      <div className="bg-white rounded-lg shadow">
        <JobTable jobs={matchedJobs} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/stat-card.tsx src/components/job-table.tsx
git commit -m "feat: add dashboard page with stats cards and matched jobs table"
```

---

## Task 16: Jobs List + Detail Pages

**Files:**
- Create: `src/app/jobs/page.tsx`, `src/app/jobs/[jobId]/page.tsx`, `src/components/loading-button.tsx`, `src/components/copy-button.tsx`

- [ ] **Step 1: Implement utility components**

```tsx
// src/components/loading-button.tsx
'use client'

'use client'

import { useState } from 'react'

interface LoadingButtonProps {
  onClick: () => Promise<void>
  label: string
  loadingLabel: string
  className?: string
}

export function LoadingButton({ onClick, label, loadingLabel, className = '' }: LoadingButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try { await onClick() } finally { setLoading(false) }
  }

  return (
    <button onClick={handleClick} disabled={loading}
      className={`px-4 py-2 rounded disabled:opacity-50 ${className}`}>
      {loading ? loadingLabel : label}
    </button>
  )
}
```

```tsx
// src/components/copy-button.tsx
'use client'

import { useState } from 'react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={handleCopy} className="px-2 py-1 text-xs border rounded hover:bg-gray-100">
      {copied ? '복사됨' : '복사'}
    </button>
  )
}
```

- [ ] **Step 2: Implement jobs list page**

```tsx
// src/app/jobs/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { JobTable } from '@/components/job-table'

export default function JobsPage() {
  const [jobs, setJobs] = useState([])
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [search, setSearch] = useState('')

  const loadJobs = async () => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (source) params.set('source', source)
    if (search) params.set('search', search)

    const res = await fetch(`/api/jobs?${params}`)
    setJobs(await res.json())
  }

  useEffect(() => { loadJobs() }, [status, source])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">공고 목록</h1>

      <div className="flex gap-4 mb-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-3 py-2">
          <option value="">전체 상태</option>
          <option value="passed">미평가</option>
          <option value="matched">적합</option>
          <option value="low_fit">부적합</option>
          <option value="draft_ready">초안완료</option>
          <option value="applied">지원완료</option>
        </select>

        <select value={source} onChange={(e) => setSource(e.target.value)} className="border rounded px-3 py-2">
          <option value="">전체 채널</option>
          <option value="saramin">사람인</option>
          <option value="jobkorea">잡코리아</option>
          <option value="remember">리멤버</option>
        </select>

        <form onSubmit={(e) => { e.preventDefault(); loadJobs() }} className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="회사/포지션 검색" className="border rounded px-3 py-2" />
          <button type="submit" className="px-4 py-2 bg-gray-200 rounded">검색</button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow">
        <JobTable jobs={jobs} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement job detail page**

```tsx
// src/app/jobs/[jobId]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CopyButton } from '@/components/copy-button'

export default function JobDetailPage() {
  const { jobId } = useParams()
  const [job, setJob] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const loadJob = async () => {
    const res = await fetch(`/api/jobs/${jobId}`)
    setJob(await res.json())
  }

  useEffect(() => { loadJob() }, [jobId])

  const runAction = async (action: string) => {
    setLoading(action)
    await fetch(`/api/jobs/${jobId}/${action}`, { method: 'POST' })
    await loadJob()
    setLoading(null)
  }

  if (!job) return <div>로딩 중...</div>

  const outputs = (job.outputs || []) as Array<Record<string, unknown>>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{job.company as string} - {job.position as string}</h1>
      <p className="text-gray-500 mb-6">
        {job.source as string} | {job.location as string} | {job.company_size as string || '규모 미상'}
      </p>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* 좌: 원문 JD */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">원문 JD</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-700">
            {job.rawContent as string || '원문 없음'}
          </pre>
        </div>

        {/* 우: AI 평가 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">AI 평가</h2>
          {job.fit_score ? (
            <div className="space-y-2 text-sm">
              <p><strong>점수:</strong> {job.fit_score as number}/5.0</p>
              <p><strong>이유:</strong> {job.fit_reason as string}</p>
              <p><strong>리스크:</strong> {JSON.parse((job.risks as string) || '[]').join(', ')}</p>
              <p><strong>추천 스토리:</strong> {JSON.parse((job.recommended_stories as string) || '[]').join(', ')}</p>
            </div>
          ) : (
            <p className="text-gray-400">아직 평가되지 않음</p>
          )}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-3 mb-6">
        <button onClick={() => runAction('evaluate')} disabled={loading === 'evaluate'}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          {loading === 'evaluate' ? 'AI 평가 중...' : 'AI 평가 실행'}
        </button>
        <button onClick={() => runAction('generate-answers')} disabled={loading === 'generate-answers'}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">
          {loading === 'generate-answers' ? '생성 중...' : '자소서 생성'}
        </button>
        <button onClick={() => runAction('generate-resume')} disabled={loading === 'generate-resume'}
          className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50">
          {loading === 'generate-resume' ? '생성 중...' : '이력서 생성'}
        </button>
      </div>

      {/* 산출물 */}
      {outputs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">생성된 산출물</h2>
          {outputs.map((o) => (
            <div key={o.id as number} className="flex items-center justify-between py-2 border-b">
              <span className="text-sm">{o.type as string} ({o.created_at as string})</span>
              <div className="flex gap-2">
                <button onClick={async () => {
                  const res = await fetch(`/api/outputs/${o.id}`)
                  const data = await res.json()
                  // 모달 or 새 탭으로 표시 — 간단하게 alert 대체
                  alert(data.content)
                }} className="text-xs border rounded px-2 py-1">보기</button>
                <CopyButton text="" /> {/* 실제 구현 시 content fetch 후 복사 */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/jobs/ src/components/loading-button.tsx src/components/copy-button.tsx
git commit -m "feat: add jobs list and job detail pages with AI action buttons"
```

---

## Task 17: Sources, Profile, Outputs Pages

**Files:**
- Create: `src/app/sources/page.tsx`, `src/app/profile/page.tsx`, `src/app/outputs/page.tsx`, `src/components/markdown-editor.tsx`

- [ ] **Step 1: Implement sources page**

```tsx
// src/app/sources/page.tsx
'use client'

import { useEffect, useState } from 'react'

interface Source {
  id: number; channel: string; name: string; config: string; enabled: number; last_scan: string | null
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [history, setHistory] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ channel: 'saramin', name: '', keywords: '' })

  const load = async () => {
    const [s, h] = await Promise.all([
      fetch('/api/scan/sources').then((r) => r.json()),
      fetch('/api/scan/history').then((r) => r.json()),
    ])
    setSources(s)
    setHistory(h)
  }

  useEffect(() => { load() }, [])

  const addSource = async () => {
    await fetch('/api/scan/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: form.channel,
        name: form.name,
        config: { keywords: form.keywords.split(',').map((k: string) => k.trim()) },
      }),
    })
    setShowAdd(false)
    load()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">수집원 관리</h1>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white rounded">+ 추가</button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}
              className="border rounded px-3 py-2">
              <option value="saramin">사람인</option>
              <option value="jobkorea">잡코리아</option>
              <option value="remember">리멤버</option>
            </select>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="이름 (예: 사람인_백엔드_서울)" className="border rounded px-3 py-2" />
            <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              placeholder="키워드 (쉼표 구분)" className="border rounded px-3 py-2" />
          </div>
          <button onClick={addSource} className="mt-3 px-4 py-2 bg-green-600 text-white rounded">저장</button>
        </div>
      )}

      {/* 수집원 목록 + 스캔 이력 테이블 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-gray-500">
            <th className="py-2 px-3">이름</th><th className="py-2 px-3">채널</th>
            <th className="py-2 px-3">마지막 스캔</th><th className="py-2 px-3">상태</th>
          </tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="py-2 px-3">{s.name}</td>
                <td className="py-2 px-3">{s.channel}</td>
                <td className="py-2 px-3">{s.last_scan || '없음'}</td>
                <td className="py-2 px-3">{s.enabled ? '활성' : '비활성'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mb-3">최근 스캔 이력</h2>
      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-gray-500">
            <th className="py-2 px-3">시각</th><th className="py-2 px-3">수집원</th>
            <th className="py-2 px-3">수집</th><th className="py-2 px-3">신규</th>
            <th className="py-2 px-3">통과</th><th className="py-2 px-3">상태</th>
          </tr></thead>
          <tbody>
            {(history as Array<Record<string, unknown>>).map((h, i) => (
              <tr key={i} className="border-b">
                <td className="py-2 px-3">{h.started_at as string}</td>
                <td className="py-2 px-3">{h.source_name as string}</td>
                <td className="py-2 px-3">{h.total_found as number}</td>
                <td className="py-2 px-3">{h.new_count as number}</td>
                <td className="py-2 px-3">{h.passed_count as number}</td>
                <td className="py-2 px-3">{h.status as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement markdown editor + profile page**

```tsx
// src/components/markdown-editor.tsx
'use client'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function MarkdownEditor({ value, onChange, className = '' }: MarkdownEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full font-mono text-sm p-4 border rounded resize-y min-h-[400px] ${className}`}
      spellCheck={false}
    />
  )
}
```

```tsx
// src/app/profile/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { MarkdownEditor } from '@/components/markdown-editor'

const TABS = [
  { key: 'profile.yml', label: '기본정보' },
  { key: 'master_resume.md', label: '이력서' },
  { key: 'career_story.md', label: '커리어스토리' },
  { key: 'story_bank.md', label: '스토리뱅크' },
  { key: 'answer_bank.md', label: '답변뱅크' },
  { key: 'links.md', label: '링크' },
]

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState(TABS[0].key)
  const [content, setContent] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/profile').then((r) => r.json()).then((data) => setContent(data.profile || {}))
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: activeTab, content: content[activeTab] || '' }),
    })
    setSaving(false)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">내 프로필</h1>
        <button onClick={save} disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded text-sm ${
              activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <MarkdownEditor
        value={content[activeTab] || ''}
        onChange={(v) => setContent({ ...content, [activeTab]: v })}
      />
    </div>
  )
}
```

- [ ] **Step 3: Implement outputs page**

```tsx
// src/app/outputs/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { CopyButton } from '@/components/copy-button'

export default function OutputsPage() {
  const [outputs, setOutputs] = useState<Array<Record<string, unknown>>>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [viewContent, setViewContent] = useState<string | null>(null)

  useEffect(() => {
    const params = typeFilter ? `?type=${typeFilter}` : ''
    fetch(`/api/outputs${params}`).then((r) => r.json()).then(setOutputs)
  }, [typeFilter])

  const viewOutput = async (id: number) => {
    const res = await fetch(`/api/outputs/${id}`)
    const data = await res.json()
    setViewContent(data.content)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">생성 산출물</h1>

      <div className="flex gap-2 mb-4">
        {['', 'answer_pack', 'resume', 'cover_letter', 'recruiter_reply'].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded text-sm ${
              typeFilter === t ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            {t || '전체'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-gray-500">
            <th className="py-2 px-3">날짜</th><th className="py-2 px-3">회사</th>
            <th className="py-2 px-3">타입</th><th className="py-2 px-3">액션</th>
          </tr></thead>
          <tbody>
            {outputs.map((o) => (
              <tr key={o.id as number} className="border-b">
                <td className="py-2 px-3">{(o.created_at as string)?.split('T')[0]}</td>
                <td className="py-2 px-3">{o.company as string} - {o.position as string}</td>
                <td className="py-2 px-3">{o.type as string}</td>
                <td className="py-2 px-3 flex gap-2">
                  <button onClick={() => viewOutput(o.id as number)}
                    className="text-xs border rounded px-2 py-1">보기</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setViewContent(null)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-auto w-full"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold">산출물 내용</h3>
              <CopyButton text={viewContent} />
            </div>
            <pre className="whitespace-pre-wrap text-sm">{viewContent}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/sources/ src/app/profile/ src/app/outputs/ src/components/markdown-editor.tsx
git commit -m "feat: add sources, profile, and outputs pages"
```

---

## Task 18: Profile Data Templates + Deployment Config

**Files:**
- Create: `profile/` 템플릿 파일들, `templates/`, `.env.example` 최종, `next.config.js` 포트 설정

- [ ] **Step 1: Create profile template files**

설계서 섹션 6의 템플릿 내용을 그대로 생성:
- `profile/profile.yml` — 기본정보, 타겟, 필터, 개인화 설정
- `profile/master_resume.md` — 이력서 골격
- `profile/career_story.md` — 커리어 스토리 골격
- `profile/story_bank.md` — 스토리 뱅크 (S001~S003)
- `profile/answer_bank.md` — 답변 뱅크 (지원동기, 협업, 문제해결 기본)
- `profile/links.md` — 링크 모음

설계서 `docs/specs/2026-04-07-career-worker-design.md` 섹션 6 참고.

- [ ] **Step 2: Create template files**

- `templates/normalized-job.schema.json` — 정규화 스키마 (설계서 섹션 6-7)
- `templates/answer-pack.template.md`
- `templates/resume.template.md`

- [ ] **Step 3: Configure next.config.js for port 3010**

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 native binding 대응
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'better-sqlite3']
    return config
  },
}

module.exports = nextConfig
```

package.json scripts에서 포트 지정:
```json
{
  "scripts": {
    "dev": "next dev -p 3010",
    "start": "next start -p 3010"
  }
}
```

- [ ] **Step 4: Create .env from .env.example**

```bash
cp .env.example .env
# .env에 실제 값 입력
```

- [ ] **Step 5: Full integration test**

```bash
npm run dev
# 1. http://localhost:3010/login 접속 → 비밀번호 입력
# 2. 대시보드 확인
# 3. Sources에서 수집원 추가
# 4. 스캔 실행
# 5. Jobs에서 공고 확인
# 6. 공고 상세에서 AI 평가 실행
```

- [ ] **Step 6: Commit all remaining files**

```bash
git add profile/ templates/ next.config.js
git commit -m "feat: add profile templates, job schema, and deployment config"
```

- [ ] **Step 7: Final commit — docs**

```bash
git add docs/
git commit -m "docs: add design spec and implementation plan"
```

---

## Summary

| Task | 내용 | 예상 파일 수 |
|------|------|-------------|
| 1 | Project Scaffolding | ~8 |
| 2 | SQLite Database Layer | 2 |
| 3 | Authentication System | 5 |
| 4 | File Store Utility | 3 |
| 5 | Rule-Based Filter Engine | 2 |
| 6 | OpenClaw CLI Wrapper | 2 |
| 7 | Scanner Types + Saramin | 3 |
| 8 | JobKorea + Remember Scanners | 4 |
| 9 | Scan Orchestrator | 2 |
| 10 | Scan API Routes | 5 |
| 11 | Jobs API Routes | 3 |
| 12 | AI Action Routes + Prompts | 8 |
| 13 | Profile + Outputs API | 3 |
| 14 | App Layout + Navigation | 2 |
| 15 | Dashboard Page | 3 |
| 16 | Jobs List + Detail Pages | 4 |
| 17 | Sources, Profile, Outputs Pages | 4 |
| 18 | Templates + Deployment | ~10 |

**총 18 tasks.** 순서대로 실행하면 동작하는 MVP 완성.

**의존성:** Task 1~6은 순서대로. Task 7~9는 6 이후. Task 10~13은 9 이후. Task 14~17은 13 이후. Task 18은 마지막.

**HTML 파서 주의:** JobKorea, Remember의 실제 DOM 구조는 실행 시점에 브라우저에서 확인 후 cheerio 셀렉터를 조정해야 함. 테스트의 sampleHtml은 예시이며, 실제 사이트 구조에 맞게 수정 필요.

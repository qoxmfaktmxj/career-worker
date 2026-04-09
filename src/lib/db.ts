import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

let db: Database.Database | null = null;

type TableColumn = {
  name: string;
  type: string;
  definition: string;
};

function isDefaultRelativeDir(configured: string, defaultDir: string): boolean {
  const normalized = configured.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized === defaultDir;
}

function canUseAbsoluteDataDir(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

function resolveDataDir(): string {
  const configured = process.env.DATA_DIR?.trim();

  if (!configured) {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
  }

  if (canUseAbsoluteDataDir() && path.isAbsolute(configured)) {
    return path.join(/*turbopackIgnore: true*/ configured);
  }

  if (isDefaultRelativeDir(configured, "data")) {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
  }

  throw new Error("DATA_DIR must be ./data or an absolute path");
}

export function getDb(): Database.Database {
  if (db) {
    return db;
  }

  const dataDir = resolveDataDir();
  const dbName = process.env.DB_NAME || "career.db";
  const dbPath = path.join(dataDir, dbName);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initSchema(db);

  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
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
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id              TEXT UNIQUE NOT NULL,
      source              TEXT NOT NULL,
      source_id           TEXT,
      company             TEXT NOT NULL,
      position            TEXT NOT NULL,
      location            TEXT,
      employment_type     TEXT,
      company_size        TEXT,
      employee_count      INTEGER,
      raw_url             TEXT,
      deadline            TEXT,
      deadline_text       TEXT,
      deadline_date       TEXT,
      deadline_parse_status TEXT DEFAULT 'missing',
      salary_text         TEXT,
      status              TEXT DEFAULT 'collected',
      fit_status          TEXT DEFAULT 'unreviewed',
      workflow_status     TEXT DEFAULT 'idle',
      application_status  TEXT DEFAULT 'not_started',
      fit_score           REAL,
      fit_reason          TEXT,
      risks               TEXT,
      recommended_stories TEXT,
      questions_detected  TEXT,
      listing_file        TEXT,
      detail_file         TEXT,
      detail_collected_at TEXT,
      detail_status       TEXT DEFAULT 'missing',
      raw_file            TEXT,
      normalized_file     TEXT,
      filter_reason       TEXT,
      memo                TEXT,
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now'))
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
      fetched_count   INTEGER DEFAULT 0,
      page_count      INTEGER DEFAULT 1,
      truncated       INTEGER DEFAULT 0,
      error_message   TEXT,
      FOREIGN KEY (source_id) REFERENCES sources(id)
    );

    CREATE TABLE IF NOT EXISTS scan_source_locks (
      source_id   INTEGER PRIMARY KEY,
      acquired_at TEXT DEFAULT (datetime('now')),
      expires_at  TEXT NOT NULL,
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

  `);

  migrateSchema(database);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_fit_status ON jobs(fit_status);
    CREATE INDEX IF NOT EXISTS idx_jobs_workflow_status ON jobs(workflow_status);
    CREATE INDEX IF NOT EXISTS idx_jobs_application_status ON jobs(application_status);
    CREATE INDEX IF NOT EXISTS idx_jobs_deadline ON jobs(deadline);
    CREATE INDEX IF NOT EXISTS idx_jobs_deadline_date ON jobs(deadline_date);
    CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
    CREATE INDEX IF NOT EXISTS idx_jobs_fit_score ON jobs(fit_score);
    CREATE INDEX IF NOT EXISTS idx_fingerprints_fp ON job_fingerprints(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_scan_runs_source ON scan_runs(source_id);
    CREATE INDEX IF NOT EXISTS idx_scan_source_locks_expires ON scan_source_locks(expires_at);
    CREATE INDEX IF NOT EXISTS idx_outputs_job ON outputs(job_id);
  `);

  ensureUniqueIndex(
    database,
    `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_raw_url_unique
      ON jobs(raw_url)
      WHERE raw_url IS NOT NULL AND raw_url != ''
    `,
    `
      SELECT raw_url
      FROM jobs
      WHERE raw_url IS NOT NULL AND raw_url != ''
      GROUP BY raw_url
      HAVING COUNT(*) > 1
      LIMIT 1
    `
  );

  ensureUniqueIndex(
    database,
    `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_source_id_unique
      ON jobs(source, source_id)
      WHERE source_id IS NOT NULL AND source_id != '' AND source != 'manual'
    `,
    `
      SELECT source, source_id
      FROM jobs
      WHERE source_id IS NOT NULL AND source_id != '' AND source != 'manual'
      GROUP BY source, source_id
      HAVING COUNT(*) > 1
      LIMIT 1
    `
  );
}

function getTableColumns(
  database: Database.Database,
  tableName: string
): Set<string> {
  const columns = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  return new Set(columns.map((column) => column.name));
}

function ensureColumns(
  database: Database.Database,
  tableName: string,
  columns: TableColumn[]
): void {
  const existingColumns = getTableColumns(database, tableName);

  for (const column of columns) {
    if (existingColumns.has(column.name)) {
      continue;
    }

    database.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.definition}`
    );
  }
}

function hasDuplicateRows(
  database: Database.Database,
  duplicateSql: string
): boolean {
  const duplicate = database.prepare(duplicateSql).get() as
    | Record<string, unknown>
    | undefined;

  return Boolean(duplicate);
}

function ensureUniqueIndex(
  database: Database.Database,
  indexSql: string,
  duplicateSql: string
): void {
  if (hasDuplicateRows(database, duplicateSql)) {
    return;
  }

  database.exec(indexSql);
}

function migrateSchema(database: Database.Database): void {
  ensureColumns(database, "jobs", [
    { name: "source_id", type: "TEXT", definition: "TEXT" },
    { name: "location", type: "TEXT", definition: "TEXT" },
    { name: "employment_type", type: "TEXT", definition: "TEXT" },
    { name: "company_size", type: "TEXT", definition: "TEXT" },
    { name: "employee_count", type: "INTEGER", definition: "INTEGER" },
    { name: "raw_url", type: "TEXT", definition: "TEXT" },
    { name: "deadline", type: "TEXT", definition: "TEXT" },
    { name: "deadline_text", type: "TEXT", definition: "TEXT" },
    { name: "deadline_date", type: "TEXT", definition: "TEXT" },
    {
      name: "deadline_parse_status",
      type: "TEXT",
      definition: "TEXT DEFAULT 'missing'",
    },
    { name: "salary_text", type: "TEXT", definition: "TEXT" },
    {
      name: "status",
      type: "TEXT",
      definition: "TEXT DEFAULT 'collected'",
    },
    {
      name: "fit_status",
      type: "TEXT",
      definition: "TEXT DEFAULT 'unreviewed'",
    },
    {
      name: "workflow_status",
      type: "TEXT",
      definition: "TEXT DEFAULT 'idle'",
    },
    {
      name: "application_status",
      type: "TEXT",
      definition: "TEXT DEFAULT 'not_started'",
    },
    { name: "fit_score", type: "REAL", definition: "REAL" },
    { name: "fit_reason", type: "TEXT", definition: "TEXT" },
    { name: "risks", type: "TEXT", definition: "TEXT" },
    {
      name: "recommended_stories",
      type: "TEXT",
      definition: "TEXT",
    },
    {
      name: "questions_detected",
      type: "TEXT",
      definition: "TEXT",
    },
    { name: "listing_file", type: "TEXT", definition: "TEXT" },
    { name: "detail_file", type: "TEXT", definition: "TEXT" },
    { name: "detail_collected_at", type: "TEXT", definition: "TEXT" },
    {
      name: "detail_status",
      type: "TEXT",
      definition: "TEXT DEFAULT 'missing'",
    },
    { name: "raw_file", type: "TEXT", definition: "TEXT" },
    { name: "normalized_file", type: "TEXT", definition: "TEXT" },
    { name: "filter_reason", type: "TEXT", definition: "TEXT" },
    { name: "memo", type: "TEXT", definition: "TEXT" },
    { name: "created_at", type: "TEXT", definition: "TEXT" },
    { name: "updated_at", type: "TEXT", definition: "TEXT" },
  ]);

  ensureColumns(database, "scan_runs", [
    { name: "fetched_count", type: "INTEGER", definition: "INTEGER DEFAULT 0" },
    { name: "page_count", type: "INTEGER", definition: "INTEGER DEFAULT 1" },
    { name: "truncated", type: "INTEGER", definition: "INTEGER DEFAULT 0" },
  ]);

  database.exec(`
    UPDATE scan_runs
    SET fetched_count = COALESCE(total_found, 0)
    WHERE fetched_count IS NULL
  `);

  database.exec(`
    UPDATE scan_runs
    SET page_count = 1
    WHERE page_count IS NULL OR page_count < 1
  `);

  database.exec(`
    UPDATE scan_runs
    SET truncated = 0
    WHERE truncated IS NULL
  `);

  database.exec(`
    UPDATE jobs
    SET deadline_text = deadline
    WHERE deadline_text IS NULL
      AND deadline IS NOT NULL
  `);

  database.exec(`
    UPDATE jobs
    SET deadline_date = deadline
    WHERE deadline_date IS NULL
      AND deadline GLOB '????-??-??'
  `);

  database.exec(`
    UPDATE jobs
    SET deadline_parse_status = CASE
      WHEN deadline_text IS NULL AND deadline_date IS NULL THEN 'missing'
      WHEN deadline_date IS NOT NULL THEN 'parsed'
      WHEN deadline_text IS NOT NULL THEN 'invalid'
      ELSE deadline_parse_status
    END
    WHERE deadline_parse_status IS NULL
       OR deadline_parse_status = ''
       OR deadline_parse_status = 'missing'
  `);

  database.exec(`
    UPDATE jobs
    SET fit_status = CASE
      WHEN status = 'filtered_out' THEN 'filtered_out'
      WHEN status = 'matched' THEN 'matched'
      WHEN status = 'low_fit' THEN 'low_fit'
      WHEN status = 'evaluation_failed' THEN 'evaluation_failed'
      WHEN status IN ('passed', 'draft_ready', 'applied', 'hold', 'withdrawn', 'closed') THEN
        CASE
          WHEN fit_score >= 3.5 THEN 'matched'
          WHEN fit_score > 0 THEN 'low_fit'
          ELSE 'passed'
        END
      ELSE 'unreviewed'
    END
    WHERE fit_status IS NULL
       OR fit_status = ''
  `);

  database.exec(`
    UPDATE jobs
    SET workflow_status = CASE
      WHEN status = 'generation_failed' THEN 'generation_failed'
      WHEN status = 'generating' THEN 'generating'
      WHEN status = 'draft_ready' THEN 'draft_ready'
      WHEN detail_status = 'ready' THEN 'detail_ready'
      WHEN detail_status IN ('missing', 'failed') THEN 'detail_pending'
      ELSE 'idle'
    END
    WHERE workflow_status IS NULL
       OR workflow_status = ''
  `);

  database.exec(`
    UPDATE jobs
    SET application_status = CASE
      WHEN status IN ('applied', 'hold', 'withdrawn', 'closed') THEN status
      ELSE 'not_started'
    END
    WHERE application_status IS NULL
       OR application_status = ''
  `);
}

export function closeDb(): void {
  if (!db) {
    return;
  }

  db.close();
  db = null;
}

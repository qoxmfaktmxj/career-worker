import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) {
    return db;
  }

  const dataDir = process.env.DATA_DIR || "./data";
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
      salary_text         TEXT,
      status              TEXT DEFAULT 'collected',
      fit_score           REAL,
      fit_reason          TEXT,
      risks               TEXT,
      recommended_stories TEXT,
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
  `);
}

export function closeDb(): void {
  if (!db) {
    return;
  }

  db.close();
  db = null;
}

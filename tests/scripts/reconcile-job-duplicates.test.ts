import fs from "fs";
import path from "path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_ROOT = path.join(
  __dirname,
  "../../.test-job-duplicate-maintenance"
);
const TEST_DATA_DIR = path.join(TEST_ROOT, "data");
const TEST_DB_PATH = path.join(TEST_DATA_DIR, "test-maintenance.db");
const TEST_JOBS_DIR = path.join(TEST_ROOT, "jobs");

function writeJobFile(relativePath: string, content: string): void {
  const absolutePath = path.join(TEST_JOBS_DIR, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf-8");
}

describe("reconcile job duplicates script", () => {
  beforeEach(() => {
    vi.resetModules();
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    fs.mkdirSync(TEST_JOBS_DIR, { recursive: true });

    process.env.NODE_ENV = "test";
    process.env.VITEST = "true";
    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.DB_NAME = path.basename(TEST_DB_PATH);
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import("@/lib/db");
      closeDb();
    } catch {
      // Ignore cleanup failures while the module is still missing in red phase.
    }

    vi.resetModules();
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("relinks duplicate records and recreates unique indexes", async () => {
    const { getDb, closeDb } = await import("@/lib/db");
    const db = getDb();

    db.exec(`
      DROP INDEX IF EXISTS idx_jobs_raw_url_unique;
      DROP INDEX IF EXISTS idx_jobs_source_source_id_unique;
    `);

    writeJobFile("listings/JOB-KEEP.md", "# keep listing");
    writeJobFile("details/JOB-KEEP.md", "# keep detail");
    writeJobFile("normalized/JOB-KEEP.json", "{\"keep\":true}");
    writeJobFile("listings/JOB-DROP.md", "# drop listing");

    db.prepare(
      `
        INSERT INTO jobs (
          job_id,
          source,
          source_id,
          company,
          position,
          raw_url,
          location,
          status,
          fit_status,
          workflow_status,
          application_status,
          fit_score,
          fit_reason,
          listing_file,
          detail_file,
          detail_status,
          raw_file,
          normalized_file,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "JOB-KEEP",
      "saramin",
      "123",
      "Acme",
      "Backend Engineer",
      "https://example.com/jobs/123",
      null,
      "collected",
      "matched",
      "detail_ready",
      "not_started",
      4.2,
      "strong fit",
      "listings/JOB-KEEP.md",
      "details/JOB-KEEP.md",
      "ready",
      "details/JOB-KEEP.md",
      "normalized/JOB-KEEP.json",
      "2026-04-09 09:00:00"
    );

    db.prepare(
      `
        INSERT INTO jobs (
          job_id,
          source,
          source_id,
          company,
          position,
          raw_url,
          location,
          status,
          fit_status,
          workflow_status,
          application_status,
          memo,
          listing_file,
          detail_status,
          raw_file,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "JOB-DROP",
      "saramin",
      "123",
      "Acme",
      "Backend Engineer",
      "https://example.com/jobs/123",
      "Seoul",
      "collected",
      "unreviewed",
      "detail_pending",
      "not_started",
      "merge memo",
      "listings/JOB-DROP.md",
      "missing",
      "listings/JOB-DROP.md",
      "2026-04-09 10:00:00"
    );

    db.prepare(
      "INSERT INTO outputs (job_id, type, file_path, language, version) VALUES (?, ?, ?, ?, ?)"
    ).run("JOB-KEEP", "resume", "resumes/keep.md", "ko", 1);
    db.prepare(
      "INSERT INTO outputs (job_id, type, file_path, language, version) VALUES (?, ?, ?, ?, ?)"
    ).run("JOB-DROP", "resume", "resumes/drop.md", "ko", 1);

    db.prepare(
      "INSERT INTO job_fingerprints (fingerprint, job_id, source) VALUES (?, ?, ?)"
    ).run("fp-keep", "JOB-KEEP", "saramin");
    db.prepare(
      "INSERT INTO job_fingerprints (fingerprint, job_id, source) VALUES (?, ?, ?)"
    ).run("fp-drop", "JOB-DROP", "saramin");

    closeDb();

    const { applyJobDuplicateMaintenance } = await import(
      "../../scripts/reconcile-job-duplicates.mjs"
    );

    const summary = applyJobDuplicateMaintenance({
      dbPath: TEST_DB_PATH,
      jobsDir: TEST_JOBS_DIR,
    });

    expect(summary.componentCount).toBe(1);
    expect(summary.jobsDeleted).toBe(1);
    expect(summary.outputsMoved).toBe(1);
    expect(summary.outputsRenumbered).toBe(1);
    expect(summary.fingerprintsMoved).toBe(1);
    expect(summary.indexesCreated).toEqual([
      "idx_jobs_raw_url_unique",
      "idx_jobs_source_source_id_unique",
    ]);

    const verifiedDb = new Database(TEST_DB_PATH);
    const jobs = verifiedDb
      .prepare(
        "SELECT job_id, location, memo FROM jobs ORDER BY created_at ASC, id ASC"
      )
      .all() as Array<{ job_id: string; location: string | null; memo: string | null }>;

    expect(jobs).toEqual([
      {
        job_id: "JOB-KEEP",
        location: "Seoul",
        memo: "merge memo",
      },
    ]);

    const outputs = verifiedDb
      .prepare(
        "SELECT job_id, version FROM outputs WHERE type = 'resume' ORDER BY version ASC"
      )
      .all() as Array<{ job_id: string; version: number }>;

    expect(outputs).toEqual([
      { job_id: "JOB-KEEP", version: 1 },
      { job_id: "JOB-KEEP", version: 2 },
    ]);

    const fingerprints = verifiedDb
      .prepare(
        "SELECT fingerprint, job_id FROM job_fingerprints ORDER BY fingerprint ASC"
      )
      .all() as Array<{ fingerprint: string; job_id: string }>;

    expect(fingerprints).toEqual([
      { fingerprint: "fp-drop", job_id: "JOB-KEEP" },
      { fingerprint: "fp-keep", job_id: "JOB-KEEP" },
    ]);

    expect(
      fs.existsSync(path.join(TEST_JOBS_DIR, "listings/JOB-DROP.md"))
    ).toBe(false);
    expect(
      fs.existsSync(path.join(TEST_JOBS_DIR, "listings/JOB-KEEP.md"))
    ).toBe(true);

    const indexes = verifiedDb
      .prepare(
        `
          SELECT name
          FROM sqlite_master
          WHERE type = 'index'
            AND name IN ('idx_jobs_raw_url_unique', 'idx_jobs_source_source_id_unique')
          ORDER BY name ASC
        `
      )
      .all() as Array<{ name: string }>;

    expect(indexes.map((index) => index.name)).toEqual([
      "idx_jobs_raw_url_unique",
      "idx_jobs_source_source_id_unique",
    ]);

    expect(() =>
      verifiedDb
        .prepare(
          `
            INSERT INTO jobs (job_id, source, source_id, company, position, raw_url)
            VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          "JOB-NEW",
          "saramin",
          "123",
          "Acme",
          "Backend Engineer",
          "https://example.com/jobs/123"
        )
    ).toThrow();

    verifiedDb.close();
  });
});

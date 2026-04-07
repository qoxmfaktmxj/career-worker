import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DB_PATH = path.join(__dirname, "../../data/test.db");

describe("Database", () => {
  beforeEach(() => {
    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.DATA_DIR = path.join(__dirname, "../../data");
    process.env.DB_NAME = "test.db";
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import("@/lib/db");
      closeDb();
    } catch {
      // Module may not exist yet during the initial red phase.
    }

    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it("should create all tables on init", async () => {
    const { getDb, closeDb } = await import("@/lib/db");
    const db = getDb();

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((table) => table.name);

    expect(tableNames).toContain("sources");
    expect(tableNames).toContain("jobs");
    expect(tableNames).toContain("job_fingerprints");
    expect(tableNames).toContain("scan_runs");
    expect(tableNames).toContain("outputs");
    expect(tableNames).toContain("sessions");

    closeDb();
  });

  it("should enable WAL mode", async () => {
    const { getDb, closeDb } = await import("@/lib/db");
    const db = getDb();

    const result = db.prepare("PRAGMA journal_mode").get() as {
      journal_mode: string;
    };

    expect(result.journal_mode).toBe("wal");

    closeDb();
  });
});

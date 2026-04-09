import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_PASSWORD = "test-pass-123";
const TEST_DB_PATH = path.join(__dirname, "../../data/test-auth.db");
const TEST_DATA_DIR = path.join(__dirname, "../../data");

describe("Auth", () => {
  beforeEach(() => {
    vi.resetModules();

    process.env.AUTH_PASSWORD = TEST_PASSWORD;
    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.DB_NAME = "test-auth.db";

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import("@/lib/db");
      closeDb();
    } catch {
      // ignore cleanup errors
    }

    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it("rejects wrong password", async () => {
    const { verifyPassword } = await import("@/lib/auth");

    expect(verifyPassword("wrong")).toBe(false);
  });

  it("accepts correct password", async () => {
    const { verifyPassword } = await import("@/lib/auth");

    expect(verifyPassword(TEST_PASSWORD)).toBe(true);
  });

  it("creates a persisted session row and validates it", async () => {
    const { createSession, validateSession } = await import("@/lib/auth");
    const { getDb } = await import("@/lib/db");
    const db = getDb();

    const sessionId = createSession();
    const stored = db
      .prepare("SELECT id FROM sessions WHERE id = ?")
      .get(sessionId) as { id: string } | undefined;

    expect(stored?.id).toBe(sessionId);
    expect(validateSession(sessionId)).toBe(true);
  });

  it("rejects unknown sessions", async () => {
    const { validateSession } = await import("@/lib/auth");

    expect(validateSession("nonexistent-id")).toBe(false);
  });

  it("deletes sessions on logout", async () => {
    const { createSession, deleteSession, validateSession } = await import(
      "@/lib/auth"
    );

    const sessionId = createSession();
    deleteSession(sessionId);

    expect(validateSession(sessionId)).toBe(false);
  });
});

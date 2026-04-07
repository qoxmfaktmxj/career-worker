import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_PASSWORD = "test-pass-123";
const TEST_DB_PATH = path.join(__dirname, "../../data/test-auth.db");

describe("Auth", () => {
  beforeEach(() => {
    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.AUTH_PASSWORD = TEST_PASSWORD;
    process.env.DATA_DIR = path.join(__dirname, "../../data");
    process.env.DB_NAME = "test-auth.db";
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import("@/lib/db");
      closeDb();
    } catch {
      // Module may not exist during the initial red phase.
    }

    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it("should reject wrong password", async () => {
    const { verifyPassword } = await import("@/lib/auth");

    expect(verifyPassword("wrong")).toBe(false);
  });

  it("should accept correct password", async () => {
    const { verifyPassword } = await import("@/lib/auth");

    expect(verifyPassword(TEST_PASSWORD)).toBe(true);
  });

  it("should create and validate session", async () => {
    const { createSession, validateSession } = await import("@/lib/auth");

    const sessionId = createSession();

    expect(sessionId).toBeTruthy();
    expect(validateSession(sessionId)).toBe(true);
  });

  it("should reject expired or missing session", async () => {
    const { validateSession } = await import("@/lib/auth");

    expect(validateSession("nonexistent-id")).toBe(false);
  });

  it("should delete an existing session", async () => {
    const { createSession, deleteSession, validateSession } = await import(
      "@/lib/auth"
    );

    const sessionId = createSession();

    deleteSession(sessionId);

    expect(validateSession(sessionId)).toBe(false);
  });
});

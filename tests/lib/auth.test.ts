import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_PASSWORD = "test-pass-123";
const TEST_SECRET = "test-session-secret-1234567890";

describe("Auth", () => {
  beforeEach(() => {
    vi.resetModules();

    process.env.AUTH_PASSWORD = TEST_PASSWORD;
    process.env.SESSION_SECRET = TEST_SECRET;
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

  it("should reject a tampered session token", async () => {
    const { createSession, validateSession } = await import("@/lib/auth");

    const sessionId = createSession();
    const tamperedSessionId = `${sessionId}tampered`;

    expect(validateSession(tamperedSessionId)).toBe(false);
  });
});

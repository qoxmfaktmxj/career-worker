import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DB_PATH = path.join(__dirname, "../../data/test-proxy.db");

describe("Proxy", () => {
  beforeEach(() => {
    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.DATA_DIR = path.join(__dirname, "../../data");
    process.env.DB_NAME = "test-proxy.db";
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import("@/lib/db");
      closeDb();
    } catch {
      // ignore cleanup errors during red phase
    }

    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it("redirects protected routes when session cookie is missing or invalid", async () => {
    const { proxy } = await import("@/proxy");

    const missingCookieRequest = new NextRequest("http://localhost/jobs");
    const invalidCookieRequest = new NextRequest("http://localhost/jobs", {
      headers: {
        cookie: "session_id=invalid-session",
      },
    });

    const missingCookieResponse = proxy(missingCookieRequest);
    const invalidCookieResponse = proxy(invalidCookieRequest);

    expect(missingCookieResponse.status).toBe(307);
    expect(missingCookieResponse.headers.get("location")).toBe(
      "http://localhost/login"
    );
    expect(invalidCookieResponse.status).toBe(307);
    expect(invalidCookieResponse.headers.get("location")).toBe(
      "http://localhost/login"
    );
  });

  it("allows protected routes when session cookie is valid", async () => {
    const { createSession } = await import("@/lib/auth");
    const { proxy } = await import("@/proxy");
    const sessionId = createSession();
    const request = new NextRequest("http://localhost/jobs", {
      headers: {
        cookie: `session_id=${sessionId}`,
      },
    });

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows public image assets without a session", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost/duck-mark.png");

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DB_PATH = path.join(__dirname, "../../data/test-scan-routes.db");
const TEST_DATA_DIR = path.join(__dirname, "../../data");
const runScanMock = vi.fn();

vi.mock("@/scanners/orchestrator", () => ({
  runScan: (...args: unknown[]) => runScanMock(...args),
}));

function makeJsonRequest(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: Record<string, unknown>
) {
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Scan API routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.DB_NAME = "test-scan-routes.db";
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import("@/lib/db");
      closeDb();
    } catch {
      // ignore cleanup errors while files are still being created
    }

    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it("creates and lists scan sources", async () => {
    const sourcesRoute = await import("@/app/api/scan/sources/route");

    const createResponse = await sourcesRoute.POST(
      makeJsonRequest("http://localhost/api/scan/sources", "POST", {
        channel: "saramin",
        name: "사람인 백엔드",
        config: { keywords: ["java"] },
      })
    );

    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toEqual({ id: 1 });

    const listResponse = await sourcesRoute.GET();
    const sources = (await listResponse.json()) as Array<{
      channel: string;
      name: string;
      config: string;
      enabled: number;
    }>;

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      channel: "saramin",
      name: "사람인 백엔드",
      enabled: 1,
    });
    expect(JSON.parse(sources[0].config)).toEqual({ keywords: ["java"] });
  });

  it("rejects an unsupported scan channel", async () => {
    const sourcesRoute = await import("@/app/api/scan/sources/route");

    const response = await sourcesRoute.POST(
      makeJsonRequest("http://localhost/api/scan/sources", "POST", {
        channel: "linkedin",
        name: "LinkedIn",
        config: { keywords: ["java"] },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Unsupported channel",
    });
  });

  it("updates and deletes a scan source", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    db.prepare("INSERT INTO sources (channel, name, config) VALUES (?, ?, ?)")
      .run("saramin", "초기 이름", JSON.stringify({ keywords: ["spring"] }));

    const sourceRoute = await import("@/app/api/scan/sources/[id]/route");

    const updateResponse = await sourceRoute.PUT(
      makeJsonRequest("http://localhost/api/scan/sources/1", "PUT", {
        name: "수정된 이름",
        config: { keywords: ["java", "react"] },
        enabled: false,
      }),
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toEqual({ success: true });

    const updatedSource = db
      .prepare("SELECT name, config, enabled FROM sources WHERE id = ?")
      .get(1) as { name: string; config: string; enabled: number };

    expect(updatedSource).toEqual({
      name: "수정된 이름",
      config: JSON.stringify({ keywords: ["java", "react"] }),
      enabled: 0,
    });

    const deleteResponse = await sourceRoute.DELETE(
      makeJsonRequest("http://localhost/api/scan/sources/1", "DELETE"),
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ success: true });
    expect(
      db.prepare("SELECT COUNT(*) as count FROM sources").get() as { count: number }
    ).toEqual({ count: 0 });
  });

  it("returns 409 when deleting a source that has scan history", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    db.prepare("INSERT INTO sources (channel, name, config) VALUES (?, ?, ?)")
      .run("saramin", "사람인 백엔드", JSON.stringify({ keywords: ["java"] }));
    db.prepare(
      "INSERT INTO scan_runs (source_id, status, finished_at) VALUES (?, ?, datetime('now'))"
    ).run(1, "completed");

    const sourceRoute = await import("@/app/api/scan/sources/[id]/route");
    const response = await sourceRoute.DELETE(
      makeJsonRequest("http://localhost/api/scan/sources/1", "DELETE"),
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Cannot delete a source with scan history",
    });
    expect(
      db.prepare("SELECT COUNT(*) as count FROM sources WHERE id = ?").get(1) as {
        count: number;
      }
    ).toEqual({ count: 1 });
  });

  it("runs enabled scan sources and returns per-source results", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    db.prepare("INSERT INTO sources (channel, name, config, enabled) VALUES (?, ?, ?, ?)")
      .run("saramin", "사람인", JSON.stringify({ keywords: ["java"] }), 1);
    db.prepare("INSERT INTO sources (channel, name, config, enabled) VALUES (?, ?, ?, ?)")
      .run("jobkorea", "잡코리아", JSON.stringify({ keywords: ["react"] }), 1);
    db.prepare("INSERT INTO sources (channel, name, config, enabled) VALUES (?, ?, ?, ?)")
      .run("remember", "리멤버", JSON.stringify({ keywords: ["node"] }), 0);

    runScanMock
      .mockResolvedValueOnce({
        total_found: 4,
        new_count: 2,
        duplicate_count: 1,
        filtered_count: 1,
        passed_count: 1,
      })
      .mockRejectedValueOnce(new Error("scanner unavailable"));

    const runRoute = await import("@/app/api/scan/run/route");
    const response = await runRoute.POST();
    const body = (await response.json()) as {
      results: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(runScanMock).toHaveBeenCalledTimes(2);
    expect(body.results).toEqual([
      {
        source_id: 1,
        channel: "saramin",
        total_found: 4,
        new_count: 2,
        duplicate_count: 1,
        filtered_count: 1,
        passed_count: 1,
      },
      {
        source_id: 2,
        channel: "jobkorea",
        error: "scanner unavailable",
      },
    ]);
  });

  it("runs a single source scan and returns 404 for a missing source", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    db.prepare("INSERT INTO sources (channel, name, config) VALUES (?, ?, ?)")
      .run("saramin", "사람인", JSON.stringify({ keywords: ["java"] }));

    runScanMock.mockResolvedValue({
      total_found: 3,
      new_count: 2,
      duplicate_count: 0,
      filtered_count: 1,
      passed_count: 1,
    });

    const runSourceRoute = await import("@/app/api/scan/run/[sourceId]/route");
    const response = await runSourceRoute.POST(
      makeJsonRequest("http://localhost/api/scan/run/1", "POST"),
      { params: Promise.resolve({ sourceId: "1" }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      total_found: 3,
      new_count: 2,
      duplicate_count: 0,
      filtered_count: 1,
      passed_count: 1,
    });
    expect(runScanMock).toHaveBeenCalledWith(
      1,
      "saramin",
      { keywords: ["java"] },
      expect.objectContaining({ allow_startup: true, min_employee_count: 100 })
    );

    const notFoundResponse = await runSourceRoute.POST(
      makeJsonRequest("http://localhost/api/scan/run/999", "POST"),
      { params: Promise.resolve({ sourceId: "999" }) }
    );

    expect(notFoundResponse.status).toBe(404);
    expect(await notFoundResponse.json()).toEqual({ error: "Source not found" });
  });

  it("returns 500 json when a single source scan fails", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    db.prepare("INSERT INTO sources (channel, name, config) VALUES (?, ?, ?)")
      .run("saramin", "사람인", JSON.stringify({ keywords: ["java"] }));

    runScanMock.mockRejectedValueOnce(new Error("scanner unavailable"));

    const runSourceRoute = await import("@/app/api/scan/run/[sourceId]/route");
    const response = await runSourceRoute.POST(
      makeJsonRequest("http://localhost/api/scan/run/1", "POST"),
      { params: Promise.resolve({ sourceId: "1" }) }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "scanner unavailable" });
  });

  it("returns joined scan history rows", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    db.prepare("INSERT INTO sources (channel, name, config) VALUES (?, ?, ?)")
      .run("saramin", "사람인", JSON.stringify({ keywords: ["java"] }));
    db.prepare(`
      INSERT INTO scan_runs (
        source_id,
        status,
        total_found,
        new_count,
        duplicate_count,
        filtered_count,
        passed_count,
        finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(1, "completed", 5, 3, 1, 1, 2);

    const historyRoute = await import("@/app/api/scan/history/route");
    const response = await historyRoute.GET();
    const rows = (await response.json()) as Array<{
      source_name: string;
      channel: string;
      total_found: number;
    }>;

    expect(response.status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source_name: "사람인",
      channel: "saramin",
      total_found: 5,
    });
  });
});

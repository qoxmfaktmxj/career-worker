import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DB_PATH = path.join(__dirname, "../../data/test-jobs-routes.db");
const TEST_DATA_DIR = path.join(__dirname, "../../data");
const TEST_JOBS_DIR = path.join(__dirname, "../../tmp/jobs-routes/jobs");
const TEST_OUTPUTS_DIR = path.join(__dirname, "../../tmp/jobs-routes/outputs");

function makeRequest(
  url: string,
  method: "GET" | "POST" | "PUT",
  body?: Record<string, unknown>
) {
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

describe("Jobs API routes", () => {
  beforeEach(() => {
    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    fs.rmSync(path.join(__dirname, "../../tmp/jobs-routes"), {
      recursive: true,
      force: true,
    });

    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.DB_NAME = "test-jobs-routes.db";
    process.env.JOBS_DIR = TEST_JOBS_DIR;
    process.env.OUTPUTS_DIR = TEST_OUTPUTS_DIR;
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

    fs.rmSync(path.join(__dirname, "../../tmp/jobs-routes"), {
      recursive: true,
      force: true,
    });
  });

  it("lists jobs with default filtered-out exclusion and query filters", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();

    db.prepare(`
      INSERT INTO jobs (
        job_id, source, company, position, status, fit_score
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run("JOB-001", "saramin", "Alpha", "Java Backend Engineer", "passed", 4.7);
    db.prepare(`
      INSERT INTO jobs (
        job_id, source, company, position, status, fit_score
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run("JOB-002", "jobkorea", "Beta", "Frontend Engineer", "matched", 4.2);
    db.prepare(`
      INSERT INTO jobs (
        job_id, source, company, position, status, fit_score
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run("JOB-003", "saramin", "Gamma", "Intern Backend", "filtered_out", 2.1);

    const jobsRoute = await import("@/app/api/jobs/route");

    const defaultResponse = await jobsRoute.GET(
      makeRequest("http://localhost/api/jobs", "GET")
    );
    const defaultJobs = (await defaultResponse.json()) as Array<{ job_id: string }>;

    expect(defaultResponse.status).toBe(200);
    expect(defaultJobs.map((job) => job.job_id).sort()).toEqual(["JOB-001", "JOB-002"]);

    const filteredResponse = await jobsRoute.GET(
      makeRequest(
        "http://localhost/api/jobs?source=saramin&min_score=4.5&search=Alpha",
        "GET"
      )
    );
    const filteredJobs = (await filteredResponse.json()) as Array<{ job_id: string }>;

    expect(filteredJobs).toHaveLength(1);
    expect(filteredJobs[0]?.job_id).toBe("JOB-001");

    const statusResponse = await jobsRoute.GET(
      makeRequest("http://localhost/api/jobs?status=filtered_out", "GET")
    );
    const statusJobs = (await statusResponse.json()) as Array<{ job_id: string }>;

    expect(statusJobs).toHaveLength(1);
    expect(statusJobs[0]?.job_id).toBe("JOB-003");
  });

  it("creates a manual job and persists raw JD content", async () => {
    const jobsRoute = await import("@/app/api/jobs/route");

    const createResponse = await jobsRoute.POST(
      makeRequest("http://localhost/api/jobs", "POST", {
        company: "Manual Corp",
        position: "Platform Engineer",
        rawText: "We build internal platform tooling.",
        rawUrl: "https://example.com/manual-job",
        location: "Seoul",
        deadline: "2026-04-30",
      })
    );
    const created = (await createResponse.json()) as { job_id: string };

    expect(createResponse.status).toBe(201);
    expect(created.job_id).toMatch(/^JOB-/);

    const { getDb } = await import("@/lib/db");
    const { readRawJob } = await import("@/lib/file-store");
    const db = getDb();
    const saved = db
      .prepare(
        `
          SELECT job_id, source, company, position, location, deadline, raw_url, status
          FROM jobs
          WHERE job_id = ?
        `
      )
      .get(created.job_id) as {
      job_id: string;
      source: string;
      company: string;
      position: string;
      location: string;
      deadline: string;
      raw_url: string;
      status: string;
    };

    expect(saved).toMatchObject({
      job_id: created.job_id,
      source: "manual",
      company: "Manual Corp",
      position: "Platform Engineer",
      location: "Seoul",
      deadline: "2026-04-30",
      raw_url: "https://example.com/manual-job",
      status: "passed",
    });
    expect(readRawJob(created.job_id)).toContain(
      "We build internal platform tooling."
    );
  });

  it("rejects manual job creation without required fields", async () => {
    const jobsRoute = await import("@/app/api/jobs/route");

    const response = await jobsRoute.POST(
      makeRequest("http://localhost/api/jobs", "POST", {
        company: "Manual Corp",
        rawText: "",
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "company, position, rawText is required",
    });
  });

  it("returns dashboard stats for current jobs", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();

    const insert = db.prepare(`
      INSERT INTO jobs (
        job_id, source, company, position, status, deadline
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    insert.run("JOB-010", "saramin", "Alpha", "Backend", "passed", dateOffset(2));
    insert.run("JOB-011", "jobkorea", "Beta", "Platform", "matched", dateOffset(1));
    insert.run("JOB-012", "remember", "Gamma", "Ops", "passed", dateOffset(-1));
    insert.run("JOB-013", "saramin", "Delta", "Intern", "filtered_out", dateOffset(5));
    insert.run("JOB-014", "saramin", "Epsilon", "Applied", "applied", dateOffset(-2));

    const statsRoute = await import("@/app/api/jobs/stats/route");
    const response = await statsRoute.GET();
    const stats = (await response.json()) as Record<string, number>;

    expect(response.status).toBe(200);
    expect(stats).toEqual({
      total: 4,
      new_jobs: 2,
      matched: 1,
      deadline_soon: 2,
      expired: 1,
    });
  });

  it("returns job detail with raw content and outputs", async () => {
    const { getDb } = await import("@/lib/db");
    const { saveRawJob, saveOutput } = await import("@/lib/file-store");
    const db = getDb();

    db.prepare(`
      INSERT INTO jobs (
        job_id, source, company, position, status, memo
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run("JOB-020", "saramin", "Alpha", "Backend", "passed", "initial memo");

    saveRawJob("JOB-020", "# Raw JD\n- detail");
    const outputPath = saveOutput("JOB-020", "resume", "# Resume");
    db.prepare(`
      INSERT INTO outputs (job_id, type, file_path, language, version)
      VALUES (?, ?, ?, ?, ?)
    `).run("JOB-020", "resume", outputPath, "ko", 1);

    const jobRoute = await import("@/app/api/jobs/[jobId]/route");
    const response = await jobRoute.GET(
      makeRequest("http://localhost/api/jobs/JOB-020", "GET"),
      { params: Promise.resolve({ jobId: "JOB-020" }) }
    );
    const detail = (await response.json()) as {
      job_id: string;
      rawContent: string;
      outputs: Array<{ type: string; file_path: string }>;
    };

    expect(response.status).toBe(200);
    expect(detail.job_id).toBe("JOB-020");
    expect(detail.rawContent).toContain("Raw JD");
    expect(detail.outputs).toHaveLength(1);
    expect(detail.outputs[0]).toMatchObject({
      type: "resume",
      file_path: outputPath,
    });
  });

  it("updates job status and memo", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();

    db.prepare(`
      INSERT INTO jobs (
        job_id, source, company, position, status, memo
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run("JOB-030", "jobkorea", "Beta", "Frontend", "passed", "old memo");

    const jobRoute = await import("@/app/api/jobs/[jobId]/route");
    const response = await jobRoute.PUT(
      makeRequest("http://localhost/api/jobs/JOB-030", "PUT", {
        status: "matched",
        memo: "updated memo",
      }),
      { params: Promise.resolve({ jobId: "JOB-030" }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    const updated = db
      .prepare("SELECT status, memo, updated_at FROM jobs WHERE job_id = ?")
      .get("JOB-030") as { status: string; memo: string; updated_at: string };

    expect(updated.status).toBe("matched");
    expect(updated.memo).toBe("updated memo");
    expect(updated.updated_at).toBeTruthy();
  });

  it("returns 404 when the requested job does not exist", async () => {
    const jobRoute = await import("@/app/api/jobs/[jobId]/route");

    const response = await jobRoute.GET(
      makeRequest("http://localhost/api/jobs/MISSING", "GET"),
      { params: Promise.resolve({ jobId: "MISSING" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("returns 404 when updating a missing job", async () => {
    const jobRoute = await import("@/app/api/jobs/[jobId]/route");

    const response = await jobRoute.PUT(
      makeRequest("http://localhost/api/jobs/MISSING", "PUT", {
        status: "matched",
      }),
      { params: Promise.resolve({ jobId: "MISSING" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});

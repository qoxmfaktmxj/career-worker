import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DB_PATH = path.join(
  __dirname,
  "../../data/test-profile-outputs-routes.db"
);
const TEST_DATA_DIR = path.join(__dirname, "../../data");
const TEST_OUTPUTS_DIR = path.join(__dirname, "../../tmp/profile-outputs/outputs");
const TEST_PROFILE_DIR = path.join(__dirname, "../../tmp/profile-outputs/profile");

function makeRequest(
  url: string,
  method: "GET" | "PUT" | "DELETE",
  body?: Record<string, unknown>
) {
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Profile and outputs API routes", () => {
  beforeEach(() => {
    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    fs.rmSync(path.join(__dirname, "../../tmp/profile-outputs"), {
      recursive: true,
      force: true,
    });

    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.DB_NAME = "test-profile-outputs-routes.db";
    process.env.OUTPUTS_DIR = TEST_OUTPUTS_DIR;
    process.env.PROFILE_DIR = TEST_PROFILE_DIR;
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

    fs.rmSync(path.join(__dirname, "../../tmp/profile-outputs"), {
      recursive: true,
      force: true,
    });
  });

  it("lists profile files and updates profile content safely", async () => {
    const { writeProfileFile } = await import("@/lib/file-store");

    writeProfileFile("profile.yml", "name: Kim");
    writeProfileFile("master_resume.md", "# Resume");

    const profileRoute = await import("@/app/api/profile/route");
    const getResponse = await profileRoute.GET();
    const profile = (await getResponse.json()) as {
      files: string[];
      profile: Record<string, string>;
    };

    expect(getResponse.status).toBe(200);
    expect(profile.files.sort()).toEqual(["master_resume.md", "profile.yml"]);
    expect(profile.profile["profile.yml"]).toBe("name: Kim");

    const putResponse = await profileRoute.PUT(
      makeRequest("http://localhost/api/profile", "PUT", {
        fileName: "career_story.md",
        content: "# Story",
      })
    );

    expect(putResponse.status).toBe(200);
    expect(await putResponse.json()).toEqual({ success: true });

    const invalidResponse = await profileRoute.PUT(
      makeRequest("http://localhost/api/profile", "PUT", {
        fileName: "../secrets.txt",
        content: "blocked",
      })
    );

    expect(invalidResponse.status).toBe(400);

    const unsupportedResponse = await profileRoute.PUT(
      makeRequest("http://localhost/api/profile", "PUT", {
        fileName: "notes.md",
        content: "blocked",
      })
    );

    expect(unsupportedResponse.status).toBe(400);
  });

  it("lists outputs with job and type filters", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();

    db.prepare(`
      INSERT INTO jobs (job_id, source, company, position)
      VALUES (?, ?, ?, ?)
    `).run("JOB-100", "saramin", "Alpha", "Backend");
    db.prepare(`
      INSERT INTO jobs (job_id, source, company, position)
      VALUES (?, ?, ?, ?)
    `).run("JOB-200", "jobkorea", "Beta", "Frontend");
    db.prepare(`
      INSERT INTO outputs (job_id, type, file_path)
      VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)
    `).run(
      "JOB-100",
      "resume",
      "resumes/file-1.md",
      "JOB-100",
      "answer_pack",
      "answer_packs/file-2.md",
      "JOB-200",
      "recruiter_reply",
      "recruiter_replies/file-3.md"
    );

    const outputsRoute = await import("@/app/api/outputs/route");
    const allResponse = await outputsRoute.GET(
      makeRequest("http://localhost/api/outputs", "GET")
    );
    const allOutputs = (await allResponse.json()) as Array<{ job_id: string }>;

    expect(allResponse.status).toBe(200);
    expect(allOutputs).toHaveLength(3);

    const filteredResponse = await outputsRoute.GET(
      makeRequest(
        "http://localhost/api/outputs?job_id=JOB-100&type=answer_pack",
        "GET"
      )
    );
    const filteredOutputs = (await filteredResponse.json()) as Array<{
      job_id: string;
      type: string;
      company: string;
    }>;

    expect(filteredOutputs).toEqual([
      expect.objectContaining({
        job_id: "JOB-100",
        type: "answer_pack",
        company: "Alpha",
      }),
    ]);
  });

  it("returns output detail content and deletes output records", async () => {
    const { getDb } = await import("@/lib/db");
    const { saveOutput } = await import("@/lib/file-store");
    const db = getDb();

    db.prepare(`
      INSERT INTO jobs (job_id, source, company, position)
      VALUES (?, ?, ?, ?)
    `).run("JOB-300", "saramin", "Gamma", "Platform");

    const filePath = saveOutput("JOB-300", "resume", "# Output Body");
    db.prepare(`
      INSERT INTO outputs (id, job_id, type, file_path)
      VALUES (?, ?, ?, ?)
    `).run(7, "JOB-300", "resume", filePath);

    const outputRoute = await import("@/app/api/outputs/[id]/route");
    const detailResponse = await outputRoute.GET(
      makeRequest("http://localhost/api/outputs/7", "GET"),
      { params: Promise.resolve({ id: "7" }) }
    );
    const detail = (await detailResponse.json()) as {
      file_path: string;
      content: string;
    };

    expect(detailResponse.status).toBe(200);
    expect(detail.file_path).toBe(filePath);
    expect(detail.content).toContain("Output Body");

    const deleteResponse = await outputRoute.DELETE(
      makeRequest("http://localhost/api/outputs/7", "DELETE"),
      { params: Promise.resolve({ id: "7" }) }
    );

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ success: true });

    const count = db
      .prepare("SELECT COUNT(*) as count FROM outputs WHERE id = ?")
      .get(7) as { count: number };

    expect(count.count).toBe(0);
  });
});

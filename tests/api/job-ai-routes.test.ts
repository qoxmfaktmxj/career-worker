import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DB_PATH = path.join(__dirname, "../../data/test-job-ai-routes.db");
const TEST_DATA_DIR = path.join(__dirname, "../../data");
const TEST_JOBS_DIR = path.join(__dirname, "../../tmp/job-ai-routes/jobs");
const TEST_OUTPUTS_DIR = path.join(__dirname, "../../tmp/job-ai-routes/outputs");
const TEST_PROFILE_DIR = path.join(__dirname, "../../tmp/job-ai-routes/profile");
const callOpenClawMock = vi.fn();

vi.mock("@/lib/openclaw", async () => {
  const actual = await vi.importActual<typeof import("@/lib/openclaw")>(
    "@/lib/openclaw"
  );

  return {
    ...actual,
    callOpenClaw: (...args: unknown[]) => callOpenClawMock(...args),
  };
});

function makeRequest(
  url: string,
  method: "POST",
  body?: Record<string, unknown>
) {
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function seedJob(jobId: string, extra: Record<string, unknown> = {}) {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const baseJob: Record<string, unknown> = {
    source: "saramin",
    company: "Alpha",
    position: "Backend Engineer",
    status: "matched",
    fit_status: "matched",
    workflow_status: "detail_pending",
    application_status: "not_started",
    detail_status: "missing",
    detail_file: null,
    recommended_stories: JSON.stringify(["S001"]),
    questions_detected: JSON.stringify(["Why this role?"]),
    fit_score: 4.2,
    fit_reason: "Role and experience align well.",
    risks: JSON.stringify(["Domain ramp-up needed"]),
    ...extra,
  };

  if (
    baseJob.workflow_status === "detail_pending" &&
    baseJob.detail_status === "ready"
  ) {
    baseJob.workflow_status = "detail_ready";
  }

  db.prepare(`
    INSERT INTO jobs (
      job_id,
      source,
      company,
      position,
      status,
      fit_status,
      workflow_status,
      application_status,
      detail_status,
      detail_file,
      recommended_stories,
      questions_detected,
      fit_score,
      fit_reason,
      risks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jobId,
    baseJob.source,
    baseJob.company,
    baseJob.position,
    baseJob.status,
    baseJob.fit_status,
    baseJob.workflow_status,
    baseJob.application_status,
    baseJob.detail_status,
    baseJob.detail_file,
    baseJob.recommended_stories,
    baseJob.questions_detected,
    baseJob.fit_score,
    baseJob.fit_reason,
    baseJob.risks
  );

  return db;
}

async function seedProfileFiles() {
  const { writeProfileFile } = await import("@/lib/profile-store");

  writeProfileFile("profile.yml", "name: Kim\nrole: backend engineer");
  writeProfileFile("master_resume.md", "# Resume\n- Java");
  writeProfileFile("career_story.md", "# Career Story\n- modernization");
  writeProfileFile("story_bank.md", "# Story Bank\n- S001");
  writeProfileFile("answer_bank.md", "# Answer Bank\n- growth");
}

describe("Job AI action routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    fs.rmSync(path.join(__dirname, "../../tmp/job-ai-routes"), {
      recursive: true,
      force: true,
    });

    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.DB_NAME = "test-job-ai-routes.db";
    process.env.JOBS_DIR = TEST_JOBS_DIR;
    process.env.OUTPUTS_DIR = TEST_OUTPUTS_DIR;
    process.env.PROFILE_DIR = TEST_PROFILE_DIR;
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import("@/lib/db");
      closeDb();
    } catch {
      // Ignore cleanup failures while temp files are being created.
    }

    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    fs.rmSync(path.join(__dirname, "../../tmp/job-ai-routes"), {
      recursive: true,
      force: true,
    });
  });

  it("evaluates a job and updates fit fields when detail JD exists", async () => {
    const { saveDetailJob } = await import("@/lib/file-store");

    await seedJob("JOB-EVAL-1", {
      status: "passed",
      detail_status: "ready",
      detail_file: "details/JOB-EVAL-1.md",
    });
    await seedProfileFiles();
    saveDetailJob("JOB-EVAL-1", "# JD\n- Java backend");

    callOpenClawMock.mockResolvedValue({
      success: true,
      data: {
        fit_score: 4.6,
        fit_reason: "Role and experience align strongly.",
        risks: ["Domain ramp-up needed"],
        recommended_stories: ["S001", "S003"],
        questions_detected: ["Please introduce yourself."],
      },
    });

    const evaluateRoute = await import("@/app/api/jobs/[jobId]/evaluate/route");
    const response = await evaluateRoute.POST(
      makeRequest("http://localhost/api/jobs/JOB-EVAL-1/evaluate", "POST"),
      { params: Promise.resolve({ jobId: "JOB-EVAL-1" }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        fit_score: 4.6,
        fit_reason: "Role and experience align strongly.",
        risks: ["Domain ramp-up needed"],
        recommended_stories: ["S001", "S003"],
        questions_detected: ["Please introduce yourself."],
      },
    });

    const { getDb } = await import("@/lib/db");
    const updated = getDb()
      .prepare(
        "SELECT status, fit_status, fit_score, fit_reason, risks, recommended_stories, questions_detected FROM jobs WHERE job_id = ?"
      )
      .get("JOB-EVAL-1") as Record<string, unknown>;

    expect(updated).toEqual({
      status: "matched",
      fit_status: "matched",
      fit_score: 4.6,
      fit_reason: "Role and experience align strongly.",
      risks: JSON.stringify(["Domain ramp-up needed"]),
      recommended_stories: JSON.stringify(["S001", "S003"]),
      questions_detected: JSON.stringify(["Please introduce yourself."]),
    });
  });

  it("rejects evaluation when detail JD is not ready", async () => {
    await seedJob("JOB-EVAL-MISSING", {
      status: "passed",
      detail_status: "missing",
      detail_file: null,
    });
    await seedProfileFiles();

    const evaluateRoute = await import("@/app/api/jobs/[jobId]/evaluate/route");
    const response = await evaluateRoute.POST(
      makeRequest("http://localhost/api/jobs/JOB-EVAL-MISSING/evaluate", "POST"),
      { params: Promise.resolve({ jobId: "JOB-EVAL-MISSING" }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "job_detail_not_ready",
      message:
        "\uACF5\uACE0 \uC0C1\uC138 \uBCF8\uBB38\uC774 \uC5C6\uC5B4 AI \uC791\uC5C5\uC744 \uC2E4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
    });
    expect(callOpenClawMock).not.toHaveBeenCalled();
  });

  it("returns 503 when OpenClaw is unavailable", async () => {
    const { saveDetailJob } = await import("@/lib/file-store");

    await seedJob("JOB-EVAL-NO-OPENCLAW", {
      detail_status: "ready",
      detail_file: "details/JOB-EVAL-NO-OPENCLAW.md",
    });
    await seedProfileFiles();
    saveDetailJob("JOB-EVAL-NO-OPENCLAW", "# JD\n- detail ready");

    callOpenClawMock.mockResolvedValue({
      success: false,
      data: {},
      code: "openclaw_unavailable",
      error:
        "OpenClaw CLI\uAC00 \uC124\uCE58\uB418\uC9C0 \uC54A\uC544 AI \uC791\uC5C5\uC744 \uC2E4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
    });

    const evaluateRoute = await import("@/app/api/jobs/[jobId]/evaluate/route");
    const response = await evaluateRoute.POST(
      makeRequest(
        "http://localhost/api/jobs/JOB-EVAL-NO-OPENCLAW/evaluate",
        "POST"
      ),
      { params: Promise.resolve({ jobId: "JOB-EVAL-NO-OPENCLAW" }) }
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "openclaw_unavailable",
      message:
        "OpenClaw CLI\uAC00 \uC124\uCE58\uB418\uC9C0 \uC54A\uC544 AI \uC791\uC5C5\uC744 \uC2E4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
    });
  });

  it("generates an answer pack, saves output, and marks draft_ready", async () => {
    const { saveDetailJob, readOutput } = await import("@/lib/file-store");

    await seedJob("JOB-ANS-1", {
      questions_detected: JSON.stringify([
        "Why this role?",
        "Describe your best project result.",
      ]),
      detail_status: "ready",
      detail_file: "details/JOB-ANS-1.md",
    });
    await seedProfileFiles();
    saveDetailJob("JOB-ANS-1", "# JD\n- multi-question");

    callOpenClawMock.mockResolvedValue({
      success: true,
      data: {
        answers: [
          {
            question: "Why this role?",
            versions: {
              300: "300-char answer",
              500: "500-char answer",
            },
            used_stories: ["S001"],
          },
        ],
      },
    });

    const answersRoute = await import(
      "@/app/api/jobs/[jobId]/generate-answers/route"
    );
    const response = await answersRoute.POST(
      makeRequest("http://localhost/api/jobs/JOB-ANS-1/generate-answers", "POST"),
      { params: Promise.resolve({ jobId: "JOB-ANS-1" }) }
    );
    const body = (await response.json()) as {
      success: boolean;
      file_path: string;
      data: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.file_path).toContain("answer_packs");
    expect(readOutput(body.file_path)).toContain("Why this role?");
    const prompt = callOpenClawMock.mock.calls[0]?.[0] as string;

    expect(prompt).toContain("Why this role?");
    expect(prompt).toContain("Describe your best project result.");

    const { getDb } = await import("@/lib/db");
    const output = getDb()
      .prepare("SELECT type, file_path FROM outputs WHERE job_id = ?")
      .get("JOB-ANS-1") as { type: string; file_path: string };
    const job = getDb()
      .prepare("SELECT status, workflow_status FROM jobs WHERE job_id = ?")
      .get("JOB-ANS-1") as { status: string; workflow_status: string };

    expect(output).toEqual({ type: "answer_pack", file_path: body.file_path });
    expect(job.status).toBe("draft_ready");
    expect(job.workflow_status).toBe("draft_ready");
  });

  it("rejects answer generation when detected questions are missing", async () => {
    const { saveDetailJob } = await import("@/lib/file-store");

    await seedJob("JOB-ANS-MISSING", {
      questions_detected: null,
      recommended_stories: JSON.stringify(["S001"]),
      detail_status: "ready",
      detail_file: "details/JOB-ANS-MISSING.md",
    });
    await seedProfileFiles();
    saveDetailJob("JOB-ANS-MISSING", "# JD\n- no detected questions");

    const answersRoute = await import(
      "@/app/api/jobs/[jobId]/generate-answers/route"
    );
    const response = await answersRoute.POST(
      makeRequest(
        "http://localhost/api/jobs/JOB-ANS-MISSING/generate-answers",
        "POST"
      ),
      { params: Promise.resolve({ jobId: "JOB-ANS-MISSING" }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "questions_not_ready",
      message:
        "\uAC10\uC9C0\uB41C \uC9C8\uBB38\uC774 \uC5C6\uC5B4 \uC790\uC18C\uC11C \uC0DD\uC131\uC744 \uC9C4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
    });
    expect(callOpenClawMock).not.toHaveBeenCalled();
  });

  it("generates a tailored resume and stores the markdown output", async () => {
    const { saveDetailJob, readOutput } = await import("@/lib/file-store");

    await seedJob("JOB-RESUME-1", {
      detail_status: "ready",
      detail_file: "details/JOB-RESUME-1.md",
    });
    await seedProfileFiles();
    saveDetailJob("JOB-RESUME-1", "# JD\n- resume target");

    callOpenClawMock.mockResolvedValue({
      success: true,
      data: {
        resume_md: "# Tailored Resume\n- impact",
        highlights: ["highlight 1"],
        adjusted_sections: ["experience"],
      },
    });

    const resumeRoute = await import(
      "@/app/api/jobs/[jobId]/generate-resume/route"
    );
    const response = await resumeRoute.POST(
      makeRequest("http://localhost/api/jobs/JOB-RESUME-1/generate-resume", "POST"),
      { params: Promise.resolve({ jobId: "JOB-RESUME-1" }) }
    );
    const body = (await response.json()) as {
      success: boolean;
      file_path: string;
    };

    expect(response.status).toBe(200);
    expect(body.file_path).toContain("resumes");
    expect(readOutput(body.file_path)).toContain("Tailored Resume");

    const { getDb } = await import("@/lib/db");
    const output = getDb()
      .prepare("SELECT type FROM outputs WHERE job_id = ?")
      .get("JOB-RESUME-1") as { type: string };
    const job = getDb()
      .prepare("SELECT status, workflow_status FROM jobs WHERE job_id = ?")
      .get("JOB-RESUME-1") as { status: string; workflow_status: string };

    expect(output.type).toBe("resume");
    expect(job.status).toBe("draft_ready");
    expect(job.workflow_status).toBe("draft_ready");
  });

  it("increments resume output version on repeated generation", async () => {
    const { saveDetailJob } = await import("@/lib/file-store");

    await seedJob("JOB-RESUME-2", {
      detail_status: "ready",
      detail_file: "details/JOB-RESUME-2.md",
    });
    await seedProfileFiles();
    saveDetailJob("JOB-RESUME-2", "# JD\n- repeated resume target");

    callOpenClawMock.mockResolvedValue({
      success: true,
      data: {
        resume_md: "# Tailored Resume\n- impact",
      },
    });

    const resumeRoute = await import(
      "@/app/api/jobs/[jobId]/generate-resume/route"
    );

    await resumeRoute.POST(
      makeRequest("http://localhost/api/jobs/JOB-RESUME-2/generate-resume", "POST"),
      { params: Promise.resolve({ jobId: "JOB-RESUME-2" }) }
    );
    await resumeRoute.POST(
      makeRequest("http://localhost/api/jobs/JOB-RESUME-2/generate-resume", "POST"),
      { params: Promise.resolve({ jobId: "JOB-RESUME-2" }) }
    );

    const { getDb } = await import("@/lib/db");
    const outputs = getDb()
      .prepare(
        "SELECT version, file_path FROM outputs WHERE job_id = ? AND type = ? ORDER BY version ASC"
      )
      .all("JOB-RESUME-2", "resume") as Array<{
      version: number;
      file_path: string;
    }>;

    expect(outputs).toHaveLength(2);
    expect(outputs.map((output) => output.version)).toEqual([1, 2]);
    expect(outputs[0]?.file_path).not.toBe(outputs[1]?.file_path);
    expect(outputs[0]?.file_path).toContain("_resume_v1_");
    expect(outputs[1]?.file_path).toContain("_resume_v2_");
  });

  it("generates a recruiter reply from request body context", async () => {
    const { readOutput, saveDetailJob } = await import("@/lib/file-store");

    await seedJob("JOB-REPLY-1", {
      detail_status: "ready",
      detail_file: "details/JOB-REPLY-1.md",
    });
    await seedProfileFiles();
    saveDetailJob("JOB-REPLY-1", "# JD\n- recruiter context");

    callOpenClawMock.mockResolvedValue({
      success: true,
      data: {
        reply_ko: "Thanks for reaching out.",
        reply_en: "Thank you for reaching out.",
        tone: "professional",
        key_points: ["backend", "platform"],
      },
    });

    const replyRoute = await import(
      "@/app/api/jobs/[jobId]/generate-reply/route"
    );
    const response = await replyRoute.POST(
      makeRequest("http://localhost/api/jobs/JOB-REPLY-1/generate-reply", "POST", {
        message: "Would you be open to a backend platform role?",
        channel: "linkedin",
      }),
      { params: Promise.resolve({ jobId: "JOB-REPLY-1" }) }
    );
    const body = (await response.json()) as {
      success: boolean;
      file_path: string;
    };

    expect(response.status).toBe(200);
    expect(body.file_path).toContain("recruiter_replies");
    expect(readOutput(body.file_path)).toContain("Thanks for reaching out.");

    const { getDb } = await import("@/lib/db");
    const output = getDb()
      .prepare("SELECT type FROM outputs WHERE job_id = ?")
      .get("JOB-REPLY-1") as { type: string };

    expect(output.type).toBe("recruiter_reply");
  });

  it("returns 404 when evaluating a missing job", async () => {
    const evaluateRoute = await import("@/app/api/jobs/[jobId]/evaluate/route");
    const response = await evaluateRoute.POST(
      makeRequest("http://localhost/api/jobs/MISSING/evaluate", "POST"),
      { params: Promise.resolve({ jobId: "MISSING" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});

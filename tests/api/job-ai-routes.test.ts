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
      // ignore cleanup failures while files are being created
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

  async function seedJob(jobId: string, extra: Record<string, unknown> = {}) {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    const baseJob = {
      source: "saramin",
      company: "Alpha",
      position: "Backend Engineer",
      status: "matched",
      recommended_stories: JSON.stringify(["S001"]),
      questions_detected: JSON.stringify(["지원 동기를 말씀해 주세요."]),
      fit_score: 4.2,
      fit_reason: "좋은 적합도",
      risks: JSON.stringify(["리스크 1"]),
      ...extra,
    };

    db.prepare(`
      INSERT INTO jobs (
        job_id, source, company, position, status,
        recommended_stories, questions_detected, fit_score, fit_reason, risks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId,
      baseJob.source,
      baseJob.company,
      baseJob.position,
      baseJob.status,
      baseJob.recommended_stories,
      baseJob.questions_detected,
      baseJob.fit_score,
      baseJob.fit_reason,
      baseJob.risks
    );

    return db;
  }

  async function seedProfileFiles() {
    const { writeProfileFile } = await import("@/lib/file-store");

    writeProfileFile("profile.yml", "name: Kim\nrole: backend engineer");
    writeProfileFile("master_resume.md", "# Resume\n- Java");
    writeProfileFile("career_story.md", "# Career Story\n- modernization");
    writeProfileFile("story_bank.md", "# Story Bank\n- S001");
    writeProfileFile("answer_bank.md", "# Answer Bank\n- growth");
  }

  it("evaluates a job and updates fit fields", async () => {
    const { saveRawJob } = await import("@/lib/file-store");

    await seedJob("JOB-EVAL-1", { status: "passed" });
    await seedProfileFiles();
    saveRawJob("JOB-EVAL-1", "# JD\n- Java backend");

    callOpenClawMock.mockResolvedValue({
      success: true,
      data: {
        fit_score: 4.6,
        fit_reason: "요구 역량과 경력이 잘 맞습니다.",
        risks: ["도메인 적응 필요"],
        recommended_stories: ["S001", "S003"],
        questions_detected: ["1분 자기소개를 해주세요."],
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
        fit_reason: "요구 역량과 경력이 잘 맞습니다.",
        risks: ["도메인 적응 필요"],
        recommended_stories: ["S001", "S003"],
        questions_detected: ["1분 자기소개를 해주세요."],
      },
    });

    const { getDb } = await import("@/lib/db");
    const updated = getDb()
      .prepare(
        "SELECT status, fit_score, fit_reason, risks, recommended_stories, questions_detected FROM jobs WHERE job_id = ?"
      )
      .get("JOB-EVAL-1") as Record<string, unknown>;

    expect(updated).toEqual({
      status: "matched",
      fit_score: 4.6,
      fit_reason: "요구 역량과 경력이 잘 맞습니다.",
      risks: JSON.stringify(["도메인 적응 필요"]),
      recommended_stories: JSON.stringify(["S001", "S003"]),
      questions_detected: JSON.stringify(["1분 자기소개를 해주세요."]),
    });
  });

  it("generates an answer pack, saves output, and marks draft_ready", async () => {
    const { saveRawJob, readOutput } = await import("@/lib/file-store");

    await seedJob("JOB-ANS-1", {
      questions_detected: JSON.stringify([
        "지원 동기를 말씀해 주세요.",
        "가장 큰 성과를 설명해 주세요.",
      ]),
    });
    await seedProfileFiles();
    saveRawJob("JOB-ANS-1", "# JD\n- 문항 포함");

    callOpenClawMock.mockResolvedValue({
      success: true,
      data: {
        answers: [
          {
            question: "지원 동기",
            versions: {
              300: "300자 답변",
              500: "500자 답변",
              800: "800자 답변",
              1200: "1200자 답변",
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
    expect(readOutput(body.file_path)).toContain("지원 동기");
    const prompt = callOpenClawMock.mock.calls[0]?.[0] as string;

    expect(prompt).toContain("지원 동기를 말씀해 주세요.");
    expect(prompt).toContain("가장 큰 성과를 설명해 주세요.");
    expect(prompt).not.toMatch(
      /## 감지된 문항 또는 작성할 주제\s+\["S001"\]/
    );

    const { getDb } = await import("@/lib/db");
    const output = getDb()
      .prepare("SELECT type, file_path FROM outputs WHERE job_id = ?")
      .get("JOB-ANS-1") as { type: string; file_path: string };
    const job = getDb()
      .prepare("SELECT status FROM jobs WHERE job_id = ?")
      .get("JOB-ANS-1") as { status: string };

    expect(output).toEqual({ type: "answer_pack", file_path: body.file_path });
    expect(job.status).toBe("draft_ready");
  });

  it("rejects answer generation when detected questions are missing", async () => {
    const { saveRawJob } = await import("@/lib/file-store");

    await seedJob("JOB-ANS-MISSING", {
      questions_detected: null,
      recommended_stories: JSON.stringify(["S001"]),
    });
    await seedProfileFiles();
    saveRawJob("JOB-ANS-MISSING", "# JD\n- no detected questions");

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
      error: "Detected questions are required before generating answers",
    });
    expect(callOpenClawMock).not.toHaveBeenCalled();
  });

  it("generates a tailored resume and stores the markdown output", async () => {
    const { saveRawJob, readOutput } = await import("@/lib/file-store");

    await seedJob("JOB-RESUME-1");
    await seedProfileFiles();
    saveRawJob("JOB-RESUME-1", "# JD\n- resume target");

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
      .prepare("SELECT status FROM jobs WHERE job_id = ?")
      .get("JOB-RESUME-1") as { status: string };

    expect(output.type).toBe("resume");
    expect(job.status).toBe("draft_ready");
  });

  it("generates a recruiter reply from request body context", async () => {
    const { readOutput } = await import("@/lib/file-store");

    await seedJob("JOB-REPLY-1");
    await seedProfileFiles();

    callOpenClawMock.mockResolvedValue({
      success: true,
      data: {
        reply_ko: "안녕하세요. 관심 주셔서 감사합니다.",
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
        message: "백엔드 포지션에 관심 있으신가요?",
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
    expect(readOutput(body.file_path)).toContain("관심 주셔서 감사합니다");

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

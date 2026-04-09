import { NextRequest, NextResponse } from "next/server";

import {
  JOB_DETAIL_NOT_READY_MESSAGE,
  JobDetailNotReadyError,
  requireJobDetailContent,
} from "@/lib/job-content";
import {
  buildPrompt,
  callOpenClaw,
  getOpenClawFailure,
  loadPromptTemplate,
} from "@/lib/openclaw";

const QUESTIONS_NOT_READY_MESSAGE =
  "\uAC10\uC9C0\uB41C \uC9C8\uBB38\uC774 \uC5C6\uC5B4 \uC790\uC18C\uC11C \uC0DD\uC131\uC744 \uC9C4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";
const INTERNAL_ERROR_MESSAGE =
  "\uC694\uCCAD \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";

function parseQuestions(value: unknown): string[] {
  if (typeof value !== "string" || !value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const job = db
    .prepare("SELECT * FROM jobs WHERE job_id = ?")
    .get(jobId) as Record<string, unknown> | undefined;

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const [{ saveOutput }, { readProfileFile }, { getJobContent }] =
      await Promise.all([
        import("@/lib/output-store"),
        import("@/lib/profile-store"),
        import("@/lib/job-content"),
      ]);
    const detailJd = requireJobDetailContent(job);
    const { listingContent } = getJobContent(job);
    const profile = readProfileFile("profile.yml");
    const careerStory = readProfileFile("career_story.md");
    const storyBank = readProfileFile("story_bank.md");
    const answerBank = readProfileFile("answer_bank.md");
    const detectedQuestions = parseQuestions(job.questions_detected);

    if (detectedQuestions.length === 0) {
      return NextResponse.json(
        {
          error: "questions_not_ready",
          message: QUESTIONS_NOT_READY_MESSAGE,
        },
        { status: 400 }
      );
    }

    const template = loadPromptTemplate("generate-answer-pack");
    const prompt = buildPrompt(template, {
      profile,
      career_story: careerStory,
      stories: storyBank,
      answer_bank: answerBank,
      jd: detailJd,
      listing_snapshot: listingContent || "",
      questions: detectedQuestions.join("\n"),
    });
    const response = await callOpenClaw(prompt);

    if (!response.success) {
      const failure = getOpenClawFailure(response);
      return NextResponse.json(failure.body, { status: failure.status });
    }

    const answers = Array.isArray(response.data.answers)
      ? (response.data.answers as Array<Record<string, unknown>>)
      : [];
    let markdown =
      `# \uC790\uC18C\uC11C \uB2F5\uBCC0\uD329 - ${job.company} ${job.position}\n\n`;

    for (const answer of answers) {
      markdown += `## ${String(answer.question ?? "\uC9C8\uBB38")}\n\n`;

      const versions =
        answer.versions && typeof answer.versions === "object"
          ? (answer.versions as Record<string, string>)
          : {};

      for (const [length, text] of Object.entries(versions)) {
        markdown += `### ${length}\uC790\n${text}\n\n`;
      }
    }

    const filePath = saveOutput(jobId, "answer_pack", markdown, "ko");

    db.prepare("INSERT INTO outputs (job_id, type, file_path) VALUES (?, ?, ?)")
      .run(jobId, "answer_pack", filePath);
    db.prepare(
      "UPDATE jobs SET status = 'draft_ready', updated_at = datetime('now') WHERE job_id = ?"
    ).run(jobId);

    return NextResponse.json({
      success: true,
      file_path: filePath,
      data: response.data,
    });
  } catch (error) {
    if (error instanceof JobDetailNotReadyError) {
      return NextResponse.json(
        {
          error: "job_detail_not_ready",
          message: JOB_DETAIL_NOT_READY_MESSAGE,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "internal_error",
        message: (error as Error).message || INTERNAL_ERROR_MESSAGE,
      },
      { status: 500 }
    );
  }
}

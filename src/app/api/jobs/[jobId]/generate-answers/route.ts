import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { readProfileFile, readRawJob, saveOutput } from "@/lib/file-store";
import { buildPrompt, callOpenClaw, loadPromptTemplate } from "@/lib/openclaw";

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
  const db = getDb();
  const job = db
    .prepare("SELECT * FROM jobs WHERE job_id = ?")
    .get(jobId) as Record<string, unknown> | undefined;

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const rawJd = readRawJob(jobId);
    const profile = readProfileFile("profile.yml");
    const careerStory = readProfileFile("career_story.md");
    const storyBank = readProfileFile("story_bank.md");
    const answerBank = readProfileFile("answer_bank.md");
    const detectedQuestions = parseQuestions(job.questions_detected);

    if (detectedQuestions.length === 0) {
      return NextResponse.json(
        { error: "Detected questions are required before generating answers" },
        { status: 400 }
      );
    }

    const template = loadPromptTemplate("generate-answer-pack");
    const prompt = buildPrompt(template, {
      profile,
      career_story: careerStory,
      stories: storyBank,
      answer_bank: answerBank,
      jd: rawJd,
      questions: detectedQuestions.join("\n"),
    });
    const response = await callOpenClaw(prompt);

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || "AI 응답 실패",
          raw: response.raw,
        },
        { status: 500 }
      );
    }

    const answers = Array.isArray(response.data.answers)
      ? (response.data.answers as Array<Record<string, unknown>>)
      : [];
    let markdown = `# 자소서 답변 - ${job.company} ${job.position}\n\n`;

    for (const answer of answers) {
      markdown += `## ${String(answer.question ?? "질문")}\n\n`;

      const versions =
        answer.versions && typeof answer.versions === "object"
          ? (answer.versions as Record<string, string>)
          : {};

      for (const [length, text] of Object.entries(versions)) {
        markdown += `### ${length}자\n${text}\n\n`;
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
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

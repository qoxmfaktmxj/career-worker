import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { readProfileFile, readRawJob, saveOutput } from "@/lib/file-store";
import { buildPrompt, callOpenClaw, loadPromptTemplate } from "@/lib/openclaw";

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
    const resume = readProfileFile("master_resume.md");
    const rawJd = readRawJob(jobId);
    const evaluation = JSON.stringify(
      {
        fit_score: job.fit_score,
        fit_reason: job.fit_reason,
        risks:
          typeof job.risks === "string" && job.risks
            ? JSON.parse(job.risks)
            : [],
        recommended_stories:
          typeof job.recommended_stories === "string" && job.recommended_stories
            ? JSON.parse(job.recommended_stories)
            : [],
      },
      null,
      2
    );
    const template = loadPromptTemplate("generate-resume");
    const prompt = buildPrompt(template, { resume, jd: rawJd, evaluation });
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

    const resumeMarkdown =
      typeof response.data.resume_md === "string"
        ? response.data.resume_md
        : "# Resume\n";
    const filePath = saveOutput(jobId, "resume", resumeMarkdown, "ko");

    db.prepare("INSERT INTO outputs (job_id, type, file_path) VALUES (?, ?, ?)")
      .run(jobId, "resume", filePath);
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

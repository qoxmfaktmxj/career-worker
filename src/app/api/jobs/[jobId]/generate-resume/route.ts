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

const INTERNAL_ERROR_MESSAGE =
  "\uC694\uCCAD \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";

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
    const resume = readProfileFile("master_resume.md");
    const detailJd = requireJobDetailContent(job);
    const { listingContent } = getJobContent(job);
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
    const prompt = buildPrompt(template, {
      resume,
      jd: detailJd,
      listing_snapshot: listingContent || "",
      evaluation,
    });
    const response = await callOpenClaw(prompt);

    if (!response.success) {
      const failure = getOpenClawFailure(response);
      return NextResponse.json(failure.body, { status: failure.status });
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

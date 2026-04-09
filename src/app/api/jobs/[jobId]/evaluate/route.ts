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
    const [{ readProfileFile }, { getJobContent }] = await Promise.all([
      import("@/lib/profile-store"),
      import("@/lib/job-content"),
    ]);
    const detailJd = requireJobDetailContent(job);
    const { listingContent } = getJobContent(job);
    const profile = readProfileFile("profile.yml");
    const skills = readProfileFile("master_resume.md");
    const template = loadPromptTemplate("evaluate-fit");
    const prompt = buildPrompt(template, {
      profile,
      skills,
      jd: detailJd,
      listing_snapshot: listingContent || "",
    });
    const response = await callOpenClaw(prompt);

    if (!response.success) {
      const failure = getOpenClawFailure(response);
      return NextResponse.json(failure.body, { status: failure.status });
    }

    const data = response.data;
    const fitScore =
      typeof data.fit_score === "number"
        ? data.fit_score
        : Number.parseFloat(String(data.fit_score ?? 0));

    db.prepare(`
      UPDATE jobs SET
        status = CASE WHEN ? >= 3.5 THEN 'matched' ELSE 'low_fit' END,
        fit_status = CASE WHEN ? >= 3.5 THEN 'matched' ELSE 'low_fit' END,
        fit_score = ?,
        fit_reason = ?,
        risks = ?,
        recommended_stories = ?,
        questions_detected = ?,
        updated_at = datetime('now')
      WHERE job_id = ?
    `).run(
      fitScore,
      fitScore,
      fitScore,
      typeof data.fit_reason === "string" ? data.fit_reason : null,
      JSON.stringify(Array.isArray(data.risks) ? data.risks : []),
      JSON.stringify(
        Array.isArray(data.recommended_stories) ? data.recommended_stories : []
      ),
      JSON.stringify(
        Array.isArray(data.questions_detected) ? data.questions_detected : []
      ),
      jobId
    );

    return NextResponse.json({ success: true, data });
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

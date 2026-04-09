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

const INVALID_REQUEST_MESSAGE =
  "\uBA54\uC2DC\uC9C0\uC640 \uCC44\uB110\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694.";
const INTERNAL_ERROR_MESSAGE =
  "\uC694\uCCAD \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const body = (await request.json()) as { message?: string; channel?: string };
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const job = db
    .prepare("SELECT * FROM jobs WHERE job_id = ?")
    .get(jobId) as Record<string, unknown> | undefined;

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!body.message || !body.channel) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: INVALID_REQUEST_MESSAGE,
      },
      { status: 400 }
    );
  }

  try {
    const [{ createOutputRecord }, { readProfileFile }, { getJobContent }] =
      await Promise.all([
        import("@/lib/output-store"),
        import("@/lib/profile-store"),
        import("@/lib/job-content"),
      ]);
    const profile = readProfileFile("profile.yml");
    const detailJd = requireJobDetailContent(job);
    const { listingContent } = getJobContent(job);
    const template = loadPromptTemplate("recruiter-reply");
    const prompt = buildPrompt(template, {
      profile,
      jd: detailJd,
      listing_snapshot: listingContent || "",
      message: body.message,
      channel: body.channel,
    });
    const response = await callOpenClaw(prompt);

    if (!response.success) {
      const failure = getOpenClawFailure(response);
      return NextResponse.json(failure.body, { status: failure.status });
    }

    const markdown = [
      `# \uB9AC\uD06C\uB8E8\uD130 \uB2F5\uC7A5 - ${job.company} ${job.position}`,
      "",
      "## \uAD6D\uBB38 \uCD08\uC548",
      String(response.data.reply_ko ?? ""),
      "",
      "## English",
      String(response.data.reply_en ?? ""),
      "",
      `- tone: ${String(response.data.tone ?? "professional")}`,
    ].join("\n");
    const output = createOutputRecord({
      jobId,
      type: "recruiter_reply",
      content: markdown,
      language: "ko",
      onPersist(database) {
        database
          .prepare(
            "UPDATE jobs SET status = 'draft_ready', workflow_status = 'draft_ready', updated_at = datetime('now') WHERE job_id = ?"
          )
          .run(jobId);
      },
    });

    return NextResponse.json({
      success: true,
      file_path: output.file_path,
      version: output.version,
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

import { NextRequest, NextResponse } from "next/server";
import { buildPrompt, callOpenClaw, loadPromptTemplate } from "@/lib/openclaw";

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
      { error: "message, channel required" },
      { status: 400 }
    );
  }

  try {
    const [{ saveOutput }, { readProfileFile }] = await Promise.all([
      import("@/lib/output-store"),
      import("@/lib/profile-store"),
    ]);
    const profile = readProfileFile("profile.yml");
    const template = loadPromptTemplate("recruiter-reply");
    const prompt = buildPrompt(template, {
      profile,
      message: body.message,
      channel: body.channel,
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

    const markdown = [
      `# 리크루터 답장 - ${job.company} ${job.position}`,
      "",
      "## 한국어",
      String(response.data.reply_ko ?? ""),
      "",
      "## English",
      String(response.data.reply_en ?? ""),
      "",
      `- tone: ${String(response.data.tone ?? "professional")}`,
    ].join("\n");
    const filePath = saveOutput(jobId, "recruiter_reply", markdown, "ko");

    db.prepare("INSERT INTO outputs (job_id, type, file_path) VALUES (?, ?, ?)")
      .run(jobId, "recruiter_reply", filePath);
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

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { readProfileFile, readRawJob } from "@/lib/file-store";
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
    const rawJd = readRawJob(jobId);
    const profile = readProfileFile("profile.yml");
    const skills = readProfileFile("master_resume.md");
    const template = loadPromptTemplate("evaluate-fit");
    const prompt = buildPrompt(template, { profile, skills, jd: rawJd });
    const response = await callOpenClaw(prompt);

    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || "AI 응답 파싱 실패",
          raw: response.raw,
        },
        { status: 500 }
      );
    }

    const data = response.data;
    const fitScore =
      typeof data.fit_score === "number"
        ? data.fit_score
        : Number.parseFloat(String(data.fit_score ?? 0));

    db.prepare(`
      UPDATE jobs SET
        status = CASE WHEN ? >= 3.5 THEN 'matched' ELSE 'low_fit' END,
        fit_score = ?,
        fit_reason = ?,
        risks = ?,
        recommended_stories = ?,
        updated_at = datetime('now')
      WHERE job_id = ?
    `).run(
      fitScore,
      fitScore,
      typeof data.fit_reason === "string" ? data.fit_reason : null,
      JSON.stringify(Array.isArray(data.risks) ? data.risks : []),
      JSON.stringify(
        Array.isArray(data.recommended_stories) ? data.recommended_stories : []
      ),
      jobId
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

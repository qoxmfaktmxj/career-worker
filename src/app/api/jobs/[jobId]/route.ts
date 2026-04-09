import { NextRequest, NextResponse } from "next/server";

import { getJobContent } from "@/lib/job-content";
import { isOpenClawAvailable } from "@/lib/openclaw";

export async function GET(
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

  const { listingContent, detailContent, detailStatus } = getJobContent(job);
  const outputs = db
    .prepare("SELECT * FROM outputs WHERE job_id = ? ORDER BY created_at DESC")
    .all(jobId);

  return NextResponse.json({
    ...job,
    listingContent: listingContent || "",
    detailContent: detailContent || "",
    detail_status: detailStatus,
    openclaw_ready: isOpenClawAvailable(),
    rawContent: detailContent || listingContent || "",
    outputs,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const body = (await request.json()) as { status?: string; memo?: string };
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (body.status !== undefined) {
    sets.push("status = ?");
    values.push(body.status);
  }

  if (body.memo !== undefined) {
    sets.push("memo = ?");
    values.push(body.memo);
  }

  values.push(jobId);
  const result = db
    .prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE job_id = ?`)
    .run(...values);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const job = db.prepare("SELECT * FROM jobs WHERE job_id = ?").get(jobId);

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let rawContent = "";

  try {
    const { readRawJob } = await import("@/lib/job-file-store");
    rawContent = readRawJob(jobId);
  } catch {
    // The raw markdown file may not exist for manually inserted test data.
  }
  const { checkOpenClawAvailable } = await import("@/lib/openclaw");
  const aiReady = await checkOpenClawAvailable();

  const outputs = db
    .prepare("SELECT * FROM outputs WHERE job_id = ? ORDER BY created_at DESC")
    .all(jobId);

  return NextResponse.json({ ...(job as object), rawContent, outputs, aiReady });
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

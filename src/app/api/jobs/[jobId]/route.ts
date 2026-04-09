import { NextRequest, NextResponse } from "next/server";

import { getJobContent } from "@/lib/job-content";
import { applyResolvedStatuses, resolveStatusUpdate } from "@/lib/job-status";
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
  const resolvedJob = applyResolvedStatuses(job);

  return NextResponse.json({
    ...resolvedJob,
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
  const body = (await request.json()) as {
    status?: string;
    fit_status?: string;
    workflow_status?: string;
    application_status?: string;
    memo?: string;
  };
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const existingJob = db
    .prepare("SELECT * FROM jobs WHERE job_id = ?")
    .get(jobId) as Record<string, unknown> | undefined;

  if (!existingJob) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];
  const resolvedStatuses = resolveStatusUpdate(existingJob, {
    status: body.status,
    fit_status: body.fit_status,
    workflow_status: body.workflow_status,
    application_status: body.application_status,
  });

  if (
    (body.status !== undefined ||
      body.fit_status !== undefined ||
      body.workflow_status !== undefined ||
      body.application_status !== undefined) &&
    !resolvedStatuses
  ) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  if (resolvedStatuses) {
    sets.push("status = ?");
    values.push(resolvedStatuses.status);
    sets.push("fit_status = ?");
    values.push(resolvedStatuses.fit_status);
    sets.push("workflow_status = ?");
    values.push(resolvedStatuses.workflow_status);
    sets.push("application_status = ?");
    values.push(resolvedStatuses.application_status);
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

import { NextRequest, NextResponse } from "next/server";

import { generateJobId } from "@/lib/job-id";
import {
  APPLICATION_STATUSES,
  applyResolvedStatuses,
  FIT_STATUSES,
  mapLegacyStatusFilter,
  WORKFLOW_STATUSES,
} from "@/lib/job-status";

function buildManualListingContent(body: {
  company: string;
  position: string;
  rawUrl?: string;
  location?: string;
  employmentType?: string;
  deadline?: string;
  salaryText?: string;
}): string {
  return [
    `# ${body.company} - ${body.position}`,
    "- source: manual",
    body.rawUrl ? `- url: ${body.rawUrl}` : null,
    body.location ? `- location: ${body.location}` : null,
    body.employmentType ? `- employment_type: ${body.employmentType}` : null,
    body.deadline ? `- deadline: ${body.deadline}` : null,
    body.salaryText ? `- salary: ${body.salaryText}` : null,
    `- collected_at: ${new Date().toISOString()}`,
    "",
    "# Listing Snapshot",
    [body.position, body.location, body.employmentType, body.salaryText]
      .filter(Boolean)
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildManualDetailContent(body: {
  company: string;
  position: string;
  rawText: string;
  rawUrl?: string;
}): string {
  return [
    `# ${body.company} - ${body.position}`,
    "- source: manual",
    body.rawUrl ? `- url: ${body.rawUrl}` : null,
    `- collected_at: ${new Date().toISOString()}`,
    "",
    "# Detail JD",
    body.rawText,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeDeadline(deadline: string | undefined) {
  if (!deadline) {
    return {
      deadlineValue: null,
      deadlineText: null,
      deadlineDate: null,
      parseStatus: "missing",
    } as const;
  }

  const trimmed = deadline.trim();
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/u.test(trimmed);

  return {
    deadlineValue: isIsoDate ? trimmed : trimmed,
    deadlineText: trimmed,
    deadlineDate: isIsoDate ? trimmed : null,
    parseStatus: isIsoDate ? "parsed" : "invalid",
  } as const;
}

export async function GET(request: NextRequest) {
  const { getDb } = await import("@/lib/db");
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const fitStatus = searchParams.get("fit_status");
  const workflowStatus = searchParams.get("workflow_status");
  const applicationStatus = searchParams.get("application_status");
  const source = searchParams.get("source");
  const minScore = searchParams.get("min_score");
  const search = searchParams.get("search");

  const db = getDb();
  let query = "SELECT * FROM jobs WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    const mappedStatus = mapLegacyStatusFilter(status);

    if (!mappedStatus) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }

    query += ` AND ${mappedStatus.column} = ?`;
    params.push(mappedStatus.value);
  }

  if (fitStatus) {
    if (!(FIT_STATUSES as readonly string[]).includes(fitStatus)) {
      return NextResponse.json({ error: "invalid fit_status" }, { status: 400 });
    }

    query += " AND fit_status = ?";
    params.push(fitStatus);
  }

  if (workflowStatus) {
    if (!(WORKFLOW_STATUSES as readonly string[]).includes(workflowStatus)) {
      return NextResponse.json(
        { error: "invalid workflow_status" },
        { status: 400 }
      );
    }

    query += " AND workflow_status = ?";
    params.push(workflowStatus);
  }

  if (applicationStatus) {
    if (
      !(APPLICATION_STATUSES as readonly string[]).includes(applicationStatus)
    ) {
      return NextResponse.json(
        { error: "invalid application_status" },
        { status: 400 }
      );
    }

    query += " AND application_status = ?";
    params.push(applicationStatus);
  }

  if (source) {
    query += " AND source = ?";
    params.push(source);
  }

  if (minScore) {
    const parsedMinScore = Number.parseFloat(minScore);

    if (!Number.isFinite(parsedMinScore)) {
      return NextResponse.json({ error: "invalid min_score" }, { status: 400 });
    }

    query += " AND fit_score >= ?";
    params.push(parsedMinScore);
  }

  if (search) {
    query += " AND (company LIKE ? OR position LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  if (!status && !fitStatus) {
    query += " AND fit_status != 'filtered_out'";
  }

  query += " ORDER BY created_at DESC LIMIT 200";

  const jobs = db
    .prepare(query)
    .all(...params)
    .map((job) => applyResolvedStatuses(job as Record<string, unknown>));

  return NextResponse.json(jobs);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    company?: string;
    position?: string;
    rawText?: string;
    rawUrl?: string;
    location?: string;
    employmentType?: string;
    companySize?: string;
    employeeCount?: number;
    deadline?: string;
    salaryText?: string;
    memo?: string;
  };
  const company = body.company?.trim();
  const position = body.position?.trim();
  const rawText = body.rawText?.trim();

  if (!company || !position || !rawText) {
    return NextResponse.json(
      { error: "company, position, rawText is required" },
      { status: 400 }
    );
  }

  const { getDb } = await import("@/lib/db");
  const {
    saveDetailJob,
    saveListingJob,
  } = await import("@/lib/job-file-store");
  const db = getDb();
  const rawUrl = body.rawUrl?.trim() || null;

  if (rawUrl) {
    const existing = db
      .prepare("SELECT job_id FROM jobs WHERE raw_url = ? LIMIT 1")
      .get(rawUrl) as { job_id: string } | undefined;

    if (existing) {
      return NextResponse.json(
        { error: "Job already exists", job_id: existing.job_id },
        { status: 409 }
      );
    }
  }

  const jobId = generateJobId();
  const listingFilePath = saveListingJob(
    jobId,
    buildManualListingContent({
      company,
      position,
      rawUrl: rawUrl || undefined,
      location: body.location?.trim() || undefined,
      employmentType: body.employmentType?.trim() || undefined,
      deadline: body.deadline?.trim() || undefined,
      salaryText: body.salaryText?.trim() || undefined,
    })
  );
  const detailFilePath = saveDetailJob(
    jobId,
    buildManualDetailContent({
      company,
      position,
      rawText,
      rawUrl: rawUrl || undefined,
    })
  );
  const deadline = normalizeDeadline(body.deadline?.trim());

  db.prepare(`
    INSERT INTO jobs (
      job_id,
      source,
      company,
      position,
      location,
      employment_type,
      company_size,
      employee_count,
      raw_url,
      deadline,
      deadline_text,
      deadline_date,
      deadline_parse_status,
      salary_text,
      status,
      fit_status,
      workflow_status,
      application_status,
      memo,
      listing_file,
      detail_file,
      detail_collected_at,
      detail_status,
      raw_file
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jobId,
    "manual",
    company,
    position,
    body.location?.trim() || null,
    body.employmentType?.trim() || null,
    body.companySize?.trim() || null,
    body.employeeCount || null,
    rawUrl,
    deadline.deadlineValue,
    deadline.deadlineText,
    deadline.deadlineDate,
    deadline.parseStatus,
    body.salaryText?.trim() || null,
    "passed",
    "passed",
    "detail_ready",
    "not_started",
    body.memo?.trim() || null,
    listingFilePath,
    detailFilePath,
    new Date().toISOString(),
    "ready",
    detailFilePath
  );

  return NextResponse.json({ job_id: jobId }, { status: 201 });
}

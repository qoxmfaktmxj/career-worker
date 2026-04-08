import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { saveRawJob } from "@/lib/file-store";
import { generateJobId } from "@/lib/job-id";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const minScore = searchParams.get("min_score");
  const search = searchParams.get("search");

  const db = getDb();
  let query = "SELECT * FROM jobs WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  if (source) {
    query += " AND source = ?";
    params.push(source);
  }

  if (minScore) {
    query += " AND fit_score >= ?";
    params.push(Number.parseFloat(minScore));
  }

  if (search) {
    query += " AND (company LIKE ? OR position LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  if (!status) {
    query += " AND status != 'filtered_out'";
  }

  query += " ORDER BY created_at DESC LIMIT 200";

  const jobs = db.prepare(query).all(...params);

  return NextResponse.json(jobs);
}

function buildManualRawContent(body: {
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
    "# 원문 JD",
    body.rawText,
  ]
    .filter(Boolean)
    .join("\n");
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
  const rawFilePath = saveRawJob(
    jobId,
    buildManualRawContent({
      company,
      position,
      rawText,
      rawUrl: rawUrl || undefined,
    })
  );

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
      salary_text,
      status,
      memo,
      raw_file
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    body.deadline?.trim() || null,
    body.salaryText?.trim() || null,
    "passed",
    body.memo?.trim() || null,
    rawFilePath
  );

  return NextResponse.json({ job_id: jobId }, { status: 201 });
}

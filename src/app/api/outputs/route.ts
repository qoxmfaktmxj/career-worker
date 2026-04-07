import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");
  const type = searchParams.get("type");

  const db = getDb();
  let query = `
    SELECT o.*, j.company, j.position
    FROM outputs o
    JOIN jobs j ON o.job_id = j.job_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (jobId) {
    query += " AND o.job_id = ?";
    params.push(jobId);
  }

  if (type) {
    query += " AND o.type = ?";
    params.push(type);
  }

  query += " ORDER BY o.created_at DESC LIMIT 100";

  const outputs = db.prepare(query).all(...params);

  return NextResponse.json(outputs);
}

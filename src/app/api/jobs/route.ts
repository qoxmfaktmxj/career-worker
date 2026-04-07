import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";

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

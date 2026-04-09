import { NextResponse } from "next/server";

export async function GET() {
  const { getDb } = await import("@/lib/db");
  const db = getDb();

  const total = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE fit_status != 'filtered_out'")
    .get() as { count: number };
  const newJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE fit_status = 'passed'")
    .get() as { count: number };
  const matched = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE fit_status = 'matched'")
    .get() as { count: number };
  const deadlineSoon = db
    .prepare(`
      SELECT COUNT(*) as count FROM jobs
      WHERE fit_status != 'filtered_out'
      AND application_status = 'not_started'
      AND deadline_date IS NOT NULL
      AND deadline_date >= date('now')
      AND deadline_date <= date('now', '+3 days')
    `)
    .get() as { count: number };
  const expired = db
    .prepare(`
      SELECT COUNT(*) as count FROM jobs
      WHERE fit_status != 'filtered_out'
      AND deadline_date IS NOT NULL
      AND deadline_date < date('now')
      AND application_status NOT IN ('applied', 'withdrawn', 'closed')
    `)
    .get() as { count: number };

  return NextResponse.json({
    total: total.count,
    new_jobs: newJobs.count,
    matched: matched.count,
    deadline_soon: deadlineSoon.count,
    expired: expired.count,
  });
}

import { NextResponse } from "next/server";

export async function GET() {
  const { getDb } = await import("@/lib/db");
  const db = getDb();

  const total = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE status != 'filtered_out'")
    .get() as { count: number };
  const newJobs = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'passed'")
    .get() as { count: number };
  const matched = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'matched'")
    .get() as { count: number };
  const deadlineSoon = db
    .prepare(`
      SELECT COUNT(*) as count FROM jobs
      WHERE status IN ('passed', 'matched')
      AND deadline IS NOT NULL
      AND deadline >= date('now')
      AND deadline <= date('now', '+3 days')
    `)
    .get() as { count: number };
  const expired = db
    .prepare(`
      SELECT COUNT(*) as count FROM jobs
      WHERE deadline IS NOT NULL
      AND deadline < date('now')
      AND status NOT IN ('filtered_out', 'applied', 'withdrawn')
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

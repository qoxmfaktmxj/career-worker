import { NextResponse } from "next/server";

export async function GET() {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const history = db
    .prepare(`
      SELECT sr.*, s.name as source_name, s.channel
      FROM scan_runs sr
      JOIN sources s ON sr.source_id = s.id
      ORDER BY sr.started_at DESC
      LIMIT 50
    `)
    .all();

  return NextResponse.json(history);
}

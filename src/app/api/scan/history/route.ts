import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET() {
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

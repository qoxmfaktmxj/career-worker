import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    sets.push("name = ?");
    values.push(body.name);
  }

  if (body.config !== undefined) {
    sets.push("config = ?");
    values.push(JSON.stringify(body.config));
  }

  if (body.enabled !== undefined) {
    sets.push("enabled = ?");
    values.push(body.enabled ? 1 : 0);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "변경할 내용 없음" }, { status: 400 });
  }

  values.push(id);
  db.prepare(`UPDATE sources SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  db.prepare("DELETE FROM sources WHERE id = ?").run(id);

  return NextResponse.json({ success: true });
}

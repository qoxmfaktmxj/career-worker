import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { validateScanSourceConfig } = await import("@/lib/scan-source-config");
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    const normalizedName = String(body.name).trim();

    if (!normalizedName) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    sets.push("name = ?");
    values.push(normalizedName);
  }

  if (body.config !== undefined) {
    let normalizedConfig;

    try {
      normalizedConfig = validateScanSourceConfig(body.config);
    } catch (error) {
      return NextResponse.json(
        {
          error: "invalid source config",
          details: (error as { details?: string[] }).details || [],
        },
        { status: 400 }
      );
    }

    sets.push("config = ?");
    values.push(JSON.stringify(normalizedConfig));
  }

  if (body.enabled !== undefined) {
    sets.push("enabled = ?");
    values.push(body.enabled ? 1 : 0);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  values.push(id);
  const result = db.prepare(`UPDATE sources SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { getDb } = await import("@/lib/db");
  const db = getDb();

  const historyCount = db
    .prepare("SELECT COUNT(*) as count FROM scan_runs WHERE source_id = ?")
    .get(id) as { count: number };

  if (historyCount.count > 0) {
    return NextResponse.json(
      { error: "Cannot delete a source with scan history" },
      { status: 409 }
    );
  }

  db.prepare("DELETE FROM sources WHERE id = ?").run(id);

  return NextResponse.json({ success: true });
}

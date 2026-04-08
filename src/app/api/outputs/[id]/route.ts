import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const output = db
    .prepare("SELECT * FROM outputs WHERE id = ?")
    .get(id) as { file_path: string } | undefined;

  if (!output) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { readOutput } = await import("@/lib/output-store");
  const content = readOutput(output.file_path);

  return NextResponse.json({ ...output, content });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { deleteOutput } = await import("@/lib/output-store");
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const output = db
    .prepare("SELECT file_path FROM outputs WHERE id = ?")
    .get(id) as { file_path: string } | undefined;

  if (!output) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  deleteOutput(output.file_path);
  db.prepare("DELETE FROM outputs WHERE id = ?").run(id);

  return NextResponse.json({ success: true });
}

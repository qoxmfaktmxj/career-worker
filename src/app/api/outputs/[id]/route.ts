import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { deleteOutput, readOutput } from "@/lib/file-store";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const output = db
    .prepare("SELECT * FROM outputs WHERE id = ?")
    .get(id) as { file_path: string } | undefined;

  if (!output) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = readOutput(output.file_path);

  return NextResponse.json({ ...output, content });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const output = db
    .prepare("SELECT file_path FROM outputs WHERE id = ?")
    .get(id) as { file_path: string } | undefined;

  if (!output) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.prepare("DELETE FROM outputs WHERE id = ?").run(id);
  deleteOutput(output.file_path);

  return NextResponse.json({ success: true });
}

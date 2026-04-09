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

  const { OutputFileMissingError, readOutput } = await import(
    "@/lib/output-store"
  );
  let content: string;

  try {
    content = readOutput(output.file_path);
  } catch (error) {
    if (error instanceof OutputFileMissingError) {
      return NextResponse.json(
        {
          error: "output_file_missing",
          message: "산출물 파일이 없어 메타데이터와 실제 파일이 일치하지 않습니다.",
        },
        { status: 409 }
      );
    }

    throw error;
  }

  return NextResponse.json({ ...output, content });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { deleteOutputRecord } = await import("@/lib/output-store");
  const output = deleteOutputRecord(id);

  if (!output) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

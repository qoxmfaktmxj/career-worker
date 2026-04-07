import { NextRequest, NextResponse } from "next/server";

import {
  listProfileFiles,
  readProfileFile,
  writeProfileFile,
} from "@/lib/file-store";

export async function GET() {
  const files = listProfileFiles();
  const profile: Record<string, string> = {};

  for (const file of files) {
    profile[file] = readProfileFile(file);
  }

  return NextResponse.json({ files, profile });
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as {
    fileName?: string;
    content?: string;
  };
  const { fileName, content } = body;

  if (!fileName || content === undefined) {
    return NextResponse.json(
      { error: "fileName, content required" },
      { status: 400 }
    );
  }

  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return NextResponse.json({ error: "invalid fileName" }, { status: 400 });
  }

  writeProfileFile(fileName, content);

  return NextResponse.json({ success: true });
}

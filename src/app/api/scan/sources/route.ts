import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const sources = db
    .prepare("SELECT * FROM sources ORDER BY created_at DESC")
    .all();

  return NextResponse.json(sources);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    channel?: string;
    name?: string;
    config?: unknown;
  };
  const { channel, name, config } = body;

  if (!channel || !name || !config) {
    return NextResponse.json(
      { error: "channel, name, config 필수" },
      { status: 400 }
    );
  }

  const db = getDb();
  const result = db
    .prepare("INSERT INTO sources (channel, name, config) VALUES (?, ?, ?)")
    .run(channel, name, JSON.stringify(config));

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { getDb } = await import("@/lib/db");
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
  const channel = body.channel?.trim();
  const name = body.name?.trim();
  const { config } = body;

  if (!channel || !name || !config) {
    return NextResponse.json(
      { error: "channel, name, config is required" },
      { status: 400 }
    );
  }

  const { SUPPORTED_SCAN_CHANNELS, validateScanSourceConfig } = await import(
    "@/lib/scan-source-config"
  );

  if (
    !(SUPPORTED_SCAN_CHANNELS as readonly string[]).includes(channel)
  ) {
    return NextResponse.json(
      { error: "Unsupported channel" },
      { status: 400 }
    );
  }

  let normalizedConfig;

  try {
    normalizedConfig = validateScanSourceConfig(config);
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid source config",
        details: (error as { details?: string[] }).details || [],
      },
      { status: 400 }
    );
  }

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const result = db
    .prepare("INSERT INTO sources (channel, name, config) VALUES (?, ?, ?)")
    .run(channel, name.trim(), JSON.stringify(normalizedConfig));

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { getDb } = await import("@/lib/db");
  const { parseStoredScanSourceConfig } = await import(
    "@/lib/scan-source-config"
  );
  const db = getDb();
  const sources = db
    .prepare("SELECT * FROM sources ORDER BY created_at DESC")
    .all() as Array<{
      channel: string;
      config: string;
    } & Record<string, unknown>>;

  const normalizedSources = sources.map((source) => {
    try {
      const validation = parseStoredScanSourceConfig(source.channel, source.config);

      return {
        ...source,
        config: JSON.stringify(validation.config),
        config_warnings: validation.warnings,
      };
    } catch (error) {
      return {
        ...source,
        config_warnings: [],
        config_error: (error as { details?: string[] }).details || [],
      };
    }
  });

  return NextResponse.json(normalizedSources);
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

  let validation;

  try {
    validation = validateScanSourceConfig(channel, config);
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
    .run(channel, name.trim(), JSON.stringify(validation.config));

  return NextResponse.json(
    { id: result.lastInsertRowid, warnings: validation.warnings },
    { status: 201 }
  );
}

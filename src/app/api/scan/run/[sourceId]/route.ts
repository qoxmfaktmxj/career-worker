import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { DEFAULT_FILTER_CONFIG } from "@/lib/filters";
import { runScan } from "@/scanners/orchestrator";

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params;
  const db = getDb();
  const source = db
    .prepare("SELECT * FROM sources WHERE id = ?")
    .get(sourceId) as { id: number; channel: string; config: string } | undefined;

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const config = JSON.parse(source.config) as Record<string, unknown>;

  try {
    const result = await runScan(
      source.id,
      source.channel,
      config,
      DEFAULT_FILTER_CONFIG
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

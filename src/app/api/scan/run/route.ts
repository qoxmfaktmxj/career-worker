import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { DEFAULT_FILTER_CONFIG } from "@/lib/filters";
import { runScan } from "@/scanners/orchestrator";

export async function POST() {
  const db = getDb();
  const sources = db
    .prepare("SELECT * FROM sources WHERE enabled = 1")
    .all() as Array<{ id: number; channel: string; config: string }>;

  const results: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    try {
      const config = JSON.parse(source.config) as Record<string, unknown>;
      const result = await runScan(
        source.id,
        source.channel,
        config,
        DEFAULT_FILTER_CONFIG
      );

      results.push({
        source_id: source.id,
        channel: source.channel,
        ...result,
      });
    } catch (error) {
      const scanError = error as Error;
      results.push({
        source_id: source.id,
        channel: source.channel,
        error: scanError.message,
      });
    }
  }

  return NextResponse.json({ results });
}

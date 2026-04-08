import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_FILTER_CONFIG } from "@/lib/filters";
import {
  formatMissingScannerConfigMessage,
  getMissingScannerConfig,
} from "@/scanners/requirements";

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params;
  const [{ getDb }, { runScan }] = await Promise.all([
    import("@/lib/db"),
    import("@/scanners/orchestrator"),
  ]);
  const db = getDb();
  const source = db
    .prepare("SELECT * FROM sources WHERE id = ?")
    .get(sourceId) as { id: number; channel: string; config: string } | undefined;

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const config = JSON.parse(source.config) as Record<string, unknown>;
  const missingConfig = getMissingScannerConfig(source.channel);

  if (missingConfig) {
    return NextResponse.json(
      {
        error: formatMissingScannerConfigMessage(
          source.channel,
          missingConfig.missingLabels
        ),
        missing_config: missingConfig.missingLabels,
        missing_env: missingConfig.missingEnv,
      },
      { status: 400 }
    );
  }

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

import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_FILTER_CONFIG } from "@/lib/filters";
import { ScanAlreadyRunningError } from "@/lib/scan-lock";
import {
  formatMissingScannerConfigMessage,
  getMissingScannerConfig,
} from "@/scanners/requirements";

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params;
  const [{ getDb }, { runScan }, { parseStoredScanSourceConfig }] =
    await Promise.all([
    import("@/lib/db"),
    import("@/scanners/orchestrator"),
    import("@/lib/scan-source-config"),
  ]);
  const db = getDb();
  const source = db
    .prepare("SELECT * FROM sources WHERE id = ?")
    .get(sourceId) as { id: number; channel: string; config: string } | undefined;

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  let validation;

  try {
    validation = parseStoredScanSourceConfig(source.channel, source.config);
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid source config",
        details: (error as { details?: string[] }).details || [],
      },
      { status: 400 }
    );
  }

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
      validation.config,
      DEFAULT_FILTER_CONFIG
    );

    return NextResponse.json({
      ...(validation.warnings.length > 0
        ? { config_warnings: validation.warnings }
        : {}),
      ...result,
    });
  } catch (error) {
    if (error instanceof ScanAlreadyRunningError) {
      return NextResponse.json(
        { error: error.message, code: "scan_already_running" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: (error as Error).message,
        details: (error as { details?: string[] }).details || undefined,
      },
      { status: 500 }
    );
  }
}

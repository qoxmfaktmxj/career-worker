import { NextResponse } from "next/server";
import { DEFAULT_FILTER_CONFIG } from "@/lib/filters";
import { ScanAlreadyRunningError } from "@/lib/scan-lock";
import {
  formatMissingScannerConfigMessage,
  getMissingScannerConfig,
} from "@/scanners/requirements";

export async function POST() {
  const [{ getDb }, { runScan }, { parseStoredScanSourceConfig }] =
    await Promise.all([
    import("@/lib/db"),
    import("@/scanners/orchestrator"),
    import("@/lib/scan-source-config"),
  ]);
  const db = getDb();
  const sources = db
    .prepare("SELECT * FROM sources WHERE enabled = 1")
    .all() as Array<{ id: number; channel: string; config: string }>;

  const results: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    try {
      const config = parseStoredScanSourceConfig(source.config);
      const missingConfig = getMissingScannerConfig(source.channel);

      if (missingConfig) {
        results.push({
          source_id: source.id,
          channel: source.channel,
          error: formatMissingScannerConfigMessage(
            source.channel,
            missingConfig.missingLabels
          ),
          missing_config: missingConfig.missingLabels,
          missing_env: missingConfig.missingEnv,
        });
        continue;
      }

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
      const scanError = error as Error & { details?: string[] };
      results.push({
        source_id: source.id,
        channel: source.channel,
        error: scanError.message,
        ...(scanError instanceof ScanAlreadyRunningError
          ? { code: "scan_already_running" }
          : {}),
        ...(scanError.details ? { details: scanError.details } : {}),
      });
    }
  }

  return NextResponse.json({ results });
}

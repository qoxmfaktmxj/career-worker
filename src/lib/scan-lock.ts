import { getDb } from "@/lib/db";

const SCAN_LOCK_TTL_MS = 30 * 60 * 1000;

export class ScanAlreadyRunningError extends Error {
  readonly sourceId: number;

  constructor(sourceId: number) {
    super(`scan already running for source ${sourceId}`);
    this.name = "ScanAlreadyRunningError";
    this.sourceId = sourceId;
  }
}

export function acquireScanLock(sourceId: number): void {
  const db = getDb();

  db.prepare("DELETE FROM scan_source_locks WHERE expires_at <= ?").run(
    new Date().toISOString()
  );

  const result = db
    .prepare(
      `
        INSERT OR IGNORE INTO scan_source_locks (source_id, expires_at)
        VALUES (?, ?)
      `
    )
    .run(sourceId, new Date(Date.now() + SCAN_LOCK_TTL_MS).toISOString());

  if (result.changes === 0) {
    throw new ScanAlreadyRunningError(sourceId);
  }
}

export function releaseScanLock(sourceId: number): void {
  const db = getDb();

  db.prepare("DELETE FROM scan_source_locks WHERE source_id = ?").run(sourceId);
}

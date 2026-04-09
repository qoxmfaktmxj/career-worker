import crypto from "crypto";

import type Database from "better-sqlite3";

export type JobDuplicateReason = "source_id" | "raw_url" | "fingerprint";

export type JobDuplicateMatch = {
  jobId: string;
  reason: JobDuplicateReason;
};

export type JobDedupeIdentifiers = {
  source: string;
  sourceId?: string | null;
  rawUrl?: string | null;
  company: string;
  position: string;
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeRawUrl(rawUrl: string | null | undefined): string | null {
  const normalized = rawUrl?.trim();

  return normalized ? normalized : null;
}

export function makeJobFingerprint({
  rawUrl,
  company,
  position,
}: Pick<JobDedupeIdentifiers, "rawUrl" | "company" | "position">): string {
  const input = `${normalizeRawUrl(rawUrl) ?? ""}|${normalizeWhitespace(company)}|${normalizeWhitespace(position)}`;

  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

export function findExistingJob(
  db: Database.Database,
  identifiers: JobDedupeIdentifiers
): JobDuplicateMatch | null {
  const normalizedSourceId = identifiers.sourceId?.trim() || null;

  if (identifiers.source !== "manual" && normalizedSourceId) {
    const existing = db
      .prepare(
        "SELECT job_id FROM jobs WHERE source = ? AND source_id = ? LIMIT 1"
      )
      .get(identifiers.source, normalizedSourceId) as
      | { job_id: string }
      | undefined;

    if (existing) {
      return { jobId: existing.job_id, reason: "source_id" };
    }
  }

  const normalizedRawUrl = normalizeRawUrl(identifiers.rawUrl);

  if (normalizedRawUrl) {
    const existing = db
      .prepare("SELECT job_id FROM jobs WHERE raw_url = ? LIMIT 1")
      .get(normalizedRawUrl) as { job_id: string } | undefined;

    if (existing) {
      return { jobId: existing.job_id, reason: "raw_url" };
    }
  }

  const fingerprint = makeJobFingerprint(identifiers);
  const existing = db
    .prepare("SELECT job_id FROM job_fingerprints WHERE fingerprint = ? LIMIT 1")
    .get(fingerprint) as { job_id: string } | undefined;

  if (existing) {
    return { jobId: existing.job_id, reason: "fingerprint" };
  }

  return null;
}

export function registerJobFingerprint(
  db: Database.Database,
  fingerprint: string,
  jobId: string,
  source: string
): void {
  db.prepare(
    "INSERT INTO job_fingerprints (fingerprint, job_id, source) VALUES (?, ?, ?)"
  ).run(fingerprint, jobId, source);
}

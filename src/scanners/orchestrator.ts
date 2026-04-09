import crypto from "crypto";

import { getDb } from "@/lib/db";
import { applyFilter, type FilterConfig } from "@/lib/filters";
import {
  deleteStoredJobMarkdown,
  saveDetailJob,
  saveListingJob,
} from "@/lib/job-file-store";
import { generateJobId } from "@/lib/job-id";
import { jobkoreaScanner } from "@/scanners/jobkorea";
import { rememberScanner } from "@/scanners/remember";
import { saraminScanner } from "@/scanners/saramin";
import type { ScanResult, Scanner } from "@/scanners/types";

const SCANNERS: Record<string, Scanner> = {
  saramin: saraminScanner,
  jobkorea: jobkoreaScanner,
  remember: rememberScanner,
};

function makeFingerprint(result: ScanResult): string {
  const input = `${result.raw_url}|${result.company}|${result.position}`;

  return crypto
    .createHash("sha256")
    .update(input)
    .digest("hex")
    .slice(0, 32);
}

function getListingText(result: ScanResult): string {
  return result.listing_text || result.raw_text || "";
}

function normalizeDeadline(deadline: string | undefined): {
  deadlineText: string | null;
  deadlineDate: string | null;
  parseStatus: "missing" | "parsed" | "invalid";
} {
  if (!deadline) {
    return {
      deadlineText: null,
      deadlineDate: null,
      parseStatus: "missing",
    };
  }

  const trimmed = deadline.trim();

  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
    return {
      deadlineText: trimmed,
      deadlineDate: trimmed,
      parseStatus: "parsed",
    };
  }

  return {
    deadlineText: trimmed,
    deadlineDate: null,
    parseStatus: "invalid",
  };
}

function buildListingContent(result: ScanResult): string {
  return [
    `# ${result.company} - ${result.position}`,
    `- source: ${result.source}`,
    `- url: ${result.raw_url}`,
    `- collected_at: ${new Date().toISOString()}`,
    "",
    "# Listing Snapshot",
    getListingText(result),
  ].join("\n");
}

export function processResults(
  results: ScanResult[],
  filterConfig: FilterConfig
): { passed: ScanResult[]; filtered: ScanResult[] } {
  const passed: ScanResult[] = [];
  const filtered: ScanResult[] = [];

  for (const result of results) {
    const filterResult = applyFilter(
      {
        position: result.position,
        raw_text: getListingText(result),
        location: result.location,
        company_size: result.company_size,
        employee_count: result.employee_count,
      },
      filterConfig
    );

    if (filterResult.passed) {
      passed.push(result);
    } else {
      filtered.push(result);
    }
  }

  return { passed, filtered };
}

export interface ScanRunResult {
  total_found: number;
  new_count: number;
  duplicate_count: number;
  filtered_count: number;
  passed_count: number;
}

type PendingResult = {
  result: ScanResult;
  fingerprint: string;
  filterReason: string | null;
  status: "passed" | "filtered_out";
  listingContent: string;
  detailContent: string | null;
  detailStatus: "ready" | "missing" | "failed";
};

async function collectDetailContent(
  scanner: Scanner,
  result: ScanResult
): Promise<{ detailContent: string | null; detailStatus: "ready" | "missing" | "failed" }> {
  if (!scanner.fetchDetail) {
    return { detailContent: null, detailStatus: "missing" };
  }

  try {
    const content = await scanner.fetchDetail(result);

    if (!content || !content.trim()) {
      return { detailContent: null, detailStatus: "missing" };
    }

    return { detailContent: content, detailStatus: "ready" };
  } catch {
    return { detailContent: null, detailStatus: "failed" };
  }
}

export async function runScan(
  sourceId: number,
  channel: string,
  config: Record<string, unknown>,
  filterConfig: FilterConfig
): Promise<ScanRunResult> {
  const db = getDb();
  const scanner = SCANNERS[channel];

  if (!scanner) {
    throw new Error(`Unknown channel: ${channel}`);
  }

  const run = db
    .prepare("INSERT INTO scan_runs (source_id, status) VALUES (?, ?)")
    .run(sourceId, "running");
  const runId = run.lastInsertRowid;

  try {
    const scannerConfig = {
      keywords: (config.keywords as string[]) || [],
      location_codes: (config.location_codes as string[]) || [],
      exclude_keywords: (config.exclude_keywords as string[]) || [],
    };

    const results = await scanner.scan(scannerConfig);
    const stats: ScanRunResult = {
      total_found: results.length,
      new_count: 0,
      duplicate_count: 0,
      filtered_count: 0,
      passed_count: 0,
    };
    const pendingResults: PendingResult[] = [];
    const seenFingerprints = new Set<string>();
    const createdJobFiles: string[] = [];

    for (const result of results) {
      const fingerprint = makeFingerprint(result);

      if (seenFingerprints.has(fingerprint)) {
        stats.duplicate_count += 1;
        continue;
      }

      const existing = db
        .prepare("SELECT id FROM job_fingerprints WHERE fingerprint = ?")
        .get(fingerprint);

      if (existing) {
        stats.duplicate_count += 1;
        continue;
      }

      seenFingerprints.add(fingerprint);

      const filterResult = applyFilter(
        {
          position: result.position,
          raw_text: getListingText(result),
          location: result.location,
          company_size: result.company_size,
          employee_count: result.employee_count,
        },
        filterConfig
      );
      const status = filterResult.passed ? "passed" : "filtered_out";
      const { detailContent, detailStatus } = await collectDetailContent(
        scanner,
        result
      );

      pendingResults.push({
        result,
        fingerprint,
        filterReason: filterResult.reason || null,
        status,
        listingContent: buildListingContent(result),
        detailContent,
        detailStatus,
      });

      if (filterResult.passed) {
        stats.passed_count += 1;
      } else {
        stats.filtered_count += 1;
      }

      stats.new_count += 1;
    }

    const insertJob = db.prepare(`
      INSERT INTO jobs (
        job_id,
        source,
        source_id,
        company,
        position,
        location,
        employment_type,
        company_size,
        employee_count,
        raw_url,
        deadline,
        deadline_text,
        deadline_date,
        deadline_parse_status,
        salary_text,
        status,
        filter_reason,
        listing_file,
        detail_file,
        detail_collected_at,
        detail_status,
        raw_file
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertFingerprint = db.prepare(
      "INSERT INTO job_fingerprints (fingerprint, job_id, source) VALUES (?, ?, ?)"
    );
    const persistPendingResults = db.transaction((items: PendingResult[]) => {
      for (const item of items) {
        const jobId = generateJobId();
        const listingFilePath = saveListingJob(jobId, item.listingContent);
        createdJobFiles.push(listingFilePath);

        let detailFilePath: string | null = null;
        let detailCollectedAt: string | null = null;

        if (item.detailContent) {
          detailFilePath = saveDetailJob(jobId, item.detailContent);
          detailCollectedAt = new Date().toISOString();
          createdJobFiles.push(detailFilePath);
        }

        const deadline = normalizeDeadline(item.result.deadline);

        insertJob.run(
          jobId,
          item.result.source,
          item.result.source_id,
          item.result.company,
          item.result.position,
          item.result.location,
          item.result.employment_type,
          item.result.company_size || null,
          item.result.employee_count || null,
          item.result.raw_url,
          deadline.deadlineDate,
          deadline.deadlineText,
          deadline.deadlineDate,
          deadline.parseStatus,
          item.result.salary_text || null,
          item.status,
          item.filterReason,
          listingFilePath,
          detailFilePath,
          detailCollectedAt,
          item.detailStatus,
          detailFilePath ?? listingFilePath
        );

        insertFingerprint.run(item.fingerprint, jobId, item.result.source);
      }
    });

    try {
      persistPendingResults(pendingResults);
    } catch (error) {
      for (const jobFilePath of createdJobFiles) {
        try {
          deleteStoredJobMarkdown(jobFilePath);
        } catch {
          // Preserve the original scan error.
        }
      }

      throw error;
    }

    db.prepare(`
      UPDATE scan_runs
      SET status = 'completed',
          finished_at = datetime('now'),
          total_found = ?,
          new_count = ?,
          duplicate_count = ?,
          filtered_count = ?,
          passed_count = ?
      WHERE id = ?
    `).run(
      stats.total_found,
      stats.new_count,
      stats.duplicate_count,
      stats.filtered_count,
      stats.passed_count,
      runId
    );

    db.prepare("UPDATE sources SET last_scan = datetime('now') WHERE id = ?").run(
      sourceId
    );

    return stats;
  } catch (error) {
    const scanError = error as Error;

    db.prepare(`
      UPDATE scan_runs
      SET status = 'failed',
          finished_at = datetime('now'),
          error_message = ?
      WHERE id = ?
    `).run(scanError.message, runId);

    throw error;
  }
}

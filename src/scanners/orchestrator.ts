import crypto from "crypto";

import { getDb } from "@/lib/db";
import { saveRawJob } from "@/lib/file-store";
import { applyFilter, type FilterConfig } from "@/lib/filters";
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
        raw_text: result.raw_text,
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

    for (const result of results) {
      const fingerprint = makeFingerprint(result);
      const existing = db
        .prepare("SELECT id FROM job_fingerprints WHERE fingerprint = ?")
        .get(fingerprint);

      if (existing) {
        stats.duplicate_count += 1;
        continue;
      }

      const filterResult = applyFilter(
        {
          position: result.position,
          raw_text: result.raw_text,
          location: result.location,
          company_size: result.company_size,
          employee_count: result.employee_count,
        },
        filterConfig
      );

      const jobId = generateJobId();
      const status = filterResult.passed ? "passed" : "filtered_out";

      db.prepare(`
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
          salary_text,
          status,
          filter_reason,
          raw_file
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        jobId,
        result.source,
        result.source_id,
        result.company,
        result.position,
        result.location,
        result.employment_type,
        result.company_size || null,
        result.employee_count || null,
        result.raw_url,
        result.deadline || null,
        result.salary_text || null,
        status,
        filterResult.reason || null,
        `raw/${jobId}.md`
      );

      db.prepare(
        "INSERT INTO job_fingerprints (fingerprint, job_id, source) VALUES (?, ?, ?)"
      ).run(fingerprint, jobId, result.source);

      const rawContent = [
        `# ${result.company} - ${result.position}`,
        `- source: ${result.source}`,
        `- url: ${result.raw_url}`,
        `- collected_at: ${new Date().toISOString()}`,
        "",
        "# 원문 JD",
        result.raw_text,
      ].join("\n");

      saveRawJob(jobId, rawContent);

      if (filterResult.passed) {
        stats.passed_count += 1;
      } else {
        stats.filtered_count += 1;
      }

      stats.new_count += 1;
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

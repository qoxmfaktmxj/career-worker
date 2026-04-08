import fs from "fs";
import path from "path";

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isDefaultRelativeDir(configured: string, defaultDir: string): boolean {
  const normalized = configured.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized === defaultDir;
}

function canUseAbsoluteJobsDir(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

function jobsRootDir(): string {
  const configured = process.env.JOBS_DIR?.trim();

  if (!configured || isDefaultRelativeDir(configured, "jobs")) {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), "jobs");
  }

  if (canUseAbsoluteJobsDir() && path.isAbsolute(configured)) {
    return path.join(/*turbopackIgnore: true*/ configured);
  }

  throw new Error("JOBS_DIR must be ./jobs or an absolute path");
}

function rawJobsDir(): string {
  return path.join(jobsRootDir(), "raw");
}

function normalizedJobsDir(): string {
  return path.join(jobsRootDir(), "normalized");
}

function resolveStoredRawJobPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");

  if (!/^raw\/[^/]+\.md$/u.test(normalized)) {
    throw new Error("Raw job path must stay within JOBS_DIR/raw");
  }

  return path.join(rawJobsDir(), path.basename(normalized));
}

export function saveRawJob(jobId: string, content: string): string {
  const dir = rawJobsDir();
  const filePath = path.join("raw", `${jobId}.md`);

  ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${jobId}.md`), content, "utf-8");

  return filePath;
}

export function readRawJob(jobId: string): string {
  return fs.readFileSync(path.join(rawJobsDir(), `${jobId}.md`), "utf-8");
}

export function deleteRawJob(relativePath: string): void {
  const filePath = resolveStoredRawJobPath(relativePath);

  if (!fs.existsSync(filePath)) {
    return;
  }

  fs.unlinkSync(filePath);
}

export function saveNormalizedJob(
  jobId: string,
  data: Record<string, unknown>
): string {
  const dir = normalizedJobsDir();
  const filePath = path.join("normalized", `${jobId}.json`);

  ensureDir(dir);
  fs.writeFileSync(
    path.join(dir, `${jobId}.json`),
    JSON.stringify(data, null, 2),
    "utf-8"
  );

  return filePath;
}

export function readNormalizedJob(jobId: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(normalizedJobsDir(), `${jobId}.json`), "utf-8")
  ) as Record<string, unknown>;
}

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

function listingsJobsDir(): string {
  return path.join(jobsRootDir(), "listings");
}

function detailsJobsDir(): string {
  return path.join(jobsRootDir(), "details");
}

function legacyRawJobsDir(): string {
  return path.join(jobsRootDir(), "raw");
}

function normalizedJobsDir(): string {
  return path.join(jobsRootDir(), "normalized");
}

function resolveStoredMarkdownPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const [typeDir, fileName, ...rest] = normalized.split("/");

  if (!typeDir || !fileName || rest.length > 0 || !fileName.endsWith(".md")) {
    throw new Error("Job markdown path must stay within JOBS_DIR");
  }

  if (!["listings", "details", "raw"].includes(typeDir)) {
    throw new Error("Job markdown path must stay within JOBS_DIR");
  }

  return path.join(jobsRootDir(), typeDir, path.basename(fileName));
}

function resolveStoredJsonPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");

  if (!/^normalized\/[^/]+\.json$/u.test(normalized)) {
    throw new Error("Normalized job path must stay within JOBS_DIR/normalized");
  }

  return path.join(normalizedJobsDir(), path.basename(normalized));
}

function writeMarkdownFile(dir: string, relativeDir: string, jobId: string, content: string): string {
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${jobId}.md`), content, "utf-8");
  return path.join(relativeDir, `${jobId}.md`);
}

function readJobMarkdownById(dir: string, jobId: string): string {
  return fs.readFileSync(path.join(dir, `${jobId}.md`), "utf-8");
}

export function saveListingJob(jobId: string, content: string): string {
  return writeMarkdownFile(listingsJobsDir(), "listings", jobId, content);
}

export function readListingJob(jobId: string): string {
  return readJobMarkdownById(listingsJobsDir(), jobId);
}

export function saveDetailJob(jobId: string, content: string): string {
  return writeMarkdownFile(detailsJobsDir(), "details", jobId, content);
}

export function readDetailJob(jobId: string): string {
  return readJobMarkdownById(detailsJobsDir(), jobId);
}

export function readStoredJobMarkdown(relativePath: string): string {
  return fs.readFileSync(resolveStoredMarkdownPath(relativePath), "utf-8");
}

export function deleteStoredJobMarkdown(relativePath: string): void {
  const filePath = resolveStoredMarkdownPath(relativePath);

  if (!fs.existsSync(filePath)) {
    return;
  }

  fs.unlinkSync(filePath);
}

export function saveRawJob(jobId: string, content: string): string {
  return saveDetailJob(jobId, content);
}

export function readRawJob(jobId: string): string {
  const detailPath = path.join(detailsJobsDir(), `${jobId}.md`);

  if (fs.existsSync(detailPath)) {
    return fs.readFileSync(detailPath, "utf-8");
  }

  const legacyPath = path.join(legacyRawJobsDir(), `${jobId}.md`);
  return fs.readFileSync(legacyPath, "utf-8");
}

export function deleteRawJob(relativePath: string): void {
  deleteStoredJobMarkdown(relativePath);
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

export function readStoredNormalizedJob(
  relativePath: string
): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(resolveStoredJsonPath(relativePath), "utf-8")
  ) as Record<string, unknown>;
}

import fs from "fs";
import path from "path";

const MANAGED_PROFILE_FILES = [
  "profile.yml",
  "master_resume.md",
  "career_story.md",
  "story_bank.md",
  "answer_bank.md",
  "links.md",
] as const;

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isDefaultRelativeDir(configured: string, defaultDir: string): boolean {
  const normalized = configured.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized === defaultDir;
}

function resolveJobsDir(): string {
  const configured = process.env.JOBS_DIR?.trim();

  if (!configured || isDefaultRelativeDir(configured, "jobs")) {
    return path.join(/* turbopackIgnore: true */ process.cwd(), "jobs");
  }

  if (path.isAbsolute(configured)) {
    return configured;
  }

  throw new Error("JOBS_DIR must be ./jobs or an absolute path");
}

function resolveOutputsDir(): string {
  const configured = process.env.OUTPUTS_DIR?.trim();

  if (!configured || isDefaultRelativeDir(configured, "outputs")) {
    return path.join(/* turbopackIgnore: true */ process.cwd(), "outputs");
  }

  if (path.isAbsolute(configured)) {
    return configured;
  }

  throw new Error("OUTPUTS_DIR must be ./outputs or an absolute path");
}

function resolveProfileDir(): string {
  const configured = process.env.PROFILE_DIR?.trim();

  if (!configured || isDefaultRelativeDir(configured, "profile")) {
    return path.join(/* turbopackIgnore: true */ process.cwd(), "profile");
  }

  if (path.isAbsolute(configured)) {
    return configured;
  }

  throw new Error("PROFILE_DIR must be ./profile or an absolute path");
}

function jobsDir(): string {
  return resolveJobsDir();
}

function outputsDir(): string {
  return resolveOutputsDir();
}

function profileDir(): string {
  return resolveProfileDir();
}

export function isManagedProfileFile(fileName: string): boolean {
  return (MANAGED_PROFILE_FILES as readonly string[]).includes(fileName);
}

function resolveManagedProfilePath(fileName: string): string {
  if (!isManagedProfileFile(fileName)) {
    throw new Error("Unsupported profile file");
  }

  switch (fileName) {
    case "profile.yml":
      return path.join(profileDir(), "profile.yml");
    case "master_resume.md":
      return path.join(profileDir(), "master_resume.md");
    case "career_story.md":
      return path.join(profileDir(), "career_story.md");
    case "story_bank.md":
      return path.join(profileDir(), "story_bank.md");
    case "answer_bank.md":
      return path.join(profileDir(), "answer_bank.md");
    case "links.md":
      return path.join(profileDir(), "links.md");
  }

  throw new Error("Unsupported profile file");
}

export function saveRawJob(jobId: string, content: string): string {
  const dir = path.join(jobsDir(), "raw");
  const filePath = path.join("raw", `${jobId}.md`);

  ensureDir(dir);
  fs.writeFileSync(path.join(jobsDir(), filePath), content, "utf-8");

  return filePath;
}

export function readRawJob(jobId: string): string {
  return fs.readFileSync(path.join(jobsDir(), "raw", `${jobId}.md`), "utf-8");
}

export function saveNormalizedJob(
  jobId: string,
  data: Record<string, unknown>
): string {
  const dir = path.join(jobsDir(), "normalized");
  const filePath = path.join("normalized", `${jobId}.json`);

  ensureDir(dir);
  fs.writeFileSync(
    path.join(jobsDir(), filePath),
    JSON.stringify(data, null, 2),
    "utf-8"
  );

  return filePath;
}

export function readNormalizedJob(jobId: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(jobsDir(), "normalized", `${jobId}.json`), "utf-8")
  ) as Record<string, unknown>;
}

export function saveOutput(
  jobId: string,
  type: string,
  content: string,
  lang: string = "ko"
): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const typeDir =
    type === "answer_pack"
      ? "answer_packs"
      : type === "resume"
        ? "resumes"
        : type === "cover_letter"
          ? "cover_letters"
          : "recruiter_replies";
  const dir = path.join(outputsDir(), typeDir);
  const fileName = `${date}_${jobId}_${type}_${lang}.md`;

  ensureDir(dir);
  fs.writeFileSync(path.join(dir, fileName), content, "utf-8");

  return path.join(typeDir, fileName);
}

export function readOutput(relativePath: string): string {
  return fs.readFileSync(path.join(outputsDir(), relativePath), "utf-8");
}

export function readProfileFile(fileName: string): string {
  const filePath = resolveManagedProfilePath(fileName);

  if (!fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf-8");
}

export function writeProfileFile(fileName: string, content: string): void {
  ensureDir(profileDir());
  fs.writeFileSync(resolveManagedProfilePath(fileName), content, "utf-8");
}

export function listProfileFiles(): string[] {
  return MANAGED_PROFILE_FILES.filter((fileName) =>
    fs.existsSync(resolveManagedProfilePath(fileName))
  );
}

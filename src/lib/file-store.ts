import fs from "fs";
import path from "path";

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function jobsDir(): string {
  return process.env.JOBS_DIR || "./jobs";
}

function outputsDir(): string {
  return process.env.OUTPUTS_DIR || "./outputs";
}

function profileDir(): string {
  return process.env.PROFILE_DIR || "./profile";
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
  const filePath = path.join(profileDir(), fileName);

  if (!fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf-8");
}

export function writeProfileFile(fileName: string, content: string): void {
  ensureDir(profileDir());
  fs.writeFileSync(path.join(profileDir(), fileName), content, "utf-8");
}

export function listProfileFiles(): string[] {
  const dir = profileDir();

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith(".md") || fileName.endsWith(".yml"));
}

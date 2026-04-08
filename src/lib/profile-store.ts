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
type ManagedProfileFile = (typeof MANAGED_PROFILE_FILES)[number];

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isDefaultRelativeDir(configured: string, defaultDir: string): boolean {
  const normalized = configured.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized === defaultDir;
}

function canUseAbsoluteProfileDir(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

function resolveProfileDir(): string {
  const configured = process.env.PROFILE_DIR?.trim();

  if (!configured || isDefaultRelativeDir(configured, "profile")) {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), "profile");
  }

  if (canUseAbsoluteProfileDir() && path.isAbsolute(configured)) {
    return path.join(/*turbopackIgnore: true*/ configured);
  }

  throw new Error("PROFILE_DIR must be ./profile or an absolute path");
}

export function isManagedProfileFile(fileName: string): boolean {
  return (MANAGED_PROFILE_FILES as readonly string[]).includes(fileName);
}

function resolveManagedProfilePath(fileName: string): string {
  if (!isManagedProfileFile(fileName)) {
    throw new Error("Unsupported profile file");
  }

  const profileDir = resolveProfileDir();

  switch (fileName as ManagedProfileFile) {
    case "profile.yml":
      return path.join(profileDir, "profile.yml");
    case "master_resume.md":
      return path.join(profileDir, "master_resume.md");
    case "career_story.md":
      return path.join(profileDir, "career_story.md");
    case "story_bank.md":
      return path.join(profileDir, "story_bank.md");
    case "answer_bank.md":
      return path.join(profileDir, "answer_bank.md");
    case "links.md":
      return path.join(profileDir, "links.md");
  }

  throw new Error("Unsupported profile file");
}

export function readProfileFile(fileName: string): string {
  const filePath = resolveManagedProfilePath(fileName);

  if (!fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf-8");
}

export function writeProfileFile(fileName: string, content: string): void {
  ensureDir(resolveProfileDir());
  fs.writeFileSync(resolveManagedProfilePath(fileName), content, "utf-8");
}

export function listProfileFiles(): string[] {
  return MANAGED_PROFILE_FILES.filter((fileName) =>
    fs.existsSync(resolveManagedProfilePath(fileName))
  );
}

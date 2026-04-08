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

function canUseAbsoluteOutputsDir(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

function outputsRootDir(): string {
  const configured = process.env.OUTPUTS_DIR?.trim();

  if (!configured || isDefaultRelativeDir(configured, "outputs")) {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), "outputs");
  }

  if (canUseAbsoluteOutputsDir() && path.isAbsolute(configured)) {
    return path.join(/*turbopackIgnore: true*/ configured);
  }

  throw new Error("OUTPUTS_DIR must be ./outputs or an absolute path");
}

function outputTypeDir(type: string): string {
  switch (type) {
    case "answer_pack":
      return "answer_packs";
    case "resume":
      return "resumes";
    case "cover_letter":
      return "cover_letters";
    case "recruiter_reply":
      return "recruiter_replies";
    default:
      throw new Error("Unsupported output type");
  }
}

function resolveKnownOutputPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const [typeDir, fileName, ...rest] = normalized.split("/");

  if (!typeDir || !fileName || rest.length > 0) {
    throw new Error("Output path must stay within OUTPUTS_DIR");
  }

  if (
    !["answer_packs", "resumes", "cover_letters", "recruiter_replies"].includes(
      typeDir
    )
  ) {
    throw new Error("Output path must stay within OUTPUTS_DIR");
  }

  return path.join(outputsRootDir(), typeDir, path.basename(fileName));
}

export function saveOutput(
  jobId: string,
  type: string,
  content: string,
  lang: string = "ko"
): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const typeDir = outputTypeDir(type);
  const fileName = `${date}_${jobId}_${type}_${lang}.md`;
  let dir: string;

  switch (typeDir) {
    case "answer_packs":
      dir = path.join(outputsRootDir(), "answer_packs");
      break;
    case "resumes":
      dir = path.join(outputsRootDir(), "resumes");
      break;
    case "cover_letters":
      dir = path.join(outputsRootDir(), "cover_letters");
      break;
    case "recruiter_replies":
      dir = path.join(outputsRootDir(), "recruiter_replies");
      break;
    default:
      throw new Error("Unsupported output type");
  }

  ensureDir(dir);
  fs.writeFileSync(path.join(dir, fileName), content, "utf-8");

  return path.join(typeDir, fileName);
}

export function readOutput(relativePath: string): string {
  return fs.readFileSync(resolveKnownOutputPath(relativePath), "utf-8");
}

export function deleteOutput(relativePath: string): void {
  const filePath = resolveKnownOutputPath(relativePath);

  if (!fs.existsSync(filePath)) {
    return;
  }

  fs.unlinkSync(filePath);
}

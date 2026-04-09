import crypto from "crypto";
import fs from "fs";
import path from "path";

import type Database from "better-sqlite3";

import { getDb } from "@/lib/db";

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

function tempOutputsDir(): string {
  return path.join(outputsRootDir(), ".tmp");
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

function timestampToken(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\./g, "").replace(":", "");
}

function buildOutputRelativePath(
  jobId: string,
  type: string,
  language: string,
  version: number
): string {
  const typeDir = outputTypeDir(type);
  const safeJobId = jobId.replace(/[^A-Za-z0-9_-]/g, "_");
  const suffix = crypto.randomBytes(3).toString("hex");
  const fileName = `${timestampToken()}_${safeJobId}_${type}_v${version}_${language}_${suffix}.md`;

  return path.posix.join(typeDir, fileName);
}

function writeTempOutputFile(content: string): string {
  const dir = tempOutputsDir();
  const tempName = `tmp_${timestampToken()}_${crypto.randomBytes(4).toString("hex")}.md`;
  const tempPath = path.join(dir, tempName);

  ensureDir(dir);
  fs.writeFileSync(tempPath, content, "utf-8");

  return tempPath;
}

export class OutputFileMissingError extends Error {
  constructor(public readonly relativePath: string) {
    super("output_file_missing");
    this.name = "OutputFileMissingError";
  }
}

export interface SavedOutputRecord {
  id: number;
  job_id: string;
  type: string;
  file_path: string;
  language: string;
  version: number;
}

interface CreateOutputRecordOptions {
  jobId: string;
  type: string;
  content: string;
  language?: string;
  onPersist?: (database: Database.Database, output: SavedOutputRecord) => void;
}

export function saveOutput(
  jobId: string,
  type: string,
  content: string,
  lang: string = "ko"
): string {
  const relativePath = buildOutputRelativePath(jobId, type, lang, 1);
  const filePath = resolveKnownOutputPath(relativePath);

  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");

  return relativePath;
}

export function createOutputRecord({
  jobId,
  type,
  content,
  language = "ko",
  onPersist,
}: CreateOutputRecordOptions): SavedOutputRecord {
  const db = getDb();
  const tempPath = writeTempOutputFile(content);

  const persistOutput = db.transaction(() => {
    const nextVersionRow = db
      .prepare(
        "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM outputs WHERE job_id = ? AND type = ?"
      )
      .get(jobId, type) as { next_version: number };
    const version = nextVersionRow.next_version;
    const relativePath = buildOutputRelativePath(jobId, type, language, version);
    const finalPath = resolveKnownOutputPath(relativePath);

    ensureDir(path.dirname(finalPath));
    fs.renameSync(tempPath, finalPath);

    try {
      const result = db
        .prepare(
          "INSERT INTO outputs (job_id, type, file_path, language, version) VALUES (?, ?, ?, ?, ?)"
        )
        .run(jobId, type, relativePath, language, version);
      const output = {
        id: Number(result.lastInsertRowid),
        job_id: jobId,
        type,
        file_path: relativePath,
        language,
        version,
      } satisfies SavedOutputRecord;

      onPersist?.(db, output);

      return output;
    } catch (error) {
      if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
      }

      throw error;
    }
  });

  try {
    return persistOutput();
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    throw error;
  }
}

export function readOutput(relativePath: string): string {
  const filePath = resolveKnownOutputPath(relativePath);

  if (!fs.existsSync(filePath)) {
    throw new OutputFileMissingError(relativePath);
  }

  return fs.readFileSync(filePath, "utf-8");
}

export function deleteOutput(relativePath: string): void {
  const filePath = resolveKnownOutputPath(relativePath);

  if (!fs.existsSync(filePath)) {
    return;
  }

  fs.unlinkSync(filePath);
}

export function deleteOutputRecord(id: number | string): SavedOutputRecord | null {
  const db = getDb();
  const output = db
    .prepare("SELECT id, job_id, type, file_path, language, version FROM outputs WHERE id = ?")
    .get(id) as SavedOutputRecord | undefined;

  if (!output) {
    return null;
  }

  const removeOutput = db.transaction(() => {
    try {
      deleteOutput(output.file_path);
    } catch (error) {
      if (!(error instanceof OutputFileMissingError)) {
        throw error;
      }
    }

    db.prepare("DELETE FROM outputs WHERE id = ?").run(id);
  });

  removeOutput();

  return output;
}

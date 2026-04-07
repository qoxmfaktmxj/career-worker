import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DIR = path.join(__dirname, "../../.test-files");
const TEST_DATA_DIR = path.join(TEST_DIR, "data");
const ORIGINAL_CWD = process.cwd();

describe("FileStore", () => {
  beforeEach(() => {
    vi.resetModules();

    process.env.JOBS_DIR = path.join(TEST_DIR, "jobs");
    process.env.OUTPUTS_DIR = path.join(TEST_DIR, "outputs");
    process.env.PROFILE_DIR = path.join(TEST_DIR, "profile");
    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.DB_NAME = "test-files.db";

    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import("@/lib/db");
      closeDb();
    } catch {
      // Database module may not exist during the initial red phase.
    }

    vi.resetModules();
    process.chdir(ORIGINAL_CWD);
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should save and read raw job file", async () => {
    const { saveRawJob, readRawJob } = await import("@/lib/file-store");

    saveRawJob("JOB-0001", "# Test JD\nSome content");

    const content = readRawJob("JOB-0001");

    expect(content).toContain("# Test JD");
  });

  it("should save and read normalized job JSON", async () => {
    const { saveNormalizedJob, readNormalizedJob } = await import(
      "@/lib/file-store"
    );

    const data = { job_id: "JOB-0001", company: "Test" };
    saveNormalizedJob("JOB-0001", data);

    const result = readNormalizedJob("JOB-0001") as { company: string };

    expect(result.company).toBe("Test");
  });

  it("should save output file, return path, and read it back", async () => {
    const { readOutput, saveOutput } = await import("@/lib/file-store");

    const filePath = saveOutput(
      "JOB-0001",
      "answer_pack",
      "# 답변\ncontent",
      "ko"
    );

    expect(filePath).toContain("JOB-0001");
    expect(fs.existsSync(path.join(TEST_DIR, "outputs", filePath))).toBe(true);
    expect(readOutput(filePath)).toContain("# 답변");
  });

  it("should write, read, and list profile files", async () => {
    const { listProfileFiles, readProfileFile, writeProfileFile } = await import(
      "@/lib/file-store"
    );

    writeProfileFile("profile.yml", "name: tester");
    writeProfileFile("career_story.md", "# Story");
    fs.writeFileSync(
      path.join(TEST_DIR, "profile", "notes.md"),
      "# not a managed profile file",
      "utf-8"
    );

    expect(readProfileFile("profile.yml")).toContain("tester");
    expect(listProfileFiles().sort()).toEqual(["career_story.md", "profile.yml"]);
  });

  it("should generate sequential job ids from the database", async () => {
    const { generateJobId } = await import("@/lib/job-id");
    const { getDb } = await import("@/lib/db");

    const firstId = generateJobId();
    const db = getDb();

    db.prepare(
      "INSERT INTO jobs (job_id, source, company, position) VALUES (?, ?, ?, ?)"
    ).run(firstId, "saramin", "Test Company", "Backend Developer");

    const secondId = generateJobId();

    expect(firstId).toBe("JOB-0001");
    expect(secondId).toBe("JOB-0002");
  });

  it("should reject unsupported relative profile directory overrides", async () => {
    const sandboxDir = path.join(TEST_DIR, "cwd-sandbox");
    fs.mkdirSync(sandboxDir, { recursive: true });
    process.chdir(sandboxDir);
    process.env.PROFILE_DIR = "./custom-profile";

    const { writeProfileFile } = await import("@/lib/file-store");

    expect(() => writeProfileFile("profile.yml", "name: tester")).toThrow(
      /PROFILE_DIR/
    );
  });
});

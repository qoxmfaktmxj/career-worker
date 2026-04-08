import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DIR = path.join(__dirname, "../../.test-profile-store");
const ORIGINAL_CWD = process.cwd();

describe("ProfileStore", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PROFILE_DIR = path.join(TEST_DIR, "profile");
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    vi.resetModules();
    process.chdir(ORIGINAL_CWD);
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("writes, reads, and lists managed profile files", async () => {
    const { listProfileFiles, readProfileFile, writeProfileFile } = await import(
      "@/lib/profile-store"
    );

    writeProfileFile("profile.yml", "name: tester");
    writeProfileFile("career_story.md", "# Story");

    expect(readProfileFile("profile.yml")).toContain("tester");
    expect(listProfileFiles().sort()).toEqual(["career_story.md", "profile.yml"]);
  });

  it("rejects unsupported relative profile directory overrides", async () => {
    const sandboxDir = path.join(TEST_DIR, "cwd-sandbox");
    fs.mkdirSync(sandboxDir, { recursive: true });
    process.chdir(sandboxDir);
    process.env.PROFILE_DIR = "./custom-profile";

    const { writeProfileFile } = await import("@/lib/profile-store");

    expect(() => writeProfileFile("profile.yml", "name: tester")).toThrow(
      /PROFILE_DIR/
    );
  });
});

import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DIR = path.join(__dirname, "../../.test-job-content");

describe("job-content", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.JOBS_DIR = path.join(TEST_DIR, "jobs");
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    vi.resetModules();
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("downgrades stale ready metadata when the detail file is missing", async () => {
    const { saveListingJob } = await import("@/lib/file-store");
    const { getJobContent } = await import("@/lib/job-content");

    const listingFile = saveListingJob("JOB-CONTENT-1", "# Listing");
    const content = getJobContent({
      listing_file: listingFile,
      detail_file: "details/JOB-CONTENT-1.md",
      detail_status: "ready",
    });

    expect(content.listingContent).toContain("Listing");
    expect(content.detailContent).toBeNull();
    expect(content.detailStatus).toBe("missing");
    expect(content.aiReady).toBe(false);
  });
});

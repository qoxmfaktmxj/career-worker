import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DB_PATH = path.join(
  __dirname,
  "../../data/test-orchestrator-persistence.db"
);
const TEST_DATA_DIR = path.join(__dirname, "../../data");
const TEST_JOBS_DIR = path.join(__dirname, "../../tmp/orchestrator-persistence/jobs");

const saveListingJobMock = vi.fn();
const saveDetailJobMock = vi.fn();
const saraminScanMock = vi.fn();
const saraminFetchDetailMock = vi.fn();

vi.mock("@/lib/job-file-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/job-file-store")>(
    "@/lib/job-file-store"
  );

  return {
    ...actual,
    saveListingJob: (...args: unknown[]) => saveListingJobMock(...args),
    saveDetailJob: (...args: unknown[]) => saveDetailJobMock(...args),
  };
});

vi.mock("@/scanners/saramin", () => ({
  saraminScanner: {
    name: "saramin",
    scan: (...args: unknown[]) => saraminScanMock(...args),
    fetchDetail: (...args: unknown[]) => saraminFetchDetailMock(...args),
  },
}));

describe("Scan Orchestrator persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    fs.rmSync(path.join(__dirname, "../../tmp/orchestrator-persistence"), {
      recursive: true,
      force: true,
    });

    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.DB_NAME = "test-orchestrator-persistence.db";
    process.env.JOBS_DIR = TEST_JOBS_DIR;
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import("@/lib/db");
      closeDb();
    } catch {
      // ignore cleanup failures
    }

    vi.resetModules();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    fs.rmSync(path.join(__dirname, "../../tmp/orchestrator-persistence"), {
      recursive: true,
      force: true,
    });
  });

  it("rolls back inserted jobs when listing file persistence fails", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    db.prepare("INSERT INTO sources (id, channel, name, config) VALUES (?, ?, ?, ?)")
      .run(1, "saramin", "사람인", JSON.stringify({ keywords: ["java"] }));

    saraminScanMock.mockResolvedValue([
      {
        source: "saramin",
        source_id: "1001",
        company: "Alpha",
        position: "Backend Engineer",
        location: "Seoul",
        employment_type: "Full-time",
        raw_url: "https://example.com/jobs/1001",
        listing_text: "Java Spring",
      },
    ]);
    saveListingJobMock.mockImplementation(() => {
      throw new Error("disk full");
    });

    const { runScan } = await import("@/scanners/orchestrator");

    await expect(
      runScan(
        1,
        "saramin",
        { keywords: ["java"] },
        {
          include_keywords: ["Java"],
          exclude_keywords: [],
          locations: ["Seoul"],
          exclude_company_sizes: [],
          min_employee_count: 0,
          allow_startup: true,
          exclude_entry_only: false,
        }
      )
    ).rejects.toThrow("disk full");

    expect(
      db.prepare("SELECT COUNT(*) as count FROM jobs").get() as { count: number }
    ).toEqual({ count: 0 });
    expect(
      db.prepare("SELECT COUNT(*) as count FROM job_fingerprints").get() as {
        count: number;
      }
    ).toEqual({ count: 0 });
    expect(
      db.prepare("SELECT status FROM scan_runs WHERE source_id = ?").get(1) as {
        status: string;
      }
    ).toEqual({ status: "failed" });
  });

  it("stores detail file path when detail fetch succeeds", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    db.prepare("INSERT INTO sources (id, channel, name, config) VALUES (?, ?, ?, ?)")
      .run(1, "saramin", "사람인", JSON.stringify({ keywords: ["java"] }));

    saraminScanMock.mockResolvedValue([
      {
        source: "saramin",
        source_id: "1002",
        company: "Beta",
        position: "Platform Engineer",
        location: "Seoul",
        employment_type: "Full-time",
        raw_url: "https://example.com/jobs/1002",
        listing_text: "Platform listing summary",
      },
    ]);
    saveListingJobMock.mockReturnValue("listings/JOB-0001.md");
    saveDetailJobMock.mockReturnValue("details/JOB-0001.md");
    saraminFetchDetailMock.mockResolvedValue("# Detail JD\n- Full description");

    const { runScan } = await import("@/scanners/orchestrator");

    await runScan(
      1,
      "saramin",
      { keywords: ["java"] },
      {
        include_keywords: ["Platform"],
        exclude_keywords: [],
        locations: ["Seoul"],
        exclude_company_sizes: [],
        min_employee_count: 0,
        allow_startup: true,
        exclude_entry_only: false,
      }
    );

    const savedJob = db
      .prepare(
        "SELECT listing_file, detail_file, detail_status FROM jobs LIMIT 1"
      )
      .get() as {
      listing_file: string;
      detail_file: string;
      detail_status: string;
    };

    expect(savedJob).toEqual({
      listing_file: "listings/JOB-0001.md",
      detail_file: "details/JOB-0001.md",
      detail_status: "ready",
    });
  });
});

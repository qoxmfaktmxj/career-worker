import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DB_PATH = path.join(
  __dirname,
  "../../data/test-orchestrator-persistence.db"
);
const TEST_DATA_DIR = path.join(__dirname, "../../data");
const TEST_TMP_DIR = path.join(__dirname, "../../tmp/orchestrator-persistence");
const TEST_JOBS_DIR = path.join(TEST_TMP_DIR, "jobs");
const TEST_TIMEOUT_MS = 15000;

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

async function cleanupDbFiles() {
  const sqliteArtifacts = [
    TEST_DB_PATH,
    `${TEST_DB_PATH}-wal`,
    `${TEST_DB_PATH}-shm`,
  ];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let cleanupBlocked = false;

    for (const artifactPath of sqliteArtifacts) {
      if (!fs.existsSync(artifactPath)) {
        continue;
      }

      try {
        fs.unlinkSync(artifactPath);
      } catch {
        cleanupBlocked = true;
      }
    }

    if (!cleanupBlocked) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function cleanupArtifacts() {
  try {
    const { closeDb } = await import("@/lib/db");
    closeDb();
  } catch {
    // Ignore cleanup failures while modules are not loaded yet.
  }

  await cleanupDbFiles();

  fs.rmSync(TEST_TMP_DIR, {
    recursive: true,
    force: true,
  });
}

describe("Scan Orchestrator persistence", () => {
  beforeEach(async () => {
    await cleanupArtifacts();

    vi.resetModules();
    vi.clearAllMocks();

    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.DB_NAME = "test-orchestrator-persistence.db";
    process.env.JOBS_DIR = TEST_JOBS_DIR;
  });

  afterEach(async () => {
    await cleanupArtifacts();
    vi.resetModules();
  });

  it(
    "rolls back inserted jobs when listing file persistence fails",
    async () => {
      const { getDb } = await import("@/lib/db");
      const db = getDb();
      db.prepare(
        "INSERT INTO sources (id, channel, name, config) VALUES (?, ?, ?, ?)"
      ).run(1, "saramin", "Saramin Source", JSON.stringify({ keywords: ["java"] }));

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
    },
    TEST_TIMEOUT_MS
  );

  it(
    "stores detail file path when detail fetch succeeds",
    async () => {
      const { getDb } = await import("@/lib/db");
      const db = getDb();
      db.prepare(
        "INSERT INTO sources (id, channel, name, config) VALUES (?, ?, ?, ?)"
      ).run(1, "saramin", "Saramin Source", JSON.stringify({ keywords: ["java"] }));

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
    },
    TEST_TIMEOUT_MS
  );

  it(
    "persists truncation metadata reported by the scanner",
    async () => {
      const { getDb } = await import("@/lib/db");
      const db = getDb();
      db.prepare(
        "INSERT INTO sources (id, channel, name, config) VALUES (?, ?, ?, ?)"
      ).run(1, "saramin", "Saramin Source", JSON.stringify({ keywords: ["java"] }));

      saraminScanMock.mockResolvedValue({
        results: [
          {
            source: "saramin",
            source_id: "1003",
            company: "Gamma",
            position: "Data Engineer",
            location: "Seoul",
            employment_type: "Full-time",
            raw_url: "https://example.com/jobs/1003",
            listing_text: "Data listing summary",
          },
        ],
        meta: {
          truncated: true,
          page_count: 1,
          fetched_count: 100,
        },
      });
      saveListingJobMock.mockReturnValue("listings/JOB-0002.md");
      saveDetailJobMock.mockReturnValue("details/JOB-0002.md");
      saraminFetchDetailMock.mockResolvedValue("# Detail JD\n- Full description");

      const { runScan } = await import("@/scanners/orchestrator");

      const result = await runScan(
        1,
        "saramin",
        { keywords: ["java"] },
        {
          include_keywords: ["Data"],
          exclude_keywords: [],
          locations: ["Seoul"],
          exclude_company_sizes: [],
          min_employee_count: 0,
          allow_startup: true,
          exclude_entry_only: false,
        }
      );

      expect(result).toMatchObject({
        total_found: 1,
        fetched_count: 100,
        page_count: 1,
        truncated: true,
      });

      const scanRun = db
        .prepare(
          `
            SELECT truncated, page_count, fetched_count
            FROM scan_runs
            WHERE source_id = ?
            ORDER BY id DESC
            LIMIT 1
          `
        )
        .get(1) as {
        truncated: number;
        page_count: number;
        fetched_count: number;
      };

      expect(scanRun).toEqual({
        truncated: 1,
        page_count: 1,
        fetched_count: 100,
      });
    },
    TEST_TIMEOUT_MS
  );
});

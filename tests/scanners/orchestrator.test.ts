import { beforeEach, describe, expect, it } from "vitest";

import type { FilterConfig } from "@/lib/filters";
import { processResults } from "@/scanners/orchestrator";
import type { ScanResult } from "@/scanners/types";

const defaultFilter: FilterConfig = {
  include_keywords: ["Java", "Spring", "Backend"],
  exclude_keywords: ["신입만"],
  locations: ["Seoul", "서울", "경기"],
  exclude_company_sizes: ["small"],
  min_employee_count: 100,
  allow_startup: true,
  exclude_entry_only: true,
};

const mockResults: ScanResult[] = [
  {
    source: "saramin",
    source_id: "111",
    company: "Alpha",
    position: "Java Backend Engineer",
    location: "Seoul Gangnam",
    employment_type: "Full-time",
    raw_url: "https://saramin.co.kr/111",
    listing_text: "Java Spring Boot backend role",
  },
  {
    source: "saramin",
    source_id: "222",
    company: "Beta",
    position: "iOS Engineer",
    location: "Seoul",
    employment_type: "Full-time",
    raw_url: "https://saramin.co.kr/222",
    listing_text: "Swift UIKit iOS role",
  },
];

describe("Scan Orchestrator", () => {
  beforeEach(() => {
    process.env.DATA_DIR = "./data";
    process.env.DB_NAME = "test-orchestrator.db";
    process.env.JOBS_DIR = "./.test-jobs";
  });

  it("separates passed and filtered results", () => {
    const { passed, filtered } = processResults(mockResults, defaultFilter);

    expect(passed).toHaveLength(1);
    expect(passed[0]?.company).toBe("Alpha");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.company).toBe("Beta");
  });
});

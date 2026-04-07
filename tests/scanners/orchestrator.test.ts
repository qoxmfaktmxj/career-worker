import { beforeEach, describe, expect, it } from "vitest";

import type { FilterConfig } from "@/lib/filters";
import { processResults } from "@/scanners/orchestrator";
import type { ScanResult } from "@/scanners/types";

const defaultFilter: FilterConfig = {
  include_keywords: ["Java", "Spring", "백엔드"],
  exclude_keywords: ["신입만"],
  locations: ["서울", "판교", "경기"],
  exclude_company_sizes: ["소기업", "중소기업"],
  min_employee_count: 100,
  allow_startup: true,
  exclude_entry_only: true,
};

const mockResults: ScanResult[] = [
  {
    source: "saramin",
    source_id: "111",
    company: "카카오",
    position: "Java 백엔드 개발자",
    location: "서울 강남구",
    employment_type: "정규직",
    raw_url: "https://saramin.co.kr/111",
    raw_text: "Java Spring Boot 경력 3년",
  },
  {
    source: "saramin",
    source_id: "222",
    company: "iOS회사",
    position: "iOS 개발자",
    location: "서울",
    employment_type: "정규직",
    raw_url: "https://saramin.co.kr/222",
    raw_text: "Swift UIKit iOS 개발",
  },
];

describe("Scan Orchestrator", () => {
  beforeEach(() => {
    process.env.DATA_DIR = "./data";
    process.env.DB_NAME = "test-orchestrator.db";
    process.env.JOBS_DIR = "./.test-jobs";
  });

  it("should separate passed and filtered results", () => {
    const { passed, filtered } = processResults(mockResults, defaultFilter);

    expect(passed).toHaveLength(1);
    expect(passed[0].company).toBe("카카오");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].company).toBe("iOS회사");
  });
});

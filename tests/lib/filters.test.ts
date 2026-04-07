import { describe, expect, it } from "vitest";

import {
  applyFilter,
  type FilterConfig,
  type JobCandidate,
} from "@/lib/filters";

const defaultConfig: FilterConfig = {
  include_keywords: [
    "Java",
    "Spring",
    "백엔드",
    "풀스택",
    "React",
    "AI",
    "AX",
    "DX",
    "디지털전환",
  ],
  exclude_keywords: ["신입만", "신입 한정", "인턴만"],
  locations: ["서울", "판교", "경기", "재택", "원격"],
  exclude_company_sizes: ["소기업", "중소기업"],
  min_employee_count: 100,
  allow_startup: true,
  exclude_entry_only: true,
};

function makeJob(overrides: Partial<JobCandidate> = {}): JobCandidate {
  return {
    position: "백엔드 개발자",
    raw_text: "Java Spring Boot 경력 3년 이상",
    location: "서울 강남구",
    company_size: "대기업",
    employee_count: 500,
    employment_type: "정규직",
    ...overrides,
  };
}

describe("Filter Engine", () => {
  it("should pass job matching include keywords", () => {
    const result = applyFilter(makeJob(), defaultConfig);

    expect(result.passed).toBe(true);
  });

  it("should reject job with no matching keywords", () => {
    const result = applyFilter(
      makeJob({ position: "iOS 개발자", raw_text: "Swift UIKit 개발" }),
      defaultConfig
    );

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("키워드");
  });

  it("should reject 소기업", () => {
    const result = applyFilter(makeJob({ company_size: "소기업" }), defaultConfig);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("기업규모");
  });

  it("should reject 중소기업 under 100 employees", () => {
    const result = applyFilter(
      makeJob({ company_size: "중소기업", employee_count: 50 }),
      defaultConfig
    );

    expect(result.passed).toBe(false);
  });

  it("should pass 스타트업", () => {
    const result = applyFilter(
      makeJob({ company_size: "스타트업", employee_count: 30 }),
      defaultConfig
    );

    expect(result.passed).toBe(true);
  });

  it("should reject 신입만", () => {
    const result = applyFilter(
      makeJob({ raw_text: "Java Spring Boot 신입만 지원 가능" }),
      defaultConfig
    );

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("신입");
  });

  it("should pass 경력/신입 both", () => {
    const result = applyFilter(
      makeJob({ raw_text: "Java 경력/신입 모두 가능" }),
      defaultConfig
    );

    expect(result.passed).toBe(true);
  });

  it("should reject wrong location", () => {
    const result = applyFilter(makeJob({ location: "부산" }), defaultConfig);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("지역");
  });

  it("should pass game + AX keyword combo", () => {
    const result = applyFilter(
      makeJob({ position: "게임 AX 개발자", raw_text: "게임 산업 AI 전환 프로젝트" }),
      defaultConfig
    );

    expect(result.passed).toBe(true);
  });

  it("should reject game without AX/DX keyword", () => {
    const result = applyFilter(
      makeJob({ position: "게임 클라이언트 개발자", raw_text: "Unity C# 게임 개발" }),
      defaultConfig
    );

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("게임");
  });

  it("should pass when company_size is unknown", () => {
    const result = applyFilter(
      makeJob({ company_size: undefined, employee_count: undefined }),
      defaultConfig
    );

    expect(result.passed).toBe(true);
  });
});

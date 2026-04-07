import { describe, expect, it } from "vitest";

import { parseSaraminResponse } from "@/scanners/saramin";

const mockApiResponse = {
  jobs: {
    count: 2,
    job: [
      {
        id: "12345",
        company: { detail: { name: "카카오" } },
        position: {
          title: "백엔드 개발자",
          location: { name: "서울 > 강남구" },
          "job-type": { name: "정규직" },
          "experience-level": { name: "경력 3~5년" },
        },
        "opening-timestamp": 1712448000,
        "expiration-timestamp": 1713052800,
        "close-type": { name: "접수마감일" },
        salary: { name: "면접 후 결정" },
        url: "https://saramin.co.kr/job/12345",
      },
      {
        id: "67890",
        company: { detail: { name: "네이버" } },
        position: {
          title: "AI 플랫폼 엔지니어",
          location: { name: "경기 > 성남시 분당구" },
          "job-type": { name: "정규직" },
          "experience-level": { name: "경력 5년 이상" },
        },
        "opening-timestamp": 1712448000,
        "expiration-timestamp": 1713657600,
        "close-type": { name: "접수마감일" },
        salary: { name: "회사내규에 따름" },
        url: "https://saramin.co.kr/job/67890",
      },
    ],
  },
};

describe("Saramin Scanner", () => {
  it("should parse API response into ScanResult array", () => {
    const results = parseSaraminResponse(mockApiResponse);

    expect(results).toHaveLength(2);
    expect(results[0].company).toBe("카카오");
    expect(results[0].source).toBe("saramin");
    expect(results[0].source_id).toBe("12345");
    expect(results[0].position).toBe("백엔드 개발자");
    expect(results[0].location).toContain("서울");
  });

  it("should handle empty response", () => {
    const results = parseSaraminResponse({ jobs: { count: 0, job: [] } });

    expect(results).toHaveLength(0);
  });
});

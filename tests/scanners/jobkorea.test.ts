import { describe, expect, it } from "vitest";

import { parseJobKoreaHtml } from "@/scanners/jobkorea";

const sampleHtml = `
<div class="list-default">
  <div class="list-item">
    <div class="post-list-info">
      <a href="/Recruit/GI_Read/12345" class="title">
        <span>백엔드 개발자 (Java/Spring)</span>
      </a>
      <a href="/Company/1111" class="name">카카오</a>
    </div>
    <div class="post-list-info-detail">
      <p class="option">
        <span class="exp">경력 3~5년</span>
        <span class="loc">서울 강남구</span>
        <span class="edu">대졸 이상</span>
      </p>
      <p class="date">~04/20(일)</p>
    </div>
  </div>
</div>
`;

describe("JobKorea Scanner", () => {
  it("should parse search result HTML", () => {
    const results = parseJobKoreaHtml(sampleHtml);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].company).toBe("카카오");
    expect(results[0].position).toContain("백엔드");
    expect(results[0].source).toBe("jobkorea");
  });
});

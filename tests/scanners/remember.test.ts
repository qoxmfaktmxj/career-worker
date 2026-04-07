import { describe, expect, it } from "vitest";

import { parseRememberHtml } from "@/scanners/remember";

const sampleHtml = `
<div class="job-card">
  <a href="/jobs/12345" class="job-card-link">
    <h3 class="job-title">풀스택 개발자</h3>
    <p class="company-name">네이버</p>
    <p class="location">서울</p>
    <p class="deadline">~2026.04.20</p>
  </a>
</div>
`;

describe("Remember Scanner", () => {
  it("should parse job listing HTML", () => {
    const results = parseRememberHtml(sampleHtml);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].company).toBe("네이버");
    expect(results[0].source).toBe("remember");
  });
});

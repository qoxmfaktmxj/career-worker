import { describe, expect, it } from "vitest";

import { buildPrompt, parseOpenClawResponse } from "@/lib/openclaw";

describe("OpenClaw Wrapper", () => {
  it("should build prompt from template and variables", () => {
    const template = "다음 JD를 평가하세요:\n\n{{jd}}\n\n내 프로필:\n{{profile}}";
    const vars = { jd: "Java 백엔드 개발자", profile: "3년차 개발자" };

    const result = buildPrompt(template, vars);

    expect(result).toContain("Java 백엔드 개발자");
    expect(result).toContain("3년차 개발자");
    expect(result).not.toContain("{{");
  });

  it("should parse valid JSON response", () => {
    const raw = '{"fit_score": 4.3, "fit_reason": "good match"}';

    const result = parseOpenClawResponse(raw);

    expect(result.success).toBe(true);
    expect(result.data.fit_score).toBe(4.3);
  });

  it("should handle invalid JSON gracefully", () => {
    const raw = "This is not JSON but some text response";

    const result = parseOpenClawResponse(raw);

    expect(result.success).toBe(false);
    expect(result.raw).toBe(raw);
  });

  it("should extract JSON from mixed text response", () => {
    const raw = 'Here is the result:\n```json\n{"fit_score": 3.5}\n```\nDone.';

    const result = parseOpenClawResponse(raw);

    expect(result.success).toBe(true);
    expect(result.data.fit_score).toBe(3.5);
  });
});

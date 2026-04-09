import { describe, expect, it } from "vitest";

describe("scan source config", () => {
  it("rejects invalid saramin location code formats", async () => {
    const { validateScanSourceConfig, ScanSourceConfigError } = await import(
      "@/lib/scan-source-config"
    );

    expect(() =>
      validateScanSourceConfig("saramin", {
        keywords: ["java"],
        location_codes: ["1100A"],
      })
    ).toThrowError(ScanSourceConfigError);

    try {
      validateScanSourceConfig("saramin", {
        keywords: ["java"],
        location_codes: ["1100A"],
      });
    } catch (error) {
      expect((error as { details?: string[] }).details).toEqual([
        "location_codes must contain 5-digit numeric strings",
      ]);
    }
  });

  it("normalizes unsupported fields for jobkorea with warnings", async () => {
    const { validateScanSourceConfig } = await import("@/lib/scan-source-config");

    expect(
      validateScanSourceConfig("jobkorea", {
        keywords: [" react ", "react"],
        location_codes: ["11000"],
        extra_field: "ignored",
      })
    ).toEqual({
      config: {
        keywords: ["react"],
        location_codes: [],
        exclude_keywords: [],
      },
      warnings: [
        "jobkorea ignores location_codes; values were dropped",
        "ignored unsupported config fields: extra_field",
      ],
    });
  });

  it("parses legacy remember config and reports ignored fields", async () => {
    const { parseStoredScanSourceConfig } = await import(
      "@/lib/scan-source-config"
    );

    expect(
      parseStoredScanSourceConfig(
        "remember",
        JSON.stringify({
          keywords: ["node"],
          location_codes: ["11000"],
        })
      )
    ).toEqual({
      config: {
        keywords: ["node"],
        location_codes: [],
        exclude_keywords: [],
      },
      warnings: ["remember ignores location_codes; values were dropped"],
    });
  });
});

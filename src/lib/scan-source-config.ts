import type { ScannerConfig } from "@/scanners/types";

export const SUPPORTED_SCAN_CHANNELS = [
  "saramin",
  "jobkorea",
  "remember",
] as const;

export type SupportedScanChannel = (typeof SUPPORTED_SCAN_CHANNELS)[number];

export class ScanSourceConfigError extends Error {
  readonly details: string[];

  constructor(details: string[]) {
    super("invalid scan source config");
    this.name = "ScanSourceConfigError";
    this.details = details;
  }
}

function normalizeStringArray(
  value: unknown,
  fieldName: string,
  options: { required?: boolean } = {}
): string[] {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new ScanSourceConfigError([`${fieldName} must contain at least one string`]);
    }

    return [];
  }

  if (!Array.isArray(value)) {
    throw new ScanSourceConfigError([`${fieldName} must be an array of strings`]);
  }

  const normalized = value.map((item) => {
    if (typeof item !== "string") {
      throw new ScanSourceConfigError([`${fieldName} must be an array of strings`]);
    }

    return item.trim();
  });
  const filtered = normalized.filter(Boolean);
  const unique = [...new Set(filtered)];

  if (options.required && unique.length === 0) {
    throw new ScanSourceConfigError([`${fieldName} must contain at least one string`]);
  }

  return unique;
}

export function validateScanSourceConfig(input: unknown): ScannerConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ScanSourceConfigError(["config must be an object"]);
  }

  const config = input as Record<string, unknown>;

  return {
    keywords: normalizeStringArray(config.keywords, "keywords", {
      required: true,
    }),
    location_codes: normalizeStringArray(
      config.location_codes,
      "location_codes"
    ),
    exclude_keywords: normalizeStringArray(
      config.exclude_keywords,
      "exclude_keywords"
    ),
  };
}

export function parseStoredScanSourceConfig(rawConfig: string): ScannerConfig {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawConfig);
  } catch {
    throw new ScanSourceConfigError(["config must be valid JSON"]);
  }

  return validateScanSourceConfig(parsed);
}

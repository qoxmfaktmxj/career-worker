import type { ScannerConfig } from "@/scanners/types";

export const SUPPORTED_SCAN_CHANNELS = [
  "saramin",
  "jobkorea",
  "remember",
] as const;

export type SupportedScanChannel = (typeof SUPPORTED_SCAN_CHANNELS)[number];

export interface ScanSourceConfigValidationResult {
  config: ScannerConfig;
  warnings: string[];
}

export class ScanSourceConfigError extends Error {
  readonly details: string[];

  constructor(details: string[]) {
    super("invalid scan source config");
    this.name = "ScanSourceConfigError";
    this.details = details;
  }
}

const SARMIN_LOCATION_CODE_PATTERN = /^\d{5}$/u;
const COMMON_ALLOWED_FIELDS = [
  "keywords",
  "exclude_keywords",
  "location_codes",
] as const;

function supportsLocationCodes(channel: string): boolean {
  return channel === "saramin";
}

function isMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) =>
      typeof item === "string" ? item.trim().length > 0 : item !== null
    );
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

function normalizeStringArray(
  value: unknown,
  fieldName: string,
  options: { required?: boolean } = {}
): string[] {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new ScanSourceConfigError([
        `${fieldName} must contain at least one string`,
      ]);
    }

    return [];
  }

  if (!Array.isArray(value)) {
    throw new ScanSourceConfigError([`${fieldName} must be an array of strings`]);
  }

  const normalized = value.map((item) => {
    if (typeof item !== "string") {
      throw new ScanSourceConfigError([
        `${fieldName} must be an array of strings`,
      ]);
    }

    return item.trim();
  });

  const filtered = normalized.filter(Boolean);
  const unique = [...new Set(filtered)];

  if (options.required && unique.length === 0) {
    throw new ScanSourceConfigError([
      `${fieldName} must contain at least one string`,
    ]);
  }

  return unique;
}

function normalizeSaraminLocationCodes(value: unknown): string[] {
  const locationCodes = normalizeStringArray(value, "location_codes");

  if (
    locationCodes.some((locationCode) => !SARMIN_LOCATION_CODE_PATTERN.test(locationCode))
  ) {
    throw new ScanSourceConfigError([
      "location_codes must contain 5-digit numeric strings",
    ]);
  }

  return locationCodes;
}

function collectUnsupportedFields(input: Record<string, unknown>): string[] {
  const allowedFields = new Set<string>(COMMON_ALLOWED_FIELDS);

  return Object.keys(input)
    .filter((key) => !allowedFields.has(key))
    .sort((left, right) => left.localeCompare(right));
}

export function validateScanSourceConfig(
  channel: string,
  input: unknown
): ScanSourceConfigValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ScanSourceConfigError(["config must be an object"]);
  }

  const rawConfig = input as Record<string, unknown>;
  const warnings: string[] = [];
  const unsupportedFields = collectUnsupportedFields(rawConfig);

  if (unsupportedFields.length > 0) {
    warnings.push(
      `ignored unsupported config fields: ${unsupportedFields.join(", ")}`
    );
  }

  const keywords = normalizeStringArray(rawConfig.keywords, "keywords", {
    required: true,
  });
  const excludeKeywords = normalizeStringArray(
    rawConfig.exclude_keywords,
    "exclude_keywords"
  );

  let locationCodes: string[] = [];

  if (supportsLocationCodes(channel)) {
    locationCodes = normalizeSaraminLocationCodes(rawConfig.location_codes);
  } else if (isMeaningfulValue(rawConfig.location_codes)) {
    warnings.unshift(`${channel} ignores location_codes; values were dropped`);
  }

  return {
    config: {
      keywords,
      location_codes: locationCodes,
      exclude_keywords: excludeKeywords,
    },
    warnings,
  };
}

export function parseStoredScanSourceConfig(
  channel: string,
  rawConfig: string
): ScanSourceConfigValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawConfig);
  } catch {
    throw new ScanSourceConfigError(["config must be valid JSON"]);
  }

  return validateScanSourceConfig(channel, parsed);
}

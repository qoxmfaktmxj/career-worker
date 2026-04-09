import { extractReadableText } from "@/scanners/detail-text";
import type { ScanResult, Scanner, ScannerConfig } from "@/scanners/types";

interface SaraminJob {
  id: string;
  company?: { detail?: { name?: string } };
  position?: {
    title?: string;
    location?: { name?: string };
    "job-type"?: { name?: string };
    "experience-level"?: { name?: string };
  };
  "opening-timestamp"?: number;
  "expiration-timestamp"?: number;
  "close-type"?: { name?: string };
  salary?: { name?: string };
  url?: string;
}

interface SaraminApiResponse {
  jobs?: {
    count?: number;
    job?: SaraminJob[];
  };
}

export function parseSaraminResponse(response: SaraminApiResponse): ScanResult[] {
  const jobs = response.jobs?.job || [];

  return jobs.map((job) => {
    const deadline = job["expiration-timestamp"]
      ? new Date(job["expiration-timestamp"] * 1000).toISOString().split("T")[0]
      : undefined;

    return {
      source: "saramin",
      source_id: job.id,
      company: job.company?.detail?.name || "",
      position: job.position?.title || "",
      location: job.position?.location?.name || "",
      employment_type: job.position?.["job-type"]?.name || "",
      raw_url: job.url || "",
      deadline,
      salary_text: job.salary?.name || "",
      listing_text: [
        job.position?.title,
        job.position?.["experience-level"]?.name,
        job.position?.location?.name,
        job.salary?.name,
      ]
        .filter(Boolean)
        .join("\n"),
      raw_text: [
        job.position?.title,
        job.position?.["experience-level"]?.name,
        job.position?.location?.name,
        job.salary?.name,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  });
}

export const saraminScanner: Scanner = {
  name: "saramin",

  async scan(config: ScannerConfig): Promise<ScanResult[]> {
    const apiKey = process.env.SARAMIN_API_KEY;

    if (!apiKey) {
      throw new Error("SARAMIN_API_KEY not set");
    }

    const params = new URLSearchParams({
      "access-key": apiKey,
      keywords: config.keywords.join(" "),
      count: "100",
      sort: "pd",
    });

    if (config.location_codes.length > 0) {
      params.set("loc_cd", config.location_codes.join(","));
    }

    const response = await fetch(
      `https://oapi.saramin.co.kr/recruit-search?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(
        `Saramin API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as SaraminApiResponse;

    return parseSaraminResponse(data);
  },

  async fetchDetail(result: ScanResult): Promise<string | null> {
    if (!result.raw_url) {
      return null;
    }

    const response = await fetch(result.raw_url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CareerWorker/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Saramin detail fetch error: ${response.status}`);
    }

    const html = await response.text();
    const content = extractReadableText(html);

    return content || null;
  },
};

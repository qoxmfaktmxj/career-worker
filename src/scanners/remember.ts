import * as cheerio from "cheerio";

import { extractReadableText } from "@/scanners/detail-text";
import type {
  ScanResult,
  Scanner,
  ScannerConfig,
  ScannerRunPayload,
} from "@/scanners/types";

export function parseRememberHtml(html: string): ScanResult[] {
  const $ = cheerio.load(html);
  const results: ScanResult[] = [];

  $(".job-card").each((_, element) => {
    const item = $(element);
    const linkElement = item.find("a").first();
    const href = linkElement.attr("href") || "";
    const sourceId = href.match(/jobs\/(\d+)/)?.[1] || "";
    const position = item.find(".job-title").text().trim();
    const company = item.find(".company-name").text().trim();
    const location = item.find(".location").text().trim();
    const deadline = item.find(".deadline").text().trim();

    if (!position || !company) {
      return;
    }

    results.push({
      source: "remember",
      source_id: sourceId,
      company,
      position,
      location,
      employment_type: "",
      raw_url: href.startsWith("http")
        ? href
        : `https://career.rememberapp.co.kr${href}`,
      deadline,
      listing_text: [position, location].filter(Boolean).join("\n"),
      raw_text: [position, location].filter(Boolean).join("\n"),
    });
  });

  return results;
}

export const rememberScanner: Scanner = {
  name: "remember",

  async scan(config: ScannerConfig): Promise<ScannerRunPayload> {
    const keyword = config.keywords.join(" ");
    const url = `https://career.rememberapp.co.kr/search?query=${encodeURIComponent(
      keyword
    )}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CareerWorker/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Remember fetch error: ${response.status}`);
    }

    const html = await response.text();
    const results = parseRememberHtml(html);

    return {
      results,
      meta: {
        // Remember currently fetches only the first search page.
        truncated: results.length > 0,
        page_count: 1,
        fetched_count: results.length,
      },
    };
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
      throw new Error(`Remember detail fetch error: ${response.status}`);
    }

    const html = await response.text();
    const content = extractReadableText(html);

    return content || null;
  },
};

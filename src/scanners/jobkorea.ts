import * as cheerio from "cheerio";

import { extractReadableText } from "@/scanners/detail-text";
import type {
  ScanResult,
  Scanner,
  ScannerConfig,
  ScannerRunPayload,
} from "@/scanners/types";

export function parseJobKoreaHtml(html: string): ScanResult[] {
  const $ = cheerio.load(html);
  const results: ScanResult[] = [];

  $(".list-item").each((_, element) => {
    const item = $(element);
    const titleElement = item.find(".title span").first();
    const companyElement = item.find(".name").first();
    const linkElement = item.find(".title").first();
    const href = linkElement.attr("href") || "";
    const sourceId = href.match(/GI_Read\/(\d+)/)?.[1] || "";
    const position = titleElement.text().trim();
    const company = companyElement.text().trim();
    const location = item.find(".loc").text().trim();
    const experience = item.find(".exp").text().trim();
    const dateText = item.find(".date").text().trim();

    if (!position || !company) {
      return;
    }

    results.push({
      source: "jobkorea",
      source_id: sourceId,
      company,
      position,
      location,
      employment_type: "",
      raw_url: href.startsWith("http")
        ? href
        : `https://www.jobkorea.co.kr${href}`,
      deadline: dateText,
      listing_text: [position, experience, location].filter(Boolean).join("\n"),
      raw_text: [position, experience, location].filter(Boolean).join("\n"),
    });
  });

  return results;
}

export const jobkoreaScanner: Scanner = {
  name: "jobkorea",

  async scan(config: ScannerConfig): Promise<ScannerRunPayload> {
    const keyword = config.keywords.join(" ");
    const url = `https://www.jobkorea.co.kr/Search/?stext=${encodeURIComponent(
      keyword
    )}&tabType=recruit`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CareerWorker/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`JobKorea fetch error: ${response.status}`);
    }

    const html = await response.text();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const results = parseJobKoreaHtml(html);

    return {
      results,
      meta: {
        // JobKorea currently fetches only the first search page.
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
      throw new Error(`JobKorea detail fetch error: ${response.status}`);
    }

    const html = await response.text();
    const content = extractReadableText(html);

    return content || null;
  },
};

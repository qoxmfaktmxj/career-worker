import * as cheerio from "cheerio";

export function extractReadableText(html: string): string {
  const $ = cheerio.load(html);

  $("script, style, noscript").remove();

  const lines = $("body")
    .text()
    .split(/\r?\n/u)
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean);

  return lines.join("\n");
}

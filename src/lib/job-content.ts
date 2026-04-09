import { readStoredJobMarkdown } from "@/lib/job-file-store";

export const JOB_DETAIL_NOT_READY_MESSAGE =
  "\uACF5\uACE0 \uC0C1\uC138 \uBCF8\uBB38\uC774 \uC5C6\uC5B4 AI \uC791\uC5C5\uC744 \uC2E4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";

export class JobDetailNotReadyError extends Error {
  constructor() {
    super("job_detail_not_ready");
    this.name = "JobDetailNotReadyError";
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function safeRead(relativePath: string | null): string | null {
  if (!relativePath) {
    return null;
  }

  try {
    return readStoredJobMarkdown(relativePath);
  } catch {
    return null;
  }
}

export function getJobContent(job: Record<string, unknown>) {
  const listingFile = asString(job.listing_file) ?? asString(job.raw_file);
  const detailFile = asString(job.detail_file);
  const listingContent = safeRead(listingFile);
  const detailContent = safeRead(detailFile);
  const detailStatus =
    asString(job.detail_status) ??
    (detailFile && detailContent ? "ready" : "missing");

  return {
    listingFile,
    detailFile,
    listingContent,
    detailContent,
    detailStatus,
    aiReady: detailStatus === "ready" && Boolean(detailContent),
  };
}

export function requireJobDetailContent(job: Record<string, unknown>): string {
  const { aiReady, detailContent } = getJobContent(job);

  if (!aiReady || !detailContent) {
    throw new JobDetailNotReadyError();
  }

  return detailContent;
}

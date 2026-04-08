import crypto from "crypto";

export function generateJobId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `JOB-${timestamp}-${randomSuffix}`;
}

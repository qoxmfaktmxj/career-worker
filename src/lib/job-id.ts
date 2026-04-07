import { getDb } from "@/lib/db";

export function generateJobId(): string {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as {
    count: number;
  };
  const next = row.count + 1;

  return `JOB-${String(next).padStart(4, "0")}`;
}

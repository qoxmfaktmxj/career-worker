import crypto from "crypto";

import { getDb } from "@/lib/db";

export function verifyPassword(input: string): boolean {
  const storedPassword = process.env.AUTH_PASSWORD;

  if (!storedPassword) {
    return false;
  }

  return input === storedPassword;
}

export function createSession(): string {
  const db = getDb();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  db.prepare("INSERT INTO sessions (id, expires_at) VALUES (?, ?)")
    .run(sessionId, expiresAt);

  return sessionId;
}

export function validateSession(sessionId: string): boolean {
  if (!sessionId) {
    return false;
  }

  const db = getDb();
  const session = db
    .prepare("SELECT id, expires_at FROM sessions WHERE id = ?")
    .get(sessionId) as { id: string; expires_at: string } | undefined;

  if (!session) {
    return false;
  }

  return new Date(session.expires_at) > new Date();
}

export function deleteSession(sessionId: string): void {
  const db = getDb();

  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

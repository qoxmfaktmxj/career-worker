import crypto from "crypto";

import { getDb } from "@/lib/db";

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function pruneExpiredSessions(): void {
  const db = getDb();

  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(
    new Date().toISOString()
  );
}

export function verifyPassword(input: string): boolean {
  const storedPassword = process.env.AUTH_PASSWORD;

  if (!storedPassword) {
    return false;
  }

  const inputBuffer = Buffer.from(input);
  const storedBuffer = Buffer.from(storedPassword);

  if (inputBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, storedBuffer);
}

export function createSession(): string {
  pruneExpiredSessions();

  const db = getDb();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();

  db.prepare("INSERT INTO sessions (id, expires_at) VALUES (?, ?)").run(
    sessionId,
    expiresAt
  );

  return sessionId;
}

export function validateSession(sessionId: string): boolean {
  if (!sessionId) {
    return false;
  }

  pruneExpiredSessions();

  const db = getDb();
  const row = db
    .prepare("SELECT expires_at FROM sessions WHERE id = ?")
    .get(sessionId) as { expires_at: string } | undefined;

  if (!row) {
    return false;
  }

  if (Date.parse(row.expires_at) <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return false;
  }

  return true;
}

export function deleteSession(sessionId: string | null | undefined): void {
  if (!sessionId) {
    return;
  }

  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

import crypto from "crypto";

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TOKEN_VERSION = "v1";

type SessionPayload = {
  exp: number;
  nonce: string;
};

function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();

  return secret ? secret : null;
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(encodedPayload: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<SessionPayload>;

    if (typeof parsed.exp !== "number" || typeof parsed.nonce !== "string") {
      return null;
    }

    return {
      exp: parsed.exp,
      nonce: parsed.nonce,
    };
  } catch {
    return null;
  }
}

function signPayload(encodedPayload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

function isValidSignature(signature: string, expectedSignature: string): boolean {
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function verifyPassword(input: string): boolean {
  const storedPassword = process.env.AUTH_PASSWORD;

  if (!storedPassword) {
    return false;
  }

  return input === storedPassword;
}

export function createSession(): string {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("SESSION_SECRET is required");
  }

  const encodedPayload = encodePayload({
    exp: Date.now() + SESSION_MAX_AGE_MS,
    nonce: crypto.randomUUID(),
  });
  const signature = signPayload(encodedPayload, secret);

  return `${SESSION_TOKEN_VERSION}.${encodedPayload}.${signature}`;
}

export function validateSession(sessionId: string): boolean {
  if (!sessionId) {
    return false;
  }

  const secret = getSessionSecret();

  if (!secret) {
    return false;
  }

  const [version, encodedPayload, signature, ...rest] = sessionId.split(".");

  if (
    version !== SESSION_TOKEN_VERSION ||
    !encodedPayload ||
    !signature ||
    rest.length > 0
  ) {
    return false;
  }

  const expectedSignature = signPayload(encodedPayload, secret);

  if (!isValidSignature(signature, expectedSignature)) {
    return false;
  }

  const payload = decodePayload(encodedPayload);

  if (!payload) {
    return false;
  }

  return payload.exp > Date.now();
}

import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const OPENCLAW_UNAVAILABLE_MESSAGE =
  "OpenClaw CLI\uAC00 \uC124\uCE58\uB418\uC9C0 \uC54A\uC544 AI \uC791\uC5C5\uC744 \uC2E4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";
const OPENCLAW_TIMEOUT_MESSAGE =
  "OpenClaw \uC751\uB2F5 \uC2DC\uAC04\uC774 \uCD08\uACFC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
const OPENCLAW_EXECUTION_FAILED_MESSAGE =
  "OpenClaw \uC2E4\uD589\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.";
const AI_RESPONSE_FAILED_MESSAGE =
  "AI \uC751\uB2F5 \uCC98\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.";

type OpenClawErrorCode =
  | "openclaw_unavailable"
  | "openclaw_timeout"
  | "openclaw_exec_failed";

export interface OpenClawResponse {
  success: boolean;
  data: Record<string, unknown>;
  raw?: string;
  error?: string;
  code?: OpenClawErrorCode;
}

let cachedCommand: string | null = null;
let cachedBinaryPath: string | null | undefined;

function getOpenClawCommand(): string {
  return process.env.OPENCLAW_BIN || "openclaw";
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveExecutableCandidates(command: string): string[] {
  if (
    path.isAbsolute(command) ||
    command.includes("/") ||
    command.includes("\\")
  ) {
    return [path.resolve(command)];
  }

  const pathEntries = (process.env.PATH || "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (process.platform !== "win32") {
    return pathEntries.map((entry) => path.join(entry, command));
  }

  const hasExtension = path.extname(command).length > 0;
  const extensions = hasExtension
    ? [""]
    : (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM")
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean);

  return pathEntries.flatMap((entry) =>
    extensions.map((extension) => path.join(entry, `${command}${extension}`))
  );
}

function resolveOpenClawBinary(): string | null {
  const command = getOpenClawCommand();

  if (cachedBinaryPath !== undefined && cachedCommand === command) {
    return cachedBinaryPath;
  }

  cachedCommand = command;

  for (const candidate of resolveExecutableCandidates(command)) {
    if (fileExists(candidate)) {
      cachedBinaryPath = candidate;
      return cachedBinaryPath;
    }
  }

  cachedBinaryPath = null;
  return cachedBinaryPath;
}

export function isOpenClawAvailable(): boolean {
  return resolveOpenClawBinary() !== null;
}

export function getOpenClawUnavailableMessage(): string {
  return OPENCLAW_UNAVAILABLE_MESSAGE;
}

export function getOpenClawFailure(response: OpenClawResponse): {
  status: number;
  body: Record<string, unknown>;
} {
  if (response.code === "openclaw_unavailable") {
    return {
      status: 503,
      body: {
        error: "openclaw_unavailable",
        message: response.error || OPENCLAW_UNAVAILABLE_MESSAGE,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "ai_request_failed",
      message: response.error || AI_RESPONSE_FAILED_MESSAGE,
      ...(response.raw ? { raw: response.raw } : {}),
    },
  };
}

export function buildPrompt(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}

export function parseOpenClawResponse(raw: string): OpenClawResponse {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    return { success: true, data };
  } catch {
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);

    if (codeBlockMatch) {
      try {
        const data = JSON.parse(codeBlockMatch[1].trim()) as Record<
          string,
          unknown
        >;
        return { success: true, data };
      } catch {
        // Fall through to brace extraction.
      }
    }

    const braceMatch = raw.match(/\{[\s\S]*\}/);

    if (braceMatch) {
      try {
        const data = JSON.parse(braceMatch[0]) as Record<string, unknown>;
        return { success: true, data };
      } catch {
        // Fall through to raw response.
      }
    }

    return { success: false, data: {}, raw };
  }
}

export async function callOpenClaw(
  message: string
): Promise<OpenClawResponse> {
  const timeout = Number.parseInt(process.env.OPENCLAW_TIMEOUT || "60000", 10);
  const binaryPath = resolveOpenClawBinary();

  if (!binaryPath) {
    return {
      success: false,
      data: {},
      code: "openclaw_unavailable",
      error: OPENCLAW_UNAVAILABLE_MESSAGE,
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      binaryPath,
      ["agent", "--message", message, "--json"],
      {
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    if (stderr) {
      console.error("[OpenClaw stderr]", stderr);
    }

    return parseOpenClawResponse(stdout);
  } catch (error: unknown) {
    const execError = error as Error & { killed?: boolean; code?: string };

    if (execError.killed) {
      return {
        success: false,
        data: {},
        code: "openclaw_timeout",
        error: OPENCLAW_TIMEOUT_MESSAGE,
      };
    }

    if (execError.code === "ENOENT") {
      cachedBinaryPath = null;

      return {
        success: false,
        data: {},
        code: "openclaw_unavailable",
        error: OPENCLAW_UNAVAILABLE_MESSAGE,
      };
    }

    return {
      success: false,
      data: {},
      code: "openclaw_exec_failed",
      error: execError.message || execError.code || OPENCLAW_EXECUTION_FAILED_MESSAGE,
    };
  }
}

const ALLOWED_PROMPTS = new Set([
  "evaluate-fit",
  "generate-answer-pack",
  "generate-resume",
  "recruiter-reply",
]);

export function loadPromptTemplate(promptName: string): string {
  if (!ALLOWED_PROMPTS.has(promptName)) {
    throw new Error(`Unknown prompt: ${promptName}`);
  }

  const promptPath = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "src",
    "prompts",
    `${promptName}.md`
  );

  return fs.readFileSync(promptPath, "utf-8");
}

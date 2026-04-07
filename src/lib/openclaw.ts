import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface OpenClawResponse {
  success: boolean;
  data: Record<string, unknown>;
  raw?: string;
  error?: string;
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

  try {
    const { stdout, stderr } = await execFileAsync(
      "openclaw",
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
        error: "OpenClaw 응답 시간 초과",
      };
    }

    return {
      success: false,
      data: {},
      error: execError.message || execError.code || "OpenClaw 실행 실패",
    };
  }
}

export function loadPromptTemplate(promptName: string): string {
  const promptPath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "src",
    "prompts",
    `${promptName}.md`
  );

  return fs.readFileSync(promptPath, "utf-8");
}

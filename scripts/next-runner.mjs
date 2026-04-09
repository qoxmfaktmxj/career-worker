import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = "3010";

function parseArgs(argv) {
  const extras = [];
  let port = process.env.PORT || process.env.npm_config_port || DEFAULT_PORT;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--port" || current === "-p") {
      const next = argv[index + 1];

      if (next) {
        port = next;
        index += 1;
      }

      continue;
    }

    if (current.startsWith("--port=")) {
      port = current.slice("--port=".length);
      continue;
    }

    extras.push(current);
  }

  return { port, extras };
}

const [command, ...rest] = process.argv.slice(2);

if (!command) {
  console.error("Missing Next.js command");
  process.exit(1);
}

const { port, extras } = parseArgs(rest);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const nextBin = path.join(
  currentDir,
  "..",
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);

const child = spawn(
  process.execPath,
  [nextBin, command, "--port", port, ...extras],
  {
    stdio: "inherit",
    env: process.env,
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

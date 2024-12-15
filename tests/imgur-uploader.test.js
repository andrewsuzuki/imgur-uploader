import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const IMGUR_UPLOADER_PATH = path.join(ROOT, "imgur-uploader.js");

async function runCLI(...args) {
  const cli = spawn("node", [IMGUR_UPLOADER_PATH, ...args]);

  const [stdout, stderr, exitCode] = await Promise.all([
    (async () => {
      let stdout = "";
      for await (const chunk of cli.stdout) {
        stdout += chunk;
      }
      return stdout;
    })(),
    (async () => {
      let stderr = "";
      for await (const chunk of cli.stderr) {
        stderr += chunk;
      }
      return stderr;
    })(),
    new Promise((resolve) => cli.on("close", resolve)),
  ]);

  return { stdout, stderr, exitCode };
}

test("CLI prints help message when no arguments are provided", async (_t) => {
  const { stderr, exitCode } = await runCLI();
  assert.equal(exitCode, 1, "Should exit with code 1");
  assert.equal(
    stderr.split("\n")?.[0],
    "@andrewsuzuki/imgur-uploader",
    "First line of help message should be name of NPM package"
  );
});

test("CLI prints error when no image is provided", async (_t) => {
  const { stderr, exitCode } = await runCLI("--client-id=FAKE_CLIENT_ID");
  assert.equal(exitCode, 1, "Should exit with code 1");
  const stderrLines = stderr.split("\n");
  assert.ok(
    stderrLines[stderrLines.length - 2]?.startsWith("Error:"),
    "Should print error message"
  );
});

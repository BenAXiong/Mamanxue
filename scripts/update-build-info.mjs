import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

function resolveCommit() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const timestamp = new Date().toISOString();
const commit = resolveCommit();

const buildInfo = {
  version: commit,
  timestamp,
};

const target = resolve(process.cwd(), "public", "build.json");

await writeFile(target, `${JSON.stringify(buildInfo, null, 2)}\n`, "utf8");

console.log(`[build-info] Wrote build metadata to ${target}`);

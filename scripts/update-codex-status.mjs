#!/usr/bin/env node
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const VALID_STATUSES = new Set(["idle", "working", "finishing"]);

async function main() {
  const status = process.argv[2];

  if (!status || !VALID_STATUSES.has(status)) {
    console.error(
      `Usage: node scripts/update-codex-status.mjs <status> (one of: ${[...VALID_STATUSES].join(", ")})`,
    );
    process.exit(1);
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const targetPath = resolve(__dirname, "..", "src", "codexStatus.ts");

  const contents = `export type CodexStatus = "idle" | "working" | "finishing";\n\nexport const codexStatus: CodexStatus = "${status}";\n\nexport default codexStatus;\n`;

  await fs.writeFile(targetPath, contents, "utf8");
  console.log(`Updated codex status to '${status}'.`);
}

main().catch((error) => {
  console.error("Failed to update codex status", error);
  process.exit(1);
});

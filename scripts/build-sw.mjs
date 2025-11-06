import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { injectManifest } from "workbox-build";

const rootDir = process.cwd();
const distDir = resolve(rootDir, "dist");
const swSrc = resolve(rootDir, "src/pwa/sw.js");
const swDest = resolve(distDir, "sw.js");

await mkdir(distDir, { recursive: true });

const { count, size, warnings } = await injectManifest({
  swSrc,
  swDest,
  globDirectory: distDir,
  globPatterns: [
    "**/*.{html,js,css,ico,png,svg,webp,woff,woff2,json}",
  ],
  globIgnores: [
    "decks/**/*.json",
    "**/*.mp3",
    "build.json",
  ],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
});

warnings.forEach((warning) => {
  console.warn("[workbox] warning:", warning);
});

console.log(
  `[workbox] Precached ${count} files (${(size / 1024).toFixed(1)} KiB) into ${swDest}`,
);

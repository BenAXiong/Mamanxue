import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceSvg = resolve(__dirname, "../src/assets/steart_2.svg");
const outputDir = resolve(__dirname, "../public/icons");
const sizes = [
  { size: 192, filename: "icon-192.png" },
  { size: 512, filename: "icon-512.png" },
];

async function ensureOutputDir() {
  await mkdir(outputDir, { recursive: true });
}

async function generateIcon({ size, filename }) {
  const output = resolve(outputDir, filename);
  await sharp(sourceSvg)
    .resize(size, size, {
      fit: "contain",
      background: { r: 2, g: 6, b: 23, alpha: 0 },
    })
    .png()
    .toFile(output);
  return output;
}

async function run() {
  await ensureOutputDir();
  await Promise.all(sizes.map(generateIcon));
  console.log(
    `Generated ${sizes.length} icons from steart_2.svg into ${outputDir}`,
  );
}

run().catch((error) => {
  console.error("Failed to generate icons", error);
  process.exitCode = 1;
});

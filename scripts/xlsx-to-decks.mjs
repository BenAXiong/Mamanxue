#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import xlsx from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveInput(argPath) {
  if (!argPath) {
    return path.resolve(__dirname, "../public/CSV/Curriculum.xlsx");
  }
  return path.resolve(process.cwd(), argPath);
}

const args = process.argv.slice(2);
let inputArg;
let outputArg;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--input" || arg === "-i") {
    inputArg = args[i + 1];
    i += 1;
  } else if (arg === "--output" || arg === "-o") {
    outputArg = args[i + 1];
    i += 1;
  }
}

const inputPath = resolveInput(inputArg);
const outputDir = outputArg
  ? path.resolve(process.cwd(), outputArg)
  : path.resolve(__dirname, "../public/decks");
const manifestPath = path.join(outputDir, "decksManifest.json");

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

function normalizeString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function parseDeckId(rawDeckNumber) {
  const normalized = normalizeString(rawDeckNumber);
  if (!normalized) {
    return null;
  }
  const numeric = normalized.replace(/^0+/, "") || "0";
  return `1_${numeric}`;
}

function buildCardId(deckId, sentenceNumber, markerValue, index) {
  if (markerValue) {
    return markerValue.replace(/\s+/g, "_");
  }

  const base = Number.isFinite(Number(sentenceNumber))
    ? Number(sentenceNumber)
    : index + 1;
  const padded = String(base).padStart(4, "0");
  return `${deckId}_${padded}`;
}

function toAudioPath(raw) {
  let value = normalizeString(raw);
  if (!value) {
    return "";
  }
  const soundMatch = value.match(/^\[sound:(.+)\]$/i);
  if (soundMatch) {
    value = soundMatch[1].trim();
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.includes("/")) {
    return value;
  }
  return `audio/${value}`;
}

const workbook = xlsx.readFile(inputPath);
const sheet = workbook.Sheets["Anki"];

if (!sheet) {
  console.error("Could not find sheet named 'Anki'.");
  process.exit(1);
}

const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
if (!rows.length) {
  console.error("No rows found in sheet.");
  process.exit(1);
}

let dataRows = rows;
const firstRow = rows[0].map((cell) => normalizeString(cell).toLowerCase());
if (firstRow.includes("fr") || firstRow.includes("french")) {
  dataRows = rows.slice(1);
}

const decks = new Map();

dataRows.forEach((row) => {
  if (!row || row.length === 0) {
    return;
  }

  const fr = normalizeString(row[0]);
  const en = normalizeString(row[1]);
  const audio = toAudioPath(row[2]);
  const audioSlow = toAudioPath(row[3]);
  const notes = normalizeString(row[5]);
  const deckId = parseDeckId(row[6]);
  const sentenceNumber = row[7];
  const markerValue = normalizeString(row[8]);

  if (!deckId) {
    return;
  }

  if (!fr && !en) {
    return;
  }

  if (!decks.has(deckId)) {
    decks.set(deckId, []);
  }

  const cards = decks.get(deckId);
  const cardId = buildCardId(deckId, sentenceNumber, markerValue, cards.length);

  if (!audio) {
    console.warn(
      `Skipping card ${cardId} in deck ${deckId} due to missing audio path.`,
    );
    return;
  }

  const card = {
    id: cardId,
    fr,
    en,
    audio,
    deckId,
  };

  if (audioSlow) {
    card.audio_slow = audioSlow;
  }

  if (notes) {
    card.notes = notes;
  }

  const numericSequence = Number(sentenceNumber);
  if (!Number.isNaN(numericSequence)) {
    card.sequence = numericSequence;
  }

  if (markerValue) {
    card.externalId = markerValue;
  }

  cards.push(card);
});

const deckIds = Array.from(decks.keys()).sort((a, b) => a.localeCompare(b));

const manifest = { decks: deckIds };

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

let totalCards = 0;

deckIds.forEach((deckId) => {
  const cards = decks.get(deckId);
  cards.sort((a, b) => a.id.localeCompare(b.id));

  cards.forEach((card) => {
    if (!card.audio_slow) {
      delete card.audio_slow;
    }
    if (!card.notes) {
      delete card.notes;
    }
  });

  const deckPayload = {
    id: deckId,
    cards,
  };

  const deckPath = path.join(outputDir, `${deckId}.json`);
  fs.writeFileSync(deckPath, `${JSON.stringify(deckPayload, null, 2)}\n`, "utf8");
  totalCards += cards.length;
});

console.log(
  `Processed ${deckIds.length} decks (${totalCards} cards) from ${path.basename(
    inputPath,
  )}`,
);
console.log(`Deck manifest written to ${manifestPath}`);

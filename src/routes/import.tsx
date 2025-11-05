import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import type { Card } from "../db/dexie";
import { db } from "../db/dexie";
import { checkCardAudio } from "../utils/fileCheck";

type MappingField =
  | "id"
  | "fr"
  | "en"
  | "audio"
  | "audio_slow"
  | "tags";

interface CsvData {
  headers: string[];
  rows: string[][];
}

interface FieldMapping {
  id: string | null;
  fr: string | null;
  en: string | null;
  audio: string | null;
  audio_slow: string | null;
  tags: string | null;
}

interface ImportReport {
  added: number;
  updated: number;
  errors: string[];
  missingAudio: string[];
}

interface ManualFormState {
  id: string;
  fr: string;
  en: string;
  audio: string;
  audio_slow: string;
  tags: string;
}

const REQUIRED_FIELDS: MappingField[] = ["id", "fr", "en", "audio"];
const OPTIONAL_FIELDS: MappingField[] = ["audio_slow", "tags"];
const ALL_FIELDS: MappingField[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const FIELD_LABELS: Record<MappingField, string> = {
  id: "ID",
  fr: "French",
  en: "English",
  audio: "Audio",
  audio_slow: "Slow audio",
  tags: "Tags",
};

const STORAGE_PREFIX = "mamanxue_mapping_";
const MAX_PREVIEW_ROWS = 10;
const MAX_MISSING_AUDIO_PREVIEW = 5;

function createEmptyMapping(): FieldMapping {
  return {
    id: null,
    fr: null,
    en: null,
    audio: null,
    audio_slow: null,
    tags: null,
  };
}

function normalizeHeaderKey(value: string): string {
  return value.replace(/[\s_\-]/g, "").toLowerCase();
}

function guessMapping(headers: string[]): FieldMapping {
  const mapping = createEmptyMapping();
  const used = new Set<string>();

  const normalized = headers.map((header) => ({
    header,
    key: normalizeHeaderKey(header),
  }));

  const assign = (field: MappingField, candidates: string[]) => {
    if (mapping[field]) {
      return;
    }

    const match = normalized.find(
      (entry) =>
        !used.has(entry.header) &&
        candidates.some(
          (candidate) =>
            entry.key === candidate || entry.key.includes(candidate),
        ),
    );

    if (match) {
      mapping[field] = match.header;
      used.add(match.header);
    }
  };

  assign("id", ["id", "cardid"]);
  assign("fr", ["fr", "french"]);
  assign("en", ["en", "english"]);
  assign("audio", ["audio", "audiofile", "audiopath"]);
  assign("audio_slow", ["audioslow", "slowaudio"]);
  assign("tags", ["tags", "topics", "labels"]);

  return mapping;
}

function computeHeaderSignature(headers: string[]): string {
  const normalised = headers.map((header) => header.trim().toLowerCase());
  const joined = normalised.join("|");
  let hash = 0;

  for (let i = 0; i < joined.length; i += 1) {
    const charCode = joined.charCodeAt(i);
    hash = (hash << 5) - hash + charCode;
    hash |= 0;
  }

  return `h${Math.abs(hash)}`;
}

function parseCsv(text: string): CsvData {
  let index = 0;
  let field = "";
  let inQuotes = false;
  const rows: string[][] = [];
  let currentRow: string[] = [];

  const input = text.replace(/^\ufeff/, "");

  while (index < input.length) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 2;
        continue;
      }

      inQuotes = !inQuotes;
      index += 1;
      continue;
    }

    const isLineBreak = char === "\n" || char === "\r";

    if (!inQuotes && (char === "," || isLineBreak)) {
      currentRow.push(field);
      field = "";

      if (isLineBreak) {
        if (char === "\r" && nextChar === "\n") {
          index += 1;
        }

        rows.push(currentRow);
        currentRow = [];
      }

      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  currentRow.push(field);
  rows.push(currentRow);

  while (
    rows.length > 0 &&
    rows[rows.length - 1].every((cell) => cell.trim() === "")
  ) {
    rows.pop();
  }

  if (inQuotes) {
    throw new Error("Malformed CSV: unmatched quote detected.");
  }

  if (!rows.length) {
    throw new Error("CSV file is empty.");
  }

  const headerRow = rows.shift();

  if (!headerRow) {
    throw new Error("CSV header row is missing.");
  }

  const headers = headerRow.map((header) => header.trim());

  const normalisedRows = rows.map((row) => {
    const cells = [...row];
    while (cells.length < headers.length) {
      cells.push("");
    }
    if (cells.length > headers.length) {
      cells.length = headers.length;
    }
    return cells;
  });

  return { headers, rows: normalisedRows };
}
function computeMappingIndices(
  headers: string[],
  mapping: FieldMapping,
): Record<MappingField, number | null> {
  const indexMap: Record<MappingField, number | null> = {
    id: null,
    fr: null,
    en: null,
    audio: null,
    audio_slow: null,
    tags: null,
  };

  const headerMap = new Map<string, number>();
  headers.forEach((header, idx) => {
    headerMap.set(header, idx);
  });

  for (const field of ALL_FIELDS) {
    const header = mapping[field];
    indexMap[field] =
      header && headerMap.has(header) ? headerMap.get(header) ?? null : null;
  }

  return indexMap;
}

function getCell(row: string[], index: number | null): string {
  if (index === null || index === undefined) {
    return "";
  }
  return (row[index] ?? "").trim();
}

function parseTags(input: string): string[] | undefined {
  if (!input) {
    return undefined;
  }

  const tags = input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.length ? tags : undefined;
}

function extractCardFromRow(
  row: string[],
  indices: Record<MappingField, number | null>,
  rowNumber: number,
  strict: boolean,
): { card?: Card; errors: string[] } {
  const errors: string[] = [];

  const id = getCell(row, indices.id);
  const fr = getCell(row, indices.fr);
  const en = getCell(row, indices.en);
  const audio = getCell(row, indices.audio);
  const audioSlow = getCell(row, indices.audio_slow);
  const tagsInput = getCell(row, indices.tags);

  if (strict) {
    if (!id) {
      errors.push(`Row ${rowNumber}: missing id`);
    }
    if (!fr) {
      errors.push(`Row ${rowNumber}: missing fr`);
    }
    if (!en) {
      errors.push(`Row ${rowNumber}: missing en`);
    }
    if (!audio) {
      errors.push(`Row ${rowNumber}: missing audio`);
    }
  }

  if (errors.length) {
    return { errors };
  }

  const card: Card = {
    id,
    fr,
    en,
    audio,
  };

  if (audioSlow) {
    card.audio_slow = audioSlow;
  }

  const tags = parseTags(tagsInput);
  if (tags) {
    card.tags = tags;
  }

  return { card, errors };
}

function mapCsvToCards(
  csv: CsvData,
  mapping: FieldMapping,
): { cards: Card[]; errors: string[] } {
  const indices = computeMappingIndices(csv.headers, mapping);
  const cards: Card[] = [];
  const errors: string[] = [];

  csv.rows.forEach((row, idx) => {
    const { card, errors: rowErrors } = extractCardFromRow(
      row,
      indices,
      idx + 2,
      true,
    );

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }

    if (card) {
      cards.push(card);
    }
  });

  return { cards, errors };
}

function buildPreviewRows(
  csv: CsvData,
  mapping: FieldMapping,
): Partial<Card>[] {
  const indices = computeMappingIndices(csv.headers, mapping);
  const rows: Partial<Card>[] = [];

  for (let i = 0; i < Math.min(csv.rows.length, MAX_PREVIEW_ROWS); i += 1) {
    const row = csv.rows[i];
    const { card } = extractCardFromRow(row, indices, i + 2, false);
    if (card) {
      rows.push(card);
    } else {
      rows.push({
        id: getCell(row, indices.id),
        fr: getCell(row, indices.fr),
        en: getCell(row, indices.en),
        audio: getCell(row, indices.audio),
        audio_slow: getCell(row, indices.audio_slow),
        tags: parseTags(getCell(row, indices.tags)),
      });
    }
  }

  return rows;
}
function saveMappingPreset(
  signature: string,
  mapping: FieldMapping,
  headers: string[],
) {
  const stored: FieldMapping = createEmptyMapping();

  for (const field of ALL_FIELDS) {
    const header = mapping[field];
    stored[field] = header && headers.includes(header) ? header : null;
  }

  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${signature}`,
      JSON.stringify(stored),
    );
  } catch (error) {
    console.warn("Failed to persist mapping preset", error);
  }
}

function loadMappingPreset(
  signature: string,
  headers: string[],
): FieldMapping | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${signature}`);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<FieldMapping>;
    const mapping = createEmptyMapping();

    for (const field of ALL_FIELDS) {
      const header = parsed[field];
      mapping[field] = header && headers.includes(header) ? header : null;
    }

    return mapping;
  } catch (error) {
    console.warn("Failed to load mapping preset", error);
    return null;
  }
}

function deriveDriveDownloadUrl(url: string): string {
  const match = url.match(/https:\/\/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (!match) {
    return url;
  }
  return `https://drive.google.com/uc?export=download&id=${match[1]}`;
}

function downloadJson(data: unknown, filename: string) {
  const payload = JSON.stringify(data, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const initialManualForm: ManualFormState = {
  id: "",
  fr: "",
  en: "",
  audio: "",
  audio_slow: "",
  tags: "",
};
export function ImportExportPage() {
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>(createEmptyMapping());
  const [mappingKey, setMappingKey] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsStatus, setSheetsStatus] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [driveStatus, setDriveStatus] = useState<string | null>(null);
  const [manualForm, setManualForm] =
    useState<ManualFormState>(initialManualForm);
  const [manualStatus, setManualStatus] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [exportDeckId, setExportDeckId] = useState("");
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const mappingComplete = useMemo(
    () => REQUIRED_FIELDS.every((field) => Boolean(mapping[field])),
    [mapping],
  );

  const previewRows = useMemo(() => {
    if (!csvData || !mappingComplete) {
      return [];
    }
    return buildPreviewRows(csvData, mapping);
  }, [csvData, mapping, mappingComplete]);

  const visibleFields = useMemo(() => {
    const fields: MappingField[] = [...REQUIRED_FIELDS];
    OPTIONAL_FIELDS.forEach((field) => {
      if (mapping[field]) {
        fields.push(field);
      }
    });
    return fields;
  }, [mapping]);

  useEffect(() => {
    if (!csvData) {
      setMapping(createEmptyMapping());
      setMappingKey(null);
      return;
    }

    const signature = computeHeaderSignature(csvData.headers);
    setMappingKey(signature);

    const preset = loadMappingPreset(signature, csvData.headers);

    if (preset) {
      setMapping(preset);
    } else {
      setMapping(guessMapping(csvData.headers));
    }
  }, [csvData]);

  const resetCsvState = useCallback(() => {
    setCsvData(null);
    setSourceName(null);
    setMapping(createEmptyMapping());
    setMappingKey(null);
    setImportReport(null);
    setCsvError(null);
  }, []);

  const loadCsvFromText = useCallback(
    (text: string, sourceLabel: string) => {
      try {
        const parsed = parseCsv(text);
        setCsvData(parsed);
        setSourceName(sourceLabel);
        setImportReport(null);
        setCsvError(null);
      } catch (error) {
        resetCsvState();
        setCsvError(
          error instanceof Error ? error.message : "Failed to parse CSV file.",
        );
      }
    },
    [resetCsvState],
  );

  const handleFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const text = await file.text();
      loadCsvFromText(text, file.name);
      event.target.value = "";
    },
    [loadCsvFromText],
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file) {
        return;
      }
      const text = await file.text();
      loadCsvFromText(text, file.name);
    },
    [loadCsvFromText],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleMappingChange = useCallback(
    (field: MappingField, value: string) => {
      setMapping((previous) => {
        const next = { ...previous };
        const nextValue = value === "" ? null : value;

        if (nextValue) {
          for (const key of ALL_FIELDS) {
            if (key !== field && next[key] === nextValue) {
              next[key] = null;
            }
          }
        }

        next[field] = nextValue;
        return next;
      });
    },
    [],
  );

  const handleClear = useCallback(() => {
    resetCsvState();
  }, [resetCsvState]);
  const handleImport = useCallback(async () => {
    if (!csvData) {
      setImportReport({
        added: 0,
        updated: 0,
        errors: ["Load a CSV file before importing."],
        missingAudio: [],
      });
      return;
    }

    if (!mappingComplete) {
      setImportReport({
        added: 0,
        updated: 0,
        errors: ["Map all required fields before importing."],
        missingAudio: [],
      });
      return;
    }

    setImporting(true);
    setImportReport(null);

    try {
      const { cards, errors } = mapCsvToCards(csvData, mapping);

      if (errors.length) {
        setImportReport({
          added: 0,
          updated: 0,
          errors,
          missingAudio: [],
        });
        return;
      }

      const ids = cards.map((card) => card.id);
      let added = 0;
      let updated = 0;

      await db.transaction("rw", db.cards, async () => {
        const existing = await db.cards.bulkGet(ids);

        for (let index = 0; index < cards.length; index += 1) {
          if (existing[index]) {
            updated += 1;
          } else {
            added += 1;
          }
          await db.cards.put(cards[index]);
        }
      });

      const missingAudioSet = new Set<string>();

      for (const card of cards) {
        const result = await checkCardAudio(card);
        if (result.audio === false) {
          missingAudioSet.add(card.audio);
        }
        if (card.audio_slow && result.audioSlow === false) {
          missingAudioSet.add(card.audio_slow);
        }
      }

      const missingAudio = Array.from(missingAudioSet);

      setImportReport({
        added,
        updated,
        errors: [],
        missingAudio,
      });

      if (mappingKey) {
        saveMappingPreset(mappingKey, mapping, csvData.headers);
      }
    } catch (error) {
      setImportReport({
        added: 0,
        updated: 0,
        errors: [
          error instanceof Error
            ? error.message
            : "Unexpected error during import.",
        ],
        missingAudio: [],
      });
    } finally {
      setImporting(false);
    }
  }, [csvData, mapping, mappingComplete, mappingKey]);

  const handleSheetsFetch = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!sheetsUrl.trim()) {
        setSheetsStatus("Enter a published Google Sheets CSV URL.");
        return;
      }

      setSheetsStatus("Fetching CSV...");

      try {
        const response = await fetch(sheetsUrl.trim());

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const text = await response.text();
        loadCsvFromText(text, "Google Sheets CSV");
        setSheetsStatus("CSV loaded. Mapping ready below.");
      } catch (error) {
        setSheetsStatus(
          `Unable to fetch CSV (${error instanceof Error ? error.message : "Network error"}). Ensure the sheet is published to the web.`,
        );
      }
    },
    [sheetsUrl, loadCsvFromText],
  );

  const handleDriveFetch = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!driveUrl.trim()) {
        setDriveStatus("Paste a Google Drive share link first.");
        return;
      }

      setDriveStatus("Attempting to download CSV...");
      const directUrl = deriveDriveDownloadUrl(driveUrl.trim());

      try {
        const response = await fetch(directUrl);

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const text = await response.text();
        loadCsvFromText(text, "Google Drive CSV");
        setDriveStatus("CSV loaded. Mapping ready below.");
      } catch (error) {
        setDriveStatus(
          `Download blocked (${error instanceof Error ? error.message : "Network error"}). Download manually and use the file picker if CORS persists.`,
        );
      }
    },
    [driveUrl, loadCsvFromText],
  );
  const handleManualChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      setManualForm((previous) => ({
        ...previous,
        [name]: value,
      }));
    },
    [],
  );

  const handleManualGenerateId = useCallback(() => {
    const id = `card_${Date.now()}`;
    setManualForm((previous) => ({
      ...previous,
      id,
    }));
  }, []);

  const handleManualSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const { id, fr, en, audio, audio_slow, tags } = manualForm;

      if (!id.trim() || !fr.trim() || !en.trim() || !audio.trim()) {
        setManualStatus("All required fields must be filled in.");
        return;
      }

      setManualSaving(true);
      setManualStatus(null);

      try {
        const card: Card = {
          id: id.trim(),
          fr: fr.trim(),
          en: en.trim(),
          audio: audio.trim(),
        };

        if (audio_slow.trim()) {
          card.audio_slow = audio_slow.trim();
        }

        const parsedTags = parseTags(tags);
        if (parsedTags) {
          card.tags = parsedTags;
        }

        await db.cards.put(card);
        setManualStatus("Card saved.");
      } catch (error) {
        setManualStatus(
          error instanceof Error ? error.message : "Failed to save card.",
        );
      } finally {
        setManualSaving(false);
      }
    },
    [manualForm],
  );
  const handleExportDeck = useCallback(async () => {
    const deckId = exportDeckId.trim();

    if (!deckId) {
      setExportStatus("Enter a deck identifier first.");
      return;
    }

    try {
      const cards = await db.cards.where("id").startsWith(deckId).toArray();

      if (!cards.length) {
        setExportStatus(`No cards found for deck "${deckId}".`);
        return;
      }

      downloadJson({ id: deckId, cards }, `mamanxue_deck_${deckId}.json`);
      setExportStatus(`Exported ${cards.length} cards for deck "${deckId}".`);
    } catch (error) {
      setExportStatus(
        error instanceof Error
          ? error.message
          : "Failed to export deck cards.",
      );
    }
  }, [exportDeckId]);

  const handleExportProgress = useCallback(async () => {
    const deckId = exportDeckId.trim();

    if (!deckId) {
      setExportStatus("Enter a deck identifier first.");
      return;
    }

    try {
      const reviews = await db.reviews
        .where("cardId")
        .startsWith(deckId)
        .toArray();

      if (!reviews.length) {
        setExportStatus(`No progress found for deck "${deckId}".`);
        return;
      }

      downloadJson(
        { deckId, reviews },
        `mamanxue_progress_${deckId}.json`,
      );
      setExportStatus(
        `Exported ${reviews.length} review records for deck "${deckId}".`,
      );
    } catch (error) {
      setExportStatus(
        error instanceof Error
          ? error.message
          : "Failed to export review progress.",
      );
    }
  }, [exportDeckId]);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 py-10">
      <header className="px-4">
        <h1 className="text-3xl font-semibold text-white">Import / Export</h1>
        <p className="mt-1 text-sm text-slate-400">
          Bring decks into Dexie, add single cards, and export study data for
          backup.
        </p>
      </header>

      <section className="mx-4 space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-white">CSV import</h2>
          <p className="text-sm text-slate-400">
            Drop a CSV file or fetch one from Google Sheets / Drive, map columns
            to fields, and upsert cards.
          </p>
        </header>

        <div
          className="flex flex-col gap-4 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-300"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <p className="font-medium text-slate-200">
            Choose a CSV file to import
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleFileSelect}
              />
              Select file
            </label>
            <span className="text-xs text-slate-500">
              ...or drag & drop a CSV anywhere inside this card.
            </span>
          </div>
          {sourceName ? (
            <p className="text-xs text-slate-400">
              Loaded from: <span className="font-medium">{sourceName}</span>
            </p>
          ) : null}
          {csvData ? (
            <button
              type="button"
              onClick={handleClear}
              className="self-start text-xs text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
            >
              Clear current CSV
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <form
            onSubmit={handleSheetsFetch}
            className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-4"
          >
            <label className="text-sm font-medium text-slate-200">
              Google Sheets (CSV URL)
            </label>
            <input
              type="url"
              value={sheetsUrl}
              onChange={(event) => setSheetsUrl(event.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <div className="text-xs text-slate-500">
              Tip: File → Share →{" "}
              <span className="font-medium text-slate-300">
                Publish to the web
              </span>{" "}
              → CSV; sharing alone does not bypass CORS.
            </div>
            <button
              type="submit"
              className="mt-1 inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              Fetch CSV
            </button>
            {sheetsStatus ? (
              <p className="text-xs text-slate-400">{sheetsStatus}</p>
            ) : null}
          </form>

          <form
            onSubmit={handleDriveFetch}
            className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-4"
          >
            <label className="text-sm font-medium text-slate-200">
              Google Drive share link
            </label>
            <input
              type="url"
              value={driveUrl}
              onChange={(event) => setDriveUrl(event.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <div className="text-xs text-slate-500">
              We turn it into a direct download link automatically. If the
              download is blocked by CORS, download manually and use the file
              picker above.
            </div>
            <button
              type="submit"
              className="mt-1 inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              Try fetch
            </button>
            {driveStatus ? (
              <p className="text-xs text-slate-400">{driveStatus}</p>
            ) : null}
          </form>
        </div>

        {csvError ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {csvError}
          </div>
        ) : null}

        {csvData ? (
          <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              {ALL_FIELDS.map((field) => (
                <label
                  key={field}
                  className="flex flex-col gap-1 text-sm text-slate-200"
                >
                  <span className="font-medium">
                    {FIELD_LABELS[field]}
                    {REQUIRED_FIELDS.includes(field) ? (
                      <span className="ml-1 text-xs text-blue-400">required</span>
                    ) : null}
                  </span>
                  <select
                    value={mapping[field] ?? ""}
                    onChange={(event) =>
                      handleMappingChange(field, event.target.value)
                    }
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">
                      {REQUIRED_FIELDS.includes(field)
                        ? "Select column..."
                        : "None"}
                    </option>
                    {csvData.headers.map((header) => (
                      <option key={header} value={header}>
                        {header || "(empty header)"}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            {mappingComplete ? (
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
                  <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      {visibleFields.map((field) => (
                        <th key={field} className="px-3 py-2">
                          {FIELD_LABELS[field]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr
                        key={`preview-${index}`}
                        className="odd:bg-slate-900/40 even:bg-slate-900/20"
                      >
                        {visibleFields.map((field) => {
                          const value = row[field as keyof Card];
                          let rendered: string | undefined;

                          if (Array.isArray(value)) {
                            rendered = value.join(", ");
                          } else if (typeof value === "string") {
                            rendered = value;
                          } else {
                            rendered = value ?? "";
                          }

                          return (
                            <td key={`${field}-${index}`} className="px-3 py-2">
                              {rendered}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-slate-500">
                  Showing first {previewRows.length} rows.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Map all required fields to view the preview table and enable
                import.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleImport}
                disabled={!mappingComplete || importing}
                className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition enabled:hover:bg-blue-500 enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-offset-2 enabled:focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700/80 disabled:text-slate-400"
              >
                {importing ? "Importing..." : "Import into Dexie"}
              </button>
              <p className="text-xs text-slate-500">
                Required fields: ID, FR, EN, Audio
              </p>
            </div>

            {importReport ? (
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">
                    Import report
                  </h3>
                  <button
                    type="button"
                    onClick={() => setImportReport(null)}
                    className="text-xs text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="text-slate-300">
                  Added{" "}
                  <span className="font-semibold text-white">
                    {importReport.added}
                  </span>{" "}
                  cards · Updated{" "}
                  <span className="font-semibold text-white">
                    {importReport.updated}
                  </span>
                </p>

                {importReport.errors.length ? (
                  <div className="space-y-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-100">
                    <p className="font-semibold uppercase tracking-wide">
                      Errors
                    </p>
                    <ul className="space-y-1">
                      {importReport.errors.slice(0, 5).map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {importReport.missingAudio.length ? (
                  <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                    <p className="font-semibold uppercase tracking-wide">
                      Missing audio
                    </p>
                    <ul className="space-y-1">
                      {importReport.missingAudio
                        .slice(0, MAX_MISSING_AUDIO_PREVIEW)
                        .map((path) => (
                          <li key={path}>{path}</li>
                        ))}
                    </ul>
                    {importReport.missingAudio.length >
                    MAX_MISSING_AUDIO_PREVIEW ? (
                      <p>
                        ...and{" "}
                        {importReport.missingAudio.length -
                          MAX_MISSING_AUDIO_PREVIEW}{" "}
                        more.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mx-4 space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Manual add</h2>
          <p className="text-sm text-slate-400">
            Quick form to upsert a single card. Paths should point to your
            public assets.
          </p>
        </header>
        <form
          onSubmit={handleManualSubmit}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="flex flex-col gap-1 text-sm text-slate-200">
            <label htmlFor="manual-id" className="font-medium">
              ID
            </label>
            <div className="flex gap-2">
              <input
                id="manual-id"
                name="id"
                value={manualForm.id}
                onChange={handleManualChange}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="1_1_0002"
              />
              <button
                type="button"
                onClick={handleManualGenerateId}
                className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
              >
                Auto
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="font-medium">Audio</span>
            <input
              name="audio"
              value={manualForm.audio}
              onChange={handleManualChange}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="audio/1_1/00002.mp3"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="font-medium">French (FR)</span>
            <textarea
              name="fr"
              value={manualForm.fr}
              onChange={handleManualChange}
              className="min-h-20 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="J'ai invit\u00e9 un ami"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="font-medium">English (EN)</span>
            <textarea
              name="en"
              value={manualForm.en}
              onChange={handleManualChange}
              className="min-h-20 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="I have invited a friend"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="font-medium">Slow audio (optional)</span>
            <input
              name="audio_slow"
              value={manualForm.audio_slow}
              onChange={handleManualChange}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="audio/1_1/00002_slow.mp3"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="font-medium">Tags (comma separated)</span>
            <input
              name="tags"
              value={manualForm.tags}
              onChange={handleManualChange}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="greeting, informal"
            />
          </label>

          <div className="md:col-span-2 flex items-center justify-between">
            <button
              type="submit"
              disabled={manualSaving}
              className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition enabled:hover:bg-blue-500 enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-offset-2 enabled:focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700/80 disabled:text-slate-400"
            >
              {manualSaving ? "Saving..." : "Save card"}
            </button>
            {manualStatus ? (
              <p className="text-xs text-slate-400">{manualStatus}</p>
            ) : null}
          </div>
        </form>
      </section>

      <section className="mx-4 space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Export</h2>
          <p className="text-sm text-slate-400">
            Download deck cards and review progress as JSON for backups or data
            transfer.
          </p>
        </header>

        <div className="flex flex-col gap-3 text-sm text-slate-200">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Deck identifier</span>
            <input
              value={exportDeckId}
              onChange={(event) => setExportDeckId(event.target.value)}
              placeholder="1_1"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportDeck}
              className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              Export deck JSON
            </button>
            <button
              type="button"
              onClick={handleExportProgress}
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-800 px-4 text-sm font-semibold text-slate-200 shadow-sm transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              Export progress JSON
            </button>
          </div>

          {exportStatus ? (
            <p className="text-xs text-slate-400">{exportStatus}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default ImportExportPage;

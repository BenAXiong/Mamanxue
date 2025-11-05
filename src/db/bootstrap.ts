import { importDeckFromPublic } from "./seed";
import { db } from "./dexie";

const FIRST_RUN_FLAG = "mamanxue:firstRunDone:v1";

export interface BootstrapResult {
  imported: boolean;
  decks: Array<{ deckId: string; cards: number }>;
  errors: Array<{ deckId: string; error: string }>;
}

interface DeckManifest {
  decks?: string[];
}

function markBootstrapComplete() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(FIRST_RUN_FLAG, "true");
}

function isBootstrapComplete(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(FIRST_RUN_FLAG) === "true";
}

async function fetchManifest(): Promise<DeckManifest | null> {
  try {
    const response = await fetch("/decks/decksManifest.json", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.error("Failed to fetch decks manifest", response.statusText);
      return null;
    }

    return (await response.json()) as DeckManifest;
  } catch (error) {
    console.error("Error fetching decks manifest", error);
    return null;
  }
}

export async function firstRunBootstrap(): Promise<BootstrapResult> {
  if (typeof window === "undefined" || isBootstrapComplete()) {
    return { imported: false, decks: [], errors: [] };
  }

  const manifest = await fetchManifest();

  if (!manifest || !Array.isArray(manifest.decks) || manifest.decks.length === 0) {
    console.warn("No decks defined in manifest; skipping bootstrap.");
    markBootstrapComplete();
    return { imported: false, decks: [], errors: [] };
  }

  const decks: Array<{ deckId: string; cards: number }> = [];
  const errors: Array<{ deckId: string; error: string }> = [];

  for (const deckId of manifest.decks) {
    try {
      const count = await importDeckFromPublic(deckId);
      decks.push({ deckId, cards: count });
    } catch (error) {
      console.error(`Failed to import deck ${deckId}`, error);
      errors.push({
        deckId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  markBootstrapComplete();

  return { imported: true, decks, errors };
}

export async function resetFirstRun(): Promise<void> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(FIRST_RUN_FLAG);
  }

  await db.transaction("rw", db.cards, db.reviews, async () => {
    await db.cards.clear();
    await db.reviews.clear();
  });
}

import type { Card } from "./dexie";
import { db } from "./dexie";

interface DeckPayload {
  id: string;
  cards: Partial<Card>[];
}

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

function normalizeAudioPath(path: string, deckId: string): string {
  const trimmed = path.trim();

  if (ABSOLUTE_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const withoutLeadingSlash = trimmed.startsWith("/")
    ? trimmed.slice(1)
    : trimmed;

  if (withoutLeadingSlash.includes("/")) {
    return withoutLeadingSlash;
  }

  return `audio/${deckId}/${withoutLeadingSlash}`;
}

function assertValidCard(card: Partial<Card>): asserts card is Card {
  if (
    !card.id ||
    typeof card.id !== "string" ||
    !card.fr ||
    typeof card.fr !== "string" ||
    !card.en ||
    typeof card.en !== "string" ||
    !card.audio ||
    typeof card.audio !== "string"
  ) {
    const identifier = card.id ?? "unknown";
    throw new Error(`Invalid card: ${identifier}`);
  }

  if (
    card.audio_slow !== undefined &&
    card.audio_slow !== null &&
    typeof card.audio_slow !== "string"
  ) {
    const identifier = card.id ?? "unknown";
    throw new Error(`Invalid slow audio for card: ${identifier}`);
  }
}

export async function importDeckFromPublic(deckId: string): Promise<number> {
  const response = await fetch(`/decks/${deckId}.json`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to load deck: ${deckId}`);
  }

  const payload = (await response.json()) as DeckPayload;

  if (
    !payload ||
    Array.isArray(payload) ||
    !("cards" in payload) ||
    !Array.isArray(payload.cards)
  ) {
    throw new Error(`Invalid deck payload: ${deckId}`);
  }

  if (payload.id && payload.id !== deckId) {
    console.warn(
      `Deck identifier mismatch. Expected "${deckId}" but received "${payload.id}".`,
    );
  }

  const cards = payload.cards;

  return db.transaction("rw", db.cards, async () => {
    for (const card of cards) {
      assertValidCard(card);
      const normalizedCard: Card = {
        ...card,
        audio: normalizeAudioPath(card.audio, deckId),
        audio_slow: card.audio_slow
          ? normalizeAudioPath(card.audio_slow, deckId)
          : undefined,
      };
      await db.cards.put(normalizedCard);
    }
    return cards.length;
  });
}

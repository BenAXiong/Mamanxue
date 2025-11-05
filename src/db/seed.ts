import type { Card } from "./dexie";
import { db } from "./dexie";

interface DeckPayload {
  id: string;
  cards: Partial<Card>[];
}

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

function normalizeAudioPath(path: string, deckId: string): string {
  const safePath = typeof path === "string" ? path.trim() : "";

  if (!safePath) {
    return "";
  }

  if (ABSOLUTE_URL_PATTERN.test(safePath)) {
    return safePath;
  }

  const withoutLeadingSlash = safePath.startsWith("/")
    ? safePath.slice(1)
    : safePath;

  if (withoutLeadingSlash.includes("/")) {
    return withoutLeadingSlash;
  }

  return `audio/${deckId}/${withoutLeadingSlash}`;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertValidCard(card: Partial<Card>): asserts card is Card {
  if (!isString(card.id) || !isString(card.fr) || !isString(card.en)) {
    const identifier = isString(card.id) ? card.id : "unknown";
    throw new Error(`Invalid card payload: ${identifier}`);
  }

  if (!isString(card.audio)) {
    throw new Error(`Invalid audio for card: ${card.id}`);
  }

  if (
    card.audio_slow !== undefined &&
    card.audio_slow !== null &&
    typeof card.audio_slow !== "string"
  ) {
    throw new Error(`Invalid slow audio for card: ${card.id}`);
  }

  if (card.notes !== undefined && card.notes !== null && typeof card.notes !== "string") {
    throw new Error(`Invalid notes for card: ${card.id}`);
  }

  if (card.tags !== undefined && !Array.isArray(card.tags)) {
    throw new Error(`Invalid tags for card: ${card.id}`);
  }

  if (card.tags && card.tags.some((tag) => typeof tag !== "string")) {
    throw new Error(`Invalid tag value for card: ${card.id}`);
  }

  if (
    card.sequence !== undefined &&
    card.sequence !== null &&
    Number.isNaN(Number(card.sequence))
  ) {
    throw new Error(`Invalid sequence for card: ${card.id}`);
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
      const targetDeckId = isString(card.deckId) ? card.deckId : deckId;
      const normalizedCard: Card = {
        id: card.id,
        deckId: targetDeckId,
        fr: card.fr,
        en: card.en,
        audio: normalizeAudioPath(card.audio, targetDeckId),
        audio_slow: card.audio_slow
          ? normalizeAudioPath(card.audio_slow, targetDeckId)
          : undefined,
        notes: isString(card.notes) ? card.notes : undefined,
        tags: Array.isArray(card.tags) && card.tags.length ? card.tags : undefined,
        sequence:
          card.sequence !== undefined && card.sequence !== null
            ? Number(card.sequence)
            : undefined,
        externalId:
          typeof card.externalId === "string" && card.externalId.trim().length
            ? card.externalId.trim()
            : undefined,
      };
      await db.cards.put(normalizedCard);
    }
    return cards.length;
  });
}

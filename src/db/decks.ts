import { db, type Card } from "./dexie";
import { checkCardAudio } from "../utils/fileCheck";

export interface DeckAggregation {
  deckId: string;
  title?: string;
  total: number;
  dueToday: number;
  hardCount: number;
  newCount: number;
  suspended: number;
  missingAudio: number;
}

const END_OF_DAY_ISO = () => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
};

async function countMissingAudio(cards: Card[]): Promise<number> {
  const checks: number[] = await Promise.all(
    cards.map(async (card) => {
      try {
        const result = await checkCardAudio(card);
        if (!result.audio) {
          return 1 as number;
        }
        if (card.audio_slow && result.audioSlow === false) {
          return 1 as number;
        }
        return 0;
      } catch (error) {
        console.error("Audio check failed", card.id, error);
        return 1;
      }
    }),
  );

  return checks.reduce((sum: number, value) => sum + value, 0);
}

export async function listDecks(): Promise<DeckAggregation[]> {
  const cards = await db.cards.toArray();
  const decks = new Map<string, Card[]>();

  for (const card of cards) {
    if (!decks.has(card.deckId)) {
      decks.set(card.deckId, []);
    }
    decks.get(card.deckId)!.push(card);
  }

  const endOfTodayISO = END_OF_DAY_ISO();

  const aggregations: DeckAggregation[] = [];

  await Promise.all(
    Array.from(decks.entries()).map(async ([deckId, deckCards]) => {
      const cardIds = deckCards.map((card) => card.id);
      const reviews = cardIds.length
        ? await db.reviews.where("cardId").anyOf(cardIds).toArray()
        : [];

      const suspendedIds = new Set(
        reviews.filter((review) => review.suspended).map((review) => review.cardId),
      );
      const suspended = suspendedIds.size;
      const dueToday = reviews.filter(
        (review) => !review.suspended && review.due <= endOfTodayISO,
      ).length;
      const hardCount = reviews.filter(
        (review) => !review.suspended && review.hardFlag,
      ).length;
      const reviewedIds = new Set(reviews.map((review) => review.cardId));
      const newCount = deckCards.filter(
        (card) => !reviewedIds.has(card.id) && !suspendedIds.has(card.id),
      ).length;

      const missingAudio = await countMissingAudio(deckCards);

      aggregations.push({
        deckId,
        total: deckCards.length,
        dueToday,
        hardCount,
        newCount,
        suspended,
        missingAudio,
      });
    }),
  );

  return aggregations.sort((a, b) => a.deckId.localeCompare(b.deckId));
}

export async function renameDeck(oldId: string, newId: string): Promise<void> {
  const trimmed = newId.trim();

  if (!trimmed) {
    throw new Error("Deck ID cannot be empty.");
  }

  if (trimmed === oldId) {
    return;
  }

  await db.transaction("rw", db.cards, db.reviews, db.logs, async () => {
    const existingCount = await db.cards.where("deckId").equals(oldId).count();

    if (existingCount === 0) {
      throw new Error(`Deck '${oldId}' was not found.`);
    }

    const conflict = await db.cards.where("deckId").equals(trimmed).count();
    if (conflict > 0) {
      throw new Error(`Deck '${trimmed}' already exists.`);
    }

    await db.cards
      .where("deckId")
      .equals(oldId)
      .modify((record) => {
        record.deckId = trimmed;
      });

    await db.logs
      .where("deckId")
      .equals(oldId)
      .modify((record) => {
        record.deckId = trimmed;
      });
  });
}

export async function deleteDeck(deckId: string): Promise<void> {
  await db.transaction("rw", db.cards, db.reviews, db.logs, async () => {
    const cardIds = (await db.cards.where("deckId").equals(deckId).primaryKeys()) as string[];

    if (cardIds.length === 0) {
      return;
    }

    await db.cards.where("deckId").equals(deckId).delete();
    await db.reviews.where("cardId").anyOf(cardIds).delete();
    await db.logs.where("deckId").equals(deckId).delete();
  });
}

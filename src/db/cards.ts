import { db, type Card, type ReviewState } from "./dexie";
import { checkCardAudio } from "../utils/fileCheck";
import { createInitialReviewState } from "../store/srs";

export interface DeckCardDetail {
  card: Card;
  review?: ReviewState;
  missingAudio: boolean;
  missingSlowAudio: boolean;
}

export async function getDeckCards(deckId: string): Promise<DeckCardDetail[]> {
  const cards = await db.cards.where("deckId").equals(deckId).toArray();
  const cardIds = cards.map((card) => card.id);

  const reviews = cardIds.length
    ? await db.reviews.where("cardId").anyOf(cardIds).toArray()
    : [];
  const reviewMap = new Map<string, ReviewState>(
    reviews.map((review) => [review.cardId, review]),
  );

  const details: DeckCardDetail[] = await Promise.all(
    cards.map(async (card) => {
      let missingAudio = false;
      let missingSlowAudio = false;

      try {
        const result = await checkCardAudio(card);
        missingAudio = result.audio === false;
        if (card.audio_slow) {
          missingSlowAudio = result.audioSlow === false;
        }
      } catch (error) {
        console.error("Failed to check audio for", card.id, error);
        missingAudio = true;
        if (card.audio_slow) {
          missingSlowAudio = true;
        }
      }

      return {
        card,
        review: reviewMap.get(card.id),
        missingAudio,
        missingSlowAudio,
      };
    }),
  );

  return details.sort((a, b) => {
    if (a.card.sequence !== undefined && b.card.sequence !== undefined) {
      return a.card.sequence - b.card.sequence;
    }
    if (a.card.sequence !== undefined) {
      return -1;
    }
    if (b.card.sequence !== undefined) {
      return 1;
    }
    return a.card.id.localeCompare(b.card.id);
  });
}

function sanitizeReviewForFlag(
  review: ReviewState | undefined,
  cardId: string,
): ReviewState {
  if (review) {
    return { ...review };
  }
  return createInitialReviewState(cardId);
}

export async function setCardSuspended(
  cardId: string,
  suspended: boolean,
): Promise<void> {
  await db.transaction("rw", db.reviews, async () => {
    const existing = await db.reviews.get(cardId);
    const review = sanitizeReviewForFlag(existing, cardId);

    if (suspended) {
      review.suspended = true;
    } else if (review.suspended) {
      delete review.suspended;
    }

    await db.reviews.put(review);
  });
}

export async function setCardHardFlag(
  cardId: string,
  hardFlag: boolean,
): Promise<void> {
  await db.transaction("rw", db.reviews, async () => {
    const existing = await db.reviews.get(cardId);
    const review = sanitizeReviewForFlag(existing, cardId);

    if (hardFlag) {
      review.hardFlag = true;
    } else if (review.hardFlag) {
      delete review.hardFlag;
    }

    await db.reviews.put(review);
  });
}

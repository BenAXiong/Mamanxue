import { db, type ReviewState } from "./dexie";

export async function getReview(cardId: string): Promise<ReviewState | undefined> {
  if (!cardId) {
    return undefined;
  }
  return db.reviews.get(cardId) ?? undefined;
}

export async function putReview(review: ReviewState): Promise<void> {
  await db.reviews.put(review);
}

export async function getDueReviewsByDeck(
  deckId: string,
  beforeISO: string,
): Promise<ReviewState[]> {
  const cardIds = await db.cards.where("deckId").equals(deckId).primaryKeys();

  if (!cardIds.length) {
    return [];
  }

  const dueReviews = await db.reviews
    .where("cardId")
    .anyOf(cardIds)
    .and((review) => !review.suspended && review.due <= beforeISO)
    .toArray();

  return dueReviews.sort((a, b) => a.due.localeCompare(b.due));
}

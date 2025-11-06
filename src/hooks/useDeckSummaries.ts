import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import type { Card } from "../db/dexie";
import { db, deriveDeckIdFromId } from "../db/dexie";
import { checkCardAudio } from "../utils/fileCheck";

export interface DeckSummary {
  deckId: string;
  count: number;
  missingAudio: string[];
}

export function useDeckSummaries(): DeckSummary[] {
  const [summaries, setSummaries] = useState<DeckSummary[]>([]);

  useEffect(() => {
    let subscription: { unsubscribe(): void } | null = null;
    let cancelled = false;

    const start = () => {
      subscription = liveQuery(() => db.cards.toArray()).subscribe({
        next: (cards) => {
          const grouped = groupByDeck(cards);
          const baseSummaries = grouped.map(([deckId, deckCards]) => ({
            deckId,
            count: deckCards.length,
            missingAudio: [],
            cards: deckCards,
          }));

          const sortedBase = baseSummaries
            .map(({ deckId, count }) => ({
              deckId,
              count,
              missingAudio: [] as string[],
            }))
            .sort((a, b) => a.deckId.localeCompare(b.deckId));

          setSummaries(sortedBase);

          (async () => {
            const detailed = await Promise.all(
              baseSummaries.map(async ({ deckId, count, cards: deckCards }) => {
                const missing = new Set<string>();
                for (const card of deckCards) {
                  try {
                    const result = await checkCardAudio(card);
                    if (result.audio === false) {
                      missing.add(card.audio);
                    }
                    if (result.audioSlow === false && card.audio_slow) {
                      missing.add(card.audio_slow);
                    }
                  } catch (error) {
                    console.error("Audio check failed", error);
                  }
                }
                return {
                  deckId,
                  count,
                  missingAudio: Array.from(missing.values()),
                } satisfies DeckSummary;
              }),
            );

            if (!cancelled) {
              setSummaries(
                detailed.sort((a, b) => a.deckId.localeCompare(b.deckId)),
              );
            }
          })();
        },
        error: (error) => {
          console.error("Failed to subscribe to deck summaries", error);
        },
      });
    };

    start();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  return summaries;
}

function groupByDeck(cards: Card[]): Array<[string, Card[]]> {
  const map = new Map<string, Card[]>();

  cards.forEach((card) => {
    const deckId = card.deckId || deriveDeckIdFromId(card.id) || "unknown";
    if (!map.has(deckId)) {
      map.set(deckId, []);
    }
    map.get(deckId)!.push(card);
  });

  return Array.from(map.entries());
}

import Dexie, { type Table } from "dexie";

export interface Card {
  id: string;
  deckId: string;
  fr: string;
  en: string;
  audio: string;
  audio_slow?: string;
  notes?: string;
  tags?: string[];
  sequence?: number;
  externalId?: string;
}

export interface ReviewState {
  cardId: string;
  interval: number;
  due: string;
  ease: number;
  streak: number;
  lapses: number;
  suspended?: boolean;
  hardFlag?: boolean;
}

export function deriveDeckIdFromId(id?: string): string | undefined {
  if (!id) {
    return undefined;
  }
  const match = id.match(/^(\d+_\d+)/);
  if (match) {
    return match[1];
  }
  const hyphen = id.match(/^(\d+_\d+)-/);
  if (hyphen) {
    return hyphen[1];
  }
  return undefined;
}

export class MamanXueDB extends Dexie {
  cards!: Table<Card, string>;
  reviews!: Table<ReviewState, string>;

  constructor() {
    super("MamanXueDB");
    this.version(1).stores({
      cards: "id,audio",
      reviews: "cardId,due",
    });
    this.version(2)
      .stores({
        cards: "id,deckId,audio",
        reviews: "cardId,due",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table("cards")
          .toCollection()
          .modify((record: any) => {
            if (!record.deckId) {
              const nextDeckId = deriveDeckIdFromId(record.id);
              if (nextDeckId) {
                record.deckId = nextDeckId;
              }
            }
          });
      });
  }
}

export const db = new MamanXueDB();

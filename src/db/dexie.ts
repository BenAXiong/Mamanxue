import Dexie, { type Table } from "dexie";

export interface Card {
  id: string;
  fr: string;
  en: string;
  audio: string;
  audio_slow?: string;
  tags?: string[];
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

export class MamanXueDB extends Dexie {
  cards!: Table<Card, string>;
  reviews!: Table<ReviewState, string>;

  constructor() {
    super("MamanXueDB");
    this.version(1).stores({
      cards: "id,audio",
      reviews: "cardId,due",
    });
  }
}

export const db = new MamanXueDB();

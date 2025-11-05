import { create } from "zustand";
import { NEW_CARD_LIMIT } from "../config";
import { db } from "../db/dexie";
import { getDueReviewsByDeck } from "../db/reviews";
import { nowISO } from "./srs";

export type SessionMode = "input" | "output";

export interface GradeResult {
  cardId: string;
  grade?: 1 | 2 | 3;
  hardFlag?: boolean;
}

export interface SessionState {
  mode: SessionMode;
  currentCardId: string | null;
  queue: string[];
  loading: boolean;
  deckId: string | null;
  revealed: boolean;
  hardQueue: string[];
  setMode: (mode: SessionMode) => void;
  setDeck: (deckId: string | null) => void;
  loadQueueForToday: (deckId: string) => Promise<void>;
  reveal: () => void;
  nextCard: (result?: GradeResult) => void;
  resetSession: () => void;
}

export const LAST_REVIEWED_DECK_KEY = "mamanxue:lastDeckId";

function persistLastDeck(deckId: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (deckId) {
    window.localStorage.setItem(LAST_REVIEWED_DECK_KEY, deckId);
  } else {
    window.localStorage.removeItem(LAST_REVIEWED_DECK_KEY);
  }
}

const initialState: Pick<
  SessionState,
  "mode" | "currentCardId" | "queue" | "loading" | "deckId" | "revealed" | "hardQueue"
> = {
  mode: "input",
  currentCardId: null,
  queue: [],
  loading: false,
  deckId: null,
  revealed: false,
  hardQueue: [],
};

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,
  setMode: (mode) => {
    set({ mode });
  },
  setDeck: (deckId) => {
    if (deckId === get().deckId) {
      return;
    }
    set({
      deckId,
      queue: [],
      currentCardId: null,
      revealed: false,
      hardQueue: [],
      loading: false,
    });
    persistLastDeck(deckId);
  },
  loadQueueForToday: async (deckId) => {
    set({
      loading: true,
      deckId,
      queue: [],
      currentCardId: null,
      revealed: false,
      hardQueue: [],
    });

    try {
      const now = nowISO();
      const dueReviews = await getDueReviewsByDeck(deckId, now);
      const dueIds = dueReviews.map((review) => review.cardId);

      const deckCards = await db.cards.where("deckId").equals(deckId).toArray();
      deckCards.sort((a, b) => {
        if (a.sequence !== undefined && b.sequence !== undefined) {
          return a.sequence - b.sequence;
        }
        if (a.sequence !== undefined) {
          return -1;
        }
        if (b.sequence !== undefined) {
          return 1;
        }
        return a.id.localeCompare(b.id);
      });

      const deckCardIds = deckCards.map((card) => card.id);
      const existingReviews = deckCardIds.length
        ? await db.reviews.where("cardId").anyOf(deckCardIds).toArray()
        : [];
      const suspendedIds = new Set(existingReviews.filter((review) => review.suspended).map((review) => review.cardId));
      const reviewedIds = new Set(existingReviews.map((review) => review.cardId));

      const newCardIds = deckCards
        .filter((card) => !reviewedIds.has(card.id) && !suspendedIds.has(card.id))
        .map((card) => card.id)
        .slice(0, NEW_CARD_LIMIT);

      const combinedQueue = [...dueIds, ...newCardIds].filter((cardId, index, list) => {
        if (suspendedIds.has(cardId)) {
          return false;
        }
        return list.indexOf(cardId) === index;
      });

      set({
        deckId,
        queue: combinedQueue,
        currentCardId: combinedQueue[0] ?? null,
        loading: false,
        revealed: false,
        hardQueue: [],
      });
      persistLastDeck(deckId);
    } catch (error) {
      console.error("Failed to load queue for deck", deckId, error);
      set({
        loading: false,
        queue: [],
        currentCardId: null,
        revealed: false,
        hardQueue: [],
      });
      throw error;
    }
  },
  reveal: () => {
    set({ revealed: true });
  },
  nextCard: (result) => {
    set((state) => {
      const activeId = result?.cardId ?? state.currentCardId;
      if (!activeId) {
        return {
          ...state,
          revealed: false,
        };
      }

      const remainingQueue = state.queue.filter((id) => id !== activeId);
      let nextHardQueue = state.hardQueue.filter((id) => id !== activeId);

      if (result?.grade === 2 || result?.hardFlag) {
        if (!nextHardQueue.includes(activeId)) {
          nextHardQueue = [...nextHardQueue, activeId];
        }
      }

      let nextQueue = remainingQueue;

      if (!nextQueue.length && nextHardQueue.length) {
        nextQueue = [...nextHardQueue];
        nextHardQueue = [];
      }

      return {
        ...state,
        queue: nextQueue,
        currentCardId: nextQueue[0] ?? null,
        revealed: false,
        hardQueue: nextHardQueue,
      };
    });
  },
  resetSession: () => {
    set({ ...initialState });
    persistLastDeck(null);
  },
}));

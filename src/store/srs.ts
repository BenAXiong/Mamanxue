import type { ReviewState } from "../db/dexie";

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const HARD_INTERVAL_FACTOR = 1.2;

function clampEase(value: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, Number.isFinite(value) ? value : DEFAULT_EASE));
}

function addDays(iso: string, days: number): string {
  const base = new Date(iso);
  base.setUTCDate(base.getUTCDate() + Math.max(0, Math.trunc(days)));
  return base.toISOString();
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function isDue(review: ReviewState, now: string = nowISO()): boolean {
  if (review.suspended) {
    return false;
  }
  return review.due <= now;
}

export interface ScheduleContext {
  cardId?: string;
  now?: string;
}

export function scheduleNext(
  previous: ReviewState | undefined,
  grade: 1 | 2 | 3,
  context: ScheduleContext = {},
): ReviewState {
  const currentTime = context.now ?? nowISO();
  const initialCardId = previous?.cardId ?? context.cardId;

  if (!initialCardId) {
    throw new Error("scheduleNext requires a cardId when no previous review state is provided.");
  }

  const base: ReviewState =
    previous ?? createInitialReviewState(initialCardId, currentTime);

  let ease = base.ease;
  let interval = base.interval;
  let streak = base.streak;
  let lapses = base.lapses;
  const isInitial = !previous;

  switch (grade) {
    case 1: {
      ease = clampEase(ease - 0.3);
      interval = 0;
      streak = 0;
      lapses += 1;
      break;
    }
    case 2: {
      ease = clampEase(ease - 0.15);
      if (isInitial) {
        interval = 1;
        streak = 1;
      } else {
        const priorInterval = interval > 0 ? interval : 1;
        interval = Math.max(1, Math.round(priorInterval * HARD_INTERVAL_FACTOR));
        streak = Math.max(1, streak);
      }
      break;
    }
    case 3: {
      ease = clampEase(ease + 0.15);
      const priorInterval = interval > 0 ? interval : 1;
      interval = isInitial
        ? 1
        : Math.max(1, Math.round(priorInterval * ease));
      streak += 1;
      break;
    }
    default: {
      const exhaustiveCheck: never = grade;
      return exhaustiveCheck;
    }
  }

  return {
    ...base,
    cardId: initialCardId,
    ease,
    interval,
    streak,
    lapses,
    due: grade === 1 ? currentTime : addDays(currentTime, interval),
  };
}

export function createInitialReviewState(
  cardId: string,
  now: string = nowISO(),
): ReviewState {
  return {
    cardId,
    interval: 0,
    due: now,
    ease: DEFAULT_EASE,
    streak: 0,
    lapses: 0,
  };
}

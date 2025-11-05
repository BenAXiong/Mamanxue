import { describe, expect, it } from "vitest";
import type { ReviewState } from "../db/dexie";
import { isDue, nowISO, scheduleNext } from "./srs";

describe("SRS helpers", () => {
  it("nowISO returns an ISO string", () => {
    const value = nowISO();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("isDue respects due date and suspended flag", () => {
    const base: ReviewState = {
      cardId: "card-1",
      interval: 2,
      due: "2025-01-02T12:00:00.000Z",
      ease: 2.5,
      streak: 3,
      lapses: 0,
    };

    expect(isDue(base, "2025-01-01T12:00:00.000Z")).toBe(false);
    expect(isDue(base, "2025-01-02T12:00:00.000Z")).toBe(true);
    expect(isDue({ ...base, suspended: true }, "2025-01-10T00:00:00.000Z")).toBe(false);
  });

  it("schedules review progression for 3 -> 3 -> 2 -> 1 sequence", () => {
    const cardId = "card-123";

    const first = scheduleNext(undefined, 3, {
      cardId,
      now: "2025-01-01T08:00:00.000Z",
    });
    expect(first.cardId).toBe(cardId);
    expect(first.interval).toBe(1);
    expect(first.streak).toBe(1);
    expect(first.ease).toBeCloseTo(2.65, 2);
    expect(first.due).toBe("2025-01-02T08:00:00.000Z");

    const second = scheduleNext(first, 3, { now: "2025-01-02T09:00:00.000Z" });
    expect(second.interval).toBe(3);
    expect(second.streak).toBe(2);
    expect(second.ease).toBeCloseTo(2.8, 2);
    expect(second.due).toBe("2025-01-05T09:00:00.000Z");

    const third = scheduleNext(second, 2, { now: "2025-01-05T10:00:00.000Z" });
    expect(third.interval).toBe(4);
    expect(third.streak).toBe(2);
    expect(third.ease).toBeCloseTo(2.65, 2);
    expect(third.due).toBe("2025-01-09T10:00:00.000Z");

    const fourth = scheduleNext(third, 1, { now: "2025-01-09T11:00:00.000Z" });
    expect(fourth.interval).toBe(0);
    expect(fourth.streak).toBe(0);
    expect(fourth.ease).toBeCloseTo(2.35, 2);
    expect(fourth.lapses).toBe(1);
    expect(fourth.due).toBe("2025-01-09T11:00:00.000Z");
  });

  it("clamps ease values between 1.3 and 3.0", () => {
    const cardId = "card-clamp";
    let state = scheduleNext(undefined, 3, {
      cardId,
      now: "2025-02-01T00:00:00.000Z",
    });

    for (let i = 0; i < 10; i += 1) {
      state = scheduleNext(state, 3, {
        now: state.due,
      });
    }

    expect(state.ease).toBeLessThanOrEqual(3);

    for (let i = 0; i < 10; i += 1) {
      state = scheduleNext(state, 1, {
        now: state.due,
      });
    }

    expect(state.ease).toBeGreaterThanOrEqual(1.3);
  });
});

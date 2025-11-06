import { db } from "./dexie";

export interface StreakStats {
  todayReviewed: number;
  streak: number;
  lastReviewed: string | null;
  dailyCounts: Array<{ date: string; count: number }>;
}

export async function getReviewStats(): Promise<StreakStats> {
  const now = new Date();
  const todayISO = now.toISOString();

  let todayReviewed = 0;
  let lastReviewed: string | null = null;

  const logs = await db.logs.toArray();
  for (const entry of logs) {
    if (!entry.when) continue;
    if (!lastReviewed || entry.when > lastReviewed) {
      lastReviewed = entry.when;
    }
    if (entry.when.slice(0, 10) === todayISO.slice(0, 10)) {
      todayReviewed += 1;
    }
  }

  logs.sort((a, b) => a.when.localeCompare(b.when));

  const countsByDate = new Map<string, number>();
  for (const entry of logs) {
    const dateKey = entry.when.slice(0, 10);
    countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
  }

  const dailyCounts: Array<{ date: string; count: number }> = [];
  for (let i = 0; i < 14; i += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - (13 - i));
    const key = date.toISOString().slice(0, 10);
    dailyCounts.push({ date: key, count: countsByDate.get(key) ?? 0 });
  }

  let streak = 0;
  for (let i = 0; i < dailyCounts.length; i += 1) {
    const { count } = dailyCounts[dailyCounts.length - 1 - i];
    if (count > 0) {
      streak += 1;
    } else if (i === 0) {
      break;
    } else {
      break;
    }
  }

  return {
    todayReviewed,
    lastReviewed,
    streak,
    dailyCounts,
  };
}

export interface DueForecastEntry {
  date: string;
  count: number;
}

export async function getDueForecast(days = 7): Promise<DueForecastEntry[]> {
  const forecast: DueForecastEntry[] = [];
  const today = new Date();

  const allReviews = await db.reviews.toArray();

  for (let i = 0; i < days; i += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const startISO = new Date(date);
    startISO.setHours(0, 0, 0, 0);
    const endISO = new Date(date);
    endISO.setHours(23, 59, 59, 999);

    const startKey = startISO.toISOString();
    const endKey = endISO.toISOString();

    const count = allReviews.filter((review) => {
      if (review.suspended) {
        return false;
      }
      return review.due >= startKey && review.due <= endKey;
    }).length;

    forecast.push({ date: startISO.toISOString().slice(0, 10), count });
  }

  return forecast;
}

import { useEffect, useState } from "react";
import { getDueForecast, getReviewStats } from "../db/stats";

interface StatsState {
  todayReviewed: number;
  streak: number;
  dueForecast: Awaited<ReturnType<typeof getDueForecast>>;
}

export function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsState | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        setLoading(true);
        const reviewStats = await getReviewStats();
        const forecast = await getDueForecast(7);
        setStats({
          todayReviewed: reviewStats.todayReviewed,
          streak: reviewStats.streak,
          dueForecast: forecast,
        });
      } catch (cause) {
        console.error("Failed to load stats", cause);
        setError(cause instanceof Error ? cause.message : "Unable to load statistics.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6 pb-28">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Stats</h1>
        <p className="text-xs-muted">
          Daily progress, streaks, and the next seven days of reviews.
        </p>
      </header>

      <section className="card space-y-4 p-4">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Today at a glance</h2>
          {loading ? (
            <span className="text-xs-muted">Loading…</span>
          ) : error ? (
            <span className="text-xs text-red-300">{error}</span>
          ) : null}
        </header>

        {stats ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="surface p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Reviewed today</p>
              <p className="text-2xl font-semibold text-white">
                {formatCount(stats.todayReviewed)}
              </p>
            </div>
            <div className="surface p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Active streak</p>
              <p className="text-2xl font-semibold text-white">
                {formatCount(stats.streak)} day{stats.streak === 1 ? "" : "s"}
              </p>
            </div>
            <div className="surface space-y-2 p-4">
              <p className="text-xs uppercase tracking-wide text-muted">7-day forecast</p>
              <div className="flex flex-wrap gap-2 text-xs text-secondary">
                {stats.dueForecast.map((entry) => (
                  <span key={entry.date} className="glass px-2 py-1">
                    <span className="block text-emerald-300">{formatCount(entry.count)}</span>
                    <span className="block text-xs-muted">{entry.date.slice(5)}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export default StatsPage;

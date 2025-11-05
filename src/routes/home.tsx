import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeckSummaries } from "../hooks/useDeckSummaries";
import {
  deleteDeck,
  listDecks,
  renameDeck,
  type DeckAggregation,
} from "../db/decks";
import { getDueForecast, getReviewStats } from "../db/stats";
import { LAST_REVIEWED_DECK_KEY, useSessionStore } from "../store/session";

export function HomePage() {
  const deckSummaries = useDeckSummaries();
  const setDeck = useSessionStore((state) => state.setDeck);
  const loadQueueForToday = useSessionStore((state) => state.loadQueueForToday);

  const [decks, setDecks] = useState<DeckAggregation[]>([]);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [statError, setStatError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    todayReviewed: number;
    streak: number;
    dailyCounts: ReturnType<typeof getReviewStats> extends Promise<infer R>
      ? R["dailyCounts"]
      : never;
    dueForecast: Awaited<ReturnType<typeof getDueForecast>>;
  } | null>(null);
  const [lastDeckId, setLastDeckId] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setLastDeckId(window.localStorage.getItem(LAST_REVIEWED_DECK_KEY));
  }, []);

  const loadDeckSnapshot = useCallback(async () => {
    setLoadingDecks(true);
    setDeckError(null);
    try {
      const result = await listDecks();
      setDecks(result);
      return result;
    } catch (error) {
      console.error("Failed to list decks", error);
      setDeckError(
        error instanceof Error ? error.message : "Unable to load decks.",
      );
      return undefined;
    } finally {
      setLoadingDecks(false);
    }
  }, []);

  useEffect(() => {
    void loadDeckSnapshot();
  }, [deckSummaries, loadDeckSnapshot]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setStatError(null);
        const reviewStats = await getReviewStats();
        const forecast = await getDueForecast(7);
        setStats({
          todayReviewed: reviewStats.todayReviewed,
          streak: reviewStats.streak,
          dailyCounts: reviewStats.dailyCounts,
          dueForecast: forecast,
        });
      } catch (error) {
        console.error("Failed to load stats", error);
        setStatError(
          error instanceof Error ? error.message : "Unable to load statistics.",
        );
      }
    };

    void loadStats();
  }, []);

  const hasDecks = decks.length > 0;
  const somethingDue = useMemo(
    () => decks.some((deck) => deck.dueToday > 0),
    [decks],
  );

  const continueLabel = useMemo(() => {
    if (lastDeckId) {
      const matchingDeck = decks.find((deck) => deck.deckId === lastDeckId);
      if (matchingDeck) {
        return matchingDeck.dueToday > 0
          ? `Continue deck ${matchingDeck.deckId} (${matchingDeck.dueToday} due)`
          : `Continue deck ${matchingDeck.deckId}`;
      }
    }
    return "Continue reviewing";
  }, [decks, lastDeckId]);

  const resolveDeckId = () => {
    if (lastDeckId && decks.some((deck) => deck.deckId === lastDeckId)) {
      return lastDeckId;
    }
    return decks[0]?.deckId ?? null;
  };

  const handleOpenDeck = async (deckId: string) => {
    try {
      setDeck(deckId);
      await loadQueueForToday(deckId);
      navigate(`/review?deck=${encodeURIComponent(deckId)}`);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_REVIEWED_DECK_KEY, deckId);
      }
      setLastDeckId(deckId);
    } catch (error) {
      console.error("Failed to open deck", error);
      alert(
        error instanceof Error ? error.message : "Unable to open deck right now.",
      );
    }
  };

  const handleContinue = async () => {
    const targetDeck = resolveDeckId();
    if (!targetDeck) {
      return;
    }
    await handleOpenDeck(targetDeck);
  };

  const handleRename = async (deckId: string) => {
    const nextId = window.prompt("Rename deck", deckId);
    if (!nextId) {
      return;
    }
    const trimmed = nextId.trim();
    if (!trimmed || trimmed === deckId) {
      return;
    }

    try {
      await renameDeck(deckId, trimmed);
      const updated = await loadDeckSnapshot();
      if (lastDeckId === deckId) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_REVIEWED_DECK_KEY, trimmed);
        }
        setLastDeckId(trimmed);
      }
      if (updated?.length === 0 && typeof window !== "undefined") {
        window.localStorage.removeItem(LAST_REVIEWED_DECK_KEY);
        setLastDeckId(null);
      }
    } catch (error) {
      console.error("Failed to rename deck", error);
      alert(error instanceof Error ? error.message : "Unable to rename deck.");
    }
  };

  const handleDelete = async (deckId: string) => {
    const confirmed = window.confirm(
      `Delete deck ${deckId} and all its cards/progress? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDeck(deckId);
      const updated = (await loadDeckSnapshot()) ?? [];

      if (lastDeckId === deckId) {
        if (typeof window !== "undefined") {
          if (updated.length > 0) {
            window.localStorage.setItem(
              LAST_REVIEWED_DECK_KEY,
              updated[0].deckId,
            );
          } else {
            window.localStorage.removeItem(LAST_REVIEWED_DECK_KEY);
          }
        }
        setLastDeckId(updated[0]?.deckId ?? null);
      }
    } catch (error) {
      console.error("Failed to delete deck", error);
      alert(error instanceof Error ? error.message : "Unable to delete deck.");
    }
  };

  const handleBrowse = (deckId: string) => {
    navigate(`/browser?deck=${encodeURIComponent(deckId)}`);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Deck Manager</h1>
        <p className="text-sm text-slate-400">
          Review deck health, due cards, and quick actions from a single place.
        </p>
      </header>

      {deckError ? (
        <div className="card space-y-2 p-4 text-sm text-red-200">
          <p className="font-semibold">Unable to load decks.</p>
          <p>{deckError}</p>
        </div>
      ) : null}

      {stats ? (
        <section className="card space-y-3 p-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Today at a glance</h2>
            <p className="text-xs text-slate-400">
              A quick snapshot of recent activity and the week ahead.
            </p>
          </header>
          {statError ? (
            <p className="text-xs text-red-200">{statError}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Today reviewed
                </p>
                <p className="text-2xl font-semibold text-white">
                  {stats.todayReviewed}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Active streak
                </p>
                <p className="text-2xl font-semibold text-white">
                  {stats.streak} day{stats.streak === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  7-day due forecast
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                  {stats.dueForecast.map((entry) => (
                    <span
                      key={entry.date}
                      className="inline-flex flex-col rounded bg-slate-800/60 px-2 py-1"
                    >
                      <span className="text-amber-200">{entry.count}</span>
                      <span className="text-slate-500">{entry.date.slice(5)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!hasDecks || loadingDecks}
        className="btn-primary"
      >
        {continueLabel}
      </button>

      {loadingDecks ? (
        <p className="text-xs text-slate-400">Refreshing deck snapshot...</p>
      ) : null}

      {!hasDecks ? (
        <div className="card space-y-2 p-6 text-sm text-slate-300">
          <p>No decks yet.</p>
          <p>
            Use the import screen to add your first deck or let the bootstrap
            importer run on first launch.
          </p>
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Deck overview</h2>
          <div className="space-y-3">
            {decks.map((deck) => (
              <article
                key={deck.deckId}
                className="card flex flex-col gap-3 p-4 text-sm text-slate-200 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-white">
                    {deck.deckId}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-3 py-1 font-semibold text-blue-100">
                      Due today: {deck.dueToday}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/40 px-3 py-1 font-semibold text-slate-200">
                      Total: {deck.total}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-600/30 px-3 py-1 font-semibold text-slate-400">
                      Suspended: {deck.suspended}
                    </span>
                    {deck.missingAudio > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 font-semibold text-amber-100">
                        Missing audio: {deck.missingAudio}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleOpenDeck(deck.deckId)}
                    className="btn-primary"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBrowse(deck.deckId)}
                    className="btn-secondary"
                  >
                    Browse
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRename(deck.deckId)}
                    className="btn-secondary"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(deck.deckId)}
                    className="btn-secondary"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {hasDecks && !somethingDue && !loadingDecks ? (
        <div className="card space-y-2 p-4 text-sm text-slate-300">
          <p>No reviews are due right now.</p>
          <p>New cards will appear once the daily queue refreshes.</p>
        </div>
      ) : null}
    </div>
  );
}

export default HomePage;

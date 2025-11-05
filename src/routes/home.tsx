import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeckSummaries } from "../hooks/useDeckSummaries";
import { getDueReviewsByDeck } from "../db/reviews";
import { nowISO } from "../store/srs";
import { LAST_REVIEWED_DECK_KEY, useSessionStore } from "../store/session";

export function HomePage() {
  const deckSummaries = useDeckSummaries();
  const setDeck = useSessionStore((state) => state.setDeck);
  const loadQueueForToday = useSessionStore((state) => state.loadQueueForToday);

  const [dueCounts, setDueCounts] = useState<Record<string, number>>({});
  const [dueError, setDueError] = useState<string | null>(null);
  const [loadingDue, setLoadingDue] = useState(false);
  const [lastDeckId, setLastDeckId] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setLastDeckId(window.localStorage.getItem(LAST_REVIEWED_DECK_KEY));
  }, []);

  useEffect(() => {
    if (!deckSummaries.length) {
      setDueCounts({});
      return;
    }

    let cancelled = false;
    setLoadingDue(true);
    setDueError(null);

    const loadDue = async () => {
      try {
        const now = nowISO();
        const counts: Record<string, number> = {};
        for (const summary of deckSummaries) {
          const reviews = await getDueReviewsByDeck(summary.deckId, now);
          if (cancelled) {
            return;
          }
          counts[summary.deckId] = reviews.length;
        }
        if (!cancelled) {
          setDueCounts(counts);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error("Failed to compute due counts", error);
        setDueError(
          error instanceof Error ? error.message : "Unable to load due counts.",
        );
      } finally {
        if (!cancelled) {
          setLoadingDue(false);
        }
      }
    };

    void loadDue();

    return () => {
      cancelled = true;
    };
  }, [deckSummaries]);

  const hasDecks = deckSummaries.length > 0;
  const somethingDue = useMemo(
    () => Object.values(dueCounts).some((count) => count > 0),
    [dueCounts],
  );

  const continueLabel = useMemo(() => {
    if (lastDeckId) {
      const due = dueCounts[lastDeckId] ?? 0;
      return due > 0
        ? `Continue deck ${lastDeckId} (${due} due)`
        : `Continue deck ${lastDeckId}`;
    }
    return "Continue reviewing";
  }, [dueCounts, lastDeckId]);

  const handleContinue = async () => {
    const targetDeck = lastDeckId ?? deckSummaries[0]?.deckId;
    if (!targetDeck) {
      return;
    }

    try {
      setDueError(null);
      setDeck(targetDeck);
      await loadQueueForToday(targetDeck);
      navigate(`/review?deck=${encodeURIComponent(targetDeck)}`);
    } catch (error) {
      console.error("Failed to continue review session", error);
      setDueError(
        error instanceof Error ? error.message : "Unable to load review queue.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Welcome back</h1>
        <p className="text-sm text-slate-400">
          Track decks, check audio health, and continue where you left off.
        </p>
      </header>

      {dueError ? (
        <div className="card space-y-2 p-4 text-sm text-red-200">
          <p className="font-semibold">Something went wrong.</p>
          <p>{dueError}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!hasDecks}
        className="btn-primary"
      >
        {continueLabel}
      </button>

      {loadingDue ? (
        <p className="text-xs text-slate-400">Checking due counts...</p>
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
          <div className="grid gap-3 md:grid-cols-2">
            {deckSummaries.map((summary) => {
              const due = dueCounts[summary.deckId] ?? 0;
              return (
                <div key={summary.deckId} className="card space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-white">
                      {summary.deckId}
                    </p>
                    <span className="text-xs text-slate-400">
                      {summary.count} cards
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {due} due / {summary.missingAudio.length} audio issues
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {hasDecks && !somethingDue && !loadingDue ? (
        <div className="card space-y-2 p-4 text-sm text-slate-300">
          <p>No reviews are due right now.</p>
          <p>New cards will appear once the daily queue refreshes.</p>
        </div>
      ) : null}
    </div>
  );
}

export default HomePage;



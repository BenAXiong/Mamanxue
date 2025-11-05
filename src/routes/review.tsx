import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AudioPlayer from "../components/AudioPlayer";
import DeckList from "../components/DeckList";
import GradeBar from "../components/GradeBar";
import type { Card } from "../db/dexie";
import { db } from "../db/dexie";
import { appendLog } from "../db/logs";
import { getReview, putReview } from "../db/reviews";
import { useDeckSummaries } from "../hooks/useDeckSummaries";
import { useSessionStore } from "../store/session";
import { createInitialReviewState, nowISO, scheduleNext } from "../store/srs";
import { type AudioCheckResult, checkCardAudio } from "../utils/fileCheck";

export function ReviewPage() {
  const [searchParams] = useSearchParams();
  const deckSummaries = useDeckSummaries();
  const mode = useSessionStore((state) => state.mode);
  const setMode = useSessionStore((state) => state.setMode);
  const deckId = useSessionStore((state) => state.deckId);
  const setDeck = useSessionStore((state) => state.setDeck);
  const loadQueueForToday = useSessionStore((state) => state.loadQueueForToday);
  const queue = useSessionStore((state) => state.queue);
  const currentCardId = useSessionStore((state) => state.currentCardId);
  const revealed = useSessionStore((state) => state.revealed);
  const reveal = useSessionStore((state) => state.reveal);
  const nextCard = useSessionStore((state) => state.nextCard);
  const resetSession = useSessionStore((state) => state.resetSession);
  const loadingQueue = useSessionStore((state) => state.loading);
  const hardQueueLength = useSessionStore((state) => state.hardQueue.length);

  const [card, setCard] = useState<Card | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioCheckResult | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [markHard, setMarkHard] = useState(false);
  const [autoPlaySignal, setAutoPlaySignal] = useState(0);
  const [cardStartTime, setCardStartTime] = useState<number | null>(null);

  const queueLength = queue.length;

  const markAudioUnavailable = useCallback((kind: "audio" | "audioSlow") => {
    setAudioStatus((previous) => {
      if (kind === "audio") {
        if (previous?.audio === false) {
          return previous;
        }
        return {
          audio: false,
          audioSlow: previous?.audioSlow,
        };
      }

      if (previous?.audioSlow === false) {
        return previous;
      }

      return {
        audio: previous?.audio ?? true,
        audioSlow: false,
      };
    });
  }, []);

  const ensureDeckLoaded = useCallback(
    async (nextDeckId: string) => {
      setQueueError(null);

      try {
        setDeck(nextDeckId);
        await loadQueueForToday(nextDeckId);
      } catch (error) {
        console.error("Unable to load deck queue", error);
        setQueueError(
          error instanceof Error ? error.message : "Failed to load review queue.",
        );
      }
    },
    [loadQueueForToday, setDeck],
  );

  const requestedDeck = searchParams.get("deck");

  useEffect(() => {
    if (requestedDeck && requestedDeck !== deckId) {
      if (deckSummaries.some((deck) => deck.deckId === requestedDeck)) {
        void ensureDeckLoaded(requestedDeck);
        return;
      }
    }

    if (!deckSummaries.length) {
      return;
    }

    if (deckId && deckSummaries.some((deck) => deck.deckId === deckId)) {
      return;
    }

    const firstDeck = deckSummaries[0]?.deckId;
    if (firstDeck) {
      void ensureDeckLoaded(firstDeck);
    }
  }, [deckSummaries, deckId, ensureDeckLoaded, requestedDeck]);

  useEffect(() => {
    if (!currentCardId) {
      setCard(null);
      setAudioStatus(null);
      setCardError(null);
      setCardStartTime(null);
      return;
    }

    let cancelled = false;
    setCardError(null);
    setMarkHard(false);
    setAutoPlaySignal(0);

    const loadCard = async () => {
      try {
        const record = await db.cards.get(currentCardId);
        if (!record) {
          throw new Error("Card not found in Dexie.");
        }
        if (cancelled) {
          return;
        }
        setCard(record);
        setCardStartTime(Date.now());
        const audio = await checkCardAudio(record);
        if (!cancelled) {
          setAudioStatus(audio);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error("Failed to load card for session", error);
        setCard(null);
        setAudioStatus(null);
        setCardError(
          error instanceof Error ? error.message : "Unable to load card data.",
        );
      }
    };

    void loadCard();

    return () => {
      cancelled = true;
    };
  }, [currentCardId]);

  const handleReveal = useCallback(() => {
    reveal();
    if (mode === "output") {
      setAutoPlaySignal((value) => value + 1);
    }
  }, [mode, reveal]);

  const handleGrade = useCallback(
    async (grade: 1 | 2 | 3) => {
      if (!currentCardId) {
        return;
      }

      setIsGrading(true);
      setQueueError(null);

      try {
        const previous = await getReview(currentCardId);
        const nextReview = scheduleNext(previous, grade, {
          cardId: currentCardId,
        });

        const durationMs = cardStartTime ? Date.now() - cardStartTime : 0;
        const logDeckId = card?.deckId ?? deckId ?? null;

        nextReview.suspended = false;
        if (markHard) {
          nextReview.hardFlag = true;
        } else if (nextReview.hardFlag) {
          delete nextReview.hardFlag;
        }

        await putReview(nextReview);
        if (logDeckId) {
          void appendLog({
            when: nowISO(),
            cardId: currentCardId,
            deckId: logDeckId,
            grade,
            mode,
            durationMs,
          });
        }
        setMarkHard(false);
        nextCard({
          cardId: currentCardId,
          grade,
          hardFlag: Boolean(nextReview.hardFlag),
        });
      } catch (error) {
        console.error("Failed to submit grade", error);
        setQueueError(
          error instanceof Error ? error.message : "Unable to save review.",
        );
      } finally {
        setIsGrading(false);
      }
    },
    [card, cardStartTime, currentCardId, deckId, markHard, mode, nextCard],
  );

  const handleDisable = useCallback(async () => {
    if (!currentCardId) {
      return;
    }

    setIsGrading(true);
    setQueueError(null);

    try {
      const previous = await getReview(currentCardId);
      const base = previous ?? createInitialReviewState(currentCardId);
      const disabled = { ...base, suspended: true };
      await putReview(disabled);
      setMarkHard(false);
      nextCard({ cardId: currentCardId });
    } catch (error) {
      console.error("Failed to disable card", error);
      setQueueError(
        error instanceof Error ? error.message : "Unable to disable card.",
      );
    } finally {
      setIsGrading(false);
    }
  }, [currentCardId, nextCard]);

  const handleToggleMode = useCallback(() => {
    setMode(mode === "input" ? "output" : "input");
  }, [mode, setMode]);

  const handleResetSession = useCallback(() => {
    resetSession();
  }, [resetSession]);

  const actionsSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(mode === "input" ? "Input (FR -> EN)" : "Output (EN -> FR)");
    parts.push(`Queue: ${queueLength}`);
    if (hardQueueLength > 0) {
      parts.push(`Hard revisit: ${hardQueueLength}`);
    }
    return parts.join(" | ");
  }, [hardQueueLength, mode, queueLength]);

  const cardFront = useMemo(() => {
    if (!card) {
      return { label: "", text: "" };
    }
    if (mode === "input") {
      return { label: "Prompt (FR)", text: card.fr };
    }
    return { label: "Prompt (EN)", text: card.en };
  }, [card, mode]);

  const cardBack = useMemo(() => {
    if (!card) {
      return { label: "", text: "" };
    }
    if (mode === "input") {
      return { label: "Answer (EN)", text: card.en };
    }
    return { label: "Answer (FR)", text: card.fr };
  }, [card, mode]);

  const showAudio = mode === "input" || revealed;
  const primaryAudioAvailable = audioStatus ? audioStatus.audio !== false : true;
  const slowAudioAvailable =
    card?.audio_slow ? audioStatus?.audioSlow !== false : true;

  return (
    <div className="space-y-6 pb-32">
      <DeckList
        summaries={deckSummaries}
        selectedDeckId={deckId}
        onSelect={(nextId) => {
          void ensureDeckLoaded(nextId);
        }}
      />

      <section className="space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-white">Review</h1>
              <p className="text-sm text-slate-400">
                Daily queue pulls due reviews first, then up to ten new cards.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleToggleMode}
                className="btn-secondary"
              >
                Toggle mode
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                className="btn-secondary"
              >
                Reset session
              </button>
            </div>
          </div>
          {deckId ? (
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Deck {deckId}
            </p>
          ) : null}
        </header>

        {queueError ? (
          <div className="card space-y-2 p-4 text-sm text-red-200">
            <p className="font-semibold">We hit a snag.</p>
            <p>{queueError}</p>
          </div>
        ) : null}

        {loadingQueue ? (
          <p className="text-sm text-slate-300">Loading queue...</p>
        ) : null}

        {cardError ? (
          <div className="card space-y-2 p-4 text-sm text-red-200">
            <p className="font-semibold">Unable to load the current card.</p>
            <p>{cardError}</p>
          </div>
        ) : null}

        {!loadingQueue && !currentCardId ? (
          <div className="card space-y-2 p-6 text-sm text-slate-300">
            <p>No cards due right now.</p>
            <p>
              Once the queue refreshes, cards will appear here for the selected
              deck.
            </p>
          </div>
        ) : null}

        {card ? (
          <section className="card space-y-5 p-6">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
              <span>Queue remaining: {queueLength}</span>
              {card.sequence !== undefined ? (
                <span>Card {card.sequence}</span>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {cardFront.label}
                </p>
                <p className="text-xl font-semibold text-white">
                  {cardFront.text}
                </p>
              </div>

              {showAudio ? (
                <div className="space-y-2">
                  <AudioPlayer
                    src={card.audio}
                    label="Play audio"
                    autoPlaySignal={mode === "output" ? autoPlaySignal : undefined}
                    available={primaryAudioAvailable}
                    onLoadError={() => {
                      markAudioUnavailable("audio");
                    }}
                  />
                  {card.audio_slow ? (
                    <AudioPlayer
                      src={card.audio_slow}
                      label="Slow audio"
                      available={slowAudioAvailable}
                      onLoadError={() => {
                        markAudioUnavailable("audioSlow");
                      }}
                    />
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Reveal to view the target language and audio.
                </p>
              )}

              {revealed ? (
                <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900/50 p-4">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {cardBack.label}
                    </p>
                    <p className="text-lg text-slate-100">{cardBack.text}</p>
                  </div>
                  {card.notes ? (
                    <p className="text-sm text-slate-300">Notes: {card.notes}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 text-xs">
                {audioStatus?.audio === false ? (
                  <span className="inline-flex items-center rounded-full bg-red-500/20 px-3 py-1 font-semibold text-red-100">
                    Audio missing: {card.audio}
                  </span>
                ) : null}
                {audioStatus?.audioSlow === false && card.audio_slow ? (
                  <span className="inline-flex items-center rounded-full bg-amber-500/20 px-3 py-1 font-semibold text-amber-100">
                    Slow audio missing: {card.audio_slow}
                  </span>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </section>

      {card && currentCardId ? (
        <GradeBar
          actions={<span className="text-xs text-slate-300">{actionsSummary}</span>}
          onGrade={handleGrade}
          revealed={revealed}
          onReveal={handleReveal}
          onDisable={handleDisable}
          onMarkHard={() => setMarkHard((value) => !value)}
          hardActive={markHard}
          gradeDisabled={isGrading || loadingQueue}
        />
      ) : null}
    </div>
  );
}

export default ReviewPage;


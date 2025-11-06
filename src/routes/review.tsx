import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AudioPlayer from "../components/AudioPlayer";
import GradeBar from "../components/GradeBar";
import { useToast } from "../components/ToastProvider";
import type { Card } from "../db/dexie";
import { db } from "../db/dexie";
import { appendLog } from "../db/logs";
import { getReview, putReview } from "../db/reviews";
import { useDeckSummaries } from "../hooks/useDeckSummaries";
import { useSessionStore } from "../store/session";
import { createInitialReviewState, nowISO, scheduleNext } from "../store/srs";
import { type AudioCheckResult, checkCardAudio } from "../utils/fileCheck";

interface SessionStats {
  reviewed: number;
  hard: number;
  again: number;
  durationMs: number;
}

const INITIAL_SESSION_STATS: SessionStats = {
  reviewed: 0,
  hard: 0,
  again: 0,
  durationMs: 0,
};

export function ReviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [visibleSentences, setVisibleSentences] = useState<
    Record<"fr" | "en", boolean>
  >({
    fr: false,
    en: false,
  });
  const [sessionStats, setSessionStats] = useState<SessionStats>(() => ({
    ...INITIAL_SESSION_STATS,
  }));
  const [autoReturnPending, setAutoReturnPending] = useState(false);
  const { showToast } = useToast();

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

  const revealAllSentences = useCallback(() => {
    setVisibleSentences((previous) => {
      if (previous.fr && previous.en) {
        return previous;
      }
      return { fr: true, en: true };
    });
    if (!revealed) {
      reveal();
    }
  }, [revealed, reveal]);

  const handleSentenceReveal = useCallback(
    (key: "fr" | "en") => {
      setVisibleSentences((previous) => {
        if (previous[key]) {
          return previous;
        }
        const next = { ...previous, [key]: true };
        if (!revealed && next.fr && next.en) {
          reveal();
        }
        return next;
      });
    },
    [revealed, reveal],
  );

  const ensureDeckLoaded = useCallback(
    async (nextDeckId: string) => {
      setQueueError(null);

      try {
        setDeck(nextDeckId);
        await loadQueueForToday(nextDeckId);
        setSessionStats({ ...INITIAL_SESSION_STATS });
        setAutoReturnPending(false);
      } catch (error) {
        console.error("Unable to load deck queue", error);
        setQueueError(
          error instanceof Error ? error.message : "Failed to load review queue.",
        );
      }
    },
    [loadQueueForToday, setAutoReturnPending, setDeck, setSessionStats],
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
      setVisibleSentences({ fr: false, en: false });
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
        setVisibleSentences({ fr: false, en: false });
        setCardStartTime(Date.now());
        setAutoPlaySignal((value) => value + 1);
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
    revealAllSentences();
    setAutoPlaySignal((value) => value + 1);
  }, [revealAllSentences]);

  const handleGrade = useCallback(
    async (grade: 1 | 2 | 3) => {
      if (!currentCardId || isGrading || loadingQueue) {
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
        const isAgain = grade === 1;
        const isHard = grade === 2 || markHard;

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
        setSessionStats((stats) => ({
          reviewed: stats.reviewed + 1,
          hard: stats.hard + (isHard ? 1 : 0),
          again: stats.again + (isAgain ? 1 : 0),
          durationMs: stats.durationMs + durationMs,
        }));
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
        showToast({
          message: "Failed to save review. Please retry.",
          variant: "error",
        });
      } finally {
        setIsGrading(false);
      }
    },
    [
      card,
      cardStartTime,
      currentCardId,
      deckId,
      isGrading,
      loadingQueue,
      markHard,
      mode,
      nextCard,
      showToast,
      setSessionStats,
    ],
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
      showToast({
        message: "Unable to disable card.",
        variant: "error",
      });
    } finally {
      setIsGrading(false);
    }
  }, [currentCardId, nextCard, showToast]);

  const handleToggleMode = useCallback(() => {
    setMode(mode === "input" ? "output" : "input");
  }, [mode, setMode]);

  const handleResetSession = useCallback(() => {
    resetSession();
    setSessionStats({ ...INITIAL_SESSION_STATS });
    setAutoReturnPending(false);
  }, [resetSession, setAutoReturnPending, setSessionStats]);

  const actionsSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(mode === "input" ? "Input (FR -> EN)" : "Output (EN -> FR)");
    parts.push(`Queue: ${queueLength}`);
    if (hardQueueLength > 0) {
      parts.push(`Hard revisit: ${hardQueueLength}`);
    }
    return parts.join(" | ");
  }, [hardQueueLength, mode, queueLength]);

  const sentenceOrder = useMemo(() => {
    if (!card) {
      return [];
    }
    if (mode === "input") {
      return [
        {
          key: "fr" as const,
          heading: "Prompt (FR)",
          role: "prompt" as const,
          text: card.fr,
        },
        {
          key: "en" as const,
          heading: "Answer (EN)",
          role: "answer" as const,
          text: card.en,
        },
      ];
    }
    return [
      {
        key: "en" as const,
        heading: "Prompt (EN)",
        role: "prompt" as const,
        text: card.en,
      },
      {
        key: "fr" as const,
        heading: "Answer (FR)",
        role: "answer" as const,
        text: card.fr,
      },
    ];
  }, [card, mode]);

  const primaryAudioAvailable = audioStatus ? audioStatus.audio !== false : true;
  const slowAudioAvailable =
    card?.audio_slow ? audioStatus?.audioSlow !== false : true;
  const allSentencesVisible = visibleSentences.fr && visibleSentences.en;
  const sessionComplete =
    !loadingQueue && !currentCardId && sessionStats.reviewed > 0;
  const noCardsAvailable =
    !loadingQueue && !currentCardId && sessionStats.reviewed === 0;
  const sessionDurationLabel = formatSessionDuration(sessionStats.durationMs);

  useEffect(() => {
    if (!sessionComplete) {
      setAutoReturnPending(false);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    setAutoReturnPending(true);
    const timer = window.setTimeout(() => {
      setAutoReturnPending(false);
      navigate("/");
    }, 6000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [navigate, sessionComplete, setAutoReturnPending]);

  const handleReturnHome = useCallback(() => {
    setAutoReturnPending(false);
    navigate("/");
  }, [navigate, setAutoReturnPending]);

  return (
    <div className="space-y-6 pb-32">
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
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
        {deckId ? (
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Deck {deckId}
          </p>
        ) : null}

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

        {sessionComplete ? (
          <section className="card session-recap space-y-4 p-6 text-sm text-slate-200">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">
                Session complete!
              </h2>
              <p className="text-xs-muted">
                {deckId ? `Deck ${deckId}` : "Selected deck"} is clear for now.
                Reviewed {sessionStats.reviewed} card
                {sessionStats.reviewed === 1 ? "" : "s"} in {sessionDurationLabel}.
              </p>
            </div>
            <div className="session-recap-grid">
              <div className="session-recap-pill">
                <span className="label">Reviewed</span>
                <span className="value">{sessionStats.reviewed}</span>
              </div>
              <div className="session-recap-pill">
                <span className="label">Hard</span>
                <span className="value">{sessionStats.hard}</span>
              </div>
              <div className="session-recap-pill">
                <span className="label">Again</span>
                <span className="value">{sessionStats.again}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={handleReturnHome} className="btn-primary">
                Back to decks
              </button>
              {autoReturnPending ? (
                <span className="text-xs-muted">
                  Returning to decks automatically...
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        {noCardsAvailable ? (
          <div className="card space-y-2 p-6 text-sm text-slate-300">
            <p>No cards due right now.</p>
            <p>
              Once the queue refreshes, cards will appear here for the selected
              deck.
            </p>
          </div>
        ) : null}

        {card ? (
          <>
            <section className="card review-stage space-y-6 p-6">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                <span>Queue remaining: {queueLength}</span>
                {card.sequence !== undefined ? (
                  <span>Card {card.sequence}</span>
                ) : null}
              </div>

              <div className="review-sentence-stack space-y-4">
                {sentenceOrder.map((sentence) => {
                  const isVisible =
                    sentence.key === "fr"
                      ? visibleSentences.fr
                      : visibleSentences.en;
                  return (
                    <button
                      type="button"
                      key={sentence.key}
                      className={`sentence-panel ${
                        sentence.role === "prompt"
                          ? "sentence-role-prompt"
                          : "sentence-role-answer"
                      } ${isVisible ? "sentence-panel-visible" : "sentence-panel-blurred"}`}
                      onClick={() => handleSentenceReveal(sentence.key)}
                      aria-pressed={isVisible}
                    >
                      <span className="sentence-heading">{sentence.heading}</span>
                      <span className="sentence-text">{sentence.text}</span>
                      {!isVisible ? (
                        <span className="sentence-mask">Tap to reveal</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="review-audio-grid space-y-2">
                <AudioPlayer
                  src={card.audio}
                  label="Play audio"
                  autoPlaySignal={autoPlaySignal}
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

              {card.notes ? (
                <div className="review-notes text-sm text-slate-200">
                  Notes: {card.notes}
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
            </section>
            {!allSentencesVisible ? (
              <RevealAllFab onReveal={handleReveal} />
            ) : null}
          </>
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

function formatSessionDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return "0s";
  }
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

interface RevealAllFabProps {
  onReveal: () => void;
}

function RevealAllFab({ onReveal }: RevealAllFabProps) {
  return (
    <button
      type="button"
      className="fab reveal-fab"
      aria-label="Reveal both sentences"
      onClick={onReveal}
    >
      <EyeIcon />
    </button>
  );
}

function EyeIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default ReviewPage;


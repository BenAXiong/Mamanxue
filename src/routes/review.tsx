import { useEffect, useMemo, useState } from "react";
import AudioPlayer from "../components/AudioPlayer";
import DeckList from "../components/DeckList";
import GradeBar from "../components/GradeBar";
import type { Card } from "../db/dexie";
import { db } from "../db/dexie";
import { importDeckFromPublic } from "../db/seed";
import { useDeckSummaries } from "../hooks/useDeckSummaries";
import { checkCardAudio, type AudioCheckResult } from "../utils/fileCheck";
import { resolvePublicAssetPath } from "../utils/assets";

type LoadState = "idle" | "loading" | "ready" | "error";

export function ReviewPage() {
  const deckSummaries = useDeckSummaries();
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [card, setCard] = useState<Card | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioCheckResult | null>(null);

  useEffect(() => {
    if (!deckSummaries.length) {
      setSelectedDeckId(null);
      return;
    }

    if (!selectedDeckId || !deckSummaries.some((deck) => deck.deckId === selectedDeckId)) {
      setSelectedDeckId(deckSummaries[0].deckId);
    }
  }, [deckSummaries, selectedDeckId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!selectedDeckId) {
        setLoadState("idle");
        setCard(null);
        setAudioStatus(null);
        setErrorMessage(null);
        return;
      }

      setLoadState("loading");
      setCard(null);
      setAudioStatus(null);
      setErrorMessage(null);

      try {
        const existingCount = await db.cards
          .where("deckId")
          .equals(selectedDeckId)
          .count();

        if (existingCount === 0) {
          await importDeckFromPublic(selectedDeckId);
        }

        const cards = await db.cards.where("deckId").equals(selectedDeckId).toArray();

        if (!cards.length) {
          throw new Error(`No cards found for deck ${selectedDeckId}`);
        }

        cards.sort((a, b) => {
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

        const nextCard = cards[0];

        if (cancelled) {
          return;
        }

        setCard(nextCard);
        setLoadState("ready");

        const audioCheck = await checkCardAudio(nextCard);
        if (!cancelled) {
          setAudioStatus(audioCheck);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadState("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Unexpected error occurred",
        );
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [selectedDeckId]);

  const resolvedPaths = useMemo(() => {
    if (!card) {
      return null;
    }

    return {
      audio: resolvePublicAssetPath(card.audio),
      audioSlow: card.audio_slow
        ? resolvePublicAssetPath(card.audio_slow)
        : undefined,
    };
  }, [card]);

  return (
    <div className="space-y-6">
      <DeckList
        summaries={deckSummaries}
        selectedDeckId={selectedDeckId}
        onSelect={setSelectedDeckId}
      />

      <section className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold">Review</h1>
          <p className="text-sm text-slate-400">
            Pick a deck to start reviewing. Audio controls and notes appear for
            the first card in the deck.
          </p>
        </header>

        {loadState === "loading" && (
          <p className="text-sm text-slate-300">Loading deck...</p>
        )}

        {loadState === "error" && (
          <div className="card space-y-2 p-4 text-sm text-red-200">
            <p className="font-medium">We hit a snag loading the deck.</p>
            {errorMessage ? <p>{errorMessage}</p> : null}
          </div>
        )}

        {loadState === "ready" && card && (
          <section className="card space-y-5 p-6">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
              <span>Deck {card.deckId}</span>
              {card.sequence !== undefined ? <span>Card {card.sequence}</span> : null}
            </div>
            <div className="space-y-2">
              <p className="text-xl font-semibold text-white">{card.fr}</p>
              <p className="text-lg text-slate-300">{card.en}</p>
              {card.notes ? (
                <p className="text-sm text-slate-400">Notes: {card.notes}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <AudioPlayer src={card.audio} label="Play audio" />
              {card.audio_slow ? (
                <AudioPlayer src={card.audio_slow} label="Slow" />
              ) : null}

              {resolvedPaths ? (
                <div className="space-y-1 text-xs text-slate-500">
                  <p>Main: {resolvedPaths.audio}</p>
                  {resolvedPaths.audioSlow ? (
                    <p>Slow: {resolvedPaths.audioSlow}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 text-xs">
                {audioStatus && audioStatus.audio === false && resolvedPaths ? (
                  <span className="inline-flex items-center rounded-full bg-red-500/20 px-3 py-1 font-semibold text-red-100">
                    Audio missing: {resolvedPaths.audio}
                  </span>
                ) : null}

                {audioStatus?.audioSlow === false && resolvedPaths?.audioSlow ? (
                  <span className="inline-flex items-center rounded-full bg-amber-500/20 px-3 py-1 font-semibold text-amber-100">
                    Slow audio missing: {resolvedPaths.audioSlow}
                  </span>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {loadState === "ready" && card ? (
          <GradeBar
            actions={
              <span className="text-xs text-slate-400">
                Tap to grade the prompt
              </span>
            }
            onSelect={(grade) => {
              console.log("Selected grade", grade);
            }}
          />
        ) : null}
      </section>
    </div>
  );
}

export default ReviewPage;

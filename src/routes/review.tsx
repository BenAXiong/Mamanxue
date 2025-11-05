import { useEffect, useMemo, useState } from "react";
import AudioPlayer from "../components/AudioPlayer";
import type { Card } from "../db/dexie";
import { db } from "../db/dexie";
import { importDeckFromPublic } from "../db/seed";
import { checkCardAudio, type AudioCheckResult } from "../utils/fileCheck";
import { resolvePublicAssetPath } from "../utils/assets";

type LoadState = "loading" | "ready" | "error";

const REVIEW_DECK_ID = "1_1";
const REVIEW_CARD_ID = "1_1_0001";

export function ReviewPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [card, setCard] = useState<Card | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioCheckResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadState("loading");
      setErrorMessage(null);
      setAudioStatus(null);

      try {
        await importDeckFromPublic(REVIEW_DECK_ID);

        const nextCard = await db.cards.get(REVIEW_CARD_ID);

        if (!nextCard) {
          throw new Error(`Card not found: ${REVIEW_CARD_ID}`);
        }

        if (cancelled) {
          return;
        }

        setCard(nextCard);
        setLoadState("ready");

        const result = await checkCardAudio(nextCard);

        if (!cancelled) {
          setAudioStatus(result);
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
  }, []);

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Review</h1>
        <p className="text-sm text-slate-400">
          Phase 1 - minimal review screen prototype
        </p>
      </header>

      {loadState === "loading" && (
        <p className="text-sm text-slate-300">Loading...</p>
      )}

      {loadState === "error" && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <p className="font-medium">We hit a snag loading the card.</p>
          {errorMessage ? <p className="mt-1">{errorMessage}</p> : null}
        </div>
      )}

      {loadState === "ready" && card && (
        <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
          <div className="space-y-2">
            <p className="text-xl font-semibold text-white">{card.fr}</p>
            <p className="text-lg text-slate-300">{card.en}</p>
          </div>

          <div className="space-y-2">
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

              {audioStatus?.audioSlow === false &&
              resolvedPaths?.audioSlow !== undefined ? (
                <span className="inline-flex items-center rounded-full bg-amber-500/20 px-3 py-1 font-semibold text-amber-100">
                  Slow audio missing: {resolvedPaths.audioSlow}
                </span>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default ReviewPage;

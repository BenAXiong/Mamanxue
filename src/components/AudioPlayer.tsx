import { useCallback, useEffect, useMemo, useRef } from "react";
import { resolvePublicAssetPath } from "../utils/assets";
import { useToast } from "./ToastProvider";

interface AudioPlayerProps {
  src: string;
  label?: string;
  autoPlaySignal?: number;
  onAutoPlayError?: (error: unknown) => void;
  available?: boolean;
  onLoadError?: (reason: "playback" | "element") => void;
}

export function AudioPlayer({
  src,
  label = "Play audio",
  autoPlaySignal,
  onAutoPlayError,
  available = true,
  onLoadError,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasWarnedRef = useRef(false);
  const { showToast } = useToast();
  const resolvedSrc = useMemo(() => {
    if (!available) {
      return undefined;
    }
    return resolvePublicAssetPath(src);
  }, [available, src]);
  const ariaLabel = label === "Play audio" ? label : `Play ${label}`;

  useEffect(() => {
    hasWarnedRef.current = false;
  }, [resolvedSrc]);

  const handlePlay = useCallback(async () => {
    if (!available || !resolvedSrc) {
      return;
    }

    const element = audioRef.current;

    if (!element) {
      return;
    }

    try {
      element.currentTime = 0;
      const playPromise = element.play();
      if (playPromise) {
        await playPromise;
      }
    } catch (error) {
      console.error("Unable to play audio file", error);
      onAutoPlayError?.(error);
      onLoadError?.("playback");
      if (!hasWarnedRef.current) {
        showToast({
          message: "Unable to play audio file.",
          variant: "warning",
        });
        hasWarnedRef.current = true;
      }
    }
  }, [available, onAutoPlayError, onLoadError, resolvedSrc, showToast]);

  useEffect(() => {
    if (!available) {
      return;
    }

    if (autoPlaySignal === undefined || autoPlaySignal <= 0) {
      return;
    }

    void handlePlay();
  }, [autoPlaySignal, available, handlePlay]);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => {
          void handlePlay();
        }}
        disabled={!available}
        className="btn btn-primary w-full justify-center"
        aria-label={ariaLabel}
      >
        <span aria-hidden="true" className="text-base leading-none">
          {"\u25B6"}
        </span>
        <span>{label}</span>
      </button>
      <audio
        ref={audioRef}
        preload="none"
        src={resolvedSrc}
        onError={(event) => {
          if (available) {
            console.error("Audio element failed to load source", event);
          }
          onLoadError?.("element");
          if (!hasWarnedRef.current) {
            showToast({
              message: "Audio file failed to load.",
              variant: "error",
            });
            hasWarnedRef.current = true;
          }
        }}
      />
    </div>
  );
}

export default AudioPlayer;

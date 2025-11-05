import { useMemo, useRef } from "react";
import { resolvePublicAssetPath } from "../utils/assets";

interface AudioPlayerProps {
  src: string;
  label?: string;
}

export function AudioPlayer({ src, label = "Play audio" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolvedSrc = useMemo(() => resolvePublicAssetPath(src), [src]);
  const ariaLabel = label === "Play audio" ? label : `Play ${label}`;

  const handlePlay = async () => {
    const element = audioRef.current;

    if (!element) {
      return;
    }

    try {
      if (element.readyState === 0) {
        // Ensure the source is ready before attempting playback.
        element.load();
      }

      await element.play();
    } catch (error) {
      console.error("Unable to play audio file", error);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handlePlay}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
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
          console.error("Audio element failed to load source", event);
        }}
      />
    </div>
  );
}

export default AudioPlayer;

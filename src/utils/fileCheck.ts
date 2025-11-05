import { resolvePublicAssetPath } from "./assets";

async function probeWithRange(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to probe audio with range request", error);
    return false;
  }
}

export async function checkAudio(url: string): Promise<boolean> {
  const target = resolvePublicAssetPath(url);

  try {
    const response = await fetch(target, { method: "HEAD" });

    if (response.ok) {
      return true;
    }

    if (response.status === 405) {
      return probeWithRange(target);
    }

    return false;
  } catch (error) {
    console.error("Failed to check audio availability", error);
    return false;
  }
}

export interface AudioCheckResult {
  audio: boolean;
  audioSlow?: boolean;
}

export async function checkCardAudio(
  sources: { audio: string; audio_slow?: string },
): Promise<AudioCheckResult> {
  const audio = await checkAudio(sources.audio);
  let audioSlow: boolean | undefined;

  if (sources.audio_slow) {
    audioSlow = await checkAudio(sources.audio_slow);
  }

  return { audio, audioSlow };
}

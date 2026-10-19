import type { IAudioMetadata } from "music-metadata";

export interface AudioMetadata297 {
  readonly container: "MP3" | "FLAC" | "Ogg" | "WAV";
  readonly codec: string;
  readonly durationSeconds: number | null;
  readonly sampleRateHz: number | null;
  readonly channels: number | null;
  readonly bitrateBps: number | null;
  readonly tagTypes: readonly string[];
  readonly tags: Readonly<{ title: string | null; artist: string | null; album: string | null; genre: string | null; year: string | null; track: string | null }>;
}

function limitedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = Array.from(value.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, " "))
    .slice(0, 160).join("").trim();
  return cleaned || null;
}

function positive(value: unknown, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= maximum ? value : null;
}

/** Send only a small allowlist of primitive values across the worker boundary. */
export function projectAudioMetadata297(metadata: IAudioMetadata, container: AudioMetadata297["container"]): AudioMetadata297 {
  const { common, format } = metadata;
  if (!format.codec || !positive(format.sampleRate, 768_000) || !positive(format.numberOfChannels, 32)) {
    throw new Error("AUDIO_METADATA_UNRECOGNIZED: traccia audio non verificabile");
  }
  const text = (value: unknown) => limitedString(value);
  return {
    container,
    codec: text(format.codec) ?? "Sconosciuto",
    durationSeconds: positive(format.duration, 24 * 60 * 60),
    sampleRateHz: positive(format.sampleRate, 768_000),
    channels: positive(format.numberOfChannels, 32),
    bitrateBps: positive(format.bitrate, 1_000_000_000),
    tagTypes: format.tagTypes?.slice(0, 8).map((value) => text(value)).filter((value): value is string => value !== null) ?? [],
    tags: {
      title: text(common.title), artist: text(common.artist), album: text(common.album),
      genre: text(common.genre?.[0]), year: common.year !== undefined && Number.isInteger(common.year) && common.year >= 1000 && common.year <= 9999 ? String(common.year) : null,
      track: common.track?.no && Number.isInteger(common.track.no) && common.track.no > 0
        ? `${common.track.no}${common.track.of && common.track.of > 0 ? `/${common.track.of}` : ""}` : null,
    },
  };
}

export async function parseAudioMetadata297(file: Blob, container: AudioMetadata297["container"]): Promise<AudioMetadata297> {
  // Importing inside the worker keeps the parser and codecs out of the initial page bundle.
  const { parseBlob } = await import("music-metadata");
  const metadata = await parseBlob(file, { duration: true, skipCovers: true });
  return projectAudioMetadata297(metadata, container);
}

import type { AudioMetadata297 } from "./metadata-297-parser";

export type { AudioMetadata297 } from "./metadata-297-parser";

export const AUDIO_METADATA_MAX_BYTES = 24 * 1024 * 1024;
export const AUDIO_METADATA_MAX_HEADER_BYTES = 256 * 1024;
export const AUDIO_METADATA_TIMEOUT_MS = 5_000;

function aborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Audio inspection cancelled", "AbortError");
}

export async function probeAudio297(file: Blob, signal?: AbortSignal): Promise<AudioMetadata297["container"]> {
  aborted(signal);
  if (file.size < 32 || file.size > AUDIO_METADATA_MAX_BYTES) throw new Error("AUDIO_METADATA_SIZE_LIMIT");
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  aborted(signal);
  const prefix = (offset: number, value: string) => [...value].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
  if (prefix(0, "fLaC")) {
    if ((bytes[4]! & 0x7f) !== 0 || (bytes[5]! * 65_536 + bytes[6]! * 256 + bytes[7]!) !== 34) {
      throw new Error("AUDIO_METADATA_INVALID: FLAC STREAMINFO");
    }
    // FLAC stores its metadata blocks before the audio stream. Refuse oversized
    // artwork/comments/padding without allowing the parser to allocate them.
    const blocks = new Uint8Array(await file.slice(0, Math.min(file.size, AUDIO_METADATA_MAX_HEADER_BYTES + 8)).arrayBuffer());
    aborted(signal);
    let offset = 4;
    while (offset + 4 <= blocks.length) {
      const last = (blocks[offset]! & 0x80) !== 0;
      const length = blocks[offset + 1]! * 65_536 + blocks[offset + 2]! * 256 + blocks[offset + 3]!;
      offset += 4 + length;
      if (offset > AUDIO_METADATA_MAX_HEADER_BYTES) throw new Error("AUDIO_METADATA_HEADER_LIMIT");
      if (offset > file.size) throw new Error("AUDIO_METADATA_INVALID: truncated FLAC block");
      if (last) return "FLAC";
    }
    throw new Error("AUDIO_METADATA_HEADER_LIMIT");
  }
  if (prefix(0, "OggS") && bytes[4] === 0 && bytes[26]! > 0) return "Ogg";
  if (prefix(0, "RIFF") && prefix(8, "WAVE")) return "WAV";
  if (prefix(0, "ID3")) {
    if (bytes[3]! < 2 || bytes[3]! > 4 || bytes[6]! > 127 || bytes[7]! > 127 || bytes[8]! > 127 || bytes[9]! > 127) {
      throw new Error("AUDIO_METADATA_INVALID: ID3v2 header");
    }
    const length = (bytes[6]! << 21) | (bytes[7]! << 14) | (bytes[8]! << 7) | bytes[9]!;
    if (length > AUDIO_METADATA_MAX_HEADER_BYTES || length + 10 > file.size) throw new Error("AUDIO_METADATA_HEADER_LIMIT");
    // ID3 is only a tag. Require a real MPEG frame following the bounded tag.
    const audio = new Uint8Array(await file.slice(10 + length, 10 + length + 4096).arrayBuffer());
    aborted(signal);
    if (!audio.some((v, index) => v === 0xff && index + 1 < audio.length && (audio[index + 1]! & 0xe6) === 0xe2)) {
      throw new Error("AUDIO_METADATA_UNRECOGNIZED: MP3 frame absent");
    }
    return "MP3";
  }
  if (bytes.some((v, index) => index < 16 && v === 0xff && (bytes[index + 1]! & 0xe6) === 0xe2)) return "MP3";
  throw new Error("AUDIO_METADATA_UNSUPPORTED: expected MP3, FLAC, Ogg or WAV signature");
}

/** A dedicated Worker is terminated on abort/timeout even when parsing is CPU-bound. */
export async function inspectAudioMetadata297(file: Blob, signal?: AbortSignal): Promise<AudioMetadata297> {
  const container = await probeAudio297(file, signal);
  aborted(signal);
  if (typeof Worker === "undefined") throw new Error("AUDIO_METADATA_UNSUPPORTED: Web Worker unavailable");
  const worker = new Worker(new URL("./metadata-297-worker.ts", import.meta.url), { type: "module" });
  return new Promise<AudioMetadata297>((resolve, reject) => {
    let finished = false;
    const finish = (error?: Error, result?: AudioMetadata297) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error("AUDIO_METADATA_INVALID"));
    };
    const cancel = () => finish(new DOMException("Audio inspection cancelled", "AbortError"));
    const timer = setTimeout(() => finish(new Error("AUDIO_METADATA_TIMEOUT")), AUDIO_METADATA_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent<{ result?: AudioMetadata297; error?: string }>) => {
      if (event.data.error) finish(new Error(event.data.error));
      else finish(undefined, event.data.result);
    };
    worker.onerror = () => finish(new Error("AUDIO_METADATA_INVALID: parser worker failed"));
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    else worker.postMessage({ file, container });
  });
}

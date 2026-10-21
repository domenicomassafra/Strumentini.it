/** Isolated, disposable PCM16 WAV writer. Accepts decoded samples only; no codec claims. */
const MAX_PCM_BYTES = 16 * 1024 * 1024;

type WriteRequest = {
  readonly kind: "write";
  readonly channels: Float32Array[];
  readonly sampleRate: number;
  readonly frames: number;
};

export function writeWav234(
  { channels, sampleRate, frames }: WriteRequest,
  onProgress?: (framesWritten: number, totalFrames: number) => void,
): ArrayBuffer {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000
    || !Number.isSafeInteger(frames) || frames < 1 || channels.length < 1 || channels.length > 2
    || channels.some((channel) => !(channel instanceof Float32Array) || channel.length !== frames)) {
    throw new Error("VIDEO_AUDIO_PCM_INVALID: Campioni PCM non validi.");
  }
  const audioBytes = frames * channels.length * 2;
  if (!Number.isSafeInteger(audioBytes) || audioBytes + 44 > MAX_PCM_BYTES) {
    throw new Error("VIDEO_AUDIO_MEMORY_LIMIT: PCM oltre 16 MiB.");
  }
  const bytes = new ArrayBuffer(44 + audioBytes);
  const view = new DataView(bytes);
  function fourcc(offset: number, value: string) {
    for (let index = 0; index < 4; index++) view.setUint8(offset + index, value.charCodeAt(index));
  }
  fourcc(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true);
  fourcc(8, "WAVE"); fourcc(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM, explicitly not AAC or compressed audio
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  fourcc(36, "data"); view.setUint32(40, audioBytes, true);

  let offset = 44;
  for (let frame = 0; frame < frames; frame++) {
    if ((frame & 8191) === 0) onProgress?.(frame, frames);
    for (let channel = 0; channel < channels.length; channel++) {
      const sample = channels[channel]![frame]!;
      if (!Number.isFinite(sample)) throw new Error("VIDEO_AUDIO_PCM_INVALID: Campioni non finiti.");
      const clipped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, Math.round(clipped * (clipped < 0 ? 32768 : 32767)), true);
      offset += 2;
    }
  }
  onProgress?.(frames, frames);
  return bytes;
}

if (typeof self !== "undefined") {
  self.onmessage = (event: MessageEvent<WriteRequest>) => {
    try {
      const bytes = writeWav234(event.data, (completed, total) =>
        self.postMessage({ kind: "progress", completed, total }));
      self.postMessage({ kind: "done", bytes }, { transfer: [bytes] });
    } catch (error) {
      self.postMessage({ kind: "error", message: error instanceof Error ? error.message : "VIDEO_AUDIO_WORKER_FAILED" });
    }
  };
}

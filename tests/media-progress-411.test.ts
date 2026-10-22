import { describe, expect, it, vi } from "vitest";
import { readMediaFile411 } from "../src/engines/media/read-file-411";
import { renderAudioJob231 } from "../src/engines/browser-audio/timeline-worker-231";
import { pcm16Wav231 } from "./fixtures/audio-dsp-231-corpus";
import { writeWav234 } from "../src/engines/video/wav-worker-234";
import { executeAudioJob231 } from "../src/engines/browser-audio/execute-job-411";
import { inspectMp4Local } from "../src/engines/video/mp4-inspection";
import { awaitMediaTask411 } from "../src/engines/media/await-task-411";

describe("STR-411 real local-file progress and abort", () => {
  it("counts bytes actually read and preserves the input", async () => {
    const source = new Uint8Array(660_000);
    for (let index = 0; index < source.length; index++) source[index] = index % 251;
    const seen: number[] = [];
    const data = await readMediaFile411(new File([source], "large.wav"), {
      maxBytes: 800_000, onProgress: (loaded, total) => {
        expect(total).toBe(source.length);
        seen.push(loaded);
      },
    });
    expect(new Uint8Array(data)).toEqual(source);
    expect(seen.at(-1)).toBe(source.length);
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.every((bytes, index) => bytes > 0 && bytes <= source.length &&
      (index === 0 || bytes > seen[index - 1]!))).toBe(true);
  });

  it("stops reading later chunks on cancellation without a complete result", async () => {
    const controller = new AbortController();
    const seen: number[] = [];
    await expect(readMediaFile411(new File([new Uint8Array(900_000)], "stop.wav"), {
      maxBytes: 900_000, signal: controller.signal,
      onProgress(loaded) { seen.push(loaded); controller.abort(); },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeLessThan(900_000);
  });

  it("aborts a pending browser FileReader without waiting for an absent load event", async () => {
    const original = globalThis.FileReader;
    let aborted = 0;
    let started = 0;
    class PendingReader {
      static readonly LOADING = 1;
      readonly readyState = 1;
      onload?: () => void;
      onerror?: () => void;
      onabort?: () => void;
      readAsArrayBuffer() { started++; }
      abort() { aborted++; this.onabort?.(); }
    }
    globalThis.FileReader = PendingReader as unknown as typeof FileReader;
    const controller = new AbortController();
    try {
      const waiting = readMediaFile411(new File([new Uint8Array(600_000)], "waiting.mp4"), {
        maxBytes: 600_000, signal: controller.signal,
      });
      expect(started).toBe(1);
      controller.abort();
      await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
      expect(aborted).toBe(1);
    } finally { globalThis.FileReader = original; }
  });

  it("distinguishes browser read timeout from user cancellation while actively aborting the reader", async () => {
    const original = globalThis.FileReader;
    vi.useFakeTimers();
    let aborted = 0;
    class SuspendedReader {
      static readonly LOADING = 1;
      readonly readyState = 1;
      onload?: () => void;
      onerror?: () => void;
      onabort?: () => void;
      readAsArrayBuffer() { /* browser read never resolves */ }
      abort() { aborted++; this.onabort?.(); }
    }
    globalThis.FileReader = SuspendedReader as unknown as typeof FileReader;
    try {
      const waiting = readMediaFile411(new File([new Uint8Array(400_000)], "suspended.mp4"), {
        maxBytes: 400_000,
      });
      const assertion = expect(waiting).rejects.toThrow(/MEDIA_411_READ_TIMEOUT/u);
      await vi.advanceTimersByTimeAsync(20_000);
      await assertion;
      expect(aborted).toBe(1);
    } finally { globalThis.FileReader = original; vi.useRealTimers(); }
  });

  it("terminates its worker on cancellation and rejects forged or late progress", async () => {
    const nativeWorker = globalThis.Worker;
    let instance: ControlledWorker;
    class ControlledWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      readonly script: URL;
      stopped = 0;
      constructor(script: URL) { this.script = script; instance = this; }
      postMessage() { /* exercise actual app protocol using controlled worker replies */ }
      terminate() { this.stopped++; }
      emit(payload: unknown) { this.onmessage?.({ data: payload } as MessageEvent); }
    }
    globalThis.Worker = ControlledWorker as unknown as typeof Worker;
    const source = pcm16Wav231([[1, 2, 3, 4]], 8000).buffer as ArrayBuffer;
    const job = { kind: "render" as const, sources: [source], startSeconds: 0,
      endSeconds: null, secondFirst: false, gain: 1, dsp: {} };
    try {
      const cancel = new AbortController();
      const seen: number[] = [];
      const pending = executeAudioJob231(job, cancel.signal, (n) => seen.push(n));
      expect(instance!.script.pathname).toMatch(/src\/engines\/browser-audio\/timeline-worker-231\.ts$/u);
      instance!.emit({ kind: "progress", phase: "output-frames", completed: 2, total: 4 });
      cancel.abort();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      instance!.emit({ kind: "progress", phase: "output-frames", completed: 3, total: 4 });
      expect(seen).toEqual([2]);
      expect(instance!.stopped).toBe(1);

      const invalid = executeAudioJob231(job, new AbortController().signal);
      instance!.emit({ kind: "progress", phase: "output-frames", completed: 5, total: 4 });
      await expect(invalid).rejects.toThrow(/AUDIO_411_PROGRESS_INVALID/u);
      expect(instance!.stopped).toBe(1);
    } finally { globalThis.Worker = nativeWorker; }
  });

  it("reports real rendered frame counts from both audio processing Workers", () => {
    const frames = 16_000;
    const source = pcm16Wav231([new Array(frames).fill(1200)], 8000).buffer as ArrayBuffer;
    const rendered: number[] = [];
    const result = renderAudioJob231({
      kind: "render", sources: [source], startSeconds: 0, endSeconds: null,
      secondFirst: false, gain: 1, dsp: {},
    }, undefined, (n, total) => { expect(total).toBe(frames); rendered.push(n); });
    expect(rendered[0]).toBe(0);
    expect(rendered.at(-1)).toBe(frames);
    expect(new DataView(result.wav).getUint32(40, true)).toBe(frames * 2);
    const encoded: number[] = [];
    const videoWav = writeWav234({ kind: "write", channels: [new Float32Array(frames).fill(0.2)],
      sampleRate: 8000, frames }, (n, total) => {
      expect(total).toBe(frames);
      encoded.push(n);
    });
    expect(encoded[0]).toBe(0);
    expect(encoded.at(-1)).toBe(frames);
    expect(new DataView(videoWav).getUint32(40, true)).toBe(frames * 2);
  });

  it("aborts the MP4 metadata read itself before the full-file read starts", async () => {
    const original = globalThis.FileReader;
    let started = 0;
    let aborted = 0;
    class HangingReader {
      static readonly LOADING = 1;
      readonly readyState = 1;
      onload?: () => void;
      onerror?: () => void;
      onabort?: () => void;
      readAsArrayBuffer() { started++; }
      abort() { aborted++; this.onabort?.(); }
    }
    globalThis.FileReader = HangingReader as unknown as typeof FileReader;
    const controller = new AbortController();
    try {
      const mp4 = new File([new Uint8Array(400_000)], "sample.mp4");
      const awaitingMetadata = inspectMp4Local(mp4, controller.signal);
      expect(started).toBe(1);
      controller.abort();
      await expect(awaitingMetadata).rejects.toMatchObject({ name: "AbortError" });
      expect(aborted).toBe(1);
    } finally { globalThis.FileReader = original; }
  });

  it("settles cancellation and suspension while an unabortable native task is pending", async () => {
    let finishNative!: (value: string) => void;
    const nativeTask = new Promise<string>((resolve) => { finishNative = resolve; });
    const controller = new AbortController();
    const cancelled = awaitMediaTask411(nativeTask, controller.signal, {
      timeoutMs: 45_000, abortMessage: "Operazione annullata", timeoutMessage: "MEDIA_TIMEOUT",
    });
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    finishNative("late success");
    await Promise.resolve();

    vi.useFakeTimers();
    try {
      const waiting = awaitMediaTask411(new Promise<string>(() => undefined), undefined, {
        timeoutMs: 250, abortMessage: "Operazione annullata", timeoutMessage: "MEDIA_TIMEOUT",
      });
      const assertion = expect(waiting).rejects.toThrow("MEDIA_TIMEOUT");
      await vi.advanceTimersByTimeAsync(250);
      await assertion;
    } finally { vi.useRealTimers(); }
  });

  it("rejects a truncated slice and oversized source before claiming completion", async () => {
    const file = new File(["ABCD"], "corrupted.mp4");
    Object.defineProperty(file, "slice", { value: () => new Blob(["A"]) });
    const seen: number[] = [];
    await expect(readMediaFile411(file, { maxBytes: 4, onProgress(n) { seen.push(n); } }))
      .rejects.toThrow(/MEDIA_411_SHORT_READ/u);
    expect(seen).toEqual([]);
    await expect(readMediaFile411(new File(["12345"], "too-big.wav"), { maxBytes: 4 }))
      .rejects.toThrow(/MEDIA_411_INPUT_LIMIT/u);
  });
});

import { WHISPER_298_MODEL, WHISPER_298_REVISION, WHISPER_298_HZ } from "./whisper-298";

type Pipeline = Awaited<ReturnType<typeof import("@huggingface/transformers")["pipeline"]>>;
type Input = { kind: "start"; pcm: ArrayBuffer } | { kind: "pause" } | { kind: "resume" };
let paused = false;
let resume: (() => void) | null = null;
let running = false;

async function waitWhilePaused() {
  while (paused) await new Promise<void>((resolve) => { resume = resolve; });
}

self.onmessage = async (event: MessageEvent<Input>) => {
  if (event.data.kind === "pause") { paused = true; self.postMessage({ kind: "pause-requested" }); return; }
  if (event.data.kind === "resume") { paused = false; resume?.(); resume = null; return; }
  if (running) return;
  if (event.data.kind !== "start") return;
  running = true;
  const started = performance.now();
  try {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.remoteHost = "https://huggingface.co/";
    const transcriber: Pipeline = await pipeline("automatic-speech-recognition", WHISPER_298_MODEL, {
      revision: WHISPER_298_REVISION,
      device: "wasm",
      dtype: "q8",
      progress_callback: (progress) => {
        const item = progress as { status?: string; progress?: number; file?: string };
        if (["initiate", "progress", "done", "ready"].includes(item.status ?? "")) {
          self.postMessage({ kind: "loading", phase: item.status, percent: Number.isFinite(item.progress) ? item.progress : null });
        }
      },
    });
    self.postMessage({ kind: "ready", loadingMs: Math.round(performance.now() - started) });
    const samples = new Float32Array(event.data.pcm);
    const parts: string[] = [];
    const windowSamples = 15 * WHISPER_298_HZ;
    for (let start = 0; start < samples.length; start += windowSamples) {
      await waitWhilePaused();
      self.postMessage({ kind: "processing", processedSeconds: start / WHISPER_298_HZ });
      const chunk = samples.subarray(start, Math.min(samples.length, start + windowSamples));
      let energy = 0;
      for (const sample of chunk) energy += sample * sample;
      if (Math.sqrt(energy / chunk.length) < 0.001) continue;
      const out = await transcriber(chunk, { language: "italian", task: "transcribe", return_timestamps: false });
      if (!out || typeof out !== "object" || !("text" in out) || typeof out.text !== "string") {
        throw new Error("ASR_BAD_RESULT");
      }
      const piece = out.text.trim();
      if (piece) parts.push(piece);
    }
    if (!parts.length) throw new Error("ASR_EMPTY_RESULT");
    self.postMessage({ kind: "result", text: parts.join(" "), elapsedMs: Math.round(performance.now() - started) });
  } catch (error) {
    self.postMessage({ kind: "error", code: error instanceof Error ? error.message.slice(0, 100) : "MODEL_RUNTIME_ERROR" });
  } finally { running = false; }
};

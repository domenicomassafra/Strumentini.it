import { createZip, inspectZip } from "../file-privacy";
import { captureVideoFrame305, validateFrameRequest305, type VideoFrame305Result } from "./frame-extract-305";
import { inspectMp4Local, type Mp4Inspection } from "./mp4-inspection";
import { readMediaFile411 } from "../media/read-file-411";
import { awaitMediaTask411 } from "../media/await-task-411";

/** An export is valid only when the browser supplies actual presented-frame timestamps.
 * A seek target by itself is not evidence of which frame was decoded. */
export interface ContactFrame308 {
  readonly filename: string;
  readonly requestedSeconds: number;
  readonly presentedSeconds: number;
  readonly presentationErrorSeconds: number;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
  readonly blob: Blob;
}

export interface ContactSheet308Result {
  readonly frames: readonly ContactFrame308[];
  readonly sheet: Blob;
  readonly zip: Blob;
  readonly manifest: string;
  readonly zipEntries: readonly string[];
  readonly sourceSha256: string;
  readonly inspection: Mp4Inspection;
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FRAME_COUNT = 8;
const MAX_PRESENTATION_ERROR = 0.16;

function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Esportazione annullata", "AbortError");
}

export function planContactFrames308(duration: number, count: number): readonly number[] {
  if (!Number.isFinite(duration) || duration <= 0.05 || duration > 3600) throw new Error("VIDEO_CONTACT_DURATION: Durata non supportata.");
  if (!Number.isInteger(count) || count < 2 || count > MAX_FRAME_COUNT) throw new Error("VIDEO_CONTACT_COUNT: Scegli 2–8 fotogrammi.");
  const values = Array.from({ length: count }, (_, index) =>
    Math.round(((index + 1) * duration / (count + 1)) * 1000) / 1000);
  if (new Set(values).size !== values.length || values[0]! <= 0 || values.at(-1)! >= duration) {
    throw new Error("VIDEO_CONTACT_TIMELINE: I timestamp si sovrappongono.");
  }
  return values;
}

export function verifyPresentedFrame308(frame: VideoFrame305Result): number {
  const actual = frame.reportedPresentationSeconds;
  if (frame.timestampEvidence !== "presented-frame-callback" || actual === null || !Number.isFinite(actual)
    || actual < 0 || frame.absoluteErrorSeconds === null || frame.absoluteErrorSeconds > MAX_PRESENTATION_ERROR) {
    throw new Error("VIDEO_CONTACT_TIMESTAMP_UNVERIFIED: Il browser non conferma il fotogramma richiesto entro 160 ms; nessun ZIP generato.");
  }
  return actual;
}

async function hashBlob(blob: Blob, signal?: AbortSignal,
  onProgress?: (bytes: number, total: number) => void): Promise<string> {
  const data = await readMediaFile411(blob, { maxBytes: MAX_FILE_BYTES, signal, onProgress });
  cancelled(signal);
  const bytes = await awaitMediaTask411(crypto.subtle.digest("SHA-256", data), signal, {
    timeoutMs: 45_000,
    abortMessage: "Hash video annullato",
    timeoutMessage: "VIDEO_CONTACT_HASH_TIMEOUT: Calcolo sospeso; torna in primo piano e riprova.",
  });
  cancelled(signal);
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob || blob.type !== "image/png" || blob.size === 0 || blob.size > 24 * 1024 * 1024) {
    throw new Error("VIDEO_CONTACT_PNG: Immagine finale non verificabile.");
  }
  return blob;
}

async function drawSheet(frames: readonly ContactFrame308[], signal?: AbortSignal): Promise<Blob> {
  const columns = Math.min(2, frames.length);
  const rows = Math.ceil(frames.length / columns);
  const cellWidth = 320;
  const cellHeight = 230;
  const canvas = document.createElement("canvas");
  canvas.width = columns * cellWidth;
  canvas.height = rows * cellHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("VIDEO_CONTACT_CANVAS_UNAVAILABLE");
  try {
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px sans-serif";
    for (let index = 0; index < frames.length; index++) {
      cancelled(signal);
      const frame = frames[index]!;
      const bitmap = await createImageBitmap(frame.blob);
      try {
        const x = (index % columns) * cellWidth;
        const y = Math.floor(index / columns) * cellHeight;
        const ratio = Math.min(300 / bitmap.width, 185 / bitmap.height);
        const imageWidth = Math.round(bitmap.width * ratio);
        const imageHeight = Math.round(bitmap.height * ratio);
        ctx.drawImage(bitmap, x + Math.round((cellWidth - imageWidth) / 2), y + Math.round((195 - imageHeight) / 2), imageWidth, imageHeight);
        ctx.fillText(`${index + 1} · presentato ${frame.presentedSeconds.toFixed(3)} s`, x + 12, y + 215);
      } finally { bitmap.close(); }
    }
    cancelled(signal);
    return await pngBlob(canvas);
  } finally { canvas.width = 0; canvas.height = 0; }
}

export async function packageContactSheet308(args: {
  readonly source: File;
  readonly inspection: Mp4Inspection;
  readonly frames: readonly ContactFrame308[];
  readonly sheet: Blob;
  readonly sourceSha256: string;
}, signal?: AbortSignal): Promise<Pick<ContactSheet308Result, "zip" | "manifest" | "zipEntries">> {
  cancelled(signal);
  if (args.frames.length < 2 || args.frames.length > MAX_FRAME_COUNT || args.sheet.type !== "image/png") throw new Error("VIDEO_CONTACT_PACKAGE: Incomplete output.");
  const manifest = JSON.stringify({
    schema: "strumentini-video-contact-sheet/v1",
    source: {
      filename: args.source.name, bytes: args.source.size, sha256: args.sourceSha256,
      container: args.inspection.container, brand: args.inspection.majorBrand,
      declaredDurationSeconds: args.inspection.durationSeconds,
      declaredVideoTracks: args.inspection.videoTracks,
      declaredAudioTracks: args.inspection.audioTracks,
      fragmented: args.inspection.containsMovieFragments,
    },
    timingPolicy: "browser-presented-frame-callback; error <= 0.16 s; no inferred frame precision",
    sheet: { filename: "contact-sheet.png", width: 640, height: Math.ceil(args.frames.length / 2) * 230 },
    frames: args.frames.map((frame) => ({
      filename: frame.filename, requestedSeconds: frame.requestedSeconds,
      presentedSeconds: frame.presentedSeconds, absoluteErrorSeconds: frame.presentationErrorSeconds,
      sha256: frame.sha256, width: frame.width, height: frame.height,
    })),
    generatedInterpretation: null,
  }, null, 2) + "\n";
  const entries = ["contact-sheet.png", ...args.frames.map((frame) => frame.filename), "manifest.json"];
  if (new Set(entries).size !== entries.length) throw new Error("VIDEO_CONTACT_DUPLICATE_ENTRY");
  const files = [new File([args.sheet], entries[0]!, { type: "image/png" }),
    ...args.frames.map((frame) => new File([frame.blob], frame.filename, { type: "image/png" })),
    new File([manifest], "manifest.json", { type: "application/json" })];
  const zipped = await createZip({ files }, signal);
  if (!("blob" in zipped) || !(zipped.blob instanceof Blob) || zipped.compression !== "store") throw new Error("VIDEO_CONTACT_ZIP_FAILED");
  const checked = await inspectZip({ files: [new File([zipped.blob], "contact-sheet.zip", { type: "application/zip" })] }, signal);
  cancelled(signal);
  const found = "entries" in checked && Array.isArray(checked.entries) ? checked.entries : [];
  if (found.length !== entries.length || found.some((item, index) => item.path !== entries[index] || item.method !== 0)) throw new Error("VIDEO_CONTACT_ZIP_VERIFY_FAILED");
  return { zip: zipped.blob, manifest, zipEntries: entries };
}

export async function exportVideoContactSheet308(
  video: HTMLVideoElement, source: File, count: number, signal?: AbortSignal,
  onProgress?: (phase: "read" | "frames", completed: number, total: number) => void,
): Promise<ContactSheet308Result> {
  if (source.size <= 0 || source.size > MAX_FILE_BYTES || !/\.(mp4|m4v)$/iu.test(source.name)) {
    throw new Error("VIDEO_CONTACT_SOURCE: Serve un MP4 locale, massimo 50 MiB.");
  }
  if (!video.requestVideoFrameCallback) throw new Error("VIDEO_CONTACT_UNSUPPORTED: Il browser non rende verificabile il timestamp dei fotogrammi.");
  const inspection = await inspectMp4Local(source, signal);
  if (inspection.containsMovieFragments || inspection.durationSeconds === null) throw new Error("VIDEO_CONTACT_DURATION_UNVERIFIED: Durata MP4 non verificata.");
  if (Math.abs(inspection.durationSeconds - video.duration) > 0.2) throw new Error("VIDEO_CONTACT_DURATION_MISMATCH: Durata browser e MP4 incoerenti.");
  const times = planContactFrames308(inspection.durationSeconds, count);
  const frames: ContactFrame308[] = [];
  const sourceSha256 = await hashBlob(source, signal, (completed, total) =>
    onProgress?.("read", completed, total));
  cancelled(signal);
  onProgress?.("frames", 0, times.length);
  for (let index = 0; index < times.length; index++) {
    cancelled(signal);
    validateFrameRequest305(times[index]!, video.duration, video.videoWidth, video.videoHeight);
    const extracted = await captureVideoFrame305(video, times[index]!, signal);
    const presented = verifyPresentedFrame308(extracted);
    frames.push({
      filename: `frame-${String(index + 1).padStart(2, "0")}.png`,
      requestedSeconds: times[index]!, presentedSeconds: presented,
      presentationErrorSeconds: Math.abs(presented - times[index]!),
      sha256: await hashBlob(extracted.blob, signal), width: extracted.width, height: extracted.height, blob: extracted.blob,
    });
    cancelled(signal);
    onProgress?.("frames", index + 1, times.length);
  }
  const sheet = await drawSheet(frames, signal);
  const archive = await packageContactSheet308({ source, inspection, frames, sheet, sourceSha256 }, signal);
  cancelled(signal);
  return { ...archive, frames, sheet, sourceSha256, inspection };
}

/** Video frame capture from a local, already decoded HTMLVideoElement.
 *
 * This browser operation is not frame-accurate editing: seek granularity and
 * presentation callbacks differ by engine and codec. A frame presentation
 * mediaTime is reported when the browser actually supplies it; otherwise the
 * decoded frame's timestamp remains unknown (never guessed from currentTime).
 */
export interface VideoFrame305Result {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly requestedSeconds: number;
  readonly reportedPresentationSeconds: number | null;
  readonly absoluteErrorSeconds: number | null;
  readonly timestampEvidence: "presented-frame-callback" | "unavailable-in-browser";
}

const MAX_VIDEO_PIXELS = 8_000_000;
const MAX_SECONDS = 3600;

export function validateFrameRequest305(seconds: number, durationSeconds: number, width: number, height: number): void {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0
    || durationSeconds > MAX_SECONDS || seconds >= durationSeconds) {
    throw new Error("VIDEO_FRAME_RANGE: Richiesta fuori durata, 0 ≤ secondi < durata (massimo 3600 s).");
  }
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || width * height > MAX_VIDEO_PIXELS || width > 8192 || height > 8192) {
    throw new Error("VIDEO_FRAME_PIXEL_LIMIT: Fotogramma troppo grande per l'elaborazione locale.");
  }
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Frame extraction cancelled", "AbortError");
}

export async function captureVideoFrame305(video: HTMLVideoElement, seconds: number, signal?: AbortSignal): Promise<VideoFrame305Result> {
  if (typeof document === "undefined" || video.readyState < HTMLMediaElement.HAVE_METADATA) {
    throw new Error("VIDEO_FRAME_NOT_READY: Metadati video non disponibili.");
  }
  validateFrameRequest305(seconds, video.duration, video.videoWidth, video.videoHeight);
  abortIfNeeded(signal);
  video.pause();

  // Register before seeking so the browser presentation event isn't lost.
  let callbackHandle: number | undefined;
  let resolveCallback: ((seconds: number | null) => void) | undefined;
  const callbackPromise = new Promise<number | null>((resolve) => { resolveCallback = resolve; });
  if (typeof video.requestVideoFrameCallback === "function") {
    callbackHandle = video.requestVideoFrameCallback((_now, metadata) => {
      resolveCallback?.(Number.isFinite(metadata.mediaTime) ? metadata.mediaTime : null);
    });
  } else resolveCallback?.(null);

  let onSeeked: (() => void) | undefined;
  let onError: (() => void) | undefined;
  let onAbort: (() => void) | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const seeked = new Promise<void>((resolve, reject) => {
      onSeeked = () => resolve();
      onError = () => reject(new Error("VIDEO_SEEK_FAILED: Il browser non riesce a decodificare questo istante."));
      onAbort = () => reject(new DOMException("Frame extraction cancelled", "AbortError"));
      video.addEventListener("seeked", onSeeked!, { once: true });
      video.addEventListener("error", onError!, { once: true });
      signal?.addEventListener("abort", onAbort!, { once: true });
      timeoutId = setTimeout(() => reject(new Error("VIDEO_SEEK_TIMEOUT: Posizione del frame non raggiunta.")), 8000);
    });
    video.currentTime = seconds;
    await seeked;
    abortIfNeeded(signal);
    // rVFC is not universally triggered while paused; do not fake a frame time
    // when it does not arrive. Rendering still requires browser decoding.
    const presentation = await Promise.race([
      callbackPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)),
    ]);
    abortIfNeeded(signal);
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) throw new Error("VIDEO_FRAME_NOT_DECODED: Nessun fotogramma disponibile.");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("VIDEO_FRAME_CANVAS_UNAVAILABLE");
    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      abortIfNeeded(signal);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) =>
        value === null ? reject(new Error("VIDEO_FRAME_ENCODE_FAILED")) : resolve(value), "image/png"));
      abortIfNeeded(signal);
      if (blob.type !== "image/png" || blob.size === 0 || blob.size > 24 * 1024 * 1024) throw new Error("VIDEO_FRAME_PNG_UNSUPPORTED");
      return {
        blob, width: canvas.width, height: canvas.height, requestedSeconds: seconds,
        reportedPresentationSeconds: presentation,
        absoluteErrorSeconds: presentation === null ? null : Math.abs(presentation - seconds),
        timestampEvidence: presentation === null ? "unavailable-in-browser" : "presented-frame-callback",
      };
    } finally { canvas.width = 0; canvas.height = 0; }
  } finally {
    if (onSeeked) video.removeEventListener("seeked", onSeeked);
    if (onError) video.removeEventListener("error", onError);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (callbackHandle !== undefined && typeof video.cancelVideoFrameCallback === "function") video.cancelVideoFrameCallback(callbackHandle);
  }
}

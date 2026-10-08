/**
 * Video target-size planning, independent of media decoding and transcoding.
 * A mathematical budget is not evidence that a given encoder can achieve it.
 * Decimal MB and binary MiB are intentionally distinct.
 */
export type VideoSizeUnit = "MB" | "MiB";

export interface VideoTargetSizeInput {
  readonly durationSeconds: number;
  readonly targetSize: number;
  readonly unit: VideoSizeUnit;
  /** When absent, the audio bitrate is UNKNOWN, not silently assumed zero. */
  readonly audioBitrateBps?: number | null;
  /** Caller-supplied container overhead budget; not measured or inferred. */
  readonly reservedOverheadBytes?: number;
}

export interface VideoTargetSizePlan {
  readonly targetBytes: number;
  readonly durationSeconds: number;
  readonly unit: VideoSizeUnit;
  readonly reservedOverheadBytes: number;
  /** Total stream budget after the explicit overhead reservation. */
  readonly totalStreamBitrateBps: number;
  /** Null means the audio share cannot be subtracted reliably. */
  readonly videoBitrateBps: number | null;
  readonly audioBitrateBps: number | null;
  readonly observedContainerOverhead: false;
  readonly achievesTargetSize: "unknown";
}

const BYTE_MULTIPLIER: Readonly<Record<VideoSizeUnit, number>> = {
  MB: 1_000_000,
  MiB: 1_048_576,
};

function positiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite`);
}

/**
 * Pure estimate. Does not inspect streams or guess fps, rotation, stream count,
 * codec overhead, achievable rate control, or whether audio exists.
 */
export function planVideoTargetSize(input: VideoTargetSizeInput): VideoTargetSizePlan {
  positiveFinite(input.targetSize, "targetSize");
  positiveFinite(input.durationSeconds, "durationSeconds");
  if (!Object.hasOwn(BYTE_MULTIPLIER, input.unit)) throw new RangeError("unit must be MB or MiB");
  const bytes = input.targetSize * BYTE_MULTIPLIER[input.unit];
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > Math.floor(Number.MAX_SAFE_INTEGER / 8)) {
    throw new RangeError("targetBytes is outside the safely calculable budget range");
  }
  const overhead = input.reservedOverheadBytes ?? 0;
  if (!Number.isSafeInteger(overhead) || overhead < 0 || overhead >= bytes) {
    throw new RangeError("reservedOverheadBytes must be a nonnegative safe integer less than targetBytes");
  }
  const audio = input.audioBitrateBps ?? null;
  if (audio !== null && (!Number.isSafeInteger(audio) || audio < 0)) {
    throw new RangeError("audioBitrateBps must be a nonnegative safe integer or unknown");
  }
  const total = Math.floor(((bytes - overhead) * 8) / input.durationSeconds);
  if (!Number.isSafeInteger(total) || total < 1) throw new RangeError("target is too small for the duration");
  if (audio !== null && audio >= total) throw new RangeError("audio bitrate consumes the entire target budget");
  return {
    targetBytes: bytes,
    durationSeconds: input.durationSeconds,
    unit: input.unit,
    reservedOverheadBytes: overhead,
    totalStreamBitrateBps: total,
    videoBitrateBps: audio === null ? null : total - audio,
    audioBitrateBps: audio,
    observedContainerOverhead: false,
    achievesTargetSize: "unknown",
  };
}

/** Theoretical payload bytes for a measured/supplied aggregate bit rate. */
export function estimateVideoStreamBytes(bitrateBps: number, durationSeconds: number): number {
  if (!Number.isSafeInteger(bitrateBps) || bitrateBps < 0) throw new RangeError("bitrateBps must be a nonnegative safe integer");
  positiveFinite(durationSeconds, "durationSeconds");
  const bytes = bitrateBps * durationSeconds / 8;
  if (!Number.isFinite(bytes) || bytes > Number.MAX_SAFE_INTEGER) throw new RangeError("estimated bytes exceed safe numeric range");
  return bytes;
}

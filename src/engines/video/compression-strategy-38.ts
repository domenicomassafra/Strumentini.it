import { planVideoTargetSize } from "./target-size";
// Historical budgeting constraints retained for offline receipt validation
// after the #126 removal of the Mediabunny conversion worker.
const VIDEO_234_LIMITS = {
  minTrimSeconds: 0.4, maxDurationSeconds: 12,
  minBitrateBps: 180_000, maxBitrateBps: 3_000_000,
} as const;

/**
 * Compression strategy for #38. These are encoder *requests*, not promises
 * that a given VBR encoder will achieve a size or reduce an already compressed
 * input. Always report the actual output size after encoding.
 */
export type CompressionStrategy38 =
  | { readonly mode: "bitrate"; readonly videoBitrateKbps: number }
  | { readonly mode: "target-size"; readonly targetMegabytes: number };

export type CompressionPlan38 = {
  readonly strategy: CompressionStrategy38["mode"];
  readonly requestedVideoBitrateBps: number;
  readonly requestedSizeBytes: number | null;
  readonly estimatedOutputBytes: number;
  readonly overheadReserveBytes: number;
  readonly audioBitrateBps: 96000;
  readonly targetGuarantee: false;
};

export function planCompression38(strategy: CompressionStrategy38, seconds: number): CompressionPlan38 {
  if (!Number.isFinite(seconds) || seconds < VIDEO_234_LIMITS.minTrimSeconds
    || seconds > VIDEO_234_LIMITS.maxDurationSeconds + 0.001) {
    throw new Error("VIDEO_38_DURATION: Fornisci una durata clip verificata (0,4–12 s).");
  }
  let bitrate: number;
  let requestedSizeBytes: number | null = null;
  const overheadReserveBytes = 4096;
  if (strategy.mode === "target-size") {
    if (!Number.isFinite(strategy.targetMegabytes) || strategy.targetMegabytes <= 0
      || strategy.targetMegabytes > 8 || !Number.isSafeInteger(strategy.targetMegabytes * 1_000_000)) {
      throw new Error("VIDEO_38_TARGET_SIZE: Obiettivo 0–8 MB decimali in byte interi.");
    }
    let sizing;
    try {
      sizing = planVideoTargetSize({
        durationSeconds: seconds, targetSize: strategy.targetMegabytes, unit: "MB",
        audioBitrateBps: 96000, reservedOverheadBytes: overheadReserveBytes,
      });
    } catch {
      throw new Error("VIDEO_38_TARGET_SIZE: Budget insufficiente per audio AAC 96 kbit/s e overhead stimato.");
    }
    requestedSizeBytes = sizing.targetBytes;
    bitrate = sizing.videoBitrateBps!;
  } else {
    bitrate = strategy.videoBitrateKbps * 1000;
    if (!Number.isInteger(strategy.videoBitrateKbps)) {
      throw new Error("VIDEO_38_BITRATE: Specifica kbit/s interi.");
    }
  }
  if (!Number.isSafeInteger(bitrate) || bitrate < VIDEO_234_LIMITS.minBitrateBps
    || bitrate > VIDEO_234_LIMITS.maxBitrateBps) {
    throw new Error("VIDEO_38_TARGET_UNSUPPORTED: Obiettivo fuori intervallo encoder (video 180–3000 kbit/s).");
  }
  return {
    strategy: strategy.mode, requestedVideoBitrateBps: bitrate, requestedSizeBytes,
    estimatedOutputBytes: Math.ceil((bitrate + 96000) * seconds / 8 + overheadReserveBytes),
    overheadReserveBytes, audioBitrateBps: 96000, targetGuarantee: false,
  };
}

export type CompressionReceipt38 = {
  readonly sourceBytes: number;
  readonly outputBytes: number;
  readonly savedBytes: number;
  readonly savedPercent: number;
  readonly actualAvgTotalBitrateBps: number;
  readonly requestedSizeBytes: number | null;
  readonly targetAchieved: boolean | null;
  readonly strategy: CompressionStrategy38["mode"];
};

export function measureCompression38(plan: CompressionPlan38, sourceBytes: number, outputBytes: number, measuredSeconds: number): CompressionReceipt38 {
  if (!Number.isSafeInteger(sourceBytes) || !Number.isSafeInteger(outputBytes)
    || sourceBytes < 1 || outputBytes < 1 || !Number.isFinite(measuredSeconds) || measuredSeconds <= 0) {
    throw new Error("VIDEO_38_MEASURE: Misure output non valide.");
  }
  return {
    sourceBytes, outputBytes, savedBytes: sourceBytes - outputBytes,
    savedPercent: Math.round((sourceBytes - outputBytes) / sourceBytes * 10_000) / 100,
    actualAvgTotalBitrateBps: Math.round(8 * outputBytes / measuredSeconds),
    requestedSizeBytes: plan.requestedSizeBytes,
    targetAchieved: plan.requestedSizeBytes === null ? null : outputBytes <= plan.requestedSizeBytes,
    strategy: plan.strategy,
  };
}

/** Bounded 48 kHz mono/stereo, offline BS.1770-5 K-weighted programme loudness.
 *
 * Based on the published ITU 48 kHz second-order filter tables and the EBU
 * Tech 3341 integrated 400 ms / 75%-overlap two-pass gate. This deliberately
 * does NOT calculate true peak, loudness range (LRA) or programme compliance.
 * Other channel layouts/sample rates are rejected rather than mislabeled.
 */
export interface Loudness307Result {
  readonly standard: "ITU-R BS.1770-5 (48 kHz mono/stereo subset; EBU Tech 3341 gating)";
  readonly durationSeconds: number;
  readonly sampleRate: 48000;
  readonly channelCount: 1 | 2;
  readonly integratedLufs: number | null;
  readonly momentaryLufs: number | null;
  readonly shortTermLufs: number | null;
  readonly samplePeakDbfs: number | null;
  readonly absoluteGatedBlocks: number;
  readonly relativeGatedBlocks: number;
  readonly caveat: string;
}

const RATE = 48_000;
const MAX_FRAMES = RATE * 60;
const PRE = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585] as const;
const HIGH = [1, -2, 1, -1.99004745483398, 0.99007225036621] as const;

function kWeighted(input: Float32Array): Float64Array {
  // The second filter needs the full precision result of the first, not a
  // down-converted Float32Array. Deliberately implement both in one pass.
  let pX1 = 0, pX2 = 0, pY1 = 0, pY2 = 0;
  let hX1 = 0, hX2 = 0, hY1 = 0, hY2 = 0;
  const output = new Float64Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const x = input[i]!;
    if (!Number.isFinite(x) || Math.abs(x) > 1) throw new Error("AUDIO_INVALID_SIGNAL: PCM values must be finite and within [-1,1]");
    const p = PRE[0] * x + PRE[1] * pX1 + PRE[2] * pX2 - PRE[3] * pY1 - PRE[4] * pY2;
    const h = HIGH[0] * p + HIGH[1] * hX1 + HIGH[2] * hX2 - HIGH[3] * hY1 - HIGH[4] * hY2;
    if (!Number.isFinite(h)) throw new Error("AUDIO_INVALID_SIGNAL: Filter result must be finite");
    pX2 = pX1; pX1 = x; pY2 = pY1; pY1 = p;
    hX2 = hX1; hX1 = p; hY2 = hY1; hY1 = h;
    output[i] = h;
  }
  return output;
}

const toLufs = (power: number): number | null => power > 0 ? -0.691 + 10 * Math.log10(power) : null;
const average = (items: readonly number[]): number => items.reduce((a, b) => a + b, 0) / items.length;

export function analyzeLoudness307(channels: readonly Float32Array[], sampleRate: number, signal?: AbortSignal): Loudness307Result {
  if (sampleRate !== RATE || (channels.length !== 1 && channels.length !== 2)) {
    throw new Error("AUDIO_UNSUPPORTED_LAYOUT: Only mono/stereo PCM at 48000 Hz is supported");
  }
  const frames = channels[0]?.length ?? 0;
  if (frames < RATE * 0.4 || frames > MAX_FRAMES || channels.some((c) => c.length !== frames || !(c instanceof Float32Array))) {
    throw new Error("AUDIO_LIMIT: Audio must be 0.4–60 seconds, matching 48 kHz channels");
  }
  const energies = new Float64Array(frames + 1);
  let peak = 0;
  for (const channel of channels) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const weighted = kWeighted(channel);
    for (let i = 0; i < frames; i += 1) {
      if ((i & 65535) === 0 && signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      peak = Math.max(peak, Math.abs(channel[i]!));
      energies[i + 1] = energies[i + 1]! + weighted[i]! * weighted[i]!;
    }
  }
  for (let i = 1; i <= frames; i += 1) energies[i] = energies[i]! + energies[i - 1]!;
  const power = (start: number, length: number): number => (energies[start + length]! - energies[start]!) / length;
  const blockSize = RATE * 0.4;
  const hop = RATE * 0.1;
  const blocks: number[] = [];
  for (let offset = 0; offset + blockSize <= frames; offset += hop) blocks.push(power(offset, blockSize));
  const abs = blocks.filter((v) => (toLufs(v) ?? -Infinity) > -70);
  const preliminary = abs.length ? toLufs(average(abs)) : null;
  const relativeLimit = preliminary === null ? -Infinity : preliminary - 10;
  const rel = abs.filter((v) => (toLufs(v) ?? -Infinity) > relativeLimit);
  const end = Math.max(0, frames - blockSize);
  const shortLength = Math.min(frames, RATE * 3);
  const integrated = rel.length ? toLufs(average(rel)) : null;
  return {
    standard: "ITU-R BS.1770-5 (48 kHz mono/stereo subset; EBU Tech 3341 gating)",
    durationSeconds: frames / RATE, sampleRate: RATE, channelCount: channels.length as 1 | 2,
    integratedLufs: integrated, momentaryLufs: toLufs(power(end, blockSize)),
    shortTermLufs: toLufs(power(frames - shortLength, shortLength)),
    samplePeakDbfs: peak > 0 ? 20 * Math.log10(peak) : null,
    absoluteGatedBlocks: abs.length, relativeGatedBlocks: rel.length,
    caveat: "Offline only; this is not EBU Mode certification. No true-peak oversampling or LRA; mono/stereo only; decoder resampling and physical devices unverified.",
  };
}

import { readMediaFile411 } from "../media/read-file-411";

/**
 * Bounded ISO BMFF/MP4 container inspection. No transcoder, decoder, network,
 * codec probing or inferred frame-rate claims. Unknown data stays unknown.
 * Only the `moov` atom is read; potentially huge `mdat` data is skipped.
 */

const MAX_MOOV_BYTES = 8 * 1024 * 1024;
const MAX_TOP_BOXES = 2_048;
const MAX_NESTED_BOXES = 10_000;
const MAX_TIMED_SAMPLES = 100_000;
const MAX_PRESENTATION_SAMPLES_PER_FILE = 200_000;

type Box = { readonly type: string; readonly start: number; readonly end: number; readonly payload: number };

export type Mp4TrackKind = "video" | "audio" | "other" | "unknown";

export interface Mp4TrackInspection {
  readonly id: number | null;
  readonly kind: Mp4TrackKind;
  readonly codecFourCc: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly matrix: readonly [number, number, number, number] | null;
  readonly quarterTurnDegrees: 0 | 90 | 180 | 270 | null;
  /** FPS only for a proven constant presentation cadence. Never an estimated VFR average. */
  readonly frameRate: number | null;
  readonly frameRateMode: "cfr" | "vfr" | "unknown";
  /** Decode-time stts evidence only; this field is not a presentation-rate conclusion. */
  readonly decodeTiming: "constant-sample-deltas-observed" | "variable-sample-deltas-observed" | "not-proven";
}

export interface Mp4Inspection {
  readonly container: "iso-bmff-mp4";
  readonly majorBrand: string;
  readonly bytes: number;
  readonly durationSeconds: number | null;
  /** Container-wide throughput, not measured video/audio stream bitrate. */
  readonly averageContainerBitrateBps: number | null;
  readonly totalTracks: number;
  readonly videoTracks: number;
  readonly audioTracks: number;
  readonly containsMovieFragments: boolean;
  readonly tracks: readonly Mp4TrackInspection[];
  readonly warnings: readonly string[];
}

function fail(message: string): never {
  throw new Error(`UNSUPPORTED_VIDEO_CONTAINER: ${message}`);
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function u32(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) fail("Truncated 32-bit MP4 field");
  return view(bytes).getUint32(offset, false);
}

function u64(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 8 > bytes.length) fail("Truncated 64-bit MP4 field");
  const value = view(bytes).getBigUint64(offset, false);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail("MP4 size exceeds safe local numeric bounds");
  return Number(value);
}

function fourcc(bytes: Uint8Array, offset: number): string {
  if (offset < 0 || offset + 4 > bytes.length) fail("Truncated MP4 box type");
  return String.fromCharCode(...bytes.subarray(offset, offset + 4));
}

function header(bytes: Uint8Array, start: number, availableEnd: number): Box {
  if (start + 8 > availableEnd) fail("Truncated MP4 box header");
  const declaredSize = u32(bytes, start);
  const type = fourcc(bytes, start + 4);
  const head = declaredSize === 1 ? 16 : 8;
  if (start + head > availableEnd) fail("Truncated extended MP4 box header");
  const size = declaredSize === 0 ? availableEnd - start : declaredSize === 1 ? u64(bytes, start + 8) : declaredSize;
  if (!Number.isSafeInteger(size) || size < head || size > availableEnd - start) fail(`Invalid or truncated MP4 box ${type}`);
  return { type, start, end: start + size, payload: start + head };
}

function children(bytes: Uint8Array, begin: number, end: number): Box[] {
  const result: Box[] = [];
  let cursor = begin;
  while (cursor < end) {
    if (result.length >= MAX_NESTED_BOXES) fail("Too many nested MP4 boxes");
    const box = header(bytes, cursor, end);
    result.push(box);
    cursor = box.end;
  }
  return result;
}

function first(items: readonly Box[], type: string): Box | undefined {
  return items.find((item) => item.type === type);
}

function movieDuration(bytes: Uint8Array, mvhd: Box | undefined): number | null {
  if (!mvhd) return null;
  const offset = mvhd.payload;
  const version = bytes[offset];
  if (version !== 0 && version !== 1) return null;
  const timescaleOffset = offset + (version === 1 ? 20 : 12);
  const durationOffset = timescaleOffset + 4;
  if (durationOffset + (version === 1 ? 8 : 4) > mvhd.end) return null;
  const scale = u32(bytes, timescaleOffset);
  const raw = version === 1 ? u64(bytes, durationOffset) : u32(bytes, durationOffset);
  if (scale === 0 || raw === (version === 1 ? Number.MAX_SAFE_INTEGER : 0xffffffff)) return null;
  const duration = raw / scale;
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

function timescaleOf(bytes: Uint8Array, box: Box | undefined): number | null {
  if (!box || box.payload + 4 > box.end) return null;
  const version = bytes[box.payload];
  if (version !== 0 && version !== 1) return null;
  const offset = box.payload + (version === 1 ? 20 : 12);
  if (offset + 4 > box.end) return null;
  const scale = u32(bytes, offset);
  return scale > 0 ? scale : null;
}

function fullBoxFlagsZero(bytes: Uint8Array, box: Box): boolean {
  return box.payload + 4 <= box.end
    && bytes[box.payload + 1] === 0
    && bytes[box.payload + 2] === 0
    && bytes[box.payload + 3] === 0;
}

/**
 * A single unit-rate edit at media_time=0 is an identity mapping, rather than
 * a cut/shift. FFmpeg writes this explicit identity elst in the pinned CFR/VFR
 * corpus. Anything else (including an empty edit) stays unknown.
 */
function identityEdit(bytes: Uint8Array, trak: readonly Box[], movieScale: number | null, mediaScale: number, decodeDuration: number): boolean {
  const edtsBoxes = trak.filter((item) => item.type === "edts");
  if (edtsBoxes.length === 0) return true;
  if (edtsBoxes.length !== 1 || movieScale === null) return false;
  const edits = children(bytes, edtsBoxes[0]!.payload, edtsBoxes[0]!.end);
  if (edits.length !== 1 || edits[0]!.type !== "elst") return false;
  const box = edits[0]!;
  const version = bytes[box.payload];
  const entryWidth = version === 0 ? 12 : version === 1 ? 20 : 0;
  if (!entryWidth || !fullBoxFlagsZero(bytes, box) || box.payload + 8 + entryWidth !== box.end
    || u32(bytes, box.payload + 4) !== 1) return false;
  const entry = box.payload + 8;
  const longDuration = version === 1 ? view(bytes).getBigUint64(entry, false) : 0n;
  if (longDuration > BigInt(Number.MAX_SAFE_INTEGER)) return false;
  const duration = version === 0 ? u32(bytes, entry) : Number(longDuration);
  const timeOffset = entry + (version === 0 ? 4 : 8);
  const mediaTime = version === 0 ? view(bytes).getInt32(timeOffset, false) : view(bytes).getBigInt64(timeOffset, false);
  const rate = timeOffset + (version === 0 ? 4 : 8);
  if (duration === 0 || mediaTime !== (version === 0 ? 0 : 0n)
    || view(bytes).getInt16(rate, false) !== 1 || view(bytes).getInt16(rate + 2, false) !== 0) return false;
  // Movie-timescale rounding is unavoidable at a real muxer's output.
  return Math.abs(duration / movieScale - decodeDuration / mediaScale)
    <= 1 / movieScale + 1 / mediaScale;
}

function verifiedSampleCount(bytes: Uint8Array, tables: readonly Box[], count: number, fileBytes: number): boolean {
  const stsd = tables.filter((item) => item.type === "stsd");
  const stsz = tables.filter((item) => item.type === "stsz");
  const stsc = tables.filter((item) => item.type === "stsc");
  const offsets = tables.filter((item) => item.type === "stco" || item.type === "co64");
  if (stsd.length !== 1 || stsz.length !== 1 || stsc.length !== 1 || offsets.length !== 1) return false;
  const descriptions = stsd[0]!;
  if (!fullBoxFlagsZero(bytes, descriptions) || descriptions.payload + 8 > descriptions.end) return false;
  const descriptionCount = u32(bytes, descriptions.payload + 4);
  if (descriptionCount < 1 || descriptionCount > 1_000) return false;
  const sizes = stsz[0]!;
  if (!fullBoxFlagsZero(bytes, sizes) || sizes.payload + 12 > sizes.end
    || u32(bytes, sizes.payload + 8) !== count) return false;
  const defaultSize = u32(bytes, sizes.payload + 4);
  if (defaultSize === 0 && sizes.payload + 12 + count * 4 !== sizes.end) return false;
  if (defaultSize !== 0 && sizes.payload + 12 !== sizes.end) return false;
  const chunkBox = offsets[0]!;
  const chunkWidth = chunkBox.type === "co64" ? 8 : 4;
  if (!fullBoxFlagsZero(bytes, chunkBox) || chunkBox.payload + 8 > chunkBox.end) return false;
  const chunks = u32(bytes, chunkBox.payload + 4);
  if (chunks === 0 || chunks > MAX_TIMED_SAMPLES || chunkBox.payload + 8 + chunks * chunkWidth !== chunkBox.end) return false;
  for (let chunk = 0; chunk < chunks; chunk += 1) {
    const offset = chunkBox.payload + 8 + chunk * chunkWidth;
    const rawOffset = chunkWidth === 4 ? BigInt(u32(bytes, offset)) : view(bytes).getBigUint64(offset, false);
    if (rawOffset === 0n || rawOffset >= BigInt(fileBytes)) return false;
  }
  const sampleToChunk = stsc[0]!;
  if (!fullBoxFlagsZero(bytes, sampleToChunk) || sampleToChunk.payload + 8 > sampleToChunk.end) return false;
  const entries = u32(bytes, sampleToChunk.payload + 4);
  if (entries === 0 || entries > MAX_NESTED_BOXES || sampleToChunk.payload + 8 + entries * 12 !== sampleToChunk.end) return false;
  let assigned = 0;
  for (let i = 0; i < entries; i += 1) {
    const offset = sampleToChunk.payload + 8 + i * 12;
    const firstChunk = u32(bytes, offset);
    const samplesPerChunk = u32(bytes, offset + 4);
    const description = u32(bytes, offset + 8);
    const nextChunk = i + 1 < entries ? u32(bytes, offset + 12) : chunks + 1;
    if ((i === 0 && firstChunk !== 1) || firstChunk < 1 || nextChunk <= firstChunk
      || nextChunk > chunks + 1 || samplesPerChunk === 0 || description === 0 || description > descriptionCount) return false;
    assigned += (nextChunk - firstChunk) * samplesPerChunk;
    if (assigned > MAX_TIMED_SAMPLES) return false;
  }
  return assigned === count;
}

/** Inspect PTS, not DTS. Composition offsets can compensate or introduce VFR. */
function presentationCadence(
  bytes: Uint8Array, trak: readonly Box[], media: readonly Box[], tables: readonly Box[], movieScale: number | null, fileBytes: number,
  budget: { remaining: number },
): { mode: Mp4TrackInspection["frameRateMode"]; fps: number | null } {
  const unknown = { mode: "unknown", fps: null } as const;
  const stts = tables.filter((item) => item.type === "stts");
  const ctts = tables.filter((item) => item.type === "ctts");
  if (stts.length !== 1 || ctts.length > 1) return unknown;
  const scale = timescaleOf(bytes, first(media, "mdhd"));
  if (scale === null) return unknown;
  const decode = stts[0]!;
  if (bytes[decode.payload] !== 0 || !fullBoxFlagsZero(bytes, decode)
    || decode.payload + 8 > decode.end) return unknown;
  const count = u32(bytes, decode.payload + 4);
  if (count < 1 || count > MAX_NESTED_BOXES || decode.payload + 8 + count * 8 !== decode.end) return unknown;
  const decodeTimes: number[] = [];
  let timestamp = 0;
  for (let i = 0; i < count; i += 1) {
    const at = decode.payload + 8 + i * 8;
    const samples = u32(bytes, at);
    const delta = u32(bytes, at + 4);
    if (samples === 0 || delta === 0 || samples > MAX_TIMED_SAMPLES - decodeTimes.length
      || samples > budget.remaining - decodeTimes.length) return unknown;
    for (let j = 0; j < samples; j += 1) {
      decodeTimes.push(timestamp);
      timestamp += delta;
    }
  }
  // Bound aggregate CPU/memory work across every track, not just one sample
  // table. Even repeated tiny metadata boxes cannot force unbounded expansion.
  budget.remaining -= decodeTimes.length;
  if (decodeTimes.length < 3 || !Number.isSafeInteger(timestamp)
    || !verifiedSampleCount(bytes, tables, decodeTimes.length, fileBytes)
    || !identityEdit(bytes, trak, movieScale, scale, timestamp)) return unknown;
  if (ctts.length > 0) {
    const compose = ctts[0]!;
    const version = bytes[compose.payload];
    if ((version !== 0 && version !== 1) || !fullBoxFlagsZero(bytes, compose)
      || compose.payload + 8 > compose.end) return unknown;
    const entries = u32(bytes, compose.payload + 4);
    if (entries < 1 || entries > MAX_NESTED_BOXES || compose.payload + 8 + entries * 8 !== compose.end) return unknown;
    let sampleIndex = 0;
    for (let i = 0; i < entries; i += 1) {
      const at = compose.payload + 8 + i * 8;
      const samples = u32(bytes, at);
      const offset = version === 0 ? u32(bytes, at + 4) : view(bytes).getInt32(at + 4, false);
      // Negative offsets can involve an external edit origin; conservatively unknown.
      if (samples === 0 || offset < 0 || samples > decodeTimes.length - sampleIndex) return unknown;
      for (let j = 0; j < samples; j += 1) decodeTimes[sampleIndex + j]! += offset;
      sampleIndex += samples;
    }
    if (sampleIndex !== decodeTimes.length) return unknown;
  }
  decodeTimes.sort((a, b) => a - b);
  if (decodeTimes[0] !== 0 || decodeTimes.at(-1)! >= timestamp || !decodeTimes.every(Number.isSafeInteger)) return unknown;
  const firstStep = decodeTimes[1]! - decodeTimes[0]!;
  if (firstStep <= 0) return unknown;
  let varying = false;
  let smallestStep = firstStep;
  let largestStep = firstStep;
  for (let i = 2; i < decodeTimes.length; i += 1) {
    const step = decodeTimes[i]! - decodeTimes[i - 1]!;
    if (step <= 0) return unknown;
    if (step !== firstStep) varying = true;
    smallestStep = Math.min(smallestStep, step);
    largestStep = Math.max(largestStep, step);
  }
  // Very sparse/time-lapse or >240 fps samples are outside the demonstrated
  // ordinary frame cadence policy; do not imply an authoritative FPS.
  if (smallestStep <= 0 || scale / smallestStep > 240 || scale / largestStep < 1) return unknown;
  const fps = scale / firstStep;
  if (!Number.isFinite(fps) || fps < 1 || fps > 240) return unknown;
  return varying ? { mode: "vfr", fps: null } : { mode: "cfr", fps };
}

type TrackHeader = { id: number | null; width: number | null; height: number | null; matrix: Mp4TrackInspection["matrix"]; quarterTurnDegrees: Mp4TrackInspection["quarterTurnDegrees"] };

function closeTo(value: number, target: number): boolean { return Math.abs(value - target) <= 1 / 65536; }

function rotationFor([a, b, c, d]: readonly [number, number, number, number]): 0 | 90 | 180 | 270 | null {
  // The MP4 track transform matrix is 16.16. Values outside these exact
  // quarter-turn patterns (including mirrors and arbitrary affine transforms)
  // are NOT assigned a fabricated rotation.
  if (closeTo(a, 1) && closeTo(b, 0) && closeTo(c, 0) && closeTo(d, 1)) return 0;
  // Display rotation follows FFprobe's clockwise-facing display-matrix
  // convention, not a mathematical cartesian y-up rotation.
  if (closeTo(a, 0) && closeTo(b, 1) && closeTo(c, -1) && closeTo(d, 0)) return 270;
  if (closeTo(a, -1) && closeTo(b, 0) && closeTo(c, 0) && closeTo(d, -1)) return 180;
  if (closeTo(a, 0) && closeTo(b, -1) && closeTo(c, 1) && closeTo(d, 0)) return 90;
  return null;
}

function trackHeader(bytes: Uint8Array, tkhd?: Box): TrackHeader {
  const unknown: TrackHeader = { id: null, width: null, height: null, matrix: null, quarterTurnDegrees: null };
  if (!tkhd) return unknown;
  const version = bytes[tkhd.payload];
  if ((version !== 0 && version !== 1) || tkhd.end - tkhd.payload < (version === 1 ? 92 : 80)) return unknown;
  const id = u32(bytes, tkhd.payload + (version === 1 ? 20 : 12));
  const width = u32(bytes, tkhd.end - 8) / 65536;
  const height = u32(bytes, tkhd.end - 4) / 65536;
  const matrixOffset = tkhd.end - 44;
  const matrixView = view(bytes);
  const matrix: readonly [number, number, number, number] = [
    matrixView.getInt32(matrixOffset, false) / 65536,
    matrixView.getInt32(matrixOffset + 4, false) / 65536,
    matrixView.getInt32(matrixOffset + 12, false) / 65536,
    matrixView.getInt32(matrixOffset + 16, false) / 65536,
  ];
  return {
    id: id > 0 ? id : null,
    width: width > 0 ? width : null,
    height: height > 0 ? height : null,
    matrix,
    quarterTurnDegrees: rotationFor(matrix),
  };
}

function trackData(
  bytes: Uint8Array, trak: Box, movieScale: number | null, fragmented: boolean, fileBytes: number,
  budget: { remaining: number },
): Mp4TrackInspection {
  const data = children(bytes, trak.payload, trak.end);
  const headerData = trackHeader(bytes, first(data, "tkhd"));
  const mdia = first(data, "mdia");
  const media = mdia ? children(bytes, mdia.payload, mdia.end) : [];
  const hdlr = first(media, "hdlr");
  const handler = hdlr && hdlr.payload + 12 <= hdlr.end ? fourcc(bytes, hdlr.payload + 8) : null;
  const kind: Mp4TrackKind = handler === "vide" ? "video" : handler === "soun" ? "audio" : handler === null ? "unknown" : "other";
  const minf = first(media, "minf");
  const minfChildren = minf ? children(bytes, minf.payload, minf.end) : [];
  const stbl = first(minfChildren, "stbl");
  const tables = stbl ? children(bytes, stbl.payload, stbl.end) : [];
  const stsd = first(tables, "stsd");
  const codecFourCc = stsd && stsd.payload + 16 <= stsd.end && u32(bytes, stsd.payload + 4) > 0
    ? fourcc(bytes, stsd.payload + 12) : null;
  const stts = first(tables, "stts");
  let decodeTiming: Mp4TrackInspection["decodeTiming"] = "not-proven";
  if (kind === "video" && stts && stts.payload + 8 <= stts.end) {
    const count = u32(bytes, stts.payload + 4);
    if (count > 10_000 || stts.payload + 8 + count * 8 > stts.end) fail("Invalid or excessive decode-time entries");
    let previous: number | null = null;
    let totalSamples = 0;
    let validRuns = count > 0;
    let varyingDelta = false;
    for (let i = 0; i < count; i += 1) {
      const sampleCount = u32(bytes, stts.payload + 8 + i * 8);
      const delta = u32(bytes, stts.payload + 8 + i * 8 + 4);
      // A zero-length/zero-duration run provides no reliable timing evidence.
      // Even valid stts decode deltas cannot prove presentation CFR/VFR:
      // composition offsets, edits and other timing transforms may apply.
      if (sampleCount === 0 || delta === 0) validRuns = false;
      totalSamples += sampleCount;
      if (previous !== null && previous !== delta) varyingDelta = true;
      previous = delta;
    }
    if (validRuns && totalSamples >= 2) {
      decodeTiming = varyingDelta ? "variable-sample-deltas-observed" : "constant-sample-deltas-observed";
    }
  }
  const presentation = kind === "video" && !fragmented
    ? presentationCadence(bytes, data, media, tables, movieScale, fileBytes, budget)
    : { mode: "unknown" as const, fps: null };
  return {
    ...headerData,
    kind,
    codecFourCc,
    frameRate: presentation.fps,
    frameRateMode: presentation.mode,
    decodeTiming,
  };
}

export async function inspectMp4Local(input: Blob, signal?: AbortSignal): Promise<Mp4Inspection> {
  if (!(input instanceof Blob) || !Number.isSafeInteger(input.size) || input.size < 16) fail("Choose a valid local MP4 file");
  const readSlice = async (from: number, length: number) =>
    new Uint8Array(await readMediaFile411(input.slice(from, from + length), { maxBytes: MAX_MOOV_BYTES, signal }));
  let cursor = 0;
  let brand: string | null = null;
  let movie: Uint8Array | null = null;
  let hasMovieFragments = false;
  for (let count = 0; count < MAX_TOP_BOXES && cursor < input.size; count += 1) {
    const prefix = await readSlice(cursor, Math.min(16, input.size - cursor));
    if (prefix.length < 8) fail("Truncated top-level box header");
    const size32 = u32(prefix, 0);
    const headerSize = size32 === 1 ? 16 : 8;
    if (prefix.length < headerSize) fail("Truncated 64-bit MP4 box size");
    const size = size32 === 0 ? input.size - cursor : size32 === 1 ? u64(prefix, 8) : size32;
    const type = fourcc(prefix, 4);
    if (!Number.isSafeInteger(size) || size < headerSize || size > input.size - cursor) fail(`Invalid top-level box ${type}`);
    if (cursor === 0 && type !== "ftyp") fail("MP4 file must start with a valid ftyp brand");
    if (type === "ftyp") {
      if (size < 16) fail("Truncated ftyp brand");
      brand = fourcc(await readSlice(cursor + headerSize, 4), 0);
    }
    if (type === "moof") hasMovieFragments = true;
    if (type === "moov") {
      if (movie !== null) fail("Multiple movie metadata boxes are ambiguous");
      if (size > MAX_MOOV_BYTES) fail("Movie metadata exceeds the local 8 MiB budget");
      movie = await readSlice(cursor, size);
    }
    cursor += size;
  }
  if (cursor !== input.size) fail("Too many top-level boxes to establish complete fragment metadata");
  if (!brand || !movie) fail("Unsupported MP4: ftyp or bounded moov metadata not found");
  const moov = header(movie, 0, movie.length);
  const nested = children(movie, moov.payload, moov.end);
  const fragmented = hasMovieFragments || first(nested, "mvex") !== undefined;
  const durationSeconds = fragmented ? null : movieDuration(movie, first(nested, "mvhd"));
  const movieScale = timescaleOf(movie, first(nested, "mvhd"));
  const presentationBudget = { remaining: MAX_PRESENTATION_SAMPLES_PER_FILE };
  const tracks = nested.filter((box) => box.type === "trak")
    .map((box) => trackData(movie, box, movieScale, fragmented, input.size, presentationBudget));
  if (tracks.length === 0) fail("No MP4 track metadata found");
  const warnings = [
    "Bitrate calcolato sull'intero contenitore, NON misurato sui flussi audio/video.",
    "CFR/VFR restano sconosciuti per timing, offset, edit effettivi o frammenti ambigui. Quando verificabili, FPS/CFR/VFR derivano da PTS dei sample tables stts+ctts coerenti, non dalla sola stts o dalla durata.",
    "Il parser supporta metadati ISO BMFF limitati, non valida decodificabilità, audio udibile o byte di ogni campione.",
  ];
  if (fragmented) warnings.push("MP4 frammentato: durata totale non certificata dai soli metadati moov.");
  if (tracks.some((track) => track.quarterTurnDegrees === null)) warnings.push("Una o più matrici di rotazione non sono interpretabili come quarti di giro certificabili.");
  return {
    container: "iso-bmff-mp4", majorBrand: brand, bytes: input.size,
    durationSeconds,
    averageContainerBitrateBps: durationSeconds === null ? null : Math.round(input.size * 8 / durationSeconds),
    totalTracks: tracks.length,
    videoTracks: tracks.filter((track) => track.kind === "video").length,
    audioTracks: tracks.filter((track) => track.kind === "audio").length,
    containsMovieFragments: fragmented,
    tracks, warnings,
  };
}

/**
 * Bounded ISO BMFF/MP4 container inspection. No transcoder, decoder, network,
 * codec probing or inferred frame-rate claims. Unknown data stays unknown.
 * Only the `moov` atom is read; potentially huge `mdat` data is skipped.
 */

const MAX_MOOV_BYTES = 8 * 1024 * 1024;
const MAX_TOP_BOXES = 2_048;
const MAX_NESTED_BOXES = 10_000;

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
  readonly frameRate: null;
  readonly frameRateMode: "unknown";
  readonly decodeTiming: "variable-sample-deltas-observed" | "not-proven";
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

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Video inspection cancelled", "AbortError");
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

function trackData(bytes: Uint8Array, trak: Box): Mp4TrackInspection {
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
  let varyingDelta = false;
  if (stts && stts.payload + 8 <= stts.end) {
    const count = u32(bytes, stts.payload + 4);
    if (count > 10_000 || stts.payload + 8 + count * 8 > stts.end) fail("Invalid or excessive decode-time entries");
    let previous: number | null = null;
    for (let i = 0; i < count; i += 1) {
      const delta = u32(bytes, stts.payload + 8 + i * 8 + 4);
      if (previous !== null && previous !== delta) varyingDelta = true;
      previous = delta;
    }
  }
  return {
    ...headerData,
    kind,
    codecFourCc,
    frameRate: null,
    frameRateMode: "unknown",
    decodeTiming: varyingDelta ? "variable-sample-deltas-observed" : "not-proven",
  };
}

export async function inspectMp4Local(input: Blob, signal?: AbortSignal): Promise<Mp4Inspection> {
  if (!(input instanceof Blob) || !Number.isSafeInteger(input.size) || input.size < 16) fail("Choose a valid local MP4 file");
  const readSlice = async (from: number, length: number): Promise<Uint8Array> => {
    checkAbort(signal);
    const part = new Uint8Array(await input.slice(from, from + length).arrayBuffer());
    checkAbort(signal);
    return part;
  };
  let cursor = 0;
  let brand: string | null = null;
  let movie: Uint8Array | null = null;
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
    if (type === "moov") {
      if (size > MAX_MOOV_BYTES) fail("Movie metadata exceeds the local 8 MiB budget");
      movie = await readSlice(cursor, size);
      break;
    }
    cursor += size;
  }
  if (!brand || !movie) fail("Unsupported MP4: ftyp or bounded moov metadata not found");
  const moov = header(movie, 0, movie.length);
  const nested = children(movie, moov.payload, moov.end);
  const fragmented = first(nested, "mvex") !== undefined;
  const durationSeconds = fragmented ? null : movieDuration(movie, first(nested, "mvhd"));
  const tracks = nested.filter((box) => box.type === "trak").map((box) => trackData(movie, box));
  if (tracks.length === 0) fail("No MP4 track metadata found");
  const warnings = [
    "Bitrate calcolato sull'intero contenitore, NON misurato sui flussi audio/video.",
    "FPS e classificazione CFR/VFR restano sconosciuti: stts e la sola durata non provano la cadenza di presentazione.",
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

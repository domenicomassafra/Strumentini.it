export const QR_ENGINE_VERSION = "qr-local-v1";

interface VersionSpec {
  readonly version: number;
  readonly size: number;
  readonly dataCodewords: number;
  readonly ecCodewords: number;
  readonly alignmentCenters: readonly number[];
}

const VERSION_SPECS: readonly VersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewords: 7, alignmentCenters: [] },
  { version: 2, size: 25, dataCodewords: 34, ecCodewords: 10, alignmentCenters: [18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewords: 15, alignmentCenters: [22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewords: 20, alignmentCenters: [26] },
];

const MAX_BYTES = 78;
const MAX_MATRIX_INPUT = 64 * 1024;
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    GF_EXP[index] = value;
    GF_LOG[value] = index;
    value <<= 1;
    if ((value & 0x100) !== 0) value ^= 0x11d;
  }
  for (let index = 255; index < GF_EXP.length; index += 1) GF_EXP[index] = GF_EXP[index - 255] ?? 0;
})();

function gfMultiply(left: number, right: number): number {
  if (left === 0 || right === 0) return 0;
  return GF_EXP[(GF_LOG[left] ?? 0) + (GF_LOG[right] ?? 0)] ?? 0;
}

function generatorPolynomial(degree: number): number[] {
  let polynomial = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = new Array<number>(polynomial.length + 1).fill(0);
    for (let position = 0; position < polynomial.length; position += 1) {
      next[position] = (next[position] ?? 0) ^ (polynomial[position] ?? 0);
      next[position + 1] = (next[position + 1] ?? 0) ^ gfMultiply(polynomial[position] ?? 0, GF_EXP[index] ?? 0);
    }
    polynomial = next;
  }
  return polynomial;
}

function errorCorrection(data: readonly number[], degree: number): number[] {
  const generator = generatorPolynomial(degree);
  const work = [...data, ...new Array<number>(degree).fill(0)];
  for (let index = 0; index < data.length; index += 1) {
    const factor = work[index] ?? 0;
    if (factor === 0) continue;
    for (let offset = 0; offset <= degree; offset += 1) {
      work[index + offset] = (work[index + offset] ?? 0) ^ gfMultiply(generator[offset] ?? 0, factor);
    }
  }
  return work.slice(-degree);
}

function appendBits(bits: number[], value: number, length: number): void {
  for (let index = length - 1; index >= 0; index -= 1) bits.push((value >>> index) & 1);
}

function chooseVersion(byteLength: number): VersionSpec {
  const capacities = [17, 32, 53, 78];
  const index = capacities.findIndex((capacity) => byteLength <= capacity);
  const spec = VERSION_SPECS[index];
  if (spec === undefined) throw new Error("QR_PAYLOAD_TOO_LARGE");
  return spec;
}

function dataCodewords(payload: Uint8Array, spec: VersionSpec): number[] {
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, payload.length, 8);
  for (const value of payload) appendBits(bits, value, 8);
  const capacity = spec.dataCodewords * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) value = (value << 1) | (bits[index + bit] ?? 0);
    data.push(value);
  }
  let pad = 0xec;
  while (data.length < spec.dataCodewords) {
    data.push(pad);
    pad = pad === 0xec ? 0x11 : 0xec;
  }
  return data;
}

function setFunction(matrix: boolean[][], functions: boolean[][], x: number, y: number, dark: boolean): void {
  if (x < 0 || y < 0 || x >= matrix.length || y >= matrix.length) return;
  matrix[y]![x] = dark;
  functions[y]![x] = true;
}

function placeFinder(matrix: boolean[][], functions: boolean[][], left: number, top: number): void {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const x = left + dx;
      const y = top + dy;
      if (x < 0 || y < 0 || x >= matrix.length || y >= matrix.length) continue;
      const dark = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setFunction(matrix, functions, x, y, dark);
    }
  }
}

function placeAlignment(matrix: boolean[][], functions: boolean[][], center: number): void {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const dark = dx === -2 || dx === 2 || dy === -2 || dy === 2 || (dx === 0 && dy === 0);
      setFunction(matrix, functions, center + dx, center + dy, dark);
    }
  }
}

function reserveFunctionPatterns(spec: VersionSpec): { readonly matrix: boolean[][]; readonly functions: boolean[][] } {
  const size = spec.size;
  const matrix = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const functions = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  placeFinder(matrix, functions, 0, 0);
  placeFinder(matrix, functions, size - 7, 0);
  placeFinder(matrix, functions, 0, size - 7);
  for (const center of spec.alignmentCenters) placeAlignment(matrix, functions, center);
  for (let index = 8; index < size - 8; index += 1) {
    setFunction(matrix, functions, index, 6, index % 2 === 0);
    setFunction(matrix, functions, 6, index, index % 2 === 0);
  }
  for (let index = 0; index < 9; index += 1) {
    if (index === 6) continue;
    setFunction(matrix, functions, 8, index, false);
    setFunction(matrix, functions, index, 8, false);
  }
  for (let index = 0; index < 8; index += 1) {
    setFunction(matrix, functions, size - 1 - index, 8, false);
    setFunction(matrix, functions, 8, size - 1 - index, false);
  }
  setFunction(matrix, functions, 8, size - 8, true);
  return { matrix, functions };
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function placeData(matrix: boolean[][], functions: boolean[][], codewords: readonly number[], mask: number): void {
  const size = matrix.length;
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (functions[y]![x]) continue;
        const byte = codewords[bitIndex >> 3] ?? 0;
        const bit = (byte >>> (7 - (bitIndex & 7))) & 1;
        matrix[y]![x] = ((bit & 1) ^ (maskBit(mask, x, y) ? 1 : 0)) === 1;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function penalty(matrix: readonly (readonly boolean[])[]): number {
  const size = matrix.length;
  let score = 0;
  for (let y = 0; y < size; y += 1) {
    let run = 1;
    let previous = matrix[y]![0] ?? false;
    for (let x = 1; x < size; x += 1) {
      const current = matrix[y]![x] ?? false;
      if (current === previous) run += 1;
      else {
        if (run >= 5) score += run - 2;
        run = 1;
        previous = current;
      }
    }
    if (run >= 5) score += run - 2;
  }
  for (let x = 0; x < size; x += 1) {
    let run = 1;
    let previous = matrix[0]![x] ?? false;
    for (let y = 1; y < size; y += 1) {
      const current = matrix[y]![x] ?? false;
      if (current === previous) run += 1;
      else {
        if (run >= 5) score += run - 2;
        run = 1;
        previous = current;
      }
    }
    if (run >= 5) score += run - 2;
  }
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const value = matrix[y]![x] === matrix[y]![x + 1] && matrix[y]![x] === matrix[y + 1]![x] && matrix[y]![x] === matrix[y + 1]![x + 1];
      if (value) score += 3;
    }
  }
  let dark = 0;
  for (const row of matrix) for (const value of row) if (value) dark += 1;
  const percent = Math.floor((dark * 100) / (size * size));
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

function formatBits(mask: number): number {
  const value = (1 << 3) | mask;
  let remainder = value << 10;
  for (let degree = 14; degree >= 10; degree -= 1) {
    if ((remainder & (1 << degree)) !== 0) remainder ^= 0x537 << (degree - 10);
  }
  return ((value << 10) | remainder) ^ 0x5412;
}

function applyFormat(matrix: boolean[][], functions: boolean[][], mask: number): void {
  const size = matrix.length;
  const bits = formatBits(mask);
  const set = (x: number, y: number, index: number) => {
    matrix[y]![x] = ((bits >>> index) & 1) === 1;
    functions[y]![x] = true;
  };
  for (let index = 0; index <= 5; index += 1) set(8, index, index);
  set(8, 7, 6);
  set(8, 8, 7);
  set(7, 8, 8);
  for (let index = 9; index <= 14; index += 1) set(14 - index, 8, index);
  for (let index = 0; index <= 7; index += 1) set(size - 1 - index, 8, index);
  for (let index = 8; index <= 14; index += 1) set(8, size - 15 + index, index);
}

function chooseMask(matrix: boolean[][], functions: boolean[][], codewords: readonly number[]): number {
  let selected = 0;
  let selectedPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = matrix.map((row) => [...row]);
    placeData(candidate, functions, codewords, mask);
    applyFormat(candidate, functions, mask);
    const score = penalty(candidate);
    if (score < selectedPenalty) {
      selected = mask;
      selectedPenalty = score;
    }
  }
  return selected;
}

function matrixRows(matrix: readonly (readonly boolean[])[]): string[] {
  return matrix.map((row) => row.map((value) => value ? "1" : "0").join(""));
}

function matrixFromRows(rows: readonly string[]): boolean[][] {
  if (rows.length < 21 || rows.length > 33 || rows.some((row) => row.length !== rows.length || !/^[01]+$/u.test(row))) throw new Error("INVALID_QR_MATRIX");
  return rows.map((row) => [...row].map((value) => value === "1"));
}

function specForSize(size: number): VersionSpec {
  const spec = VERSION_SPECS.find((candidate) => candidate.size === size);
  if (spec === undefined) throw new Error("UNSUPPORTED_QR_VERSION");
  return spec;
}

function dataBitsFromMatrix(matrix: boolean[][], functions: boolean[][], mask: number): number[] {
  const size = matrix.length;
  const bits: number[] = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (functions[y]![x]) continue;
        const bit = matrix[y]![x] ? 1 : 0;
        bits.push(bit ^ (maskBit(mask, x, y) ? 1 : 0));
      }
    }
    upward = !upward;
  }
  return bits;
}

function decodeWithMask(matrix: boolean[][], spec: VersionSpec, mask: number): string | null {
  const reserved = reserveFunctionPatterns(spec);
  const bits = dataBitsFromMatrix(matrix, reserved.functions, mask);
  const readBits = (start: number, lengthBits: number): number => {
    let value = 0;
    for (let bit = 0; bit < lengthBits; bit += 1) value = (value << 1) | (bits[start + bit] ?? 0);
    return value;
  };
  if (readBits(0, 4) !== 0b0100) return null;
  const length = readBits(4, 8);
  if (length > MAX_BYTES) return null;
  const payload: number[] = [];
  for (let index = 0; index < length; index += 1) payload.push(readBits(12 + index * 8, 8));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(payload));
  } catch {
    return null;
  }
}

export interface QrGenerationResult {
  readonly payload: string;
  readonly byteLength: number;
  readonly version: number;
  readonly size: number;
  readonly errorCorrection: "L";
  readonly mask: number;
  readonly matrix: readonly (readonly boolean[])[];
  readonly matrixRows: readonly string[];
  readonly svg: string;
  readonly dataUrl: string;
  readonly engineVersion: string;
}

export function generateQr(payload: string, options: { readonly mask?: number } = {}): QrGenerationResult {
  if (typeof payload !== "string" || payload.length === 0) throw new Error("QR_PAYLOAD_REQUIRED");
  const bytes = new TextEncoder().encode(payload);
  if (bytes.length > MAX_BYTES) throw new Error("QR_PAYLOAD_TOO_LARGE");
  const spec = chooseVersion(bytes.length);
  const data = dataCodewords(bytes, spec);
  const codewords = [...data, ...errorCorrection(data, spec.ecCodewords)];
  const reserved = reserveFunctionPatterns(spec);
  const mask = options.mask === undefined ? chooseMask(reserved.matrix, reserved.functions, codewords) : options.mask;
  if (!Number.isInteger(mask) || mask < 0 || mask > 7) throw new Error("INVALID_QR_MASK");
  placeData(reserved.matrix, reserved.functions, codewords, mask);
  applyFormat(reserved.matrix, reserved.functions, mask);
  const rows = matrixRows(reserved.matrix);
  const quiet = 4;
  const dimension = spec.size + quiet * 2;
  const rects: string[] = [];
  for (let y = 0; y < spec.size; y += 1) {
    for (let x = 0; x < spec.size; x += 1) {
      if (reserved.matrix[y]![x]) rects.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges" data-matrix="${rows.join(";")}"><rect width="${dimension}" height="${dimension}" fill="#fff"/><path fill="#000" d="${rects.map((rect) => rect.replace("<rect x=\"", "M").replace("\" y=\"", " ").replace("\" width=\"1\" height=\"1\"/>", "h1v1h-1z")).join("")}"/></svg>`;
  return {
    payload,
    byteLength: bytes.length,
    version: spec.version,
    size: spec.size,
    errorCorrection: "L",
    mask,
    matrix: reserved.matrix.map((row) => [...row]),
    matrixRows: rows,
    svg,
    dataUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    engineVersion: QR_ENGINE_VERSION,
  };
}

function normalizeMatrixInput(value: unknown): boolean[][] {
  if (Array.isArray(value)) {
    if (value.length > 1000 || !value.every((row) => Array.isArray(row) && row.length <= 1000)) throw new Error("INVALID_QR_MATRIX");
    return matrixFromRows((value as unknown[][]).map((row) => row.map((cell) => cell ? "1" : "0").join("")));
  }
  if (typeof value !== "string" || value.length > MAX_MATRIX_INPUT) throw new Error("INVALID_QR_INPUT");
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return normalizeMatrixInput(parsed);
    } catch {
      throw new Error("INVALID_QR_MATRIX");
    }
  }
  const match = /data-matrix="([01;]+)"/u.exec(trimmed);
  if (match?.[1] !== undefined) return matrixFromRows(match[1].split(";"));
  throw new Error("INVALID_QR_INPUT");
}

export function decodeQrMatrix(value: unknown): string {
  const matrix = normalizeMatrixInput(value);
  const spec = specForSize(matrix.length);
  for (let mask = 0; mask < 8; mask += 1) {
    const decoded = decodeWithMask(matrix, spec, mask);
    if (decoded !== null) return decoded;
  }
  throw new Error("QR_DECODE_FAILED");
}

export interface QrReadResult {
  readonly payload: string;
  readonly version: number;
  readonly size: number;
  readonly source: "matrix" | "svg" | "image";
  readonly engineVersion: string;
}

function detectorConstructor(): (new (options?: { formats?: string[] }) => { detect(source: ImageBitmapSource): Promise<readonly { rawValue?: string }[]> }) | undefined {
  const value = (globalThis as unknown as { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect(source: ImageBitmapSource): Promise<readonly { rawValue?: string }[]> } }).BarcodeDetector;
  return value;
}

export async function readQr(value: unknown): Promise<QrReadResult> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    if (object.matrix !== undefined) {
      const matrix = normalizeMatrixInput(object.matrix);
      const payload = decodeQrMatrix(matrix);
      return { payload, version: specForSize(matrix.length).version, size: matrix.length, source: "matrix", engineVersion: QR_ENGINE_VERSION };
    }
    if (typeof object.svg === "string") {
      const matrix = normalizeMatrixInput(object.svg);
      const payload = decodeQrMatrix(matrix);
      return { payload, version: specForSize(matrix.length).version, size: matrix.length, source: "svg", engineVersion: QR_ENGINE_VERSION };
    }
    if (object.image !== undefined || object.imageData !== undefined) {
      const Detector = detectorConstructor();
      if (Detector === undefined) throw new Error("QR_IMAGE_DECODER_UNAVAILABLE");
      const detector = new Detector({ formats: ["qr_code"] });
      const results = await detector.detect((object.image ?? object.imageData) as ImageBitmapSource);
      const payload = results[0]?.rawValue;
      if (payload === undefined) throw new Error("QR_DECODE_FAILED");
      return { payload, version: 0, size: 0, source: "image", engineVersion: QR_ENGINE_VERSION };
    }
  }
  const matrix = normalizeMatrixInput(value);
  const payload = decodeQrMatrix(matrix);
  const source = typeof value === "string" && value.includes("data-matrix=") ? "svg" : "matrix";
  return { payload, version: specForSize(matrix.length).version, size: matrix.length, source, engineVersion: QR_ENGINE_VERSION };
}

/*
 * QR encoder: UTF-8 byte mode, error-correction level L, versions 1–4.
 *
 * Pipeline (ISO/IEC 18004 clauses 7–8):
 *   characters → bit stream → codewords → error-correction codewords →
 *   interleaved data region → mask → format information.
 */

import { errorCorrection } from "./gf";
import {
  applyFormatInformation,
  cloneMatrix,
  dataModulePositions,
  matrixRows,
  placeData,
  reserveGeometry,
  type QrGeometry,
  type QrMatrix,
} from "./geometry";
import {
  QR_BYTE_CAPACITY,
  QR_BYTE_MODE_INDICATOR,
  QR_MAX_BYTES,
  QR_MAX_VERSION,
  QR_TERMINATOR_LENGTH,
  chooseVersion,
  dataCodewordCount,
  formatInformation,
  specForVersion,
  QR_EC_LEVEL,
  type QrVersionSpec,
} from "./spec";

export const QR_ENCODER_VERSION = "qr-local-encoder-v2";

export interface QrGenerateResult {
  readonly payload: string;
  readonly byteLength: number;
  readonly mode: "byte";
  readonly version: number;
  readonly size: number;
  readonly errorCorrection: typeof QR_EC_LEVEL;
  readonly mask: number;
  readonly quietZone: number;
  readonly matrix: readonly (readonly boolean[])[];
  readonly matrixRows: readonly string[];
  readonly svg: string;
  readonly engineVersion: string;
}

function appendBits(bits: number[], value: number, length: number): void {
  for (let index = length - 1; index >= 0; index -= 1) bits.push((value >>> index) & 1);
}

/**
 * Clause 7.4.9: mode indicator, character count indicator, payload bytes, the
 * 4-bit terminator (truncated when the data region is nearly full), padding to
 * a byte boundary, then alternating 0xEC/0x11 pad codewords.
 */
export function buildDataCodewords(payloadBytes: Uint8Array, spec: QrVersionSpec): number[] {
  const dataCount = dataCodewordCount(spec);
  const bits: number[] = [];
  appendBits(bits, QR_BYTE_MODE_INDICATOR, 4);
  appendBits(bits, payloadBytes.length, 8);
  for (const value of payloadBytes) appendBits(bits, value, 8);
  const capacity = dataCount * 8;
  if (bits.length > capacity) throw new Error("QR_PAYLOAD_TOO_LARGE");
  appendBits(bits, 0, Math.min(QR_TERMINATOR_LENGTH, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) value = (value << 1) | (bits[index + bit] ?? 0);
    data.push(value);
  }
  let pad = 0xec;
  while (data.length < dataCount) {
    data.push(pad);
    pad = pad === 0xec ? 0x11 : 0xec;
  }
  return data;
}

/** Clause 8.8.2: choose the mask with the lowest penalty score. */
export function penalty(matrix: readonly (readonly boolean[])[]): number {
  const size = matrix.length;
  let score = 0;
  const runPenalty = (values: readonly boolean[]): number => {
    let total = 0;
    let run = 1;
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] === values[index - 1]) run += 1;
      else {
        if (run >= 5) total += run - 2;
        run = 1;
      }
    }
    if (run >= 5) total += run - 2;
    return total;
  };
  // ISO/IEC 18004 N3: 1:1:3:1:1 with four light modules on either side.
  // Matching each 11-module window also counts both sides when both qualify.
  const finderPenalty = (values: readonly boolean[]): number => {
    let window = 0;
    let total = 0;
    for (let index = 0; index < values.length; index += 1) {
      window = ((window << 1) | Number(values[index])) & 0x7ff;
      if (index >= 10 && (window === 0b00001011101 || window === 0b10111010000)) total += 40;
    }
    return total;
  };
  for (let y = 0; y < size; y += 1) {
    const row = matrix[y]!;
    score += runPenalty(row) + finderPenalty(row);
  }
  for (let x = 0; x < size; x += 1) {
    const column = matrix.map((row) => row[x]!);
    score += runPenalty(column) + finderPenalty(column);
  }
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const value = matrix[y]![x];
      if (value === matrix[y]![x + 1] && value === matrix[y + 1]![x] && value === matrix[y + 1]![x + 1]) score += 3;
    }
  }
  let dark = 0;
  for (const row of matrix) for (const value of row) if (value) dark += 1;
  const percent = Math.floor((dark * 100) / (size * size));
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

export function chooseMask(geometry: QrGeometry, codewords: readonly number[]): number {
  let selected = 0;
  let selectedPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const scratch: QrGeometry = { spec: geometry.spec, size: geometry.size, modules: cloneMatrix(geometry.modules), functions: geometry.functions };
    placeData(scratch, codewords, mask);
    applyFormatInformation(scratch, formatInformation(mask));
    const score = penalty(scratch.modules);
    if (score < selectedPenalty) {
      selected = mask;
      selectedPenalty = score;
    }
  }
  return selected;
}

/** Clause 7.3: the 4-module quiet zone that surrounds every symbol. */
export const QR_QUIET_ZONE = 4;

export interface QrRasterPlan {
  /** Pixel size of one module. */
  readonly scale: number;
  readonly quietZone: number;
  readonly size: number;
  readonly width: number;
  readonly height: number;
  readonly dark: readonly { readonly x: number; readonly y: number }[];
}

/**
 * A resolution-independent description of the rendered symbol. Callers draw it
 * on a canvas or serialise it as SVG; keeping it as plain data means the same
 * plan is used by the page, the tests and the fixtures.
 */
export function rasterPlan(matrixRowsInput: readonly string[], scale: number): QrRasterPlan {
  const size = matrixRowsInput.length;
  const quiet = QR_QUIET_ZONE;
  const dark: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (matrixRowsInput[y]?.[x] === "1") dark.push({ x, y });
    }
  }
  return { scale, quietZone: quiet, size, width: (size + quiet * 2) * scale, height: (size + quiet * 2) * scale, dark };
}

export function renderQrSvg(rows: readonly string[], options: { readonly scale?: number } = {}): string {
  const scale = options.scale ?? 8;
  const plan = rasterPlan(rows, scale);
  const paths: string[] = [];
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y]!;
    for (let x = 0; x < row.length;) {
      if (row[x] !== "1") {
        x += 1;
        continue;
      }
      const start = x;
      while (row[x] === "1") x += 1;
      const left = (start + plan.quietZone) * scale;
      const center = (y + plan.quietZone + 0.5) * scale;
      const width = (x - start) * scale;
      paths.push(`M${left} ${center}h${width}`);
    }
  }
  const { width, height } = plan;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"`,
    ` shape-rendering="crispEdges" role="img" aria-label="Codice QR" data-matrix="${rows.join(";")}">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    `<path fill="none" stroke="#000000" stroke-width="${scale}" stroke-linecap="butt" d="${paths.join("")}"/>`,
    `</svg>`,
  ].join("");
}

export function generateQr(payload: string, options: { readonly mask?: number } = {}): QrGenerateResult {
  if (typeof payload !== "string" || payload.length === 0) throw new Error("QR_PAYLOAD_REQUIRED");
  const bytes = new TextEncoder().encode(payload);
  if (bytes.length > QR_MAX_BYTES) throw new Error("QR_PAYLOAD_TOO_LARGE");
  const spec = chooseVersion(bytes.length);
  const data = buildDataCodewords(bytes, spec);
  const codewords = [...data, ...errorCorrection(data, spec.ecCodewords)];
  const geometry = reserveGeometry(spec);
  const mask = options.mask ?? chooseMask(geometry, codewords);
  if (!Number.isInteger(mask) || mask < 0 || mask > 7) throw new Error("QR_INVALID_MASK");
  placeData(geometry, codewords, mask);
  applyFormatInformation(geometry, formatInformation(mask));
  const rows = matrixRows(geometry.modules);
  return {
    payload,
    byteLength: bytes.length,
    mode: "byte",
    version: spec.version,
    size: spec.size,
    errorCorrection: QR_EC_LEVEL,
    mask,
    quietZone: QR_QUIET_ZONE,
    matrix: geometry.modules.map((row) => [...row]),
    matrixRows: rows,
    svg: renderQrSvg(rows),
    engineVersion: QR_ENCODER_VERSION,
  };
}

/** Structural self-check used by tests and by the reader's sanity gate. */
export function describeSymbol(rows: readonly string[]): {
  readonly size: number;
  readonly version: number;
  readonly dataModules: number;
  readonly codewordBits: number;
  readonly quietZoneRequired: number;
  readonly finderPatternsAtCorners: boolean;
  readonly timingPatternsAlternate: boolean;
  readonly darkModulePresent: boolean;
} {
  const size = rows.length;
  const spec = specForVersion((size - 17) / 4);
  const geometry = reserveGeometry(spec);
  const modules: QrMatrix = rows.map((row) => [...row].map((value) => value === "1"));
  const positions = dataModulePositions(size, geometry.functions);
  const isFinder = (left: number, top: number): boolean => {
    for (let dy = 0; dy < 7; dy += 1) {
      for (let dx = 0; dx < 7; dx += 1) {
        const want = dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
        if ((modules[top + dy]?.[left + dx] === true) !== want) return false;
      }
    }
    return true;
  };
  const timingOk = (() => {
    for (let index = 8; index < size - 8; index += 1) {
      if ((modules[6]?.[index] === true) !== (index % 2 === 0)) return false;
      if ((modules[index]?.[6] === true) !== (index % 2 === 0)) return false;
    }
    return true;
  })();
  return {
    size,
    version: spec.version,
    dataModules: positions.length,
    codewordBits: spec.totalCodewords * 8,
    quietZoneRequired: QR_QUIET_ZONE,
    finderPatternsAtCorners: isFinder(0, 0) && isFinder(size - 7, 0) && isFinder(0, size - 7),
    timingPatternsAlternate: timingOk,
    darkModulePresent: modules[size - 8]?.[8] === true,
  };
}

export { QR_BYTE_CAPACITY, QR_MAX_BYTES, QR_MAX_VERSION };

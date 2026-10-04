/*
 * QR decoder. Two independent entry points that must agree:
 *
 *  - `decodeQrMatrix` reads a module matrix (pasted rows, JSON, or an SVG this
 *    tool produced). It takes the mask from the symbol's own format
 *    information, verifies the Reed–Solomon syndromes before believing a byte,
 *    and fails closed on any mode it does not implement.
 *
 *  - `raster.ts` (see `decodeQrFromRaster`) reaches the same decoder through the
 *    physical symbol: finder detection, a perspective transform, and sampling.
 */

import { syndromesAreZero } from "./gf";
import {
  readDataBits,
  readFormatInformation,
  reserveGeometry,
  type QrMatrix,
} from "./geometry";
import {
  EC_LEVEL_BITS,
  QR_BYTE_MODE_INDICATOR,
  QR_ECI_MODE_INDICATOR,
  QR_MAX_BYTES,
  QR_VERSION_SPECS,
  dataCodewordCount,
  specForSize,
  type QrVersionSpec,
} from "./spec";
import type { QR_EC_LEVEL } from "./spec";

export const QR_DECODER_VERSION = "qr-local-decoder-v2";

const MAX_MATRIX_INPUT = 64 * 1024;

export interface QrDecodeResult {
  readonly payload: string;
  readonly version: number;
  readonly size: number;
  readonly errorCorrection: typeof QR_EC_LEVEL;
  readonly mask: number;
  readonly mode: "byte";
  readonly byteLength: number;
  readonly maskFromFormatInformation: boolean;
  readonly formatCopiesAgree: boolean;
  readonly formatRepairDistance: number;
  readonly errorCorrectionVerified: boolean;
  readonly engineVersion: string;
}

function bitsToCodewords(bits: readonly number[]): number[] {
  const codewords: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) value = (value << 1) | (bits[index + bit] ?? 0);
    codewords.push(value);
  }
  return codewords;
}

function codewordsToBytes(codewords: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(codewords.length);
  for (let index = 0; index < codewords.length; index += 1) bytes[index] = codewords[index] ?? 0;
  return bytes;
}

function readBits(bits: readonly number[], start: number, length: number): number {
  let value = 0;
  for (let bit = 0; bit < length; bit += 1) value = (value << 1) | (bits[start + bit] ?? 0);
  return value;
}

interface BitStream {
  readonly bits: readonly number[];
  cursor: number;
}

function readMode(stream: BitStream): number {
  const value = readBits(stream.bits, stream.cursor, 4);
  stream.cursor += 4;
  return value;
}

/**
 * Decodes the character-count indicator width for byte mode: 8 bits up to
 * version 9, 16 bits from version 10 up (clause 7.4.2.2).
 */
function byteCountBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

/**
 * Turns a verified codeword array into text. Any segment the tool does not
 * implement stops the decode with an explicit code: a QR code is not a
 * successful read just because some bytes came out.
 */
function payloadFromCodewords(dataCodewords: readonly number[], spec: QrVersionSpec): { readonly payload: string; readonly byteLength: number } {
  const bits = codewordsToBytes(dataCodewords);
  const stream: BitStream = { bits: [...bits].flatMap((value) => Array.from({ length: 8 }, (_value, bit) => (value >>> (7 - bit)) & 1)), cursor: 0 };
  const payload: number[] = [];
  let eci = 0;
  for (;;) {
    if (stream.cursor >= stream.bits.length) break;
    const mode = readMode(stream);
    if (mode === 0b0000) break;
    if (mode === QR_BYTE_MODE_INDICATOR) {
      const length = readBits(stream.bits, stream.cursor, byteCountBits(spec.version));
      stream.cursor += byteCountBits(spec.version);
      if (length > QR_MAX_BYTES) throw new Error("QR_PAYLOAD_TOO_LARGE");
      for (let index = 0; index < length; index += 1) {
        if (stream.cursor + 8 > stream.bits.length) throw new Error("QR_TRUNCATED_BIT_STREAM");
        payload.push(readBits(stream.bits, stream.cursor, 8));
        stream.cursor += 8;
      }
      continue;
    }
    if (mode === QR_ECI_MODE_INDICATOR) {
      if (stream.cursor >= stream.bits.length) throw new Error("QR_TRUNCATED_BIT_STREAM");
      const first = readBits(stream.bits, stream.cursor, 8);
      stream.cursor += 8;
      if ((first & 0x80) === 0x00) eci = first;
      else if ((first & 0xc0) === 0x80) {
        eci = ((first & 0x3f) << 8) | readBits(stream.bits, stream.cursor, 8);
        stream.cursor += 8;
      } else if ((first & 0xe0) === 0xc0) {
        eci = ((first & 0x1f) << 16) | readBits(stream.bits, stream.cursor, 16);
        stream.cursor += 16;
      } else throw new Error("QR_INVALID_ECI_DESIGNATOR");
      if (eci !== 0 && eci !== 26) throw new Error("QR_UNSUPPORTED_ECI");
      continue;
    }
    throw new Error("QR_UNSUPPORTED_MODE");
  }
  if (payload.length === 0) throw new Error("QR_EMPTY_PAYLOAD");
  try {
    return { payload: new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(payload)), byteLength: payload.length };
  } catch {
    throw new Error("QR_INVALID_UTF8");
  }
}

function decodeWithMask(modules: QrMatrix, spec: QrVersionSpec, mask: number, formatInfo: ReturnType<typeof readFormatInformation>): QrDecodeResult {
  const geometry = reserveGeometry(spec);
  const bits = readDataBits(modules, geometry.functions, mask);
  if (bits.length < spec.totalCodewords * 8) throw new Error("QR_MATRIX_TOO_SMALL");
  const codewords = bitsToCodewords(bits);
  const dataCount = dataCodewordCount(spec);
  const data = codewords.slice(0, dataCount);
  const parity = codewords.slice(dataCount, dataCount + spec.ecCodewords);
  if (parity.length !== spec.ecCodewords) throw new Error("QR_MATRIX_TOO_SMALL");
  if (!syndromesAreZero(codewords.slice(0, dataCount + spec.ecCodewords), spec.ecCodewords)) {
    throw new Error("QR_ERROR_CORRECTION_FAILED");
  }
  const { payload, byteLength } = payloadFromCodewords(data, spec);
  return {
    payload,
    version: spec.version,
    size: spec.size,
    errorCorrection: "L",
    mask,
    mode: "byte",
    byteLength,
    maskFromFormatInformation: formatInfo !== null,
    formatCopiesAgree: formatInfo?.copiesAgree ?? false,
    formatRepairDistance: formatInfo?.repairDistance ?? 15,
    errorCorrectionVerified: true,
    engineVersion: QR_DECODER_VERSION,
  };
}

export function decodeQrMatrixValue(value: unknown): QrDecodeResult {
  const matrix = normalizeMatrixInput(value);
  const spec = specForSize(matrix.length);
  const format = readFormatInformation(matrix, matrix.length);
  if (format !== null && format.errorLevelBits !== EC_LEVEL_BITS) throw new Error("QR_UNSUPPORTED_ERROR_CORRECTION_LEVEL");
  if (format !== null) return decodeWithMask(matrix, spec, format.mask, format);
  // The format field itself is unreadable. Trying every mask is only sound
  // because the syndromes are verified afterwards, so a false positive is
  // impossible; it is still reported as such.
  for (let mask = 0; mask < 8; mask += 1) {
    try {
      return decodeWithMask(matrix, spec, mask, null);
    } catch {
      continue;
    }
  }
  throw new Error("QR_DECODE_FAILED");
}

export function matrixFromRows(rows: readonly string[]): QrMatrix {
  if (
    rows.length < 21
    || rows.length > 33
    || rows.length % 4 !== 1
    || !QR_VERSION_SPECS.some((spec) => spec.size === rows.length)
    || rows.some((row) => row.length !== rows.length || !/^[01]+$/u.test(row))
  ) throw new Error("QR_INVALID_MATRIX");
  return rows.map((row) => [...row].map((value) => value === "1"));
}

/**
 * Accepts a matrix as an SVG string, a `data-matrix` attribute value, a JSON
 * array of "0"/"1" strings or booleans, or a plain pasted block of rows.
 */
export function normalizeMatrixInput(value: unknown): QrMatrix {
  if (Array.isArray(value)) {
    if (value.length > 1000) throw new Error("QR_INVALID_MATRIX");
    if (value.every((row) => typeof row === "string")) return matrixFromRows(value as string[]);
    if (!value.every((row) => Array.isArray(row) && row.length <= 1000)) throw new Error("QR_INVALID_MATRIX");
    return matrixFromRows((value as unknown[][]).map((row) => row.map((cell) => (cell ? "1" : "0")).join("")));
  }
  if (typeof value !== "string" || value.length > MAX_MATRIX_INPUT) throw new Error("QR_INVALID_INPUT");
  const trimmed = value.trim();
  if (trimmed === "") throw new Error("QR_INPUT_REQUIRED");
  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("QR_INVALID_MATRIX");
    }
    return normalizeMatrixInput(parsed);
  }
  const attribute = /data-matrix="([01;\s]+)"/u.exec(trimmed);
  if (attribute?.[1] !== undefined) return matrixFromRows(attribute[1].split(";").map((row) => row.trim()));
  const rows = trimmed.split(/\s+/u).filter((row) => row !== "");
  if (rows.length > 1 && rows.every((row) => /^[01]+$/u.test(row))) return matrixFromRows(rows);
  throw new Error("QR_INVALID_INPUT");
}
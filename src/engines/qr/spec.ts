/*
 * QR symbol structure: versions, function patterns, masks and format
 * information. Everything here is a restatement of a rule in ISO/IEC 18004
 * that can be recomputed from the rule, not a transcription of a table:
 *  - symbol size is 4·version + 17 (clause 6.3.1);
 *  - the data region holds totalCodewords·8 bits and the leftover module
 *    positions are the remainder bits (clauses 6.7, 7.5.1);
 *  - format information is BCH(15,5) masked with 0x5412 (clause 8.9).
 *
 * The supported envelope is deliberately narrow and stated: byte mode,
 * error-correction level L, versions 1–4. Those four versions are exactly the
 * ones with a single Reed–Solomon block at level L, so no block interleaving
 * is required and the encoder/decoder stay small enough to be fully verified
 * locally. Anything outside the envelope fails closed with an explicit code
 * instead of guessing.
 */

import { maskBit } from "./masks";

export type QrErrorCorrection = "L";

export const QR_EC_LEVEL = "L" as const;

/** Clause 6.5.1 error-correction level indicator written into the format bits. */
export const EC_LEVEL_BITS = 1 as const; // 0b01 = L

export interface QrVersionSpec {
  readonly version: number;
  /** Side length in modules, 4·version + 17. */
  readonly size: number;
  /** Total codewords in the symbol (data + error correction). */
  readonly totalCodewords: number;
  /** Error-correction codewords per block; level L, versions 1–4, one block. */
  readonly ecCodewords: number;
  /** Alignment-pattern centre coordinates, excluding the finder corners. */
  readonly alignmentCenters: readonly number[];
  /** Unused module positions after the last codeword, always 0 or 7 here. */
  readonly remainderBits: number;
}

export const QR_VERSION_SPECS: readonly QrVersionSpec[] = [
  { version: 1, size: 21, totalCodewords: 26, ecCodewords: 7, alignmentCenters: [], remainderBits: 0 },
  { version: 2, size: 25, totalCodewords: 44, ecCodewords: 10, alignmentCenters: [18], remainderBits: 7 },
  { version: 3, size: 29, totalCodewords: 70, ecCodewords: 15, alignmentCenters: [22], remainderBits: 7 },
  { version: 4, size: 33, totalCodewords: 100, ecCodewords: 20, alignmentCenters: [26], remainderBits: 7 },
];

export const QR_MAX_VERSION = 4;

/**
 * Byte-mode capacity in bytes, computed from the data codeword count instead
 * of copied: available bits minus the 4-bit mode indicator and the 8-bit
 * character count, floored to whole bytes.
 */
export const QR_BYTE_CAPACITY: readonly number[] = QR_VERSION_SPECS.map((spec) =>
  Math.floor(((spec.totalCodewords - spec.ecCodewords) * 8 - 4 - 8) / 8),
);

export const QR_MAX_BYTES = QR_BYTE_CAPACITY[QR_MAX_VERSION - 1] ?? 0;

/** ISO/IEC 18004 clause 6.3.1. */
export function symbolSize(version: number): number {
  return 4 * version + 17;
}

export function specForSize(size: number): QrVersionSpec {
  const spec = QR_VERSION_SPECS.find((candidate) => candidate.size === size);
  if (spec === undefined) throw new Error("QR_UNSUPPORTED_VERSION");
  return spec;
}

export function specForVersion(version: number): QrVersionSpec {
  const spec = QR_VERSION_SPECS.find((candidate) => candidate.version === version);
  if (spec === undefined) throw new Error("QR_UNSUPPORTED_VERSION");
  return spec;
}

/** Smallest version whose byte-mode capacity holds `bytes` UTF-8 bytes. */
export function chooseVersion(bytes: number): QrVersionSpec {
  const index = QR_BYTE_CAPACITY.findIndex((capacity) => bytes <= capacity);
  const spec = index === -1 ? undefined : QR_VERSION_SPECS[index];
  if (spec === undefined) throw new Error("QR_PAYLOAD_TOO_LARGE");
  return spec;
}

export function dataCodewordCount(spec: QrVersionSpec): number {
  return spec.totalCodewords - spec.ecCodewords;
}

export const QR_BYTE_MODE_INDICATOR = 0b0100;
export const QR_ECI_MODE_INDICATOR = 0b0111;
export const QR_TERMINATOR_LENGTH = 4;

/** Mask patterns 000–111, ISO/IEC 18004 clause 8.8.1 table 10. */
export { maskBit };
export const QR_MASK_COUNT = 8;

/**
 * The 15-bit format information word: 5 data bits (2 error-correction bits +
 * 3 mask bits) run through BCH(15,5) with generator 0x537, then XORed with
 * 0x5412 as required by clause 8.9.2.
 */
export function formatInformation(mask: number): number {
  if (!Number.isInteger(mask) || mask < 0 || mask >= QR_MASK_COUNT) throw new Error("QR_INVALID_MASK");
  const value = (EC_LEVEL_BITS << 3) | mask;
  let remainder = value << 10;
  for (let degree = 14; degree >= 10; degree -= 1) {
    if ((remainder & (1 << degree)) !== 0) remainder ^= 0x537 << (degree - 10);
  }
  return ((value << 10) | remainder) ^ 0x5412;
}

/** All 32 words the format field can legally hold, derived not transcribed. */
export const VALID_FORMAT_INFORMATION: readonly number[] = Array.from(
  { length: QR_MASK_COUNT },
  (_value, mask) => formatInformation(mask),
);

export function isValidFormatInformation(bits: number): boolean {
  return VALID_FORMAT_INFORMATION.includes(bits);
}

export function maskFromFormatInformation(bits: number): number {
  return (bits ^ 0x5412) & 0b111;
}
/*
 * QR geometry: which module belongs to a function pattern, where the format
 * information lives, and the single data traversal shared by the encoder and
 * the decoder (ISO/IEC 18004 clause 6.7.3 — the two-module-wide upward and
 * downward columns, skipping the vertical timing column).
 */

import { maskBit } from "./masks";
import type { QrVersionSpec } from "./spec";

export type QrMatrix = boolean[][];

export interface QrGeometry {
  readonly spec: QrVersionSpec;
  readonly size: number;
  readonly modules: QrMatrix;
  /** True where a function pattern or the format information occupies the module. */
  readonly functions: QrMatrix;
}

function blank(size: number): QrMatrix {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

function mark(geometry: QrGeometry, x: number, y: number, dark: boolean): void {
  if (x < 0 || y < 0 || x >= geometry.size || y >= geometry.size) return;
  geometry.modules[y]![x] = dark;
  geometry.functions[y]![x] = true;
}

function placeFinder(geometry: QrGeometry, left: number, top: number): void {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const inRing = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark = inRing && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      mark(geometry, left + dx, top + dy, dark);
    }
  }
}

function placeAlignment(geometry: QrGeometry, center: number): void {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      mark(geometry, center + dx, center + dy, dx === -2 || dx === 2 || dy === -2 || dy === 2 || (dx === 0 && dy === 0));
    }
  }
}

/** ISO/IEC 18004 clause 6.3: the three finder patterns plus their separators. */
export function reserveGeometry(spec: QrVersionSpec): QrGeometry {
  const size = spec.size;
  const geometry: QrGeometry = { spec, size, modules: blank(size), functions: blank(size) };
  placeFinder(geometry, 0, 0);
  placeFinder(geometry, size - 7, 0);
  placeFinder(geometry, 0, size - 7);
  for (const center of spec.alignmentCenters) placeAlignment(geometry, center);
  // Timing patterns: dark on even indices in row 6 and column 6.
  for (let index = 8; index < size - 8; index += 1) {
    mark(geometry, index, 6, index % 2 === 0);
    mark(geometry, 6, index, index % 2 === 0);
  }
  // Format information reservation around the top-left finder.
  for (let index = 0; index < 9; index += 1) {
    if (index === 6) continue;
    mark(geometry, 8, index, false);
    mark(geometry, index, 8, false);
  }
  for (let index = 0; index < 8; index += 1) {
    mark(geometry, size - 1 - index, 8, false);
    mark(geometry, 8, size - 1 - index, false);
  }
  // The single always-dark module (clause 6.8).
  mark(geometry, 8, size - 8, true);
  return geometry;
}

export interface FormatModule {
  readonly x: number;
  readonly y: number;
  /** Bit index inside the 15-bit format word, 0 = least significant. */
  readonly bit: number;
}

/** Both copies of the format information, ISO/IEC 18004 figure 25. */
export function formatModules(size: number): readonly FormatModule[] {
  const modules: FormatModule[] = [];
  for (let bit = 0; bit <= 5; bit += 1) modules.push({ x: 8, y: bit, bit });
  modules.push({ x: 8, y: 7, bit: 6 }, { x: 8, y: 8, bit: 7 }, { x: 7, y: 8, bit: 8 });
  for (let bit = 9; bit <= 14; bit += 1) modules.push({ x: 14 - bit, y: 8, bit });
  for (let bit = 0; bit <= 7; bit += 1) modules.push({ x: size - 1 - bit, y: 8, bit });
  for (let bit = 8; bit <= 14; bit += 1) modules.push({ x: 8, y: size - 15 + bit, bit });
  return modules;
}

export function applyFormatInformation(geometry: QrGeometry, bits: number): void {
  for (const { x, y, bit } of formatModules(geometry.size)) {
    geometry.modules[y]![x] = ((bits >>> bit) & 1) === 1;
    geometry.functions[y]![x] = true;
  }
}

/**
 * The 32 legal format words: every combination of the two error-correction
 * bits and the three mask bits, run through BCH(15,5) and masked with 0x5412.
 * Derived once from the construction rather than transcribed, so the list, the
 * encoder and the nearest-word search cannot drift apart. Only the eight
 * level-L words are encodable here, but all 32 must be *recognised*, or a
 * symbol from another encoder would look damaged.
 */
const LEGAL_FORMAT_WORDS: readonly number[] = Array.from({ length: 32 }, (_value, data) => {
  const value = data;
  let remainder = value << 10;
  for (let degree = 14; degree >= 10; degree -= 1) {
    if ((remainder & (1 << degree)) !== 0) remainder ^= 0x537 << (degree - 10);
  }
  return ((value << 10) | remainder) ^ 0x5412;
});

export function popcount15(value: number): number {
  let count = 0;
  for (let bit = 0; bit < 15; bit += 1) if (((value >>> bit) & 1) === 1) count += 1;
  return count;
}

/** Bit distance from a received 15-bit word to the nearest legal one. */
export function formatDistanceToNearestLegal(bits: number): number {
  let best = 16;
  for (const word of LEGAL_FORMAT_WORDS) {
    const distance = popcount15((word ^ bits) & 0x7fff);
    if (distance < best) best = distance;
  }
  return best;
}

export interface ReadFormatResult {
  readonly mask: number;
  readonly word: number;
  readonly errorLevelBits: number;
  /** True when both copies of the field agree, i.e. nothing had to be guessed. */
  readonly copiesAgree: boolean;
  /** Highest bit distance, across both copies, to a legal format word. */
  readonly repairDistance: number;
}

/**
 * Reads the format information from a matrix. BCH(15,5) has minimum distance
 * 7, so a received word within three bit errors is still unambiguous; anything
 * further is reported as unreadable rather than guessed.
 */
export function readFormatInformation(modules: QrMatrix, size: number): ReadFormatResult | null {
  const positions = formatModules(size);
  const half = positions.length / 2;
  const read = (slice: readonly FormatModule[]): number => {
    let bits = 0;
    for (const { x, y, bit } of slice) if (modules[y]?.[x] === true) bits |= 1 << bit;
    return bits;
  };
  const first = read(positions.slice(0, half));
  const second = read(positions.slice(half));
  const firstDistance = formatDistanceToNearestLegal(first);
  const secondDistance = formatDistanceToNearestLegal(second);
  if (firstDistance > 3 && secondDistance > 3) return null;
  const word = firstDistance <= secondDistance ? first : second;
  // Undoing the 0x5412 mask exposes the 5 data bits in positions 14..10:
  // two error-correction bits then three mask bits.
  const unmasked = (word ^ 0x5412) >>> 0;
  return {
    word,
    mask: (unmasked >>> 10) & 0b111,
    errorLevelBits: (unmasked >>> 13) & 0b11,
    copiesAgree: first === second,
    repairDistance: Math.max(firstDistance, secondDistance),
  };
}

/**
 * Module positions of the data region in placement order. The same list drives
 * the encoder and the decoder, so a bit can never be written in one place and
 * read from another.
 */
export function dataModulePositions(size: number, functions: QrMatrix): readonly { readonly x: number; readonly y: number }[] {
  const positions: { x: number; y: number }[] = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (functions[y]![x] === true) continue;
        positions.push({ x, y });
      }
    }
    upward = !upward;
  }
  return positions;
}

export function placeData(geometry: QrGeometry, codewords: readonly number[], mask: number): void {
  const positions = dataModulePositions(geometry.size, geometry.functions);
  let bitIndex = 0;
  for (const { x, y } of positions) {
    const byte = codewords[bitIndex >> 3] ?? 0;
    const bit = (byte >>> (7 - (bitIndex & 7))) & 1;
    geometry.modules[y]![x] = (bit ^ (maskBit(mask, x, y) ? 1 : 0)) === 1;
    bitIndex += 1;
  }
}

export function readDataBits(modules: QrMatrix, functions: QrMatrix, mask: number): number[] {
  const positions = dataModulePositions(modules.length, functions);
  return positions.map(({ x, y }) => (modules[y]![x] === true ? 1 : 0) ^ (maskBit(mask, x, y) ? 1 : 0));
}

export function cloneMatrix(modules: QrMatrix): QrMatrix {
  return modules.map((row) => [...row]);
}

export function matrixRows(modules: QrMatrix): string[] {
  return modules.map((row) => row.map((value) => (value ? "1" : "0")).join(""));
}
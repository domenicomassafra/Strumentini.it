/*
 * Reading a QR code out of pixels, entirely locally.
 *
 * Nothing here depends on a platform decoder: no `BarcodeDetector`, no WASM, no
 * network. The path mirrors what a physical scanner does, so the result is a
 * genuine local read on every browser the product supports:
 *
 *   RGBA → luminance → adaptive binarisation → 1:1:3:1:1 finder-pattern
 *   search along rows → cross-check along the column → cluster → pick the
 *   right-angle finder as the top-left → four-point perspective transform →
 *   sample one module per grid cell → hand the matrix to the matrix decoder,
 *   which still verifies the Reed–Solomon syndromes.
 *
 * The perspective transform uses the three finder centres plus the corner they
 * imply, and each of the two possible handings is tried and then validated by
 * the format information, so a wrong guess cannot silently produce text.
 */

import { decodeQrMatrixValue, type QrDecodeResult } from "./decode";
import { matrixRows } from "./geometry";
import { QR_VERSION_SPECS, type QrVersionSpec } from "./spec";

export const QR_RASTER_VERSION = "qr-local-raster-v1";

export interface RasterPixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** Upper bound on the raster this decoder will look at, to bound work. */
export const QR_RASTER_MAX_PIXELS = 4_000_000;

export interface RasterDecodeResult extends QrDecodeResult {
  readonly source: "image";
  readonly moduleSizePixels: number;
  readonly sampledDarkModules: number;
}

interface Luminance {
  readonly width: number;
  readonly height: number;
  readonly values: Uint8Array;
}

function luminanceOf(pixels: RasterPixels): Luminance {
  const { width, height, data } = pixels;
  const values = new Uint8Array(width * height);
  for (let index = 0, pixel = 0; pixel < width * height; pixel += 1, index += 4) {
    values[pixel] = (data[index]! * 77 + data[index + 1]! * 151 + data[index + 2]! * 28) >> 8;
  }
  return { width, height, values };
}

function histogram(grey: Luminance): Uint32Array {
  const bins = new Uint32Array(256);
  for (const value of grey.values) bins[value] = (bins[value] ?? 0) + 1;
  return bins;
}

/** Otsu's method: the threshold that maximises between-class variance. */
function otsuThreshold(bins: Uint32Array, total: number): number {
  let sum = 0;
  for (let value = 0; value < 256; value += 1) sum += value * (bins[value] ?? 0);
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let best = 0;
  let bestVariance = -1;
  for (let value = 0; value < 256; value += 1) {
    backgroundWeight += bins[value] ?? 0;
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += value * (bins[value] ?? 0);
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      best = value;
    }
  }
  return best;
}

const BLOCK_SIZE = 8;
const MIN_BLOCK_DYNAMIC_RANGE = 24;

/**
 * Adaptive binarisation. A global Otsu threshold handles clean, evenly lit
 * symbols; a symbol photographed or scaled unevenly needs a local threshold, so
 * every block that carries enough contrast picks its own minimum/maximum and
 * the rest fall back to the global value.
 */
function binarize(grey: Luminance): Uint8Array {
  const { width, height, values } = grey;
  const total = width * height;
  const global = otsuThreshold(histogram(grey), total);
  const blocksX = Math.max(1, Math.ceil(width / BLOCK_SIZE));
  const blocksY = Math.max(1, Math.ceil(height / BLOCK_SIZE));
  const minimum = new Int32Array(blocksX * blocksY);
  const maximum = new Int32Array(blocksX * blocksY);
  const mean = new Int32Array(blocksX * blocksY);
  for (let by = 0; by < blocksY; by += 1) {
    for (let bx = 0; bx < blocksX; bx += 1) {
      let min = 255;
      let max = 0;
      let sum = 0;
      let count = 0;
      for (let y = by * BLOCK_SIZE; y < Math.min((by + 1) * BLOCK_SIZE, height); y += 1) {
        for (let x = bx * BLOCK_SIZE; x < Math.min((bx + 1) * BLOCK_SIZE, width); x += 1) {
          const value = values[y * width + x]!;
          if (value < min) min = value;
          if (value > max) max = value;
          sum += value;
          count += 1;
        }
      }
      const index = by * blocksX + bx;
      minimum[index] = min;
      maximum[index] = max;
      mean[index] = count === 0 ? 0 : Math.floor(sum / count);
    }
  }
  const dark = new Uint8Array(total);
  for (let y = 0; y < height; y += 1) {
    const by = (y / BLOCK_SIZE) | 0;
    for (let x = 0; x < width; x += 1) {
      const bx = (x / BLOCK_SIZE) | 0;
      const index = by * blocksX + bx;
      let threshold = global;
      if (maximum[index]! - minimum[index]! > MIN_BLOCK_DYNAMIC_RANGE) {
        let neighbourSum = 0;
        let neighbourCount = 0;
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = bx + dx;
            const ny = by + dy;
            if (nx < 0 || ny < 0 || nx >= blocksX || ny >= blocksY) continue;
            const neighbour = ny * blocksX + nx;
            if (maximum[neighbour]! - minimum[neighbour]! <= MIN_BLOCK_DYNAMIC_RANGE) continue;
            neighbourSum += (minimum[neighbour]! + maximum[neighbour]!) / 2;
            neighbourCount += 1;
          }
        }
        threshold = neighbourCount === 0 ? global : Math.round(neighbourSum / neighbourCount);
      }
      dark[y * width + x] = values[y * width + x]! <= threshold ? 1 : 0;
    }
  }
  return dark;
}

interface Run {
  readonly dark: boolean;
  readonly start: number;
  readonly length: number;
}

function runsAtRow(dark: Uint8Array, width: number, y: number): Run[] {
  return alternatingRuns(
    (x) => dark[y * width + x] === 1,
    width,
  );
}

interface Finder {
  x: number;
  y: number;
  moduleSize: number;
  hits: number;
}

const OUTER_TOLERANCE = 0.5;
const CENTRE_TOLERANCE = 0.5;

/**
 * Module size implied by a 1:1:3:1:1 run sequence, or null when the sequence is
 * not that shape. The four outer runs are one module each and the middle run is
 * three, so the outer runs set the scale and the middle run is checked against
 * it rather than averaged in — averaging would fold a 3:1 ratio down to 1.4:1
 * and reject every real symbol.
 */
function finderModuleSize(lengths: readonly number[]): number | null {
  const [first = 0, second = 0, centre = 0, fourth = 0, fifth = 0] = lengths;
  const moduleSize = (first + second + fourth + fifth) / 4;
  if (!Number.isFinite(moduleSize) || moduleSize < 1) return null;
  for (const length of [first, second, fourth, fifth]) {
    if (Math.abs(length - moduleSize) > moduleSize * OUTER_TOLERANCE) return null;
  }
  if (Math.abs(centre - moduleSize * 3) > moduleSize * 3 * CENTRE_TOLERANCE) return null;
  return moduleSize;
}

function columnRuns(dark: Uint8Array, width: number, height: number, x: number): Run[] {
  return alternatingRuns(
    (y) => dark[y * width + x] === 1,
    height,
  );
}

function alternatingRuns(at: (index: number) => boolean, length: number): Run[] {
  const runs: Run[] = [];
  if (length === 0) return runs;
  let start = 0;
  let current = at(0);
  for (let index = 1; index < length; index += 1) {
    const value = at(index);
    if (value === current) continue;
    runs.push({ dark: current, start, length: index - start });
    start = index;
    current = value;
  }
  runs.push({ dark: current, start, length: length - start });
  return runs;
}

/** Verifies the 1:1:3:1:1 run pattern along the column through the candidate. */
function crossCheckColumn(dark: Uint8Array, width: number, height: number, x: number, y: number): number | null {
  if (x < 0 || x >= width || y < 0 || y >= height) return null;
  const centerY = Math.round(y);
  const runs = columnRuns(dark, width, height, x);
  const index = runs.findIndex((run) => run.start <= centerY && run.start + run.length > centerY);
  if (index === -1 || !runs[index]!.dark) return null;
  const lengths: number[] = [];
  for (let up = index - 1; up >= 0 && lengths.length < 2; up -= 1) lengths.unshift(runs[up]!.length);
  if (lengths.length < 2) return null;
  lengths.push(runs[index]!.length);
  for (let down = index + 1; down < runs.length && lengths.length < 5; down += 1) lengths.push(runs[down]!.length);
  if (lengths.length < 5) return null;
  return finderModuleSize(lengths);
}

function findFinderPatterns(dark: Uint8Array, width: number, height: number): Finder[] {
  const found: Finder[] = [];
  for (let y = 0; y < height; y += 1) {
    const runs = runsAtRow(dark, width, y);
    for (let index = 0; index + 4 < runs.length; index += 1) {
      const first = runs[index]!;
      const second = runs[index + 1]!;
      const third = runs[index + 2]!;
      const fourth = runs[index + 3]!;
      const fifth = runs[index + 4]!;
      if (!first.dark || second.dark || !third.dark || fourth.dark || !fifth.dark) continue;
      const moduleSize = finderModuleSize([first, second, third, fourth, fifth].map((run) => run.length));
      if (moduleSize === null) continue;
      const centerX = third.start + third.length / 2;
      const confirmed = crossCheckColumn(dark, width, height, Math.round(centerX), y);
      if (confirmed === null) continue;
      found.push({ x: centerX, y, moduleSize: (moduleSize + confirmed) / 2, hits: 1 });
    }
  }
  return clusterFinders(found);
}

/**
 * Groups scan-line hits that describe the same physical finder pattern.
 * Membership is tested against any member of the group, not against a running
 * centroid: a finder is seven modules tall, so a centroid that drifts as rows
 * arrive would otherwise split one pattern into two.
 */
function clusterFinders(finders: readonly Finder[]): Finder[] {
  const groups: Finder[][] = [];
  for (const finder of finders) {
    const radius = Math.max(1, finder.moduleSize);
    const group = groups.find((candidates) =>
      candidates.some((candidate) => Math.hypot(candidate.x - finder.x, candidate.y - finder.y) <= radius));
    if (group === undefined) groups.push([finder]);
    else group.push(finder);
  }
  return groups.map((group) => ({
    x: group.reduce((sum, candidate) => sum + candidate.x, 0) / group.length,
    y: group.reduce((sum, candidate) => sum + candidate.y, 0) / group.length,
    moduleSize: group.reduce((sum, candidate) => sum + candidate.moduleSize, 0) / group.length,
    hits: group.length,
  }));
}

interface Point {
  readonly x: number;
  readonly y: number;
}

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

/**
 * Of three finder patterns, the top-left one is the vertex of the two shortest
 * sides: the top-right and bottom-left centres are √2 times further apart.
 */
function rightAngleVertex(a: Point, b: Point, c: Point): Point {
  const sides = [distance(a, b), distance(a, c), distance(b, c)];
  if (sides[0]! >= sides[1]! && sides[0]! >= sides[2]!) return c;
  if (sides[1]! >= sides[0]! && sides[1]! >= sides[2]!) return b;
  return a;
}

function solveLinear(matrix: readonly (readonly number[])[], vector: readonly number[]): number[] | null {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]!]);
  for (let pivot = 0; pivot < size; pivot += 1) {
    let bestRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(rows[row]![pivot]!) > Math.abs(rows[bestRow]![pivot]!)) bestRow = row;
    }
    if (Math.abs(rows[bestRow]![pivot]!) < 1e-9) return null;
    const swap = rows[pivot]!;
    rows[pivot] = rows[bestRow]!;
    rows[bestRow] = swap;
    const divisor = rows[pivot]![pivot]!;
    for (let column = pivot; column <= size; column += 1) rows[pivot]![column] = rows[pivot]![column]! / divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = rows[row]![pivot]!;
      if (factor === 0) continue;
      for (let column = pivot; column <= size; column += 1) rows[row]![column] = rows[row]![column]! - factor * rows[pivot]![column]!;
    }
  }
  return rows.map((row) => row[size]!);
}

/**
 * Four-point projective transform from module coordinates to pixel
 * coordinates, solved as the 8×8 linear system described by the equations
 *   x = (a·u + b·v + c) / (g·u + h·v + 1)
 *   y = (d·u + e·v + f) / (g·u + h·v + 1)
 */
function projectiveTransform(correspondences: readonly { readonly u: number; readonly v: number; readonly x: number; readonly y: number }[]):
  ((u: number, v: number) => Point) | null {
  if (correspondences.length !== 4) return null;
  const matrix: number[][] = [];
  const vector: number[] = [];
  for (const { u, v, x, y } of correspondences) {
    matrix.push([u, v, 1, 0, 0, 0, -u * x, -v * x], [0, 0, 0, u, v, 1, -u * y, -v * y]);
    vector.push(x, y);
  }
  const solution = solveLinear(matrix, vector);
  if (solution === null || solution.length !== 8) return null;
  const a = solution[0]!;
  const b = solution[1]!;
  const c = solution[2]!;
  const d = solution[3]!;
  const e = solution[4]!;
  const f = solution[5]!;
  const g = solution[6]!;
  const h = solution[7]!;
  if (![a, b, c, d, e, f, g, h].every((value) => Number.isFinite(value))) return null;
  return (u, v) => {
    const denominator = g * u + h * v + 1;
    if (Math.abs(denominator) < 1e-9) return { x: Number.NaN, y: Number.NaN };
    return { x: (a * u + b * v + c) / denominator, y: (d * u + e * v + f) / denominator };
  };
}

/**
 * Supported symbol sizes, largest last, so the hypotheses closest to the
 * geometry estimate are tried first.
 */
function versionHypotheses(moduleSpan: number): QrVersionSpec[] {
  const ranked = [...QR_VERSION_SPECS].sort((left, right) =>
    Math.abs(left.size - (moduleSpan + 7)) - Math.abs(right.size - (moduleSpan + 7)));
  return ranked;
}

/**
 * Samples one module per cell. Each cell is read at its centre and at four
 * points a quarter of a module away; the majority wins, so one hot pixel cannot
 * flip a module. The offset is expressed in module units, not pixels: a
 * pixel-derived offset would turn into a whole neighbouring module at small
 * scales and silently corrupt the read.
 */
function sampleMatrix(
  transform: (u: number, v: number) => Point,
  dark: Uint8Array,
  width: number,
  height: number,
  size: number,
): boolean[][] | null {
  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const radius = SAMPLE_RADIUS_MODULES;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const u = column + 0.5;
      const v = row + 0.5;
      const points = [transform(u, v), transform(u - radius, v), transform(u + radius, v), transform(u, v - radius), transform(u, v + radius)];
      let votes = 0;
      let counted = 0;
      for (const point of points) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        const x = Math.round(point.x);
        const y = Math.round(point.y);
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        votes += dark[y * width + x]!;
        counted += 1;
      }
      if (counted === 0) return null;
      modules[row]![column] = votes * 2 > counted;
    }
  }
  return modules;
}

const SAMPLE_RADIUS_MODULES = 0.25;

function handings(triple: readonly [Point, Point, Point]): readonly { readonly topLeft: Point; readonly topRight: Point; readonly bottomLeft: Point }[] {
  const topLeft = rightAngleVertex(triple[0], triple[1], triple[2]);
  const others = [triple[0], triple[1], triple[2]].filter((point) => point !== topLeft);
  return [
    { topLeft, topRight: others[0]!, bottomLeft: others[1]! },
    { topLeft, topRight: others[1]!, bottomLeft: others[0]! },
  ];
}

/**
 * Decodes the QR symbol inside an RGBA raster. Returns null when no symbol can
 * be read, so the caller can produce one honest error instead of a guess.
 */
export function decodeQrFromRaster(pixels: RasterPixels): RasterDecodeResult | null {
  if (typeof pixels !== "object" || pixels === null) throw new Error("QR_INVALID_INPUT");
  const { width, height } = pixels;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 21 || height < 21) throw new Error("QR_IMAGE_TOO_SMALL");
  if (width * height > QR_RASTER_MAX_PIXELS) throw new Error("QR_IMAGE_TOO_LARGE");
  if (!ArrayBuffer.isView(pixels.data) || pixels.data.length < width * height * 4) throw new Error("QR_INVALID_INPUT");
  const grey = luminanceOf({ width, height, data: pixels.data as Uint8ClampedArray });
  const dark = binarize(grey);
  const finders = findFinderPatterns(dark, width, height)
    .sort((left, right) => right.hits - left.hits)
    .slice(0, 6);
  if (finders.length < 3) return null;
  for (let first = 0; first < finders.length - 2; first += 1) {
    for (let second = first + 1; second < finders.length - 1; second += 1) {
      for (let third = second + 1; third < finders.length; third += 1) {
        const triple = [finders[first]!, finders[second]!, finders[third]!] as const;
        const moduleSize = (triple[0].moduleSize + triple[1].moduleSize + triple[2].moduleSize) / 3;
        if (moduleSize < 1) continue;
        for (const orientation of handings(triple)) {
          // The symbol version is not trusted from the geometry: each supported
          // size is a hypothesis, and the format-information code plus the
          // Reed-Solomon syndromes decide which one is real. That removes both
          // a magic tolerance and any dependence on how the finder positions
          // happened to be measured.
          for (const spec of versionHypotheses(distance(orientation.topRight, orientation.topLeft) / moduleSize)) {
            const transform = projectiveTransform([
              { u: 3.5, v: 3.5, x: orientation.topLeft.x, y: orientation.topLeft.y },
              { u: spec.size - 3.5, v: 3.5, x: orientation.topRight.x, y: orientation.topRight.y },
              { u: 3.5, v: spec.size - 3.5, x: orientation.bottomLeft.x, y: orientation.bottomLeft.y },
              {
                u: spec.size - 3.5,
                v: spec.size - 3.5,
                x: orientation.topRight.x + orientation.bottomLeft.x - orientation.topLeft.x,
                y: orientation.topRight.y + orientation.bottomLeft.y - orientation.topLeft.y,
              },
            ]);
            if (transform === null) continue;
            const modules = sampleMatrix(transform, dark, width, height, spec.size);
            if (modules === null) continue;
            let decoded: QrDecodeResult;
            try {
              decoded = decodeQrMatrixValue(matrixRows(modules));
            } catch {
              continue;
            }
            return {
              ...decoded,
              source: "image",
              moduleSizePixels: Math.round(moduleSize * 100) / 100,
              sampledDarkModules: modules.flat().filter((value) => value).length,
            };
          }
        }
      }
    }
  }
  return null;
}

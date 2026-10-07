import type { ToolModule } from "../../runtime/types";
import {
  unbiasedRandomIndex,
  type RandomFill,
} from "../password-pin-passphrase-generator/module";

const UINT32_RANGE = 0x1_0000_0000;
export const DEFAULT_COUPON_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const RANDOM_BATCH_MAX = 1_000;
export const RANDOM_LIST_MAX = 2_000;
export const TEAM_COUNT_MAX = 64;
export const COUPON_LENGTH_MIN = 4;
export const COUPON_LENGTH_MAX = 32;
export const SEED_MAX_LENGTH = 256;

export type RandomnessMode = "secure" | "seeded";

export interface RandomnessDisclosure {
  readonly mode: RandomnessMode;
  readonly secure: boolean;
  readonly label: string;
}

function boundedInteger(value: unknown, minimum: number, maximum: number, error: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(error);
  return parsed;
}

function assertSeed(seed: unknown): string {
  if (typeof seed !== "string" || seed.length === 0 || seed.length > SEED_MAX_LENGTH) throw new Error("SEED_INVALID");
  return seed;
}

/** Deterministic PRNG for reproducible fixtures/draws. It is intentionally not cryptographically secure. */
export function createSeededRandomFill(seedValue: string): RandomFill {
  const seed = assertSeed(seedValue);
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619) >>> 0;
  }
  if (state === 0) state = 0x6d2b79f5;

  return (buffer) => {
    for (let index = 0; index < buffer.length; index += 1) {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      buffer[index] = (value ^ (value >>> 14)) >>> 0;
    }
    return buffer;
  };
}

function randomnessFor(modeValue: unknown, seedValue: unknown, secureFill?: RandomFill): { disclosure: RandomnessDisclosure; fill?: RandomFill } {
  const mode = modeValue === "seeded" ? "seeded" : modeValue === undefined || modeValue === "secure" ? "secure" : null;
  if (mode === null) throw new Error("RANDOMNESS_MODE_INVALID");
  if (mode === "seeded") {
    return {
      disclosure: { mode, secure: false, label: "Riproducibile con seed; NON sicuro per segreti, premi o estrazioni che richiedono imprevedibilità." },
      fill: createSeededRandomFill(assertSeed(seedValue)),
    };
  }
  return {
    disclosure: { mode, secure: true, label: "WebCrypto getRandomValues con rejection sampling senza modulo bias." },
    ...(secureFill === undefined ? {} : { fill: secureFill }),
  };
}

function nextIndex(limit: number, fill?: RandomFill): number {
  return unbiasedRandomIndex(limit, fill);
}

function sampleUniqueIndices(populationSize: number, count: number, fill?: RandomFill): number[] {
  if (!Number.isSafeInteger(populationSize) || populationSize < 1 || populationSize > UINT32_RANGE) throw new Error("RANDOM_POPULATION_INVALID");
  if (!Number.isSafeInteger(count) || count < 0 || count > populationSize) throw new Error("RANDOM_SAMPLE_COUNT_INVALID");
  const remap = new Map<number, number>();
  const output: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const pickedPosition = index + nextIndex(populationSize - index, fill);
    const pickedValue = remap.get(pickedPosition) ?? pickedPosition;
    const replacement = remap.get(index) ?? index;
    remap.set(pickedPosition, replacement);
    output.push(pickedValue);
  }
  return output;
}

function normalizedLines(value: unknown): Array<{ sourceIndex: number; label: string }> {
  if (typeof value !== "string") throw new Error("LIST_REQUIRED");
  const lines = value.replace(/\r\n?/gu, "\n").split("\n");
  const items = lines
    .map((line, index) => ({ sourceIndex: index + 1, label: line.trim() }))
    .filter(({ label }) => label.length > 0);
  if (items.length === 0) throw new Error("LIST_REQUIRED");
  if (items.length > RANDOM_LIST_MAX) throw new Error("LIST_TOO_LARGE");
  return items;
}

export interface RandomNumberResult {
  readonly mode: "number";
  readonly values: readonly number[];
  readonly minimum: number;
  readonly maximum: number;
  readonly allowDuplicates: boolean;
  readonly randomness: RandomnessDisclosure;
}

export function generateRandomNumbers(input: {
  minimum: number;
  maximum: number;
  count?: number;
  allowDuplicates?: boolean;
  randomness?: RandomnessMode;
  seed?: string;
}, secureFill?: RandomFill): RandomNumberResult {
  const minimum = boundedInteger(input.minimum, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, "RANDOM_MIN_INVALID");
  const maximum = boundedInteger(input.maximum, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, "RANDOM_MAX_INVALID");
  if (maximum < minimum) throw new Error("RANDOM_RANGE_ORDER_INVALID");
  const span = maximum - minimum + 1;
  if (!Number.isSafeInteger(span) || span < 1 || span > UINT32_RANGE) throw new Error("RANDOM_RANGE_TOO_LARGE");
  const count = boundedInteger(input.count ?? 1, 1, RANDOM_BATCH_MAX, "RANDOM_COUNT_INVALID");
  const allowDuplicates = input.allowDuplicates !== false;
  if (!allowDuplicates && count > span) throw new Error("RANDOM_UNIQUE_COUNT_EXCEEDS_RANGE");
  const { disclosure, fill } = randomnessFor(input.randomness, input.seed, secureFill);
  const indexes = allowDuplicates
    ? Array.from({ length: count }, () => nextIndex(span, fill))
    : sampleUniqueIndices(span, count, fill);
  return { mode: "number", values: indexes.map((index) => minimum + index), minimum, maximum, allowDuplicates, randomness: disclosure };
}

export interface PickerResult {
  readonly mode: "picker";
  readonly picks: readonly { sourceIndex: number; label: string }[];
  readonly sourceCount: number;
  readonly duplicateLabelCount: number;
  readonly randomness: RandomnessDisclosure;
  readonly duplicatePolicy: string;
}

export function drawRandomItems(input: {
  items: string;
  count?: number;
  randomness?: RandomnessMode;
  seed?: string;
}, secureFill?: RandomFill): PickerResult {
  const items = normalizedLines(input.items);
  const count = boundedInteger(input.count ?? 1, 1, Math.min(RANDOM_BATCH_MAX, items.length), "PICK_COUNT_INVALID");
  const { disclosure, fill } = randomnessFor(input.randomness, input.seed, secureFill);
  const picks = sampleUniqueIndices(items.length, count, fill).map((index) => items[index]!);
  const distinctLabels = new Set(items.map(({ label }) => label)).size;
  return {
    mode: "picker",
    picks,
    sourceCount: items.length,
    duplicateLabelCount: items.length - distinctLabels,
    randomness: disclosure,
    duplicatePolicy: "Le righe non vuote sono ticket distinti: etichette uguali restano eleggibili separatamente; ogni ticket può uscire una sola volta per estrazione.",
  };
}

export interface TeamSplitResult {
  readonly mode: "teams";
  readonly teams: readonly (readonly string[])[];
  readonly teamCount: number;
  readonly participantCount: number;
  readonly randomness: RandomnessDisclosure;
  readonly duplicatePolicy: string;
}

export function splitBalancedTeams(input: {
  participants: string;
  teamCount: number;
  randomness?: RandomnessMode;
  seed?: string;
}, secureFill?: RandomFill): TeamSplitResult {
  const participants = normalizedLines(input.participants);
  if (new Set(participants.map(({ label }) => label)).size !== participants.length) throw new Error("TEAM_DUPLICATE_PARTICIPANT");
  const teamCount = boundedInteger(input.teamCount, 2, Math.min(TEAM_COUNT_MAX, participants.length), "TEAM_COUNT_INVALID");
  const { disclosure, fill } = randomnessFor(input.randomness, input.seed, secureFill);
  const order = sampleUniqueIndices(participants.length, participants.length, fill);
  const teams = Array.from({ length: teamCount }, () => [] as string[]);
  order.forEach((participantIndex, index) => teams[index % teamCount]!.push(participants[participantIndex]!.label));
  return {
    mode: "teams",
    teams,
    teamCount,
    participantCount: participants.length,
    randomness: disclosure,
    duplicatePolicy: "I nomi sono confrontati dopo trim; duplicati esatti vengono rifiutati per evitare identità ambigue. Le dimensioni dei team differiscono al massimo di una persona.",
  };
}

function couponAlphabet(value: unknown): { symbols: string[]; removedDuplicates: number } {
  const raw = value === undefined ? DEFAULT_COUPON_ALPHABET : typeof value === "string" ? value : "";
  const codePoints = Array.from(raw);
  if (codePoints.some((symbol) => /\s|\p{Cc}/u.test(symbol))) throw new Error("COUPON_ALPHABET_INVALID");
  const symbols = [...new Set(codePoints)];
  if (symbols.length < 2 || symbols.length > 64) throw new Error("COUPON_ALPHABET_INVALID");
  return { symbols, removedDuplicates: codePoints.length - symbols.length };
}

export interface CouponResult {
  readonly mode: "coupon";
  readonly codes: readonly string[];
  readonly alphabet: string;
  readonly removedAlphabetDuplicates: number;
  readonly randomness: RandomnessDisclosure;
  readonly duplicatePolicy: string;
}

export function generateCouponCodes(input: {
  count?: number;
  length?: number;
  alphabet?: string;
  prefix?: string;
  randomness?: RandomnessMode;
  seed?: string;
}, secureFill?: RandomFill): CouponResult {
  const count = boundedInteger(input.count ?? 1, 1, RANDOM_BATCH_MAX, "COUPON_COUNT_INVALID");
  const length = boundedInteger(input.length ?? 10, COUPON_LENGTH_MIN, COUPON_LENGTH_MAX, "COUPON_LENGTH_INVALID");
  const prefix = input.prefix ?? "";
  if (typeof prefix !== "string" || prefix.length > 24 || /[\r\n\p{Cc}]/u.test(prefix)) throw new Error("COUPON_PREFIX_INVALID");
  const { symbols, removedDuplicates } = couponAlphabet(input.alphabet);
  const codeSpace = BigInt(symbols.length) ** BigInt(length);
  if (BigInt(count) > codeSpace) throw new Error("COUPON_COUNT_EXCEEDS_SPACE");
  const { disclosure, fill } = randomnessFor(input.randomness, input.seed, secureFill);
  const seen = new Set<string>();
  const codes: string[] = [];
  const attemptLimit = Math.max(256, count * 64);
  for (let attempt = 0; codes.length < count && attempt < attemptLimit; attempt += 1) {
    let body = "";
    for (let index = 0; index < length; index += 1) body += symbols[nextIndex(symbols.length, fill)]!;
    const code = `${prefix}${body}`;
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  if (codes.length !== count) throw new Error("COUPON_COLLISION_LIMIT");
  return {
    mode: "coupon",
    codes,
    alphabet: symbols.join(""),
    removedAlphabetDuplicates: removedDuplicates,
    randomness: disclosure,
    duplicatePolicy: "L'alfabeto rimuove duplicati preservando la prima occorrenza; i coupon finali sono sempre unici, con collisioni scartate e limite esplicito di tentativi.",
  };
}

export type RandomUtilityResult = RandomNumberResult | PickerResult | TeamSplitResult | CouponResult;

export function runRandomUtility(input: unknown, secureFill?: RandomFill): RandomUtilityResult {
  if (typeof input !== "object" || input === null) throw new Error("INVALID_INPUT");
  const record = input as Record<string, unknown>;
  if (record.mode === "number") {
    return generateRandomNumbers({
      minimum: Number(record.minimum), maximum: Number(record.maximum), count: record.count === undefined ? 1 : Number(record.count),
      allowDuplicates: record.allowDuplicates !== false,
      ...(record.randomness === undefined ? {} : { randomness: record.randomness as RandomnessMode }),
      ...(record.seed === undefined ? {} : { seed: record.seed as string }),
    }, secureFill);
  }
  if (record.mode === "picker") {
    return drawRandomItems({
      items: typeof record.items === "string" ? record.items : "", count: record.count === undefined ? 1 : Number(record.count),
      ...(record.randomness === undefined ? {} : { randomness: record.randomness as RandomnessMode }),
      ...(record.seed === undefined ? {} : { seed: record.seed as string }),
    }, secureFill);
  }
  if (record.mode === "teams") {
    return splitBalancedTeams({
      participants: typeof record.participants === "string" ? record.participants : "", teamCount: Number(record.teamCount),
      ...(record.randomness === undefined ? {} : { randomness: record.randomness as RandomnessMode }),
      ...(record.seed === undefined ? {} : { seed: record.seed as string }),
    }, secureFill);
  }
  if (record.mode === "coupon") {
    return generateCouponCodes({
      count: record.count === undefined ? 1 : Number(record.count), length: record.length === undefined ? 10 : Number(record.length),
      ...(record.alphabet === undefined ? {} : { alphabet: record.alphabet as string }),
      ...(record.prefix === undefined ? {} : { prefix: record.prefix as string }),
      ...(record.randomness === undefined ? {} : { randomness: record.randomness as RandomnessMode }),
      ...(record.seed === undefined ? {} : { seed: record.seed as string }),
    }, secureFill);
  }
  throw new Error("RANDOM_UTILITY_MODE_INVALID");
}

const module: ToolModule = { run: (input) => runRandomUtility(input) };

export default module;

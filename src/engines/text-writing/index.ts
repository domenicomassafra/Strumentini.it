import { compareLists, dedupeLines, diffText, parseListText, type EqualityMode } from "../text-list";

export const TEXT_WRITING_ENGINE_VERSION = "text-writing-v1";
const MAX_TEXT_INPUT = 2 * 1024 * 1024;
const MAX_TEXT_ROWS = 100_000;
const MAX_TEXT_CELLS = 2_000_000;
const MAX_TEXT_REGEX_LENGTH = 1_000;
/** Reading-rate policy: a documented Italian reading speed with a bounded, explicit range. */
export const DEFAULT_WORDS_PER_MINUTE = 200;
export const MAX_WORDS_PER_MINUTE = 2_000;
export { diffText };

function readingTimeIt(minutes: number): string {
  if (minutes <= 0) return "meno di 1 minuto";
  if (minutes === 1) return "1 minuto";
  if (minutes < 60) return `${minutes} minuti`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ${hours === 1 ? "ora" : "ore"}` : `${hours} ${hours === 1 ? "ora" : "ore"} e ${rest} ${rest === 1 ? "minuto" : "minuti"}`;
}

export type CaseMode =
  | "lower"
  | "upper"
  | "title"
  | "sentence"
  | "camel"
  | "pascal"
  | "kebab"
  | "snake"
  | "constant";

export type UnicodeForm = "NFC" | "NFD" | "NFKC" | "NFKD";
export type QuoteDirection = "straight-to-curly" | "curly-to-straight";

export interface TextInspectionResult {
  words: number;
  wordCount: number;
  characters: number;
  characterCount: number;
  charactersWithSpaces: number;
  characterCountWithSpaces: number;
  charactersWithoutSpaces: number;
  codePoints: number;
  codeUnits: number;
  graphemeClusters: number;
  graphemeClusterCount: number;
  bytes: number;
  lines: number;
  lineCount: number;
  paragraphs: number;
  paragraphCount: number;
  engineVersion: string;
}

export interface ReadingTimeResult {
  words: number;
  wordCount: number;
  wordsPerMinute: number;
  exactMinutes: number;
  minutes: number;
  estimatedMinutes: number;
  roundedMinutes: number;
  seconds: number;
  display: string;
  engineVersion: string;
}

export interface CaseConversionResult {
  text: string;
  output: string;
  mode: CaseMode;
  changed: boolean;
  engineVersion: string;
}

export interface WhitespaceResult {
  text: string;
  output: string;
  changed: boolean;
  lineCount: number;
  engineVersion: string;
}

export interface InvisibleCharacterResult {
  codePoint: string;
  offset: number;
  index: number;
  name: string;
  character: string;
}

export interface InvisibleCharacterOutput {
  characters: InvisibleCharacterResult[];
  found: InvisibleCharacterResult[];
  count: number;
  cleanText: string;
  engineVersion: string;
}

export interface UnicodeNormalizationResult {
  text: string;
  output: string;
  form: UnicodeForm;
  changed: boolean;
  engineVersion: string;
}

export interface QuoteNormalizationResult {
  text: string;
  output: string;
  direction: QuoteDirection;
  convertedCount: number;
  changed: boolean;
  engineVersion: string;
}

export interface LineSortResult {
  text: string;
  output: string;
  lines: string[];
  lineCount: number;
  descending: boolean;
  caseSensitive: boolean;
  engineVersion: string;
}

export interface LineDedupeResult {
  text: string;
  output: string;
  lines: string[];
  keptCount: number;
  removedCount: number;
  equality: EqualityMode;
  engineVersion: string;
}

export interface ListIntersectionResult {
  intersection: string[];
  count: number;
  equality: EqualityMode;
  engineVersion: string;
}

export interface ListDifferenceResult {
  difference: string[];
  onlyLeft: string[];
  count: number;
  equality: EqualityMode;
  engineVersion: string;
}

export interface ReplacementMatch {
  index: number;
  match: string;
  replacement: string;
}

export interface FindReplaceResult {
  text: string;
  output: string;
  matches: ReplacementMatch[];
  matchCount: number;
  replacementCount: number;
  changed: boolean;
  regex: boolean;
  caseSensitive: boolean;
  engineVersion: string;
}

export interface MarkdownPreviewResult {
  html: string;
  warnings: string[];
  escapedRawHtml: boolean;
  engineVersion: string;
}

export interface MarkdownTableData {
  headers: string[];
  rows: string[][];
  alignments: Array<"left" | "center" | "right" | "default">;
}

export interface MarkdownTableResult {
  markdown: string;
  output: string;
  table: MarkdownTableData | null;
  warnings: string[];
  engineVersion: string;
}

export interface SlugResult {
  slug: string;
  text: string;
  separator: string;
  truncated: boolean;
  engineVersion: string;
}

export interface TextToCsvResult {
  csv: string;
  output: string;
  headers: string[];
  rows: string[][];
  rowCount: number;
  columnCount: number;
  engineVersion: string;
}

export interface CsvColumnListResult {
  list: string;
  values: string[];
  headers: string[];
  column: string;
  columnIndex: number;
  rowCount: number;
  warnings: string[];
  engineVersion: string;
}

export type SampleDataType = "lorem" | "words" | "sentences" | "paragraphs" | "names" | "emails" | "numbers" | "rows";

export interface SampleDataResult {
  type: SampleDataType;
  data: string;
  output: string;
  rows: string[];
  count: number;
  seed: number;
  engineVersion: string;
}

export interface LanguageStatistic {
  language: string;
  script: string;
  codePoints: number;
  percentage: number;
}

export interface LanguageStatisticsResult {
  text: string;
  language: string;
  detectedLanguage: string;
  dominantScript: string;
  scripts: Array<{ script: string; codePoints: number; percentage: number }>;
  languages: LanguageStatistic[];
  words: number;
  wordCount: number;
  characters: number;
  characterCount: number;
  sentences: number;
  sentenceCount: number;
  confidence: "heuristic";
  engineVersion: string;
}

const WORD = /[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;
const FORMAT_CHARACTER = /\p{Cf}/u;
const FORMAT_NAMES = new Map<number, string>([
  [0x00ad, "SOFT HYPHEN"],
  [0x061c, "ARABIC LETTER MARK"],
  [0x180e, "MONGOLIAN VOWEL SEPARATOR"],
  [0x200b, "ZERO WIDTH SPACE"],
  [0x200c, "ZERO WIDTH NON-JOINER"],
  [0x200d, "ZERO WIDTH JOINER"],
  [0x200e, "LEFT-TO-RIGHT MARK"],
  [0x200f, "RIGHT-TO-LEFT MARK"],
  [0x202a, "LEFT-TO-RIGHT EMBEDDING"],
  [0x202b, "RIGHT-TO-LEFT EMBEDDING"],
  [0x202c, "POP DIRECTIONAL FORMATTING"],
  [0x202d, "LEFT-TO-RIGHT OVERRIDE"],
  [0x202e, "RIGHT-TO-LEFT OVERRIDE"],
  [0x2060, "WORD JOINER"],
  [0x2066, "LEFT-TO-RIGHT ISOLATE"],
  [0x2067, "RIGHT-TO-LEFT ISOLATE"],
  [0x2068, "FIRST STRONG ISOLATE"],
  [0x2069, "POP DIRECTIONAL ISOLATE"],
  [0xfeff, "ZERO WIDTH NO-BREAK SPACE"],
]);

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n|\r/gu, "\n");
}

function countWords(value: string): number {
  return Array.from(value.matchAll(WORD)).length;
}

function countGraphemes(value: string): number {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: "grapheme" }) => { segment(input: string): Iterable<unknown> } }).Segmenter;
  if (Segmenter !== undefined) {
    try {
      return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(value)).length;
    } catch {
      return Array.from(value).length;
    }
  }
  return Array.from(value).length;
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate[field] !== "string") throw new Error("INVALID_INPUT");
  return candidate;
}

function requireText(value: unknown, field = "text"): string {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const text = (value as Record<string, unknown>)[field];
  if (typeof text !== "string" || text.length > MAX_TEXT_INPUT) throw new Error("INVALID_INPUT");
  return text;
}

function lineList(value: unknown, field: "text" | "left" | "right"): string[] {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const input = value as Record<string, unknown>;
  const raw = input[field];
  if (typeof raw === "string") {
    if (raw.length > MAX_TEXT_INPUT) throw new Error("INVALID_INPUT");
    const lines = parseListText(raw);
    if (lines.length > MAX_TEXT_ROWS) throw new Error("INVALID_INPUT");
    return lines;
  }
  if (Array.isArray(raw) && raw.length <= MAX_TEXT_ROWS && raw.every((line) => typeof line === "string")) return [...raw];
  if (field === "text" && Array.isArray(input.lines) && input.lines.length <= MAX_TEXT_ROWS && input.lines.every((line) => typeof line === "string")) return [...input.lines];
  throw new Error("INVALID_INPUT");
}

function optionalNumber(value: unknown, fallback: number, field: string): number {
  if (value === undefined) return fallback;
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isFinite(number) || number <= 0) throw new Error(`INVALID_${field.toUpperCase().replace(/[^A-Z0-9]+/gu, "_")}`);
  return number;
}

function optionalBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error("INVALID_INPUT");
  return value;
}

function validEquality(value: unknown): value is EqualityMode {
  return value === "exact" || value === "trim" || value === "nfc" || value === "trim-nfc";
}

function equalityValue(value: unknown): EqualityMode {
  if (value === undefined) return "exact";
  if (!validEquality(value)) throw new Error("INVALID_EQUALITY");
  return value;
}

function wordsForCase(value: string): string[] {
  return Array.from(value.matchAll(WORD), (match) => match[0] ?? "");
}

function capFirst(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toLocaleUpperCase() ?? ""}${value.slice(1)}`;
}

function capWord(value: string): string {
  return capFirst(value.toLocaleLowerCase());
}

function separatorWords(value: string, separator: string): string {
  return wordsForCase(value).map(capWord).join(separator);
}

function convertCaseValue(text: string, mode: CaseMode): string {
  switch (mode) {
    case "lower":
      return text.toLocaleLowerCase();
    case "upper":
      return text.toLocaleUpperCase();
    case "title":
      return wordsForCase(text).map(capWord).join(" ");
    case "sentence": {
      const normalized = text.toLocaleLowerCase();
      return normalized.replace(/(^|[.!?]\s+)([\p{L}\p{N}])/gu, (_match, prefix: string, first: string) => `${prefix}${first.toLocaleUpperCase()}`);
    }
    case "camel": {
      const words = wordsForCase(text);
      return words.map((word, index) => index === 0 ? word.toLocaleLowerCase() : capWord(word)).join("");
    }
    case "pascal":
      return wordsForCase(text).map(capWord).join("");
    case "kebab":
      return separatorWords(text, "-");
    case "snake":
      return separatorWords(text, "_");
    case "constant":
      return separatorWords(text, "_").toLocaleUpperCase();
  }
}

export function inspectText(value: unknown): TextInspectionResult {
  const text = requireText(value);
  const codePoints = Array.from(text).length;
  const graphemeClusters = countGraphemes(text);
  const withoutSpaces = Array.from(text).filter((character) => !/^\s$/u.test(character)).length;
  const lines = text.length === 0 ? 0 : normalizeLineEndings(text).split("\n").length;
  const paragraphs = text.trim() === "" ? 0 : normalizeLineEndings(text).trim().split(/\n\s*\n/gu).length;
  const words = countWords(text);
  return {
    words,
    wordCount: words,
    characters: codePoints,
    characterCount: codePoints,
    charactersWithSpaces: codePoints,
    characterCountWithSpaces: codePoints,
    charactersWithoutSpaces: withoutSpaces,
    codePoints,
    codeUnits: text.length,
    graphemeClusters,
    graphemeClusterCount: graphemeClusters,
    bytes: new TextEncoder().encode(text).byteLength,
    lines,
    lineCount: lines,
    paragraphs,
    paragraphCount: paragraphs,
    engineVersion: TEXT_WRITING_ENGINE_VERSION,
  };
}

export function estimateReadingTime(value: unknown): ReadingTimeResult {
  const input = requireObject(value, "text");
  const text = requireText(value);
  const requested = input.wordsPerMinute ?? input.wpm;
  const wordsPerMinute = requested === undefined ? DEFAULT_WORDS_PER_MINUTE : optionalNumber(requested, DEFAULT_WORDS_PER_MINUTE, "words per minute");
  if (!Number.isFinite(wordsPerMinute) || wordsPerMinute < 1 || wordsPerMinute > MAX_WORDS_PER_MINUTE) throw new Error("INVALID_WORDS_PER_MINUTE");
  const words = countWords(text);
  const exactMinutes = words / wordsPerMinute;
  // Deriving minutes from the rounded seconds keeps "1 minute / 60 seconds"
  // internally consistent instead of emitting 1 minute next to 60 seconds.
  const seconds = Math.ceil(exactMinutes * 60);
  const minutes = Math.ceil(seconds / 60);
  return {
    words,
    wordCount: words,
    wordsPerMinute,
    exactMinutes,
    minutes,
    estimatedMinutes: minutes,
    roundedMinutes: minutes,
    seconds,
    display: readingTimeIt(minutes),
    engineVersion: TEXT_WRITING_ENGINE_VERSION,
  };
}

export function convertTextCase(value: unknown): CaseConversionResult {
  const input = requireObject(value, "text");
  const text = requireText(value);
  const requestedMode = input.mode === undefined ? "lower" : input.mode;
  const mode = typeof requestedMode === "string" ? requestedMode.toLowerCase() : requestedMode;
  const modeAliases: Readonly<Record<string, CaseMode>> = { "title-case": "title", "sentence-case": "sentence", "camel-case": "camel", "pascal-case": "pascal", "kebab-case": "kebab", "snake-case": "snake", "constant-case": "constant" };
  const normalizedMode = typeof mode === "string" ? modeAliases[mode] ?? mode : mode;
  if (typeof normalizedMode !== "string" || !["lower", "upper", "title", "sentence", "camel", "pascal", "kebab", "snake", "constant"].includes(normalizedMode)) {
    throw new Error("INVALID_CASE_MODE");
  }
  const output = convertCaseValue(text, normalizedMode as CaseMode);
  return { text: output, output, mode: normalizedMode as CaseMode, changed: output !== text, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

export function normalizeWhitespace(value: unknown): WhitespaceResult {
  const input = requireObject(value, "text");
  const text = requireText(value);
  const preserveBlankLines = optionalBoolean(input.preserveBlankLines, true);
  const normalized = normalizeLineEndings(text).replace(/\u00a0/gu, " ");
  const lines = normalized.split("\n").map((line) => line.replace(/[^\S\n]+/gu, " ").trim());
  const output = (preserveBlankLines ? lines.join("\n") : lines.filter((line) => line !== "").join("\n")).replace(/^\n+|\n+$/gu, "");
  return { text: output, output, changed: output !== text, lineCount: output === "" ? 0 : output.split("\n").length, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

export function findInvisibleCharacters(value: unknown): InvisibleCharacterOutput {
  const text = requireText(value);
  const characters: InvisibleCharacterResult[] = [];
  let offset = 0;
  for (const character of text) {
    const codePointValue = character.codePointAt(0);
    if (FORMAT_CHARACTER.test(character) && codePointValue !== undefined) {
      characters.push({
        codePoint: `U+${codePointValue.toString(16).toUpperCase().padStart(4, "0")}`,
        offset,
        index: characters.length,
        name: FORMAT_NAMES.get(codePointValue) ?? "FORMAT CHARACTER",
        character,
      });
    }
    offset += character.length;
  }
  return { characters, found: characters, count: characters.length, cleanText: text.replace(/\p{Cf}/gu, ""), engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

export function normalizeUnicode(value: unknown): UnicodeNormalizationResult {
  const input = requireObject(value, "text");
  const text = requireText(value);
  const requestedForm = input.form === undefined ? "NFC" : input.form;
  const form = typeof requestedForm === "string" ? requestedForm.toUpperCase() : requestedForm;
  if (form !== "NFC" && form !== "NFD" && form !== "NFKC" && form !== "NFKD") throw new Error("INVALID_UNICODE_FORM");
  const output = text.normalize(form);
  return { text: output, output, form, changed: output !== text, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

function isOpeningContext(previous: string | undefined): boolean {
  return previous === undefined || /[\s([{<—–-]/u.test(previous);
}

/**
 * Typographic quote policy, declared once so both directions are auditable:
 * the curly forms recognised are the English ones (U+201C/201D, U+2018/2019)
 * and the low German ones (U+201E, U+201A), which Italian copy also uses for
 * quotes nested inside speech. Anything else is left untouched, so the
 * straight-to-curly direction is idempotent by construction.
 */
const CURLY_DOUBLE_QUOTES = new Set(["“", "”", "„", "‟"]);
const CURLY_SINGLE_QUOTES = new Set(["‘", "’", "‚", "‛"]);

export function normalizeQuotes(value: unknown): QuoteNormalizationResult {
  const input = requireObject(value, "text");
  const text = requireText(value);
  const direction = input.direction === undefined ? "straight-to-curly" : input.direction;
  if (direction !== "straight-to-curly" && direction !== "curly-to-straight") throw new Error("INVALID_QUOTE_DIRECTION");
  if (direction === "curly-to-straight") {
    let convertedCount = 0;
    const output = Array.from(text, (character) => {
      if (CURLY_DOUBLE_QUOTES.has(character)) {
        convertedCount += 1;
        return "\"";
      }
      if (CURLY_SINGLE_QUOTES.has(character)) {
        convertedCount += 1;
        return "'";
      }
      return character;
    }).join("");
    return { text: output, output, direction, convertedCount, changed: output !== text, engineVersion: TEXT_WRITING_ENGINE_VERSION };
  }
  let convertedCount = 0;
  let output = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? "";
    const previous = index === 0 ? undefined : text[index - 1];
    if (character === "'") {
      output += isOpeningContext(previous) ? "‘" : "’";
      convertedCount += 1;
    } else if (character === '"') {
      output += isOpeningContext(previous) ? "“" : "”";
      convertedCount += 1;
    } else {
      output += character;
    }
  }
  return { text: output, output, direction, convertedCount, changed: output !== text, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

function compareCodePoints(left: string, right: string, caseSensitive: boolean): number {
  const a = Array.from(caseSensitive ? left : left.toLocaleLowerCase());
  const b = Array.from(caseSensitive ? right : right.toLocaleLowerCase());
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const aCode = a[index]?.codePointAt(0) ?? 0;
    const bCode = b[index]?.codePointAt(0) ?? 0;
    if (aCode !== bCode) return aCode < bCode ? -1 : 1;
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
}

export function sortLines(value: unknown): LineSortResult {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const input = value as Record<string, unknown>;
  const descending = optionalBoolean(input.descending, false);
  const caseSensitive = optionalBoolean(input.caseSensitive, true);
  const lines = lineList(value, "text");
  const sorted = [...lines].sort((left, right) => {
    const comparison = compareCodePoints(left, right, caseSensitive);
    return descending ? -comparison : comparison;
  });
  const output = sorted.join("\n");
  return { text: output, output, lines: sorted, lineCount: sorted.length, descending, caseSensitive, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

export function deduplicateLines(value: unknown): LineDedupeResult {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const input = value as Record<string, unknown>;
  const equality = equalityValue(input.equality ?? input.mode);
  const lines = lineList(value, "text");
  const kept = dedupeLines(lines, equality);
  const output = kept.join("\n");
  return { text: output, output, lines: kept, keptCount: kept.length, removedCount: lines.length - kept.length, equality, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

export function intersectLists(value: unknown): ListIntersectionResult {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const input = value as Record<string, unknown>;
  const equality = equalityValue(input.equality);
  const intersection = compareLists(lineList(value, "left"), lineList(value, "right"), equality).intersection;
  return { intersection, count: intersection.length, equality, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

export function differenceLists(value: unknown): ListDifferenceResult {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const input = value as Record<string, unknown>;
  const equality = equalityValue(input.equality);
  const onlyLeft = compareLists(lineList(value, "left"), lineList(value, "right"), equality).onlyLeft;
  return { difference: onlyLeft, onlyLeft, count: onlyLeft.length, equality, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

function validateTextRegex(pattern: string): void {
  if (pattern.length > MAX_TEXT_REGEX_LENGTH) throw new Error("REGEX_TOO_LARGE");
  if (/\([^)]*[+*][^)]*\)[+*]/u.test(pattern) || /\([^)]*\{[^}]+\}[^)]*\)[+*]/u.test(pattern)) throw new Error("REGEX_COMPLEXITY");
}

function replacementMatches(text: string, find: string, replace: string, regex: boolean, caseSensitive: boolean, all: boolean): FindReplaceResult {
  if (find.length === 0) throw new Error("INVALID_FIND_REQUIRED");
  const matches: ReplacementMatch[] = [];
  let output = text;
  if (regex) {
    validateTextRegex(find);
    let expression: RegExp;
    try {
      expression = new RegExp(find, `${caseSensitive ? "" : "i"}${all ? "g" : ""}`);
    } catch {
      throw new Error("INVALID_REGEX");
    }
    if (all) {
      for (const match of text.matchAll(expression)) {
        matches.push({ index: match.index ?? 0, match: match[0], replacement: replace });
      }
    } else {
      const match = expression.exec(text);
      if (match !== null) matches.push({ index: match.index, match: match[0], replacement: replace });
    }
    output = text.replace(expression, replace);
  } else {
    let fromIndex = 0;
    while (fromIndex <= text.length) {
      const index = text.indexOf(find, fromIndex);
      if (index < 0) break;
      matches.push({ index, match: find, replacement: replace });
      if (!all) break;
      fromIndex = index + find.length;
    }
    output = all ? text.split(find).join(replace) : text.replace(find, replace);
  }
  return { text: output, output, matches, matchCount: matches.length, replacementCount: matches.length, changed: output !== text, regex, caseSensitive, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

export function previewFindReplace(value: unknown): FindReplaceResult {
  const input = requireObject(value, "text");
  if (typeof input.find !== "string" || typeof input.replace !== "string") throw new Error("INVALID_INPUT");
  const regex = optionalBoolean(input.regex, false);
  const caseSensitive = optionalBoolean(input.caseSensitive, true);
  const all = optionalBoolean(input.all, true);
  return replacementMatches(requireText(value), input.find, input.replace, regex, caseSensitive, all);
}

function escapeHtml(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&#39;");
}

function safeMarkdownUrl(value: string): string {
  const trimmed = value.trim();
  if (/[\u0000-\u0020\\]/u.test(trimmed) || trimmed.startsWith("//")) return "#";
  return /^(?:https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/iu.test(trimmed) ? trimmed : "#";
}

function renderInline(value: string): string {
  const placeholders: string[] = [];
  const hold = (html: string): string => {
    const token = `\u0000${placeholders.length}\u0000`;
    placeholders.push(html);
    return token;
  };
  let working = value.replace(/`([^`\n]+)`/gu, (_match, code: string) => hold(`<code>${escapeHtml(code)}</code>`));
  working = working.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/gu, (_match, label: string, url: string) => hold(`<a href="${escapeHtml(safeMarkdownUrl(url))}" rel="noreferrer noopener">${escapeHtml(label)}</a>`));
  working = escapeHtml(working);
  working = working.replace(/\*\*([^*\n]+)\*\*/gu, "<strong>$1</strong>");
  working = working.replace(/__([^_\n]+)__/gu, "<strong>$1</strong>");
  working = working.replace(/~~([^~\n]+)~~/gu, "<del>$1</del>");
  working = working.replace(/\*([^*\n]+)\*/gu, "<em>$1</em>");
  working = working.replace(/_([^_\n]+)_/gu, "<em>$1</em>");
  return working.replace(/\u0000(\d+)\u0000/gu, (_match, index: string) => placeholders[Number(index)] ?? "");
}

export function renderMarkdown(value: unknown): MarkdownPreviewResult {
  const text = requireText(value);
  const lines = normalizeLineEndings(text).split("\n");
  const output: string[] = [];
  const warnings = new Set<string>();
  let inFence = false;
  let fenceLines: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let quote: string[] = [];
  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    output.push(`<p>${paragraph.map((line) => renderInline(line)).join("<br />")}</p>`);
    paragraph = [];
  };
  const flushList = (): void => {
    if (listType !== null) output.push(`</${listType}>`);
    listType = null;
  };
  const flushQuote = (): void => {
    if (quote.length === 0) return;
    output.push(`<blockquote>${quote.map((line) => renderInline(line)).join("<br />")}</blockquote>`);
    quote = [];
  };
  const flushAll = (): void => {
    flushParagraph();
    flushList();
    flushQuote();
  };
  for (const line of lines) {
    const fence = /^\s*(`{3,}|~{3,})\s*([^`]*)$/u.exec(line);
    if (fence !== null) {
      if (inFence) {
        output.push(`<pre><code>${escapeHtml(fenceLines.join("\n"))}</code></pre>`);
        fenceLines = [];
        inFence = false;
      } else {
        flushAll();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fenceLines.push(line);
      continue;
    }
    if (line.trim() === "") {
      flushAll();
      continue;
    }
    if (/<[^>]+>/u.test(line)) warnings.add("Raw HTML is escaped for safety.");
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
    if (heading !== null) {
      flushAll();
      const level = heading[1]?.length ?? 1;
      output.push(`<h${level}>${renderInline(heading[2] ?? "")}</h${level}>`);
      continue;
    }
    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/u.test(line)) {
      flushAll();
      output.push("<hr />");
      continue;
    }
    const unordered = /^\s*[-*+]\s+(.+)$/u.exec(line);
    if (unordered !== null) {
      flushParagraph();
      flushQuote();
      if (listType !== "ul") {
        flushList();
        output.push("<ul>");
        listType = "ul";
      }
      output.push(`<li>${renderInline(unordered[1] ?? "")}</li>`);
      continue;
    }
    const ordered = /^\s*\d+[.)]\s+(.+)$/u.exec(line);
    if (ordered !== null) {
      flushParagraph();
      flushQuote();
      if (listType !== "ol") {
        flushList();
        output.push("<ol>");
        listType = "ol";
      }
      output.push(`<li>${renderInline(ordered[1] ?? "")}</li>`);
      continue;
    }
    const quoted = /^\s*>\s?(.*)$/u.exec(line);
    if (quoted !== null) {
      flushParagraph();
      flushList();
      quote.push(quoted[1] ?? "");
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line);
  }
  if (inFence) {
    output.push(`<pre><code>${escapeHtml(fenceLines.join("\n"))}</code></pre>`);
    warnings.add("Unclosed fenced code block was closed at the end of the input.");
  }
  flushAll();
  return { html: output.join("\n"), warnings: Array.from(warnings), escapedRawHtml: warnings.has("Raw HTML is escaped for safety."), engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

function splitTableRow(line: string): string[] {
  let working = line.trim();
  if (working.startsWith("|")) working = working.slice(1);
  if (working.endsWith("|") && !working.endsWith("\\|")) working = working.slice(0, -1);
  const cells: string[] = [];
  let cell = "";
  for (let index = 0; index < working.length; index += 1) {
    const character = working[index] ?? "";
    if (character === "\\" && working[index + 1] === "|") {
      cell += "\\|";
      index += 1;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function tableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/u.test(cell.replace(/\s/gu, "")));
}

function tableAlignment(cell: string): "left" | "center" | "right" | "default" {
  const value = cell.trim();
  if (value.startsWith(":") && value.endsWith(":")) return "center";
  if (value.endsWith(":")) return "right";
  if (value.startsWith(":")) return "left";
  return "default";
}

function renderTableRow(cells: readonly string[], widths: readonly number[]): string {
  return `| ${cells.map((cell, index) => cell.padEnd(widths[index] ?? cell.length)).join(" | ")} |`;
}

export function formatMarkdownTable(value: unknown): MarkdownTableResult {
  const markdown = requireText(value);
  const lines = normalizeLineEndings(markdown).split("\n");
  let start = -1;
  for (let index = 0; index + 1 < lines.length; index += 1) {
    if ((lines[index] ?? "").includes("|") && tableSeparator(lines[index + 1] ?? "")) {
      start = index;
      break;
    }
  }
  if (start < 0) return { markdown, output: markdown, table: null, warnings: ["No Markdown table separator was found."], engineVersion: TEXT_WRITING_ENGINE_VERSION };
  const headers = splitTableRow(lines[start] ?? "");
  const separator = splitTableRow(lines[start + 1] ?? "");
  const alignments = separator.map(tableAlignment);
  const rows: string[][] = [];
  for (let index = start + 2; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "") break;
    const cells = splitTableRow(line);
    while (cells.length < headers.length) cells.push("");
    rows.push(cells.slice(0, headers.length));
  }
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length), 3));
  const rendered = [renderTableRow(headers, widths), `| ${widths.map((cellWidth, index) => {
    const alignment = alignments[index] ?? "default";
    const width = Math.max(3, cellWidth);
    if (alignment === "left") return `:${"-".repeat(width - 1)}`;
    if (alignment === "right") return `${"-".repeat(width - 1)}:`;
    if (alignment === "center") return `:${"-".repeat(width - 2)}:`;
    return "-".repeat(width);
  }).join(" | ")} |`, ...rows.map((row) => renderTableRow(row, widths))];
  const output = rendered.join("\n");
  return { markdown: output, output, table: { headers, rows, alignments }, warnings: [], engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

export function generateSlug(value: unknown): SlugResult {
  const input = requireObject(value, "text");
  const text = requireText(value);
  const separator = input.separator === undefined ? "-" : input.separator;
  if (separator !== "-" && separator !== "_") throw new Error("INVALID_SEPARATOR");
  const lowercase = optionalBoolean(input.lowercase, true);
  const maxLengthValue = input.maxLength;
  const maxLength = maxLengthValue === undefined ? 0 : typeof maxLengthValue === "number" ? maxLengthValue : typeof maxLengthValue === "string" && maxLengthValue.trim() !== "" ? Number(maxLengthValue) : Number.NaN;
  if (!Number.isInteger(maxLength) || maxLength < 0) throw new Error("INVALID_MAX_LENGTH");
  let slug = text.normalize("NFKD").replace(/\p{M}/gu, "").replace(/['’]/gu, "").replace(/[^\p{L}\p{N}]+/gu, separator);
  if (lowercase) slug = slug.toLocaleLowerCase();
  slug = slug.replace(new RegExp(`${separator === "-" ? "-" : "_"}{2,}`, "gu"), separator).replace(new RegExp(`^${separator === "-" ? "-" : "_"}|${separator === "-" ? "-" : "_"}$`, "gu"), "");
  let truncated = false;
  if (maxLength > 0 && Array.from(slug).length > maxLength) {
    slug = Array.from(slug).slice(0, maxLength).join("").replace(new RegExp(`${separator === "-" ? "-" : "_"}$`, "gu"), "");
    truncated = true;
  }
  return { slug, text: slug, separator, truncated, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

function validateDelimiter(value: unknown, fallback = ","): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || Array.from(value).length !== 1) throw new Error("INVALID_DELIMITER");
  return value;
}

export function parseDelimitedRows(text: string, delimiter: string): string[][] {
  if (Array.from(delimiter).length !== 1) throw new Error("INVALID_DELIMITER");
  if (text.length > MAX_TEXT_INPUT) throw new Error("INPUT_TOO_LARGE");
  if (text === "") return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let fieldStarted = false;
  let cellCount = 0;
  const pushField = (): void => {
    cellCount += 1;
    if (cellCount > MAX_TEXT_CELLS) throw new Error("INPUT_TOO_LARGE");
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const pushRow = (): void => {
    pushField();
    if (rows.length >= MAX_TEXT_ROWS) throw new Error("INPUT_TOO_LARGE");
    rows.push(row);
    row = [];
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (index === text.length - 1 || text[index + 1] === delimiter || text[index + 1] === "\n" || text[index + 1] === "\r") {
          quoted = false;
        } else {
          throw new Error("INVALID_QUOTED_FIELD");
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field === "" && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
    } else if (character === delimiter) {
      pushField();
    } else if (character === "\n" || character === "\r") {
      pushRow();
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += character;
      fieldStarted = true;
    }
  }
  if (quoted) throw new Error("INVALID_QUOTED_FIELD");
  if (field !== "" || fieldStarted || row.length > 0) pushRow();
  return rows;
}

function escapeCsvField(value: string, delimiter: string): string {
  const safeValue = /^[\u0000-\u0020]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return /["\r\n]/u.test(safeValue) || safeValue.includes(delimiter) ? `"${safeValue.replace(/"/gu, "\"\"")}"` : safeValue;
}

export function textToCsv(value: unknown): TextToCsvResult {
  const input = requireObject(value, "text");
  const text = requireText(value);
  const delimiter = validateDelimiter(input.delimiter);
  const includeHeaders = optionalBoolean(input.includeHeaders, true);
  const parsed = parseDelimitedRows(text, delimiter);
  let headers: string[] | undefined;
  if (Array.isArray(input.headers)) {
    headers = input.headers.map((header) => {
      if (typeof header !== "string") throw new Error("INVALID_HEADERS");
      return header;
    });
  } else if (input.columns !== undefined) {
    if (typeof input.columns !== "number" || !Number.isInteger(input.columns) || input.columns < 1) throw new Error("INVALID_COLUMNS");
    headers = Array.from({ length: input.columns }, (_, index) => `column${index + 1}`);
  }
  const width = Math.max(headers?.length ?? 0, ...parsed.map((row) => row.length), 0);
  if (headers === undefined) headers = Array.from({ length: width }, (_, index) => `column${index + 1}`);
  const rows = parsed.map((row) => Array.from({ length: headers.length }, (_, index) => row[index] ?? ""));
  const outputRows = includeHeaders ? [headers, ...rows] : rows;
  const csv = outputRows.map((row) => row.map((field) => escapeCsvField(field, delimiter)).join(delimiter)).join("\n");
  return { csv, output: csv, headers, rows, rowCount: rows.length, columnCount: headers.length, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

export function csvColumnToList(value: unknown): CsvColumnListResult {
  const input = requireObject(value, "csv");
  const csv = requireText(value, "csv");
  const delimiter = validateDelimiter(input.delimiter);
  const hasHeader = optionalBoolean(input.hasHeader ?? input.header, true);
  const rows = parseDelimitedRows(csv, delimiter);
  const headers = hasHeader && rows.length > 0 ? rows[0] ?? [] : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const requested = input.column === undefined ? 0 : input.column;
  let columnIndex: number;
  if (typeof requested === "number" && Number.isInteger(requested)) {
    columnIndex = requested >= 0 ? requested : dataRows.length + requested;
  } else if (typeof requested === "string") {
    columnIndex = headers.indexOf(requested);
    if (columnIndex < 0 && /^\d+$/u.test(requested)) columnIndex = Number(requested);
    if (columnIndex < 0) throw new Error("INVALID_COLUMN");
  } else {
    throw new Error("INVALID_COLUMN");
  }
  if (columnIndex < 0 || (headers.length > 0 && columnIndex >= headers.length)) throw new Error("INVALID_COLUMN");
  const values = dataRows.map((row) => row[columnIndex] ?? "");
  const column = headers[columnIndex] ?? `column${columnIndex + 1}`;
  return { list: values.join("\n"), values, headers, column, columnIndex, rowCount: values.length, warnings: [], engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

const SAMPLE_WORDS = ["amber", "atlas", "bright", "canvas", "cedar", "clear", "comet", "craft", "drift", "ember", "field", "focus", "garden", "harbor", "kind", "light", "maple", "meadow", "orbit", "paper", "quiet", "river", "signal", "studio", "summer", "table", "tide", "vector", "window", "winter"];
const SAMPLE_NAMES = ["Ada Rivera", "Bea Chen", "Cleo Martin", "Drew Patel", "Eli Morgan", "Faye Brooks", "Gio Santos", "Hana Lee", "Iris Young", "Jules Park"];

function nextRandom(state: { value: number }): number {
  state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0;
  return state.value / 0x100000000;
}

function sampleWords(count: number, state: { value: number }): string[] {
  return Array.from({ length: count }, () => SAMPLE_WORDS[Math.floor(nextRandom(state) * SAMPLE_WORDS.length)] ?? "sample");
}

/**
 * Every sample-data type is seeded from one deterministic 32-bit LCG, so the
 * same seed always yields the same bytes on every platform. `lorem` is the
 * classic lorem-ipsum layout (paragraphs separated by a blank line) and is
 * therefore distinct from `sentences` (one sentence per line) and from
 * `paragraphs` (one paragraph per line).
 */
const MAX_SAMPLE_COUNT = 1_000;
const MAX_SAMPLE_SEED = 2_147_483_647;

function sampleSeed(value: unknown): number {
  if (value === undefined) return 1;
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > MAX_SAMPLE_SEED) throw new Error("INVALID_SEED");
  return parsed;
}

export function generateSampleData(value: unknown): SampleDataResult {
  const input = value === undefined ? {} : value;
  if (typeof input !== "object" || input === null) throw new Error("INVALID_INPUT");
  const requestedType = (input as Record<string, unknown>).type ?? "paragraphs";
  if (requestedType !== "lorem" && requestedType !== "words" && requestedType !== "sentences" && requestedType !== "paragraphs" && requestedType !== "names" && requestedType !== "emails" && requestedType !== "numbers" && requestedType !== "rows") throw new Error("INVALID_SAMPLE_TYPE");
  const type = requestedType;
  const countValue = (input as Record<string, unknown>).count;
  const count = countValue === undefined ? 3 : typeof countValue === "number" ? countValue : typeof countValue === "string" && countValue.trim() !== "" ? Number(countValue) : Number.NaN;
  if (!Number.isInteger(count) || count < 1 || count > MAX_SAMPLE_COUNT) throw new Error("INVALID_COUNT");
  const seed = sampleSeed((input as Record<string, unknown>).seed);
  const state = { value: (seed ^ 0x9e3779b9) >>> 0 };
  let rows: string[];
  if (type === "words") rows = sampleWords(count, state);
  else if (type === "names") rows = Array.from({ length: count }, () => SAMPLE_NAMES[Math.floor(nextRandom(state) * SAMPLE_NAMES.length)] ?? "Sample Person");
  else if (type === "emails") rows = Array.from({ length: count }, (_, index) => `${(sampleWords(1, state)[0] ?? "sample")}.${index + 1}@example.test`);
  else if (type === "numbers") rows = Array.from({ length: count }, () => String(Math.floor(nextRandom(state) * 10000)));
  else if (type === "rows") {
    rows = ["name,email,amount", ...Array.from({ length: count }, (_, index) => {
      const name = SAMPLE_NAMES[index % SAMPLE_NAMES.length] ?? "Sample Person";
      return `${name},${name.toLocaleLowerCase().replace(/[^a-z]+/gu, ".").replace(/^\.|\.$/gu, "") || "sample"}@example.test,${index + 10}`;
    })];
  } else if (type === "paragraphs") {
    rows = Array.from({ length: count }, () => Array.from({ length: 3 }, () => `${sampleWords(8, state).join(" ")}.`).join(" "));
  } else if (type === "lorem") {
    rows = Array.from({ length: count }, () => Array.from({ length: 3 }, () => `${sampleWords(8, state).join(" ")}.`).join(" "));
  } else {
    rows = Array.from({ length: count }, () => `${sampleWords(8, state).join(" ")}.`);
  }
  const data = type === "lorem" ? rows.join("\n\n") : rows.join("\n");
  return { type, data, output: data, rows, count, seed, engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

function inRange(codePoint: number, start: number, end: number): boolean {
  return codePoint >= start && codePoint <= end;
}

function scriptFor(codePoint: number): string {
  if (inRange(codePoint, 0x41, 0x5a) || inRange(codePoint, 0x61, 0x7a) || inRange(codePoint, 0xc0, 0x2af) || inRange(codePoint, 0x1e00, 0x1eff)) return "Latin";
  if (inRange(codePoint, 0x400, 0x52f)) return "Cyrillic";
  if (inRange(codePoint, 0x370, 0x3ff) || inRange(codePoint, 0x1f00, 0x1fff)) return "Greek";
  if (inRange(codePoint, 0x590, 0x5ff)) return "Hebrew";
  if (inRange(codePoint, 0x600, 0x6ff) || inRange(codePoint, 0x750, 0x77f)) return "Arabic";
  if (inRange(codePoint, 0x900, 0x97f)) return "Devanagari";
  if (inRange(codePoint, 0x3040, 0x30ff)) return "Japanese";
  if (inRange(codePoint, 0xac00, 0xd7af)) return "Korean";
  if (inRange(codePoint, 0x4e00, 0x9fff) || inRange(codePoint, 0x3400, 0x4dbf)) return "Han";
  if (inRange(codePoint, 0x0e00, 0x0e7f)) return "Thai";
  return "Other";
}

/**
 * Script counting policy, stated so the numbers mean something:
 * - punctuation, symbols, separators and control characters are ignored, so
 *   "Ciao, mondo!" and "Ciao mondo" report the same Latin count;
 * - a combining mark belongs to the letter it follows and is never counted
 *   again, so an NFC text and its NFD form report identical counts;
 * - `Other` therefore means "letters and digits of scripts this tool does not
 *   name separately", never "punctuation".
 */
const IGNORED_FOR_SCRIPTS = /^[\p{P}\p{S}\p{Z}\p{C}\p{M}]$/u;

const LANGUAGE_BY_SCRIPT: Readonly<Record<string, string>> = {
  Latin: "en",
  Cyrillic: "ru",
  Greek: "el",
  Hebrew: "he",
  Arabic: "ar",
  Devanagari: "hi",
  Japanese: "ja",
  Korean: "ko",
  Han: "zh",
  Thai: "th",
};

export function languageStatistics(value: unknown): LanguageStatisticsResult {
  const text = requireText(value);
  const scriptCounts = new Map<string, number>();
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || /\s/u.test(character)) continue;
    if (IGNORED_FOR_SCRIPTS.test(character)) continue;
    const script = scriptFor(codePoint);
    scriptCounts.set(script, (scriptCounts.get(script) ?? 0) + 1);
  }
  const totalScriptCodePoints = Array.from(scriptCounts.values()).reduce((sum, value) => sum + value, 0);
  const scripts = Array.from(scriptCounts.entries()).map(([script, codePoints]) => ({ script, codePoints, percentage: totalScriptCodePoints === 0 ? 0 : codePoints / totalScriptCodePoints })).sort((left, right) => right.codePoints - left.codePoints || left.script.localeCompare(right.script));
  const languages = scripts.map(({ script, codePoints, percentage }) => ({ language: LANGUAGE_BY_SCRIPT[script] ?? "und", script, codePoints, percentage }));
  const dominantScript = scripts[0]?.script ?? "Other";
  const language = LANGUAGE_BY_SCRIPT[dominantScript] ?? "und";
  const words = countWords(text);
  const sentences = text.trim() === "" ? 0 : Math.max(1, (text.match(/[.!?]+(?:\s|$)/gu) ?? []).length);
  return { text, language, detectedLanguage: language, dominantScript, scripts, languages, words, wordCount: words, characters: Array.from(text).length, characterCount: Array.from(text).length, sentences, sentenceCount: sentences, confidence: "heuristic", engineVersion: TEXT_WRITING_ENGINE_VERSION };
}

export const convertCase = convertTextCase;
export const normalizeUnicodeText = normalizeUnicode;
export const normalizeSmartQuotes = normalizeQuotes;
export const sortTextLines = sortLines;
export const dedupeTextLines = deduplicateLines;
export const intersectTextLists = intersectLists;
export const differenceTextLists = differenceLists;
export const previewTextReplacement = previewFindReplace;
export const previewMarkdown = renderMarkdown;
export const makeSlug = generateSlug;
export const convertTextToCsv = textToCsv;
export const extractCsvColumn = csvColumnToList;
export const generateLoremSampleData = generateSampleData;
export const analyzeLanguage = languageStatistics;

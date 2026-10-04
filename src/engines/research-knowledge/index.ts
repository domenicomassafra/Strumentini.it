import { isTrackingKey } from "../campaign-url";
import { normalizeDoi as normalizeDoiReference, normalizeIsbn as normalizeIsbnReference } from "../research-reference";
import { redactUrl, redactUrlCredentials } from "../url-marketing";

export const RESEARCH_KNOWLEDGE_ENGINE_VERSION = "research-knowledge-v2";
export const RESEARCH_KNOWLEDGE_CHECKSUM_ALGORITHM = "SHA-256";
const MAX_RESEARCH_INPUT = 2 * 1024 * 1024;
const MAX_PAGE_SPAN = 10000;

export type Primitive = string | number | boolean | null;
export type UnknownRecord = Record<string, unknown>;

export interface DoiLinkResult {
  valid: boolean;
  normalized?: string;
  url?: string;
  reason?: string;
}

export interface CitationRecord extends UnknownRecord {
  id?: string;
  type?: string;
  title?: string;
  authors?: readonly string[] | string;
  author?: string;
  year?: string | number;
  doi?: string;
  isbn?: string;
  url?: string;
}

export interface BibtexEntry {
  type: string;
  key: string;
  fields: Record<string, string>;
}

/**
 * How a record was recognised. The rule travels with the key so a user can see
 * *why* two records were treated as the same reference instead of trusting an
 * opaque duplicate count.
 */
export type DedupeIdentityRule =
  | "exact"
  | "doi"
  | "isbn"
  | "url"
  | "title-author-year"
  | "field-content"
  | "entry-content"
  | "note-content";

export interface CitationDedupeOptions {
  mode?: "exact" | "identifier" | "title-author-year";
}

export interface ResolvedIdentity {
  key: string;
  rule: DedupeIdentityRule;
}

export interface DedupeGroup {
  key: string;
  rule: DedupeIdentityRule;
  indexes: number[];
}

export interface DedupeResult<T> {
  records: T[];
  unique: T[];
  duplicates: T[];
  groups: DedupeGroup[];
  removed: number;
  inputCount: number;
  outputCount: number;
}

export interface QuoteCounts {
  characters: number;
  charactersWithoutWhitespace: number;
  words: number;
  lines: number;
  readingMinutes: number;
  normalized: string;
}

export type DatePrecision = "year" | "month" | "day";

export interface NormalizedDate {
  valid: true;
  input: string;
  iso: string;
  precision: DatePrecision;
  source: string;
  dayFirst: boolean;
  /** True when the day/month order could not be decided from the input alone. */
  ambiguous?: boolean;
  /** The other calendar reading; present only when `ambiguous` is true. */
  alternativeIso?: string;
}

export interface InvalidDate {
  valid: false;
  input: string;
  reason: string;
  dayFirst: boolean;
  source: string;
  precision: DatePrecision | null;
}

export type DateResult = NormalizedDate | InvalidDate;

export interface UrlCleanResult {
  valid: boolean;
  input: string;
  url?: string;
  removedParameters: string[];
  removedFragment: boolean;
  reason?: string;
}

export interface DomainCount {
  domain: string;
  count: number;
  uniqueUrls: number;
  urls: string[];
}

export interface DomainFrequencyResult {
  domains: DomainCount[];
  total: number;
  unique: number;
  invalid: string[];
  invalidCount: number;
  comparison: string;
}

export interface EvidenceRow {
  title: string;
  url: string;
  date: string;
  source: string;
  doi: string;
  notes: string;
}

export interface EvidenceTable {
  csv: string;
  headers: readonly string[];
  rows: EvidenceRow[];
  rowCount: number;
  emptyRowCount: number;
  emptyRowIndexes: number[];
}

export interface VocabularyTerm {
  term: string;
  count: number;
}

export interface VocabularyAnalysis {
  terms: VocabularyTerm[];
  total: number;
  unique: number;
  ignoredStopwords: number;
  ignoredShortTerms: number;
  minLength: number;
  limit: number;
  stopwordProfile: string;
}

export interface ResearchPackManifest {
  name: string;
  tools: string[];
  count: number;
  checksum: string;
  checksumAlgorithm: string;
  canonicalPayload: string;
  version: string;
  engineVersion: string;
}

export interface SortedReferenceList {
  records: CitationRecord[];
  original: CitationRecord[];
  movedCount: number;
  unchanged: boolean;
  order: "author" | "year" | "title";
  comparator: string;
}

export interface RisRecord {
  type: string;
  fields: Map<string, string[]>;
}

export interface RisDocument {
  records: RisRecord[];
  unknownTags: Array<{ record: number; tags: string[] }>;
  skippedTagLines: number;
  truncated: boolean;
}

export interface ConversionWarning {
  record: number;
  code: string;
  message: string;
}

export interface BibtexDocument {
  entries: BibtexEntry[];
  directives: string[];
  truncated: boolean;
}

export interface FormattedBibtex {
  bibtex: string;
  warnings: ConversionWarning[];
}

export interface RisToBibtexResult extends FormattedBibtex {
  entries: BibtexEntry[];
  unknownTags: Array<{ record: number; tags: string[] }>;
  skippedTagLines: number;
  truncated: boolean;
}

export interface BibtexToRisResult {
  ris: string;
  entries: BibtexEntry[];
  warnings: ConversionWarning[];
  unknownFields: Array<{ entry: number; fields: string[] }>;
  truncated: boolean;
}

const BIBTEX_FIELD_ORDER = [
  "author",
  "editor",
  "title",
  "booktitle",
  "journal",
  "publisher",
  "year",
  "date",
  "volume",
  "number",
  "pages",
  "doi",
  "url",
  "keywords",
  "note",
  "abstract",
] as const;

/** BibTeX directives are not bibliography entries and must never be emitted as one. */
const BIBTEX_DIRECTIVE_TYPES = new Set(["comment", "preamble", "string"]);

const TRACKING_KEYS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "referrer",
]);

/**
 * English function words plus the Italian ones. An Italian-first product that
 * filtered only English stopwords reported "il", "la" and "per" as the most
 * frequent words of any Italian text.
 */
const STOPWORD_PROFILE = "it+en";

const DEFAULT_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is",
  "it", "of", "on", "or", "that", "the", "this", "to", "was", "were", "with",
  "ad", "al", "alla", "alle", "allo", "ai", "agli", "al", "che", "chi", "con",
  "come", "da", "dal", "dalla", "dalle", "dei", "del", "della", "delle", "di",
  "dove", "e", "ed", "gli", "ha", "hanno", "i", "il", "in", "io", "la", "le",
  "lo", "loro", "ma", "mi", "ne", "nei", "nel", "nella", "nelle", "no", "non",
  "o", "per", "perche", "piu", "quale", "quali", "quando", "quello", "questa",
  "queste", "questi", "questo", "se", "si", "sono", "su", "sul", "sulla",
  "sulle", "tra", "tu", "un", "una", "uno", "vi",
]);

/** Leading articles skipped when deriving a citation key from a title. */
const TITLE_LEADING_WORDS = new Set([
  "a", "an", "the", "le", "la", "il", "lo", "i", "gli", "l", "un", "una", "uno",
]);

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, gen: 1, gennaio: 1,
  feb: 2, february: 2, febbraio: 2,
  mar: 3, march: 3, marzo: 3,
  apr: 4, april: 4, aprile: 4,
  may: 5, mag: 5, maggio: 5,
  jun: 6, june: 6, giu: 6, giugno: 6,
  jul: 7, july: 7, lug: 7, luglio: 7,
  aug: 8, august: 8, ago: 8, agosto: 8,
  sep: 9, sept: 9, september: 9, set: 9, settembre: 9,
  oct: 10, october: 10, ott: 10, ottobre: 10,
  nov: 11, november: 11, novembre: 11,
  dec: 12, december: 12, dic: 12, dicembre: 12,
};

const RIS_TYPE_TO_BIBTEX: Readonly<Record<string, string>> = {
  JOUR: "article",
  EJOUR: "article",
  BOOK: "book",
  EBOOK: "book",
  CHAP: "incollection",
  ECHAP: "incollection",
  CONF: "inproceedings",
  CPAPER: "inproceedings",
  THES: "phdthesis",
  RPRT: "techreport",
  GEN: "misc",
  MGZN: "misc",
  NEWS: "misc",
  DATA: "misc",
};

const BIBTEX_TYPE_TO_RIS: Readonly<Record<string, string>> = {
  article: "JOUR",
  book: "BOOK",
  incollection: "CHAP",
  inproceedings: "CONF",
  phdthesis: "THES",
  techreport: "RPRT",
  misc: "GEN",
};

const RIS_TAG_TO_BIBTEX: Readonly<Record<string, string>> = {
  AU: "author",
  A1: "author",
  ED: "editor",
  BT: "booktitle",
  T2: "journal",
  JO: "journal",
  JF: "journal",
  JA: "journal",
  TI: "title",
  T1: "title",
  CT: "title",
  PY: "year",
  Y1: "year",
  DA: "year",
  DO: "doi",
  UR: "url",
  L1: "url",
  L2: "url",
  PB: "publisher",
  VL: "volume",
  IS: "number",
  AB: "abstract",
  N2: "abstract",
  KW: "keywords",
  N1: "note",
};

/** RIS tags whose BibTeX counterpart repeats rather than overwrites. */
const RIS_REPEATED_AUTHOR_TAGS = new Set(["AU", "A1", "ED"]);
const RIS_REPEATED_FIELDS = new Set(["author", "editor", "keywords"]);

const BIBTEX_FIELD_TO_RIS: Readonly<Record<string, string>> = {
  author: "AU",
  editor: "ED",
  title: "TI",
  booktitle: "BT",
  journal: "JO",
  publisher: "PB",
  year: "PY",
  date: "DA",
  volume: "VL",
  number: "IS",
  doi: "DO",
  url: "UR",
  keywords: "KW",
  note: "N1",
  abstract: "AB",
};

const SHA256_ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function defineRecordValue(record: UnknownRecord, key: string, value: unknown): void {
  Object.defineProperty(record, key, { configurable: true, enumerable: true, value, writable: true });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Own-property lookup. Every table above is indexed with untrusted input (a
 * parsed BibTeX field name, a RIS tag, a parsed month name), and a plain
 * bracket read would answer `constructor` or `toString` from the prototype.
 */
function tableValue<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

function monthNumber(name: string): number | undefined {
  return tableValue(MONTHS, name);
}

function rotateRight(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/**
 * Pure TypeScript SHA-256. The research engine must stay deterministic and
 * synchronous with no secure-context or worker dependency, and it is verified
 * against the repository's published known-answer vectors.
 */
export function sha256HexUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const paddedLength = (Math.floor((bytes.length + 8) / 64) + 1) * 64;
  const block = new Uint8Array(paddedLength);
  block.set(bytes);
  block[bytes.length] = 0x80;
  const view = new DataView(block.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) schedule[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const previous = schedule[index - 15] ?? 0;
      const recent = schedule[index - 2] ?? 0;
      const s0 = rotateRight(previous, 7) ^ rotateRight(previous, 18) ^ (previous >>> 3);
      const s1 = rotateRight(recent, 17) ^ rotateRight(recent, 19) ^ (recent >>> 10);
      schedule[index] = ((schedule[index - 16] ?? 0) + s0 + (schedule[index - 7] ?? 0) + s1) >>> 0;
    }
    let a = state[0] ?? 0;
    let b = state[1] ?? 0;
    let c = state[2] ?? 0;
    let d = state[3] ?? 0;
    let e = state[4] ?? 0;
    let f = state[5] ?? 0;
    let g = state[6] ?? 0;
    let h = state[7] ?? 0;
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + choose + (SHA256_ROUND_CONSTANTS[index] ?? 0) + (schedule[index] ?? 0)) >>> 0;
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    state[0] = ((state[0] ?? 0) + a) >>> 0;
    state[1] = ((state[1] ?? 0) + b) >>> 0;
    state[2] = ((state[2] ?? 0) + c) >>> 0;
    state[3] = ((state[3] ?? 0) + d) >>> 0;
    state[4] = ((state[4] ?? 0) + e) >>> 0;
    state[5] = ((state[5] ?? 0) + f) >>> 0;
    state[6] = ((state[6] ?? 0) + g) >>> 0;
    state[7] = ((state[7] ?? 0) + h) >>> 0;
  }
  return [...state].map((word) => word.toString(16).padStart(8, "0")).join("");
}

function normalizeText(value: string): string {
  return value.normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "").replace(/\s+/gu, " ").trim();
}

function redactResearchOutput(value: string): string {
  try {
    return redactUrl(new URL(value));
  } catch {
    return redactUrlCredentials(value);
  }
}

function foldText(value: string): string {
  return normalizeText(value).toLowerCase();
}

function stringFrom(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string").join(" and ");
  return "";
}

function field(record: UnknownRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    const text = stringFrom(value);
    if (text !== "") return text;
  }
  return "";
}

function assertResearchInput(value: string): void {
  if (value.length > MAX_RESEARCH_INPUT) throw new Error("INPUT_TOO_LARGE");
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`INVALID_INPUT:${label}`);
  assertResearchInput(value);
  return value;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === "object" && value !== null) {
    const record = value as UnknownRecord;
    const result: UnknownRecord = {};
    for (const key of Object.keys(record).sort(compareText)) defineRecordValue(result, key, stableValue(record[key]));
    return result;
  }
  if (typeof value === "bigint") return String(value);
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") return null;
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

/** Short, stable, content-addressed label for identities with no shared key. */
function contentKey(value: unknown, rule: DedupeIdentityRule): string {
  return `${rule}:${sha256HexUtf8(stableJson(value)).slice(0, 16)}`;
}

function scalarRecord(value: unknown): UnknownRecord | undefined {
  if (typeof value === "string") return { value };
  if (typeof value === "number" || typeof value === "boolean") return { value: String(value) };
  return undefined;
}

function recordList(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) return [entry as UnknownRecord];
      const scalar = scalarRecord(entry);
      if (scalar !== undefined) return [scalar];
      if (typeof entry === "string") {
        try {
          const parsed: unknown = JSON.parse(entry);
          if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return [parsed as UnknownRecord];
        } catch {
          return [{ value: entry }];
        }
        return [{ value: entry }];
      }
      return [];
    });
  }
  if (typeof value === "string") {
    assertResearchInput(value);
    const trimmed = value.trim();
    if (trimmed === "") return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== value) return recordList(parsed);
    } catch {
      const entries = trimmed.split(/\n\s*\n|\n/u).map((entry) => entry.trim()).filter(Boolean);
      return entries.map((entry) => {
        try {
          const parsed: unknown = JSON.parse(entry);
          if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed as UnknownRecord;
        } catch {
          return { value: entry };
        }
        return { value: entry };
      });
    }
    return [{ value: trimmed }];
  }
  if (typeof value === "object" && value !== null) {
    const record = value as UnknownRecord;
    if (Array.isArray(record.records)) return recordList(record.records);
    if (Array.isArray(record.items)) return recordList(record.items);
    return [record];
  }
  const scalar = scalarRecord(value);
  return scalar === undefined ? [] : [scalar];
}

export function parseCitationRecords(value: unknown): CitationRecord[] {
  return recordList(value).map((record) => record as CitationRecord);
}

function dedupeBy<T>(records: readonly T[], resolve: (record: T, index: number) => ResolvedIdentity): DedupeResult<T> {
  const indexes = new Map<string, number[]>();
  const rules = new Map<string, DedupeIdentityRule>();
  const unique: T[] = [];
  const duplicates: T[] = [];
  records.forEach((record, index) => {
    const identity = resolve(record, index);
    // An empty key must never collapse distinct records, so it degrades to a
    // content-addressed key that is unique per record by construction.
    const key = identity.key === "" ? contentKey(record, identity.rule) : identity.key;
    const existing = indexes.get(key);
    if (existing === undefined) {
      indexes.set(key, [index]);
      rules.set(key, identity.rule);
      unique.push(record);
    } else {
      existing.push(index);
      duplicates.push(record);
    }
  });
  return {
    records: [...unique],
    unique: [...unique],
    duplicates: [...duplicates],
    groups: [...indexes.entries()].map(([key, groupIndexes]) => ({ key, rule: rules.get(key) ?? "field-content", indexes: groupIndexes })),
    removed: duplicates.length,
    inputCount: records.length,
    outputCount: unique.length,
  };
}

function doiIdentity(record: UnknownRecord): ResolvedIdentity {
  const doi = field(record, "doi", "DOI");
  if (doi === "") return { key: "", rule: "doi" };
  const normalized = normalizeDoiReference(doi);
  return normalized.valid ? { key: `doi:${normalized.normalized.toLowerCase()}`, rule: "doi" } : { key: "", rule: "doi" };
}

function isbnIdentity(record: UnknownRecord): ResolvedIdentity {
  const isbn = field(record, "isbn", "ISBN");
  if (isbn === "") return { key: "", rule: "isbn" };
  const normalized = normalizeIsbnReference(isbn);
  if (!normalized.valid) return { key: "", rule: "isbn" };
  const identity = normalized.kind === "ISBN-10" ? normalized.isbn13 : normalized.digits;
  return { key: `isbn:${identity.toLowerCase()}`, rule: "isbn" };
}

function urlIdentity(record: UnknownRecord): ResolvedIdentity {
  const url = field(record, "url", "URL", "uri");
  if (url === "") return { key: "", rule: "url" };
  try {
    return { key: `url:${redactUrl(new URL(url)).toLowerCase()}`, rule: "url" };
  } catch {
    return { key: `url:${foldText(redactUrlCredentials(url))}`, rule: "url" };
  }
}

function titleAuthorYearIdentity(record: UnknownRecord): ResolvedIdentity {
  const title = foldText(field(record, "title", "TI", "name"));
  const authors = foldText(field(record, "authors", "author", "AU"));
  const year = field(record, "year", "date", "PY").match(/\d{4}/u)?.[0] ?? "";
  // An all-empty key would merge unrelated references, so it is never returned.
  if (title === "" && authors === "" && year === "") return { key: "", rule: "title-author-year" };
  return { key: `${title}|${authors}|${year}`, rule: "title-author-year" };
}

function chainIdentity(
  record: UnknownRecord,
  resolvers: readonly ((record: UnknownRecord) => ResolvedIdentity)[],
  fallbackRule: DedupeIdentityRule,
): ResolvedIdentity {
  for (const resolve of resolvers) {
    const identity = resolve(record);
    if (identity.key !== "") return identity;
  }
  return { key: "", rule: fallbackRule };
}

function citationIdentity(record: UnknownRecord, mode: CitationDedupeOptions["mode"]): ResolvedIdentity {
  if (mode === "exact") return { key: stableJson(record), rule: "exact" };
  if (mode === "title-author-year") return chainIdentity(record, [titleAuthorYearIdentity], "field-content");
  return chainIdentity(record, [doiIdentity, isbnIdentity, urlIdentity, titleAuthorYearIdentity], "field-content");
}

export function normalizeDoiForResearch(value: string): ReturnType<typeof normalizeDoiReference> {
  return normalizeDoiReference(value);
}

export function buildDoiLink(value: string): DoiLinkResult {
  const result = normalizeDoiReference(requiredString(value, "doi"));
  if (!result.valid) return { valid: false, reason: result.reason };
  return { valid: true, normalized: result.normalized, url: result.url };
}

export function validateIsbnForResearch(value: string): ReturnType<typeof normalizeIsbnReference> {
  return normalizeIsbnReference(requiredString(value, "isbn"));
}

const URL_RECORD_KEYS = ["url", "URL", "uri"] as const;

/**
 * The dedupe tools echo the surviving records back to the user, so credentials
 * pasted into a URL are redacted on the way out instead of being displayed.
 */
function redactRecordCredentials<T>(record: T): T {
  if (typeof record !== "object" || record === null) return record;
  const source = record as UnknownRecord;
  let changed = false;
  const copy: UnknownRecord = { ...source };
  for (const key of URL_RECORD_KEYS) {
    const value = copy[key];
    if (typeof value !== "string" || value === "") continue;
    const redacted = redactResearchOutput(value);
    if (redacted !== value) {
      defineRecordValue(copy, key, redacted);
      changed = true;
    }
  }
  return (changed ? copy : record) as T;
}

function redactDedupeResult<T>(result: DedupeResult<T>): DedupeResult<T> {
  const records = result.records.map(redactRecordCredentials);
  const unique = result.unique.map(redactRecordCredentials);
  return { ...result, records, unique };
}

export function dedupeCitationRecords(records: readonly CitationRecord[], options: CitationDedupeOptions = {}): DedupeResult<CitationRecord> {
  const mode = options.mode ?? "identifier";
  return redactDedupeResult(dedupeBy(records, (record) => citationIdentity(record, mode)));
}

function findClosingBrace(text: string, start: number): number {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "\"" && depth === 0) quoted = !quoted;
    if (quoted) continue;
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findClosingParen(text: string, start: number): number {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    if (text[index] === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

interface BibtexValueSegment {
  readonly literal: boolean;
  readonly text: string;
}

function readBibtexSegment(text: string, start: number): { segment: BibtexValueSegment; end: number } {
  const opener = text[start];
  if (opener === "{") {
    const close = findClosingBrace(text, start);
    return {
      segment: { literal: true, text: close < 0 ? text.slice(start + 1) : text.slice(start + 1, close) },
      end: close < 0 ? text.length : close + 1,
    };
  }
  if (opener === "\"") {
    let escaped = false;
    let index = start + 1;
    const valueStart = index;
    for (; index < text.length; index += 1) {
      const character = text[index];
      if (character === "\"" && !escaped) break;
      if (character === "\\" && !escaped) escaped = true;
      else escaped = false;
    }
    const end = index < text.length ? index + 1 : text.length;
    return { segment: { literal: true, text: text.slice(valueStart, Math.min(index, text.length)) }, end };
  }
  const comma = text.indexOf(",", start);
  const end = comma < 0 ? text.length : comma;
  // A bare word here is a @string macro reference. Macros are never expanded, so
  // the reference is preserved verbatim instead of being silently resolved.
  return { segment: { literal: false, text: text.slice(start, end) }, end };
}

function parseBibtexValue(text: string, start: number): { value: string; end: number } {
  let cursor = start;
  let value = "";
  for (;;) {
    while (cursor < text.length && /\s/u.test(text[cursor] ?? "")) cursor += 1;
    if (cursor >= text.length) break;
    const { segment, end } = readBibtexSegment(text, cursor);
    const trimmed = segment.text.trim();
    if (trimmed !== "") {
      if (value === "") value = trimmed;
      else if (segment.literal) value += trimmed;
      else value += ` # ${trimmed}`;
    }
    cursor = end;
    while (cursor < text.length && /\s/u.test(text[cursor] ?? "")) cursor += 1;
    if (text[cursor] !== "#") break;
    cursor += 1;
  }
  return { value, end: cursor };
}

function parseBibtexFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let cursor = 0;
  while (cursor < body.length) {
    while (cursor < body.length && /[\s,]/u.test(body[cursor] ?? "")) cursor += 1;
    const equals = body.indexOf("=", cursor);
    if (equals < 0) break;
    const name = body.slice(cursor, equals).trim().toLowerCase();
    const parsedValue = parseBibtexValue(body, equals + 1);
    if (name !== "" && !/^\s/u.test(name)) {
      const normalized = normalizeText(parsedValue.value);
      defineRecordValue(fields, name, name === "url" || name === "uri" ? redactResearchOutput(normalized) : normalized);
    }
    cursor = parsedValue.end;
    if (body[cursor] === ",") cursor += 1;
  }
  return fields;
}

/**
 * Parses a BibTeX document. `@comment`, `@preamble` and `@string` are directives,
 * never entries: emitting them as references silently corrupted the output. A
 * `@type{...}` without a citation key is not an entry either and is skipped.
 */
export function parseBibtexDocument(text: string): BibtexDocument {
  assertResearchInput(text);
  const source = text.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  const entries: BibtexEntry[] = [];
  const directives: string[] = [];
  let truncated = false;
  const scan = /@([A-Za-z][A-Za-z0-9_-]*)\s*([({])/gu;
  let match: RegExpExecArray | null;
  while ((match = scan.exec(source)) !== null) {
    const rawType = (match[1] ?? "misc").toLowerCase();
    const opener = match[2] === "(" ? "(" : "{";
    const openerIndex = match.index + 1 + (match[1] ?? "").length;
    const closing = opener === "(" ? findClosingParen(source, openerIndex) : findClosingBrace(source, openerIndex);
    if (closing < 0) {
      truncated = true;
      break;
    }
    if (BIBTEX_DIRECTIVE_TYPES.has(rawType)) {
      directives.push(rawType);
      scan.lastIndex = closing + 1;
      continue;
    }
    // The citation key runs from the opener to the first comma.
    const head = source.slice(openerIndex + 1, closing);
    const headMatch = head.match(/^\s*([^,})]+?)\s*,/u);
    if (headMatch === null) {
      scan.lastIndex = closing + 1;
      continue;
    }
    const key = headMatch[1] ?? "";
    const bodyStart = openerIndex + 1 + headMatch[0].length;
    entries.push({ type: rawType, key, fields: parseBibtexFields(source.slice(bodyStart, closing)) });
    scan.lastIndex = closing + 1;
  }
  return { entries, directives, truncated };
}

export function parseBibtex(text: string): BibtexEntry[] {
  return parseBibtexDocument(text).entries;
}

function orderedFields(fields: Record<string, string>): string[] {
  const known = BIBTEX_FIELD_ORDER.filter((key) => fields[key] !== undefined);
  const unknown = Object.keys(fields).filter((key) => !BIBTEX_FIELD_ORDER.includes(key as (typeof BIBTEX_FIELD_ORDER)[number])).sort(compareText);
  return [...known, ...unknown];
}

function balancedBraces(value: string): boolean {
  let depth = 0;
  for (const character of value) {
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function quoteBibtexValue(value: string): string {
  return `"${value.replace(/[\\"]/gu, "\\$&")}"`;
}

export function formatBibtexEntry(entry: BibtexEntry): string {
  const type = entry.type.trim().toLowerCase() || "misc";
  const key = normalizeText(entry.key).replace(/[{}]/gu, "").replace(/\s+/gu, "_") || "reference";
  const lines = orderedFields(entry.fields).map((fieldName) => {
    const value = entry.fields[fieldName] ?? "";
    return `  ${fieldName} = ${balancedBraces(value) ? `{${value}}` : quoteBibtexValue(value)}`;
  });
  return `@${type}{${key},${lines.length === 0 ? "\n" : `\n${lines.join(",\n")}\n`}}`;
}

export function formatBibtexDocument(entries: readonly BibtexEntry[]): FormattedBibtex {
  const warnings: ConversionWarning[] = [];
  entries.forEach((entry, index) => {
    for (const fieldName of Object.keys(entry.fields)) {
      const value = entry.fields[fieldName] ?? "";
      if (value !== "" && !balancedBraces(value)) {
        warnings.push({
          record: index + 1,
          code: "BIBTEX_VALUE_QUOTED",
          message: `Il campo "${fieldName}" della voce ${index + 1} non ha graffe bilanciate: il valore è stato racchiuso tra virgolette per restare valido.`,
        });
      }
    }
  });
  return { bibtex: entries.length === 0 ? "" : `${entries.map(formatBibtexEntry).join("\n\n")}\n`, warnings };
}

export function formatBibtex(entries: readonly BibtexEntry[]): string {
  return formatBibtexDocument(entries).bibtex;
}

function bibtexIdentity(entry: BibtexEntry): ResolvedIdentity {
  return chainIdentity(entry.fields as UnknownRecord, [doiIdentity, isbnIdentity, urlIdentity, titleAuthorYearIdentity], "entry-content");
}

export interface BibtexDedupeResult extends DedupeResult<BibtexEntry> {
  bibtex: string;
  rules: string[];
}

export function dedupeBibtexEntries(entries: readonly BibtexEntry[]): BibtexDedupeResult {
  const result = redactDedupeResult(dedupeBy(entries, (entry) => bibtexIdentity(entry)));
  return { ...result, bibtex: formatBibtex(result.unique), rules: [...new Set(result.groups.map((group) => group.rule))].sort(compareText) };
}

function firstTag(record: RisRecord, tags: readonly string[]): string {
  for (const tag of tags) {
    const value = record.fields.get(tag)?.[0];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function risRecordToCitation(record: RisRecord): CitationRecord {
  const result: CitationRecord = {};
  if (record.type !== "") result.type = record.type;
  const authors = record.fields.get("AU") ?? record.fields.get("A1") ?? [];
  if (authors.length > 0) result.authors = authors;
  const editors = record.fields.get("ED") ?? [];
  if (editors.length > 0) result.editor = editors.join(" and ");
  const title = firstTag(record, ["TI", "T1", "CT", "BT"]);
  if (title !== "") result.title = title;
  const year = firstTag(record, ["PY", "Y1", "DA"]);
  if (year !== "") result.year = year;
  const journal = firstTag(record, ["JO", "JF", "JA", "T2"]);
  if (journal !== "") result.journal = journal;
  const publisher = firstTag(record, ["PB"]);
  if (publisher !== "") result.publisher = publisher;
  const doi = firstTag(record, ["DO"]);
  if (doi !== "") result.doi = doi;
  const url = firstTag(record, ["UR", "L1", "L2"]);
  if (url !== "") result.url = redactResearchOutput(url);
  const start = firstTag(record, ["SP"]);
  const end = firstTag(record, ["EP"]);
  if (start !== "" || end !== "") result.pages = [start, end].filter((value) => value !== "").join("--");
  const abstract = firstTag(record, ["AB", "N2"]);
  if (abstract !== "") result.abstract = abstract;
  const keywords = record.fields.get("KW") ?? [];
  if (keywords.length > 0) result.keywords = keywords.join(", ");
  const note = firstTag(record, ["N1"]);
  if (note !== "") result.note = note;
  return result;
}

const RIS_STRUCTURAL_TAGS = new Set(["TY", "ER", "SP", "EP"]);

/**
 * Reads RIS tagged records. Tag lines that belong to no open record are counted
 * instead of being silently attached to the next record, and a record closed
 * without `ER` is reported as truncated.
 */
export function parseRisDocument(text: string): RisDocument {
  assertResearchInput(text);
  const records: RisRecord[] = [];
  const unknownTags: Array<{ record: number; tags: string[] }> = [];
  let current = new Map<string, string[]>();
  let currentType = "";
  let open = false;
  let skippedTagLines = 0;
  let unterminated = 0;
  const flush = (): void => {
    if (currentType === "" && current.size === 0) return;
    records.push({ type: currentType, fields: current });
    const unmapped = [...current.keys()].filter((tag) => tableValue(RIS_TAG_TO_BIBTEX, tag) === undefined && !RIS_STRUCTURAL_TAGS.has(tag)).sort(compareText);
    if (unmapped.length > 0) unknownTags.push({ record: records.length, tags: unmapped });
    current = new Map<string, string[]>();
    currentType = "";
  };
  for (const line of text.replace(/\r\n?/gu, "\n").split("\n")) {
    const match = line.match(/^([A-Z0-9]{2})\s{2}-\s?(.*)$/u);
    if (match === null) continue;
    const tag = match[1] ?? "";
    const value = (match[2] ?? "").trim();
    if (tag === "TY") {
      if (open) unterminated += 1;
      flush();
      open = true;
      currentType = value;
      continue;
    }
    if (!open) {
      skippedTagLines += 1;
      continue;
    }
    if (tag === "ER") {
      flush();
      open = false;
      continue;
    }
    if (value === "") continue;
    const values = current.get(tag) ?? [];
    values.push(value);
    current.set(tag, values);
  }
  if (open) {
    unterminated += 1;
    flush();
  }
  return { records, unknownTags, skippedTagLines, truncated: unterminated > 0 };
}

export function parseRis(text: string): CitationRecord[] {
  return parseRisDocument(text).records.map(risRecordToCitation);
}

export function convertRisToBibtex(text: string): RisToBibtexResult {
  const document = parseRisDocument(text);
  const warnings: ConversionWarning[] = [];
  const entries: BibtexEntry[] = [];
  document.records.forEach((record, index) => {
    const fields: Record<string, string> = {};
    for (const [tag, values] of record.fields) {
      const target = tableValue(RIS_TAG_TO_BIBTEX, tag);
      if (target === undefined) continue;
      const cleaned = values.map((value) => (RIS_REPEATED_AUTHOR_TAGS.has(tag) || tag === "UR" || tag === "L1" || tag === "L2" ? value : value));
      const normalized = tag === "UR" || tag === "L1" || tag === "L2"
        ? cleaned.map((value) => redactResearchOutput(normalizeText(value)))
        : cleaned.map((value) => normalizeText(value));
      const usable = normalized.filter((value) => value !== "");
      if (usable.length === 0) continue;
      if (target === "year") fields[target] = usable[0]?.match(/\d{4}/u)?.[0] ?? usable[0] ?? "";
      else if (RIS_REPEATED_FIELDS.has(target)) fields[target] = usable.join(target === "keywords" ? ", " : " and ");
      else if (fields[target] === undefined) fields[target] = usable[0] ?? "";
    }
    const start = record.fields.get("SP")?.[0]?.trim();
    const end = record.fields.get("EP")?.[0]?.trim();
    if ((start !== undefined && start !== "") || (end !== undefined && end !== "")) {
      fields.pages = [start, end].filter((value) => value !== undefined && value !== "").join("--");
    }
    if (Object.keys(fields).length === 0) {
      warnings.push({ record: index + 1, code: "RIS_RECORD_EMPTY", message: `Il record RIS ${index + 1} non contiene campi convertibili in BibTeX.` });
    }
    const citation = risRecordToCitation(record);
    const key = generateCitationKey(citation, entries.map((entry) => entry.key));
    entries.push({ type: tableValue(RIS_TYPE_TO_BIBTEX, record.type.toUpperCase()) ?? "misc", key, fields });
  });
  for (const unknown of document.unknownTags) {
    warnings.push({
      record: unknown.record,
      code: "RIS_TAG_UNMAPPED",
      message: `Il record RIS ${unknown.record} contiene i tag ${unknown.tags.join(", ")} che BibTeX non rappresenta: sono elencati nell'output ma non convertiti.`,
    });
  }
  if (document.skippedTagLines > 0) {
    warnings.push({
      record: 0,
      code: "RIS_TAG_LINES_SKIPPED",
      message: `${document.skippedTagLines} righe con tag non appartenenti a nessun record RIS sono state escluse dal risultato.`,
    });
  }
  if (document.truncated) {
    warnings.push({ record: 0, code: "RIS_TRUNCATED", message: "Almeno un record RIS non è chiuso dalla riga ER: è stato convertito comunque fino all'ultimo tag letto." });
  }
  const formatted = formatBibtexDocument(entries);
  return {
    ...formatted,
    warnings: [...warnings, ...formatted.warnings],
    entries,
    unknownTags: document.unknownTags,
    skippedTagLines: document.skippedTagLines,
    truncated: document.truncated,
  };
}

export function convertBibtexToRis(text: string): BibtexToRisResult {
  const document = parseBibtexDocument(text);
  const warnings: ConversionWarning[] = [];
  const unknownFields: Array<{ entry: number; fields: string[] }> = [];
  const records = document.entries.map((entry, index) => {
    const lines = [`TY  - ${tableValue(BIBTEX_TYPE_TO_RIS, entry.type.toLowerCase()) ?? "GEN"}`];
    const unmapped: string[] = [];
    for (const [fieldName, value] of Object.entries(entry.fields)) {
      if (fieldName === "pages") {
        const pages = pageNumbers(value);
        if (pages.length === 0) lines.push(`SP  - ${normalizeText(value)}`);
        else {
          lines.push(`SP  - ${pages[0]}`);
          if (pages.length > 1) lines.push(`EP  - ${pages[pages.length - 1]}`);
        }
        continue;
      }
      const tag = tableValue(BIBTEX_FIELD_TO_RIS, fieldName);
      if (tag === undefined) {
        if (value !== "") unmapped.push(fieldName);
        continue;
      }
      if (fieldName === "author" || fieldName === "editor") {
        for (const name of value.split(/\s+and\s+/iu)) {
          const trimmed = name.trim();
          if (trimmed !== "") lines.push(`${tag}  - ${trimmed}`);
        }
        continue;
      }
      if (value !== "") lines.push(`${tag}  - ${value}`);
    }
    if (unmapped.length > 0) {
      const fields = unmapped.sort(compareText);
      unknownFields.push({ entry: index + 1, fields });
      warnings.push({
        record: index + 1,
        code: "BIBTEX_FIELD_UNMAPPED",
        message: `La voce BibTeX ${index + 1} contiene i campi ${fields.join(", ")} che RIS non rappresenta: sono elencati nell'output ma non convertiti.`,
      });
    }
    lines.push("ER  -");
    return lines.join("\n");
  });
  for (const directive of [...new Set(document.directives)]) {
    warnings.push({ record: 0, code: "BIBTEX_DIRECTIVE_SKIPPED", message: `La direttiva @${directive} non è una voce bibliografica e non è stata convertita in RIS.` });
  }
  if (document.truncated) {
    warnings.push({ record: 0, code: "BIBTEX_TRUNCATED", message: "Il documento BibTeX contiene una voce non chiusa: il testo leggibile è stato convertito e la parte rimanente no." });
  }
  return {
    ris: records.length === 0 ? "" : `${records.join("\n\n")}\n`,
    entries: document.entries,
    warnings,
    unknownFields,
    truncated: document.truncated,
  };
}

function pageNumbers(value: string): number[] {
  const pages: number[] = [];
  // BibTeX writes en dashes as `--`, so runs of hyphens are accepted too.
  for (const part of value.split(/[,;]/u)) {
    const trimmed = part.trim();
    const range = trimmed.match(/^(\d+)\s*-{1,3}\s*(\d+)$/u) ?? trimmed.match(/^(\d+)\s*[–—]\s*(\d+)$/u);
    if (range !== null) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > 0 && end >= start && end - start <= MAX_PAGE_SPAN) {
        for (let page = start; page <= end; page += 1) pages.push(page);
      }
      continue;
    }
    const page = Number(trimmed);
    if (Number.isInteger(page) && page > 0) pages.push(page);
  }
  return [...new Set(pages)].sort((left, right) => left - right);
}

function canonicalPages(pages: readonly number[]): string {
  const values = [...new Set(pages)].sort((left, right) => left - right);
  if (values.length === 0) return "";
  const ranges: string[] = [];
  const firstValue = values[0];
  if (firstValue === undefined) return "";
  let start = firstValue;
  let previous = firstValue;
  for (const value of values.slice(1)) {
    if (value === previous + 1) {
      previous = value;
      continue;
    }
    ranges.push(start === previous ? String(start) : `${start}–${previous}`);
    start = value;
    previous = value;
  }
  ranges.push(start === previous ? String(start) : `${start}–${previous}`);
  return ranges.join(", ");
}

function pageLabel(pageCount: number, value: string, style: string): string {
  if (style === "chicago") return value;
  return pageCount === 1 ? `p. ${value}` : `pp. ${value}`;
}

export interface PdfPageCitationInput {
  author: string;
  title: string;
  year: string | number;
  pages: string;
  style?: "apa" | "mla" | "chicago";
}

export interface PdfPageCitation {
  citation: string;
  pages: string;
  pageCount: number;
  pageLabel: string;
  style: "apa" | "mla" | "chicago";
}

/**
 * The three styles are StrumentiUtili.it presets for page-level citations. No
 * conformance to a published style guide is claimed anywhere in this repository.
 */
export function formatPdfPageCitation(input: PdfPageCitationInput): PdfPageCitation {
  const author = normalizeText(input.author);
  const title = normalizeText(input.title);
  const year = String(input.year).trim();
  const pages = pageNumbers(requiredString(input.pages, "pages"));
  if (pages.length === 0) throw new Error("INVALID_INPUT:pages");
  if (author === "" || title === "" || !/^\d{4}$/u.test(year)) throw new Error("INVALID_INPUT");
  const style = input.style ?? "apa";
  const canonical = canonicalPages(pages);
  const label = pageLabel(pages.length, canonical, style);
  const citation = style === "apa"
    ? `${author} (${year}). ${title}. ${label}.`
    : `${author}. "${title}." ${year}, ${label}.`;
  return { citation: citation.replace(/\s+/gu, " ").trim(), pages: canonical, pageCount: pages.length, pageLabel: label, style };
}

export function countQuote(text: string): QuoteCounts {
  const normalized = text.replace(/\r\n?/gu, "\n").normalize("NFC");
  const words = normalized.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];
  const characters = Array.from(normalized).length;
  const charactersWithoutWhitespace = Array.from(normalized).filter((character) => !/\s/u.test(character)).length;
  const lines = normalized === "" ? 0 : normalized.split("\n").length;
  return {
    characters,
    charactersWithoutWhitespace,
    words: words.length,
    lines,
    readingMinutes: words.length === 0 ? 0 : Math.ceil(words.length / 200),
    normalized,
  };
}

function daysInMonth(year: number, month: number): number {
  return [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

function validYmd(year: number, month: number, day: number): boolean {
  return Number.isInteger(year) && year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function isoFromParts(year: number, month: number, day: number, precision: DatePrecision): string {
  const yearText = String(year).padStart(4, "0");
  if (precision === "year") return yearText;
  const monthText = String(month).padStart(2, "0");
  if (precision === "month") return `${yearText}-${monthText}`;
  return `${yearText}-${monthText}-${String(day).padStart(2, "0")}`;
}

function invalidDate(input: string, reason: string, source: string, dayFirst: boolean): InvalidDate {
  return { valid: false, input, reason, dayFirst, source, precision: null };
}

/**
 * Normalizes a source date to ISO. Ambiguous numeric dates are reported as such
 * and carry the alternative reading instead of silently picking one.
 */
export function normalizeDateSource(value: string, options: { dayFirst?: boolean } = {}): DateResult {
  const input = requiredString(value, "date");
  const raw = normalizeText(input);
  const dayFirst = options.dayFirst ?? false;
  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?(?:[T\s].*)?$/u);
  if (iso !== null) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = iso[3] === undefined ? undefined : Number(iso[3]);
    const precision: DatePrecision = day === undefined ? "month" : "day";
    if (!validYmd(year, month, day ?? 1)) return invalidDate(input, "questa data non esiste nel calendario", "iso-like", dayFirst);
    return { valid: true, input, iso: isoFromParts(year, month, day ?? 1, precision), precision, source: "iso-like", dayFirst: false };
  }
  const numeric = raw.match(/^(\d{1,2})([./-])(\d{1,2})\2(\d{4})$/u);
  if (numeric !== null) {
    const first = Number(numeric[1]);
    const second = Number(numeric[3]);
    const year = Number(numeric[4]);
    const monthFirst = { month: first, day: second };
    const dayMonthFirst = { month: second, day: first };
    const primary = dayFirst ? dayMonthFirst : monthFirst;
    const alternative = dayFirst ? monthFirst : dayMonthFirst;
    const primaryValid = validYmd(year, primary.month, primary.day);
    const alternativeValid = validYmd(year, alternative.month, alternative.day);
    if (!primaryValid && !alternativeValid) return invalidDate(input, "questa data non esiste nel calendario", "numeric", dayFirst);
    if (!primaryValid) {
      return { valid: true, input, iso: isoFromParts(year, alternative.month, alternative.day, "day"), precision: "day", source: "numeric", dayFirst: !dayFirst };
    }
    const result: NormalizedDate = {
      valid: true,
      input,
      iso: isoFromParts(year, primary.month, primary.day, "day"),
      precision: "day",
      source: "numeric",
      dayFirst,
    };
    if (alternativeValid && alternative.month !== primary.month) {
      result.ambiguous = true;
      result.alternativeIso = isoFromParts(year, alternative.month, alternative.day, "day");
    }
    return result;
  }
  const yearOnly = raw.match(/^(\d{4})$/u);
  if (yearOnly !== null) {
    return { valid: true, input, iso: isoFromParts(Number(yearOnly[1]), 1, 1, "year"), precision: "year", source: "year", dayFirst: false };
  }
  const monthName = raw.match(/^([\p{L}]+)\s+(\d{1,2})(?:st|nd|rd|th|°|º)?,?\s+(\d{4})$/u)
    ?? raw.match(/^(\d{1,2})(?:st|nd|rd|th|°|º)?\s+([\p{L}]+),?\s+(\d{4})$/u);
  if (monthName !== null) {
    const first = foldText(monthName[1] ?? "");
    const second = foldText(monthName[2] ?? "");
    const year = Number(monthName[3]);
    const firstMonth = monthNumber(first);
    const secondMonth = monthNumber(second);
    const month = firstMonth ?? secondMonth;
    if (month !== undefined) {
      const day = firstMonth === undefined ? Number(first) : Number(second);
      if (!validYmd(year, month, day)) return invalidDate(input, "questa data non esiste nel calendario", "month-name", dayFirst);
      return { valid: true, input, iso: isoFromParts(year, month, day, "day"), precision: "day", source: "month-name", dayFirst: false };
    }
  }
  const monthYear = raw.match(/^([\p{L}]+),?\s+(\d{4})$/u);
  if (monthYear !== null) {
    const month = monthNumber(foldText(monthYear[1] ?? ""));
    if (month !== undefined) {
      return { valid: true, input, iso: isoFromParts(Number(monthYear[2]), month, 1, "month"), precision: "month", source: "month-name", dayFirst: false };
    }
  }
  return invalidDate(input, "formato data non supportato", "unknown", dayFirst);
}

export function sortTimeline(records: readonly UnknownRecord[], direction: "ascending" | "descending" = "ascending"): {
  items: UnknownRecord[];
  sorted: UnknownRecord[];
  invalid: UnknownRecord[];
  direction: "ascending" | "descending";
} {
  const rows = records.map((record, index) => {
    const raw = field(record, "date", "when", "timestamp", "value", "text");
    const parsed = normalizeDateSource(raw, { dayFirst: false });
    return { record, index, iso: parsed.valid ? parsed.iso : undefined };
  });
  const valid = rows.filter((row): row is typeof row & { iso: string } => row.iso !== undefined);
  const invalid = rows.filter((row) => row.iso === undefined).map((row) => row.record);
  valid.sort((left, right) => {
    const dateOrder = compareText(left.iso, right.iso);
    return (direction === "ascending" ? dateOrder : -dateOrder) || left.index - right.index;
  });
  return { items: [...records], sorted: valid.map((row) => row.record), invalid, direction };
}

export function cleanResearchUrl(value: string): UrlCleanResult {
  const input = redactUrlCredentials(requiredString(value, "url"));
  let candidate = normalizeText(input);
  if (!/^[a-z][a-z0-9+.-]*:\/\//iu.test(candidate)) candidate = `https://${candidate}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { valid: false, input, removedParameters: [], removedFragment: false, reason: "invalid URL" };
  }
  if (!/^https?:$/iu.test(url.protocol)) return { valid: false, input, removedParameters: [], removedFragment: false, reason: "only HTTP(S) URLs are supported" };
  const removedParameters: string[] = [];
  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (TRACKING_KEYS.has(lower) || isTrackingKey(key)) {
      removedParameters.push(key);
      url.searchParams.delete(key);
    }
  }
  const removedFragment = url.hash !== "" && /^(?:#(?:!|\/?))(?:spm|utm_|share)/iu.test(url.hash);
  if (removedFragment) url.hash = "";
  url.searchParams.sort();
  return { valid: true, input, url: redactUrl(url), removedParameters: [...new Set(removedParameters)].sort(compareText), removedFragment };
}

/**
 * A hostname has to look like a hostname. `new URL` accepts a percent-encoded
 * space in the host and hands back "not%20a%20url", so the parse result alone
 * would count prose as a research source — and would do so differently across
 * JavaScript engines.
 */
function isPlausibleHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "" || host.length > 253) return false;
  if (host.startsWith("[") && host.endsWith("]")) return true;
  if (!/^[a-z0-9.-]+$/u.test(host)) return false;
  return host.split(".").every((label) => label !== "" && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label));
}

/**
 * Counts how often each hostname appears. Occurrences are counted separately
 * from distinct URLs, and values that are not HTTP(S) URLs are reported rather
 * than dropped in silence.
 */
export function countSourceDomains(values: readonly string[]): DomainFrequencyResult {
  const grouped = new Map<string, string[]>();
  const invalid: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || value.trim() === "") {
      invalid.push(String(value));
      continue;
    }
    const candidate = normalizeText(redactUrlCredentials(value));
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//iu.test(candidate) ? candidate : `https://${candidate}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      invalid.push(value);
      continue;
    }
    if (!/^https?:$/iu.test(url.protocol) || !isPlausibleHostname(url.hostname)) {
      invalid.push(value);
      continue;
    }
    const domain = url.hostname.toLowerCase();
    const observed = grouped.get(domain) ?? [];
    observed.push(redactUrl(url));
    grouped.set(domain, observed);
  }
  const domains = [...grouped.entries()]
    .map(([domain, observed]) => {
      const urls = [...new Set(observed)].sort(compareText);
      return { domain, count: observed.length, uniqueUrls: urls.length, urls };
    })
    .sort((left, right) => right.count - left.count || compareText(left.domain, right.domain));
  return {
    domains,
    total: domains.reduce((sum, item) => sum + item.count, 0),
    unique: domains.length,
    invalid,
    invalidCount: invalid.length,
    comparison: "hostname (solo HTTP/HTTPS, credenziali mascherate)",
  };
}

function csvCell(value: string): string {
  const safeValue = /^[\u0000-\u0020]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return /[",\n\r]/u.test(safeValue) ? `"${safeValue.replace(/"/gu, "\"\"")}"` : safeValue;
}

function recordEvidenceRow(record: UnknownRecord): EvidenceRow {
  const url = redactResearchOutput(field(record, "url", "URL", "link"));
  let source = field(record, "source", "publisher", "site");
  if (source === "" && url !== "") {
    try {
      source = new URL(url).hostname;
    } catch {
      source = "";
    }
  }
  return {
    title: field(record, "title", "name", "TI"),
    url,
    date: field(record, "date", "year", "published", "DA"),
    source,
    doi: field(record, "doi", "DOI"),
    notes: field(record, "notes", "note", "N1"),
  };
}

export function buildEvidenceTable(records: readonly UnknownRecord[]): EvidenceTable {
  const headers = ["title", "url", "date", "source", "doi", "notes"] as const;
  const rows = records.map(recordEvidenceRow);
  const emptyRowIndexes = rows.flatMap((row, index) => (Object.values(row).every((value) => value === "") ? [index + 1] : []));
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  return { csv, headers, rows, rowCount: rows.length, emptyRowCount: emptyRowIndexes.length, emptyRowIndexes };
}

function noteValues(value: unknown): Array<string | UnknownRecord> {
  if (Array.isArray(value)) {
    return value.flatMap<string | UnknownRecord>((entry) => {
      if (typeof entry === "string") return [entry];
      if (typeof entry === "object" && entry !== null) return [entry as UnknownRecord];
      if (typeof entry === "number" || typeof entry === "boolean") return [String(entry)];
      return [];
    });
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== value) return noteValues(parsed);
    } catch {
      return trimmed.split(/\n/u).map((entry) => entry.trim()).filter(Boolean);
    }
    return [{ value: trimmed }];
  }
  if (typeof value === "object" && value !== null) return [value as UnknownRecord];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  return [];
}

function noteText(value: string | UnknownRecord): string {
  return typeof value === "string" ? value : field(value, "note", "notes", "text", "value");
}

export interface NotesDedupeResult extends DedupeResult<string | UnknownRecord> {
  comparison: string;
}

export function dedupeNotes(value: unknown): NotesDedupeResult {
  const notes = noteValues(value);
  const result = dedupeBy(notes, (note) => {
    const text = foldText(noteText(note));
    return { key: text === "" ? "" : `note:${text}`, rule: "note-content" };
  });
  return { ...result, comparison: "NFC, senza distinzione maiuscole/minuscole, spazi ridotti" };
}

export interface VocabularyOptions {
  minLength?: number;
  limit?: number;
  stopwords?: Iterable<string>;
}

function codePointLength(value: string): number {
  return [...value].length;
}

export function analyzeVocabulary(value: string, options: VocabularyOptions = {}): VocabularyAnalysis {
  const input = requiredString(value, "text");
  const minLength = Math.max(1, Math.floor(options.minLength ?? 1));
  const limit = Math.max(1, Math.floor(options.limit ?? 50));
  const extra = [...(options.stopwords ?? [])].map((word) => foldText(word)).filter((word) => word !== "");
  const stopwords = new Set([...DEFAULT_STOPWORDS, ...extra]);
  const tokens = input.normalize("NFC").match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];
  const counts = new Map<string, number>();
  let ignoredStopwords = 0;
  let ignoredShortTerms = 0;
  for (const token of tokens) {
    const term = token.toLowerCase();
    if (stopwords.has(term)) {
      ignoredStopwords += 1;
      continue;
    }
    if (codePointLength(term) < minLength) {
      ignoredShortTerms += 1;
      continue;
    }
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  const terms = [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((left, right) => right.count - left.count || compareText(left.term, right.term))
    .slice(0, limit);
  return {
    terms,
    total: tokens.length,
    unique: counts.size,
    ignoredStopwords,
    ignoredShortTerms,
    minLength,
    limit,
    stopwordProfile: extra.length === 0 ? STOPWORD_PROFILE : `${STOPWORD_PROFILE}+utente`,
  };
}

export function dedupeReadingList(records: readonly CitationRecord[]): DedupeResult<CitationRecord> {
  return redactDedupeResult(dedupeBy(records, (record) => chainIdentity(record, [doiIdentity, isbnIdentity, urlIdentity, titleAuthorYearIdentity], "field-content")));
}

function asciiKeyPart(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036F]/gu, "").replace(/[^A-Za-z0-9]+/gu, " ").trim().toLowerCase();
}

/** `Smith, Ada` and `Ada Smith` both resolve to the surname `smith`. */
function surnameFrom(firstAuthor: string): string {
  const trimmed = firstAuthor.trim();
  if (trimmed === "") return "";
  const commaIndex = trimmed.indexOf(",");
  if (commaIndex > 0) return trimmed.slice(0, commaIndex).trim();
  const parts = trimmed.split(/\s+/u).filter(Boolean);
  return parts.at(-1) ?? "";
}

function titleKeyWord(title: string): string {
  const words = title.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word));
  const content = words.find((word) => !TITLE_LEADING_WORDS.has(asciiKeyPart(word)));
  return content ?? words[0] ?? "untitled";
}

export function generateCitationKey(record: CitationRecord, usedKeys: readonly string[] = []): string {
  const author = field(record, "authors", "author", "AU");
  const firstAuthor = author.split(/\s+and\s+|\s*&\s*|;/u)[0] ?? "";
  const surname = surnameFrom(firstAuthor) || "reference";
  const title = field(record, "title", "TI", "name");
  const titleWord = titleKeyWord(title);
  const year = field(record, "year", "date", "PY").match(/\d{4}/u)?.[0] ?? "nd";
  const base = [asciiKeyPart(surname), year, asciiKeyPart(titleWord)].filter(Boolean).join("_") || "reference";
  const used = new Set(usedKeys.map((key) => key.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (used.has(`${base}_${suffix}`.toLowerCase())) suffix += 1;
  return `${base}_${suffix}`;
}

export interface CitationKeysResult {
  keys: string[];
  collisions: number;
}

export function citationKeysFor(records: readonly CitationRecord[]): CitationKeysResult {
  const keys: string[] = [];
  let collisions = 0;
  for (const record of records) {
    const key = generateCitationKey(record, keys);
    if (key !== generateCitationKey(record)) collisions += 1;
    keys.push(key);
  }
  return { keys, collisions };
}

const REFERENCE_ORDER_RULES = {
  author: "cognome del primo autore, poi autore completo, anno, titolo",
  year: "anno di quattro cifre (quelli mancanti in coda), poi autore, titolo",
  title: "titolo senza articolo iniziale, poi autore, anno",
} as const;

function authorSortKey(record: CitationRecord): string {
  const author = field(record, "authors", "author", "AU");
  const firstAuthor = author.split(/\s+and\s+|\s*&\s*|;/u)[0] ?? "";
  return `${asciiKeyPart(surnameFrom(firstAuthor))} ${foldText(author)}`;
}

/**
 * Four-digit year, or 9999 when the record has none, so an entry without a date
 * sorts after every dated entry instead of before all of them.
 */
function yearSortKey(record: CitationRecord): string {
  return field(record, "year", "date", "PY").match(/\d{4}/u)?.[0] ?? "9999";
}

function titleSortKey(record: CitationRecord): string {
  return asciiKeyPart(titleKeyWord(field(record, "title", "TI", "name")));
}

export function sortReferenceList(records: readonly CitationRecord[], order: "author" | "year" | "title" = "author"): SortedReferenceList {
  const rows = records.map((record, index) => ({ record, index }));
  const sortKeys = (record: CitationRecord): readonly string[] => (order === "author"
    ? [authorSortKey(record), yearSortKey(record), titleSortKey(record)]
    : order === "year"
      ? [yearSortKey(record), authorSortKey(record), titleSortKey(record)]
      : [titleSortKey(record), authorSortKey(record), yearSortKey(record)]);
  rows.sort((left, right) => {
    const leftKeys = sortKeys(left.record);
    const rightKeys = sortKeys(right.record);
    for (let index = 0; index < leftKeys.length; index += 1) {
      const order2 = compareText(leftKeys[index] ?? "", rightKeys[index] ?? "");
      if (order2 !== 0) return order2;
    }
    return left.index - right.index;
  });
  const sorted = rows.map((row) => row.record);
  return {
    records: sorted,
    original: [...records],
    movedCount: sorted.filter((record, index) => record !== records[index]).length,
    unchanged: sorted.every((record, index) => record === records[index]),
    order,
    comparator: REFERENCE_ORDER_RULES[order],
  };
}

export function createResearchPackManifest(name: string, tools: readonly string[]): ResearchPackManifest {
  const packName = normalizeText(requiredString(name, "name"));
  if (tools.length === 0) throw new Error("INVALID_INPUT:tools");
  const normalizedTools = tools.map((tool) => normalizeText(requiredString(tool, "tool")));
  if (normalizedTools.some((tool) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(tool))) throw new Error("INVALID_INPUT:tool");
  const toolIds = [...new Set(normalizedTools)].sort(compareText);
  const canonicalPayload = `${packName}\n${toolIds.join("\n")}\n`;
  return {
    name: packName,
    tools: toolIds,
    count: toolIds.length,
    checksum: sha256HexUtf8(canonicalPayload),
    checksumAlgorithm: RESEARCH_KNOWLEDGE_CHECKSUM_ALGORITHM,
    canonicalPayload,
    version: "1",
    engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION,
  };
}

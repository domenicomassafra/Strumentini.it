import { isTrackingKey } from "../campaign-url";
import { normalizeDoi as normalizeDoiReference, normalizeIsbn as normalizeIsbnReference } from "../research-reference";

export const RESEARCH_KNOWLEDGE_ENGINE_VERSION = "research-knowledge-v1";

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

export interface CitationDedupeOptions {
  mode?: "exact" | "identifier" | "title-author-year";
}

export interface DedupeGroup {
  key: string;
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
}

export interface InvalidDate {
  valid: false;
  input: string;
  reason: string;
  dayFirst: boolean;
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
  urls: string[];
}

export interface EvidenceRow {
  title: string;
  url: string;
  date: string;
  source: string;
  doi: string;
  notes: string;
}

export interface VocabularyTerm {
  term: string;
  count: number;
}

export interface ResearchPackManifest {
  name: string;
  tools: string[];
  count: number;
  checksum: string;
  version: string;
  engineVersion: string;
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

const DEFAULT_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "with",
]);

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeText(value: string): string {
  return value.normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "").replace(/\s+/gu, " ").trim();
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

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`INVALID_INPUT:${label}`);
  return value;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === "object" && value !== null) {
    const record = value as UnknownRecord;
    const result: UnknownRecord = {};
    for (const key of Object.keys(record).sort(compareText)) result[key] = stableValue(record[key]);
    return result;
  }
  if (typeof value === "bigint") return String(value);
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") return null;
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function recordList(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === "string") {
        try {
          const parsed: unknown = JSON.parse(entry);
          if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return [parsed as UnknownRecord];
        } catch {
          return [{ value: entry }];
        }
        return [{ value: entry }];
      }
      if (typeof entry !== "object" || entry === null) return [];
      return [entry as UnknownRecord];
    });
  }
  if (typeof value === "string") {
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
  return [];
}

export function parseCitationRecords(value: unknown): CitationRecord[] {
  return recordList(value).map((record) => record as CitationRecord);
}

function dedupeBy<T>(records: readonly T[], keyFor: (record: T, index: number) => string): DedupeResult<T> {
  const indexes = new Map<string, number[]>();
  const unique: T[] = [];
  const duplicates: T[] = [];
  records.forEach((record, index) => {
    const key = keyFor(record, index);
    const existing = indexes.get(key);
    if (existing === undefined) {
      indexes.set(key, [index]);
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
    groups: [...indexes.entries()].map(([key, groupIndexes]) => ({ key, indexes: groupIndexes })),
    removed: duplicates.length,
    inputCount: records.length,
    outputCount: unique.length,
  };
}

function identifierForRecord(record: UnknownRecord): string {
  const doi = field(record, "doi", "DOI");
  if (doi !== "") {
    const normalized = normalizeDoiReference(doi);
    if (normalized.valid) return `doi:${normalized.normalized.toLowerCase()}`;
  }
  const isbn = field(record, "isbn", "ISBN");
  if (isbn !== "") {
    const normalized = normalizeIsbnReference(isbn);
    if (normalized.valid) {
      const identity = normalized.kind === "ISBN-10" ? normalized.isbn13 : normalized.digits;
      return `isbn:${identity.toLowerCase()}`;
    }
  }
  const url = field(record, "url", "URL", "uri");
  if (url !== "") {
    try {
      return `url:${new URL(url).toString().toLowerCase()}`;
    } catch {
      return `url:${foldText(url)}`;
    }
  }
  return "";
}

function titleAuthorYearKey(record: UnknownRecord): string {
  const title = foldText(field(record, "title", "TI", "name"));
  const authors = field(record, "authors", "author", "AU");
  const year = field(record, "year", "date", "PY").match(/\d{4}/u)?.[0] ?? "";
  return `${title}|${foldText(authors)}|${year}`;
}

function citationIdentity(record: UnknownRecord, mode: CitationDedupeOptions["mode"]): string {
  if (mode === "exact") return stableJson(record);
  if (mode === "title-author-year") return titleAuthorYearKey(record) || stableJson(record);
  return identifierForRecord(record) || titleAuthorYearKey(record) || stableJson(record);
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

export function dedupeCitationRecords(records: readonly CitationRecord[], options: CitationDedupeOptions = {}): DedupeResult<CitationRecord> {
  const mode = options.mode ?? "identifier";
  return dedupeBy(records, (record) => citationIdentity(record, mode));
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

function parseBibtexValue(text: string, start: number): { value: string; end: number } {
  let index = start;
  while (index < text.length && /\s/u.test(text[index] ?? "")) index += 1;
  const opener = text[index];
  if (opener === "{") {
    const end = findClosingBrace(text, index);
    if (end < 0) return { value: text.slice(index + 1).trim(), end: text.length };
    return { value: text.slice(index + 1, end).trim(), end: end + 1 };
  }
  if (opener === "\"") {
    let escaped = false;
    index += 1;
    const valueStart = index;
    for (; index < text.length; index += 1) {
      const character = text[index];
      if (character === "\"" && !escaped) return { value: text.slice(valueStart, index).trim(), end: index + 1 };
      if (character === "\\" && !escaped) escaped = true;
      else escaped = false;
    }
    return { value: text.slice(valueStart).trim(), end: text.length };
  }
  const comma = text.indexOf(",", index);
  const end = comma < 0 ? text.length : comma;
  return { value: text.slice(index, end).trim(), end };
}

export function parseBibtex(text: string): BibtexEntry[] {
  const source = text.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  const entries: BibtexEntry[] = [];
  const header = /@([A-Za-z][A-Za-z0-9_-]*)\s*\{\s*([^,\s}]+)\s*,/gu;
  let match: RegExpExecArray | null;
  while ((match = header.exec(source)) !== null) {
    const type = (match[1] ?? "misc").toLowerCase();
    const key = match[2] ?? "";
    const opening = source.indexOf("{", match.index);
    const bodyStart = header.lastIndex;
    const closing = findClosingBrace(source, opening);
    if (opening < 0 || closing < 0) break;
    const body = source.slice(bodyStart, closing);
    const fields: Record<string, string> = {};
    let cursor = 0;
    while (cursor < body.length) {
      while (cursor < body.length && /[\s,]/u.test(body[cursor] ?? "")) cursor += 1;
      const equals = body.indexOf("=", cursor);
      if (equals < 0) break;
      const name = body.slice(cursor, equals).trim().toLowerCase();
      const parsedValue = parseBibtexValue(body, equals + 1);
      if (name !== "") fields[name] = normalizeText(parsedValue.value);
      cursor = parsedValue.end;
      if (body[cursor] === ",") cursor += 1;
    }
    entries.push({ type, key, fields });
    header.lastIndex = closing + 1;
  }
  return entries;
}

function orderedFields(fields: Record<string, string>): string[] {
  const known = BIBTEX_FIELD_ORDER.filter((key) => fields[key] !== undefined);
  const unknown = Object.keys(fields).filter((key) => !BIBTEX_FIELD_ORDER.includes(key as (typeof BIBTEX_FIELD_ORDER)[number])).sort(compareText);
  return [...known, ...unknown];
}

export function formatBibtexEntry(entry: BibtexEntry): string {
  const type = entry.type.trim().toLowerCase() || "misc";
  const key = normalizeText(entry.key).replace(/[{}]/gu, "").replace(/\s+/gu, "_") || "reference";
  const lines = orderedFields(entry.fields).map((fieldName) => `  ${fieldName} = {${entry.fields[fieldName] ?? ""}}`);
  return `@${type}{${key},${lines.length === 0 ? "\n" : `\n${lines.join(",\n")}\n`}}`;
}

export function formatBibtex(entries: readonly BibtexEntry[]): string {
  return `${entries.map(formatBibtexEntry).join("\n\n")}\n`;
}

function bibtexIdentity(entry: BibtexEntry): string {
  const doi = entry.fields.doi ?? "";
  if (doi !== "") {
    const normalized = normalizeDoiReference(doi);
    if (normalized.valid) return `doi:${normalized.normalized.toLowerCase()}`;
  }
  const title = foldText(entry.fields.title ?? "");
  const author = foldText(entry.fields.author ?? entry.fields.editor ?? "");
  const year = entry.fields.year ?? entry.fields.date ?? "";
  return `${title}|${author}|${year.match(/\d{4}/u)?.[0] ?? ""}`;
}

export function dedupeBibtexEntries(entries: readonly BibtexEntry[]): DedupeResult<BibtexEntry> & { bibtex: string } {
  const result = dedupeBy(entries, bibtexIdentity);
  return { ...result, bibtex: formatBibtex(result.unique) };
}

function risFieldsToRecord(fields: Map<string, string[]>): CitationRecord {
  const record: CitationRecord = {};
  const first = (tag: string): string => fields.get(tag)?.[0] ?? "";
  const risType = first("TY");
  if (risType !== "") record.type = risType;
  const authors = fields.get("AU") ?? fields.get("A1") ?? [];
  if (authors.length > 0) record.authors = authors;
  const title = first("TI") || first("T1") || first("BT");
  if (title !== "") record.title = title;
  const year = first("PY") || first("Y1") || first("DA");
  if (year !== "") record.year = year;
  const doi = first("DO");
  if (doi !== "") record.doi = doi;
  const url = first("UR") || first("L1");
  if (url !== "") record.url = url;
  return record;
}

export function parseRis(text: string): CitationRecord[] {
  const records: CitationRecord[] = [];
  let current = new Map<string, string[]>();
  for (const line of text.replace(/\r\n?/gu, "\n").split("\n")) {
    const match = line.match(/^([A-Z0-9]{2})\s{2}-\s?(.*)$/u);
    if (match === null) continue;
    const tag = match[1] ?? "";
    const value = (match[2] ?? "").trim();
    if (tag === "TY") {
      current = new Map<string, string[]>();
      if (value !== "") current.set(tag, [value]);
    } else if (tag === "ER") {
      if (current.size > 0) records.push(risFieldsToRecord(current));
      current = new Map<string, string[]>();
    } else if (current.size > 0 && value !== "") {
      const values = current.get(tag) ?? [];
      values.push(value);
      current.set(tag, values);
    }
  }
  if (current.size > 0) records.push(risFieldsToRecord(current));
  return records;
}

function risTypeToBibtex(type: string): string {
  const normalizedType = type.toUpperCase();
  const map: Record<string, string> = {
    JOUR: "article",
    BOOK: "book",
    CHAP: "incollection",
    CONF: "inproceedings",
    CPAPER: "inproceedings",
    THES: "phdthesis",
    RPRT: "techreport",
    GEN: "misc",
  };
  return map[normalizedType] ?? "misc";
}

export function convertRisToBibtex(text: string): { bibtex: string; entries: BibtexEntry[]; warnings: string[] } {
  const records = parseRis(text);
  const warnings: string[] = [];
  const entries: BibtexEntry[] = [];
  records.forEach((record, index) => {
    const fields: Record<string, string> = {};
    const authors = record.authors;
    if (Array.isArray(authors)) fields.author = authors.join(" and ");
    else if (typeof authors === "string") fields.author = authors;
    if (record.title !== undefined) fields.title = record.title;
    if (record.year !== undefined) fields.year = String(record.year).match(/\d{4}/u)?.[0] ?? String(record.year);
    if (record.doi !== undefined) fields.doi = record.doi;
    if (record.url !== undefined) fields.url = record.url;
    if (Object.keys(fields).length === 0) warnings.push(`record ${index + 1} has no supported fields`);
    const key = generateCitationKey(record, entries.map((entry) => entry.key));
    entries.push({ type: risTypeToBibtex(record.type ?? "GEN"), key, fields });
  });
  return { bibtex: formatBibtex(entries), entries, warnings };
}

function bibtexTypeToRis(type: string): string {
  const normalizedType = type.toLowerCase();
  const map: Record<string, string> = {
    article: "JOUR",
    book: "BOOK",
    incollection: "CHAP",
    inproceedings: "CONF",
    phdthesis: "THES",
    techreport: "RPRT",
    misc: "GEN",
  };
  return map[normalizedType] ?? "GEN";
}

export function convertBibtexToRis(text: string): { ris: string; entries: BibtexEntry[]; warnings: string[] } {
  const entries = parseBibtex(text);
  const warnings: string[] = [];
  const records = entries.map((entry, index) => {
    const lines = [`TY  - ${bibtexTypeToRis(entry.type)}`];
    const author = entry.fields.author ?? entry.fields.editor;
    if (author !== undefined) {
      for (const name of author.split(/\s+and\s+/iu)) lines.push(`AU  - ${name.trim()}`);
    }
    for (const [fieldName, risTag] of [["title", "TI"], ["year", "PY"], ["doi", "DO"], ["url", "UR"], ["journal", "JO"], ["publisher", "PB"], ["volume", "VL"], ["number", "IS"], ["pages", "SP"]] as const) {
      const value = entry.fields[fieldName];
      if (value !== undefined) lines.push(`${risTag}  - ${value}`);
    }
    if (lines.length === 1) warnings.push(`entry ${index + 1} has no supported RIS fields`);
    lines.push("ER  -");
    return lines.join("\n");
  });
  return { ris: `${records.join("\n\n")}${records.length > 0 ? "\n" : ""}`, entries, warnings };
}

function pageNumbers(value: string): number[] {
  const pages: number[] = [];
  for (const part of value.split(/[,;]/u)) {
    const range = part.trim().match(/^(\d+)\s*[-–—]\s*(\d+)$/u);
    if (range !== null) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > 0 && end >= start && end - start <= 10000) for (let page = start; page <= end; page += 1) pages.push(page);
      continue;
    }
    const page = Number(part.trim());
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

function pageLabel(pages: readonly number[], style: string): string {
  const value = canonicalPages(pages);
  if (value === "") return "";
  const prefix = style === "mla" ? "p." : style === "chicago" ? "" : pages.length === 1 ? "p." : "pp.";
  return `${prefix}${prefix === "" ? "" : " "}${value}`;
}

export interface PdfPageCitationInput {
  author: string;
  title: string;
  year: string | number;
  pages: string;
  style?: "apa" | "mla" | "chicago";
  document?: string;
}

export function formatPdfPageCitation(input: PdfPageCitationInput): {
  citation: string;
  pages: string;
  pageCount: number;
  style: "apa" | "mla" | "chicago";
} {
  const author = normalizeText(input.author);
  const title = normalizeText(input.title);
  const year = String(input.year).trim();
  const pages = pageNumbers(requiredString(input.pages, "pages"));
  if (pages.length === 0) throw new Error("INVALID_INPUT:pages");
  if (author === "" || title === "" || !/^\d{4}$/u.test(year)) throw new Error("INVALID_INPUT");
  const style = input.style ?? "apa";
  const label = pageLabel(pages, style);
  let citation: string;
  if (style === "mla") citation = `${author}. "${title}." ${year}, ${label}.`;
  else if (style === "chicago") citation = `${author}. "${title}." ${year}, ${label}.`;
  else citation = `${author} (${year}). ${title}. ${label}.`;
  return { citation: citation.replace(/\s+/gu, " ").trim(), pages: canonicalPages(pages), pageCount: pages.length, style };
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

function dateSourceResult(input: string, year: number, month: number, day: number | undefined, precision: DatePrecision, source: string, dayFirst: boolean): DateResult {
  if (!validYmd(year, month, day ?? 1)) return { valid: false, input, reason: "date is outside the supported calendar", dayFirst };
  const yearText = String(year).padStart(4, "0");
  if (precision === "year") return { valid: true, input, iso: yearText, precision, source, dayFirst };
  if (precision === "month") return { valid: true, input, iso: `${yearText}-${String(month).padStart(2, "0")}`, precision, source, dayFirst };
  return { valid: true, input, iso: `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, precision, source, dayFirst };
}

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
    const result = dateSourceResult(raw, year, month, day, precision, "iso-like", false);
    if (result.valid) return { ...result, input };
    return result;
  }
  const numeric = raw.match(/^(\d{1,2})([./-])(\d{1,2})\2(\d{4})$/u);
  if (numeric !== null) {
    const first = Number(numeric[1]);
    const second = Number(numeric[3]);
    const year = Number(numeric[4]);
    const month = dayFirst ? second : first;
    const day = dayFirst ? first : second;
    const result = dateSourceResult(raw, year, month, day, "day", "numeric", dayFirst);
    if (result.valid) return { ...result, input };
    return result;
  }
  const yearOnly = raw.match(/^(\d{4})$/u);
  if (yearOnly !== null) return { ...dateSourceResult(raw, Number(yearOnly[1]), 1, undefined, "year", "year", false), input };
  const monthName = raw.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})$/u) ?? raw.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)[,]?\s+(\d{4})$/u);
  if (monthName !== null) {
    const first = (monthName[1] ?? "").toLowerCase();
    const second = (monthName[2] ?? "").toLowerCase();
    const year = Number(monthName[3]);
    const firstMonth = MONTHS[first];
    const secondMonth = MONTHS[second];
    const month = firstMonth ?? secondMonth;
    const day = firstMonth === undefined ? Number(first) : Number(second);
    if (month !== undefined) return { ...dateSourceResult(raw, year, month, day, "day", "month-name", false), input };
  }
  const monthYear = raw.match(/^([A-Za-z]+)[,]?\s+(\d{4})$/u);
  if (monthYear !== null) {
    const month = MONTHS[(monthYear[1] ?? "").toLowerCase()];
    if (month !== undefined) return { ...dateSourceResult(raw, Number(monthYear[2]), month, undefined, "month", "month-name", false), input };
  }
  return { valid: false, input, reason: "unsupported date format", dayFirst };
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
  const input = requiredString(value, "url");
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
  return { valid: true, input, url: url.toString(), removedParameters: [...new Set(removedParameters)].sort(compareText), removedFragment };
}

export function countSourceDomains(values: readonly string[]): { domains: DomainCount[]; total: number; unique: number } {
  const grouped = new Map<string, string[]>();
  for (const value of values) {
    const cleaned = cleanResearchUrl(value);
    if (!cleaned.valid || cleaned.url === undefined) continue;
    const domain = new URL(cleaned.url).hostname.toLowerCase();
    const valuesForDomain = grouped.get(domain) ?? [];
    valuesForDomain.push(cleaned.url);
    grouped.set(domain, valuesForDomain);
  }
  const domains = [...grouped.entries()].map(([domain, urls]) => ({ domain, count: urls.length, urls: [...new Set(urls)].sort(compareText) })).sort((left, right) => right.count - left.count || compareText(left.domain, right.domain));
  return { domains, total: domains.reduce((sum, item) => sum + item.count, 0), unique: domains.length };
}

function csvCell(value: string): string {
  return /[",\n\r]/u.test(value) ? `"${value.replace(/"/gu, "\"\"")}"` : value;
}

function recordEvidenceRow(record: UnknownRecord): EvidenceRow {
  const url = field(record, "url", "URL", "link");
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
    notes: field(record, "notes", "note", "abstract"),
  };
}

export function buildEvidenceTable(records: readonly UnknownRecord[]): { csv: string; headers: string[]; rows: EvidenceRow[]; rowCount: number } {
  const headers = ["title", "url", "date", "source", "doi", "notes"] as const;
  const rows = records.map(recordEvidenceRow);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  return { csv, headers: [...headers], rows, rowCount: rows.length };
}

function noteValues(value: unknown): Array<string | UnknownRecord> {
  if (Array.isArray(value)) return value.flatMap<string | UnknownRecord>((entry) => typeof entry === "string" ? [entry] : typeof entry === "object" && entry !== null ? [entry as UnknownRecord] : []);
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
  return [];
}

function noteText(value: string | UnknownRecord): string {
  return typeof value === "string" ? value : field(value, "note", "notes", "text", "value");
}

export function dedupeNotes(value: unknown): DedupeResult<string | UnknownRecord> {
  const notes = noteValues(value);
  return dedupeBy(notes, (note) => foldText(noteText(note)));
}

export interface VocabularyOptions {
  minLength?: number;
  limit?: number;
  stopwords?: Iterable<string>;
}

export function analyzeVocabulary(value: string, options: VocabularyOptions = {}): { terms: VocabularyTerm[]; total: number; unique: number; ignoredStopwords: number } {
  const input = requiredString(value, "text");
  const minLength = Math.max(1, Math.floor(options.minLength ?? 1));
  const limit = Math.max(1, Math.floor(options.limit ?? 50));
  const stopwords = new Set([...DEFAULT_STOPWORDS, ...(options.stopwords ?? [])].map((word) => foldText(word)).filter(Boolean));
  const tokens = input.normalize("NFC").match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];
  const counts = new Map<string, number>();
  let ignoredStopwords = 0;
  for (const token of tokens) {
    const term = token.toLowerCase();
    if (term.length < minLength || stopwords.has(term)) {
      if (stopwords.has(term)) ignoredStopwords += 1;
      continue;
    }
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  const terms = [...counts.entries()].map(([term, count]) => ({ term, count })).sort((left, right) => right.count - left.count || compareText(left.term, right.term)).slice(0, limit);
  return { terms, total: tokens.length, unique: counts.size, ignoredStopwords };
}

export function dedupeReadingList(records: readonly CitationRecord[]): DedupeResult<CitationRecord> {
  return dedupeBy(records, (record) => identifierForRecord(record) || titleAuthorYearKey(record) || stableJson(record));
}

function asciiKeyPart(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036F]/gu, "").replace(/[^A-Za-z0-9]+/gu, " ").trim().toLowerCase();
}

export function generateCitationKey(record: CitationRecord, usedKeys: readonly string[] = []): string {
  const author = field(record, "authors", "author", "AU");
  const firstAuthor = author.split(/\s+(?:and|&)\s+|;/u)[0] ?? "";
  const authorParts = firstAuthor.trim().split(/\s+/u).filter(Boolean);
  const surname = authorParts.at(-1) ?? "reference";
  const title = field(record, "title", "TI", "name");
  const titleWord = title.split(/\s+/u).find((word) => /[\p{L}\p{N}]/u.test(word)) ?? "untitled";
  const year = field(record, "year", "date", "PY").match(/\d{4}/u)?.[0] ?? "nd";
  const base = [asciiKeyPart(surname), year, asciiKeyPart(titleWord)].filter(Boolean).join("_") || "reference";
  const used = new Set(usedKeys.map((key) => key.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (used.has(`${base}_${suffix}`.toLowerCase())) suffix += 1;
  return `${base}_${suffix}`;
}

export function sortReferenceList(records: readonly CitationRecord[], order: "author" | "year" | "title" = "author"): DedupeResult<CitationRecord> & { order: string } {
  const sorted = records.map((record, index) => ({ record, index })).sort((left, right) => {
    const leftValue = order === "author" ? field(left.record, "authors", "author", "AU") : order === "year" ? field(left.record, "year", "date", "PY") : field(left.record, "title", "TI", "name");
    const rightValue = order === "author" ? field(right.record, "authors", "author", "AU") : order === "year" ? field(right.record, "year", "date", "PY") : field(right.record, "title", "TI", "name");
    return compareText(leftValue.toLowerCase(), rightValue.toLowerCase()) || left.index - right.index;
  }).map((entry) => entry.record);
  return {
    records: sorted,
    unique: sorted,
    duplicates: [],
    groups: sorted.map((_record, index) => ({ key: String(index), indexes: [index] })),
    removed: 0,
    inputCount: records.length,
    outputCount: sorted.length,
    order,
  };
}

export function createResearchPackManifest(name: string, tools: readonly string[]): ResearchPackManifest {
  const packName = normalizeText(requiredString(name, "name"));
  const normalizedTools = tools.map((tool) => normalizeText(requiredString(tool, "tool")));
  if (normalizedTools.some((tool) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(tool))) throw new Error("INVALID_INPUT:tool");
  const toolIds = [...new Set(normalizedTools)].sort(compareText);
  const payload = `${packName}\n${toolIds.join("\n")}`;
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return { name: packName, tools: toolIds, count: toolIds.length, checksum: hash.toString(16).padStart(8, "0"), version: "1", engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
}

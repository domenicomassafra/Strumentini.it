import { PDF_LIMITS } from "./types";
import { inflatePdfStream } from "./inflate";

export type PdfValue =
  | PdfName
  | PdfLiteral
  | PdfString
  | PdfReference
  | PdfArray
  | PdfDictionary
  | PdfStream;

export interface PdfName {
  readonly kind: "name";
  readonly value: string;
}

export interface PdfLiteral {
  readonly kind: "literal";
  readonly value: string;
}

export interface PdfString {
  readonly kind: "string";
  readonly bytes: Uint8Array;
  readonly hex: boolean;
}

export interface PdfReference {
  readonly kind: "ref";
  readonly id: number;
  readonly generation: number;
}

export interface PdfArray {
  readonly kind: "array";
  readonly items: PdfValue[];
}

export interface PdfDictionary {
  readonly kind: "dict";
  readonly entries: Map<string, PdfValue>;
}

export interface PdfStream {
  readonly kind: "stream";
  readonly dictionary: PdfDictionary;
  readonly bytes: Uint8Array;
}

export interface PdfObject {
  readonly id: number;
  readonly generation: number;
  value: PdfValue;
}

export interface PdfPageNode {
  readonly object: PdfObject;
  readonly inherited: Readonly<Record<string, PdfValue>>;
}

export interface PdfDocumentModel {
  readonly bytes: Uint8Array;
  readonly text: string;
  readonly version: string;
  readonly objects: ReadonlyMap<number, PdfObject>;
  readonly trailer: PdfDictionary;
  readonly root: PdfReference | null;
  readonly info: PdfReference | null;
  readonly encrypted: boolean;
  readonly linearized: boolean;
  readonly pages: readonly PdfPageNode[];
}

const WHITESPACE = new Set([0, 9, 10, 12, 13, 32]);
const DELIMITERS = new Set([0, 9, 10, 12, 13, 32, 40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);
const MAX_VALUE_DEPTH = 128;
const MAX_COLLECTION_ITEMS = 100_000;

function isWhitespace(code: number): boolean {
  return WHITESPACE.has(code);
}

function isDelimiter(code: number): boolean {
  return DELIMITERS.has(code);
}

function skipWhitespace(text: string, start: number): number {
  let index = start;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (isWhitespace(code)) {
      index += 1;
      continue;
    }
    if (code === 37) {
      while (index < text.length && text.charCodeAt(index) !== 10 && text.charCodeAt(index) !== 13) index += 1;
      continue;
    }
    break;
  }
  return index;
}

function readToken(text: string, start: number): { token: string; end: number } {
  let index = start;
  while (index < text.length && !isWhitespace(text.charCodeAt(index)) && !isDelimiter(text.charCodeAt(index))) index += 1;
  return { token: text.slice(start, index), end: index };
}

function readNameToken(text: string, start: number): { token: string; end: number } {
  let index = start + 1;
  while (index < text.length && !isWhitespace(text.charCodeAt(index)) && !isDelimiter(text.charCodeAt(index))) index += 1;
  return { token: text.slice(start, index), end: index };
}

function decodeName(token: string): string {
  let value = token.slice(1);
  const output: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "#" || index + 2 >= value.length) {
      output.push(character ?? "");
      continue;
    }
    const hex = value.slice(index + 1, index + 3);
    if (/^[0-9a-f]{2}$/iu.test(hex)) {
      output.push(String.fromCharCode(Number.parseInt(hex, 16)));
      index += 2;
    } else {
      output.push(character);
    }
  }
  return output.join("");
}

function encodeLiteralString(bytes: Uint8Array): string {
  let output = "(";
  for (const byte of bytes) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) output += `\\${String.fromCharCode(byte)}`;
    else if (byte === 0x0a) output += "\\n";
    else if (byte === 0x0d) output += "\\r";
    else if (byte === 0x09) output += "\\t";
    else if (byte === 0x08) output += "\\b";
    else if (byte === 0x0c) output += "\\f";
    else if (byte < 32 || byte > 126) output += `\\${byte.toString(8).padStart(3, "0")}`;
    else output += String.fromCharCode(byte);
  }
  return `${output})`;
}

function parseLiteralString(text: string, start: number): { value: PdfString; end: number } {
  const bytes: number[] = [];
  let depth = 1;
  let index = start + 1;
  while (index < text.length && depth > 0) {
    const code = text.charCodeAt(index);
    if (code === 92) {
      const escaped = text[index + 1];
      if (escaped === undefined) throw new Error("MALFORMED_PDF: unterminated string escape");
      const simple: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };
      if (escaped in simple) {
        bytes.push(simple[escaped] ?? 0);
        index += 2;
        continue;
      }
      if (escaped === "\n") {
        index += 2;
        continue;
      }
      if (escaped === "\r") {
        index += 2;
        if (text[index] === "\n") index += 1;
        continue;
      }
      if (/^[0-7]$/u.test(escaped)) {
        const octal = text.slice(index + 1, index + 4).match(/^[0-7]{1,3}/u)?.[0] ?? escaped;
        bytes.push(Number.parseInt(octal, 8));
        index += 1 + octal.length;
        continue;
      }
      bytes.push(text.charCodeAt(index + 1));
      index += 2;
      continue;
    }
    if (code === 40) depth += 1;
    if (code === 41) {
      depth -= 1;
      if (depth === 0) {
        index += 1;
        break;
      }
    }
    bytes.push(code & 0xff);
    index += 1;
  }
  if (depth !== 0) throw new Error("MALFORMED_PDF: unterminated literal string");
  return { value: { kind: "string", bytes: Uint8Array.from(bytes), hex: false }, end: index };
}

function parseHexString(text: string, start: number): { value: PdfString; end: number } {
  const close = text.indexOf(">", start + 1);
  if (close < 0) throw new Error("MALFORMED_PDF: unterminated hex string");
  const hex = text.slice(start + 1, close).replaceAll(/\s+/gu, "");
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/iu.test(hex)) throw new Error("MALFORMED_PDF: invalid hex string");
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return { value: { kind: "string", bytes, hex: true }, end: close + 1 };
}

function parseValue(text: string, start: number, bytes: Uint8Array, depth = 0): { value: PdfValue; end: number } {
  if (depth > MAX_VALUE_DEPTH) throw new Error("PDF_LIMIT: object nesting exceeds the local safety limit");
  const index = skipWhitespace(text, start);
  if (index >= text.length) throw new Error("MALFORMED_PDF: missing value");
  if (text.startsWith("<<", index)) return parseDictionary(text, index, bytes, depth);
  if (text[index] === "[") return parseArray(text, index, bytes, depth);
  if (text[index] === "(") return parseLiteralString(text, index);
  if (text[index] === "<") return parseHexString(text, index);
  if (text[index] === "/") {
    const token = readNameToken(text, index);
    return { value: { kind: "name", value: decodeName(token.token) }, end: token.end };
  }
  const token = readToken(text, index);
  if (token.token.length === 0) throw new Error("MALFORMED_PDF: invalid value delimiter");
  const first = Number(token.token);
  if (Number.isInteger(first) && first >= 0) {
    const secondStart = skipWhitespace(text, token.end);
    const second = readToken(text, secondStart);
    const secondNumber = Number(second.token);
    if (Number.isInteger(secondNumber) && secondNumber >= 0) {
      const thirdStart = skipWhitespace(text, second.end);
      const third = readToken(text, thirdStart);
      if (third.token === "R") return { value: { kind: "ref", id: first, generation: secondNumber }, end: third.end };
    }
  }
  return { value: { kind: "literal", value: token.token }, end: token.end };
}

function parseArray(text: string, start: number, bytes: Uint8Array, depth = 0): { value: PdfArray; end: number } {
  const items: PdfValue[] = [];
  let index = skipWhitespace(text, start + 1);
  while (index < text.length && text[index] !== "]") {
    if (items.length >= MAX_COLLECTION_ITEMS) throw new Error("PDF_LIMIT: array item count exceeds the local safety limit");
    const parsed = parseValue(text, index, bytes, depth + 1);
    items.push(parsed.value);
    index = skipWhitespace(text, parsed.end);
  }
  if (text[index] !== "]") throw new Error("MALFORMED_PDF: unterminated array");
  return { value: { kind: "array", items }, end: index + 1 };
}

function parseDictionary(text: string, start: number, bytes: Uint8Array, depth = 0): { value: PdfDictionary | PdfStream; end: number } {
  const entries = new Map<string, PdfValue>();
  let index = skipWhitespace(text, start + 2);
  while (index < text.length && !text.startsWith(">>", index)) {
    if (entries.size >= MAX_COLLECTION_ITEMS) throw new Error("PDF_LIMIT: dictionary entry count exceeds the local safety limit");
    if (text[index] !== "/") throw new Error("MALFORMED_PDF: dictionary key is not a name");
    const keyToken = readNameToken(text, index);
    const key = decodeName(keyToken.token);
    const parsed = parseValue(text, keyToken.end, bytes, depth + 1);
    entries.set(key, parsed.value);
    index = skipWhitespace(text, parsed.end);
  }
  if (!text.startsWith(">>", index)) throw new Error("MALFORMED_PDF: unterminated dictionary");
  index = skipWhitespace(text, index + 2);
  if (!text.startsWith("stream", index)) return { value: { kind: "dict", entries }, end: index };
  index += "stream".length;
  if (text[index] === "\r") index += 1;
  if (text[index] === "\n") index += 1;
  const lengthValue = entries.get("Length");
  const directLength = lengthValue?.kind === "literal" ? Number(lengthValue.value) : Number.NaN;
  const endstream = text.indexOf("endstream", index);
  if (endstream < 0) throw new Error("MALFORMED_PDF: unterminated stream");
  const end = Number.isInteger(directLength) && directLength >= 0 && index + directLength <= bytes.length
    ? index + directLength
    : endstream;
  const streamBytes = bytes.slice(index, Math.min(end, bytes.length));
  const after = text.indexOf("endobj", end);
  if (after < 0) throw new Error("MALFORMED_PDF: stream object has no endobj");
  return { value: { kind: "stream", dictionary: { kind: "dict", entries }, bytes: streamBytes }, end: after + "endobj".length };
}

function findObjectEnd(text: string, valueEnd: number): number {
  const end = text.indexOf("endobj", valueEnd);
  if (end < 0) throw new Error("MALFORMED_PDF: object has no endobj");
  return end + "endobj".length;
}

function findTrailer(text: string, objects: ReadonlyMap<number, PdfObject>): PdfDictionary {
  const start = text.lastIndexOf("trailer");
  if (start >= 0) {
    const parsed = parseValue(text, start + "trailer".length, new Uint8Array());
    if (parsed.value.kind === "dict") return parsed.value;
  }
  for (const object of objects.values()) {
    if (object.value.kind === "stream" && nameValue(object.value.dictionary.entries.get("Type")) === "XRef") return object.value.dictionary;
  }
  throw new Error("UNSUPPORTED_CAPABILITY: PDF uses an unsupported cross-reference or object-stream layout");
}

function asReference(value: PdfValue | undefined): PdfReference | null {
  return value?.kind === "ref" ? value : null;
}

function isPageDictionary(value: PdfValue): boolean {
  if (value.kind !== "dict") return false;
  const type = value.entries.get("Type");
  return type?.kind === "name" && type.value === "Page";
}

function collectPages(
  document: PdfDocumentModel,
  value: PdfValue,
  inherited: Readonly<Record<string, PdfValue>>,
  active: Set<number>,
  output: PdfPageNode[],
): void {
  if (output.length > PDF_LIMITS.maxPages) throw new Error("PDF_LIMIT: page count exceeds the local safety limit");
  if (value.kind === "ref") {
    if (active.has(value.id)) throw new Error("MALFORMED_PDF: cyclic page tree");
    const object = document.objects.get(value.id);
    if (object === undefined) throw new Error("MALFORMED_PDF: page reference is missing");
    active.add(value.id);
    collectPages(document, object.value, inherited, active, output);
    active.delete(value.id);
    return;
  }
  if (value.kind !== "dict") return;
  const nextInherited: Record<string, PdfValue> = { ...inherited };
  for (const key of ["Resources", "MediaBox", "CropBox", "Rotate"]) {
    const entry = value.entries.get(key);
    if (entry !== undefined) nextInherited[key] = entry;
  }
  if (isPageDictionary(value)) {
    const object = [...document.objects.values()].find((candidate) => candidate.value === value);
    if (object === undefined) throw new Error("MALFORMED_PDF: page object is not indexed");
    output.push({ object, inherited: { ...nextInherited } });
    return;
  }
  const kids = value.entries.get("Kids");
  if (kids?.kind !== "array") return;
  for (const kid of kids.items) collectPages(document, kid, nextInherited, active, output);
}

function hasFlateFilter(dictionary: PdfDictionary): boolean {
  const filter = dictionary.entries.get("Filter");
  if (filter?.kind === "name") return filter.value === "FlateDecode";
  return filter?.kind === "array" && filter.items.some((item) => item.kind === "name" && item.value === "FlateDecode");
}

function expandObjectStreams(objects: Map<number, PdfObject>): void {
  const streams = [...objects.values()].filter((object) => object.value.kind === "stream" && nameValue(object.value.dictionary.entries.get("Type")) === "ObjStm");
  for (const object of streams) {
    if (object.value.kind !== "stream") continue;
    if (!hasFlateFilter(object.value.dictionary)) throw new Error("UNSUPPORTED_CAPABILITY: PDF object stream uses an unsupported filter");
    const inflated = inflatePdfStream(object.value.bytes);
    const text = new TextDecoder("latin1").decode(inflated);
    const countValue = object.value.dictionary.entries.get("N");
    const firstValue = object.value.dictionary.entries.get("First");
    const count = countValue?.kind === "literal" ? Number(countValue.value) : Number.NaN;
    const first = firstValue?.kind === "literal" ? Number(firstValue.value) : Number.NaN;
    if (!Number.isInteger(count) || count < 0 || count > PDF_LIMITS.maxObjects || !Number.isInteger(first) || first < 0 || first > inflated.length) throw new Error("PDF_LIMIT: object stream header exceeds the local safety limit");
    const header = text.slice(0, first);
    const pairs = [...header.matchAll(/(\d+)\s+(\d+)/gu)];
    if (pairs.length < count) throw new Error("MALFORMED_PDF: incomplete object stream header");
    for (let index = 0; index < count; index += 1) {
      const pair = pairs[index];
      if (pair === undefined) throw new Error("MALFORMED_PDF: missing object stream pair");
      const id = Number(pair[1]);
      const offset = Number(pair[2]);
      const nextPair = pairs[index + 1];
      const end = nextPair === undefined ? inflated.length : first + Number(nextPair[2]);
      const start = first + offset;
      if (!Number.isInteger(id) || id < 0 || !Number.isInteger(offset) || offset < 0 || start >= end || end > inflated.length) throw new Error("MALFORMED_PDF: invalid object stream entry");
      if (objects.size >= PDF_LIMITS.maxObjects) throw new Error("PDF_LIMIT: object count exceeds the local safety limit");
      if (objects.has(id)) continue;
      const parsed = parseValue(text, start, inflated);
      objects.set(id, { id, generation: 0, value: parsed.value });
    }
  }
}

export function parsePdf(bytes: Uint8Array): PdfDocumentModel {
  if (bytes.byteLength < 8) throw new Error("INVALID_INPUT: PDF is too small");
  if (bytes.byteLength > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: PDF exceeds the local byte limit");
  const text = new TextDecoder("latin1").decode(bytes);
  const header = text.slice(0, 1024).match(/%PDF-(\d+\.\d+)/u);
  if (header === null) throw new Error("INVALID_PDF_SIGNATURE: missing %PDF header");
  if (!text.slice(Math.max(0, bytes.byteLength - 2048)).includes("%%EOF")) throw new Error("MALFORMED_PDF: missing %%EOF marker");
  const objects = new Map<number, PdfObject>();
  const objectPattern = /(?:^|[\r\n])\s*(\d+)\s+(\d+)\s+obj\b/gu;
  let streamCount = 0;
  let cursor = 0;
  while (cursor < text.length) {
    objectPattern.lastIndex = cursor;
    const marker = objectPattern.exec(text);
    if (marker === null) break;
    const markerStart = marker.index ?? cursor;
    const headerMatch = marker[0].match(/(\d+)\s+(\d+)\s+obj\b/u);
    if (headerMatch === null) break;
    const id = Number(headerMatch[1]);
    const generation = Number(headerMatch[2]);
    const valueStart = markerStart + marker[0].lastIndexOf("obj") + 3;
    const parsed = parseValue(text, valueStart, bytes);
    if (parsed.value.kind === "stream") {
      streamCount += 1;
      if (streamCount > PDF_LIMITS.maxStreams) throw new Error("PDF_LIMIT: stream count exceeds the local safety limit");
    }
    const end = parsed.value.kind === "stream" ? parsed.end : findObjectEnd(text, parsed.end);
    if (objects.size >= PDF_LIMITS.maxObjects) throw new Error("PDF_LIMIT: object count exceeds the local safety limit");
    if (objects.has(id)) throw new Error("MALFORMED_PDF: duplicate object id");
    objects.set(id, { id, generation, value: parsed.value });
    cursor = end;
  }
  if (objects.size === 0) throw new Error("MALFORMED_PDF: no indirect objects found");
  expandObjectStreams(objects);
  const trailer = findTrailer(text, objects);
  const root = asReference(trailer.entries.get("Root"));
  const info = asReference(trailer.entries.get("Info"));
  const model: PdfDocumentModel = {
    bytes,
    text,
    version: header[1] ?? "1.7",
    objects,
    trailer,
    root,
    info,
    encrypted: trailer.entries.has("Encrypt") || /\/Encrypt\s+\d+\s+\d+\s+R/u.test(text.slice(Math.max(0, text.length - 8192))),
    linearized: /\/Linearized\b/u.test(text.slice(0, 4096)),
    pages: [],
  };
  const rootValue = root === null ? undefined : model.objects.get(root.id)?.value;
  const pagesValue = rootValue?.kind === "dict" ? rootValue.entries.get("Pages") : undefined;
  const pages: PdfPageNode[] = [];
  if (pagesValue !== undefined) collectPages(model, pagesValue, {}, new Set(), pages);
  if (pages.length === 0) {
    for (const object of model.objects.values()) {
      if (isPageDictionary(object.value)) pages.push({ object, inherited: {} });
      if (pages.length > PDF_LIMITS.maxPages) throw new Error("PDF_LIMIT: page count exceeds the local safety limit");
    }
  }
  if (pages.length > PDF_LIMITS.maxPages) throw new Error("PDF_LIMIT: page count exceeds the local safety limit");
  return { ...model, pages };
}

export function resolveValue(document: PdfDocumentModel, value: PdfValue, depth = 0): PdfValue {
  if (depth > 64) throw new Error("MALFORMED_PDF: reference nesting exceeds the local safety limit");
  if (value.kind !== "ref") return value;
  const object = document.objects.get(value.id);
  if (object === undefined) return value;
  return resolveValue(document, object.value, depth + 1);
}

export function resolveReference(document: PdfDocumentModel, value: PdfValue | undefined): PdfValue | undefined {
  return value === undefined ? undefined : resolveValue(document, value);
}

export function valueToText(value: PdfValue | undefined): string | null {
  const resolved = value;
  if (resolved === undefined) return null;
  if (resolved.kind === "string") {
    if (resolved.bytes.length >= 2 && resolved.bytes[0] === 0xfe && resolved.bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(resolved.bytes.subarray(2));
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(resolved.bytes).replaceAll("\u0000", "");
    } catch {
      return new TextDecoder("latin1").decode(resolved.bytes);
    }
  }
  if (resolved.kind === "name") return resolved.value;
  if (resolved.kind === "literal") return resolved.value;
  return null;
}

export function nameValue(value: PdfValue | undefined): string | null {
  return value?.kind === "name" ? value.value : null;
}

export function numberValue(value: PdfValue | undefined): number | null {
  if (value?.kind !== "literal") return null;
  const number = Number(value.value);
  return Number.isFinite(number) ? number : null;
}

export function dictionaryOrNull(document: PdfDocumentModel, value: PdfValue | undefined): PdfDictionary | null {
  const resolved = resolveReference(document, value);
  return resolved?.kind === "dict" ? resolved : null;
}

export function streamOrNull(document: PdfDocumentModel, value: PdfValue | undefined): PdfStream | null {
  const resolved = resolveReference(document, value);
  return resolved?.kind === "stream" ? resolved : null;
}

export function arrayOrNull(document: PdfDocumentModel, value: PdfValue | undefined): PdfArray | null {
  const resolved = resolveReference(document, value);
  return resolved?.kind === "array" ? resolved : null;
}

export function cloneValue(value: PdfValue): PdfValue {
  if (value.kind === "array") return { kind: "array", items: value.items.map(cloneValue) };
  if (value.kind === "dict") return { kind: "dict", entries: new Map([...value.entries].map(([key, entry]) => [key, cloneValue(entry)])) };
  if (value.kind === "stream") return { kind: "stream", dictionary: cloneValue(value.dictionary) as PdfDictionary, bytes: value.bytes.slice() };
  if (value.kind === "string") return { ...value, bytes: value.bytes.slice() };
  return value;
}

export function dictionaryWithoutKeys(dictionary: PdfDictionary, keys: readonly string[]): PdfDictionary {
  const entries = new Map(dictionary.entries);
  for (const key of keys) entries.delete(key);
  return { kind: "dict", entries };
}

export function dictionaryWith(dictionary: PdfDictionary, key: string, value: PdfValue): PdfDictionary {
  const entries = new Map(dictionary.entries);
  entries.set(key, value);
  return { kind: "dict", entries };
}

export function pdfName(value: string): PdfName {
  return { kind: "name", value };
}

export function pdfNumber(value: number): PdfLiteral {
  return { kind: "literal", value: String(value) };
}

export function pdfString(value: string): PdfString {
  return { kind: "string", bytes: new TextEncoder().encode(value), hex: false };
}

export function pdfArray(values: readonly PdfValue[]): PdfArray {
  return { kind: "array", items: [...values] };
}

export function pdfDict(entries: Readonly<Record<string, PdfValue>>): PdfDictionary {
  return { kind: "dict", entries: new Map(Object.entries(entries)) };
}

export function pdfReference(id: number, generation = 0): PdfReference {
  return { kind: "ref", id, generation };
}

export function streamBytes(value: PdfValue | undefined): Uint8Array {
  return value?.kind === "stream" ? value.bytes : new Uint8Array();
}

export function literalString(value: PdfString): string {
  return new TextDecoder("latin1").decode(value.bytes);
}

export { encodeLiteralString };

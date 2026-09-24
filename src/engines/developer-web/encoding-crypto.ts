import {
  MAX_DEVELOPER_INPUT,
  type DeveloperWebResult,
  assertInputSize,
  booleanField,
  invalid,
  optionalStringField,
  stringField,
} from "./types";

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function encodeBase64Bytes(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    output += BASE64_ALPHABET[first >> 2];
    output += BASE64_ALPHABET[((first & 3) << 4) | ((second ?? 0) >> 4)];
    output += second === undefined ? "=" : BASE64_ALPHABET[((second & 15) << 2) | ((third ?? 0) >> 6)];
    output += third === undefined ? "=" : BASE64_ALPHABET[third & 63];
  }
  return output;
}

export function decodeBase64Bytes(input: string, urlSafe = false): Uint8Array {
  assertInputSize(input);
  let normalized = input.replace(/[\t\n\r ]/gu, "");
  if (urlSafe) normalized = normalized.replaceAll("-", "+").replaceAll("_", "/");
  if (normalized === "") return new Uint8Array();
  if (/^=+$/u.test(normalized)) invalid("INVALID_BASE64", "Base64 input contains only padding.");
  const firstPadding = normalized.indexOf("=");
  if (firstPadding >= 0 && !/^={1,2}$/u.test(normalized.slice(firstPadding))) invalid("INVALID_BASE64", "Base64 input contains misplaced padding.");
  if (normalized.length % 4 === 1) invalid("INVALID_BASE64", "Base64 input has an invalid length.");
  normalized = normalized.replace(/=+$/u, "");
  if (/[^A-Za-z0-9+/]/u.test(normalized)) invalid("INVALID_BASE64", "Base64 input contains an invalid character.");
  normalized += "=".repeat((4 - (normalized.length % 4)) % 4);
  const output = new Uint8Array((normalized.length / 4) * 3);
  let outputIndex = 0;
  for (let index = 0; index < normalized.length; index += 4) {
    const first = BASE64_ALPHABET.indexOf(normalized[index]!);
    const second = BASE64_ALPHABET.indexOf(normalized[index + 1]!);
    const third = normalized[index + 2] === "=" ? 0 : BASE64_ALPHABET.indexOf(normalized[index + 2]!);
    const fourth = normalized[index + 3] === "=" ? 0 : BASE64_ALPHABET.indexOf(normalized[index + 3]!);
    if (first < 0 || second < 0 || third < 0 || fourth < 0) invalid("INVALID_BASE64", "Base64 input contains an invalid character.");
    output[outputIndex++] = (first << 2) | (second >> 4);
    if (normalized[index + 2] !== "=") output[outputIndex++] = ((second & 15) << 4) | (third >> 2);
    if (normalized[index + 3] !== "=") output[outputIndex++] = ((third & 3) << 6) | fourth;
  }
  return output.subarray(0, outputIndex);
}

export function encodeBase64Url(bytes: Uint8Array): string {
  return encodeBase64Bytes(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function decodeBase64Url(input: string): Uint8Array {
  return decodeBase64Bytes(input, true);
}

export function base64Operation(input: string, mode: string, urlSafe = false): DeveloperWebResult {
  if (mode === "encode" || mode === "to-base64") {
    const bytes = new TextEncoder().encode(input);
    return { valid: true, mode, value: urlSafe ? encodeBase64Url(bytes) : encodeBase64Bytes(bytes), byteLength: bytes.length } as DeveloperWebResult;
  }
  if (mode === "decode" || mode === "from-base64") {
    const bytes = decodeBase64Bytes(input, urlSafe);
    let value: string;
    try {
      value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      invalid("INVALID_UTF8_BASE64", "Decoded bytes are not valid UTF-8 text.");
    }
    return { valid: true, mode, value, byteLength: bytes.length, bytes: Array.from(bytes) } as DeveloperWebResult;
  }
  invalid("INVALID_MODE", "Base64 mode must be encode or decode.");
}

function percentEncodeByte(byte: number): string {
  return `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
}

function percentEncodeSet(input: string, set: "component" | "query" | "path" | "userinfo"): string {
  const bytes = new TextEncoder().encode(input);
  let output = "";
  for (const byte of bytes) {
    const unreserved = (byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a) || (byte >= 0x30 && byte <= 0x39) || byte === 0x2d || byte === 0x2e || byte === 0x5f || byte === 0x7e;
    const shouldEncode = set === "component"
      ? !unreserved
      : set === "query"
        ? !unreserved || byte === 0x20 || byte === 0x22 || byte === 0x23 || byte === 0x3c || byte === 0x3e
        : set === "path"
          ? !unreserved || byte === 0x20 || byte === 0x22 || byte === 0x23 || byte === 0x3c || byte === 0x3e || byte === 0x3f || byte === 0x5e || byte === 0x60 || byte === 0x7b || byte === 0x7d
          : !unreserved || byte === 0x20 || byte === 0x22 || byte === 0x23 || byte === 0x24 || byte === 0x26 || byte === 0x2b || byte === 0x2c || byte === 0x2f || byte === 0x3a || byte === 0x3b || byte === 0x3d || byte === 0x40 || byte === 0x5b || byte === 0x5c || byte === 0x5d || byte === 0x7c;
    output += shouldEncode ? percentEncodeByte(byte) : String.fromCharCode(byte);
  }
  return output;
}

function percentDecode(input: string): string {
  assertInputSize(input);
  let output = "";
  let index = 0;
  while (index < input.length) {
    if (input[index] !== "%" || !/^[0-9a-fA-F]{2}$/u.test(input.slice(index + 1, index + 3))) {
      output += input[index]!;
      index += 1;
      continue;
    }
    const bytes: number[] = [];
    let cursor = index;
    while (cursor < input.length && input[cursor] === "%" && /^[0-9a-fA-F]{2}$/u.test(input.slice(cursor + 1, cursor + 3))) {
      bytes.push(Number.parseInt(input.slice(cursor + 1, cursor + 3), 16));
      cursor += 3;
    }
    try {
      output += new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    } catch {
      invalid("INVALID_PERCENT_ENCODING", "Percent-encoded bytes are not valid UTF-8.");
    }
    index = cursor;
  }
  return output;
}

export function urlCodecOperation(input: string, mode: string, set = "component"): DeveloperWebResult {
  if (!(["component", "query", "path", "userinfo"] as const).includes(set as "component" | "query" | "path" | "userinfo")) invalid("INVALID_URL_SET", "URL encoding set must be component, query, path, or userinfo.");
  const value = mode === "decode" || mode === "from-encoded" ? percentDecode(input) : percentEncodeSet(input, set as "component" | "query" | "path" | "userinfo");
  return { valid: true, mode, set, value, roundTrip: mode === "decode" ? percentEncodeSet(value, set as "component" | "query" | "path" | "userinfo") === input : percentDecode(value) === input } as DeveloperWebResult;
}

const HTML_NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: "\"",
  nbsp: "\u00a0",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  laquo: "«",
  raquo: "»",
  eacute: "é",
  egrave: "è",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  szlig: "ß",
};

export function encodeHtmlEntities(input: string, numeric = false): string {
  assertInputSize(input);
  return input.replaceAll("&", numeric ? "&#38;" : "&amp;").replaceAll("<", numeric ? "&#60;" : "&lt;").replaceAll(">", numeric ? "&#62;" : "&gt;").replaceAll('"', numeric ? "&#34;" : "&quot;").replaceAll("'", numeric ? "&#39;" : "&#39;");
}

export function decodeHtmlEntities(input: string): string {
  assertInputSize(input);
  return input.replaceAll(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);?/giu, (full, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#")) {
      const codePoint = Number.parseInt(body.slice(body.startsWith("#x") ? 2 : 1), body.startsWith("#x") ? 16 : 10);
      if (!Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) invalid("INVALID_HTML_ENTITY", "HTML numeric entity is outside the Unicode range.");
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        invalid("INVALID_HTML_ENTITY", "HTML numeric entity cannot be represented.");
      }
    }
    return HTML_NAMED_ENTITIES[body.toLowerCase()] ?? full;
  });
}

export function htmlEntityOperation(input: string, mode: string, numeric = false): DeveloperWebResult {
  const value = mode === "decode" || mode === "from-entities" ? decodeHtmlEntities(input) : encodeHtmlEntities(input, numeric);
  return { valid: true, mode, value, warning: "Entity decoding is text conversion, not HTML sanitization." } as DeveloperWebResult;
}

export type DeveloperHashAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";

function normalizeHashAlgorithm(value: string | undefined): DeveloperHashAlgorithm {
  const normalized = (value ?? "SHA-256").toUpperCase();
  if (normalized === "SHA-256" || normalized === "SHA-384" || normalized === "SHA-512") return normalized;
  const compact = normalized.replace(/[^A-Z0-9]/gu, "");
  if (compact === "SHA256" || compact === "SHA384" || compact === "SHA512") return `SHA-${compact.slice(3)}` as DeveloperHashAlgorithm;
  if (compact === "HMACSHA256" || compact === "HMACSHA384" || compact === "HMACSHA512") return `SHA-${compact.slice(-3)}` as DeveloperHashAlgorithm;
  if (compact === "HS256" || compact === "HS384" || compact === "HS512") return `SHA-${compact.slice(2)}` as DeveloperHashAlgorithm;
  invalid("UNSUPPORTED_HASH", "Hash algorithm must be SHA-256, SHA-384, or SHA-512.");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashText(input: string, algorithm: DeveloperHashAlgorithm = "SHA-256", signal?: AbortSignal): Promise<string> {
  assertInputSize(input);
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  const digest = await globalThis.crypto.subtle.digest(algorithm, new TextEncoder().encode(input));
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  return bytesToHex(new Uint8Array(digest));
}

export async function hashGeneratorOperation(input: string, algorithm: string | undefined, signal?: AbortSignal): Promise<DeveloperWebResult> {
  const normalized = normalizeHashAlgorithm(algorithm);
  const digestHex = await hashText(input, normalized, signal);
  return { valid: true, algorithm: normalized, digestHex, byteLength: new TextEncoder().encode(input).length } as DeveloperWebResult;
}

function subtleKeyUsage(): KeyUsage[] {
  return ["sign"];
}

export function generateUuid(input: { version?: number; uppercase?: boolean; seed?: string; bytes?: readonly number[] } = {}): string {
  const result = generateUuids({ ...input, count: 1 }) as unknown as { uuids: string[] };
  return result.uuids[0]!;
}

export async function hmacText(message: string, key: string, algorithm: string | undefined, signal?: AbortSignal): Promise<{ algorithm: DeveloperHashAlgorithm; digestHex: string; digestBase64: string }> {
  const normalized = normalizeHashAlgorithm(algorithm);
  assertInputSize(message);
  assertInputSize(key);
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  const cryptoKey = await globalThis.crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: normalized }, false, subtleKeyUsage());
  const signature = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  const bytes = new Uint8Array(signature);
  return { algorithm: normalized, digestHex: bytesToHex(bytes), digestBase64: encodeBase64Bytes(bytes) };
}

export async function hmacOperation(message: string, key: string, algorithm: string | undefined, signal?: AbortSignal): Promise<DeveloperWebResult> {
  const result = await hmacText(message, key, algorithm, signal);
  return { valid: true, ...result, byteLength: new TextEncoder().encode(message).length } as DeveloperWebResult;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function formatUuid(bytes: Uint8Array, version: number, uppercase = false): string {
  const output = Uint8Array.from(bytes);
  output[6] = (output[6]! & 0x0f) | (version << 4);
  output[8] = (output[8]! & 0x3f) | 0x80;
  const hex = bytesToHex(output);
  const value = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return uppercase ? value.toUpperCase() : value;
}

function seededBytes(seed: string, length: number): Uint8Array {
  const output = new Uint8Array(length);
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.codePointAt(0) ?? 0;
    state = Math.imul(state, 16777619) >>> 0;
  }
  for (let index = 0; index < length; index += 1) {
    state ^= state >>> 13;
    state = Math.imul(state, 1274126177) >>> 0;
    output[index] = (state >>> 24) & 0xff;
  }
  return output;
}

export function generateUuids(input: { count?: number; version?: number; uppercase?: boolean; seed?: string; bytes?: readonly number[] } = {}): DeveloperWebResult {
  const count = input.count ?? 1;
  const version = input.version ?? 4;
  if (!Number.isSafeInteger(count) || count < 1 || count > 1_000) invalid("INVALID_UUID_COUNT", "UUID count must be an integer from 1 through 1000.");
  if (version !== 4 && version !== 7) invalid("INVALID_UUID_VERSION", "This local generator supports UUIDv4 and UUIDv7.");
  const uuids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    let bytes: Uint8Array;
    if (input.bytes !== undefined) {
      bytes = Uint8Array.from(input.bytes);
      if (bytes.length !== 16) invalid("INVALID_UUID_BYTES", "UUID bytes must contain exactly 16 values.");
    } else if (input.seed !== undefined) {
      bytes = seededBytes(`${input.seed}:${index}`, 16);
    } else {
      bytes = randomBytes(16);
    }
    if (version === 7) {
      const timestamp = BigInt(Date.now()) * 1_000_000n;
      for (let byteIndex = 0; byteIndex < 6; byteIndex += 1) bytes[byteIndex] = Number((timestamp >> BigInt((5 - byteIndex) * 8)) & 0xffn);
    }
    uuids.push(formatUuid(bytes, version, input.uppercase ?? false));
  }
  return { valid: true, version, count, uuids, randomness: input.seed === undefined && input.bytes === undefined ? "cryptographic" : "explicit-test-input", engineVersion: "developer-web-v1" } as DeveloperWebResult;
}

function validateRegexComplexity(pattern: string): void {
  if (pattern.length > 1_000) invalid("REGEX_TOO_LARGE", "Regular expression exceeds the 1,000-character local limit.");
  if (/\([^)]*[+*][^)]*\)[+*]/u.test(pattern) || /\([^)]*\{[^}]+\}[^)]*\)[+*]/u.test(pattern)) {
    invalid("REGEX_COMPLEXITY", "Nested unbounded quantifiers are rejected to avoid catastrophic backtracking.");
  }
}

export function regexTestOperation(pattern: string, flags: string, text: string, replacement?: string): DeveloperWebResult {
  assertInputSize(text, 100_000);
  validateRegexComplexity(pattern);
  if (!/^[dgimsuvy]*$/u.test(flags) || new Set(flags).size !== flags.length) invalid("INVALID_REGEX_FLAGS", "Regular expression flags are invalid or duplicated.");
  let expression: RegExp;
  try {
    expression = new RegExp(pattern, flags);
  } catch (error) {
    invalid("INVALID_REGEX", error instanceof Error ? error.message : "Invalid regular expression.");
  }
  const matches: Array<{ index: number; value: string; groups: Record<string, string | undefined> }> = [];
  const flagsWithGlobal = expression.flags.includes("g") ? expression.flags : `${expression.flags}g`;
  const matcher = new RegExp(expression.source, flagsWithGlobal);
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) {
    const groups: Record<string, string | undefined> = {};
    if (match.groups !== undefined) for (const [key, value] of Object.entries(match.groups)) groups[key] = value;
    matches.push({ index: match.index, value: match[0], groups });
    if (match[0] === "") matcher.lastIndex += 1;
    if (matches.length > 10_000) invalid("REGEX_TOO_MANY_MATCHES", "Regular expression returned too many matches.");
  }
  return { valid: true, pattern, flags, matches, matchCount: matches.length, replaced: replacement === undefined ? undefined : text.replace(expression, replacement), global: expression.flags.includes("g"), unicode: expression.flags.includes("u") } as DeveloperWebResult;
}

function base64UrlJson(part: string): unknown {
  const bytes = decodeBase64Url(part);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(text) as unknown;
}

export function inspectJwt(token: string): DeveloperWebResult {
  assertInputSize(token, 100_000);
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts.some((part, index) => index < 2 && part === "")) invalid("INVALID_JWT", "JWT compact serialization must contain three parts.");
  let header: unknown;
  let payload: unknown;
  try {
    header = base64UrlJson(parts[0]!);
    payload = base64UrlJson(parts[1]!);
  } catch (error) {
    invalid("INVALID_JWT", "JWT header and payload must be valid base64url-encoded JSON.");
  }
  if (typeof header !== "object" || header === null || Array.isArray(header)) invalid("INVALID_JWT", "JWT header must be a JSON object.");
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) invalid("INVALID_JWT", "JWT payload must be a JSON object.");
  const headerRecord = header as Record<string, unknown>;
  const payloadRecord = payload as Record<string, unknown>;
  const algorithm = typeof headerRecord.alg === "string" ? headerRecord.alg : "unknown";
  const signature = parts[2]!;
  const timestamps: Record<string, string> = {};
  for (const claim of ["exp", "nbf", "iat"]) {
    const value = payloadRecord[claim];
    if (typeof value === "number" && Number.isFinite(value)) timestamps[claim] = new Date(value * 1000).toISOString();
  }
  return {
    valid: true,
    header: headerRecord,
    payload: payloadRecord,
    signature,
    algorithm,
    unsecured: algorithm.toLowerCase() === "none" && signature === "",
    claimTimestamps: timestamps,
    warnings: [
      "Inspection does not verify a signature, issuer, audience, or trust decision.",
      ...(algorithm.toLowerCase() === "none" ? ["Unsecured JWT: the alg=none token is not integrity protected."] : []),
    ],
  } as DeveloperWebResult;
}

export function base64EncodeUtf8(input: string): string {
  return encodeBase64Bytes(new TextEncoder().encode(input));
}

export function base64DecodeUtf8(input: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64Bytes(input));
  } catch {
    invalid("INVALID_UTF8_BASE64", "Decoded bytes are not valid UTF-8 text.");
  }
}

export async function digestHex(input: string, algorithm: DeveloperHashAlgorithm = "SHA-256"): Promise<string> {
  return hashText(input, algorithm);
}

export async function verifyDigestHex(input: string, expectedHex: string, algorithm: DeveloperHashAlgorithm = "SHA-256"): Promise<boolean> {
  if (!/^[0-9a-f]+$/iu.test(expectedHex)) return false;
  return (await hashText(input, algorithm)) === expectedHex.toLowerCase();
}

export function encodingInput(input: Record<string, unknown>, modeKeys: readonly string[]): string {
  return stringField(input, ...modeKeys);
}

export function parseEncodingOptions(input: Record<string, unknown>): { mode: string; urlSafe: boolean; numeric: boolean; algorithm: string | undefined; set: string } {
  return {
    mode: optionalStringField(input, "mode", "operation") ?? "encode",
    urlSafe: booleanField(input, false, "urlSafe", "base64url"),
    numeric: booleanField(input, false, "numeric"),
    algorithm: optionalStringField(input, "algorithm", "hashAlgorithm", "hash"),
    set: optionalStringField(input, "set", "component", "encodingSet") ?? "component",
  };
}

export { MAX_DEVELOPER_INPUT };

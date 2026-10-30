import {
  MAX_DEVELOPER_INPUT,
  type DeveloperWebResult,
  assertInputSize,
  invalid,
} from "./types";
import { inspectImageHeader, type SupportedImageMime } from "../image/format";

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export const MAX_BASE64_FILE_BYTES = 512 * 1024;

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
  if (normalized === "") return new Uint8Array();
  if (urlSafe && /[+/]/u.test(normalized)) invalid("INVALID_BASE64_CHARACTER", "Base64url input must use '-' and '_' instead of '+' and '/'.");
  if (!urlSafe && /[-_]/u.test(normalized)) invalid("INVALID_BASE64_CHARACTER", "Standard Base64 input must use '+' and '/' instead of '-' and '_'.");
  if (/^=+$/u.test(normalized)) invalid("INVALID_BASE64_PADDING", "Base64 input contains only padding.");
  const firstPadding = normalized.indexOf("=");
  if (firstPadding >= 0 && !/^={1,2}$/u.test(normalized.slice(firstPadding))) invalid("INVALID_BASE64_PADDING", "Base64 input contains misplaced padding.");
  const suppliedPadding = firstPadding < 0 ? 0 : normalized.length - firstPadding;
  const significantLength = firstPadding < 0 ? normalized.length : firstPadding;
  if (significantLength % 4 === 1) invalid("INVALID_BASE64_LENGTH", "Base64 input has an impossible encoded length.");
  const requiredPadding = (4 - (significantLength % 4)) % 4;
  if (suppliedPadding > 0 && suppliedPadding !== requiredPadding) invalid("INVALID_BASE64_PADDING", `Base64 input needs ${requiredPadding} padding character${requiredPadding === 1 ? "" : "s"}, not ${suppliedPadding}.`);
  normalized = normalized.replace(/=+$/u, "");
  if (urlSafe) normalized = normalized.replaceAll("-", "+").replaceAll("_", "/");
  if (/[^A-Za-z0-9+/]/u.test(normalized)) invalid("INVALID_BASE64_CHARACTER", "Base64 input contains an invalid character.");
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
    return {
      valid: true,
      mode,
      inputKind: "utf-8-text",
      outputKind: "base64-text",
      alphabet: urlSafe ? "base64url" : "base64",
      paddingPolicy: urlSafe ? "encode-without-padding; decode-accepts-canonical-optional-padding" : "encode-with-padding; decode-accepts-canonical-optional-padding",
      value: urlSafe ? encodeBase64Url(bytes) : encodeBase64Bytes(bytes),
      byteLength: bytes.length,
    } as DeveloperWebResult;
  }
  if (mode === "decode" || mode === "from-base64") {
    const bytes = decodeBase64Bytes(input, urlSafe);
    let value: string;
    try {
      value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      invalid("INVALID_UTF8_BASE64", "Decoded bytes are not valid UTF-8 text.");
    }
    return {
      valid: true,
      mode,
      inputKind: "base64-text",
      outputKind: "utf-8-text",
      alphabet: urlSafe ? "base64url" : "base64",
      paddingPolicy: urlSafe ? "encode-without-padding; decode-accepts-canonical-optional-padding" : "encode-with-padding; decode-accepts-canonical-optional-padding",
      value,
      byteLength: bytes.length,
      bytes: Array.from(bytes),
    } as DeveloperWebResult;
  }
  invalid("INVALID_MODE", "Base64 mode must be encode or decode.");
}

export function base64FileOperation(input: Uint8Array | string, mode: "encode-bytes" | "decode-bytes", urlSafe = false): DeveloperWebResult {
  if (mode === "encode-bytes") {
    if (!(input instanceof Uint8Array)) invalid("INVALID_INPUT", "File-byte Base64 encoding requires a byte array.");
    if (input.byteLength > MAX_BASE64_FILE_BYTES) invalid("INPUT_TOO_LARGE", `Base64 file mode is limited to ${MAX_BASE64_FILE_BYTES} bytes.`);
    return {
      valid: true,
      mode,
      inputKind: "raw-bytes",
      outputKind: "base64-text",
      alphabet: urlSafe ? "base64url" : "base64",
      paddingPolicy: urlSafe ? "encode-without-padding; decode-accepts-canonical-optional-padding" : "encode-with-padding; decode-accepts-canonical-optional-padding",
      value: urlSafe ? encodeBase64Url(input) : encodeBase64Bytes(input),
      byteLength: input.byteLength,
    } as DeveloperWebResult;
  }
  if (typeof input !== "string") invalid("INVALID_INPUT", "Raw-byte Base64 decoding requires Base64 text.");
  const bytes = decodeBase64Bytes(input, urlSafe);
  if (bytes.byteLength > MAX_BASE64_FILE_BYTES) invalid("INPUT_TOO_LARGE", `Decoded Base64 file mode is limited to ${MAX_BASE64_FILE_BYTES} bytes.`);
  return {
    valid: true,
    mode,
    inputKind: "base64-text",
    outputKind: "raw-bytes",
    alphabet: urlSafe ? "base64url" : "base64",
    paddingPolicy: urlSafe ? "encode-without-padding; decode-accepts-canonical-optional-padding" : "encode-with-padding; decode-accepts-canonical-optional-padding",
    byteLength: bytes.byteLength,
    bytes: Array.from(bytes),
  } as DeveloperWebResult;
}

export type ImageBase64Envelope = "plain" | "data-url";

function imageExtension(mime: SupportedImageMime): "jpg" | "png" | "webp" {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

export function imageBase64Operation(
  input: Uint8Array | string,
  mode: "encode-image" | "decode-image",
  envelope: ImageBase64Envelope,
): DeveloperWebResult {
  if (mode === "encode-image") {
    if (!(input instanceof Uint8Array)) invalid("INVALID_INPUT", "Image Base64 encoding requires raw image bytes.");
    if (input.byteLength > MAX_BASE64_FILE_BYTES) invalid("INPUT_TOO_LARGE", `Image Base64 mode is limited to ${MAX_BASE64_FILE_BYTES} bytes.`);
    let header: ReturnType<typeof inspectImageHeader>;
    try {
      header = inspectImageHeader(input);
    } catch {
      invalid("INVALID_IMAGE_SIGNATURE", "Image bytes must contain a supported JPEG, PNG, or WebP signature and header.");
    }
    const base64 = encodeBase64Bytes(input);
    const value = envelope === "data-url" ? `data:${header.mime};base64,${base64}` : base64;
    return {
      valid: true,
      mode,
      envelope,
      mime: header.mime,
      width: header.width,
      height: header.height,
      extension: imageExtension(header.mime),
      inputKind: "image-bytes",
      outputKind: envelope === "data-url" ? "image-data-url" : "base64-text",
      value,
      byteLength: input.byteLength,
      encodedLength: value.length,
      signatureVerified: true,
    } as DeveloperWebResult;
  }

  if (typeof input !== "string") invalid("INVALID_INPUT", "Image Base64 decoding requires Base64 text or a data URL.");
  let encoded = input.trim();
  let declaredMime: string | null = null;
  if (envelope === "data-url") {
    const match = /^data:([^;,]+);base64,([\s\S]+)$/iu.exec(encoded);
    if (match === null) invalid("INVALID_IMAGE_DATA_URL", "Image data URL must use data:<mime>;base64,<payload>.");
    declaredMime = match[1]!.toLowerCase();
    encoded = match[2]!;
    if (declaredMime !== "image/jpeg" && declaredMime !== "image/png" && declaredMime !== "image/webp") {
      invalid("UNSUPPORTED_IMAGE_MIME", "Only JPEG, PNG, and WebP data URLs are supported.");
    }
  } else if (/^data:/iu.test(encoded)) {
    invalid("INVALID_IMAGE_ENVELOPE", "Choose data-URL mode when the input begins with data:.");
  }
  const bytes = decodeBase64Bytes(encoded, false);
  if (bytes.byteLength > MAX_BASE64_FILE_BYTES) invalid("INPUT_TOO_LARGE", `Decoded image Base64 mode is limited to ${MAX_BASE64_FILE_BYTES} bytes.`);
  let header: ReturnType<typeof inspectImageHeader>;
  try {
    header = inspectImageHeader(bytes);
  } catch {
    invalid("INVALID_IMAGE_SIGNATURE", "Decoded bytes do not contain a supported JPEG, PNG, or WebP image signature/header.");
  }
  if (declaredMime !== null && declaredMime !== header.mime) {
    invalid("IMAGE_MIME_MISMATCH", `Data URL declares ${declaredMime}, but decoded bytes are ${header.mime}.`);
  }
  return {
    valid: true,
    mode,
    envelope,
    mime: header.mime,
    width: header.width,
    height: header.height,
    extension: imageExtension(header.mime),
    inputKind: envelope === "data-url" ? "image-data-url" : "base64-text",
    outputKind: "image-bytes",
    byteLength: bytes.byteLength,
    bytes: Array.from(bytes),
    signatureVerified: true,
    declaredMime,
  } as DeveloperWebResult;
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

export { htmlEntityOperation } from "./html-entities";

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
      const timestamp = BigInt(Date.now());
      for (let byteIndex = 0; byteIndex < 6; byteIndex += 1) bytes[byteIndex] = Number((timestamp >> BigInt((5 - byteIndex) * 8)) & 0xffn);
    }
    uuids.push(formatUuid(bytes, version, input.uppercase ?? false));
  }
  return { valid: true, version, count, uuids, randomness: input.seed === undefined && input.bytes === undefined ? "cryptographic" : "explicit-test-input", engineVersion: "developer-web-v1" } as DeveloperWebResult;
}

export function assertRegexRequestBounds(pattern: string, text: string): void {
  assertInputSize(text, 100_000);
  if (pattern.length > 1_000) invalid("REGEX_TOO_LARGE", "Regular expression exceeds the 1,000-character local limit.");
}

function validateRegexComplexity(pattern: string): void {
  if (/\([^)]*[+*][^)]*\)[+*]/u.test(pattern) || /\([^)]*\{[^}]+\}[^)]*\)[+*]/u.test(pattern)) {
    invalid("REGEX_COMPLEXITY", "Nested unbounded quantifiers are rejected to avoid catastrophic backtracking.");
  }
}

export function regexTestOperation(pattern: string, flags: string, text: string, replacement?: string): DeveloperWebResult {
  assertRegexRequestBounds(pattern, text);
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

function jwtReferenceTime(value?: string | number): { iso: string; seconds: number } {
  const milliseconds = value === undefined || value === ""
    ? Date.now()
    : typeof value === "number"
      ? value
      : Date.parse(value);
  if (!Number.isFinite(milliseconds)) invalid("INVALID_JWT_REFERENCE_TIME", "JWT reference time must be an ISO date-time or epoch milliseconds.");
  return { iso: new Date(milliseconds).toISOString(), seconds: milliseconds / 1000 };
}

export function inspectJwt(token: string, referenceTime?: string | number): DeveloperWebResult {
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
  const claimIssues: Array<{ claim: "exp" | "nbf" | "iat"; issue: "NON_NUMERIC" | "NON_FINITE" }> = [];
  for (const claim of ["exp", "nbf", "iat"]) {
    const value = payloadRecord[claim];
    if (value === undefined) continue;
    if (typeof value !== "number") {
      claimIssues.push({ claim: claim as "exp" | "nbf" | "iat", issue: "NON_NUMERIC" });
      continue;
    }
    if (!Number.isFinite(value)) {
      claimIssues.push({ claim: claim as "exp" | "nbf" | "iat", issue: "NON_FINITE" });
      continue;
    }
    timestamps[claim] = new Date(value * 1000).toISOString();
  }
  const reference = jwtReferenceTime(referenceTime);
  const exp = typeof payloadRecord.exp === "number" && Number.isFinite(payloadRecord.exp) ? payloadRecord.exp : null;
  const nbf = typeof payloadRecord.nbf === "number" && Number.isFinite(payloadRecord.nbf) ? payloadRecord.nbf : null;
  const iat = typeof payloadRecord.iat === "number" && Number.isFinite(payloadRecord.iat) ? payloadRecord.iat : null;
  return {
    valid: true,
    header: headerRecord,
    payload: payloadRecord,
    signature,
    algorithm,
    unsecured: algorithm.toLowerCase() === "none" && signature === "",
    claimTimestamps: timestamps,
    temporal: {
      referenceTime: reference.iso,
      expired: exp === null ? null : reference.seconds >= exp,
      notYetValid: nbf === null ? null : reference.seconds < nbf,
      issuedInFuture: iat === null ? null : reference.seconds < iat,
      claimIssues,
    },
    warnings: [
      "L'analisi non verifica firma, emittente, destinatario né attendibilità del token.",
      ...(claimIssues.length === 0 ? [] : ["Una o più claim temporali non sono numeriche e non sono state interpretate come date."]),
      ...(algorithm.toLowerCase() === "none" ? ["JWT non protetto: il token con alg=none non garantisce l'integrità."] : []),
    ],
  } as DeveloperWebResult;
}

export { MAX_DEVELOPER_INPUT };

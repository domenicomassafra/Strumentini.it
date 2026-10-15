/**
 * Cryptography and cookie plumbing for the auth backend.
 *
 * Everything here is a pure function over WebCrypto plus the pure cookie
 * helpers, so it can be exercised in a plain Node process without a Worker.
 *
 * Storage format for a password:
 *   password_hash       = "pbkdf2-sha256$<base64url derived key>"
 *   password_salt       = "<base64url salt>"
 *   password_iterations = <integer>
 * The algorithm is prefixed to the stored hash so the parameters (algorithm,
 * iteration count, key length) can be raised later without a schema change:
 * a record carrying an unknown algorithm prefix simply fails verification.
 */
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const PASSWORD_ALGORITHM = "pbkdf2-sha256";
const PASSWORD_HASH_SEPARATOR = "$";

/**
 * PBKDF2-HMAC-SHA256 work factor, at the order of magnitude the current OWASP
 * guidance recommends for this algorithm. The value is stored per record, so
 * every existing credential keeps verifying and can be re-hashed on next login
 * (see `needsRehash`).
 *
 * Production Workers restricts WebCrypto PBKDF2 calls to 100k iterations.
 * Higher factors use the equivalent standard PBKDF2 implementation below;
 * the stored hash format and 600k work factor stay unchanged. This still
 * requires measuring CPU on the deployed Worker before enabling accounts.
 */
export const PASSWORD_ITERATIONS = 600_000;
export const PASSWORD_SALT_BYTES = 16;
export const PASSWORD_KEY_BITS = 256;
const MAX_NATIVE_WORKER_PBKDF2_ITERATIONS = 100_000;
const MAX_STORED_PASSWORD_ITERATIONS = 1_000_000;

export const SESSION_TOKEN_BYTES = 32;
export const SESSION_COOKIE_NAME = "su_session";
export const SESSION_TTL_SECONDS = 2_592_000;

const encoder = new TextEncoder();

/** One hour: how old `last_seen_at` must be before a read refreshes it. */
export const SESSION_LAST_SEEN_REFRESH_MS = 3_600_000;

export interface PasswordRecord {
  readonly algorithm: string;
  readonly iterations: number;
  readonly salt: string;
  readonly hash: string;
}

export interface StoredPassword {
  readonly hash: string;
  readonly salt: string;
  readonly iterations: number;
}

/** Internal-only KDF backend. The HTTP Worker must not perform 600k CPU work. */
export type PasswordDeriver = (
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) => Promise<Uint8Array>;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/u.test(value)) return null;
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Length-independent-time comparison of two byte strings. */
export function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(iterations) || iterations <= 0 || iterations > MAX_STORED_PASSWORD_ITERATIONS) {
    throw new Error("Unsupported password iteration factor");
  }
  // The real Cloudflare edge throws for native PBKDF2 iterations >100,000,
  // unlike Node and local workerd. The audited MIT noble implementation
  // computes exactly the same RFC 8018 PBKDF2-HMAC-SHA256 bytes as WebCrypto;
  // it is not six serial PBKDF2 calls and it does not reduce the work factor.
  // Yield periodically so a single real authentication does not monopolize
  // the event loop while other requests are waiting. This does NOT reduce
  // billed CPU; launch still requires provider CPU budget review.
  if (iterations > MAX_NATIVE_WORKER_PBKDF2_ITERATIONS) {
    return await pbkdf2Async(sha256, encoder.encode(password), salt, {
      c: iterations,
      dkLen: PASSWORD_KEY_BITS / 8,
      asyncTick: 3,
    });
  }
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    PASSWORD_KEY_BITS,
  );
  return new Uint8Array(bits);
}

/** Hashes a password with a fresh random salt. */
export async function hashPassword(
  password: string,
  iterations = PASSWORD_ITERATIONS,
  derive: PasswordDeriver = deriveKey,
): Promise<StoredPassword> {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const key = await derive(password, salt, iterations);
  if (key.length !== PASSWORD_KEY_BITS / 8) throw new Error("Invalid KDF result length");
  return {
    hash: `${PASSWORD_ALGORITHM}${PASSWORD_HASH_SEPARATOR}${toBase64Url(key)}`,
    salt: toBase64Url(salt),
    iterations,
  };
}

/**
 * True when a stored credential was hashed with a weaker work factor than the
 * current one. Its caller re-hashes after a successful verification, so raising
 * `PASSWORD_ITERATIONS` migrates an account on the next sign-in instead of
 * locking anyone out.
 */
export function needsRehash(stored: StoredPassword): boolean {
  const record = parseStoredPassword(stored);
  if (record === null || record.algorithm !== PASSWORD_ALGORITHM) return false;
  return record.iterations < PASSWORD_ITERATIONS;
}

/** Rebuilds the structured record from the three stored columns. */
export function parseStoredPassword(stored: StoredPassword): PasswordRecord | null {
  const separator = stored.hash.indexOf(PASSWORD_HASH_SEPARATOR);
  if (separator <= 0) return null;
  const algorithm = stored.hash.slice(0, separator);
  const hash = stored.hash.slice(separator + 1);
  if (!Number.isSafeInteger(stored.iterations) || stored.iterations <= 0 || stored.iterations > MAX_STORED_PASSWORD_ITERATIONS) return null;
  if (hash === "" || stored.salt === "") return null;
  return { algorithm, iterations: stored.iterations, salt: stored.salt, hash };
}

/**
 * Verifies a candidate password against a stored record. Unknown algorithms
 * and malformed records fail closed (returns `false`), never throw.
 */
export async function verifyPassword(
  password: string,
  stored: StoredPassword,
  derive: PasswordDeriver = deriveKey,
): Promise<boolean> {
  const record = parseStoredPassword(stored);
  if (record === null || record.algorithm !== PASSWORD_ALGORITHM) return false;
  const salt = fromBase64Url(record.salt);
  const expected = fromBase64Url(record.hash);
  if (salt === null || expected === null) return false;
  try {
    const actual = await derive(password, salt, record.iterations);
    return timingSafeEqual(actual, expected);
  } catch (error) {
    // A remote backend outage is NOT an invalid password. Propagate so no
    // account can be locked out or issued a session on an infrastructure error.
    if (derive !== deriveKey) throw error;
    return false;
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

export interface SessionToken {
  /** Raw token: goes into the cookie only. */
  readonly token: string;
  /** SHA-256 hex digest: the only form written to D1. */
  readonly tokenHash: string;
}

export async function createSessionToken(): Promise<SessionToken> {
  const token = toBase64Url(randomBytes(SESSION_TOKEN_BYTES));
  return { token, tokenHash: await sha256Hex(token) };
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

export function sessionExpiryIso(now: Date = new Date()): string {
  return new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
}

export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) return true;
  return expires <= now.getTime();
}

/** Naive but sufficient cookie-header parser; first occurrence of a name wins. */
export function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (header === null) return cookies;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const raw = part.slice(separator + 1).trim();
    if (name === "" || cookies.has(name)) continue;
    const value = raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2 ? raw.slice(1, -1) : raw;
    cookies.set(name, value);
  }
  return cookies;
}

function cookieAttributes(): string {
  return `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${String(SESSION_TTL_SECONDS)}`;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; ${cookieAttributes()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readSessionToken(request: Request): string | null {
  const token = parseCookies(request.headers.get("cookie")).get(SESSION_COOKIE_NAME);
  return token === undefined || token === "" ? null : token;
}

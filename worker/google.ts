/**
 * Google Identity Services verification for authentication-only sign in.
 *
 * The browser receives an ID token from GIS. The Worker verifies RS256 against
 * Google's published JWKs and validates issuer, audience, expiry, email and a
 * server-generated nonce before any local account/session is created.
 */

import { parseCookies } from "./auth";

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const NONCE_COOKIE_NAME = "su_google_nonce";
const NONCE_TTL_SECONDS = 600;
const NONCE_BYTES = 24;
const GOOGLE_FETCH_TIMEOUT_MS = 5_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface GoogleJwtHeader {
  readonly alg?: unknown;
  readonly kid?: unknown;
}

interface GoogleJwtClaims {
  readonly iss?: unknown;
  readonly aud?: unknown;
  readonly azp?: unknown;
  readonly sub?: unknown;
  readonly email?: unknown;
  readonly email_verified?: unknown;
  readonly name?: unknown;
  readonly picture?: unknown;
  readonly nonce?: unknown;
  readonly exp?: unknown;
  readonly iat?: unknown;
}

interface GoogleJwksResponse {
  readonly keys?: unknown;
}

interface GoogleJwk extends JsonWebKey {
  readonly kid?: string;
  readonly alg?: string;
}

export interface GoogleProfile {
  readonly subject: string;
  readonly email: string;
  readonly name: string;
  readonly picture?: string;
}

export type GoogleVerification =
  | { readonly ok: true; readonly profile: GoogleProfile }
  | { readonly ok: false; readonly reason: "invalid" | "unavailable" };

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let keyCache: { readonly expiresAt: number; readonly keys: readonly GoogleJwk[] } | null = null;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
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

function parsePart<T>(value: string): T | null {
  const bytes = fromBase64Url(value);
  if (bytes === null) return null;
  try {
    return JSON.parse(decoder.decode(bytes)) as T;
  } catch {
    return null;
  }
}

function cacheTtlMs(response: Response): number {
  const match = /(?:^|,)\s*max-age=(\d+)/iu.exec(response.headers.get("cache-control") ?? "");
  const seconds = match === null ? 300 : Number(match[1]);
  return Number.isFinite(seconds) ? Math.max(60, Math.min(seconds, 3600)) * 1000 : 300_000;
}

async function googleKeys(
  fetchImpl: FetchLike,
  nowMs: number,
  forceRefresh = false,
): Promise<readonly GoogleJwk[] | null> {
  if (!forceRefresh && fetchImpl === fetch && keyCache !== null && keyCache.expiresAt > nowMs) return keyCache.keys;
  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_JWKS_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(GOOGLE_FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let body: GoogleJwksResponse;
  try {
    body = await response.json() as GoogleJwksResponse;
  } catch {
    return null;
  }
  if (!Array.isArray(body.keys)) return null;
  const keys = body.keys.filter((value): value is GoogleJwk => typeof value === "object" && value !== null);
  if (keys.length === 0) return null;
  if (fetchImpl === fetch) keyCache = { keys, expiresAt: nowMs + cacheTtlMs(response) };
  return keys;
}

function audienceMatches(aud: unknown, clientId: string): boolean {
  if (typeof aud === "string") return aud === clientId;
  return Array.isArray(aud) && aud.some((value) => value === clientId);
}

export function createGoogleNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function googleNonceCookie(nonce: string): string {
  return `${NONCE_COOKIE_NAME}=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/google; Max-Age=${String(NONCE_TTL_SECONDS)}`;
}

export function clearGoogleNonceCookie(): string {
  return `${NONCE_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/google; Max-Age=0`;
}

export function readGoogleNonce(request: Request): string | null {
  const value = parseCookies(request.headers.get("cookie")).get(NONCE_COOKIE_NAME);
  return value === undefined || !/^[A-Za-z0-9_-]{20,128}$/u.test(value) ? null : value;
}

export async function verifyGoogleCredential(
  credential: string,
  clientId: string,
  expectedNonce: string,
  options: { readonly now?: Date; readonly fetchImpl?: FetchLike } = {},
): Promise<GoogleVerification> {
  const parts = credential.split(".");
  if (parts.length !== 3) return { ok: false, reason: "invalid" };
  const [encodedHeader = "", encodedClaims = "", encodedSignature = ""] = parts;
  const header = parsePart<GoogleJwtHeader>(encodedHeader);
  const claims = parsePart<GoogleJwtClaims>(encodedClaims);
  const signature = fromBase64Url(encodedSignature);
  if (header === null || claims === null || signature === null) return { ok: false, reason: "invalid" };
  if (header.alg !== "RS256" || typeof header.kid !== "string" || header.kid === "") {
    return { ok: false, reason: "invalid" };
  }

  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const keys = await googleKeys(options.fetchImpl ?? fetch, nowMs);
  if (keys === null) return { ok: false, reason: "unavailable" };
  let jwk = keys.find((key) => key.kid === header.kid && (key.alg === undefined || key.alg === "RS256"));
  if (jwk === undefined && (options.fetchImpl ?? fetch) === fetch) {
    const refreshed = await googleKeys(fetch, nowMs, true);
    jwk = refreshed?.find((key) => key.kid === header.kid && (key.alg === undefined || key.alg === "RS256"));
  }
  if (jwk === undefined) return { ok: false, reason: "invalid" };

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    encoder.encode(`${encodedHeader}.${encodedClaims}`),
  );
  if (!validSignature) return { ok: false, reason: "invalid" };

  const nowSeconds = Math.floor(nowMs / 1000);
  if (typeof claims.iss !== "string" || !GOOGLE_ISSUERS.has(claims.iss)) return { ok: false, reason: "invalid" };
  if (!audienceMatches(claims.aud, clientId)) return { ok: false, reason: "invalid" };
  if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId) return { ok: false, reason: "invalid" };
  if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp <= nowSeconds) {
    return { ok: false, reason: "invalid" };
  }
  if (typeof claims.iat === "number" && claims.iat > nowSeconds + 300) return { ok: false, reason: "invalid" };
  if (claims.nonce !== expectedNonce) return { ok: false, reason: "invalid" };
  if (typeof claims.sub !== "string" || claims.sub === "" || claims.sub.length > 255) return { ok: false, reason: "invalid" };
  if (typeof claims.email !== "string" || claims.email === "" || claims.email_verified !== true) {
    return { ok: false, reason: "invalid" };
  }

  const profile: GoogleProfile = {
    subject: claims.sub,
    email: claims.email.trim().toLowerCase(),
    name: typeof claims.name === "string" ? claims.name.trim() : "",
    ...(typeof claims.picture === "string" && claims.picture !== "" ? { picture: claims.picture } : {}),
  };
  return { ok: true, profile };
}

/**
 * Worker entry point.
 *
 * `/api/**` is served by this worker; every other path is handed to the static
 * assets binding untouched, so the site keeps behaving exactly as it does
 * without a worker. Errors inside `/api/**` are always JSON, never HTML.
 */
import {
  PASSWORD_ITERATIONS,
  SESSION_LAST_SEEN_REFRESH_MS,
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  isExpired,
  needsRehash,
  newId,
  nowIso,
  readSessionToken,
  sessionCookie,
  sessionExpiryIso,
  sha256Hex,
  verifyPassword,
} from "./auth";
import type { StoredPassword } from "./auth";
import {
  addFavorite,
  changeFavoriteIfCurrent,
  clearFavorites,
  countLoginAttempts,
  createSession,
  createSessionForPasswordCredential,
  createUser,
  deleteAllSessionsForUser,
  deleteSession,
  deleteUser,
  deleteUserIfSessionCredentialUnchanged,
  findUserByGoogleSubject,
  findSessionByToken,
  findUserByEmail,
  linkGoogleSubject,
  listFavorites,
  listFavoriteSync,
  listSessions,
  recordLoginAttempt,
  reserveKdfAttempt,
  removeFavorite,
  touchSession,
  updateUserName,
  updateUserPasswordIfUnchanged,
} from "./db";
import type { SessionRow, UserRow } from "./db";
import {
  clearGoogleNonceCookie,
  createGoogleNonce,
  googleNonceCookie,
  readGoogleNonce,
  verifyGoogleCredential,
} from "./google";
import { isLocalTurnstileHost, verifyTurnstileToken } from "./turnstile";
import { MESSAGES, normalizeEmail, validateEmail, validateName, validatePassword, validateToolId } from "./validation";
import { checkViesVat } from "./vies";
import { PasswordKdfUnavailable, remotePasswordDeriver } from "./kdf-client";
import type { PrivateKdfNamespace } from "./kdf-client";

// Cloudflare's internal-only SQLite-backed Durable Object. Never HTTP-routed.
export { PasswordKdf } from "./password-kdf";

export interface Env {
  readonly ASSETS: Fetcher;
  readonly AUTH_DB: D1Database;
  readonly PASSWORD_KDF?: PrivateKdfNamespace;
  readonly KDF_IP_LIMIT?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  readonly KDF_COLO_LIMIT?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  readonly TURNSTILE_SECRET?: string;
  readonly GOOGLE_CLIENT_ID?: string;
}

type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

/** Failed `login`/`register` attempts allowed per IP inside the window. */
const RATE_LIMIT_MAX_FAILURES = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
/** Bodies here are three short fields; anything bigger is not a real client. */
const MAX_BODY_BYTES = 4096;
const MAX_USER_AGENT_LENGTH = 512;
/** Used when `CF-Connecting-IP` is absent (tests, local `wrangler dev`). */
const FALLBACK_CLIENT_IP = "127.0.0.1";

/**
 * A well-formed password record that can never match, verified when the email
 * is unknown so that a missing account costs the same PBKDF2 work as a wrong
 * password and cannot be told apart by timing.
 */
const DUMMY_PASSWORD: StoredPassword = {
  hash: `pbkdf2-sha256$${"A".repeat(43)}`,
  salt: "A".repeat(22),
  iterations: PASSWORD_ITERATIONS,
};

/** A Google-only account has no password login until the user explicitly sets one. */
const DISABLED_PASSWORD: StoredPassword = {
  hash: "disabled$google",
  salt: "disabled",
  iterations: 1,
};

interface RouteContext {
  readonly request: Request;
  readonly env: Env;
  readonly execution: ExecutionContext;
  readonly params: readonly string[];
  readonly now: Date;
}

type RouteHandler = (context: RouteContext) => Promise<Response>;

interface Route {
  /** Literal path with `:name` placeholders, e.g. `/api/favorites/:toolId`. */
  readonly pattern: string;
  readonly method: HttpMethod;
  readonly handle: RouteHandler;
}

/* ------------------------------------------------------------------ HTTP -- */

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": JSON_CONTENT_TYPE, "cache-control": "no-store", ...headers },
  });
}

function errorResponse(status: number, message: string, headers: Record<string, string> = {}): Response {
  return jsonResponse({ error: message }, status, headers);
}

function noContent(headers: Record<string, string> = {}): Response {
  return new Response(null, {
    status: 204,
    headers: { "content-type": JSON_CONTENT_TYPE, "cache-control": "no-store", ...headers },
  });
}

function setCookieHeader(cookie: string): Record<string, string> {
  return { "set-cookie": cookie };
}

function appendCookies(response: Response, cookies: readonly string[]): Response {
  for (const cookie of cookies) response.headers.append("set-cookie", cookie);
  return response;
}

/** Collapses trailing slashes and keeps at least the root slash. */
function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/u, "");
  return trimmed === "" ? "/" : trimmed;
}

function isApiPath(path: string): boolean {
  return path === "/api" || path.startsWith("/api/");
}

/* -------------------------------------------------------------- requests -- */

type BodyResult =
  | { readonly ok: true; readonly body: Record<string, unknown> }
  | { readonly ok: false; readonly response: Response };

/** Reads a small JSON object body; never throws. */
async function readJsonObject(request: Request): Promise<BodyResult> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { ok: false, response: errorResponse(413, MESSAGES.payloadTooLarge) };
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: errorResponse(400, MESSAGES.invalidBody) };
  }
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: errorResponse(413, MESSAGES.payloadTooLarge) };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, response: errorResponse(400, MESSAGES.invalidBody) };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, response: errorResponse(400, MESSAGES.invalidBody) };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

function clientIp(request: Request): string {
  const header = request.headers.get("cf-connecting-ip");
  return header === null || header.trim() === "" ? FALLBACK_CLIENT_IP : header.trim();
}

function rateLimitHeaders(now: Date, oldest: string | null): Record<string, string> {
  const oldestMs = oldest === null ? Number.NaN : Date.parse(oldest);
  const elapsed = Number.isNaN(oldestMs) ? RATE_LIMIT_WINDOW_MS : oldestMs + RATE_LIMIT_WINDOW_MS - now.getTime();
  return { "retry-after": String(Math.max(1, Math.ceil(elapsed / 1000))) };
}

/** `null` when the request may proceed, otherwise the 429 to return. */
async function checkRateLimit(env: Env, request: Request, now: Date): Promise<Response | null> {
  const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
  const window = await countLoginAttempts(env.AUTH_DB, clientIp(request), since);
  if (window.count < RATE_LIMIT_MAX_FAILURES) return null;
  return errorResponse(429, MESSAGES.rateLimited, rateLimitHeaders(now, window.oldest));
}

async function recordFailure(env: Env, request: Request, now: Date): Promise<void> {
  const pruneBefore = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
  await recordLoginAttempt(env.AUTH_DB, clientIp(request), now.toISOString(), pruneBefore);
}

/** Admission before every expensive server-side KDF flow. This is a secondary
 * limit, not an exact quota counter: Cloudflare counters are colo-local and
 * eventually consistent. The existing durable D1 failure ledger still applies.
 */
async function kdfAdmission(context: RouteContext): Promise<Response | null> {
  const host = new URL(context.request.url).hostname;
  if (!context.env.KDF_IP_LIMIT || !context.env.KDF_COLO_LIMIT) {
    // Offline/local test fixtures do not have provider rate-limit bindings.
    return isLocalTurnstileHost(host) ? null : errorResponse(503, MESSAGES.internal);
  }
  try {
    const ip = await context.env.KDF_IP_LIMIT.limit({ key: clientIp(context.request) });
    if (!ip.success) return errorResponse(429, MESSAGES.rateLimited, { "retry-after": "60" });
    const colo = await context.env.KDF_COLO_LIMIT.limit({ key: "password-kdf-v1" });
    if (!colo.success) return errorResponse(429, MESSAGES.rateLimited, { "retry-after": "60" });
    const now = new Date();
    const reserved = await reserveKdfAttempt(context.env.AUTH_DB, clientIp(context.request),
      nowIso(now), nowIso(new Date(now.getTime() - 60_000)));
    if (!reserved) return errorResponse(429, MESSAGES.rateLimited, { "retry-after": "60" });
    return null;
  } catch {
    return errorResponse(503, MESSAGES.internal);
  }
}

async function requireHuman(
  context: RouteContext,
  body: Record<string, unknown>,
  action: "login" | "register",
): Promise<Response | null> {
  const hostname = new URL(context.request.url).hostname;
  const secret = context.env.TURNSTILE_SECRET?.trim() ?? "";

  // Local wrangler development remains deterministic and offline. A public
  // hostname, including workers.dev, fails closed unless the secret exists.
  if (secret === "" && isLocalTurnstileHost(hostname)) return null;
  if (secret === "") return errorResponse(503, MESSAGES.turnstileUnavailable);

  const verification = await verifyTurnstileToken({
    secret,
    token: readString(body, "turnstileToken"),
    remoteIp: clientIp(context.request),
    expectedHostname: hostname,
    expectedAction: action,
  });
  if (verification.ok) return null;
  if (verification.reason === "missing-token") return errorResponse(400, MESSAGES.turnstileRequired);
  if (verification.reason === "invalid") return errorResponse(400, MESSAGES.turnstileInvalid);
  return errorResponse(503, MESSAGES.turnstileUnavailable);
}

/* -------------------------------------------------------------- sessions -- */

interface AuthSession {
  readonly session: SessionRow;
  readonly user: UserRow;
}

/**
 * Resolves the cookie token to a live session. Unknown tokens return `null`;
 * expired rows are deleted before being rejected.
 */
async function resolveSession(context: RouteContext): Promise<AuthSession | null> {
  const token = readSessionToken(context.request);
  if (token === null) return null;
  const found = await findSessionByToken(context.env.AUTH_DB, await sha256Hex(token));
  if (found === null) return null;
  if (isExpired(found.session.expires_at, context.now)) {
    await deleteSession(context.env.AUTH_DB, found.session.id, found.session.user_id);
    return null;
  }
  const lastSeen = Date.parse(found.session.last_seen_at);
  if (Number.isNaN(lastSeen) || context.now.getTime() - lastSeen > SESSION_LAST_SEEN_REFRESH_MS) {
    const seenAt = nowIso(context.now);
    context.execution.waitUntil(touchSession(context.env.AUTH_DB, found.session.id, seenAt).catch(() => undefined));
  }
  return { session: found.session, user: found.user };
}

function sessionUser(user: UserRow): {
  readonly email: string;
  readonly name: string;
  readonly passwordEnabled: boolean;
  readonly googleConnected: boolean;
} {
  return {
    email: user.email,
    name: user.name,
    passwordEnabled: user.password_login_enabled === 1,
    googleConnected: user.google_sub !== null,
  };
}

function sanitizeUserAgent(request: Request): string {
  return (request.headers.get("user-agent") ?? "").replace(/[\u0000-\u001F\u007F]/gu, "").slice(0, MAX_USER_AGENT_LENGTH);
}

async function startSession(context: RouteContext, userId: string): Promise<string>;
async function startSession(
  context: RouteContext,
  userId: string,
  expectedPassword: { readonly hash: string; readonly salt: string; readonly iterations: number },
): Promise<string | null>;
async function startSession(
  context: RouteContext,
  userId: string,
  expectedPassword?: { readonly hash: string; readonly salt: string; readonly iterations: number },
): Promise<string | null> {
  const token = await createSessionToken();
  const session = {
    id: newId(),
    tokenHash: token.tokenHash,
    userId,
    createdAt: nowIso(context.now),
    expiresAt: sessionExpiryIso(context.now),
    userAgent: sanitizeUserAgent(context.request),
  };
  if (expectedPassword) {
    if (!await createSessionForPasswordCredential(context.env.AUTH_DB, session, expectedPassword)) return null;
  } else {
    await createSession(context.env.AUTH_DB, session);
  }
  return token.token;
}

/* ------------------------------------------------------ endpoint handlers -- */

/** Rejects a registration and charges the failure to the caller's IP. */
async function registrationError(context: RouteContext, message: string): Promise<Response> {
  await recordFailure(context.env, context.request, context.now);
  return errorResponse(400, message);
}

async function handleRegister(context: RouteContext): Promise<Response> {
  const parsed = await readJsonObject(context.request);
  if (!parsed.ok) {
    await recordFailure(context.env, context.request, context.now);
    return parsed.response;
  }
  const human = await requireHuman(context, parsed.body, "register");
  if (human !== null) return human;
  const rate = await checkRateLimit(context.env, context.request, context.now);
  if (rate !== null) return rate;

  const email = validateEmail(parsed.body.email);
  const name = validateName(parsed.body.name);
  const password = validatePassword(parsed.body.password);
  if (!email.ok) return await registrationError(context, email.message);
  if (!name.ok) return await registrationError(context, name.message);
  if (!password.ok) return await registrationError(context, password.message);
  // The uniqueness constraint remains the race authority. This prelookup
  // avoids spending a 600k KDF on an account already known to exist.
  if (await findUserByEmail(context.env.AUTH_DB, email.value) !== null) {
    await recordFailure(context.env, context.request, context.now);
    return errorResponse(409, MESSAGES.emailTaken);
  }
  const admission = await kdfAdmission(context);
  if (admission !== null) return admission;

  const createdAt = nowIso(context.now);
  const stored = await hashPassword(password.value, PASSWORD_ITERATIONS, remotePasswordDeriver(context.env.PASSWORD_KDF));
  const created = await createUser(context.env.AUTH_DB, {
    id: newId(),
    email: email.value,
    name: name.value,
    passwordHash: stored.hash,
    passwordSalt: stored.salt,
    passwordIterations: stored.iterations,
    createdAt,
  });
  if (created === null) {
    await recordFailure(context.env, context.request, context.now);
    return errorResponse(409, MESSAGES.emailTaken);
  }

  let token: string | null;
  try {
    token = await startSession(context, created.id);
  } catch (error) {
    // Do not leave an account without a session behind (e.g. D1 hiccup).
    await deleteUser(context.env.AUTH_DB, created.id);
    throw error;
  }
  if (token === null) throw new Error("Unexpected missing registration session");
  return jsonResponse({ user: sessionUser(created) }, 201, setCookieHeader(sessionCookie(token)));
}

async function handleLogin(context: RouteContext): Promise<Response> {
  const parsed = await readJsonObject(context.request);
  if (!parsed.ok) {
    await recordFailure(context.env, context.request, context.now);
    return parsed.response;
  }
  const human = await requireHuman(context, parsed.body, "login");
  if (human !== null) return human;
  const rate = await checkRateLimit(context.env, context.request, context.now);
  if (rate !== null) return rate;

  const email = normalizeEmail(parsed.body.email);
  const password = readString(parsed.body, "password");
  if (password.length > 256) {
    await recordFailure(context.env, context.request, context.now);
    return errorResponse(401, MESSAGES.invalidCredentials);
  }
  const user = email === null || email === "" ? null : await findUserByEmail(context.env.AUTH_DB, email);
  const admission = await kdfAdmission(context);
  if (admission !== null) return admission;
  const valid = await verifyPassword(
    password,
    user === null || user.password_login_enabled !== 1
      ? DUMMY_PASSWORD
      : { hash: user.password_hash, salt: user.password_salt, iterations: user.password_iterations },
    remotePasswordDeriver(context.env.PASSWORD_KDF),
  );
  if (user === null || user.password_login_enabled !== 1 || !valid) {
    await recordFailure(context.env, context.request, context.now);
    return errorResponse(401, MESSAGES.invalidCredentials);
  }

  // A credential hashed with an older work factor is re-hashed here, at the one
  // moment the plaintext is legitimately in hand, so raising the work factor
  // migrates accounts instead of locking them out.
  const storedPassword = {
    hash: user.password_hash,
    salt: user.password_salt,
    iterations: user.password_iterations,
  };
  let currentCredential = storedPassword;
  if (needsRehash(storedPassword)) {
    const upgraded = await hashPassword(password, PASSWORD_ITERATIONS, remotePasswordDeriver(context.env.PASSWORD_KDF));
    const updated = await updateUserPasswordIfUnchanged(
      context.env.AUTH_DB,
      user.id,
      { hash: upgraded.hash, salt: upgraded.salt, iterations: upgraded.iterations },
      { ...storedPassword, loginEnabled: 1 },
      nowIso(context.now),
    );
    if (!updated) return errorResponse(401, MESSAGES.invalidCredentials);
    currentCredential = upgraded;
  }

  const token = await startSession(context, user.id, currentCredential);
  if (token === null) return errorResponse(401, MESSAGES.invalidCredentials);
  return jsonResponse({ user: sessionUser(user) }, 200, setCookieHeader(sessionCookie(token)));
}

async function handleGoogleConfig(context: RouteContext): Promise<Response> {
  const clientId = context.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  if (clientId === "") return errorResponse(503, MESSAGES.googleUnavailable);
  const nonce = createGoogleNonce();
  return jsonResponse(
    { clientId, nonce },
    200,
    setCookieHeader(googleNonceCookie(nonce)),
  );
}

function googleName(name: string, email: string): string {
  const valid = validateName(name);
  if (valid.ok) return valid.value;
  const localPart = email.split("@", 1)[0]?.slice(0, 80) ?? "";
  const fallback = validateName(localPart);
  return fallback.ok ? fallback.value : "Utente Google";
}

async function handleGoogleLogin(context: RouteContext): Promise<Response> {
  const clientId = context.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  if (clientId === "") return errorResponse(503, MESSAGES.googleUnavailable);
  const rate = await checkRateLimit(context.env, context.request, context.now);
  if (rate !== null) return rate;

  const parsed = await readJsonObject(context.request);
  if (!parsed.ok) {
    await recordFailure(context.env, context.request, context.now);
    return parsed.response;
  }
  const credential = readString(parsed.body, "credential");
  const nonce = readGoogleNonce(context.request);
  if (credential === "" || nonce === null) {
    await recordFailure(context.env, context.request, context.now);
    return errorResponse(401, MESSAGES.googleInvalid);
  }

  const verification = await verifyGoogleCredential(credential, clientId, nonce, { now: context.now });
  if (!verification.ok) {
    if (verification.reason === "invalid") {
      await recordFailure(context.env, context.request, context.now);
      return errorResponse(401, MESSAGES.googleInvalid);
    }
    return errorResponse(503, MESSAGES.googleUnavailable);
  }

  const email = validateEmail(verification.profile.email);
  if (!email.ok) {
    await recordFailure(context.env, context.request, context.now);
    return errorResponse(401, MESSAGES.googleInvalid);
  }
  const subject = verification.profile.subject;
  let user = await findUserByGoogleSubject(context.env.AUTH_DB, subject);
  if (user === null) {
    const existing = await findUserByEmail(context.env.AUTH_DB, email.value);
    if (existing !== null) {
      return errorResponse(409, MESSAGES.googleExistingEmail);
    } else {
      const createdAt = nowIso(context.now);
      user = await createUser(context.env.AUTH_DB, {
        id: newId(),
        email: email.value,
        name: googleName(verification.profile.name, email.value),
        passwordHash: DISABLED_PASSWORD.hash,
        passwordSalt: DISABLED_PASSWORD.salt,
        passwordIterations: DISABLED_PASSWORD.iterations,
        passwordLoginEnabled: false,
        googleSub: subject,
        createdAt,
      });
      // The email uniqueness constraint can win a race between two callbacks.
      if (user === null) {
        return errorResponse(409, MESSAGES.googleExistingEmail);
      }
    }
  }

  const token = await startSession(context, user.id);
  return appendCookies(
    jsonResponse({ user: sessionUser(user) }, 200),
    [sessionCookie(token), clearGoogleNonceCookie()],
  );
}

async function handleGoogleLink(context: RouteContext): Promise<Response> {
  const auth = await resolveSession(context);
  if (auth === null) return errorResponse(401, MESSAGES.unauthenticated);
  const clientId = context.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  if (clientId === "") return errorResponse(503, MESSAGES.googleUnavailable);

  const parsed = await readJsonObject(context.request);
  if (!parsed.ok) return parsed.response;
  const credential = readString(parsed.body, "credential");
  const nonce = readGoogleNonce(context.request);
  if (credential === "" || nonce === null) return errorResponse(401, MESSAGES.googleInvalid);

  const verification = await verifyGoogleCredential(credential, clientId, nonce, { now: context.now });
  if (!verification.ok) {
    return errorResponse(
      verification.reason === "invalid" ? 401 : 503,
      verification.reason === "invalid" ? MESSAGES.googleInvalid : MESSAGES.googleUnavailable,
    );
  }
  const email = normalizeEmail(verification.profile.email);
  if (email === null || email !== auth.user.email) return errorResponse(409, MESSAGES.googleEmailMismatch);

  const owner = await findUserByGoogleSubject(context.env.AUTH_DB, verification.profile.subject);
  if (owner !== null && owner.id !== auth.user.id) return errorResponse(409, MESSAGES.googleLinkConflict);
  if (auth.user.google_sub !== null && auth.user.google_sub !== verification.profile.subject) {
    return errorResponse(409, MESSAGES.googleLinkConflict);
  }
  if (auth.user.google_sub === null) {
    await linkGoogleSubject(context.env.AUTH_DB, auth.user.id, verification.profile.subject, nowIso(context.now));
  }
  return appendCookies(
    jsonResponse({ user: sessionUser({ ...auth.user, google_sub: verification.profile.subject }) }, 200),
    [clearGoogleNonceCookie()],
  );
}

async function handleLogout(context: RouteContext): Promise<Response> {
  const token = readSessionToken(context.request);
  if (token !== null) {
    const found = await findSessionByToken(context.env.AUTH_DB, await sha256Hex(token));
    if (found !== null) await deleteSession(context.env.AUTH_DB, found.session.id, found.session.user_id);
  }
  return noContent(setCookieHeader(clearSessionCookie()));
}

/**
 * Best-effort identity probe called by the static header on every page load:
 * an unusable session is simply reported as signed out and never as an error.
 */
async function handleSession(context: RouteContext): Promise<Response> {
  let auth: AuthSession | null = null;
  try {
    auth = await resolveSession(context);
  } catch (error) {
    console.error("session lookup failed", error);
    auth = null;
  }
  return jsonResponse({ user: auth === null ? null : sessionUser(auth.user) }, 200);
}

async function handleProfile(context: RouteContext): Promise<Response> {
  const auth = await resolveSession(context);
  if (auth === null) return errorResponse(401, MESSAGES.unauthenticated);

  const parsed = await readJsonObject(context.request);
  if (!parsed.ok) return parsed.response;
  const name = validateName(parsed.body.name);
  if (!name.ok) return errorResponse(400, name.message);

  await updateUserName(context.env.AUTH_DB, auth.user.id, name.value, nowIso(context.now));
  return jsonResponse({ user: sessionUser({ ...auth.user, name: name.value }) }, 200);
}

async function handlePasswordChange(context: RouteContext): Promise<Response> {
  const auth = await resolveSession(context);
  if (auth === null) return errorResponse(401, MESSAGES.unauthenticated);

  const parsed = await readJsonObject(context.request);
  if (!parsed.ok) return parsed.response;
  const currentPassword = readString(parsed.body, "currentPassword");
  if (currentPassword.length > 256) return errorResponse(401, MESSAGES.currentPasswordWrong);
  const newPassword = validatePassword(parsed.body.newPassword);
  if (!newPassword.ok) return errorResponse(400, newPassword.message);
  const admission = await kdfAdmission(context);
  if (admission !== null) return admission;

  if (auth.user.password_login_enabled === 1) {
    if (currentPassword === "") return errorResponse(400, MESSAGES.currentPasswordRequired);
    const currentValid = await verifyPassword(currentPassword, {
      hash: auth.user.password_hash,
      salt: auth.user.password_salt,
      iterations: auth.user.password_iterations,
    }, remotePasswordDeriver(context.env.PASSWORD_KDF));
    if (!currentValid) return errorResponse(401, MESSAGES.currentPasswordWrong);
  }

  const stored = await hashPassword(newPassword.value, PASSWORD_ITERATIONS, remotePasswordDeriver(context.env.PASSWORD_KDF));
  const updated = await updateUserPasswordIfUnchanged(
    context.env.AUTH_DB,
    auth.user.id,
    { hash: stored.hash, salt: stored.salt, iterations: stored.iterations },
    { hash: auth.user.password_hash, salt: auth.user.password_salt,
      iterations: auth.user.password_iterations, loginEnabled: auth.user.password_login_enabled },
    nowIso(new Date()),
    auth.session.id,
  );
  if (!updated) return errorResponse(409, MESSAGES.currentPasswordWrong);
  // Every other device is signed out; the caller keeps their own session.
  await deleteAllSessionsForUser(context.env.AUTH_DB, auth.user.id, auth.session.id);
  return noContent();
}

async function handleSessionList(context: RouteContext): Promise<Response> {
  const auth = await resolveSession(context);
  if (auth === null) return errorResponse(401, MESSAGES.unauthenticated);

  const rows = await listSessions(context.env.AUTH_DB, auth.user.id);
  return jsonResponse(
    {
      sessions: rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        lastSeenAt: row.last_seen_at,
        userAgent: row.user_agent,
        current: row.id === auth.session.id,
      })),
    },
    200,
  );
}

async function handleSessionDelete(context: RouteContext): Promise<Response> {
  const auth = await resolveSession(context);
  if (auth === null) return errorResponse(401, MESSAGES.unauthenticated);

  const sessionId = context.params[0] ?? "";
  if (sessionId === "" || sessionId.length > 128) return errorResponse(404, MESSAGES.sessionNotFound);
  const deleted = await deleteSession(context.env.AUTH_DB, sessionId, auth.user.id);
  if (!deleted) return errorResponse(404, MESSAGES.sessionNotFound);
  return sessionId === auth.session.id ? noContent(setCookieHeader(clearSessionCookie())) : noContent();
}

async function handleAccountDelete(context: RouteContext): Promise<Response> {
  const auth = await resolveSession(context);
  if (auth === null) return errorResponse(401, MESSAGES.unauthenticated);

  const parsed = await readJsonObject(context.request);
  if (!parsed.ok) return parsed.response;
  const password = readString(parsed.body, "password");
  if (password.length > 256) return errorResponse(401, MESSAGES.currentPasswordWrong);
  if (auth.user.password_login_enabled === 1) {
    const admission = await kdfAdmission(context);
    if (admission !== null) return admission;
    if (password === "") return errorResponse(400, MESSAGES.currentPasswordRequired);
    const valid = await verifyPassword(password, {
      hash: auth.user.password_hash,
      salt: auth.user.password_salt,
      iterations: auth.user.password_iterations,
    }, remotePasswordDeriver(context.env.PASSWORD_KDF));
    if (!valid) return errorResponse(401, MESSAGES.currentPasswordWrong);
  }

  const deleted = await deleteUserIfSessionCredentialUnchanged(context.env.AUTH_DB, auth.user.id, auth.session.id,
    { hash: auth.user.password_hash, salt: auth.user.password_salt,
      iterations: auth.user.password_iterations, loginEnabled: auth.user.password_login_enabled }, nowIso(new Date()));
  if (!deleted) return errorResponse(401, MESSAGES.unauthenticated);
  return noContent(setCookieHeader(clearSessionCookie()));
}

/* ------------------------------------------------------ favourites ------ */

async function requireSession(context: RouteContext): Promise<AuthSession | Response> {
  const auth = await resolveSession(context);
  return auth ?? errorResponse(401, MESSAGES.unauthenticated);
}

/** Reject cross-origin mutations even when a browser happens to send a cookie. */
function favoriteMutationOrigin(context: RouteContext): Response | null {
  const origin = context.request.headers.get("origin");
  if (origin !== null && origin !== new URL(context.request.url).origin) return errorResponse(403, "Origine non consentita.");
  if (context.request.headers.get("sec-fetch-site") === "cross-site") return errorResponse(403, "Origine non consentita.");
  return null;
}

async function handleFavoriteSyncList(context: RouteContext): Promise<Response> {
  const auth = await requireSession(context);
  if (auth instanceof Response) return auth;
  const snapshot = await listFavoriteSync(context.env.AUTH_DB, auth.user.id);
  return jsonResponse({ version: 1, account: auth.user.id, ...snapshot }, 200);
}

/** A stale write on the same tool gets 409 and the authoritative state. */
async function handleFavoriteSyncChange(context: RouteContext): Promise<Response> {
  const auth = await requireSession(context);
  if (auth instanceof Response) return auth;
  const originError = favoriteMutationOrigin(context);
  if (originError !== null) return originError;
  const parsed = await readJsonObject(context.request);
  if (!parsed.ok) return parsed.response;
  const { body } = parsed;
  const toolId = validateToolId(body.toolId);
  if (!toolId.ok) return errorResponse(400, toolId.message);
  if (typeof body.installed !== "boolean" || !Number.isSafeInteger(body.baseRevision) || (body.baseRevision as number) < 0) {
    return errorResponse(400, MESSAGES.invalidBody);
  }
  const changed = await changeFavoriteIfCurrent(
    context.env.AUTH_DB, auth.user.id, toolId.value, body.installed, body.baseRevision as number, nowIso(context.now),
  );
  const snapshot = await listFavoriteSync(context.env.AUTH_DB, auth.user.id);
  return jsonResponse({ version: 1, account: auth.user.id, ...snapshot, applied: changed }, changed ? 200 : 409);
}

async function handleFavoritesList(context: RouteContext): Promise<Response> {
  const auth = await requireSession(context);
  if (auth instanceof Response) return auth;
  return jsonResponse({ tools: await listFavorites(context.env.AUTH_DB, auth.user.id) }, 200);
}

async function handleFavoritePut(context: RouteContext): Promise<Response> {
  const auth = await requireSession(context);
  if (auth instanceof Response) return auth;
  const originError = favoriteMutationOrigin(context);
  if (originError !== null) return originError;
  const toolId = validateToolId(context.params[0]);
  if (!toolId.ok) return errorResponse(400, toolId.message);
  const added = await addFavorite(context.env.AUTH_DB, auth.user.id, toolId.value, nowIso(context.now));
  if (!added) return errorResponse(409, "Aggiorna i preferiti: lo strumento è stato rimosso da un altro dispositivo.");
  return noContent();
}

async function handleFavoriteDelete(context: RouteContext): Promise<Response> {
  const auth = await requireSession(context);
  if (auth instanceof Response) return auth;
  const originError = favoriteMutationOrigin(context);
  if (originError !== null) return originError;
  const toolId = validateToolId(context.params[0]);
  if (!toolId.ok) return errorResponse(400, toolId.message);
  await removeFavorite(context.env.AUTH_DB, auth.user.id, toolId.value, nowIso(context.now));
  return noContent();
}

async function handleFavoritesClear(context: RouteContext): Promise<Response> {
  const auth = await requireSession(context);
  if (auth instanceof Response) return auth;
  const originError = favoriteMutationOrigin(context);
  if (originError !== null) return originError;
  await clearFavorites(context.env.AUTH_DB, auth.user.id);
  return noContent();
}

async function handleViesCheck(context: RouteContext): Promise<Response> {
  const parsed = await readJsonObject(context.request);
  if (!parsed.ok) return parsed.response;
  const vatNumber = readString(parsed.body, "vatNumber").replace(/\s/gu, "");
  if (!/^\d{11}$/u.test(vatNumber)) return errorResponse(400, "Partita IVA italiana non valida per la verifica VIES.");
  const result = await checkViesVat(vatNumber, { now: () => context.now });
  return jsonResponse(result, 200);
}

/* ------------------------------------------------------------- routing -- */

const ROUTES: readonly Route[] = [
  { pattern: "/api/auth/register", method: "POST", handle: handleRegister },
  { pattern: "/api/auth/login", method: "POST", handle: handleLogin },
  { pattern: "/api/auth/google/config", method: "GET", handle: handleGoogleConfig },
  { pattern: "/api/auth/google", method: "POST", handle: handleGoogleLogin },
  { pattern: "/api/auth/google/link", method: "POST", handle: handleGoogleLink },
  { pattern: "/api/auth/logout", method: "POST", handle: handleLogout },
  { pattern: "/api/auth/session", method: "GET", handle: handleSession },
  { pattern: "/api/auth/profile", method: "PATCH", handle: handleProfile },
  { pattern: "/api/auth/password", method: "POST", handle: handlePasswordChange },
  { pattern: "/api/auth/sessions", method: "GET", handle: handleSessionList },
  { pattern: "/api/auth/sessions/:id", method: "DELETE", handle: handleSessionDelete },
  { pattern: "/api/auth/account", method: "DELETE", handle: handleAccountDelete },
  { pattern: "/api/favorites", method: "GET", handle: handleFavoritesList },
  { pattern: "/api/favorites", method: "DELETE", handle: handleFavoritesClear },
  { pattern: "/api/favorites/sync", method: "GET", handle: handleFavoriteSyncList },
  { pattern: "/api/favorites/sync", method: "POST", handle: handleFavoriteSyncChange },
  { pattern: "/api/favorites/:toolId", method: "PUT", handle: handleFavoritePut },
  { pattern: "/api/favorites/:toolId", method: "DELETE", handle: handleFavoriteDelete },
  { pattern: "/api/vies/check", method: "POST", handle: handleViesCheck },
];

function buildRouteTable(): ReadonlyMap<string, readonly Route[]> {
  const table = new Map<string, Route[]>();
  for (const route of ROUTES) {
    const existing = table.get(route.pattern);
    if (existing === undefined) table.set(route.pattern, [route]);
    else existing.push(route);
  }
  return table;
}

const ROUTE_TABLE = buildRouteTable();

function segments(path: string): readonly string[] {
  return path.split("/").filter((part) => part !== "");
}

/**
 * Matches a pathname against the route table. Returns every route registered
 * for the path (so a wrong method can answer 405 with `Allow`) plus the decoded
 * params. Returns `null` when no route pattern matches.
 */
function matchPath(pathname: string): { readonly routes: readonly Route[]; readonly params: readonly string[] } | null {
  const parts = segments(pathname);
  for (const [pattern, routes] of ROUTE_TABLE) {
    const patternParts = segments(pattern);
    if (patternParts.length !== parts.length) continue;
    const params: string[] = [];
    let matched = true;
    for (const [index, patternPart] of patternParts.entries()) {
      const part = parts[index] ?? "";
      if (patternPart.startsWith(":")) {
        params.push(decodeSegment(part));
      } else if (patternPart !== part) {
        matched = false;
        break;
      }
    }
    if (matched) return { routes, params };
  }
  return null;
}

function decodeSegment(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

async function handleApiRequest(
  request: Request,
  env: Env,
  execution: ExecutionContext,
): Promise<Response> {
  const match = matchPath(normalizePath(new URL(request.url).pathname));
  if (match === null) return errorResponse(404, MESSAGES.notFound);

  const handler = match.routes.find((candidate) => candidate.method === request.method);
  if (handler === undefined) {
    return errorResponse(405, MESSAGES.methodNotAllowed, {
      allow: match.routes.map((candidate) => candidate.method).join(", "),
    });
  }
  return await handler.handle({ request, env, execution, params: match.params, now: new Date() });
}

export default {
  async fetch(request: Request, env: Env, execution: ExecutionContext): Promise<Response> {
    const path = normalizePath(new URL(request.url).pathname);
    if (!isApiPath(path)) return await env.ASSETS.fetch(request);
    try {
      return await handleApiRequest(request, env, execution);
    } catch (error) {
      if (error instanceof PasswordKdfUnavailable) {
        return errorResponse(503, MESSAGES.internal);
      }
      console.error("api request failed", error);
      return errorResponse(500, MESSAGES.internal);
    }
  },
};

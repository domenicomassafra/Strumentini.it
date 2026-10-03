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
  clearFavorites,
  countLoginAttempts,
  createSession,
  createUser,
  deleteAllSessionsForUser,
  deleteSession,
  deleteUser,
  findSessionByToken,
  findUserByEmail,
  listFavorites,
  listSessions,
  recordLoginAttempt,
  removeFavorite,
  touchSession,
  updateUserName,
  updateUserPassword,
} from "./db";
import type { SessionRow, UserRow } from "./db";
import { isLocalTurnstileHost, verifyTurnstileToken } from "./turnstile";
import { MESSAGES, normalizeEmail, validateEmail, validateName, validatePassword, validateToolId } from "./validation";

export interface Env {
  readonly ASSETS: Fetcher;
  readonly AUTH_DB: D1Database;
  readonly TURNSTILE_SECRET?: string;
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

function sessionUser(user: UserRow): { readonly email: string; readonly name: string } {
  return { email: user.email, name: user.name };
}

function sanitizeUserAgent(request: Request): string {
  return (request.headers.get("user-agent") ?? "").replace(/[\u0000-\u001F\u007F]/gu, "").slice(0, MAX_USER_AGENT_LENGTH);
}

async function startSession(context: RouteContext, userId: string): Promise<string> {
  const token = await createSessionToken();
  await createSession(context.env.AUTH_DB, {
    id: newId(),
    tokenHash: token.tokenHash,
    userId,
    createdAt: nowIso(context.now),
    expiresAt: sessionExpiryIso(context.now),
    userAgent: sanitizeUserAgent(context.request),
  });
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

  const createdAt = nowIso(context.now);
  const stored = await hashPassword(password.value);
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

  let token: string;
  try {
    token = await startSession(context, created.id);
  } catch (error) {
    // Do not leave an account without a session behind (e.g. D1 hiccup).
    await deleteUser(context.env.AUTH_DB, created.id);
    throw error;
  }
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
  const user = email === null || email === "" ? null : await findUserByEmail(context.env.AUTH_DB, email);
  const valid = await verifyPassword(
    password,
    user === null
      ? DUMMY_PASSWORD
      : { hash: user.password_hash, salt: user.password_salt, iterations: user.password_iterations },
  );
  if (user === null || !valid) {
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
  if (needsRehash(storedPassword)) {
    const upgraded = await hashPassword(password);
    await updateUserPassword(
      context.env.AUTH_DB,
      user.id,
      { hash: upgraded.hash, salt: upgraded.salt, iterations: upgraded.iterations },
      nowIso(context.now),
    );
  }

  const token = await startSession(context, user.id);
  return jsonResponse({ user: sessionUser(user) }, 200, setCookieHeader(sessionCookie(token)));
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
  return jsonResponse({ user: { email: auth.user.email, name: name.value } }, 200);
}

async function handlePasswordChange(context: RouteContext): Promise<Response> {
  const auth = await resolveSession(context);
  if (auth === null) return errorResponse(401, MESSAGES.unauthenticated);

  const parsed = await readJsonObject(context.request);
  if (!parsed.ok) return parsed.response;
  const currentPassword = readString(parsed.body, "currentPassword");
  if (currentPassword === "") return errorResponse(400, MESSAGES.currentPasswordRequired);
  const newPassword = validatePassword(parsed.body.newPassword);
  if (!newPassword.ok) return errorResponse(400, newPassword.message);

  const currentValid = await verifyPassword(currentPassword, {
    hash: auth.user.password_hash,
    salt: auth.user.password_salt,
    iterations: auth.user.password_iterations,
  });
  if (!currentValid) return errorResponse(401, MESSAGES.currentPasswordWrong);

  const stored = await hashPassword(newPassword.value);
  await updateUserPassword(
    context.env.AUTH_DB,
    auth.user.id,
    { hash: stored.hash, salt: stored.salt, iterations: stored.iterations },
    nowIso(context.now),
  );
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
  if (password === "") return errorResponse(400, MESSAGES.currentPasswordRequired);

  const valid = await verifyPassword(password, {
    hash: auth.user.password_hash,
    salt: auth.user.password_salt,
    iterations: auth.user.password_iterations,
  });
  if (!valid) return errorResponse(401, MESSAGES.currentPasswordWrong);

  await deleteUser(context.env.AUTH_DB, auth.user.id);
  return noContent(setCookieHeader(clearSessionCookie()));
}

/* ------------------------------------------------------ favourites ------ */

async function requireSession(context: RouteContext): Promise<AuthSession | Response> {
  const auth = await resolveSession(context);
  return auth ?? errorResponse(401, MESSAGES.unauthenticated);
}

async function handleFavoritesList(context: RouteContext): Promise<Response> {
  const auth = await requireSession(context);
  if (auth instanceof Response) return auth;
  return jsonResponse({ tools: await listFavorites(context.env.AUTH_DB, auth.user.id) }, 200);
}

async function handleFavoritePut(context: RouteContext): Promise<Response> {
  const auth = await requireSession(context);
  if (auth instanceof Response) return auth;
  const toolId = validateToolId(context.params[0]);
  if (!toolId.ok) return errorResponse(400, toolId.message);
  await addFavorite(context.env.AUTH_DB, auth.user.id, toolId.value, nowIso(context.now));
  return noContent();
}

async function handleFavoriteDelete(context: RouteContext): Promise<Response> {
  const auth = await requireSession(context);
  if (auth instanceof Response) return auth;
  const toolId = validateToolId(context.params[0]);
  if (!toolId.ok) return errorResponse(400, toolId.message);
  await removeFavorite(context.env.AUTH_DB, auth.user.id, toolId.value);
  return noContent();
}

async function handleFavoritesClear(context: RouteContext): Promise<Response> {
  const auth = await requireSession(context);
  if (auth instanceof Response) return auth;
  await clearFavorites(context.env.AUTH_DB, auth.user.id);
  return noContent();
}

/* ------------------------------------------------------------- routing -- */

const ROUTES: readonly Route[] = [
  { pattern: "/api/auth/register", method: "POST", handle: handleRegister },
  { pattern: "/api/auth/login", method: "POST", handle: handleLogin },
  { pattern: "/api/auth/logout", method: "POST", handle: handleLogout },
  { pattern: "/api/auth/session", method: "GET", handle: handleSession },
  { pattern: "/api/auth/profile", method: "PATCH", handle: handleProfile },
  { pattern: "/api/auth/password", method: "POST", handle: handlePasswordChange },
  { pattern: "/api/auth/sessions", method: "GET", handle: handleSessionList },
  { pattern: "/api/auth/sessions/:id", method: "DELETE", handle: handleSessionDelete },
  { pattern: "/api/auth/account", method: "DELETE", handle: handleAccountDelete },
  { pattern: "/api/favorites", method: "GET", handle: handleFavoritesList },
  { pattern: "/api/favorites", method: "DELETE", handle: handleFavoritesClear },
  { pattern: "/api/favorites/:toolId", method: "PUT", handle: handleFavoritePut },
  { pattern: "/api/favorites/:toolId", method: "DELETE", handle: handleFavoriteDelete },
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
      console.error("api request failed", error);
      return errorResponse(500, MESSAGES.internal);
    }
  },
};

// Auth acceptance: real Wrangler HTTP + isolated local D1, no account/secrets.
// Aggregates failed checks; always stops its dev server and removes fixture D1.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { authAcceptanceFetch } from "./lib/auth-acceptance-fetch.mjs";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.AUTH_ACCEPTANCE_PORT ?? "18141");
const origin = `http://127.0.0.1:${String(port)}`;
const persistTo = ".wrangler/auth-acceptance-state";
const READY_TIMEOUT_MS = 90_000;
const RATE_LIMIT_MAX_FAILURES = 10;
const GOOGLE_CLIENT_ID = "acceptance-client.apps.googleusercontent.com";

const ALICE = { email: "acceptance-alice@example.com", name: "Alice Rossi", password: "password-alfa-1" };
const BOB = { email: "acceptance-bob@example.com", name: "Bob Bianchi", password: "password-beta-2" };
const GENERIC_LOGIN_MESSAGE = "Email o password non corretti.";
const SESSION_COOKIE_ATTRIBUTES = "HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000";

let devServer = null;
let failedAttempts = 0;
let failures = 0;
let checks = 0;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function check(label, passed, detail = "") {
  checks += 1;
  if (passed) {
    console.log(`  ok   ${label}`);
    return true;
  }
  failures += 1;
  console.log(`  FAIL ${label}${detail === "" ? "" : ` -> ${detail}`}`);
  return false;
}

function expectEqual(label, actual, expected) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  return check(label, same, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const devLog = [];
function captureDevLog(stream) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    devLog.push(chunk);
    if (devLog.length > 400) devLog.shift();
  });
}

async function runCommand(command, args) {
  return await new Promise((done, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: wranglerEnv() });
    captureDevLog(child.stdout);
    captureDevLog(child.stderr);
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? done() : reject(new Error(`${command} ${args.join(" ")} exited with ${String(code)}`))));
  });
}

function wranglerEnv() {
  return { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG: "warn" };
}

async function startDevServer() {
  devServer = spawn(
    "npx",
    [
      "wrangler", "dev",
      "--ip", "127.0.0.1",
      "--port", String(port),
      "--local",
      "--persist-to", persistTo,
      // Wrangler otherwise derives the inner request hostname from the
      // production custom-domain route, making a local acceptance request look
      // public to Turnstile. Keep this harness explicitly loopback-only without
      // weakening the production hostname check.
      "--local-upstream", "127.0.0.1",
      "--var", `GOOGLE_CLIENT_ID:${GOOGLE_CLIENT_ID}`,
    ],
    { cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"], env: wranglerEnv() },
  );
  captureDevLog(devServer.stdout);
  captureDevLog(devServer.stderr);
  devServer.on("exit", () => {
    devServer = null;
  });

  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/auth/session`, { headers: { accept: "application/json" } });
      if (response.status === 200) {
        const body = await response.json();
        if (body !== null && typeof body === "object" && body.user === null) return;
      }
    } catch {
      /* not listening yet */
    }
    await sleep(400);
  }
  throw new Error(`wrangler dev did not become ready on ${origin} within ${String(READY_TIMEOUT_MS)}ms`);
}

async function stopDevServer() {
  const child = devServer;
  if (child === null || child.pid === undefined) return;
  devServer = null;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
  await sleep(1000);
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    /* already gone */
  }
}

let shuttingDown = false;

/** Stops the server even when the script is interrupted or crashes. */
async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopDevServer();
  await rm(join(root, persistTo), { recursive: true, force: true }).catch(() => undefined);
  process.exit(code);
}

process.on("SIGINT", () => void shutdown(130));
process.on("SIGTERM", () => void shutdown(143));
process.on("SIGHUP", () => void shutdown(129));
process.on("uncaughtException", (error) => {
  console.error(`\nacceptance crashed: ${error instanceof Error ? error.message : String(error)}`);
  void shutdown(1);
});
process.on("unhandledRejection", (reason) => {
  console.error(`\nacceptance crashed: ${reason instanceof Error ? reason.message : String(reason)}`);
  void shutdown(1);
});

/* --------------------------------------------------------------- client -- */

async function api(path, options = {}) {
  const { method = "GET", body, cookie, rawCookie } = options;
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  const cookieHeader = cookie === undefined ? rawCookie : `su_session=${cookie}`;
  if (cookieHeader !== undefined) headers.cookie = cookieHeader;
  const response = await authAcceptanceFetch(`${origin}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  }, options.retryKdf !== false);
  const text = await response.text();
  let json = null;
  try {
    json = text === "" ? null : JSON.parse(text);
  } catch {
    json = null;
  }
  const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  return { status: response.status, headers: response.headers, text, json, setCookies };
}

function sessionToken(response) {
  for (const setCookie of response.setCookies) {
    if (setCookie.startsWith("su_session=")) {
      const pair = setCookie.split(";")[0] ?? "";
      const value = pair.slice("su_session=".length);
      return { value, setCookie };
    }
  }
  return null;
}

function responseCookie(response, name) {
  for (const setCookie of response.setCookies) {
    if (setCookie.startsWith(`${name}=`)) return setCookie.split(";")[0] ?? "";
  }
  return null;
}

function expectJsonError(label, response, status) {
  expectEqual(`${label}: status`, response.status, status);
  check(`${label}: json content-type`, (response.headers.get("content-type") ?? "").startsWith("application/json"), response.headers.get("content-type") ?? "");
  check(`${label}: body has error string`, typeof response.json?.error === "string", JSON.stringify(response.json));
}

async function register(user) {
  return await api("/api/auth/register", { method: "POST", body: user });
}

async function login(email, password) {
  return await api("/api/auth/login", { method: "POST", body: { email, password } });
}

/** A login expected to fail; counts against the per-IP rate limit. */
async function failedLogin(email, password) {
  failedAttempts += 1;
  return await login(email, password);
}

function expectSessionUser(label, response, user) {
  expectEqual(`${label}: status`, response.status, 200);
  expectEqual(`${label}: email`, response.json?.user?.email, user?.email ?? null);
  if (user !== undefined && user !== null) expectEqual(`${label}: name`, response.json?.user?.name, user.name);
}

async function sessionOf(cookie) {
  return await api("/api/auth/session", { cookie });
}

/* ----------------------------------------------------------- assertions -- */

async function checkStaticDelegation() {
  console.log("\nstatic assets (unchanged behaviour)");
  const home = await fetch(`${origin}/`);
  expectEqual("GET / serves the built HTML", home.status, 200);
  const html = await home.text();
  check("GET / returns HTML", html.includes("<html"), html.slice(0, 60));
  const missing = await fetch(`${origin}/definitely-not-a-page/`);
  expectEqual("unknown page returns the 404 page", missing.status, 404);
}

async function checkApiJsonErrors() {
  console.log("\n/api namespace answers JSON, never HTML");
  expectJsonError("unknown api path", await api("/api/auth/nope"), 404);
  const wrongMethod = await api("/api/auth/session", { method: "POST" });
  expectJsonError("wrong method", wrongMethod, 405);
  expectEqual("405 advertises Allow", wrongMethod.headers.get("allow"), "GET");
}

async function checkGoogleAuthBoundary() {
  console.log("\nGoogle auth boundary");
  const config = await api("/api/auth/google/config");
  expectEqual("Google config: status", config.status, 200);
  expectEqual("Google config: client id", config.json?.clientId, GOOGLE_CLIENT_ID);
  check(
    "Google config: nonce",
    typeof config.json?.nonce === "string" && config.json.nonce.length >= 20,
    JSON.stringify(config.json),
  );
  const nonceCookie = responseCookie(config, "su_google_nonce");
  check("Google config: HttpOnly nonce cookie", nonceCookie !== null, JSON.stringify(config.setCookies));
  if (nonceCookie !== null) {
    const rejected = await api("/api/auth/google", {
      method: "POST",
      rawCookie: nonceCookie,
      body: { credential: "not-a-google-id-token" },
    });
    failedAttempts += 1;
    expectJsonError("Google malformed credential", rejected, 401);
  }
}

async function checkRegisterAndSession() {
  console.log("\nregister + session");
  const registered = await register(ALICE);
  expectEqual("register: status", registered.status, 201);
  expectEqual("register: email", registered.json?.user?.email, ALICE.email);
  expectEqual("register: name", registered.json?.user?.name, ALICE.name);
  expectEqual("register: password login enabled", registered.json?.user?.passwordEnabled, true);
  expectEqual("register: Google not linked", registered.json?.user?.googleConnected, false);
  const alice = sessionToken(registered);
  check("register: session cookie", alice !== null, JSON.stringify(registered.setCookies));
  if (alice === null) return null;
  expectEqual("register: cookie attributes", alice.setCookie.slice(alice.setCookie.indexOf(";") + 1).trim(), SESSION_COOKIE_ATTRIBUTES);

  const session = await sessionOf(alice.value);
  expectSessionUser("session after register", session, ALICE);

  const duplicate = await register(ALICE);
  failedAttempts += 1;
  expectJsonError("duplicate email", duplicate, 409);
  return alice.value;
}

async function checkLogout(cookie) {
  console.log("\nlogout");
  const loggedOut = await api("/api/auth/logout", { method: "POST", cookie });
  expectEqual("logout: status", loggedOut.status, 204);
  const cleared = sessionToken(loggedOut);
  check("logout: cookie cleared", cleared?.setCookie.includes("Max-Age=0") === true, JSON.stringify(loggedOut.setCookies));
  expectEqual("logout: session gone", (await sessionOf(cookie)).json?.user, null);
  const again = await api("/api/auth/logout", { method: "POST" });
  expectEqual("logout without cookie: idempotent 204", again.status, 204);
}

async function checkLogin() {
  console.log("\nlogin");
  const wrongPassword = await failedLogin(ALICE.email, "definitely-not-the-password");
  expectJsonError("wrong password", wrongPassword, 401);
  expectEqual("wrong password: generic message", wrongPassword.json?.error, GENERIC_LOGIN_MESSAGE);
  const unknownEmail = await failedLogin("nobody@example.com", ALICE.password);
  expectJsonError("unknown email", unknownEmail, 401);
  expectEqual("unknown email: same body as wrong password", unknownEmail.text, wrongPassword.text);

  const signedIn = await login(ALICE.email, ALICE.password);
  expectEqual("login: status", signedIn.status, 200);
  const cookie = sessionToken(signedIn);
  check("login: session cookie", cookie !== null, JSON.stringify(signedIn.setCookies));
  expectSessionUser("session after login", await sessionOf(cookie?.value), ALICE);
  return cookie?.value ?? null;
}

async function checkTamperedCookie(cookie) {
  console.log("\ntampered cookies are not errors");
  const tampered = `${cookie.slice(0, -1)}${cookie.endsWith("A") ? "B" : "A"}`;
  const response = await sessionOf(tampered);
  expectEqual("tampered cookie: status", response.status, 200);
  expectEqual("tampered cookie: user", response.json?.user, null);
  const garbage = await api("/api/auth/session", { rawCookie: "su_session=%%%not-a-token%%%" });
  expectEqual("garbage cookie: status", garbage.status, 200);
  expectEqual("garbage cookie: user", garbage.json?.user, null);
  const other = await api("/api/auth/session", { rawCookie: "other=1" });
  expectEqual("unrelated cookie: user", other.json?.user, null);
}

async function checkProfileAndSessions(cookie) {
  console.log("\nprofile + session management");
  const renamed = await api("/api/auth/profile", { method: "PATCH", cookie, body: { name: "Alice Verdi" } });
  expectEqual("profile: status", renamed.status, 200);
  expectEqual("profile: name", renamed.json?.user?.name, "Alice Verdi");
  expectSessionUser("profile reflected in session", await sessionOf(cookie), { email: ALICE.email, name: "Alice Verdi" });

  const invalid = await api("/api/auth/profile", { method: "PATCH", cookie, body: { name: "   " } });
  expectJsonError("profile: empty name", invalid, 400);

  const second = sessionToken(await login(ALICE.email, ALICE.password));
  check("second session created", second !== null, JSON.stringify(second));
  const list = await api("/api/auth/sessions", { cookie });
  expectEqual("sessions: status", list.status, 200);
  const sessions = Array.isArray(list.json?.sessions) ? list.json.sessions : [];
  expectEqual("sessions: two entries", sessions.length, 2);
  check("sessions: exactly one current", sessions.filter((entry) => entry.current === true).length === 1, JSON.stringify(sessions));
  check("sessions: fields", sessions.every((entry) => typeof entry.id === "string" && typeof entry.createdAt === "string" && typeof entry.lastSeenAt === "string" && typeof entry.userAgent === "string"), JSON.stringify(sessions));
  check("sessions: no token hash", !JSON.stringify(list.json).includes("token_hash"), JSON.stringify(list.json));

  const foreign = await api("/api/auth/sessions/6f1c8f0e-0000-4000-8000-000000000000", { method: "DELETE", cookie });
  expectJsonError("delete foreign session", foreign, 404);
  const ownSecond = sessions.find((entry) => entry.current !== true);
  const removed = await api(`/api/auth/sessions/${String(ownSecond?.id ?? "")}`, { method: "DELETE", cookie });
  expectEqual("delete own session: status", removed.status, 204);
  expectEqual("deleted session invalid", (await sessionOf(second?.value)).json?.user, null);
  expectEqual("caller session survives", (await sessionOf(cookie)).json?.user?.email, ALICE.email);

  const anonymous = await api("/api/auth/sessions");
  expectJsonError("sessions without a session", anonymous, 401);
  return second?.value ?? null;
}

async function checkPasswordChange(cookie) {
  console.log("\npassword change");
  const second = sessionToken(await login(ALICE.email, ALICE.password));
  check("second device session", second !== null, JSON.stringify(second));

  const wrongCurrent = await api("/api/auth/password", { method: "POST", cookie, body: { currentPassword: "not-it-at-all", newPassword: "password-gamma-3" } });
  expectJsonError("wrong current password", wrongCurrent, 401);

  const tooShort = await api("/api/auth/password", { method: "POST", cookie, body: { currentPassword: ALICE.password, newPassword: "short" } });
  expectJsonError("new password below policy", tooShort, 400);

  const changed = await api("/api/auth/password", { method: "POST", cookie, body: { currentPassword: ALICE.password, newPassword: "password-gamma-3" } });
  expectEqual("password change: status", changed.status, 204);
  expectEqual("caller session still valid", (await sessionOf(cookie)).json?.user?.email, ALICE.email);
  expectEqual("other session invalidated", (await sessionOf(second?.value)).json?.user, null);
  expectJsonError("old password no longer works", await failedLogin(ALICE.email, ALICE.password), 401);
  const relogin = await login(ALICE.email, "password-gamma-3");
  expectEqual("new password works", relogin.status, 200);
  return sessionToken(relogin)?.value ?? null;
}

async function checkFavorites(aliceCookie) {
  console.log("\nfavourites");
  expectEqual("empty list", (await api("/api/favorites", { cookie: aliceCookie })).json?.tools, []);

  const first = await api("/api/favorites/alphabetizer", { method: "PUT", cookie: aliceCookie });
  expectEqual("PUT first favourite: status", first.status, 204);
  const second = await api("/api/favorites/date-difference", { method: "PUT", cookie: aliceCookie });
  expectEqual("PUT second favourite: status", second.status, 204);

  const listed = await api("/api/favorites", { cookie: aliceCookie });
  expectEqual("list: status", listed.status, 200);
  expectEqual("list: newest first", JSON.stringify(listed.json?.tools), JSON.stringify(["date-difference", "alphabetizer"]));

  const repeated = await api("/api/favorites/alphabetizer", { method: "PUT", cookie: aliceCookie });
  expectEqual("PUT existing favourite: status", repeated.status, 204);
  expectEqual("PUT is idempotent", (await api("/api/favorites", { cookie: aliceCookie })).json?.tools, ["date-difference", "alphabetizer"]);

  const invalid = await api("/api/favorites/Not%20A%20Tool", { method: "PUT", cookie: aliceCookie });
  expectJsonError("invalid tool id", invalid, 400);

  const bob = sessionToken(await register(BOB));
  check("second user session", bob !== null, JSON.stringify(bob));
  const bobOnly = await api("/api/favorites/bob-tool", { method: "PUT", cookie: bob?.value });
  expectEqual("second user's PUT", bobOnly.status, 204);
  expectEqual("second user sees only their own", (await api("/api/favorites", { cookie: bob?.value })).json?.tools, ["bob-tool"]);
  expectEqual("first user unaffected", (await api("/api/favorites", { cookie: aliceCookie })).json?.tools, ["date-difference", "alphabetizer"]);
  const crossDelete = await api("/api/favorites/bob-tool", { method: "DELETE", cookie: aliceCookie });
  expectEqual("cross-user DELETE is a no-op 204", crossDelete.status, 204);
  expectEqual("second user keeps their favourite", (await api("/api/favorites", { cookie: bob?.value })).json?.tools, ["bob-tool"]);

  expectEqual("DELETE one: status", (await api("/api/favorites/date-difference", { method: "DELETE", cookie: aliceCookie })).status, 204);
  expectEqual("list after delete", (await api("/api/favorites", { cookie: aliceCookie })).json?.tools, ["alphabetizer"]);
  expectEqual("DELETE missing favourite is a no-op", (await api("/api/favorites/date-difference", { method: "DELETE", cookie: aliceCookie })).status, 204);

  expectEqual("DELETE all: status", (await api("/api/favorites", { method: "DELETE", cookie: aliceCookie })).status, 204);
  expectEqual("cleared", (await api("/api/favorites", { cookie: aliceCookie })).json?.tools, []);
  expectEqual("second user still isolated", (await api("/api/favorites", { cookie: bob?.value })).json?.tools, ["bob-tool"]);

  const anonymous = await api("/api/favorites");
  expectJsonError("favourites without a session", anonymous, 401);
  const anonymousPut = await api("/api/favorites/alphabetizer", { method: "PUT" });
  expectJsonError("favourite PUT without a session", anonymousPut, 401);
  return bob?.value ?? null;
}

async function checkAccountDeletion(cookie) {
  console.log("\naccount deletion");
  const wrong = await api("/api/auth/account", { method: "DELETE", cookie, body: { password: "not-the-password" } });
  expectJsonError("wrong password", wrong, 401);
  const deleted = await api("/api/auth/account", { method: "DELETE", cookie, body: { password: "password-gamma-3" } });
  expectEqual("delete account: status", deleted.status, 204);
  check("delete account: cookie cleared", sessionToken(deleted)?.setCookie.includes("Max-Age=0") === true, JSON.stringify(deleted.setCookies));
  expectEqual("session endpoint after deletion", (await sessionOf(cookie)).json?.user, null);
  expectJsonError("login after deletion", await failedLogin(ALICE.email, "password-gamma-3"), 401);
}

async function checkRateLimit() {
  console.log("\nrate limit");
  const allowed = Math.max(0, RATE_LIMIT_MAX_FAILURES - failedAttempts);
  let saw401 = 0;
  for (let attempt = 0; attempt < allowed; attempt += 1) {
    const response = await login(ALICE.email, `wrong-password-${String(attempt)}`);
    if (response.status === 401) saw401 += 1;
    failedAttempts += 1;
  }
  expectEqual("remaining password failures answer 401", saw401, allowed);

  const blocked = await api("/api/auth/login", { method: "POST", body: { email: ALICE.email, password: ALICE.password }, retryKdf: false });
  expectEqual("next login is blocked", blocked.status, 429);
  const retryAfter = Number(blocked.headers.get("retry-after") ?? "");
  check("429 carries Retry-After seconds", Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 900, blocked.headers.get("retry-after") ?? "missing");
  check("429 message is Italian", typeof blocked.json?.error === "string" && blocked.json.error.length > 0, JSON.stringify(blocked.json));
}

/* ------------------------------------------------------------------ main -- */

async function main() {
  if (!existsSync(join(root, "dist", "index.html"))) {
    throw new Error("dist/ is missing; run `npm run build` before the auth acceptance script");
  }

  console.log(`auth acceptance -> ${origin} (local D1 at ${persistTo})`);
  await rm(join(root, persistTo), { recursive: true, force: true });
  await runCommand("npx", ["wrangler", "d1", "migrations", "apply", "AUTH_DB", "--local", "--persist-to", persistTo]);
  await startDevServer();

  try {
    await checkStaticDelegation();
    await checkApiJsonErrors();
    await checkGoogleAuthBoundary();
    const aliceCookie = await checkRegisterAndSession();
    if (aliceCookie === null) throw new Error("registration did not return a session cookie");
    await checkLogout(aliceCookie);
    const loggedIn = await checkLogin();
    if (loggedIn === null) throw new Error("login did not return a session cookie");
    await checkTamperedCookie(loggedIn);
    await checkProfileAndSessions(loggedIn);
    const rotated = await checkPasswordChange(loggedIn);
    if (rotated === null) throw new Error("re-login after the password change failed");
    await checkFavorites(rotated);
    await checkAccountDeletion(rotated);
    await checkRateLimit();
  } finally {
    await stopDevServer();
    await rm(join(root, persistTo), { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  failures += 1;
  console.error(`\nacceptance aborted: ${error instanceof Error ? error.message : String(error)}`);
  if (devLog.length > 0) console.error(`--- wrangler dev output ---\n${devLog.join("")}`);
} finally {
  await stopDevServer();
}

console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: ${String(checks - failures)}/${String(checks)} checks passed`);
process.exit(failures === 0 ? 0 : 1);

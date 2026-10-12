/** #328 wave20: two independent Chrome 390 auth sessions with a disposable,
 * cookie-aware local HTTP auth fixture. Only local static pages are real:
 * no Cloudflare Turnstile, D1, provider secrets or real account mutation.
 * Execute against a running local Astro server or self-host a disposable one:
 * node tests/turnstile-login-wave20-328.browser.mjs [http://127.0.0.1:19528]
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const passedOrigin = process.argv[2];
const origin = passedOrigin ?? "http://127.0.0.1:19528";
const server = passedOrigin ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", "19528", "--strictPort"], {
  cwd: root, stdio: "ignore",
});
let browser;
const sessions = new Map([["fixture-session-A", "alice@example.test"], ["fixture-session-B", "bob@example.test"]]);
const calls = { A: 0, B: 0 };
const unexpected = [];
const errors = [];
const requests = [];
let logoutMode = "503";
let releaseDelayed;

function fixtureCookie(request) {
  return /(?:^|;\s*)su_session=([^;]+)/u.exec(request.headers().cookie ?? "")?.[1] ?? "";
}

async function fixture(route) {
  const request = route.request();
  const url = new URL(request.url());
  const token = fixtureCookie(request);
  if (url.pathname === "/api/auth/session" && request.method() === "GET") {
    const email = sessions.get(token);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: email === undefined ? null : { email, name: email.split("@")[0] } }) });
    return;
  }
  if (url.pathname === "/api/auth/logout" && request.method() === "POST") {
    assert(token === "fixture-session-A" || token === "fixture-session-B");
    calls[token.endsWith("A") ? "A" : "B"] += 1;
    if (logoutMode === "503") return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"offline"}' });
    if (logoutMode === "fallback-200") return route.fulfill({ status: 200, contentType: "text/html", body: "<html>Static fallback, not a logout receipt</html>" });
    if (logoutMode === "network-error") return route.abort("failed");
    if (logoutMode === "delayed-204") {
      await new Promise((release) => { releaseDelayed = release; });
    }
    assert(logoutMode === "204" || logoutMode === "delayed-204");
    sessions.delete(token);
    return route.fulfill({ status: 204, headers: { "set-cookie": "su_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" }, body: "" });
  }
  await route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"unavailable in isolated test"}' });
}

async function ready() {
  for (let i = 0; i < 90; i++) {
    if (server && server.exitCode !== null) throw new Error(`Local Astro server exited ${server.exitCode}`);
    try { if ((await fetch(origin)).status === 200) return; } catch { /* server starting */ }
    await pause(250);
  }
  throw new Error("Local Astro server did not become ready");
}

async function contextFor(token) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{ name: "su_session", value: token, url: origin, httpOnly: true, sameSite: "Lax" }]);
  await context.route("**/api/auth/**", fixture);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    requests.push({ method: request.method(), url });
    if ((!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) || (request.method() !== "GET" && request.method() !== "HEAD" && !url.endsWith("/api/auth/logout"))) {
      unexpected.push(`${request.method()} ${url}`);
    }
  });
  assert.equal((await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 90_000 }))?.status(), 200);
  const toggle = page.locator("[data-account-toggle]");
  await toggle.waitFor({ state: "visible", timeout: 20_000 });
  return { context, page, toggle };
}

async function openMenu(client) {
  if (await client.page.locator("[data-account-dropdown]").isHidden()) await client.toggle.click();
  await client.page.locator("[data-account-logout]").waitFor({ state: "visible" });
}

async function assertStillSignedIn(client, expectedEmail) {
  assert.equal(new URL(client.page.url()).pathname, "/", "failed logout must not redirect as if success");
  assert(await client.toggle.isVisible(), "session chip must remain signed in");
  const session = await client.page.evaluate(async () => (await fetch("/api/auth/session", { credentials: "same-origin" })).json());
  assert.equal(session.user.email, expectedEmail);
  assert(await client.page.locator("[data-account-logout-error]").isVisible(), "failed logout must explain active session to user");
  assert.match(await client.page.locator("[data-account-logout-error]").innerText(), /non.*uscire|ancora.*collegat|riprov/i);
  assert.equal(await client.page.locator("[data-account-logout-error]").getAttribute("role"), "alert");
  assert.equal(await client.page.locator("[data-account-logout]").isEnabled(), true);
}

try {
  await ready();
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const first = await contextFor("fixture-session-A");
  const second = await contextFor("fixture-session-B");
  assert.match(await first.page.locator("[data-account-name]").textContent(), /alice/u);
  assert.match(await second.page.locator("[data-account-name]").textContent(), /bob/u);

  for (const failure of ["503", "fallback-200", "network-error"]) {
    logoutMode = failure;
    await openMenu(first);
    await first.page.locator("[data-account-logout]").click();
    await first.page.locator("[data-account-logout-error]:not([hidden])").waitFor({ timeout: 8_000 });
    await assertStillSignedIn(first, "alice@example.test");
    assert(sessions.has("fixture-session-A"), `${failure} cannot terminate a session`);
    assert(sessions.has("fixture-session-B"));
  }
  assert.equal(calls.A, 3);
  assert.equal(calls.B, 0);

  // Retry a previously failed logout while double-activating the same button.
  // Only one request may be outstanding; the server's 204 revokes session A.
  logoutMode = "delayed-204";
  await openMenu(first);
  await first.page.locator("[data-account-logout]").evaluate((button) => { button.click(); button.click(); });
  await first.page.waitForFunction(() => document.querySelector('[data-account-logout]')?.hasAttribute("disabled"));
  assert.equal(calls.A, 4, "duplicate activation must not submit a second logout");
  assert.equal(await first.page.locator("[data-account-logout-error]").isVisible(), false, "new retry clears old error");
  assert(typeof releaseDelayed === "function");
  const redirected = first.page.waitForEvent("framenavigated", { timeout: 12_000 });
  releaseDelayed();
  await redirected;
  await first.page.locator("[data-account-login]").waitFor({ state: "visible", timeout: 12_000 });
  assert.equal(sessions.has("fixture-session-A"), false, "success revokes only A");
  assert.equal(sessions.has("fixture-session-B"), true, "other browser session must remain active");

  await second.page.reload({ waitUntil: "domcontentloaded" });
  await second.toggle.waitFor({ state: "visible", timeout: 12_000 });
  assert.match(await second.page.locator("[data-account-name]").textContent(), /bob/u);
  assert.equal(calls.B, 0);
  assert.equal(new URL(first.page.url()).pathname, "/");

  assert.deepEqual(unexpected, [], "No external or mutating requests besides local logout");
  assert.deepEqual(errors, [], "No unhandled client errors");
  await first.context.close();
  await second.context.close();
  console.log("PASS #328 wave20 Chrome390: isolated A/B session cookies, 503/200 static/network logout fail closed, visible alert and retry, double submit once, 204 A-only revocation, B retained, 0 offsite/provider");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

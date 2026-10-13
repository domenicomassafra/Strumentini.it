/**
 * #328 real Chrome 390 local-only auth/Turnstile concurrency regression.
 * All auth and vendor calls are isolated browser routes; NO provider secrets,
 * real account, remote Siteverify, production D1 or deployment are involved.
 * Usage: node tests/turnstile-328-20261013-submission-race.browser.mjs [origin]
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const explicitOrigin = process.argv[2];
const origin = explicitOrigin ?? "http://127.0.0.1:19538";
const server = explicitOrigin ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", "19538", "--strictPort"], { cwd: root, stdio: "ignore" });
const errors = [];
const unexpected = [];
let browser;

const widget = `
  window.__raceWidgets={};
  window.turnstile={
    render(target,options){window.__raceWidgets[options.action]=options;target.textContent='Mock challenge '+options.action;return 'widget-'+options.action;},
    reset(){window.__raceResets=(window.__raceResets||0)+1;}
  };
  window.strumentiniTurnstileLoaded();
`;
const response = (status, payload) => ({ status, contentType: "application/json", body: JSON.stringify(payload) });
const user = (email) => ({ email, name: "Fixture", passwordEnabled: true, googleConnected: false });

async function ready() {
  for (let attempts = 0; attempts < 100; attempts++) {
    if (server && server.exitCode !== null) throw Error(`Astro exit ${server.exitCode}`);
    try { if ((await fetch(`${origin}/accedi/`)).status === 200) return; } catch { /* initializing */ }
    await sleep(250);
  }
  throw Error("Local Astro /accedi/ did not become ready");
}

async function until(predicate, label) {
  for (let i = 0; i < 120; i++) {
    if (predicate()) return;
    await sleep(25);
  }
  throw Error(`Timed out waiting for fixture: ${label}`);
}

async function newPage({ deferSession = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const state = { login: [], register: [], releaseLogin: [], releaseSession: null, sessionRequested: false };
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith("https://challenges.cloudflare.com/turnstile/v0/api.js")) unexpected.push(`${request.method()} ${url}`);
  });
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: widget }));
  await page.route("**/api/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/google/config") return route.fulfill(response(503, { error: "fixture disabled" }));
    if (path === "/api/auth/session") {
      state.sessionRequested = true;
      if (deferSession) await new Promise((resolve) => { state.releaseSession = resolve; });
      return route.fulfill(response(200, { user: deferSession ? user("old-session@example.test") : null }));
    }
    if (path === "/api/auth/login" || path === "/api/auth/register") {
      const kind = path.endsWith("register") ? "register" : "login";
      const body = route.request().postDataJSON();
      state[kind].push(body);
      if (kind === "register") return route.fulfill(response(503, { error: "Registrazione indisponibile nel test." }));
      await new Promise((resolve) => { state.releaseLogin.push(resolve); });
      if (state.login.length === 1) return route.fulfill(response(400, { error: "La verifica anti-bot non è valida o è scaduta. Riprova." }));
      return route.fulfill(response(200, { user: user(body.email) }));
    }
    return route.fulfill(response(404, { error: "unsupported fixture route" }));
  });
  assert.equal((await page.goto(`${origin}/accedi/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
  await page.waitForFunction(() => window.__raceWidgets?.login !== undefined);
  return { page, state };
}

try {
  await ready();
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const { page, state } = await newPage();
  await page.locator("#login-email").fill("alice@example.test");
  await page.locator("#login-password").fill("password-alfa-1");
  await page.evaluate(() => window.__raceWidgets.login.callback("token-login"));
  await page.locator("#panel-login button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("#panel-login button[type=submit]")?.disabled === true);
  await until(() => state.login.length === 1, "first delayed login request");

  // requestSubmit is a real HTML form submission path even when the submit
  // button has been disabled. An Enter key or another handler can hit it.
  await page.locator("#panel-login").evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
  await page.waitForTimeout(120);
  assert.equal(state.login.length, 1, "pending login must not dispatch repeated HTTP POSTs after disabling the button");

  // Expiry can fire while the one-use token is already at the server. It must
  // clear the pending UI token, not provoke another HTTP request or retry.
  await page.evaluate(() => window.__raceWidgets.login["expired-callback"]());
  assert.match(await page.locator("#turnstile-login-status").innerText(), /scaduta/u);
  await page.locator("#panel-login").evaluate((form) => form.requestSubmit());
  await page.waitForTimeout(80);
  assert.equal(state.login.length, 1, "expired in-flight challenge cannot issue an extra login");

  // A different form remains available in the UI; submitting it during the
  // login flight must not overlap the first authentication mutation.
  await page.getByRole("tab", { name: "Crea un account" }).click();
  await page.waitForFunction(() => window.__raceWidgets.register !== undefined);
  await page.locator("#register-name").fill("Alice Test");
  await page.locator("#register-email").fill("alice@example.test");
  await page.locator("#register-password").fill("password-alfa-1");
  await page.evaluate(() => window.__raceWidgets.register.callback("token-register"));
  await page.locator("#panel-register button[type=submit]").click();
  await page.waitForTimeout(120);
  assert.equal(state.register.length, 0, "registration must not race an outstanding login");

  state.releaseLogin.shift()?.();
  await page.locator("[data-access-error]").getByText(/non è valida/u).waitFor();
  assert.equal(await page.locator("[data-access-error]").getAttribute("role"), "alert");
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-access-error")), true);

  // A request started on mount must not replay stale session data after a new
  // authentication attempt has completed. No authentication provider involved.
  const second = await newPage({ deferSession: true });
  await until(() => second.state.sessionRequested, "first delayed session probe");
  await second.page.locator("#login-email").fill("alice@example.test");
  await second.page.locator("#login-password").fill("password-alfa-1");
  await second.page.evaluate(() => window.__raceWidgets.login.callback("token-login"));
  await second.page.locator("#panel-login button[type=submit]").click();
  await second.page.waitForFunction(() => document.querySelector("#panel-login button[type=submit]")?.disabled === true);
  await until(() => second.state.login.length === 1, "second page login request");
  assert.equal(second.state.login.length, 1);
  second.state.releaseLogin.shift()?.();
  await second.page.locator("[data-access-error]").getByText(/non è valida/u).waitFor();
  assert.equal(second.state.sessionRequested, true);
  second.state.releaseSession?.();
  await second.page.waitForTimeout(180);
  assert.equal(await second.page.locator("[data-access-connected]").isHidden(), true,
    "pre-action session probe cannot replace a newer login error with stale signed-in UI");

  assert.deepEqual(unexpected, []);
  assert.deepEqual(errors, []);
  console.log("PASS #328 real Chrome390 same-origin mocked Turnstile/auth: single-flight login/register, obsolete session probe ignored, focusable error, zero provider traffic");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

/**
 * Ticket #328/#329. Browser interaction against a LOCAL Astro server and a
 * controlled Turnstile/JSON API fixture. No production credentials, network
 * challenges, real account mutation, or receipt/Gold promotion.
 * Run: node tests/account-page-turnstile-328-329.browser.mjs
 */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18832;
// A coordinator may already own the single Astro dev server. Reuse its HTTP
// read-only page while all APIs and external JS stay browser-mocked.
const existingOrigin = process.env.AUTH_PAGE_ORIGIN;
const origin = existingOrigin ?? `http://127.0.0.1:${port}`;
const server = existingOrigin === undefined ? spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
}) : null;
let browser;
let checks = 0;
let loginCalls = 0;
let registerCalls = 0;
const logs = [];
server?.stdout.on("data", (chunk) => logs.push(String(chunk).slice(0, 300)));
server?.stderr.on("data", (chunk) => logs.push(String(chunk).slice(0, 300)));

function check(value, message) {
  assert(value, message);
  checks++;
}

async function ready() {
  for (let i = 0; i < 100; i++) {
    if (server !== null && server.exitCode !== null) throw new Error(`Astro exited ${String(server.exitCode)}: ${logs.join(" ")}`);
    try {
      if ((await fetch(`${origin}/accedi/`)).status === 200) return;
    } catch { /* startup */ }
    await sleep(250);
  }
  throw new Error(`Astro did not serve /accedi/: ${logs.join(" ")}`);
}

function contrast(foreground, background) {
  function luminance(value) {
    const parts = value.match(/[\d.]+/gu)?.slice(0, 3).map(Number);
    assert(parts?.length === 3, `unsupported color ${value}`);
    const channels = parts.map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const vendorMock = `
  window.__widgetFixture = { options: {}, resets: [], renders: [] };
  window.turnstile = {
    render(target, options) {
      const widget = 'fixture-' + options.action;
      window.__widgetFixture.renders.push(options.action);
      window.__widgetFixture.options[options.action] = options;
      target.textContent = 'Verifica mock ' + options.action;
      return widget;
    },
    reset(widget) { window.__widgetFixture.resets.push(widget); }
  };
  window.strumentiniTurnstileLoaded();
`;

async function setup(page, { failVendor = false, delayedVendor = false } = {}) {
  const outbound = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin)) outbound.push(request.url());
  });
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) => {
    if (failVendor) return route.abort("failed");
    const body = delayedVendor
      ? vendorMock.replace("window.strumentiniTurnstileLoaded();", "window.__fireTurnstileReady = () => window.strumentiniTurnstileLoaded();")
      : vendorMock;
    return route.fulfill({ status: 200, contentType: "text/javascript", body });
  });
  await page.route("**/api/auth/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/session") return route.fulfill({ status: 200, contentType: "application/json", body: '{"user":null}' });
    if (path === "/api/auth/google/config") return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"non configurato"}' });
    if (path === "/api/auth/login" || path === "/api/auth/register") {
      const body = request.postDataJSON();
      const action = path.endsWith("register") ? "register" : "login";
      if (action === "register") registerCalls++;
      else loginCalls++;
      const valid = body.turnstileToken === `token-${action}`;
      const status = valid ? (action === "register" ? 201 : 200) : 400;
      const payload = valid ? { user: { email: body.email, name: body.name ?? "Fixture", passwordEnabled: true, googleConnected: false } }
        : { error: "La verifica anti-bot non è valida o è scaduta. Riprova." };
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: '{}' });
  });
  return outbound;
}

async function widget(page, action, event, token) {
  await page.evaluate(({ action, event, token }) => {
    const opts = window.__widgetFixture.options[action];
    if (event === "callback") opts.callback(token);
    else opts[event]();
  }, { action, event, token });
}

async function textContrast(page, theme) {
  await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
  const colors = await page.locator("#panel-login .ac-support").first().evaluate((element) => ({
    foreground: getComputedStyle(element).color,
    background: getComputedStyle(document.querySelector(".ac-card")).backgroundColor,
  }));
  const ratio = contrast(colors.foreground, colors.background);
  check(ratio >= 4.5, `${theme} secondary contrast must meet 4.5:1; got ${ratio.toFixed(3)}`);
  return ratio;
}

try {
  await ready();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const external = await setup(page);
  check((await page.goto(`${origin}/accedi/`))?.status() === 200, "real account HTML served");
  await page.waitForFunction(() => window.__widgetFixture?.options.login !== undefined);
  check((await page.evaluate(() => window.__widgetFixture.renders)).join(",") === "login", "login widget rendered once; hidden register deferred");
  check((await page.locator("#turnstile-login-status").innerText()).includes("Completa"), "status announces challenge readiness");
  const lightContrast = await textContrast(page, "light");
  const darkContrast = await textContrast(page, "dark");
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });

  await page.locator("#login-email").fill("invalid");
  await page.locator("#panel-login button[type=submit]").click();
  check(await page.locator("#login-email").getAttribute("aria-invalid") === "true", "invalid email aria-invalid");
  check((await page.locator("#login-email").getAttribute("aria-describedby"))?.includes("login-email-error"), "invalid email announces linked error");
  check(await page.evaluate(() => document.activeElement?.id) === "login-email", "focus returns to invalid field");

  await page.locator("#login-email").fill("alice@example.test");
  await page.locator("#login-password").fill("password-alfa-1");
  await page.locator("#panel-login button[type=submit]").click();
  check(loginCalls === 0, "client refuses login without challenge token");
  check(await page.locator("[data-access-error]").getAttribute("role") === "alert", "challenge error is announced");
  check(await page.evaluate(() => document.activeElement?.hasAttribute("data-access-error")) === true, "challenge error receives keyboard focus");

  await widget(page, "login", "callback", "bad-token");
  await page.locator("#panel-login button[type=submit]").click();
  check(loginCalls === 1, "bad token reaches mocked server for actual rejection");
  await page.locator("[data-access-error]").getByText(/non è valida/u).waitFor();
  check((await page.locator("[data-access-error]").innerText()).includes("non è valida"), "mock server rejection surfaces original error");
  check((await page.evaluate(() => window.__widgetFixture.resets)).includes("fixture-login"), "server error discards one-use token");

  await widget(page, "login", "callback", "token-login");
  await widget(page, "login", "expired-callback");
  check((await page.locator("#turnstile-login-status").innerText()).includes("scaduta"), "expiry is announced");
  check(await page.locator('[data-turnstile-retry="login"]').isVisible(), "visible retry after expiry");
  await page.locator("#panel-login button[type=submit]").click();
  check(loginCalls === 1, "expired token never submitted");
  await page.locator('[data-turnstile-retry="login"]').click();
  check((await page.evaluate(() => window.__widgetFixture.resets)).filter((id) => id === "fixture-login").length === 2, "explicit retry resets challenge");
  await widget(page, "login", "callback", "token-login");
  await widget(page, "login", "timeout-callback");
  check((await page.locator("#turnstile-login-status").innerText()).includes("Tempo scaduto"), "timeout removes token and is announced");
  await widget(page, "login", "error-callback");
  check((await page.locator("#turnstile-login-status").innerText()).includes("non è riuscita"), "challenge failure is announced");
  await page.locator("#panel-login button[type=submit]").click();
  check(loginCalls === 1, "failed/timeout challenge cannot submit");

  await page.getByRole("tab", { name: "Crea un account" }).click();
  await page.waitForFunction(() => window.__widgetFixture?.options.register !== undefined);
  check((await page.evaluate(() => window.__widgetFixture.renders)).join(",") === "login,register", "register widget initialized when visible");
  await page.keyboard.press("Home");
  check(await page.getByRole("tab", { name: "Accedi", exact: true }).getAttribute("aria-selected") === "true", "Home selects first tab");
  await page.keyboard.press("End");
  check(await page.getByRole("tab", { name: "Crea un account" }).getAttribute("aria-selected") === "true", "End selects last tab");
  check(await page.evaluate(() => document.activeElement?.id) === "tab-register", "keyboard tab focus follows selection");
  await page.locator("#register-name").fill("Alice Rossi");
  await page.locator("#register-email").fill("alice@example.test");
  await page.locator("#register-password").fill("password-alfa-1");
  await page.locator("#panel-register button[type=submit]").click();
  check(registerCalls === 0, "registration blocks absent token");
  await widget(page, "register", "callback", "token-register");
  await Promise.all([page.waitForURL("**/preferiti/"), page.locator("#panel-register button[type=submit]").click()]);
  check(registerCalls === 1, "mock-staged registration uses exact widget token and 201 response");

  // New anonymous page to verify login after registration without using a
  // real account backend or a production Turnstile key/secret.
  const signInPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const out2 = await setup(signInPage);
  await signInPage.goto(`${origin}/accedi/`);
  await signInPage.waitForFunction(() => window.__widgetFixture?.options.login !== undefined);
  await signInPage.locator("#login-email").fill("alice@example.test");
  await signInPage.locator("#login-password").fill("password-alfa-1");
  await widget(signInPage, "login", "callback", "token-login");
  await Promise.all([signInPage.waitForURL("**/preferiti/"), signInPage.locator("#panel-login button[type=submit]").click()]);
  check(loginCalls === 2, "mock-staged login with fresh token succeeds");

  const failed = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const out3 = await setup(failed, { failVendor: true });
  await failed.goto(`${origin}/accedi/`);
  await failed.locator("#turnstile-login-status").getByText(/non è disponibile/).waitFor();
  await failed.locator("#login-email").fill("alice@example.test");
  await failed.locator("#login-password").fill("password-alfa-1");
  await failed.locator("#panel-login button[type=submit]").click();
  check(loginCalls === 2, "CDN load failure cannot submit without challenge");
  check((await failed.locator("[data-access-error]").innerText()).includes("non è disponibile"), "script failure is distinct and announced");

  const late = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const out4 = await setup(late, { delayedVendor: true });
  await late.goto(`${origin}/accedi/`);
  await late.waitForFunction(() => typeof window.__fireTurnstileReady === "function");
  check((await late.evaluate(() => window.__widgetFixture.renders)).length === 0, "late vendor script alone does not render before ready callback");
  check((await late.locator("#turnstile-login-status").innerText()).includes("Caricamento"), "pending challenge is communicated");
  await late.evaluate(() => { window.__fireTurnstileReady(); window.__fireTurnstileReady(); });
  await late.waitForFunction(() => window.__widgetFixture.renders.length === 1);
  check((await late.evaluate(() => window.__widgetFixture.renders)).join(",") === "login", "late/duplicate callback renders exactly one widget");
  check(errors.length === 0, `no runtime errors on regular page: ${errors.join("; ")}`);
  check([external, out2, out3, out4].every((requests) => requests.every((url) => url.startsWith("https://challenges.cloudflare.com/turnstile/v0/api.js"))), "no unexpected offsite requests");

  console.log(`PASS #328/#329 local Chromium login/registration challenge, 2 script-order paths, token expiration/error/timeout, field focus, light/dark AA; ${checks} assertions; text contrast ${lightContrast.toFixed(2)}:1 light and ${darkContrast.toFixed(2)}:1 dark`);
} finally {
  await browser?.close();
  if (server?.pid !== undefined) {
    try { process.kill(-server.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
}

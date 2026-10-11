/**
 * #329 source-bound local Google Chrome acceptance: account labels, errors,
 * keyboard focus and responsive reflow in both explicit themes.
 *
 * node tests/acceptance-account-aa-329.mjs
 * ACCOUNT329_ORIGIN=http://127.0.0.1:4321 node tests/acceptance-account-aa-329.mjs
 *
 * HTTP API and Cloudflare Turnstile are isolated browser fixtures. Native
 * desktop browser zoom / physical mobile / screenreader remain separate gates.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 19569;
const origin = process.env.ACCOUNT329_ORIGIN ?? `http://127.0.0.1:${port}`;
const serverLogs = [];
const server = process.env.ACCOUNT329_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(), detached: true, stdio: ["ignore", "pipe", "pipe"],
});
for (const stream of [server?.stdout, server?.stderr]) stream?.on("data", (chunk) => serverLogs.push(String(chunk).slice(-400)));
let browser;
let assertions = 0;
let failedLoginCalls = 0;
let failedRegisterCalls = 0;
let unexpectedExternalRequests = 0;
const ratios = [];
const browserErrors = [];
const check = (condition, message, details) => {
  assertions++;
  assert(condition, `${message}${details === undefined ? "" : ` — ${JSON.stringify(details)}`}`);
};
const nativeColor = (value) => {
  const parts = value.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:\s*\/\s*([\d.]+))?\)$/);
  assert(parts, `Unexpected CSS color ${value}`);
  assert(!parts[4] || Number(parts[4]) === 1, `Alpha requires compositing: ${value}`);
  return parts.slice(1, 4).map(Number);
};
function contrast(a, b) {
  const lum = (value) => nativeColor(value).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }).reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
async function textContrast(page, label, foregroundSelector, backgroundSelector, theme, width) {
  const colors = await page.evaluate(([foregroundSelector, backgroundSelector]) => {
    const ink = document.querySelector(foregroundSelector);
    const ground = document.querySelector(backgroundSelector);
    if (!ink || !ground) return null;
    return { foreground: getComputedStyle(ink).color, background: getComputedStyle(ground).backgroundColor };
  }, [foregroundSelector, backgroundSelector]);
  check(colors !== null, `Elements available ${label}`);
  const ratio = contrast(colors.foreground, colors.background);
  check(ratio >= 4.5, `AA normal text ${label}, ${theme} ${width}px`, { ratio: +ratio.toFixed(3), ...colors });
  ratios.push({ label, theme, width, ratio: +ratio.toFixed(3) });
}
async function checkReflow(page, label) {
  const geometry = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    card: document.querySelector(".ac-card")?.getBoundingClientRect().width,
    headingClipped: (() => {
      const el = document.querySelector(".ac-pitch h1");
      return el ? el.scrollWidth > el.clientWidth + 1 : true;
    })(),
  }));
  check(geometry.document <= geometry.viewport + 1 && geometry.card > 0 && !geometry.headingClipped, `reflow ${label}`, geometry);
}
async function focusVisible(page, selector, label) {
  const focus = await page.locator(selector).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      active: element === document.activeElement,
      focusVisible: element.matches(":focus-visible"),
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
      borderColor: style.borderColor,
      backgroundColor: style.backgroundColor,
    };
  });
  check(focus.active, `keyboard focus ${label}`, focus);
  check(focus.focusVisible, `focus visible pseudo-class ${label}`, focus);
  check((focus.outlineStyle !== "none" && focus.outlineWidth >= 2) || focus.boxShadow !== "none",
    `visible outline or ring ${label}`, focus);
}
async function go(page, width, theme) {
  await page.setViewportSize({ width, height: 844 });
  const response = await page.goto(`${origin}/accedi/`, { waitUntil: "domcontentloaded" });
  check(response?.status() === 200, `real /accedi/ HTTP 200 ${width}`);
  await page.locator("#tab-login").waitFor();
  // Public navigation applies the theme, rather than mutating CSS variables.
  if (theme === "dark") {
    const toggle = page.locator("[data-mobile-panel] [data-theme-toggle]");
    const menu = page.locator("[data-mobile-toggle]");
    await menu.click();
    check(await menu.getAttribute("aria-expanded") === "true", "mobile theme menu open");
    await toggle.click();
    check(await page.locator("html[data-theme=dark]").count() === 1, "dark theme set using UI");
    await page.reload({ waitUntil: "domcontentloaded" });
    check(await page.locator("html[data-theme=dark]").count() === 1, "theme survives navigation");
  } else {
    check(await page.locator("html[data-theme=light]").count() === 1, "light theme initially applied");
  }
  await page.locator("#login-email").waitFor();
  await checkReflow(page, `${width}px ${theme}`);
}

async function visualMatrix(page, width, theme) {
  await go(page, width, theme);
  const control = page.locator("#tab-login");
  // Tab through actual browser keyboard order, including the skip link.
  await page.keyboard.press("Tab");
  check(await page.locator(".shell-skip-link").evaluate((el) => el === document.activeElement), "skip link is first");
  let reached = false;
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    if (await control.evaluate((el) => el === document.activeElement)) { reached = true; break; }
  }
  check(reached, "tab reaches account panel");
  await focusVisible(page, "#tab-login", "tab");
  await page.keyboard.press("End");
  check(await page.locator("#tab-register").getAttribute("aria-selected") === "true", "End opens register");
  await focusVisible(page, "#tab-register", "register tab");
  await textContrast(page, "register name label", "#panel-register label[for=register-name]", ".ac-card", theme, width);
  await textContrast(page, "register password rule", "#register-password-rule", ".ac-card", theme, width);
  await page.keyboard.press("Home");
  check(await page.locator("#tab-login").getAttribute("aria-selected") === "true", "Home opens login");
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#tab-login")).backgroundColor !== "rgba(0, 0, 0, 0)");
  await textContrast(page, "login email label", "#panel-login label[for=login-email]", ".ac-card", theme, width);
  await textContrast(page, "login support", "#panel-login .ac-support", ".ac-card", theme, width);
  await textContrast(page, "login password label", "#panel-login label[for=login-password]", ".ac-card", theme, width);
  await textContrast(page, "login intro", ".ac-pitch > p", "body", theme, width);
  await textContrast(page, "login trust link", ".ac-trust a", ".ac-card", theme, width);
  await textContrast(page, "selected tab text", "#tab-login", "#tab-login", theme, width);
  await textContrast(page, "login primary button", "#panel-login [data-access-submit]", "#panel-login [data-access-submit]", theme, width);

  await page.locator("#login-email").focus();
  await focusVisible(page, "#login-email", "email input");
  await page.locator("#panel-login [data-access-submit]").focus();
  await focusVisible(page, "#panel-login [data-access-submit]", "submit button");
  await page.keyboard.press("Enter");
  check(await page.locator("#login-email-error").isVisible(), "required email error rendered");
  check(await page.locator("#login-email").getAttribute("aria-invalid") === "true", "required email aria-invalid");
  check((await page.locator("#login-email").getAttribute("aria-describedby"))?.includes("login-email-error"), "inline error linked to field");
  check(await page.locator("#login-email").evaluate((el) => el === document.activeElement), "invalid email receives focus");
  await textContrast(page, "invalid email error", "#login-email-error", ".ac-card", theme, width);
  await textContrast(page, "invalid password error", "#login-password-error", ".ac-card", theme, width);

  await page.locator("#login-email").fill("bademail");
  await page.locator("#panel-login [data-access-submit]").click();
  check((await page.locator("#login-email-error").innerText()).length > 0, "invalid email message not empty");
  await checkReflow(page, `${width}px ${theme} inline errors`);

  await page.locator("#login-email").fill("example@example.test");
  await page.locator("#login-password").fill("correct-but-mocked-password");
  // Mock anti-bot fixture exercises real app challenge-token path, which then
  // reaches the isolated HTTP 503 failure without touching a provider.
  await page.waitForFunction(() => window.__account329Widget?.login);
  await page.evaluate(() => window.__account329Widget.login.callback("fixture-token"));
  await page.locator("#panel-login [data-access-submit]").click();
  await page.locator("[data-access-error][role=alert]").waitFor();
  check(failedLoginCalls > 0, "backend outage reached staged API exactly");
  check((await page.locator("[data-access-error]").innerText()).trim().length > 0, "API error has visible message");
  check(await page.locator("[data-access-error]").evaluate((el) => document.activeElement === el), "API failure focuses alert");
  const failureFocus = await page.locator("[data-access-error]").evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { outline: style.outlineStyle, width: parseFloat(style.outlineWidth), top: rect.top, bottom: rect.bottom, viewport: innerHeight };
  });
  check(failureFocus.outline !== "none" && failureFocus.width >= 2
    && failureFocus.bottom > 0 && failureFocus.top < failureFocus.viewport,
  "focused API error has visible ring and is inside viewport", failureFocus);
  await textContrast(page, "API failure alert", "[data-access-error]", "[data-access-error]", theme, width);
  await checkReflow(page, `${width}px ${theme} API failure`);
  const label = page.locator("#panel-login [data-access-submit]");
  check(await label.isEnabled(), "API failure restores submit for correction/retry");
  check(await page.locator("#panel-login").isVisible(), "no false login on HTTP 503");
  await page.keyboard.press("Tab");
  check(await page.evaluate(() => document.activeElement?.matches(":focus-visible") === true),
    "tab from failure recovers a visible keyboard target");

  // Registration has its own validation and API failure path. Cover all
  // three inline messages and the same error recovery in both themes.
  await page.getByRole("tab", { name: "Crea un account" }).click();
  await page.locator("#panel-register [data-access-submit]").click();
  for (const [field, selector] of [
    ["name", "#register-name-error"],
    ["email", "#register-email-error"],
    ["password", "#register-password-error"],
  ]) {
    check(await page.locator(selector).isVisible(), `register ${field} error visible`);
    await textContrast(page, `register ${field} error`, selector, ".ac-card", theme, width);
  }
  check(await page.locator("#register-name").evaluate((el) => document.activeElement === el),
    "invalid register form focuses first field");
  await page.locator("#register-name").fill("Mario Rossi");
  await page.locator("#register-email").fill("mario@example.test");
  await page.locator("#register-password").fill("password-mocked-329");
  await page.waitForFunction(() => window.__account329Widget?.register);
  await page.evaluate(() => window.__account329Widget.register.callback("fixture-register-token"));
  await page.locator("#panel-register [data-access-submit]").click();
  await page.locator("[data-access-error][role=alert]").waitFor();
  check(await page.locator("[data-access-error]").evaluate((el) => document.activeElement === el),
    "registration 503 focuses alert");
  const registerErrorFocus = await page.locator("[data-access-error]").evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { outline: style.outlineStyle, width: parseFloat(style.outlineWidth), top: rect.top, bottom: rect.bottom, viewport: innerHeight };
  });
  check(registerErrorFocus.outline !== "none" && registerErrorFocus.width >= 2
    && registerErrorFocus.bottom > 0 && registerErrorFocus.top < registerErrorFocus.viewport,
  "focused registration error remains visible and outlined", registerErrorFocus);
  await textContrast(page, "registration API 503 alert", "[data-access-error]", "[data-access-error]", theme, width);
  await checkReflow(page, `${width}px ${theme} registration 503`);
  check(await page.locator("#panel-register [data-access-submit]").isEnabled(), "registration 503 restores submit");
  check(await page.locator("#panel-register").isVisible(), "registration 503 keeps current form");
}

try {
  for (let n = 0; n < 120; n++) {
    try { if ((await fetch(`${origin}/accedi/`)).ok) break; } catch { /* local server start */ }
    if (server && server.exitCode !== null) throw Error(`Astro exited ${server.exitCode}: ${serverLogs.join(" ")}`);
    if (n === 119) throw Error(`Local server unavailable: ${serverLogs.join(" ")}`);
    await delay(250);
  }
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, locale: "it-IT", reducedMotion: "reduce" });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(90_000);
  page.on("pageerror", (e) => browserErrors.push(e.message));
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "https://challenges.cloudflare.com" && url.pathname.startsWith("/turnstile/v0/api.js")) {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: `
        window.__account329Widget = {};
        window.turnstile = {
          render(element, options) { window.__account329Widget[options.action] = options; element.textContent = "Verifica simulata, ambiente locale"; return "fixture-" + options.action; },
          reset() {}
        };
        window.strumentiniTurnstileLoaded();
      ` });
    }
    if (url.origin !== origin) { unexpectedExternalRequests++; return route.abort(); }
    if (url.pathname === "/api/auth/session") return route.fulfill({ status: 200, contentType: "application/json", body: '{"user":null}' });
    if (url.pathname === "/api/auth/google/config") return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Fixture disabilitata"}' });
    if (url.pathname.startsWith("/api/auth/")) {
      if (url.pathname === "/api/auth/login") failedLoginCalls++;
      if (url.pathname === "/api/auth/register") failedRegisterCalls++;
      return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Servizio temporaneamente non disponibile. Riprova."}' });
    }
    return route.continue();
  });

  for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
    await context.clearCookies();
    await page.goto(`${origin}/accedi/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.removeItem("strumentini:theme:v1"));
    await visualMatrix(page, width, theme);
  }
  // Desktop 200% / 400% at a 1280px viewport, measured with equivalent
  // available layout widths. This covers WCAG 1.4.10 reflow, not Chrome's
  // own zoom control, which cannot be asserted from Playwright viewport size.
  for (const [percent, width] of [[200, 640], [400, 320]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/accedi/`, { waitUntil: "domcontentloaded" });
    await checkReflow(page, `1280px desktop at equivalent ${percent}% zoom`);
    await page.locator("#panel-login [data-access-submit]").click();
    await checkReflow(page, `equivalent ${percent}% zoom with errors`);
  }
  check(failedLoginCalls === 4, "exactly one mocked API submission for each width/theme", { failedLoginCalls });
  check(failedRegisterCalls === 4, "exactly one mocked registration API submission per width/theme", { failedRegisterCalls });
  check(unexpectedExternalRequests === 0, "no unexpected external requests", { unexpectedExternalRequests });
  check(browserErrors.length === 0, "no JS uncaught errors", browserErrors);
  const digest = createHash("sha256").update(await readFile("src/pages/accedi.astro")).digest("hex").slice(0, 16);
  const minimum = Math.min(...ratios.map((row) => row.ratio));
  console.log(JSON.stringify({ ticket: 329, sha256AccediPrefix: digest, chrome: browser.version(), assertions, widthThemes: ["320/light", "320/dark", "390/light", "390/dark"], minimumTextContrast: minimum, contrastSamples: ratios, login503Submissions: failedLoginCalls, register503Submissions: failedRegisterCalls, zoomReflowEquivalents: [200, 400], nativeZoom: "NOT_RUN", VoiceOverTalkBack: "NOT_RUN", physicalDevices: "NOT_RUN" }));
  console.log(`PASS #329 local Google Chrome ${assertions} checks, four width/theme variants; AA labels/errors, keyboard/focus, HTTP 503, 200/400% equivalent reflow. Native browser zoom, physical devices, screenreader NOT_RUN.`);
  await context.close();
} finally {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* exited */ } }
}

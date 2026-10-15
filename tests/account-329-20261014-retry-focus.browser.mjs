/** #329: denied account-profile update must preserve visible keyboard recovery.
 * Real /impostazioni/ page; Chrome/WebKit × 320/390 × light/dark.
 * All account writes are local 503 fixtures; no real auth, providers or offsite calls.
 * Physical mobile, native browser zoom and screen readers are NOT_RUN.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, webkit } from "@playwright/test";

const port = 19729;
const origin = process.env.ACCOUNT329_FOCUS_ORIGIN ?? `http://127.0.0.1:${port}`;
const url = new URL(origin);
assert.equal(url.hostname, "127.0.0.1", "Only an isolated local server is allowed");
const server = process.env.ACCOUNT329_FOCUS_ORIGIN ? null : spawn("./node_modules/.bin/astro", [
  "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort",
], { cwd: process.cwd(), stdio: "ignore" });

async function awaitLocalServer() {
  for (let i = 0; i < 100; i++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw Error(`Astro exited ${server.exitCode}`);
    try {
      const response = await fetch(`${origin}/impostazioni/`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Local dev server may still be starting. */ }
    await delay(200);
  }
  throw Error("Local Astro server did not become ready");
}

function contrast(first, second) {
  const luminance = css => {
    const parts = css.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
    assert(parts, `Opaque computed CSS rgb expected: ${css}`);
    const values = parts.slice(1, 4).map(x => {
      const v = Number(x) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const pageErrors = [], offsite = [], reports = [];
let deniedProfilePatches = 0;
try {
  await awaitLocalServer();
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch(engine === chromium ? { channel: "chrome", headless: true } : { headless: true });
    try {
      for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, locale: "it-IT" });
        try {
          let holdNextPatch = false;
          let pendingPatchSeen;
          let releasePendingPatch;
          await context.addInitScript(value => localStorage.setItem("strumentini:theme:v1", value), theme);
          await context.route("**/*", async route => {
            const request = route.request();
            const requested = new URL(request.url());
            if (requested.origin !== origin) {
              offsite.push(request.url());
              return route.abort();
            }
            if (requested.pathname === "/api/auth/session") return route.fulfill({ json: {
              user: { id: "fixture", name: "Persona Test", email: "persona@example.test", passwordEnabled: true, googleConnected: true },
            } });
            if (requested.pathname.startsWith("/api/auth/")) {
              if (request.method() !== "GET") {
                assert.equal(requested.pathname, "/api/auth/profile", "No other account write is allowed");
                assert.equal(request.method(), "PATCH");
                deniedProfilePatches++;
                if (holdNextPatch) {
                  holdNextPatch = false;
                  pendingPatchSeen?.();
                  await new Promise(resolve => { releasePendingPatch = resolve; });
                }
              }
              return route.fulfill({ status: 503, json: { error: "Servizio temporaneamente non disponibile: riprova." } });
            }
            assert(["GET", "HEAD"].includes(request.method()), "No local writes outside the single intercepted profile PATCH");
            return route.continue();
          });
          const page = await context.newPage();
          page.on("pageerror", error => pageErrors.push(`${engine.name()}/${width}/${theme}: ${error.message}`));
          assert.equal((await page.goto(`${origin}/impostazioni/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
          await page.locator("[data-profile-name]:visible").waitFor();
          assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
          await page.locator("#account-name").fill("Persona Nuova");
          await page.keyboard.press(engine === webkit ? "Alt+Tab" : "Tab");
          assert(await page.locator("#account-email").evaluate(el => document.activeElement === el));
          await page.keyboard.press(engine === webkit ? "Alt+Tab" : "Tab");
          assert(await page.locator("[data-account-submit]").evaluate(el => document.activeElement === el && el.matches(":focus-visible")));
          await page.keyboard.press("Enter");
          await page.locator("[data-account-message][role=alert]:visible").waitFor();
          assert(await page.locator("[data-account-submit]").isEnabled());
          const state = await page.evaluate(() => {
            const button = document.querySelector("[data-account-submit]");
            const alert = document.querySelector("[data-account-message]");
            const rect = button.getBoundingClientRect();
            const css = getComputedStyle(button);
            const warning = getComputedStyle(alert);
            return {
              activeSubmit: document.activeElement === button,
              focusVisible: button.matches(":focus-visible"),
              outline: css.outlineStyle, outlineWidth: parseFloat(css.outlineWidth),
              left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
              viewport: document.documentElement.clientWidth, documentWidth: document.documentElement.scrollWidth,
              message: alert.textContent, alertColor: warning.color, alertBackground: warning.backgroundColor,
              identity: document.querySelector("[data-profile-name]").textContent,
            };
          });
          assert(state.activeSubmit && state.focusVisible && state.outline !== "none" && state.outlineWidth >= 2,
            `Keyboard focus must return to retry button after HTTP 503: ${JSON.stringify({engine:engine.name(),width,theme,...state})}`);
          assert(state.left >= 0 && state.right <= width + 1 && state.top >= 0 && state.bottom <= 844,
            "Focused retry control must remain visible without horizontal clipping");
          assert(state.documentWidth <= width + 1, "Denied account update must not introduce horizontal overflow");
          assert(contrast(state.alertColor, state.alertBackground) >= 4.5, "Denied update error must satisfy AA normal-text contrast");
          assert.equal(state.identity, "Persona Test", "Failed update must preserve confirmed prior identity");
          assert.match(state.message, /temporaneamente non disponibile/iu);
          if (engine === chromium && width === 320 && theme === "light") {
            // A user may navigate away while the request is pending. Recover
            // the submit only after actual focus loss, never steal new focus.
            const intercepted = new Promise(resolve => { pendingPatchSeen = resolve; });
            holdNextPatch = true;
            await page.locator("#account-name").fill("Persona Nuova Tentativa");
            await page.locator("[data-account-submit]").focus();
            await page.keyboard.press("Enter");
            await intercepted;
            await page.keyboard.press("Tab");
            const otherFocus = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 160));
            assert(otherFocus && !otherFocus.includes("data-account-submit"), "Keyboard must move away during pending PATCH");
            const otherNode = await page.evaluate(() => {
              document.activeElement?.setAttribute("data-focus-keep-test", "true");
              return document.activeElement?.tagName;
            });
            assert(otherNode);
            releasePendingPatch();
            await page.locator("[data-account-submit]:enabled").waitFor();
            assert(await page.evaluate(() => document.activeElement?.getAttribute("data-focus-keep-test") === "true"),
              "Completed request must not steal the keyboard focus the user moved elsewhere");
            assert.equal(await page.locator("[data-profile-name]").textContent(), "Persona Test");
          }
          reports.push({ engine: engine.name(), width, theme, errorContrast: contrast(state.alertColor, state.alertBackground) });
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  assert.equal(reports.length, 8);
  assert.equal(deniedProfilePatches, 9, "Eight recovery checks plus one delayed request with keyboard navigation");
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(offsite, []);
  console.log("#329 profile 503 keyboard retry focus PASS", JSON.stringify({reports, deniedProfilePatches,
    physicalDevices: "NOT_RUN", nativeZoom: "NOT_RUN", screenreaders: "NOT_RUN"}));
} finally {
  if (server !== null && server.exitCode === null) server.kill("SIGTERM");
}

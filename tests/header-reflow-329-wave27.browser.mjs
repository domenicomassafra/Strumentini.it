/** #329 wave27: live, locally built shared header in installed Chromium/WebKit.
 * Width 320 CSS px models 400%-equivalent 1280px reflow, NOT native zoom.
 * No real auth, remote calls, VoiceOver, or physical-device claim.
 * Run: node tests/header-reflow-329-wave27.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium, webkit } from "@playwright/test";

const root = resolve("dist");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".png": "image/png", ".webp": "image/webp" };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const file = resolve(root, "." + decodeURIComponent(pathname), pathname.endsWith("/") ? "index.html" : "");
    const rel = relative(root, file);
    if (file === root || rel === ".." || rel.startsWith(".." + sep)) return response.writeHead(403).end();
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store" }).end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});

const failures = [], measurements = [], violations = [], external = [], scripts = [];
let browser;
const expect = (condition, description, details) => {
  if (!condition) failures.push({ description, ...details });
};
const snapshot = (selector) => page.evaluate((sel) => {
  const element = document.querySelector(sel);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
    width: rect.width, height: rect.height, display: style.display, visibility: style.visibility,
    outline: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth),
    focusVisible: element.matches(":focus-visible"), focused: document.activeElement === element };
}, selector);
let page;
try {
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const engine of [chromium, webkit]) {
    browser = await engine.launch({ headless: true,
      ...(engine.name() === "chromium"
        ? { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }
        : {}) });
    for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
      const label = { engine: engine.name() === "chromium" ? "Google Chrome" : "WebKit", width, theme };
      const ctx = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: "reduce", locale: "it-IT" });
      await ctx.addInitScript((mode) => localStorage.setItem("strumentini:theme:v1", mode), theme);
      await ctx.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) { external.push(url.href); return route.abort(); }
        if (url.pathname === "/api/auth/session") return route.fulfill({ status: 200,
          contentType: "application/json", body: '{"user":{"id":"fixture","name":"Persona Locale","email":"persona@example.test"}}' });
        if (url.pathname === "/api/auth/logout") return route.fulfill({ status: 503,
          contentType: "application/json", body: '{"error":"Fixture offline"}' });
        if (url.pathname.startsWith("/api/")) {
          if (route.request().method() !== "GET") violations.push(`${route.request().method()} ${url.pathname}`);
          return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Offline"}' });
        }
        if (!["GET", "HEAD"].includes(route.request().method())) {
          violations.push(`${route.request().method()} ${url.pathname}`);
          return route.abort();
        }
        return route.continue();
      });
      page = await ctx.newPage();
      page.on("pageerror", (error) => scripts.push({ ...label, error: error.message }));
      const response = await page.goto(`${origin}/preferiti/`, { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, "Built, real shared header route served locally");
      await page.locator("[data-account-menu]:visible").waitFor({ timeout: 10_000 });
      expect(await page.locator("html").getAttribute("data-theme") === theme,
        "Requested theme must apply", label);
      expect(!(await page.locator("[data-account-login]").isVisible()),
        "Signed-out login must disappear once authenticated", label);

      const doc = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth }));
      const sections = {};
      for (const sel of [".site-header-inner", ".site-brand", ".site-actions", "[data-search-trigger]",
        "[data-account-toggle]", ".site-menu-button", "[data-account-dropdown]"]) {
        const box = await snapshot(sel);
        sections[sel] = box;
        if (sel !== "[data-account-dropdown]") expect(box && box.left >= -1 && box.right <= width + 1,
          `Header ${sel} must remain in narrow viewport`, { ...label, box });
      }
      const closed = sections["[data-account-dropdown]"];
      expect(closed?.display === "none", "Closed account dropdown must be rendered hidden", { ...label, closed });
      expect(doc.scroll <= doc.client + 1, "No document horizontal scrolling", { ...label, doc });
      measurements.push({ ...label, doc, ...sections });

      // Actual key traversal. Option+Tab matches WebKit macOS's full-keyboard-navigation behavior.
      const key = engine.name() === "webkit" ? "Alt+Tab" : "Tab";
      let reached = false;
      let reachedAccount = false;
      let reachedClosedItem = false;
      for (let i = 0; i < 24; i++) {
        await page.keyboard.press(key);
        if (await page.evaluate(() => Boolean(document.activeElement?.closest("[data-account-dropdown]"))))
          reachedClosedItem = true;
        if (await page.locator("[data-account-toggle]").evaluate((el) => document.activeElement === el)) {
          reachedAccount = true;
          const focusedAccount = await snapshot("[data-account-toggle]");
          expect(focusedAccount?.focusVisible && focusedAccount.outline !== "none" && focusedAccount.outlineWidth >= 2,
            "Authenticated account button has visible keyboard focus", { ...label, focusedAccount });
        }
        if (await page.locator(".site-menu-button").evaluate((el) => document.activeElement === el)) {
          reached = true;
          break;
        }
      }
      expect(reachedAccount, "Signed-in account control reachable from keyboard", label);
      expect(!reachedClosedItem, "Closed account menu entries skipped in keyboard traversal", label);
      expect(reached, "Menu toggle reachable from keyboard", label);
      if (reached) {
        const focused = await snapshot(".site-menu-button");
        expect(focused.focusVisible && focused.outline !== "none" && focused.outlineWidth >= 2,
          "Menu trigger has visible keyboard focus", { ...label, focused });
        await page.keyboard.press("Enter");
        expect(await page.locator("#site-mobile-panel").isVisible(), "Keyboard opens mobile panel", label);
        await page.keyboard.press("Escape");
        expect(await page.locator("#site-mobile-panel").isHidden(), "Escape closes mobile panel", label);
      }

      await page.locator("[data-account-toggle]").click();
      const open = await snapshot("[data-account-dropdown]");
      expect(open?.left >= -1 && open?.right <= width + 1 && open?.display !== "none",
        "Opened account dropdown stays visible within screen", { ...label, open });
      await page.locator("[data-account-logout]").click();
      await page.locator("[data-account-logout-error]:visible").waitFor();
      const error = await snapshot("[data-account-logout-error]");
      expect(error?.left >= -1 && error?.right <= width + 1 && error?.focused,
        "Failed-logout alert and keyboard focus remain on screen", { ...label, error });
      expect(error?.outline !== "none" && error?.outlineWidth >= 2,
        "Programmatically focused logout alert retains a visible focus indicator", { ...label, error });
      expect(await page.locator("[data-account-toggle]").getAttribute("aria-expanded") === "false",
        "Failed logout closes the account menu", label);
      const afterError = await page.evaluate(() => ({ client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth }));
      expect(afterError.scroll <= afterError.client + 1, "Error state does not overflow document", { ...label, afterError });
      measurements[measurements.length - 1].logoutError = error;
      await ctx.close();
    }
    await browser.close();
    browser = undefined;
  }
  assert.deepEqual(violations, [], "Only fixture auth/session/logout calls allowed");
  assert.deepEqual(scripts, [], "No page script exceptions");
  assert.deepEqual(external, [], "No external calls permitted in this header-only test");
  console.log("HEADER329 measured", JSON.stringify(measurements.map((x) => ({
    engine: x.engine, width: x.width, theme: x.theme, doc: x.doc,
    dropdown: x["[data-account-dropdown]"], error: x.logoutError
  }))));
  assert.deepEqual(failures, [], "Real browser header failures: " + JSON.stringify(failures));
  console.log("PASS #329 wave27 installed Google Chrome + WebKit, 320/390 CSS widths light/dark, authenticated global shell, keyboard/Escape, logout error fully on screen, fixture-only auth");
} finally {
  await browser?.close();
  if (server.listening) await new Promise((ok) => server.close(ok));
}

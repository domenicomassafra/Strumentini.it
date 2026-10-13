/**
 * #350: An open mobile sheet must not keep the desktop page scroll-locked
 * after the viewport crosses the desktop-navigation breakpoint. Real installed
 * Chrome and WebKit, CSS viewport resize (not native zoom/physical devices).
 * Run after an Astro build: node tests/site-header-350-20261013-responsive.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium, webkit } from "@playwright/test";

const dist = resolve(process.env.SITE_HEADER_350_DIST ?? "dist");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".png": "image/png", ".webp": "image/webp" };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const file = resolve(dist, "." + decodeURIComponent(path), path.endsWith("/") ? "index.html" : "");
    const rel = relative(dist, file);
    if (file === dist || rel === ".." || rel.startsWith(".." + sep)) return res.writeHead(403).end();
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" })
      .end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});

await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
const origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
try {
  for (const [name, engine, launch] of [
    ["Google Chrome", chromium, { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true }],
    ["WebKit", webkit, { headless: true }],
  ]) {
    if (process.env.SITE_HEADER_350_ENGINE && process.env.SITE_HEADER_350_ENGINE !== name) continue;
    const browser = await engine.launch(launch);
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 750 },
        reducedMotion: "reduce", locale: "it-IT" });
      const writes = [], errors = [];
      await context.route("**/*", (route) => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503,
          contentType: "application/json", body: '{"error":"local-fixture"}' });
        if (!["GET", "HEAD"].includes(request.method())) {
          writes.push(`${request.method()} ${url.pathname}`);
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      assert.equal((await page.goto(origin + "/strumenti/", { waitUntil: "domcontentloaded" }))?.status(), 200);
      const toggle = page.locator("[data-mobile-toggle]");
      const panel = page.locator("[data-mobile-panel]");
      const brand = page.locator(".site-brand");
      const search = page.locator("[data-search-trigger]");
      const settle = () => page.evaluate(() =>
        new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const snapshot = () => page.evaluate(() => {
        const trigger = document.querySelector("[data-mobile-toggle]");
        const sheet = document.querySelector("[data-mobile-panel]");
        const active = document.activeElement;
        return {
          buttonVisible: trigger.getClientRects().length > 0,
          panelVisible: sheet.getClientRects().length > 0,
          bodyLocked: document.body.classList.contains("site-mobile-open"),
          overflow: getComputedStyle(document.body).overflow,
          expanded: trigger.getAttribute("aria-expanded"),
          panelHidden: sheet.hasAttribute("hidden"),
          desktopNavVisible: document.querySelector(".site-nav").getClientRects().length > 0,
          focusOnBrand: active === document.querySelector(".site-brand"),
          focusOnSearch: active === document.querySelector("[data-search-trigger]"),
          focusOnBody: active === document.body,
          focusInHiddenMobileMenu: active === trigger || sheet.contains(active),
          focusedTag: active?.tagName,
        };
      });
      const openFromKeyboard = async () => {
        await toggle.focus();
        assert.equal(await toggle.evaluate((node) => document.activeElement === node), true);
        await page.keyboard.press("Enter");
        assert.equal(await panel.isVisible(), true, `${name}: menu opens by keyboard`);
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        assert.equal((await snapshot()).overflow, "hidden", `${name}: open menu locks page scrolling`);
      };
      // Optional RED negative control: suppress only the visible-brand focus()
      // handoff on the browser node. The real page and build remain untouched,
      // proving the production-facing focus assertion rejects BODY fallback.
      const suppressBrandHandoff = async (scenario) => {
        if (process.env.SITE_HEADER_350_NEGATIVE_CONTROL !== scenario) return;
        await brand.evaluate((node) => { node.focus = () => {}; });
      };
      const assertDesktopClosed = (desktop, label) => {
        assert(desktop.desktopNavVisible && !desktop.buttonVisible && !desktop.panelVisible,
          `${name} ${label}: desktop breakpoint must show the desktop nav: ${JSON.stringify(desktop)}`);
        assert(!desktop.bodyLocked && desktop.overflow !== "hidden" && desktop.expanded === "false" && desktop.panelHidden,
          `${name} ${label}: desktop breakpoint must release lock and close ARIA state: ${JSON.stringify(desktop)}`);
      };

      // Exact CSS media query boundary: the open menu and its keyboard-focused
      // toggle must remain visible at 1059, then focus must move to the visible
      // brand at 1060. BODY focus is an accessibility regression, not a pass.
      await openFromKeyboard();
      await page.setViewportSize({ width: 1059, height: 750 });
      await settle();
      const mobileEdge = await snapshot();
      assert(mobileEdge.buttonVisible && mobileEdge.panelVisible && mobileEdge.bodyLocked &&
        mobileEdge.expanded === "true" && mobileEdge.focusInHiddenMobileMenu,
        `${name}: 1059px must still retain the open, focused mobile menu: ${JSON.stringify(mobileEdge)}`);
      await suppressBrandHandoff("toggle");
      await page.setViewportSize({ width: 1060, height: 750 });
      await settle();
      const fromToggle = await snapshot();
      assertDesktopClosed(fromToggle, "toggle focus 1059→1060");
      assert(fromToggle.focusOnBrand, `${name}: toggle focus must transfer to visible brand at 1060 (BODY is invalid): ${JSON.stringify(fromToggle)}`);
      results.push({ name, case: "toggle 1059→1060", state: fromToggle });

      // Distinct focus origin: a real, visible mobile-panel link rather than
      // the trigger; the same desktop brand must receive focus after resize.
      await page.setViewportSize({ width: 390, height: 750 });
      await settle();
      assert.equal(await panel.isVisible(), false, `${name}: returning to mobile must not reopen stale sheet`);
      await openFromKeyboard();
      const mobileLink = panel.locator('.site-mobile-extra a.site-mobile-link[href="/preferiti/"]');
      assert.equal(await mobileLink.isVisible(), true);
      await mobileLink.focus();
      assert.equal(await mobileLink.evaluate((node) => document.activeElement === node), true);
      await suppressBrandHandoff("link");
      await page.setViewportSize({ width: 1280, height: 750 });
      await settle();
      const fromLink = await snapshot();
      assertDesktopClosed(fromLink, "panel link focus 390→1280");
      assert(fromLink.focusOnBrand, `${name}: hidden mobile-panel link must transfer focus to visible brand (not BODY): ${JSON.stringify(fromLink)}`);
      results.push({ name, case: "panel link 390→1280", state: fromLink });

      // A deliberately focused, still-visible control outside the mobile
      // sheet must keep its focus; resize cleanup must not steal it.
      await page.setViewportSize({ width: 390, height: 750 });
      await settle();
      await openFromKeyboard();
      await search.focus();
      assert.equal(await search.evaluate((node) => document.activeElement === node), true,
        `${name}: external search trigger must be focusable in the mobile header`);
      await page.setViewportSize({ width: 1280, height: 750 });
      await settle();
      const fromExternal = await snapshot();
      assertDesktopClosed(fromExternal, "external focus 390→1280");
      assert(fromExternal.focusOnSearch && !fromExternal.focusOnBrand,
        `${name}: preserve focused visible external control without stealing focus: ${JSON.stringify(fromExternal)}`);
      results.push({ name, case: "external search 390→1280", state: fromExternal });

      await page.setViewportSize({ width: 390, height: 750 });
      await settle();
      assert.equal(await panel.isVisible(), false, `${name}: menu must stay closed when returning to mobile`);
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await brand.isVisible(), true, `${name}: brand must remain visible at 390px`);
      assert.deepEqual(writes, [], `${name}: no state-changing requests`);
      assert.deepEqual(errors, [], `${name}: no page script exceptions`);
      await context.close();
    } finally { await browser.close(); }
  }
  console.log(`PASS #350 responsive menu breakpoint, Chrome + WebKit, ${JSON.stringify(results)}`);
} finally {
  await new Promise((done) => server.close(done));
}

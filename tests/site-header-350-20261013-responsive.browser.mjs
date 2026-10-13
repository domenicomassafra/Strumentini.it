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
      await toggle.focus();
      await page.keyboard.press("Enter");
      assert.equal(await panel.isVisible(), true, `${name} mobile menu must open by keyboard`);
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      const open = await page.evaluate(() => ({ locked: document.body.classList.contains("site-mobile-open"),
        overflow: getComputedStyle(document.body).overflow }));
      assert.equal(open.locked, true);
      assert.equal(open.overflow, "hidden", `${name}: mobile sheet should lock page scroll`);

      await page.setViewportSize({ width: 1280, height: 750 });
      // matchMedia `change` is delivered asynchronously after the viewport
      // update; sample after two layout frames, not inside that same tick.
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const desktop = await page.evaluate(() => ({
        buttonVisible: document.querySelector("[data-mobile-toggle]").getClientRects().length > 0,
        panelVisible: document.querySelector("[data-mobile-panel]").getClientRects().length > 0,
        bodyLocked: document.body.classList.contains("site-mobile-open"),
        overflow: getComputedStyle(document.body).overflow,
        expanded: document.querySelector("[data-mobile-toggle]").getAttribute("aria-expanded"),
        panelHidden: document.querySelector("[data-mobile-panel]").hasAttribute("hidden"),
        desktopNavVisible: document.querySelector(".site-nav").getClientRects().length > 0,
        focusInHiddenMobileMenu: document.activeElement === document.querySelector("[data-mobile-toggle]")
          || Boolean(document.querySelector("[data-mobile-panel]").contains(document.activeElement)),
      }));
      results.push({ name, desktop });
      assert(desktop.desktopNavVisible && !desktop.buttonVisible && !desktop.panelVisible,
        `${name}: desktop breakpoint should show desktop nav: ${JSON.stringify(desktop)}`);
      assert(!desktop.bodyLocked && desktop.overflow !== "hidden" && desktop.expanded === "false" && desktop.panelHidden,
        `${name}: hidden mobile sheet must release scroll lock/ARIA state at desktop width: ${JSON.stringify(desktop)}`);
      assert(!desktop.focusInHiddenMobileMenu,
        `${name}: keyboard focus must not remain on a hidden menu control: ${JSON.stringify(desktop)}`);

      await page.setViewportSize({ width: 390, height: 750 });
      assert.equal(await panel.isVisible(), false, `${name}: returning to mobile must not reopen stale sheet`);
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.deepEqual(writes, [], `${name}: no state-changing requests`);
      assert.deepEqual(errors, [], `${name}: no page script exceptions`);
      await context.close();
    } finally { await browser.close(); }
  }
  console.log(`PASS #350 responsive menu breakpoint, Chrome + WebKit, ${JSON.stringify(results)}`);
} finally {
  await new Promise((done) => server.close(done));
}

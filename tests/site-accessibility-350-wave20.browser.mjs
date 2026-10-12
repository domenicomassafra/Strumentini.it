/**
 * #350 independent keyboard-focus occlusion regression on the actual built site.
 * Menu open + Tab after its final action must not focus underlying page content.
 * True Chrome and WebKit engines at 320/390 CSS px (400%-equivalent reflow),
 * not a native zoom, physical iOS or VoiceOver claim.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium, webkit } from "@playwright/test";

const dist = resolve("dist");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp" };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const file = resolve(dist, "." + decodeURIComponent(path), path.endsWith("/") ? "index.html" : "");
    const rel = relative(dist, file);
    if (rel === ".." || rel.startsWith(".." + sep) || file === dist) return res.writeHead(403).end();
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" }).end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const origin = "http://127.0.0.1:" + server.address().port;
const browsers = [
  ["Chrome", chromium, { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true }],
  ["WebKit", webkit, { headless: true }],
];

try {
  for (const [label, engine, options] of browsers) {
    const browser = await engine.launch(options);
    try {
      const context = await browser.newContext({ reducedMotion: "reduce", locale: "it-IT",
        viewport: { width: 320, height: 850 } });
      // Offline and side-effect-free: no third-party, state-changing or auth execution.
      const writes = [];
      await context.route("**/*", (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"fixture-only"}' });
        if (!["GET", "HEAD"].includes(request.method())) {
          writes.push(request.method() + " " + url.pathname);
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 850 });
        const response = await page.goto(origin + "/strumenti/", { waitUntil: "domcontentloaded" });
        assert.equal(response?.status(), 200);
        const button = page.locator("[data-mobile-toggle]");
        const panel = page.locator("[data-mobile-panel]");
        await button.click();
        assert.equal(await button.getAttribute("aria-expanded"), "true");
        assert.equal(await panel.isVisible(), true);
        const result = await page.evaluate(() => {
          const panel = document.querySelector("[data-mobile-panel]");
          const button = document.querySelector("[data-mobile-toggle]");
          const last = panel?.querySelector('nav > a[href="/accedi/"]');
          const footer = document.querySelector("footer a[href]");
          if (!(last instanceof HTMLElement) || !(button instanceof HTMLElement) || !(footer instanceof HTMLElement)) return { missing: true };
          last.focus();
          return { initial: document.activeElement === last, label: last.textContent?.trim(), footer: footer.textContent?.trim() };
        });
        assert(result.initial, label + " missing last mobile menu action " + JSON.stringify(result));
        await page.keyboard.press("Tab");
        const next = await page.evaluate(() => ({
          inPanel: Boolean(document.activeElement?.closest("[data-mobile-panel]")),
          isToggle: document.activeElement === document.querySelector("[data-mobile-toggle]"),
          active: document.activeElement?.outerHTML.slice(0, 210),
          panelOpen: !document.querySelector("[data-mobile-panel]")?.hasAttribute("hidden"),
        }));
        assert(next.inPanel || next.isToggle, `${label} ${width}px: Tab escaped full-screen menu into obscured page content: ${JSON.stringify(next)}`);
        await button.focus();
        await page.keyboard.press("Shift+Tab");
        const previous = await page.evaluate(() => ({
          inPanel: Boolean(document.activeElement?.closest("[data-mobile-panel]")),
          isToggle: document.activeElement === document.querySelector("[data-mobile-toggle]"),
          active: document.activeElement?.outerHTML.slice(0, 210),
        }));
        assert(previous.inPanel || previous.isToggle, `${label} ${width}px: reverse Tab escaped full-screen menu: ${JSON.stringify(previous)}`);
        // Round trip through the same real focus boundary in the other direction.
        await page.keyboard.press("Tab");
        assert.equal(await button.evaluate((node) => document.activeElement === node), true,
          `${label} ${width}px: forward Tab from final menu action must wrap to its toggle`);
        await page.keyboard.press("Tab");
        assert.equal(await panel.locator(".site-mobile-menu > summary").first()
          .evaluate((node) => document.activeElement === node), true,
        `${label} ${width}px: next Tab from toggle must enter the visible mobile navigation`);
        await page.keyboard.press("Escape");
        assert.equal(await button.getAttribute("aria-expanded"), "false");
        assert.equal(await button.evaluate((node) => document.activeElement === node), true);
        await page.keyboard.press("Tab");
        const afterClose = await page.evaluate(() => ({
          isToggle: document.activeElement === document.querySelector("[data-mobile-toggle]"),
          inPanel: Boolean(document.activeElement?.closest("[data-mobile-panel]")),
        }));
        assert(!afterClose.isToggle && !afterClose.inPanel,
          `${label} ${width}px: closed menu must release keyboard focus to normal page order`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
        assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
        console.log(`PASS #350 ${label} ${width}px open mobile nav stays keyboard-accessible, Escape recovers, reduced-motion and reflow`);
      }
      assert.deepEqual(writes, [], label + ": no state-changing requests");
      assert.deepEqual(errors, [], label + ": no JavaScript exceptions");
      await context.close();
    } finally { await browser.close(); }
  }
  console.log("NOT_RUN #350 physical iOS, native browser zoom, VoiceOver/TalkBack and automated axe");
} finally { await new Promise((done) => server.close(done)); }

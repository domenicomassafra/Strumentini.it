/**
 * STR-360: exercise onboarding's actual hydrated client in Chromium.
 * CSS cannot override an explicit smooth-scrolling Window.scrollTo option.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

const dist = resolve("dist");
const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".woff2": "font/woff2", ".svg": "image/svg+xml",
};
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const file = resolve(dist, "." + decodeURIComponent(pathname), pathname.endsWith("/") ? "index.html" : "");
    const rel = relative(dist, file);
    if (rel === ".." || rel.startsWith(".." + sep) || file === dist) return response.writeHead(403).end();
    const data = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" }).end(data);
  } catch { response.writeHead(404).end(); }
});
await new Promise((done, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", done);
});
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  try {
    for (const reducedMotion of ["reduce", "no-preference"]) {
      for (const width of [320, 390, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion });
        try {
          await context.addInitScript(() => {
            window.__motion360Scrolls = [];
            const original = window.scrollTo.bind(window);
            window.scrollTo = (...args) => {
              window.__motion360Scrolls.push(args[0]);
              return original(...args);
            };
          });
          await context.route("**/*", (route) => {
            const url = new URL(route.request().url());
            if (url.origin !== origin || url.pathname.startsWith("/api/")) return route.abort();
            return route.continue();
          });
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          const response = await page.goto(origin + "/onboarding/", { waitUntil: "networkidle" });
          assert.equal(response?.status(), 200);
          await page.locator('[data-ready="true"]').waitFor();
          assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), reducedMotion === "reduce");
          if (reducedMotion === "reduce") {
            assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), "auto",
              `${width}px: reduced-motion CSS must keep the root scroll behavior instant`);
          }
          await page.locator('[data-onboarding-action="start"]').click();
          await page.locator('[data-stage="2"]').waitFor();
          const scrolls = await page.evaluate(() => window.__motion360Scrolls);
          assert.equal(scrolls.length, 1, `missing or repeated stage scroll at ${width}px, ${reducedMotion}`);
          const expected = reducedMotion === "reduce" ? "auto" : "smooth";
          assert.equal(scrolls[0].behavior, expected,
            `${width}px ${reducedMotion}: stage navigation requested ${scrolls[0].behavior}, expected ${expected}`);
          const transitionSeconds = await page.locator('[data-context-id]').first().evaluate((element) =>
            getComputedStyle(element).transitionDuration.split(",").map((value) => Number.parseFloat(value)));
          assert.equal(transitionSeconds.every((seconds) => reducedMotion === "reduce" ? seconds <= 0.001 : seconds > 0.01), true,
            `${width}px ${reducedMotion}: onboarding selection transitions ${transitionSeconds.join(", ")}s`);
          // Reached steps remain usable with only the keyboard.
          await page.locator('ol[aria-label] button').first().focus();
          await page.keyboard.press("Enter");
          await page.locator('[data-stage="1"]').waitFor();
          assert.equal(await page.evaluate(() => window.__motion360Scrolls.at(-1)?.behavior), expected);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true,
            `horizontal overflow at ${width}px, ${reducedMotion}`);
          assert.deepEqual(errors, [], `${width}px ${reducedMotion}: runtime errors`);
          console.log(`PASS STR-360 Chrome ${width}px ${reducedMotion}: ${expected} scroll, step 2 visible, no overflow/errors`);
        } finally { await context.close(); }
      }
    }
    const noJs = await browser.newContext({ viewport: { width: 320, height: 800 }, javaScriptEnabled: false });
    try {
      const page = await noJs.newPage();
      await page.goto(origin + "/onboarding/", { waitUntil: "load" });
      const skip = page.getByRole("link", { name: /Salta/u });
      assert.equal(await skip.isVisible(), true,
        "without JavaScript the onboarding must provide a visible escape to the catalogue");
      assert.equal(await skip.getAttribute("href"), "/strumenti/");
      console.log("PASS STR-360 Chrome 320px no-JS: onboarding SSR retains a visible catalogue link");
    } finally { await noJs.close(); }
  } finally { await browser.close(); }
} finally { await new Promise((done) => server.close(done)); }

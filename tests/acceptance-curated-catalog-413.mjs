/** #413 real local browser: curated homepage, full catalog independent of it. */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 19413;
const origin = process.env.CATALOG413_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.CATALOG413_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: "ignore" });
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* waiting local server */ }
    if (server?.exitCode != null) throw new Error("Astro dev server exited");
    if (i === 79) throw new Error("Astro dev server not responsive");
    await sleep(250);
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  assert.equal((await page.goto(origin, { waitUntil: "networkidle" }))?.status(), 200);
  const starterList = page.locator(".home-starter-grid");
  const starterLinks = starterList.locator("li h3 a");
  assert.equal(await starterList.locator("li").count(), 8);
  const hrefs = await starterLinks.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")));
  assert.equal(new Set(hrefs).size, 8);
  assert(hrefs.every((href) => /^\/tools\/[a-z0-9-]+\/?$/u.test(href)));
  assert((await starterList.locator("xpath=..").innerText()).includes("non sono una classifica di popolarità"));
  assert.equal((await page.goto(`${origin}/strumenti/`, { waitUntil: "networkidle" }))?.status(), 200);
  assert((await page.locator("body").innerText()).includes("269"));
  assert.equal((await page.goto(`${origin}/tools/csv-sort/`, { waitUntil: "networkidle" }))?.status(), 200);
  assert(!hrefs.includes("/tools/csv-sort/"), "non-featured routes remain available");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  assert.deepEqual(errors, []);
  await browser.close();
  browser = undefined;
  console.log("#413 Chromium PASS: eight disclosed editorial jobs, full 269-tool catalog, non-curated route accessible and no mobile overflow");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

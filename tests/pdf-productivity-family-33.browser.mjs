/** #33: real canonical route navigation at phone viewport; no implicit file handoff. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = 18633;
const origin = process.env.PDF33_ORIGIN?.replace(/\/$/u, "") ?? `http://127.0.0.1:${port}`;
const server = process.env.PDF33_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"],
  { cwd: root, stdio: "ignore" });
let browser;
let count = 0;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { ready = (await fetch(`${origin}/tools/pdf-multi-text-search/`)).ok; if (ready) break; }
    catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, "Canonical PDF multi-search route did not start");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin + "/") && !url.startsWith("blob:") && !url.startsWith("data:")) external.push(url);
  });
  for (const route of ["pdf-multi-text-search", "pdf-split"]) {
    const response = await page.goto(`${origin}/tools/${route}/`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.locator("[data-pdf-family-routes-33]").waitFor({ timeout: 45000 });
    const nav = page.locator('[aria-label="Altre operazioni PDF verificate"]');
    const links = nav.locator('a[href^="/tools/"]');
    assert.equal(await links.count(), 8, "Navigation must exclude only its current route");
    const hrefs = await links.evaluateAll((elements) => elements.map((element) => element.getAttribute("href")));
    assert.equal(new Set(hrefs).size, 8);
    assert(!hrefs.includes(`/tools/${route}/`), "Navigation must not link to its own current route");
    assert.match(await nav.innerText(), /selezionare di nuovo il file/u);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px overflow");
    count += 5;
    if (route === "pdf-multi-text-search") {
      for (const href of hrefs) {
        const link = await page.request.get(origin + href);
        assert.equal(link.status(), 200, `Broken canonical destination: ${href}`);
        count++;
      }
    }
  }
  assert.deepEqual(external, [], "Unexpected remote request during local PDF navigation");
  assert.deepEqual(errors, [], "Browser exception during PDF navigation");
  count += 2;
  console.log(`PDF_33_BROWSER_PASS checks=${count} viewport=390x844 routes=9 canonical=true offsite=0`);
} finally {
  await browser?.close();
  if (server) { server.kill("SIGTERM"); }
}

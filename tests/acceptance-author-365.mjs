/** #365 public transparency page: truthful content and catalog access. */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 19465;
const origin = process.env.AUTHOR365_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.AUTHOR365_ORIGIN
  ? null
  : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: "ignore" });

let browser;
try {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* wait */ }
    if (server?.exitCode != null) throw new Error("Astro dev server exited");
    await sleep(250);
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  assert.equal((await page.goto(`${origin}/chi-siamo/`, { waitUntil: "networkidle" }))?.status(), 200);
  const body = await page.locator("body").innerText();
  assert(body.includes("Chi siamo e trasparenza"));
  assert(body.includes("269 strumenti"));
  assert(body.includes("non pubblichiamo statistiche di utilizzo prive di una fonte"));
  assert(body.includes("Esempi editoriali"));
  const editorialLinks = await page.getByRole("heading", { name: "Esempi editoriali" })
    .locator("..").locator('a[href^="/tools/"]').evaluateAll(links =>
      links.map(link => link.getAttribute("href")),
    );
  assert.equal(editorialLinks.length, 8, "all eight curated jobs must be visible");
  assert.equal(new Set(editorialLinks).size, 8, "curation must not hide jobs behind duplicate links");
  assert(editorialLinks.every(route => /^\/tools\/[a-z0-9-]+\/$/u.test(route)));
  const aboutLinks=editorialLinks.map(route=>route.replace(/\/$/u,"")).toSorted();
  assert.equal(await page.locator('footer a[href="/chi-siamo/"]').count(),1);
  assert.equal(await page.locator('a[href="/strumenti/"]').count()>0,true);
  assert.equal(body.includes("utenti registrati"), false);
  assert.equal(body.includes("migliaia di utenti"), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  // Compare against the real, current homepage curation rather than a second
  // hand-maintained list of supposedly popular tools.
  assert.equal((await page.goto(origin+"/",{waitUntil:"domcontentloaded"}))?.status(),200);
  const homepageLinks=await page.locator('.home-starter-grid a[href^="/tools/"]').evaluateAll(links =>
    links.map(link => link.getAttribute("href")),
  );
  assert.deepEqual([...new Set(homepageLinks)].toSorted(),aboutLinks,
    "transparency examples must exactly match current homepage editorial manifest");
  assert.deepEqual(errors, []);

  await browser.close();
  browser = undefined;
  console.log("#365 Chromium PASS: transparency page exposes catalog, editorial examples and no unsupported metrics");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

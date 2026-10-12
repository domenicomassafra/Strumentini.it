// #365 — independent public-copy and editorial-route verification on the built site.
// Run: node tests/editorial-truth-365-next.browser.mjs [optional local static origin]
// Desktop Chrome at 390px: not proof of a physical mobile device or an author identity.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { catalog } from "../src/generated/catalog.ts";
import { EDITORIAL_STARTERS_413, curateHomeTools413 } from "../src/catalog/home-curation-413.ts";

const origin = process.argv[2] ?? "http://127.0.0.1:19365";
const server = process.argv[2] ? null : spawn("python3", ["-m", "http.server", "19365", "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser;

function canonicalPath(href) {
  assert.match(href, /^\/tools\/[a-z0-9-]+\/?$/u);
  return href.endsWith("/") ? href.slice(0, -1) : href;
}

async function documentWidth(page, description) {
  const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(width.scroll <= width.client + 1, `${description}: overflow 390px ${JSON.stringify(width)}`);
}

try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server?.exitCode != null) throw Error(`Static server exit: ${server.exitCode}`);
    try { if ((await fetch(origin)).ok) break; } catch { /* waiting for server */ }
    if (attempt === 99) throw Error(`Server unavailable: ${origin}`);
    await delay(150);
  }
  const selected = curateHomeTools413(catalog);
  assert.equal(selected.length, EDITORIAL_STARTERS_413.length);
  assert.equal(selected.length, 8);
  assert.equal(new Set(selected.map(({ tool }) => tool.id)).size, 8);
  assert(selected.every(({ tool }) => tool.jobs.some((job) => job.trim().length > 0)), "No claimed editorial job without a manifest job");
  assert(selected.every(({ tool }) => tool.runtime.location === "LOCAL" && tool.runtime.network === "forbidden"));

  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.setDefaultNavigationTimeout(30_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  assert.equal((await page.goto(origin + "/", { waitUntil: "domcontentloaded" }))?.status(), 200);
  await documentWidth(page, "home");
  const homeCuration = page.locator(".home-starter-grid");
  const visibleCards = await homeCuration.locator("li h3 a").evaluateAll((nodes) => nodes.map((node) => ({
    route: node.getAttribute("href"), name: node.textContent?.trim(), visible: node.getBoundingClientRect().width > 0,
  })));
  assert.equal(visibleCards.length, selected.length);
  assert(visibleCards.every(({ visible }) => visible), "Curated job card hidden at 390px");
  assert.deepEqual(visibleCards.map(({ route }) => canonicalPath(route)), selected.map(({ tool }) => tool.route), "Visible order differs from source editorial IDs");
  assert.deepEqual(visibleCards.map(({ name }) => name), selected.map(({ tool }) => tool.name), "Displayed card name differs from manifest");
  const starterText = await homeCuration.locator("xpath=..").innerText();
  assert.match(starterText, /Otto esempi editoriali/u);
  assert.match(starterText, /non sono una classifica di popolarità/u);

  assert.equal((await page.goto(origin + "/chi-siamo/", { waitUntil: "domcontentloaded" }))?.status(), 200);
  await documentWidth(page, "about");
  const mainText = await page.locator(".about-page").innerText();
  assert.match(mainText, /Non attribuiamo il progetto a persone specifiche/u);
  assert.match(mainText, /non pubblichiamo statistiche di utilizzo prive di una fonte/u);
  assert.match(mainText, new RegExp(`catalogo completo di ${catalog.length} strumenti`, "u"));
  assert.doesNotMatch(mainText, /(?:migliaia|milioni) di (?:utenti|persone)|\b\d+[.,]?\d*\s+(?:utenti attivi|recensioni|testimonianze)\b|scelti dagli utenti|il più popolare/iu);
  const editorialExamples = page.getByRole("heading", { name: "Esempi editoriali" }).locator("..").locator("a[href^='/tools/']");
  const aboutLinks = await editorialExamples.evaluateAll((anchors) => anchors.map((anchor) => ({ href: anchor.getAttribute("href"), text: anchor.textContent?.trim() })));
  assert.equal(aboutLinks.length, selected.length);
  assert.deepEqual(aboutLinks.map(({ href }) => canonicalPath(href)), selected.map(({ tool }) => tool.route));
  assert.deepEqual(aboutLinks.map(({ text }) => text), selected.map(({ tool, job }) => `${job} — ${tool.name}`));

  for (const { tool } of selected) {
    const response = await page.goto(origin + tool.route + "/", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, `${tool.id}: editorial link broken`);
    const surface = page.locator(`[data-tool-page="${tool.id}"]`);
    assert.equal(await surface.count(), 1, `${tool.id}: no matching actual tool surface`);
    assert.equal(await surface.getAttribute("data-runtime"), "LOCAL", `${tool.id}: unsupported execution location`);
    assert.equal(await surface.getAttribute("data-network"), "forbidden", `${tool.id}: unsupported network claim`);
    assert.equal((await surface.locator("h1").first().innerText()).trim(), tool.name, `${tool.id}: actual page title differs from manifest`);
    await documentWidth(page, tool.id);
  }

  // An unfeatured manifest tool must still have a genuinely public tool page.
  const unfeatured = catalog.find((tool) => tool.id === "csv-sort");
  assert(unfeatured && !selected.some(({ tool }) => tool.id === unfeatured.id));
  assert.equal((await page.goto(origin + unfeatured.route + "/", { waitUntil: "domcontentloaded" }))?.status(), 200);
  assert.equal(await page.locator(`[data-tool-page="${unfeatured.id}"]`).count(), 1);
  assert.equal((await page.goto(origin + "/strumenti/", { waitUntil: "domcontentloaded" }))?.status(), 200);
  assert.match(await page.locator("main").innerText(), new RegExp(`${catalog.length} strumenti`, "u"));
  assert.deepEqual(errors, [], "Public 390px browser exceptions");
  console.log(`#365 PASS real Chrome built site at 390px: ${selected.length} curated published LOCAL routes, manifest jobs, truthful editorial page, no unmeasured testimonials, ${catalog.length} catalog entries, noncurated CSV route, no overflow.`);
  console.log("#365 Author identity remains unverified: /chi-siamo/ is transparent but cannot establish a named human author.");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

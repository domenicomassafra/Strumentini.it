/** #008 real public route acceptance. Start Astro dev locally first:
 * npm exec astro dev -- --host 127.0.0.1 --port 4368
 * node tests/codice-fiscale-public-08.browser.mjs
 */
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const origin = process.env.CF08_TEST_BASE_URL ?? "http://127.0.0.1:4368";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const events = [];
const errors = [];
const checks = [];
const mark = (label) => { checks.push(label); };
try {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on("request", (req) => events.push({ method: req.method(), url: req.url(), body: req.postData() }));
  page.on("pageerror", (err) => errors.push(err.message));
  const response = await page.goto(`${origin}/tools/codice-fiscale/`, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  assert.equal(await page.locator('[data-cf-public-tool="08"]').count(), 1);
  assert.match(await page.locator("h1").first().innerText(), /Codice fiscale/iu);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  mark("canonical 200, exactly one public component, noindex until catalog integration");

  assert.match(await page.locator(".cf08-notice").innerText(), /21\/02\/2026/u);
  assert.match(await page.locator(".cf08-notice").innerText(), /Agenzia delle Entrate/u);
  await page.locator("#cf08-surname").fill("Rossi");
  await page.locator("#cf08-name").fill("Mario");
  await page.locator("#cf08-date").fill("2026-02-21");
  await page.locator("#cf08-place-search").fill("Roma");
  await page.locator(".cf08-options button").filter({ hasText: "Roma (RM)" }).first().click();
  assert.equal(await page.locator("#cf08-istat").inputValue(), "058091");
  await page.locator("[data-cf-submit]").click();
  assert.equal(await page.locator("[data-cf-generated] [data-cf-code]").innerText(), "RSSMRA26B21H501N");
  assert.equal(await page.locator("[data-cf-copy]").count(), 1);
  assert.equal(await page.locator("[data-cf-download]").count(), 1);
  mark("source-proven generation + usable local municipality search + export valid-only");

  await page.locator("#cf08-date").fill("1980-01-01");
  assert.equal(await page.locator("[data-cf-code]").count(), 0);
  assert.equal(await page.locator("[data-cf-copy]").count(), 0);
  await page.locator("[data-cf-submit]").click();
  assert.match(await page.locator("[data-cf-refused]").innerText(), /REFUSED/u);
  assert.equal(await page.locator("[data-cf-download]").count(), 0);
  mark("date change clears old export, unsupported historical date refused");

  await page.locator("#cf08-date").fill("2026-02-21");
  await page.locator("#cf08-place-kind").selectOption("foreign");
  await page.locator("#cf08-istat").fill("201");
  await page.locator("[data-cf-submit]").click();
  assert.match(await page.locator("[data-cf-refused]").innerText(), /REFUSED/u);
  assert.equal(await page.locator("[data-cf-download]").count(), 0);
  mark("source-coded foreign case refuses unproven date applicability");

  await page.locator('[data-cf-mode="validate"]').click();
  await page.locator("#cf08-code").fill("RSSMRA80A01H501A");
  await page.locator("[data-cf-submit]").click();
  assert.match(await page.locator("[data-cf-refused]").innerText(), /non valido/iu);
  assert.equal(await page.locator("[data-cf-copy]").count(), 0);
  mark("checksum mismatch refuses copy/download");

  await page.locator("#cf08-code").fill("RSSMRA80A01H501U");
  await page.locator("[data-cf-submit]").click();
  assert.equal(await page.locator("[data-cf-validated] [data-cf-code]").innerText(), "RSSMRA80A01H501U");
  assert.match(await page.locator("[data-cf-ambiguity]").innerText(), /1980-01-01 oppure 2080-01-01/u);
  await page.locator("[data-cf-copy]").click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "RSSMRA80A01H501U");
  const downloadEvent = page.waitForEvent("download");
  await page.locator("[data-cf-download]").click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), "codice-fiscale-risultato-locale.txt");
  const fileText = await readFile(await download.path(), "utf8");
  assert.match(fileText, /RSSMRA80A01H501U/u);
  assert.match(fileText, /NON È un'attribuzione/u);
  mark("valid formal check, explicit century ambiguity, local clipboard and actual .txt download");

  await page.locator('[data-cf-mode="decode"]').click();
  // Prechecked independent fixed vectors. Do NOT import source TypeScript from
  // the browser: the deployed compiled static site has no /src/ path.
  const omocode = "RSSMRA80A01H50MM";
  await page.locator("#cf08-code").fill(omocode);
  await page.locator("[data-cf-submit]").click();
  assert.match(await page.locator("[data-cf-ambiguity]").innerText(), /posizione 15: M→1/u);
  assert.match(await page.locator("[data-cf-ambiguity]").innerText(), /Roma/u);
  assert.match(await page.locator("[data-cf-ambiguity]").innerText(), /versione 115-situas/u);
  mark("decode omocodia + candidate from versioned ISTAT + no age/identity inference");

  const missing = "RSSMRA80A01Z999Y";
  await page.locator("#cf08-code").fill(missing);
  await page.locator("[data-cf-submit]").click();
  assert.match(await page.locator("[data-cf-export-blocked]").innerText(), /Esportazione disabilitata/u);
  assert.equal(await page.locator("[data-cf-copy]").count(), 0);
  assert.equal(await page.locator("[data-cf-download]").count(), 0);
  mark("unmapped geography: checksum not confused with verifiable data, no export");

  assert.deepEqual(errors, []);
  const unsafe = events.filter((event) => event.method !== "GET" && event.method !== "HEAD");
  assert.deepEqual(unsafe, []);
  const inputSent = events.filter((event) => /RSSMRA|Rossi|Mario|1980-01-01|2026-02-21/u.test(event.url + (event.body ?? "")));
  assert.deepEqual(inputSent, []);
  mark("zero upload, zero network exposure of typed inputs, no browser JS errors");

  const viewport = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(viewport.scrollWidth <= viewport.width + 1, `mobile horizontal overflow: ${JSON.stringify(viewport)}`);
  mark("390px mobile route without horizontal overflow");

  console.log(`PASS #008 Chromium ${checks.length} public-route end-to-end checks at 390px`, checks.join(" | "));
} finally {
  await context.close();
  await browser.close();
}

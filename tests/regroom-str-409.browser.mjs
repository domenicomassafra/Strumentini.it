/** Compiled public fiscal-source consumer in local Chromium or an explicit CDP endpoint. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const file = resolve(root, `.${decodeURIComponent(url.pathname)}`, url.pathname.endsWith("/") ? "index.html" : "");
    const path = relative(root, file);
    if (!path || path === ".." || path.startsWith(`..${sep}`)) return response.writeHead(403).end();
    const bytes = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" }).end(bytes);
  } catch { response.writeHead(404).end(); }
});

await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
let browser;
let context;
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  const cdpEndpoint = process.env.STRUMENTINI_ACCEPTANCE_CDP;
  browser = cdpEndpoint ? await chromium.connectOverCDP(cdpEndpoint) : await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  const unexpected = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const req = route.request();
    if (!req.url().startsWith(`${origin}/`) || req.method() !== "GET") {
      unexpected.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    return route.continue();
  });
  assert.equal((await page.goto(`${origin}/fonti-fiscali-italia/`, { waitUntil: "networkidle" }))?.status(), 200);
  const annual = page.locator("[data-fiscal-version409]");
  assert.equal(await annual.count(), 2);
  const versions = await annual.evaluateAll((rows) => rows.map((r) => ({ id: r.getAttribute("data-fiscal-version409"), content: r.textContent })));
  assert.deepEqual(versions.map((v) => v.id), ["IRPEF-2025-117-v1", "IRPEF-2026-117-v1"]);
  for (const version of versions) assert.match(version.content, /Non attestata — nessun revisore fiscale qualificato ha firmato/u);
  const diff = await page.locator("[data-fiscal-diff409]").innerText();
  assert.match(diff, /35% → 33%/u);
  assert.match(diff, /non è una rettifica retroattiva del 2025/u);
  assert.match(await page.locator("[data-fiscal-amendments409]").innerText(), /nessuna/u);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no whole-page horizontal overflow at 390px");
  const sections = page.locator("section.fiscal-year").filter({ hasText: "IRPEF nazionale lorda" });
  assert.equal(await sections.count(), 2);
  const rates = await sections.evaluateAll((rows) => rows.map((node) => Array.from(node.querySelectorAll("tbody tr td:last-child"), (cell) => Number(cell.textContent.replace("%", "").replace(",", ".")))));
  assert.deepEqual(rates, [[23, 35, 43], [23, 33, 43]]);
  assert.deepEqual(rates.map((r) => (28000 * r[0] + 12000 * r[1]) / 100), [10640, 10400]);
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  console.log("STR-409 PASS: built 390px Chrome automation-browser; pinned 2025/2026, owner open, dated amendment diff 35→33, independent €40k oracle, no uploads/errors");
} finally {
  await context?.close();
  await browser?.close();
  await new Promise((done) => server.close(done));
}

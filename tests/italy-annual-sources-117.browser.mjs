/** STR-117 annual official-source registry, compiled consumer on the MiniPC automation-browser (CDP 17629). */
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
const contexts = [];
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629");
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    contexts.push(context);
    const page = await context.newPage();
    const errors = [];
    const unexpected = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      const request = route.request();
      if (!request.url().startsWith(`${origin}/`) || request.method() !== "GET") {
        unexpected.push(`${request.method()} ${request.url()}`);
        return route.abort();
      }
      return route.continue();
    });
    assert.equal((await page.goto(`${origin}/fonti-fiscali-italia/`, { waitUntil: "networkidle" }))?.status(), 200);
    const rows = page.locator("[data-annual-source117]");
    assert.equal(await rows.count(), 8);
    const parsed = await rows.evaluateAll((nodes) => nodes.map((node) => ({
      id: node.getAttribute("data-annual-source117"),
      year: Number(node.children[0].textContent),
      authority: node.children[3].textContent,
      checkedAt: node.children[4].textContent,
      href: node.querySelector("a").getAttribute("href"),
      hash: node.children[7].textContent,
    })));
    for (const entry of parsed) {
      assert.match(entry.id, /:[0-9]{4}:/u);
      assert.ok([2024, 2025, 2026].includes(entry.year), `year ${entry.year}`);
      assert.match(entry.checkedAt, /^\d{4}-\d{2}-\d{2}$/u);
      assert.match(entry.href, /^https:\/\//u);
      assert.match(entry.hash, /^sha256:[a-f0-9]{16}…$/u);
    }
    assert.deepEqual([...new Set(parsed.map((entry) => entry.authority))].sort(),
      ["Agenzia delle Entrate", "Gazzetta Ufficiale", "Ministero dell'Economia e delle Finanze — Documentazione Economica e Finanziaria", "Normattiva"]);
    const review = await page.locator("[data-annual-review117]").innerText();
    assert.match(review, /Revisione annuale automatica al 1º gennaio/u);
    assert.match(review, /prossimo controllo 2027-01-01/u);
    assert.match(review, /national-irpef-gross-subset/u);
    assert.match(review, /senza inventare aliquote|non ereditano altri anni/u);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `no whole-page horizontal overflow at ${viewport.width}px`);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    console.log(`STR-117 PASS @${viewport.width}px: 8 official per-year snapshots, dated checks, https sources, SHA-256 preview, automatic annual review, no off-origin requests`);
  }
} finally {
  for (const context of contexts) await context?.close();
  await browser?.close().catch(() => {});
  await new Promise((ok) => server.close(ok));
}

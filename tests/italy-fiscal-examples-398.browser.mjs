/** STR-398 versioned IVA/IRPEF examples on the compiled consumer (MiniPC Chrome, CDP 17629). */
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

const plain = (value) => value.replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim();

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
    const section = page.locator("[data-fiscal-examples398]");
    assert.equal(await section.count(), 1);

    const irpef = await page.locator("[data-irpef-example398]").evaluateAll((nodes) => nodes.map((node) => ({
      id: node.getAttribute("data-irpef-example398"),
      heading: node.querySelector("h4").textContent,
      version: node.querySelector("code").textContent,
      formula: node.querySelector("[data-irpef-formula398]").textContent,
      bands: [...node.querySelectorAll("[data-irpef-band398]")].map((row) => row.textContent),
    })));
    assert.equal(irpef.length, 4);
    for (const example of irpef) {
      assert.match(plain(example.heading), /^Anno 202[56] — imponibile/u, example.id);
      assert.match(plain(example.version), /^IRPEF-20(25|26)-117-v1$/u, example.id);
      assert.match(plain(example.formula), /Formula: .* × .* = /u, example.id);
      assert.ok(example.bands.length >= 2, `${example.id} breakdown rows`);
      assert.ok(example.bands.every((row) => /€/u.test(plain(row))), `${example.id} money per band`);
    }
    const byId = Object.fromEntries(irpef.map((example) => [example.id, plain(example.formula)]));
    assert.match(byId["irpef-2025-35000"], /8\.890,00 €$/u);
    assert.match(byId["irpef-2026-35000"], /8\.750,00 €$/u);
    assert.match(byId["irpef-2026-28000"], /6\.440,00 €$/u);

    const vatRows = await page.locator("[data-vat-example398]").evaluateAll((nodes) => nodes.map((node) => ({
      id: node.getAttribute("data-vat-example398"),
      rate: node.getAttribute("data-vat-rate398"),
      cells: [...node.children].map((cell) => cell.textContent),
    })));
    assert.equal(vatRows.length, 5);
    assert.deepEqual(vatRows.map((row) => row.rate).sort(), ["10", "22", "22", "4", "5"]);
    const add = vatRows.find((row) => row.id === "iva-2025-ordinaria-add");
    assert.deepEqual(add.cells.slice(2).map(plain), ["22,00%", "aggiunta", "1.000,00 €", "220,00 €", "1.220,00 €"]);
    for (const row of vatRows) assert.match(plain(row.cells[0]), /^2025-12-20 — IVA (aggiunta|scorporata)/u);

    const formulas = await page.locator("[data-vat-formula398]").allInnerTexts();
    assert.equal(formulas.length, 5);
    assert.ok(formulas.some((text) => /1\.220,00 € ÷ \(1 \+ 22,00%\) = 1\.000,00 € imponibile/u.test(plain(text))));

    const refused = await page.locator("[data-not-determined398]").evaluateAll((nodes) => nodes.map((node) => ({
      id: node.getAttribute("data-not-determined398"), text: node.textContent,
    })));
    assert.deepEqual(refused.map((entry) => entry.id), [
      "irpef-2024", "irpef-addizionali-senza-regione", "iva-2026", "iva-2025-fuori-finestra",
    ]);
    for (const entry of refused) assert.match(plain(entry.text), /non determinato — /u, entry.id);
    const refusedText = new Map(refused.map((entry) => [entry.id, plain(entry.text)]));
    assert.match(refusedText.get("irpef-2024"), /UNSUPPORTED_FISCAL_TAX_YEAR/u);
    assert.match(refusedText.get("iva-2026"), /VAT117_UNSUPPORTED_YEAR/u);
    assert.match(refusedText.get("iva-2025-fuori-finestra"), /VAT117_UNSUPPORTED_DATE/u);
    assert.match(refusedText.get("irpef-addizionali-senza-regione"), /Addizionale comunale/u);
    // A refused case must never print a computed tax amount next to it.
    assert.doesNotMatch(refusedText.get("iva-2026"), /€/u);

    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `no whole-page horizontal overflow at ${viewport.width}px`);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    console.log(`STR-398 PASS @${viewport.width}px: 4 versioned IRPEF examples with formula, 5 in-window IVA examples, 4 explicit refusals, no off-origin request`);
  }
} finally {
  for (const context of contexts) await context?.close();
  await browser?.close().catch(() => {});
  await new Promise((ok) => server.close(ok));
}

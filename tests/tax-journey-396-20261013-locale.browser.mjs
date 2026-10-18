/** #396 real anonymous Italian P.IVA input, cents and recovery on built Astro pages.
 * Run: TAX396_LOCALE_DIST=/absolute/path/to/build node tests/tax-journey-396-20261013-locale.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(process.env.TAX396_LOCALE_DIST ?? "dist");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const disk = resolve(root, "." + decodeURIComponent(pathname), pathname.endsWith("/") ? "index.html" : "");
    const rel = relative(root, disk);
    if (!rel || rel === ".." || rel.startsWith(".." + sep)) return res.writeHead(403).end();
    const contents = await readFile(disk);
    res.writeHead(200, { "Content-Type": mime[extname(disk)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(contents);
  } catch { res.writeHead(404).end(); }
});
await new Promise((done, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", done);
});
const origin = "http://127.0.0.1:" + server.address().port;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const badRequests = [];
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request();
    if ((request.method() !== "GET" && request.method() !== "HEAD") ||
      (!request.url().startsWith(origin + "/") && !/^(?:data|blob):/u.test(request.url()))) {
      badRequests.push(request.method() + " " + request.url());
      return route.abort();
    }
    return route.continue();
  });
  assert.equal((await page.goto(origin + "/tools/partita-iva-validator/", { waitUntil: "domcontentloaded" }))?.status(), 200);
  const piva = page.locator('[data-tax396="piva"]');
  const input = name => piva.locator(`[name="${name}"]`);
  const output = () => piva.locator("output").innerText();
  const error = () => piva.locator('[role="alert"]').innerText();
  const send = () => piva.locator('button[type="submit"]').click();
  const enter = async (values) => {
    for (const [name, value] of Object.entries(values)) await input(name).fill(value);
  };
  await enter({ atecoCode: "62.01.00", priorReceipts: "20000", receipts: "30000.00", paidContributions: "1000.00" });
  await input("paidContributionsVerified").check();
  await input("eligible").check();
  await send();
  const baseline = await output();
  assert(baseline.includes(new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(2865)), "Dot input 2025 baseline");

  // A normal Italian decimal keyboard emits commas. No thousands-grouping is
  // presumed; each accepted representation still means exact integer cents.
  await enter({ priorReceipts: "20000,00", receipts: "30000,00", paidContributions: "1000,00" });
  assert.equal(await output(), "", "Editing prior values removes stale result");
  await send();
  assert.equal(await output(), baseline, "Italian comma amounts equal dot amounts at 2025 source-backed 15% tax");
  await send();
  assert.equal(await output(), baseline, "Double submission stays idempotent");

  // Independent cents-sensitive 2025 oracle: 10000.99 * 67% = 6700.6633,
  // rounded to 6700.66; 0.01 already paid leaves 6700.65, then 15% is
  // 1005.0975, rounded half-up to 1005.10. A parser that drops fractional
  // cents would return 1005.00 and MUST fail this assertion.
  const euro = value => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
  await enter({ receipts: "10000.99", paidContributions: "0.01" });
  await send();
  const centsDot = await output();
  for (const [label, amount] of [
    ["Ricavi dell'anno d'imposta:", 10000.99],
    ["Reddito forfettario stimato:", 6700.66],
    ["Contributi già pagati dichiarati:", 0.01],
    ["Base imponibile modellata:", 6700.65],
    ["Imposta sostitutiva stimata:", 1005.10],
    ["Netto stimato dopo imposta e contributi pagati:", 8995.88],
  ]) assert(centsDot.includes(`${label} ${euro(amount)}`), `Exact 2025 source-backed cent amount: ${label} ${euro(amount)}`);
  await enter({ receipts: "10000,99", paidContributions: "0,01" });
  assert.equal(await output(), "", "Editing fractional input clears stale calculation");
  await send();
  assert.equal(await output(), centsDot, "Nonzero fractional cents preserved exactly with either decimal separator");
  await send();
  assert.equal(await output(), centsDot, "Repeated fractional submit preserves exact cents");

  // Switching to the 5% user-declared startup mode must require a fresh
  // explicit declaration and show the entire reproducible 2025 chain.
  await input("declaredRate").selectOption("startup-5");
  await send();
  assert.equal(await output(), "", "No 5% calculation without explicit startup declaration");
  assert.match(await error(), /5%.*requisiti/iu);
  await input("startupEligible").check();
  await send();
  const startup = await output();
  assert(startup.includes(`Imposta sostitutiva stimata: ${euro(335.03)}`), "5% tax on 6700.65 taxable income");
  assert(startup.includes(`Netto stimato dopo imposta e contributi pagati: ${euro(9665.95)}`), "5% net subtracts already-paid contribution and computed tax");
  await input("declaredRate").selectOption("standard-15");
  await send();
  assert.equal(await output(), centsDot, "15% mode restores the original exact-cent net");

  await enter({ receipts: "10,00", paidContributions: "0,00" });
  await send();
  const rounded = await output();
  // 10.00 * 67% = 6.70; 6.70 * 15% = 1.005, half up to EUR 1.01.
  assert(rounded.includes(new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(1.01)), "Each legal cent stage rounds half up");

  for (const invalid of ["1.000,50", "1,000.50", "1.234", "1,234", "1000,001", "1e3", "-1", "12,34.56", "1 000"]) {
    await input("receipts").fill(invalid);
    await send();
    assert.equal(await output(), "", `Invalid/grouped ${invalid} must refuse without showing an old tax figure`);
    assert.match(await error(), /non validi/iu, `Error must identify invalid monetary input ${invalid}`);
  }
  await input("receipts").fill("10,00");
  await send();
  assert.equal(await output(), rounded, "Corrected Italian input recovers exactly");

  await input("taxYear").selectOption("2026");
  assert.equal(await output(), "", "Year switch removes saved 2025 estimate");
  assert.match(await error(), /2026.*non verificato/iu);
  await send();
  assert.equal(await output(), "", "Unsupported 2026 cannot be calculated");
  await input("taxYear").selectOption("2025");
  for (const name of ["atecoCode", "priorReceipts", "receipts", "paidContributions"]) {
    assert.equal(await input(name).inputValue(), "", `No cross-year saved ${name}`);
  }
  for (const name of ["paidContributionsVerified", "eligible", "startupEligible"]) {
    assert.equal(await input(name).isChecked(), false, `No reused cross-year ${name} consent`);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(await piva.locator("output").innerText(), "", "No saved tax result survives page reload");
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(badRequests, []);
  console.log("#396 locale PASS: 2025 comma/dot including 10000.99 - 0.01 => taxable 6700.65/tax 1005.10, half-up, double submit, invalid grouping refusal, stale/year/reset and no network write");
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}

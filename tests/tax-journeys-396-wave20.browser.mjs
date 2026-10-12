/** #396 wave20: real built anonymous P. IVA path/year boundary and recovery.
 * Run after a current npm run build: node tests/tax-journeys-396-wave20.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(process.env.TAX396_WAVE20_DIST ?? "dist");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const disk = resolve(root, "." + decodeURIComponent(pathname), pathname.endsWith("/") ? "index.html" : "");
    const rel = relative(root, disk);
    if (!rel || rel === ".." || rel.startsWith(".." + sep)) return res.writeHead(403).end();
    const data = await readFile(disk);
    res.writeHead(200, { "Content-Type": mime[extname(disk)] ?? "application/octet-stream",
      "Cache-Control": "no-store" });
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", ok);
});
const origin = "http://127.0.0.1:" + server.address().port;
let browser;

const euro = n => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
const moneyIn = async (panel, entries) => {
  for (const [name, value] of Object.entries(entries)) await panel.locator(`[name="${name}"]`).fill(value);
};
const declare = async panel => {
  await panel.locator('[name="paidContributionsVerified"]').check();
  await panel.locator('[name="eligible"]').check();
};
const submit = async panel => panel.locator('button[type="submit"]').click();
const rendered = async panel => (await panel.locator("output").innerText()).trim();
const alertText = async panel => (await panel.locator('[role="alert"]').innerText()).trim();
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const violations = [];
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", route => {
    const request = route.request();
    if ((request.method() !== "GET" && request.method() !== "HEAD") ||
      (!request.url().startsWith(origin + "/") && !/^(?:data|blob):/u.test(request.url()))) {
      violations.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }
    return route.continue();
  });
  assert.equal((await page.goto(origin + "/tools/partita-iva-validator/", { waitUntil: "domcontentloaded" }))?.status(), 200);
  const piva = page.locator('[data-tax396="piva"]');
  assert.equal(await piva.count(), 1);
  assert.equal(await piva.locator('[name="taxYear"]').inputValue(), "2025", "No implicit 2026 coefficients");
  for (const name of ["atecoCode", "priorReceipts", "receipts", "paidContributions"]) {
    assert.equal(await piva.locator(`[name="${name}"]`).inputValue(), "", `No presumed ${name}`);
  }
  for (const name of ["paidContributionsVerified", "eligible", "startupEligible"]) {
    assert.equal(await piva.locator(`[name="${name}"]`).isChecked(), false);
  }
  assert.match(await piva.innerText(), /solo anno d'imposta 2025/u);
  assert.match(await piva.innerText(), /ATECO2007/u);
  assert.match(await piva.innerText(), /Non calcola INPS/u);
  const links = await piva.locator('a[href^="https://"]').evaluateAll(as => as.map(a => ({ href: a.href, label: a.textContent })));
  assert(links.some(link => /gazzettaufficiale\.it/u.test(link.href) && /Allegato 2/u.test(link.label)));
  assert(links.some(link => /normattiva\.it/u.test(link.href) && /2025/u.test(link.label)));
  const employeeLink = piva.locator('a[href="/tools/codice-fiscale/"]');
  assert.equal(await employeeLink.count(), 1);

  // Independent 2025 calculation: 30,000 * 67% = 20,100;
  // 20,100 - 1,000 already paid = 19,100 taxable, * 15% = 2,865.
  await moneyIn(piva, { atecoCode: "62.01.00", priorReceipts: "20000",
    receipts: "30000", paidContributions: "1000" });
  await declare(piva);
  await submit(piva);
  const first = await rendered(piva);
  assert.match(first, /Anno d'imposta 2025/u);
  for (const number of [20100, 1000, 19100, 2865]) assert(first.includes(euro(number)), `Missing independent stage ${euro(number)}`);
  assert(!/netto (?:in busta|garantito|disponibile)|stipendio netto|imposta effettiva dovuta/iu.test(first),
    "2025 substitute-tax estimate must not be sold as take-home pay");

  // A valid 2025 user's approvals cannot silently carry into an unsupported
  // 2026 edit and then be reused as if the 2026 amounts belonged to 2025.
  await piva.locator('[name="taxYear"]').selectOption("2026");
  assert.equal(await rendered(piva), "", "Year change clears old 2025 answer");
  const yearSwitchWarning = await alertText(piva);
  await moneyIn(piva, { atecoCode: "62.01.00", priorReceipts: "70000",
    receipts: "80000", paidContributions: "2000" });
  await submit(piva);
  assert.equal(await rendered(piva), "");
  assert.match(await alertText(piva), /2026.*non verificato/iu);
  await piva.locator('[name="taxYear"]').selectOption("2025");
  assert.equal(await rendered(piva), "");
  for (const name of ["atecoCode", "priorReceipts", "receipts", "paidContributions"]) {
    assert.equal(await piva.locator(`[name="${name}"]`).inputValue(), "", `Stale year-specific ${name} crossed 2026→2025`);
  }
  for (const name of ["paidContributionsVerified", "eligible", "startupEligible"]) {
    assert.equal(await piva.locator(`[name="${name}"]`).isChecked(), false, `Stale year declaration ${name} crossed years`);
  }
  assert.equal(await piva.locator('[name="declaredRate"]').inputValue(), "standard-15");
  assert.match(yearSwitchWarning, /2026.*non verificato/iu);
  await submit(piva);
  assert.equal(await rendered(piva), "", "No 2025 estimate without fresh year-scoped inputs");
  assert.match(await alertText(piva), /non validi|contributi non confermati/iu);

  // An unsupported year inserted via browser DOM must fail with its actual
  // year, rather than misinforming the visitor that 2024 is 2026.
  await piva.locator('[name="taxYear"]').evaluate(select => {
    select.add(new Option("2024 — non verificato", "2024"));
  });
  await piva.locator('[name="taxYear"]').selectOption("2024");
  await submit(piva);
  assert.equal(await rendered(piva), "");
  assert.match(await alertText(piva), /2024.*non verificato/iu);

  // Failed submissions must not surface the old valid result; recovery with
  // explicitly declared 2025 numbers succeeds, with correct bound refusals.
  await piva.locator('[name="taxYear"]').selectOption("2025");
  await moneyIn(piva, { atecoCode: "62.01.00", priorReceipts: "85000.01",
    receipts: "30000", paidContributions: "1000" });
  await declare(piva);
  await submit(piva);
  assert.equal(await rendered(piva), "");
  assert.match(await alertText(piva), /fuori dai limiti/u);

  await piva.locator('[name="priorReceipts"]').fill("85000.00");
  await piva.locator('[name="paidContributions"]').fill("20100.01");
  await submit(piva);
  assert.equal(await rendered(piva), "");
  assert.match(await alertText(piva), /fuori dai limiti/u);

  await piva.locator('[name="paidContributions"]').fill("20100.00");
  await submit(piva);
  assert.match(await rendered(piva), /Imposta sostitutiva stimata: 0,00\s*€/u);
  assert.match(await rendered(piva), /Base imponibile modellata: 0,00\s*€/u);

  await piva.locator('[name="paidContributions"]').fill("1000");
  await piva.locator('[name="priorReceipts"]').fill("20000");
  await submit(piva);
  assert.equal(await rendered(piva), first, "Explicit valid 2025 inputs recover the expected answer");

  // The other journey must still be navigable and sourced separately.
  await employeeLink.click();
  await page.waitForURL("**/tools/codice-fiscale/");
  const employee = page.locator('[data-tax396="privati"]');
  assert.equal(await employee.count(), 1);
  assert.match(await employee.innerText(), /IRPEF lorda nazionale/u);
  assert.match(await employee.innerText(), /2025\/2026/u);
  assert.deepEqual(errors, []);
  assert.deepEqual(violations, []);
  await context.close();
  console.log("#396 wave20 PASS static Chromium: 2025 independently reconciled 2865, zero/thresholds, cross-year declarations reset, unsupported 2024/2026, employee link, no upload");
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

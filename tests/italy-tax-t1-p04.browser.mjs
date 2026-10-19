/** Consumer proof of annual Italian tax helpers on a production-built page.
 * Usage: TAX_T1P04_DIST=dist-t1p04 node tests/italy-tax-t1-p04.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(process.env.TAX_T1P04_DIST ?? "dist-t1p04");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const disk = resolve(root, "." + decodeURIComponent(url.pathname), url.pathname.endsWith("/") ? "index.html" : "");
    const relativePath = relative(root, disk);
    if (!relativePath || relativePath === ".." || relativePath.startsWith(".." + sep)) return res.writeHead(403).end();
    const data = await readFile(disk);
    res.writeHead(200, { "Content-Type": mime[extname(disk)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
const origin = `http://127.0.0.1:${server.address().port}`;
const euro = n => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], unexpectedNetwork = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", route => {
    const req = route.request();
    if (!req.url().startsWith(origin + "/") || req.method() !== "GET") {
      unexpectedNetwork.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    return route.continue();
  });
  assert.equal((await page.goto(origin + "/tools/calcoli-fiscali-italia/", { waitUntil: "networkidle" }))?.status(), 200);
  const form = action => page.locator(`form[data-calculator="${action}"]`);
  const input = (f, name) => f.locator(`[name="${name}"]`);
  const send = f => f.locator('[type="submit"]').click();
  const output = f => f.locator("output").innerText();
  const error = f => f.locator('[role="alert"]').innerText();

  const employee = form("net130");
  await input(employee, "ral").fill("30000,00");
  await input(employee, "baseConfirmed").check();
  await input(employee, "payments").selectOption("12");
  await send(employee);
  const salary12 = await output(employee);
  assert(salary12.includes(euro(2652)), "salary worker INPS separated");
  assert(salary12.includes(euro(6290.04)), "salary national gross tax");
  assert(salary12.includes("Netto annuo illustrativo: " + euro(21057.96)), "annual salary reconciliation");
  await input(employee, "payments").selectOption("14");
  assert.equal(await output(employee), "", "no stale salary when changing installment count");
  await send(employee);
  assert((await output(employee)).includes("Netto annuo illustrativo: " + euro(21057.96)), "14 installment preserves annual");

  const piva = form("forf133");
  for (const [name, number] of Object.entries({ ateco: "62.01.00", prior: "20000", revenue: "30000.00", paid: "1000.00" }))
    await input(piva, name).fill(number);
  await input(piva, "eligible").check();
  await input(piva, "gsProfessional").check();
  await input(piva, "paidVerified").check();
  await send(piva);
  const forf = await output(piva);
  assert(forf.includes("Reddito forfettario: " + euro(20100)));
  assert(forf.includes("INPS 2025 stimata 26.07% sul reddito forfettario: " + euro(5240.07)));
  assert(forf.includes("Sostitutiva 15%: " + euro(2865)));
  assert(forf.includes("Contributi già pagati dichiarati, dedotti dal reddito: " + euro(1000)));
  assert(forf.includes("Netto con contributi già pagati (ricavi meno versato meno imposta): " + euro(26135)));
  assert(forf.includes("Netto previsionale sostituendo i versamenti con la stima INPS annuale: " + euro(21894.93)));
  await input(piva, "rate").selectOption("startup-5");
  await send(piva);
  assert.match(await error(piva), /5_PERCENT_DECLARATION_REQUIRED/);
  await input(piva, "startup").check();
  await send(piva);
  assert((await output(piva)).includes("Sostitutiva 5%: " + euro(955)));
  await input(piva, "year").selectOption("2026");
  assert.equal(await input(piva, "revenue").inputValue(), "", "year change discards stale receipts");
  assert.equal(await input(piva, "gsProfessional").isChecked(), false, "year change discards GS declaration");
  assert.equal(await input(piva, "rate").inputValue(), "standard-15", "year change resets startup-rate choice");
  assert.equal(await input(piva, "inps").inputValue(), "gs-2025-exclusive", "year change resets prior INPS profile");
  await send(piva);
  assert.match(await error(piva), /2026 non verificato/u);

  const tfr = form("tfr134");
  await input(tfr, "prior").fill("10000");
  await input(tfr, "salary").fill("27000");
  await send(tfr);
  let tfrResult = await output(tfr);
  assert(tfrResult.includes("Maturato 2025: " + euro(2000)));
  assert(tfrResult.includes("Rivalutazione dicembre 2025 (2,311148%): " + euro(231.11)));
  assert(tfrResult.includes("Imposta indicativa: non determinata"), "absence of history does not fabricate TFR tax");
  await input(tfr, "historical").fill("30000");
  await input(tfr, "historyYears").fill("5");
  await send(tfr);
  tfrResult = await output(tfr);
  assert(tfrResult.includes("Imposta indicativa SEPARATA"), "separate illustrative tax present");
  await input(tfr, "months").fill("7");
  await send(tfr);
  assert((await output(tfr)).includes("Rivalutazione: non determinabile"), "missing monthly ISTAT coverage returns partial");

  const stamp = form("bollo152");
  await input(stamp, "amount").fill("77,47");
  await input(stamp, "single").check();
  await input(stamp, "noExempt").check();
  await send(stamp);
  assert((await output(stamp)).includes("bollo " + euro(0)));
  await input(stamp, "amount").fill("77,48");
  await send(stamp);
  assert((await output(stamp)).includes("bollo " + euro(2)));
  await input(stamp, "year").selectOption("2026");
  await send(stamp);
  assert((await output(stamp)).includes("Fuori perimetro"), "unsupported year safely refused");
  assert.deepEqual(errors, [], "no page JavaScript exceptions");
  assert.deepEqual(unexpectedNetwork, [], "no remote requests, posts or uploads");
  console.log("T1-p04 browser PASS: salary 12/14; forfettario INPS 26.07 and 15/5 eligibility; TFR year/partial/tax; 2024 bollo 77.47/77.48 and 2026 refusal; mobile Chromium; no network writes/errors");
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

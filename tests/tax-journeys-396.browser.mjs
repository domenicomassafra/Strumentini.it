/** #396 acceptance on compiled dist; run after Astro build. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, relative, extname, sep } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
    const disk = resolve(root, "." + decodeURIComponent(pathname), pathname.endsWith("/") ? "index.html" : "");
    const rel = relative(root, disk);
    if (disk === root || rel === ".." || rel.startsWith(".." + sep)) return res.writeHead(403).end();
    const data = await readFile(disk);
    res.writeHead(200, { "Content-Type": mime[extname(disk)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
const origin = "http://127.0.0.1:" + server.address().port;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const uploads = [], offsite = [], pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/*", (route) => {
    const req = route.request();
    const url = req.url();
    if (!["GET", "HEAD"].includes(req.method())) { uploads.push(req.method() + " " + url); return route.abort(); }
    if (!url.startsWith(origin + "/") && !/^(?:blob|data):/u.test(url)) { offsite.push(url); return route.abort(); }
    return route.continue();
  });

  const privati = await page.goto(origin + "/tools/codice-fiscale/", { waitUntil: "domcontentloaded" });
  assert.equal(privati.status(), 200);
  assert.equal(await page.locator('[data-tax396="privati"]').count(), 1, "Private tax panel in existing route");
  assert.equal(await page.locator('[data-tax396="privati"] main').count(), 0, "Tax panel does not nest a new layout");
  const privato = page.locator('[data-tax396="privati"]');
  assert.match(await privato.innerText(), /IRPEF lorda nazionale/u);
  assert.match(await privato.innerText(), /detrazioni|addizionali/u);
  await privato.locator('[name="taxYear"]').selectOption("2025");
  await privato.locator('[name="taxableIncome"]').fill("40000");
  await privato.locator("button[type=submit]").click();
  assert.match(await privato.locator("output").innerText(), /10\.640,00\s*€/u);
  assert.match(await privato.locator("output").innerText(), /2025/u);
  await privato.locator('[name="taxYear"]').selectOption("2026");
  assert.equal((await privato.locator("output").innerText()).trim(), "", "Year switch revokes stale result");
  await privato.locator("button[type=submit]").click();
  assert.match(await privato.locator("output").innerText(), /10\.400,00\s*€/u);
  await privato.locator('[name="taxYear"]').selectOption("2024");
  assert.equal((await privato.locator("output").innerText()).trim(), "");
  await privato.locator("button[type=submit]").click();
  assert.match(await privato.locator('[role="alert"]').innerText(), /2024.*non (?:verificato|supportato)/iu);
  await privato.locator('[name="taxYear"]').selectOption("2025");
  await privato.locator('[name="taxableIncome"]').fill("-12");
  await privato.locator("button[type=submit]").click();
  assert.match(await privato.locator('[role="alert"]').innerText(), /reddito.*non valido/iu);
  assert.equal((await privato.locator("output").innerText()).trim(), "");

  const pivaRoute = await page.goto(origin + "/tools/partita-iva-validator/", { waitUntil: "domcontentloaded" });
  assert.equal(pivaRoute.status(), 200);
  assert.equal(await page.locator('[data-tax396="piva"]').count(), 1);
  const piva = page.locator('[data-tax396="piva"]');
  assert.match(await piva.innerText(), /ATECO2007/u);
  assert.match(await piva.innerText(), /non verifica.*requisiti/u);
  await piva.locator('[name="taxYear"]').selectOption("2025");
  await piva.locator('[name="atecoCode"]').fill("62.01.00");
  await piva.locator('[name="priorReceipts"]').fill("20000");
  await piva.locator('[name="receipts"]').fill("30000");
  await piva.locator('[name="paidContributions"]').fill("1000");
  await piva.locator('[name="paidContributionsVerified"]').check();
  await piva.locator('[name="eligible"]').check();
  await piva.locator("button[type=submit]").click();
  assert.match(await piva.locator("output").innerText(), /2\.?865,00\s*€/u);
  assert.match(await piva.locator("output").innerText(), /2025/u);
  await piva.locator('[name="taxYear"]').selectOption("2026");
  assert.equal((await piva.locator("output").innerText()).trim(), "");
  await piva.locator("button[type=submit]").click();
  assert.match(await piva.locator('[role="alert"]').innerText(), /2026.*non (?:verificato|supportato)/iu);
  await piva.locator('[name="taxYear"]').selectOption("2025");
  await piva.locator('[name="eligible"]').uncheck();
  await piva.locator("button[type=submit]").click();
  assert.match(await piva.locator('[role="alert"]').innerText(), /requisiti.*dichiarati/iu);
  assert.equal((await piva.locator("output").innerText()).trim(), "");
  await piva.locator('[name="eligible"]').check();
  await piva.locator('[name="atecoCode"]').fill("47.83.00");
  await piva.locator("button[type=submit]").click();
  assert.match(await piva.locator('[role="alert"]').innerText(), /ATECO.*non coperto/u);
  await piva.locator('[name="atecoCode"]').fill("62.01.00");
  await piva.locator('[name="declaredRate"]').selectOption("startup-5");
  await piva.locator("button[type=submit]").click();
  assert.match(await piva.locator('[role="alert"]').innerText(), /5%.*requisiti/u);
  assert.equal((await piva.locator("output").innerText()).trim(), "");
  assert.deepEqual(uploads, []);
  assert.deepEqual(offsite, []);
  assert.deepEqual(pageErrors, []);
  console.log("PASS #396 static Chromium 390: private 2025/2026 gross IRPEF 10640/10400, 2025 PIVA estimate 2865, negative year/eligibility/ATECO/startup, no uploads");
  await context.close();
} finally {
  await browser?.close();
  await new Promise((ok) => server.close(ok));
}

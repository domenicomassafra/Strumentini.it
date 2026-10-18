/** STR-012 browser acceptance against the generated site or STR012_BASE_URL dev server. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

let server;
let origin = process.env.STR012_BASE_URL;
if (!origin) {
  const root = resolve("dist");
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
      const file = resolve(root, "." + pathname, pathname.endsWith("/") ? "index.html" : "");
      const pathFromRoot = relative(root, file);
      if (pathFromRoot === ".." || pathFromRoot.startsWith(".." + sep)) return res.writeHead(403).end();
      const bytes = await readFile(file);
      res.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" }).end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
  origin = `http://127.0.0.1:${server.address().port}`;
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
const outside = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/*", (route) => {
  const request = route.request();
  if (!["GET", "HEAD"].includes(request.method()) || (!request.url().startsWith(origin + "/") && !/^(?:blob|data):/u.test(request.url()))) {
    outside.push(`${request.method()} ${request.url()}`);
    return route.abort();
  }
  return route.continue();
});
const scope = page.locator("[data-irpef-annuale]");
const result = scope.locator("output");
const error = scope.locator('[role="alert"]');
const income = scope.locator('[name="income"]');
const year = scope.locator('[name="year"]');
const submit = async (value) => { await income.fill(value); await scope.locator('button[type="submit"]').click(); return result.innerText(); };
try {
  const response = await page.goto(origin + "/tools/irpef-annuale/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  assert.equal(response?.status(), 200, "canonical annual IRPEF route must exist");
  assert.equal(await scope.count(), 1);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  assert.deepEqual(await year.locator("option").evaluateAll((items) => items.map((item) => item.value)), ["2025", "2026"]);
  assert.match(await scope.innerText(), /detrazioni.*non calcolate/isu);
  assert.match(await scope.innerText(), /addizionali.*non calcolate/isu);
  assert.match(await scope.innerText(), /non.*imposta netta.*dovuta/isu);

  let text = await submit("40000");
  assert.match(text, /IRPEF lorda nazionale.*10\.640,00\s*€/su);
  assert.match(text, /28\.000,00\s*€/u);
  assert.match(text, /12\.000,00\s*€/u);
  assert.match(text, /4\.?200,00\s*€/u);
  assert.match(text, /23\s*%/u);
  assert.match(text, /35\s*%/u);
  assert.match(text, /non determinata/iu);
  assert.ok(await result.locator('a[href*="normattiva.it"]').count() >= 3, "provenance per bracket");
  await year.selectOption("2026");
  assert.equal((await result.innerText()).trim(), "", "switching tax year revokes previous gross tax");
  assert.equal(await income.inputValue(), "", "switching tax year requires fresh taxable income");
  text = await submit("40000");
  assert.match(text, /IRPEF lorda nazionale.*10\.400,00\s*€/su);
  assert.match(text, /33\s*%/u);
  assert.ok(await result.locator('a[href*="normattiva.it"]').count() >= 6, "2026 has both source laws per bracket");

  for (const [taxYear, grossAt50k] of [["2025", "14.140,00"], ["2026", "13.700,00"]]) {
    await year.selectOption(taxYear);
    assert.match(await submit("0"), /IRPEF lorda nazionale.*0,00\s*€/su);
    assert.match(await submit("28000"), /IRPEF lorda nazionale.*6\.?440,00\s*€/su);
    text = await submit("28000.01");
    assert.match(text, /0,01\s*€/u);
    assert.match(await submit("50000"), new RegExp(`IRPEF lorda nazionale.*${grossAt50k.replaceAll(".", "\\.")}\\s*€`, "su"));
    text = await submit("50000,99");
    assert.match(text, /0,99\s*€/u);
    assert.match(text, /43\s*%/u);
    assert.equal(await result.locator("tbody tr").count(), 3, "three auditable bracket lines");
  }

  await income.fill("40.000,99");
  assert.equal((await result.innerText()).trim(), "", "input change revokes stale result");
  await scope.locator('button[type="submit"]').click();
  assert.match(await error.innerText(), /reddito.*non valido/iu);
  assert.equal((await result.innerText()).trim(), "");
  for (const bad of ["-1", "1,234", "1000000000,01", "1e5"]) {
    await income.fill(bad);
    await scope.locator('button[type="submit"]').click();
    assert.match(await error.innerText(), /reddito.*non valido|importo.*non coperto/iu, bad);
    assert.equal((await result.innerText()).trim(), "");
  }
  await year.evaluate((select) => { select.add(new Option("2027", "2027")); });
  await year.selectOption("2027");
  await income.fill("40000");
  await scope.locator('button[type="submit"]').click();
  assert.match(await error.innerText(), /anno.*non supportato/iu, "injected unsupported years must fail closed");
  assert.equal((await result.innerText()).trim(), "");

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const measure = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(measure.scroll <= measure.width + 1, `horizontal overflow at ${width}px: ${JSON.stringify(measure)}`);
    assert.ok(await scope.locator('button[type="submit"]').isVisible(), `submit must be visible at ${width}px`);
  }
  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  const noJsPage = await noJsContext.newPage();
  const noJsNavigations = [];
  noJsPage.on("request", (request) => { if (request.isNavigationRequest()) noJsNavigations.push(request.url()); });
  await noJsPage.goto(origin + "/tools/irpef-annuale/");
  const noJsForm = noJsPage.locator("[data-irpef-annuale] form");
  assert.equal(await noJsPage.locator("[data-irpef-noscript]").isVisible(), true, "no-JS disclosure visible");
  assert.equal(await noJsForm.locator('button[type="submit"]').isDisabled(), true, "no-JS submit disabled");
  await noJsForm.locator('[name="income"]').fill("40000");
  await noJsForm.locator('[name="income"]').press("Enter");
  assert.equal(new URL(noJsPage.url()).search, "", "no-JS Enter must not put income into URL");
  assert.deepEqual(noJsNavigations.filter((url) => new URL(url).search !== ""), [], "no-JS makes no navigation with income");
  await noJsContext.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(outside, []);
  console.log("PASS STR-012 Chromium: 2025/26 scaglioni, source provenance, no individual-net claim, invalid/stale inputs, 2027 fail-closed; 320/390/768/1024/1440 no overflow");
} finally {
  await page.close();
  await context.close();
  await browser.close();
  if (server) await new Promise((done) => server.close(done));
}

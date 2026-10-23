/** Run after `npm run build`: node scripts/acceptance-html-entity-301.browser.mjs. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const contentTypes = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const file = resolve(dist, `.${pathname}`, pathname.endsWith("/") ? "index.html" : "");
  if (!file.startsWith(dist + sep)) { response.writeHead(403).end(); return; }
  const mime = contentTypes[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream";
  response.setHeader("Content-Type", mime);
  try {
    if (!(await stat(file)).isFile()) throw new Error("Missing file");
    const bytes = await readFile(file);
    const hashes = mime === "text/html"
      ? [...bytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/giu)]
        .filter((match) => !/\bsrc\s*=/iu.test(match[0]) && match[1] !== "")
        .map((match) => `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`)
      : [];
    response.setHeader("Content-Security-Policy", `default-src 'self'; script-src 'self' ${hashes.join(" ")}; connect-src 'none'; object-src 'none'; base-uri 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'`);
    response.end(bytes);
  } catch { response.writeHead(404).end("Missing local build asset"); }
});

await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Missing local HTTP port");
const origin = `http://127.0.0.1:${address.port}`;
const cases = [
  { text: "&NotEqualTilde; &euro;", mode: "decode", numeric: "false", expected: "≂̸ €" },
  { text: "<Caffè & ©>", mode: "encode", numeric: "false", expected: "&lt;Caff&egrave; &amp; &copy;&gt;" },
  { text: "<©>", mode: "encode", numeric: "true", expected: "&#60;&#169;&#62;" },
];
const selectedEngines = { chromium, firefox, webkit };
const engineNames = (process.env.STR301_BROWSERS ?? "chromium,firefox,webkit").split(",");
assert(engineNames.length > 0 && new Set(engineNames).size === engineNames.length && engineNames.every((name) => Object.hasOwn(selectedEngines, name)));
const browserReceipts = [];
const htmlPath = "tools/html-entity-codec/index.html";
const htmlSha256 = sha256(await readFile(join(dist, htmlPath)));

try {
  for (const engineName of engineNames) {
    const engine = selectedEngines[engineName];
    console.log(`START ${engineName}`);
    const browser = await engine.launch({ headless: true, timeout: 20000 });
    try {
      const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: true });
      console.log(`CONTEXT ${engineName}`);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const offsite = [];
      const errors = [];
      const consoleErrors = [];
      const scripts = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("request", (request) => { if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname); });
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith(`${origin}/`) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
        offsite.push(url);
        return route.abort();
      });
      const response = await page.goto(`${origin}/tools/html-entity-codec/`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200, `${engine.name()}: built HTML route is unavailable`);
      const csp = response?.headers()["content-security-policy"] ?? "";
      assert.match(csp, /(?:^|; )script-src 'self' /u, `${engine.name()}: CSP script origin`);
      assert.match(csp, /(?:^|; )connect-src 'none'(?:;|$)/u, `${engine.name()}: CSP network refusal`);
      for (const sample of cases) {
        await page.locator("form textarea").first().fill(sample.text);
        await page.locator("form select").nth(0).selectOption(sample.mode);
        await page.locator("form select").nth(1).selectOption(sample.numeric);
        await page.locator('form button[type="submit"]').click();
        const action = page.locator('[data-result-action="download"]');
        try { await action.waitFor({ timeout: 10000 }); }
        catch (error) {
          console.error(JSON.stringify({ engine: engine.name(), sample, pageErrors: errors, consoleErrors, scripts, form: await page.locator("form").first().innerText(), gutter: await page.locator(".gutter").allInnerTexts(), actions: await page.locator("[data-result-action]").allTextContents() }));
          throw error;
        }
        const downloading = page.waitForEvent("download");
        await action.click();
        const download = await downloading;
        const result = JSON.parse(await readFile(await download.path(), "utf8"));
        assert.equal(result.valore, sample.expected, `${engine.name()}: HTML entity mismatch`);
        assert.match(result.avviso, /non esegue una sanificazione HTML/u);
      }
      await page.locator("form textarea").first().fill("&#x110000;");
      await page.locator("form select").nth(0).selectOption("decode");
      await page.locator('form button[type="submit"]').click();
      const refusal = page.locator("[data-tool-error]");
      await refusal.waitFor({ state: "visible" });
      assert((await refusal.innerText()).trim().length > 0, `${engine.name()}: missing refusal message`);
      assert.equal(await page.locator('[data-result-action="download"]').count(), 0, `${engine.name()}: download after invalid Unicode`);
      assert.deepEqual(offsite, [], `${engine.name()}: unexpected offsite requests`);
      assert.deepEqual(errors, [], `${engine.name()}: script errors`);
      assert.deepEqual(consoleErrors, [], `${engine.name()}: console errors`);
      const lazyScript = scripts.find((script) => /\/he\.[\w-]+\.js$/u.test(script));
      assert(lazyScript, `${engine.name()}: pinned he lazy chunk absent`);
      const chunkPath = resolve(dist, `.${lazyScript}`);
      assert(chunkPath.startsWith(`${dist}${sep}`), `${engine.name()}: lazy chunk outside build`);
      browserReceipts.push({
        engine: engineName,
        version: browser.version(),
        status: "PASS",
        conversions: cases.length,
        invalidUnicodeRefusals: 1,
        refusalUi: "PASS",
        downloadJson: "PASS",
        csp: { status: "PASS", responseHeader: csp },
        externalRequests: offsite.length,
        pageErrors: errors.length,
        consoleErrors: consoleErrors.length,
        lazyChunk: { path: lazyScript, sha256: sha256(await readFile(chunkPath)) },
      });
      console.log(`PASS ${engine.name()} ${browser.version()} 3 real UI conversions, CSP self + inline hashes/connect-src none, he lazy chunk, no egress`);
      await context.close();
    } finally { await browser.close(); }
  }
  const complete = browserReceipts.length === Object.keys(selectedEngines).length;
  const receipt = {
    schemaVersion: 1,
    toolId: "html-entity-codec",
    status: complete ? "PASS" : "PARTIAL",
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    build: { route: htmlPath, sha256: htmlSha256 },
    environment: { platform: process.platform, arch: process.arch, node: process.version },
    requiredEngines: Object.keys(selectedEngines),
    browsers: browserReceipts,
    note: "Playwright browsers validate the built local route; this is not physical-device or production-deployment evidence.",
  };
  const receiptPath = join(root, "quality/receipts/developer-web/html-entity-codec-301.browser.json");
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`${receipt.status} STR-301 browser receipt: ${receiptPath}`);
} finally { await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())); }

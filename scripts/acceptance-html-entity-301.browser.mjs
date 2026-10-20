/** Run after `npm run build`: node scripts/acceptance-html-entity-301.browser.mjs. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { chromium, firefox, webkit } from "@playwright/test";

const dist = resolve(import.meta.dirname, "../dist");
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
assert(engineNames.every((name) => Object.hasOwn(selectedEngines, name)));

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
      assert.deepEqual(offsite, [], `${engine.name()}: unexpected offsite requests`);
      assert.deepEqual(errors, [], `${engine.name()}: script errors`);
      assert(scripts.some((script) => /\/he\.[\w-]+\.js$/u.test(script)), `${engine.name()}: pinned he lazy chunk absent`);
      console.log(`PASS ${engine.name()} ${browser.version()} 3 real UI conversions, CSP self + inline hashes/connect-src none, he lazy chunk, no egress`);
      await context.close();
    } finally { await browser.close(); }
  }
} finally { await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())); }

/** #345: three real static-site history journeys, Chrome/WebKit, no provider.
 * Run on the EXACT source-built static files, not a synthetic UI or Vite:
 * NAV345_DIST=/path/to/built/dist node tests/navigation-345-20261013-three-journeys.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium, webkit } from "@playwright/test";

const root = resolve(process.env.NAV345_DIST ?? "dist");
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".json": "application/json", ".png": "image/png",
};
const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") return response.writeHead(405).end();
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname);
    const path = resolve(root, `.${pathname}`, pathname.endsWith("/") ? "index.html" : "");
    const rel = relative(root, path);
    if (rel === ".." || rel.startsWith(`..${sep}`)) return response.writeHead(403).end();
    const bytes = await readFile(path);
    response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch { response.writeHead(404).end(); }
});

const fixture = await readFile(resolve("quality/fixtures/pdf-gold/simple-2page.pdf"));
const gif = await readFile(resolve("quality/fixtures/image-format-matrix/source.gif"));
const sensitiveUrl = "https://example.org/private-345-do-not-persist?secret=private-345";
const sensitiveFile = "PRIVATE-FILE-CONTENT-345.pdf";
const inputTag = "PRIVATE-FILE-CONTENT-345";
const engineNames = process.env.NAV345_BROWSER ? [process.env.NAV345_BROWSER] : ["chromium", "webkit"];
if (!engineNames.every((name) => name === "chromium" || name === "webkit")) throw Error("Unknown NAV345_BROWSER");
let passed = 0;

async function recent(page) {
  return page.evaluate(async () => new Promise((done, fail) => {
    const opening = indexedDB.open("utility-workbench", 1);
    opening.onerror = () => fail(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const tx = db.transaction("state", "readonly");
      const request = tx.objectStore("state").get("workbench/state:v1");
      request.onsuccess = () => done(request.result?.recent ?? []);
      request.onerror = () => fail(request.error);
      tx.oncomplete = () => db.close();
    };
  }));
}

async function hydrate(page, name) {
  await page.waitForFunction((component) => {
    const island = document.querySelector(`astro-island[component-url*="${component}"]`);
    return island !== null && !island.hasAttribute("ssr");
  }, name, { timeout: 35_000 });
}

try {
  await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;

  for (const name of engineNames) {
    const browser = await ({ chromium, webkit })[name].launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
      const errors = [];
      const outbound = [];
      context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
      await context.route("**/*", async (route) => {
        const request = route.request();
        if (new URL(request.url()).origin !== origin || !["GET", "HEAD"].includes(request.method())) {
          outbound.push(`${request.method()} ${request.url()}`);
          await route.abort();
        } else await route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(30_000);
      const home = `${origin}/`;

      // Never let test polling create `utility-workbench` ahead of the app's
      // real onupgradeneeded transaction. On WebKit an early naked open(name,1)
      // can win the first-open race and create a version-1 DB WITHOUT `state`.
      // The Home really loads membership, then databases() observes the commit
      // without opening/creating anything from this harness.
      assert.equal((await page.goto(home, { waitUntil: "networkidle" }))?.status(), 200);
      await page.waitForFunction(async () => {
        const list = await indexedDB.databases();
        return list.some((db) => db.name === "utility-workbench" && db.version === 1);
      }, undefined, { timeout: 15_000 });
      assert(await page.evaluate(() => new Promise((done, fail) => {
        const opening = indexedDB.open("utility-workbench", 1);
        opening.onerror = () => fail(opening.error);
        opening.onsuccess = () => {
          done(opening.result.objectStoreNames.contains("state"));
          opening.result.close();
        };
      })), "The production Home initialized IndexedDB state before the test read");

      // 1: a REAL completed UTM job writes the canonical ID/time/count only;
      // Home Recenti and native browser back/forward/reload preserve metadata.
      assert.equal((await page.goto(`${origin}/tools/utm-builder/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
      await hydrate(page, "Utm");
      await page.getByRole("textbox", { name: "URL di destinazione" }).fill(sensitiveUrl);
      await page.getByRole("textbox", { name: "Sorgente" }).fill("private-source-345");
      await page.getByRole("textbox", { name: "Mezzo" }).fill("email");
      await page.getByRole("textbox", { name: "Campagna" }).fill("October");
      await page.getByRole("button", { name: "Crea URL" }).click();
      await page.locator('[data-result-class="text-code"]').waitFor();
      await page.waitForFunction(async () => {
        try {
          const opening = indexedDB.open("utility-workbench", 1);
          return await new Promise((done) => {
            opening.onerror = () => done(false);
            opening.onsuccess = () => {
              const db = opening.result;
              const tx = db.transaction("state", "readonly");
              const req = tx.objectStore("state").get("workbench/state:v1");
              req.onsuccess = () => done(req.result?.recent?.[0]?.toolId === "utm-builder");
              req.onerror = () => done(false);
              tx.oncomplete = () => db.close();
            };
          });
        } catch { return false; }
      }, undefined, { timeout: 16_000 }).catch(async (failure) => {
        const diagnostic = await page.evaluate(async () => {
          const result = document.querySelector('[data-result-class="text-code"]')?.textContent?.slice(0, 300);
          const databases = await indexedDB.databases?.().catch(() => []);
          return { result, databases, pathname: location.pathname };
        });
        throw new Error(`${name} real UTM completion not saved: ${JSON.stringify({ diagnostic, errors })}`, { cause: failure });
      });
      await page.goto(home, { waitUntil: "domcontentloaded" });
      const link = page.locator('[data-recent-list] a[href="/tools/utm-builder"]').first();
      await link.waitFor();
      const original = (await recent(page))[0];
      assert.deepEqual(Object.keys(original).sort(), ["lastUsedAt", "toolId", "useCount"]);
      assert(Number.isFinite(Date.parse(original.lastUsedAt)));
      assert.equal(original.useCount, 1);
      assert(!JSON.stringify(await recent(page)).includes("private-345"));
      await link.click();
      assert.equal(new URL(page.url()).pathname.replace(/\/$/u, ""), "/tools/utm-builder");
      await page.goBack({ waitUntil: "domcontentloaded" });
      await link.waitFor();
      await page.goForward({ waitUntil: "domcontentloaded" });
      assert.equal(new URL(page.url()).pathname.replace(/\/$/u, ""), "/tools/utm-builder");
      // No private prior result is recreated just by following an ID route.
      assert.equal(await page.locator('[data-result-class="text-code"]').count(), 0);
      await page.goto(`${origin}/cerca/?q=utm`, { waitUntil: "domcontentloaded" });
      await page.locator('[data-search-form] input').waitFor();
      assert.equal(await page.locator('[data-search-form] input').inputValue(), "utm");
      await page.getByRole("link", { name: /Crea URL con UTM/u }).first().click();
      await page.goBack({ waitUntil: "domcontentloaded" });
      assert.equal(new URL(page.url()).searchParams.get("q"), "utm");
      assert.equal(await page.locator('[data-search-form] input').inputValue(), "utm");
      await page.goForward({ waitUntil: "domcontentloaded" });
      assert.equal(new URL(page.url()).pathname.replace(/\/$/u, ""), "/tools/utm-builder");
      await page.goto(home, { waitUntil: "domcontentloaded" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await link.waitFor();
      assert.deepEqual((await recent(page))[0], original);
      assert(!(await page.locator("[data-recent-section]").innerText()).includes("private-source-345"));
      console.log(`${name} #345 journey1 PASS: actual UTM→recent metadata→back/forward/query/reload`);

      // 2: a REAL native File picker inspects a private PDF; resulting route
      // carries no raw File, name, blob or sentinel through URL/history.
      await page.locator("[data-home-file-picker]").setInputFiles({
        name: sensitiveFile, mimeType: "application/pdf", buffer: fixture,
      });
      const suggestion = page.locator('[data-home-file-action-format="pdf"]:visible a').first();
      await suggestion.waitFor();
      assert.equal(await page.locator("[data-home-file-picker]").inputValue(), "");
      assert.equal(await suggestion.getAttribute("href"), "/tools/pdf-page-count-verifier/");
      await suggestion.click();
      assert.equal(new URL(page.url()).pathname, "/tools/pdf-page-count-verifier/");
      assert(!page.url().includes(inputTag));
      assert.equal(await page.locator('input[type="file"]').first().inputValue(), "");
      assert.equal(await page.locator('[data-result-class="pdf"]').count(), 0);
      await page.goBack({ waitUntil: "domcontentloaded" });
      assert.equal(new URL(page.url()).pathname, "/");
      assert.equal(await page.locator("[data-home-file-picker]").inputValue(), "");
      await page.goForward({ waitUntil: "domcontentloaded" });
      assert.equal(new URL(page.url()).pathname, "/tools/pdf-page-count-verifier/");
      assert.equal(await page.locator('input[type="file"]').first().inputValue(), "");
      await page.goto(`${origin}/tools/pdf-page-count-verifier/?from=local-file`, { waitUntil: "domcontentloaded" });
      await page.reload({ waitUntil: "domcontentloaded" });
      assert.equal(new URL(page.url()).searchParams.get("from"), "local-file");
      assert.equal(await page.locator('input[type="file"]').first().inputValue(), "");
      assert(!page.url().includes(inputTag));
      console.log(`${name} #345 journey2 PASS: real File→tool→history/query with no stale File`);

      // 3: a REAL verified image produced by the installed image engine is
      // handed off once by the actual #337 runtime. Reload and direct URLs
      // must never revive a spent Blob/capability; unanswered one-use handoff
      // expires in the receiver's browser with an explicit status.
      await page.goto(`${origin}/tools/image-format-conversion/`, { waitUntil: "domcontentloaded" });
      await hydrate(page, "ImageFormatConversionTool");
      await page.locator('form input[type="file"]').first().setInputFiles({
        name: "source.gif", mimeType: "image/gif", buffer: gif,
      });
      await page.getByRole("button", { name: "Esegui in locale" }).click();
      await page.locator('[data-result-class="image"]').waitFor({ timeout: 30_000 });
      const realHandoff = page.locator("[data-png-compression-handoff-337]");
      await realHandoff.waitFor();
      await page.evaluate(() => {
        const originalOpen = window.open;
        window.open = function (url, target, features) {
          window.__nav345LastHandoffUrl = String(url);
          return originalOpen.call(window, url, target, features);
        };
      });
      const popupEvent = page.waitForEvent("popup");
      await realHandoff.click();
      const popup = await popupEvent;
      const sentUrl = await page.evaluate(() => window.__nav345LastHandoffUrl);
      assert.match(sentUrl, /^\/tools\/image-compression\/#handoff337=[\da-f-]+$/iu);
      await popup.locator('[data-handoff-337]').waitFor();
      assert.match(await popup.locator('[data-handoff-337]').innerText(), /PNG locale ricevuto/u);
      assert.equal(new URL(popup.url()).hash, "");
      assert.equal(await popup.locator('[data-result-class="image"]').count(), 0);
      await popup.reload({ waitUntil: "domcontentloaded" });
      await hydrate(popup, "ImageCompressionTool");
      assert.equal(await popup.locator('[data-handoff-337]').count(), 0);
      assert.equal(await popup.locator('[data-result-class="image"]').count(), 0);
      assert.equal(await popup.locator('form input[type="file"]').first().inputValue(), "");
      const stale = await context.newPage();
      await stale.goto(new URL(sentUrl, origin).href, { waitUntil: "domcontentloaded" });
      await hydrate(stale, "ImageCompressionTool");
      await stale.waitForFunction(() => location.hash === "", undefined, { timeout: 10_000 });
      assert.equal(new URL(stale.url()).hash, "", "Direct URL without opener discards spent token");
      assert.match(await stale.locator('[data-handoff-337]').innerText(), /non è disponibile/u);
      assert.equal(await stale.locator('[data-result-class="image"]').count(), 0);
      assert.equal(await stale.locator('form input[type="file"]').first().inputValue(), "");

      await page.evaluate(() => {
        window.__nav345Ready = false;
        window.addEventListener("message", (event) => {
          if (event.data?.kind === "strumentini-ephemeral-file-handoff-337"
            && event.data?.token === "00000000-0000-4000-8000-000000000345"
            && event.data?.phase === "ready") window.__nav345Ready = true;
        });
      });
      const newTab = context.waitForEvent("page");
      const opened = await page.evaluate(() => window.open("about:blank", "_blank") !== null);
      assert(opened);
      const receiver = await newTab;
      await receiver.clock.install();
      await receiver.goto(`${origin}/tools/image-compression/#handoff337=00000000-0000-4000-8000-000000000345`, { waitUntil: "domcontentloaded" });
      await hydrate(receiver, "ImageCompressionTool");
      await page.waitForFunction(() => window.__nav345Ready === true, undefined, { timeout: 15_000 });
      await receiver.clock.fastForward(31_000);
      await receiver.locator('[data-handoff-337]').waitFor();
      assert.match(await receiver.locator('[data-handoff-337]').innerText(), /scaduto/u);
      assert.equal(new URL(receiver.url()).hash, "");
      assert.equal(await receiver.locator('[data-result-class="image"]').count(), 0);
      assert.equal(await receiver.locator('form input[type="file"]').first().inputValue(), "");
      await receiver.close();
      await stale.close();
      await popup.close();
      console.log(`${name} #345 journey3 PASS: actual verified PNG→#337 one-use; reload/direct/expiry no blob resurrection`);

      assert.deepEqual(outbound, [], `${name} must not upload or issue off-origin requests`);
      assert.deepEqual(errors, [], `${name} page errors`);
      await context.close();
      passed++;
    } finally { await browser.close(); }
  }
  assert.equal(passed, engineNames.length);
  console.log(`#345 PASS: 3 genuine journeys × ${passed} browser engines; local-only static source`);
} finally {
  await new Promise((done) => server.close(done));
}

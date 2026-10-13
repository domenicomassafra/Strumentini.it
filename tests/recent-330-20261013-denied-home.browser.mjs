/** #330: storage-denied completion must not masquerade as an empty history.
 * Source-accurate static build; real Chrome and WebKit, no physical device claim.
 * RECENT330_DIST=dist node tests/recent-330-20261013-denied-home.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium, webkit } from "@playwright/test";

const root = resolve(process.env.RECENT330_DIST ?? "dist");
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".json": "application/json",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    const path = resolve(root, "." + pathname, pathname.endsWith("/") ? "index.html" : "");
    const rel = relative(root, path);
    if (rel === ".." || rel.startsWith(".." + sep)) return res.writeHead(403).end();
    const bytes = await readFile(path);
    res.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
const origin = `http://127.0.0.1:${server.address().port}`;

async function completeRealUtm(page) {
  await page.goto(origin + "/tools/utm-builder/", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "URL di destinazione" }).fill("https://example.org/private-sentinel-330");
  await page.getByRole("textbox", { name: "Sorgente" }).fill("sensitive-source-330");
  await page.getByRole("textbox", { name: "Mezzo" }).fill("email");
  await page.getByRole("textbox", { name: "Campagna" }).fill("private-campaign-330");
  await page.getByRole("button", { name: "Crea URL" }).click();
  await page.locator('[data-result-class="text-code"]').waitFor({ timeout: 12_000 });
}

try {
  for (const [name, launcher] of [["Chrome", chromium], ["WebKit", webkit]]) {
    const browser = await launcher.launch(name === "Chrome"
      ? { headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }
      : { headless: true });
    try {
      for (const width of [320, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 844 } });
        const errors = [], outgoing = [];
        const page = await context.newPage();
        page.on("pageerror", error => errors.push(error.message));
        page.on("request", request => {
          if (request.method() !== "GET" && request.method() !== "HEAD") outgoing.push(request.method() + " " + request.url());
          assert(request.url().startsWith(origin), "Recent operation must not send requests offsite");
        });
        try {
          // Healthy control: an actual completed producer, ID/time/count only,
          // reaches the canonical Home history and survives browser reload.
          await completeRealUtm(page);
          await page.waitForFunction(async () => {
            try {
              if (typeof indexedDB.databases === "function" && !(await indexedDB.databases()).some(db => db.name === "utility-workbench")) return false;
              const opened = indexedDB.open("utility-workbench", 1);
              return await new Promise(resolveRecord => {
                opened.onerror = () => resolveRecord(false);
                opened.onsuccess = () => {
                  const db = opened.result;
                  const tx = db.transaction("state", "readonly");
                  const request = tx.objectStore("state").get("workbench/state:v1");
                  request.onsuccess = () => resolveRecord(request.result?.recent?.find(row => row.toolId === "utm-builder")?.useCount === 1);
                  request.onerror = () => resolveRecord(false);
                  tx.oncomplete = () => db.close();
                };
              });
            } catch { return false; }
          }, undefined, { timeout: 10_000 });
          await page.goto(origin + "/", { waitUntil: "networkidle" });
          await page.locator("[data-recent-list] a[href='/tools/utm-builder']").first().waitFor({ timeout: 12_000 });
          assert.equal(await page.locator("[data-recent-section]").isVisible(), true);
          assert.equal(await page.locator("[data-recent-warning]").isVisible(), false);
          await page.reload({ waitUntil: "networkidle" });
          await page.locator("[data-recent-list] a[href='/tools/utm-builder']").first().waitFor({ timeout: 12_000 });
          const state = await page.evaluate(async () => {
            const opened = indexedDB.open("utility-workbench", 1);
            return new Promise((resolveState, reject) => {
              opened.onerror = () => reject(opened.error);
              opened.onsuccess = () => {
                const db = opened.result;
                const tx = db.transaction("state", "readonly");
                const request = tx.objectStore("state").get("workbench/state:v1");
                request.onsuccess = () => resolveState(request.result);
                request.onerror = () => reject(request.error);
                tx.oncomplete = () => db.close();
              };
            });
          });
          assert.deepEqual(Object.keys(state.recent[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
          assert.deepEqual(state.recent.map(({ toolId, useCount }) => ({ toolId, useCount })), [{ toolId: "utm-builder", useCount: 1 }]);
          assert(Number.isFinite(Date.parse(state.recent[0].lastUsedAt)));
          for (const privateValue of ["private-sentinel-330", "sensitive-source-330", "private-campaign-330"]) {
            assert(!JSON.stringify(state).includes(privateValue), `${name} ${width}px must not persist UTM input in workbench state`);
          }
        } finally { await context.close(); }

        const denied = await browser.newContext({ viewport: { width, height: 844 } });
        await denied.addInitScript(() => {
          Object.defineProperty(window, "indexedDB", {
            configurable: true,
            get() { throw new DOMException("Storage forbidden by browser policy", "SecurityError"); },
          });
        });
        const deniedPage = await denied.newPage();
        deniedPage.on("pageerror", error => errors.push(error.message));
        deniedPage.on("request", request => {
          if (request.method() !== "GET" && request.method() !== "HEAD") outgoing.push(request.method() + " " + request.url());
          assert(request.url().startsWith(origin), "Denied-storage operation must not contact offsite URLs");
        });
        try {
          // A new/anonymous denied device has no history, but it MUST disclose
          // that zero items doesn't mean zero completions can be remembered.
          await deniedPage.goto(origin + "/", { waitUntil: "networkidle" });
          await deniedPage.locator("[data-recent-warning]:not([hidden])").waitFor({ timeout: 10_000 });
          assert.equal(await deniedPage.locator("[data-recent-section]").isVisible(), true,
            `${name} ${width}px: a hidden ancestor must not conceal the IndexedDB denial warning`);
          assert.equal(await deniedPage.locator("[data-recent-warning]").isVisible(), true);
          assert.equal(await deniedPage.locator("[data-recent-list] li").count(), 0);
          await completeRealUtm(deniedPage);
          await deniedPage.goto(origin + "/", { waitUntil: "networkidle" });
          await deniedPage.locator("[data-recent-warning]").waitFor({ state: "visible", timeout: 10_000 });
          assert.equal(await deniedPage.locator("[data-recent-list] li").count(), 0);
          assert.equal((await deniedPage.locator("[data-recent-section]").innerText()).includes("private-sentinel-330"), false);
          await deniedPage.reload({ waitUntil: "networkidle" });
          assert.equal(await deniedPage.locator("[data-recent-warning]").isVisible(), true);
          assert.equal(await deniedPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
          assert.deepEqual(errors, [], `${name} ${width}px page errors`);
          assert.deepEqual(outgoing, [], `${name} ${width}px unconsented POST/upload`);
          console.log(`#330 ${name} ${width}px PASS: real UTM completion/reload + IndexedDB-denied visible Home warning, no upload`);
        } finally { await denied.close(); }

        const unavailable = await browser.newContext({ viewport: { width, height: 844 } });
        await unavailable.addInitScript(() => {
          Object.defineProperty(window, "indexedDB", { configurable: true,
            get() { throw new DOMException("Storage forbidden by browser policy", "SecurityError"); } });
        });
        const unavailablePage = await unavailable.newPage();
        const failedChunks = [], unavailableErrors = [], unavailableWrites = [];
        unavailablePage.on("pageerror", error => unavailableErrors.push(error.message));
        unavailablePage.on("request", request => {
          assert(request.url().startsWith(origin), "Catalog failure must not contact offsite URLs");
          if (!["GET", "HEAD"].includes(request.method())) unavailableWrites.push(request.method());
        });
        await unavailablePage.route("**/*workbench-catalog*", route => {
          failedChunks.push(route.request().url());
          return route.abort("failed");
        });
        try {
          assert.equal((await unavailablePage.goto(origin + "/", { waitUntil: "networkidle" }))?.status(), 200);
          assert(failedChunks.length > 0, "The real optional catalog request must actually fail");
          await unavailablePage.locator("[data-recent-warning]").waitFor({ state: "visible", timeout: 10_000 });
          assert.equal(await unavailablePage.locator("[data-recent-section]").isVisible(), true);
          assert.equal(await unavailablePage.locator("[data-recent-list] li").count(), 0);
          await unavailablePage.reload({ waitUntil: "networkidle" });
          assert.equal(await unavailablePage.locator("[data-recent-warning]").isVisible(), true);
          assert.deepEqual(unavailableErrors, [], "Rejected optional catalog must not leave uncaught errors");
          assert.deepEqual(unavailableWrites, [], "No upload/write despite denied storage and failed catalog");
          console.log(`#330 ${name} ${width}px PASS: denied IndexedDB + failed optional catalog retains visible warning on reload`);
        } finally { await unavailable.close(); }
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(resolveClose => server.close(resolveClose));
}

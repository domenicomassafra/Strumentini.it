/** #343: real static UI configuration v2 export→erase→import→reload with hostile negative inputs.
 * Native Chrome + WebKit, real IndexedDB and local downloaded files, no provider or uploads.
 * Run: CONFIG343_DIST=dist node tests/config-import-343-20261013-real-ui.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, relative, extname, sep } from "node:path";
import { chromium, webkit } from "@playwright/test";

const root = resolve(process.env.CONFIG343_DIST ?? "dist");
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".png": "image/png", ".wasm": "application/wasm",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    const file = resolve(root, "." + pathname, pathname.endsWith("/") ? "index.html" : "");
    const name = relative(root, file);
    if (name === ".." || name.startsWith(".." + sep)) return res.writeHead(403).end();
    const bytes = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
const origin = `http://127.0.0.1:${server.address().port}`;

async function readState(page) {
  return page.evaluate(async () => new Promise((ok, fail) => {
    const request = indexedDB.open("utility-workbench", 1);
    request.onerror = () => fail(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("state", "readonly");
      const lookup = tx.objectStore("state").get("workbench/state:v1");
      lookup.onsuccess = () => ok(lookup.result);
      lookup.onerror = () => fail(lookup.error);
      tx.oncomplete = () => db.close();
    };
  }));
}
async function finishUtm(page) {
  await page.goto(origin + "/tools/utm-builder/", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "URL di destinazione" }).fill("https://example.org/private-ticket-343");
  await page.getByRole("textbox", { name: "Sorgente" }).fill("secret-source-343");
  await page.getByRole("textbox", { name: "Mezzo" }).fill("email");
  await page.getByRole("textbox", { name: "Campagna" }).fill("secret-campaign-343");
  await page.getByRole("button", { name: "Crea URL" }).click();
  await page.locator('[data-result-class="text-code"]').waitFor();
  await page.waitForFunction(async () => {
    try {
      const db = await new Promise((ok, fail) => { const req = indexedDB.open("utility-workbench", 1); req.onsuccess = () => ok(req.result); req.onerror = () => fail(req.error); });
      const result = await new Promise((ok) => { const tx = db.transaction("state", "readonly"); const request = tx.objectStore("state").get("workbench/state:v1"); request.onsuccess = () => ok(request.result); request.onerror = () => ok(null); tx.oncomplete = () => db.close(); });
      return result?.recent?.some(row => row.toolId === "utm-builder" && row.useCount === 1) ?? false;
    } catch { return false; }
  }, undefined, { timeout: 12_000 });
}
async function importJson(page, text, filename = "config-v2.json") {
  await page.locator("[data-local-import]").setInputFiles({ name: filename, mimeType: "application/json", buffer: Buffer.from(text) });
  await page.locator("[data-local-message]:not([hidden])").waitFor({ timeout: 12_000 });
  return page.locator("[data-local-message]").innerText();
}

try {
  for (const [label, driver] of [["Chrome", chromium], ["WebKit", webkit]]) {
    const browser = await driver.launch(label === "Chrome"
      ? { headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }
      : { headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
      const page = await context.newPage();
      const errors = [], outside = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => {
        const request = route.request();
        if (!request.url().startsWith(origin)) { outside.push(request.url()); return route.abort(); }
        if (!(["GET", "HEAD"].includes(request.method()))) outside.push(`${request.method()} ${request.url()}`);
        return route.continue();
      });
      await page.route("**/api/auth/**", route => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthenticated"}' }));
      await finishUtm(page);
      const before = await readState(page);
      assert.equal(before.recent.some(row => row.toolId === "utm-builder"), true);
      // An independently saved local PDF lives in a second opt-in database,
      // which must be deleted before the settings page reports success.
      await page.evaluate(async () => {
        const open = indexedDB.open("strumentini-optin-pdf-341", 1);
        const db = await new Promise((ok, fail) => {
          open.onupgradeneeded = () => open.result.createObjectStore("pdf", { keyPath: "id" });
          open.onsuccess = () => ok(open.result);
          open.onerror = () => fail(open.error);
        });
        await new Promise((ok, fail) => {
          const tx = db.transaction("pdf", "readwrite");
          tx.objectStore("pdf").put({ id: "config343-private-pdf", bytes: new Uint8Array([37, 80, 68, 70, 45]) });
          tx.oncomplete = ok;
          tx.onerror = () => fail(tx.error);
        });
        db.close();
      });
      assert.equal(await page.evaluate(async () => (await indexedDB.databases()).some(item => item.name === "strumentini-optin-pdf-341")), true);
      await page.goto(origin + "/impostazioni/", { waitUntil: "networkidle" });
      await page.locator('[data-settings-tab="privacy"]').click();
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 12_000 }),
        page.locator("[data-local-export]").click(),
      ]);
      assert.equal(download.suggestedFilename(), "strumentini-config-v2.json");
      const config = JSON.parse((await readFile(await download.path())).toString("utf8"));
      assert.equal(config.version, 2);
      assert.equal(config.kind, "utility-workbench-config");
      assert.deepEqual(config.recent, before.recent);
      assert(!JSON.stringify(config).includes("private-ticket-343"));
      assert(!JSON.stringify(config).includes("secret-campaign-343"));

      const old = JSON.stringify({ ...config, version: 1 });
      assert.match(await importJson(page, old, "old-schema.json"), /vecchio schema v1/iu);
      assert.equal(await page.locator("[data-local-import-preview]").isVisible(), false);
      const malicious = JSON.stringify(config).replace(/^\{/u, '{"__proto__":{"polluted":true},');
      assert.match(await importJson(page, malicious), /non valid|contenuto|configuraz|schema/iu);
      assert.equal(await page.locator("[data-local-import-preview]").isVisible(), false);
      const duplicated = JSON.stringify({ ...config, installedTools: [...config.installedTools, config.installedTools[0]] });
      assert.match(await importJson(page, duplicated), /non valid|contenuto|configuraz|schema/iu);
      assert.equal(await page.locator("[data-local-import-preview]").isVisible(), false);
      assert.deepEqual(await readState(page), before, `${label}: invalid imports may not mutate device state`);

      await page.locator("[data-local-clear]").click();
      assert.match(await page.locator("[data-local-clear]").innerText(), /Conferma/u);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle", timeout: 20_000 }),
        page.locator("[data-local-clear]").click(),
      ]);
      await page.waitForFunction(async () => {
        try {
          const req = indexedDB.open("utility-workbench", 1);
          return await new Promise((ok) => { req.onsuccess = () => { const db = req.result; const tx = db.transaction("state", "readonly"); const q = tx.objectStore("state").get("workbench/state:v1"); q.onsuccess = () => ok((q.result?.recent?.length ?? 0) === 0); q.onerror = () => ok(false); tx.oncomplete = () => db.close(); }; req.onerror = () => ok(false); });
        } catch { return false; }
      }, undefined, { timeout: 12_000 });
      assert.equal((await readState(page))?.recent?.length ?? 0, 0, `${label}: confirmed clear removes history`);
      assert.equal(await page.evaluate(async () => (await indexedDB.databases()).some(item => item.name === "strumentini-optin-pdf-341")), false,
        `${label}: successful local reset must delete separate voluntarily saved PDF archive`);

      assert.match(await importJson(page, JSON.stringify(config)), /Controlla.*anteprima/iu);
      await page.locator("[data-local-import-preview]:not([hidden])").waitFor({ timeout: 12_000 });
      assert.match(await page.locator("[data-local-import-summary]").innerText(), /recenti/iu);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle", timeout: 20_000 }),
        page.locator("[data-local-import-confirm]").click(),
      ]);
      await page.waitForFunction(async () => {
        try { const request = indexedDB.open("utility-workbench", 1); return await new Promise((ok) => { request.onsuccess = () => { const db=request.result, tx=db.transaction("state","readonly"), q=tx.objectStore("state").get("workbench/state:v1"); q.onsuccess = () => ok(q.result?.recent?.some(row => row.toolId === "utm-builder") ?? false); q.onerror=()=>ok(false); tx.oncomplete=()=>db.close(); }; request.onerror = () => ok(false); }); } catch { return false; }
      }, undefined, { timeout: 12_000 });
      const after = await readState(page);
      assert.deepEqual(after.recent, config.recent);
      assert.deepEqual(after.installedTools, config.installedTools);
      await page.goto(origin + "/", { waitUntil: "networkidle" });
      await page.locator('[data-recent-list] a[href="/tools/utm-builder"]').first().waitFor({ timeout: 12_000 });
      assert.deepEqual(errors, []);
      assert.deepEqual(outside, [], `${label}: config must remain local; no POST/provider upload`);
      console.log(`#343 ${label} PASS: real UTM→IDB→download v2→malicious+old+duplicate refused→2-stage clear→preview+confirm→persist/reload, zero upload`);
      await context.close();

      // A selectively refused localStorage delete must leave the consent key
      // in place AND visibly refuse the overall reset, even if IDB deletion works.
      const denied = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const deniedPage = await denied.newPage();
      await deniedPage.route("**/api/auth/**", route => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthenticated"}' }));
      await deniedPage.goto(origin + "/impostazioni/", { waitUntil: "networkidle" });
      await deniedPage.locator('[data-settings-tab="privacy"]').click();
      await deniedPage.evaluate(() => {
        localStorage.setItem("strumentini:auto-download:v1", "enabled");
        localStorage.setItem("strumentini:unrelated-config-343", "removable");
        const remove = Storage.prototype.removeItem;
        Storage.prototype.removeItem = function (key) {
          if (this === window.localStorage && key === "strumentini:auto-download:v1") {
            throw new DOMException("Selective storage access denied", "SecurityError");
          }
          return remove.call(this, key);
        };
      });
      await deniedPage.locator("[data-local-clear]").click();
      await deniedPage.locator("[data-local-clear]").click();
      await deniedPage.getByText("La cancellazione locale non è riuscita completamente", { exact: false }).waitFor({ timeout: 7_000 });
      assert.equal(await deniedPage.evaluate(() => localStorage.getItem("strumentini:auto-download:v1")), "enabled");
      assert.equal(await deniedPage.evaluate(() => localStorage.getItem("strumentini:unrelated-config-343")), null);
      console.log(`#343 ${label} PASS: selective Storage.removeItem SecurityError retains opt-in and discloses incomplete reset`);
      await denied.close();
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }

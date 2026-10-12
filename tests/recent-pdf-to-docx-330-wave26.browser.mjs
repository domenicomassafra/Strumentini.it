/** Real public PDF->DOCX browser flow, independently reopened by python-docx. */
import { chromium, firefox, webkit } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.DOCX330_PORT ?? 18566);
const origin = process.env.DOCX330_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.DOCX330_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" });
const fixture = resolve(root, "quality/fixtures/pdf-gold/simple-3page.pdf");
const independent = String.raw`
import sys,zipfile,hashlib
from docx import Document
path=sys.argv[1]
with zipfile.ZipFile(path) as archive:
 assert archive.testzip() is None, 'ZIP CRC mismatch'
 assert 'word/document.xml' in archive.namelist()
doc=Document(path)
paragraphs=[p.text for p in doc.paragraphs if p.text]
assert len([p for p in paragraphs if p.startswith('Pagina PDF ')]) == 3, paragraphs
for page in (1,2,3):
 assert any(p.startswith('Pagina PDF '+str(page)+' di 3') for p in paragraphs), paragraphs
expected_hash=hashlib.sha256(open(sys.argv[2], 'rb').read()).hexdigest()
assert ('SHA-256 PDF: '+expected_hash) in paragraphs, 'DOCX provenance digest differs from source file'
assert any('testo selezionabile' in p for p in paragraphs)
assert len(paragraphs)>10
print('PDF57_INDEPENDENT_DOCX_PASS paragraphs='+str(len(paragraphs))+' pages=3 editable=true crc=true')
`;

const toolId = "pdf-to-markdown"; // Canonical route containing PDF→DOCX submode.
async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" &&
        !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const opened = indexedDB.open("utility-workbench",1);
      opened.onerror = () => reject(opened.error);
      opened.onsuccess = () => {
        const db = opened.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
        const tx = db.transaction("state","readonly");
        const item = tx.objectStore("state").get("workbench/state:v1");
        item.onerror = () => reject(item.error);
        item.onsuccess = () => resolve(item.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}
async function expectCount(page, count, timeout = 9000) {
  const until = Date.now() + timeout;
  let rows;
  do {
    rows = await recent(page);
    const selected = rows.filter(item => item.toolId === toolId);
    if ((count === 0 && selected.length === 0) || (selected.length === 1 && selected[0].useCount === count)) {
      if (count) {
        assert.deepEqual(Object.keys(selected[0]).sort(), ["lastUsedAt","toolId","useCount"]);
        assert(Number.isFinite(Date.parse(selected[0].lastUsedAt)));
      }
      assert(!JSON.stringify(rows).includes("PRIVATE_DOCX_SOURCE"), "Private filename persisted");
      return;
    }
    await new Promise(done => setTimeout(done,95));
  } while (Date.now() < until);
  assert.fail(`Expected DOCX Recenti ${toolId} count ${count}, observed ${JSON.stringify(rows)}`);
}

let count = 0;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { ready = (await fetch(`${origin}/tools/pdf-to-markdown/`)).ok; if (ready) break; } catch { /* waiting for dev startup */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, "PDF to Markdown and DOCX public route unavailable");
  for (const [name, launcher] of Object.entries({ chromium })) {
    const browser = await launcher.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
      const errors = [], offsite = [], writes = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("request", (request) => {
        if (!["GET", "HEAD"].includes(request.method()) || request.postData() !== null) writes.push(`${request.method()} ${request.url()}`);
      });
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith(origin + "/") || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
        offsite.push(url); return route.abort();
      });
      assert.equal((await page.goto(`${origin}/tools/pdf-to-markdown/`, { waitUntil: "networkidle" }))?.status(), 200);
      await expectCount(page,0);
      const panel = page.locator("[data-pdf-docx-57]");
      await panel.waitFor({ timeout: 30_000 });
      await panel.locator('input[type="file"]').setInputFiles({
        name: "PRIVATE_DOCX_SOURCE.pdf", mimeType: "application/pdf", buffer: await readFile(fixture),
      });
      await panel.locator("form").evaluate((form) => {
        for (let i = 0; i < 2; i++) {
          const permitted = form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          if (permitted) throw Error("Uncaught PDF DOCX form submit");
        }
      });
      await Promise.race([
        panel.locator("[data-pdf-docx-57-result]").waitFor({ timeout: 45000 }),
        panel.locator('[role="alert"]').waitFor({ timeout: 45000 }).then(async () => { throw new Error(await panel.locator('[role="alert"]').innerText()); }),
      ]);
      assert.match(await panel.locator("[data-pdf-docx-57-result]").innerText(), /3 pagine/u);
      const [download] = await Promise.all([page.waitForEvent("download"), panel.locator("[data-pdf-docx-57-download]").click()]);
      assert.equal(download.suggestedFilename(), "PRIVATE_DOCX_SOURCE.docx");
      const location = await download.path();
      assert(location);
      const bytes = await readFile(location);
      assert.equal(bytes.toString("utf8", 0, 2), "PK");
      const independentResult = execFileSync("python3", ["-c", independent, location, fixture], { encoding: "utf8" });
      assert.match(independentResult, /PDF57_INDEPENDENT_DOCX_PASS/u);
      await expectCount(page, 1); // RED: genuinely reopened DOCX absent from Recenti.

      await panel.locator('input[type="file"]').setInputFiles(resolve(root, "quality/fixtures/pdf-gold/encrypted-mark.pdf"));
      assert.equal(await panel.locator("[data-pdf-docx-57-download]").count(), 0, "Changing input retained stale DOCX download");
      await panel.getByRole("button", { name: "Crea DOCX modificabile" }).click();
      await panel.locator('[role="alert"]').waitFor({ timeout: 15000 });
      await expectCount(page, 1); // Encrypted PDF refusal must not count.
      await panel.locator('input[type="file"]').setInputFiles({
        name: "PRIVATE_DOCX_SOURCE.pdf", mimeType: "application/pdf", buffer: await readFile(fixture),
      });
      await panel.locator("form").evaluate((form) => {
        const permitted = form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        if (permitted) throw Error("Uncaught PDF DOCX form submit");
        form.querySelector('button[type="button"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(300);
      assert.equal(await panel.locator("[data-pdf-docx-57-download]").count(), 0);
      await expectCount(page, 1);
      await page.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" });
      await page.locator("[data-area-activity]").waitFor({ timeout: 15000 });
      assert.match(await page.locator("[data-area-activity]").innerText(), /pdf|markdown/iu);
      await page.reload({ waitUntil: "networkidle" });
      await expectCount(page, 1);

      assert.deepEqual(errors, [], `${name}: browser JS failures`);
      assert.deepEqual(offsite, [], `${name}: offsite requests`);
      assert.deepEqual(writes, [], `${name}: write requests`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), `${name}: 390px overflow`);
      count++;
      console.log(`PDF57_${name.toUpperCase()}_PASS independent-python-docx-open pages=3 bytes=${bytes.length}, no-offsite, stale-output-cleared`);
      // A denied history store is not allowed to break the local document output.
      const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
      await deniedContext.addInitScript(() => {
        Object.defineProperty(window, "indexedDB", { configurable: true, get() {
          throw new DOMException("denied", "SecurityError");
        } });
      });
      const blocked = await deniedContext.newPage();
      blocked.on("pageerror", (error) => errors.push(String(error)));
      blocked.on("request", (request) => {
        if (!["GET", "HEAD"].includes(request.method()) || request.postData() !== null) writes.push(`${request.method()} ${request.url()}`);
        if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) offsite.push(request.url());
      });
      await blocked.goto(`${origin}/tools/pdf-to-markdown/`, { waitUntil: "networkidle" });
      const blockedPanel = blocked.locator("[data-pdf-docx-57]");
      await blockedPanel.locator('input[type="file"]').setInputFiles(fixture);
      await blockedPanel.getByRole("button", { name: "Crea DOCX modificabile" }).click();
      await blockedPanel.locator("[data-pdf-docx-57-result]").waitFor({ timeout: 45000 });
      const [deniedDownload] = await Promise.all([blocked.waitForEvent("download"), blockedPanel.locator("[data-pdf-docx-57-download]").click()]);
      const deniedPath = await deniedDownload.path();
      assert(deniedPath);
      assert.match(execFileSync("python3", ["-c", independent, deniedPath, fixture], { encoding: "utf8" }), /PDF57_INDEPENDENT_DOCX_PASS/u);
      await blocked.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" });
      assert.match(await blocked.locator("body").innerText(), /memoria|browser|temporane|disponibil/iu);
      assert.deepEqual(errors, [], `${name}: browser errors after denied history`);
      assert.deepEqual(offsite, [], `${name}: offsite after denied history`);
      assert.deepEqual(writes, [], `${name}: writes after denied history`);
      await deniedContext.close();
      await page.close();
    } finally { await browser.close(); }
  }
  console.log(`PDF_DOCX_330_BROWSER_PASS ${count}/1 independent real downloads and reopen`);
} finally { server?.kill("SIGTERM"); }

// End-to-end REAL browser PDF.js conversion, downloaded OOXML and independent
// python-pptx/Pillow reopen. Does not claim mobile physical hardware.
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = 18461;
const origin = (process.env.PPTX330_ORIGIN ?? `http://127.0.0.1:${port}`).replace(/\/$/u, "");
const server = process.env.PPTX330_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" });

const toolId = "pdf-to-images"; // Canonical public page/manifest ID; PPTX is an opt-in submode.
async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" &&
        !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("utility-workbench", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
        const tx = db.transaction("state", "readonly");
        const read = tx.objectStore("state").get("workbench/state:v1");
        read.onerror = () => reject(read.error);
        read.onsuccess = () => resolve(read.result?.recent ?? []);
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
    const matches = rows.filter((item) => item.toolId === toolId);
    if ((count === 0 && matches.length === 0) ||
        (matches.length === 1 && matches[0].useCount === count)) {
      if (count !== 0) {
        assert.deepEqual(Object.keys(matches[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
        assert(Number.isFinite(Date.parse(matches[0].lastUsedAt)));
      }
      assert(!JSON.stringify(rows).includes("PRIVATE_PPTX_DOCUMENT"), "Private source name persisted");
      return;
    }
    await new Promise((done) => setTimeout(done, 90));
  } while (Date.now() < until);
  assert.fail(`Expected Recenti ${toolId} count ${count}, observed ${JSON.stringify(rows)}`);
}

let browser;
let checks = 0;
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    try { ready = (await fetch(`${origin}/tools/pdf-to-images/`)).ok; if (ready) break; } catch { /* start-up */ }
    await new Promise(done => setTimeout(done, 100));
  }
  assert(ready, "PDF image tool route available");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const errors = [];
  const requestBodies = [];
  page.on("pageerror", err => errors.push(err.message));
  page.on("request", request => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) {
      requestBodies.push(`external ${request.url()}`);
    }
    if (request.method() !== "GET" || request.postData() !== null) requestBodies.push(`write request ${request.method()} ${request.url()}`);
  });
  assert.equal((await page.goto(`${origin}/tools/pdf-to-images/`, { waitUntil: "networkidle" })).status(), 200);
  await expectCount(page, 0);
  const panel = page.locator("[data-pdf-pptx-255]");
  await panel.waitFor({ timeout: 15_000 });
  await page.locator('[data-pdf-pptx-255-hydrated="true"]').waitFor({ timeout: 45_000 });
  assert.match(await panel.innerText(), /non ricostruzione modificabile/u);
  checks++;
  await panel.locator('input[type="file"]').setInputFiles({ name: "PRIVATE_PPTX_DOCUMENT.pdf", mimeType: "application/pdf", buffer: await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-3page.pdf")) });
  await panel.getByLabel(/Pagine PDF/u).fill("3,1,2");
  // Dispatch two real form submit events in the same JS turn: no two exports or history entries.
  await panel.locator("form").evaluate((form) => {
    for (let i = 0; i < 2; i++) {
      const allowed = form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      if (allowed) throw Error("PPTX form was not handled");
    }
  });
  await Promise.race([
    panel.locator("[data-pdf-pptx-255-result]").waitFor({ timeout: 45_000 }),
    panel.locator("[data-pdf-pptx-255-status]").getByText(/PDF_PPTX_|INVALID_|ERROR/iu).waitFor({ timeout: 45_000 })
      .then(async () => { throw Error(await panel.locator("[data-pdf-pptx-255-status]").innerText()); }),
  ]);
  assert.match(await panel.locator("[data-pdf-pptx-255-result]").innerText(), /3 slide/iu);
  assert.match(await panel.locator("[data-pdf-pptx-255-result]").innerText(), /3, 1, 2/u);
  assert(await panel.locator("[data-pdf-pptx-255-preview]").evaluate(img => img.complete && img.naturalWidth > 0));
  await panel.locator("[data-pdf-pptx-255-preview]").screenshot({ path: join(tmpdir(), "strumentini-pdf-pptx-255-first-slide.png") });
  checks += 3;
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.locator("[data-pdf-pptx-255-download]").click(),
  ]);
  assert.equal(download.suggestedFilename(), "pagine-pdf-come-slide.pptx");
  const path = await download.path();
  assert(path);
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  checks += 2;
  const python = String.raw`
import io,sys,zipfile,hashlib
from pptx import Presentation
from PIL import Image
path=sys.argv[1]
with open(path,"rb") as h: payload=h.read()
p=Presentation(io.BytesIO(payload))
assert len(p.slides)==3
with zipfile.ZipFile(io.BytesIO(payload)) as z:
    assert z.testzip() is None
    paths=sorted(n for n in z.namelist() if n.startswith("ppt/media/pdf-page-"))
    assert len(paths)==3
for idx,page in enumerate([3,1,2]):
    slide=p.slides[idx]
    assert len(slide.shapes)==1
    pic=slide.shapes[0]
    assert pic.shape_type==13
    assert pic.name==f"Pagina PDF {page} (immagine)"
    with Image.open(io.BytesIO(pic.image.blob)) as im:
        im.load()
        assert im.size[0]>100 and im.size[1]>100
        assert im.format=="PNG"
    assert pic.left>=0 and pic.top>=0
    assert pic.left+pic.width<=p.slide_width+1 and pic.top+pic.height<=p.slide_height+1
    assert abs(pic.width/pic.height - im.width/im.height)<0.01
print("PDF_PPTX_255_BROWSER_INDEPENDENT_REOPEN_PASS pages=3,1,2 slide_shapes=3 raster_PNG=3 zip_crc=PASS")
`;
  const independent = execFileSync("python3", ["-c", python, path], { encoding: "utf8" }).trim();
  assert.match(independent, /PDF_PPTX_255_BROWSER_INDEPENDENT_REOPEN_PASS/u);
  checks++;
  await expectCount(page, 1); // RED: genuine independently reopened PPTX absent from Recenti.

  // Invalid selection must retire the previously downloadable PPTX.
  await panel.getByLabel(/Pagine PDF/u).fill("50");
  assert.equal(await panel.locator("[data-pdf-pptx-255-result]").count(), 0);
  await panel.getByRole("button", { name: "Converti PDF in PPTX" }).click();
  await panel.locator("[data-pdf-pptx-255-status]").getByText(/Selezione pagine/iu).waitFor({ timeout: 20_000 });
  assert.equal(await panel.locator("[data-pdf-pptx-255-download]").count(), 0);
  checks += 2;
  await expectCount(page, 1); // Invalid page range must not register.

  // Cancel a current legitimate submit before its awaited renderer resolves.
  await panel.getByLabel(/Pagine PDF/u).fill("3,1,2");
  await panel.locator("form").evaluate((form) => {
    const submit = form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    if (submit) throw Error("PPTX form was not handled");
    form.querySelector('button[type="button"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(350);
  assert.equal(await panel.locator("[data-pdf-pptx-255-result]").count(), 0);
  await expectCount(page, 1);
  checks += 2;
  await page.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" });
  await page.locator("[data-area-activity]").waitFor({ timeout: 15_000 });
  assert.match(await page.locator("[data-area-activity]").innerText(), /pdf|immagini/iu);
  await page.reload({ waitUntil: "networkidle" });
  await expectCount(page, 1);
  checks += 2;

  const denied = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await denied.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, get() {
      throw new DOMException("denied", "SecurityError");
    } });
  });
  const blocked = await denied.newPage();
  blocked.on("pageerror", err => errors.push(err.message));
  blocked.on("request", request => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) requestBodies.push(`external ${request.url()}`);
    if (request.method() !== "GET" || request.postData() !== null) requestBodies.push(`write request ${request.method()} ${request.url()}`);
  });
  await blocked.goto(`${origin}/tools/pdf-to-images/`, { waitUntil: "networkidle" });
  const blockedPanel = blocked.locator("[data-pdf-pptx-255]");
  await blocked.locator('[data-pdf-pptx-255-hydrated="true"]').waitFor({ timeout: 45_000 });
  await blockedPanel.locator('input[type="file"]').setInputFiles(resolve(root, "quality/fixtures/pdf-gold/simple-3page.pdf"));
  await blockedPanel.getByLabel(/Pagine PDF/u).fill("3,1,2");
  await blockedPanel.getByRole("button", { name: "Converti PDF in PPTX" }).click();
  await blockedPanel.locator("[data-pdf-pptx-255-result]").waitFor({ timeout: 45_000 });
  const [deniedDownload] = await Promise.all([
    blocked.waitForEvent("download"),
    blockedPanel.locator("[data-pdf-pptx-255-download]").click(),
  ]);
  const deniedPath = await deniedDownload.path();
  assert(deniedPath);
  const deniedIndependent = execFileSync("python3", ["-c", python, deniedPath], { encoding: "utf8" }).trim();
  assert.match(deniedIndependent, /PDF_PPTX_255_BROWSER_INDEPENDENT_REOPEN_PASS/u);
  await blocked.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" });
  assert.match(await blocked.locator("body").innerText(), /memoria|browser|temporane|disponibil/iu);
  await denied.close();
  checks += 3;
  assert.deepEqual(errors, []);
  assert.deepEqual(requestBodies, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px no horizontal overflow");
  checks += 3;
  console.log(`PDF_PPTX_330_WAVE26_PASS checks=${checks} ${independent}, download=<real PPTX> local only`);
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

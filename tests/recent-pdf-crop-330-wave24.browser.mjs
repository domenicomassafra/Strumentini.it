/** #330 wave24: actual CropBox/MediaBox PDF, success-only Recenti, stale/cancel.
 * Real desktop Google Chrome at 390px; independent pypdf source/output reopen.
 * Run: node tests/recent-pdf-crop-330-wave24.browser.mjs
 */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const id = "pdf-crop-normalize";
const port = Number(process.env.CROP330_PORT ?? 18647);
const origin = process.env.CROP330_ORIGIN ?? `http://127.0.0.1:${port}`;
const tmp = await mkdtemp(join(tmpdir(), "crop330-wave24-"));
const original = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-3page.pdf"));
const replacement = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-2page.pdf"));
const generate = [
  "import sys,io", "from pypdf import PdfReader,PdfWriter",
  "r=PdfReader(io.BytesIO(sys.stdin.buffer.read()),strict=True); w=PdfWriter()",
  "for i,p in enumerate(r.pages):",
  " if i==1:",
  "  p.cropbox.lower_left=(30,20)",
  "  p.cropbox.upper_right=(582,772)",
  "  p.rotate(90)",
  " w.add_page(p)",
  "o=io.BytesIO();w.write(o);sys.stdout.buffer.write(o.getvalue())",
].join("\n");
const fixture = spawnSync("python3", ["-c", generate], {
  input: original, timeout: 15000, maxBuffer: 2_000_000,
});
assert.equal(fixture.status, 0, `fixture pypdf failure ${fixture.stderr}`);
const source = Buffer.from(fixture.stdout);
assert.equal(source.subarray(0, 5).toString(), "%PDF-");
const sourcePath = join(tmp, "source.pdf");
await writeFile(sourcePath, source);

const inspectScript = [
  "import sys,json,hashlib",
  "from pypdf import PdfReader",
  "r=PdfReader(sys.argv[1],strict=True)",
  "out=[]",
  "for p in r.pages:",
  " raw=p.get('/Contents')",
  " if raw is None: streams=[]",
  " elif isinstance(raw,list): streams=[v.get_object().get_data() for v in raw]",
  " else: streams=[raw.get_object().get_data()]",
  " out.append({'media':[float(v) for v in p.mediabox],",
  "  'crop':[float(v) for v in p.cropbox],",
  "  'rotate':int(p.get('/Rotate',0)),",
  "  'text':p.extract_text() or '',",
  "  'streams':[hashlib.sha256(x).hexdigest() for x in streams]})",
  "print(json.dumps(out))",
].join("\n");
function inspect(path) {
  const done = spawnSync("python3", ["-c", inspectScript, path], { encoding: "utf8", timeout: 15000 });
  assert.equal(done.status, 0, `independent pypdf strict failed: ${done.stderr}`);
  return JSON.parse(done.stdout);
}
const initial = inspect(sourcePath);
assert.deepEqual(initial.map(p => p.rotate), [0, 90, 0]);
assert.deepEqual(initial[1].crop, [30, 20, 582, 772]);
assert.deepEqual(initial.map(p => p.text.trim()), ["one", "two", "three"]);
const faults = [], network = [];
function watch(page) {
  page.on("pageerror", e => faults.push(e.message));
  page.on("request", request => {
    const url = request.url();
    if (!["GET", "HEAD"].includes(request.method()) ||
       !(url.startsWith(origin) || url.startsWith("blob:") || url.startsWith("data:"))) {
      network.push(`${request.method()} ${url}`);
    }
  });
}
async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" &&
        !(await indexedDB.databases()).some(x => x.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const opened = indexedDB.open("utility-workbench", 1);
      opened.onerror = () => reject(opened.error);
      opened.onsuccess = () => {
        const db = opened.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
        const tx = db.transaction("state", "readonly");
        const req = tx.objectStore("state").get("workbench/state:v1");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}
async function count(page, expected, timeout = 11000) {
  const until = Date.now() + timeout;
  let rows = [];
  do {
    rows = await recent(page);
    const matches = rows.filter(row => row.toolId === id);
    if ((expected === 0 && matches.length === 0) ||
        (matches.length === 1 && matches[0].useCount === expected)) {
      if (expected > 0) {
        assert.deepEqual(Object.keys(matches[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
        assert(Number.isFinite(Date.parse(matches[0].lastUsedAt)));
      }
      const text = JSON.stringify(rows);
      for (const token of ["PRIVATE_", "%PDF-", "source.pdf", "pdf-ritagliato", "pdf-dimensioni", "one", "two", "three"]) {
        assert(!text.includes(token), `Private content/filename stored in Recenti: ${token}`);
      }
      return rows;
    }
    await new Promise(done => setTimeout(done, 75));
  } while (Date.now() < until);
  assert.fail(`Expected ${expected} Recenti completions; found ${JSON.stringify(rows)}`);
}
async function ready() {
  for (let i = 0; i < 160; i++) {
    try { if ((await fetch(origin + "/tools/pdf-crop-normalize/")).ok) return; } catch { /* startup */ }
    await new Promise(done => setTimeout(done, 250));
  }
  throw Error("Crop Normalize local Astro route unavailable");
}
async function open(page) {
  assert.equal((await page.goto(origin + "/tools/pdf-crop-normalize/", { waitUntil: "networkidle" }))?.status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every(node => !node.hasAttribute("ssr")), null, { timeout: 25000 });
}
async function choose(page, bytes, name) {
  await page.locator("[data-pdf-crop-normalize] input[type=file]").first().setInputFiles({
    name, mimeType: "application/pdf", buffer: bytes,
  });
}
async function submit(page, times = 1) {
  await page.evaluate(n => {
    const form = document.querySelector("[data-pdf-crop-normalize]");
    for (let i = 0; i < n; i++)
      assertSubmit(form);
    function assertSubmit(form) {
      if (form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
        throw Error("Form submitted natively without preventDefault");
    }
  }, times);
}
async function holdRaf(page) {
  await page.evaluate(() => {
    window.__cropRealRaf = window.requestAnimationFrame;
    window.__cropQueuedFrames = [];
    window.requestAnimationFrame = callback => { window.__cropQueuedFrames.push(callback); return 449900; };
  });
}
async function releaseRaf(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame = window.__cropRealRaf;
    for (const callback of window.__cropQueuedFrames.splice(0)) callback(performance.now());
  });
}
async function getOutput(page, expected, operation) {
  const pending = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("link", { name: "Scarica PDF modificato" }).click();
  const file = await pending;
  const bytes = await readFile(await file.path());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  const pages = inspect(await file.path());
  assert.equal(pages.length, expected.length);
  pages.forEach((p, i) => {
    assert.deepEqual(p.media.map(Math.round), expected[i].media.map(Math.round), `${operation} MediaBox page ${i + 1}`);
    assert.deepEqual(p.crop.map(Math.round), expected[i].crop.map(Math.round), `${operation} CropBox page ${i + 1}`);
    assert.equal(p.rotate, expected[i].rotate, `${operation} Rotate page ${i + 1}`);
    assert.equal(p.text.trim(), initial[i].text.trim(), `${operation} text lost page ${i + 1}`);
    for (const hash of initial[i].streams) {
      assert(p.streams.includes(hash), `${operation} original Contents stream altered page ${i + 1}`);
    }
  });
  return { size: bytes.length, pages };
}
// Prefer isolated static output (CROP330_DIST=...) to avoid disturbing
// concurrent Astro dev workers sharing a single project-server lock.
const server = process.env.CROP330_ORIGIN ? null :
  spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1",
    "--directory", process.env.CROP330_DIST ?? "dist"], { cwd: root, stdio: "ignore" });
let browser;
try {
  await ready();
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  watch(page); await open(page);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  await count(page, 0);
  await choose(page, Buffer.from("not a real pdf"), "PRIVATE_BAD_CROP.pdf");
  await page.getByRole("alert").first().waitFor({ timeout: 12000 });
  await count(page, 0);
  await choose(page, source, "PRIVATE_CROP_SECRET_3.pdf");
  await page.locator("[data-crop-preview]").waitFor({ timeout: 20000 });
  await page.getByLabel("Pagine").fill("3-1");
  assert(await page.getByRole("button", { name: "Applica crop visivo" }).isDisabled());
  await count(page, 0);
  await page.getByLabel("Pagine").fill("2");
  for (const [label, value] of [
    ["Nascondi sinistra (pt)", "10"], ["Nascondi alto (pt)", "20"],
    ["Nascondi destra (pt)", "30"], ["Nascondi basso (pt)", "40"],
  ]) await page.getByLabel(label).fill(value);
  await submit(page, 2);
  await page.locator(".result-panel[data-state=success]").waitFor({ timeout: 20000 });
  const expectedCrop = initial.map(p => ({ media: p.media, crop: p.crop, rotate: p.rotate }));
  expectedCrop[1] = { media: initial[1].media, crop: [70, 30, 562, 742], rotate: 90 };
  const crop = await getOutput(page, expectedCrop, "crop");
  await count(page, 1); // RED before fix: genuine output but no Recenti
  await page.waitForTimeout(200);
  await count(page, 1); // double-submit never counted twice

  await holdRaf(page); await submit(page);
  await page.getByRole("button", { name: "Annulla modifica PDF" }).click();
  await releaseRaf(page); await page.waitForTimeout(120);
  assert.equal(await page.getByRole("link", { name: "Scarica PDF modificato" }).count(), 0);
  await count(page, 1);

  await holdRaf(page); await submit(page);
  await page.getByLabel("Nascondi sinistra (pt)").fill("999");
  await releaseRaf(page); await page.waitForTimeout(120);
  assert.equal(await page.getByRole("link", { name: "Scarica PDF modificato" }).count(), 0);
  await count(page, 1);

  await page.getByLabel("Nascondi sinistra (pt)").fill("10");
  await holdRaf(page); await submit(page);
  await choose(page, replacement, "PRIVATE_REPLACEMENT_CROP.pdf");
  await releaseRaf(page); await page.waitForTimeout(120);
  assert.equal(await page.getByRole("link", { name: "Scarica PDF modificato" }).count(), 0);
  await count(page, 1);

  await choose(page, source, "PRIVATE_CROP_SECRET_FINAL.pdf");
  await page.locator("[data-crop-preview]").waitFor({ timeout: 20000 });
  await page.getByLabel("Operazione").selectOption("normalize");
  await page.getByLabel("Pagine").fill("2");
  await page.getByLabel("Formato destinazione").selectOption("letter-landscape");
  await page.getByLabel("Adattamento").selectOption("contain");
  await page.getByRole("button", { name: "Normalizza pagine" }).click();
  await page.locator(".result-panel[data-state=success]").waitFor({ timeout: 20000 });
  const expectedNorm = initial.map(p => ({ media: p.media, crop: p.crop, rotate: p.rotate }));
  expectedNorm[1] = { media: [0, 0, 792, 612], crop: [0, 0, 792, 612], rotate: 0 };
  const normalized = await getOutput(page, expectedNorm, "normalize");
  await count(page, 2);
  await page.goto(origin + "/preferiti/", { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor({ timeout: 20000 });
  assert.match(await page.locator("[data-area-activity]").innerText(), /Crop|Dimensioni|PDF/iu);
  await page.reload({ waitUntil: "networkidle" }); await count(page, 2);
  await context.close();

  const denied = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await denied.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true, get() { throw new DOMException("storage disabled", "SecurityError"); },
    });
  });
  const blocked = await denied.newPage(); watch(blocked); await open(blocked);
  await choose(blocked, source, "PRIVATE_STORAGE_DENIED.pdf");
  await blocked.locator("[data-crop-preview]").waitFor({ timeout: 20000 });
  await blocked.getByRole("button", { name: "Applica crop visivo" }).click();
  await blocked.locator(".result-panel[data-state=success]").waitFor({ timeout: 20000 });
  const deniedCrop = initial.map(p => ({ media: p.media, crop: p.crop, rotate: p.rotate }));
  deniedCrop[0] = { media: initial[0].media, crop: [24, 24, 588, 768], rotate: 0 };
  deniedCrop[1] = { media: initial[1].media, crop: [54, 44, 558, 748], rotate: 90 };
  deniedCrop[2] = { media: initial[2].media, crop: [24, 24, 588, 768], rotate: 0 };
  await getOutput(blocked, deniedCrop, "storage denied");
  await blocked.goto(origin + "/preferiti/", { waitUntil: "networkidle" });
  assert.match(await blocked.locator("body").innerText(), /memoria|browser|temporane|disponibil/iu);
  await denied.close();
  assert.deepEqual(network, [], "Non-loopback or non-GET upload");
  assert.deepEqual(faults, [], "Browser page JS errors");
  console.log("#330 wave24 CropNormalize PASS real Chrome390 pypdf geometry, preserved contents", JSON.stringify({
    cropBytes: crop.size, normalizeBytes: normalized.size, recentUseCount: 2,
    doubleSubmit: "once", staleFileOptionsCancel: "zero", privateIndexedDb: "canonical", deniedStorage: "local PDF works",
    uploads: 0,
  }));
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
  await rm(tmp, { recursive: true, force: true });
}

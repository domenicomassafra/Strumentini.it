/** Independent real-browser acceptance for editable PDF form export (#136). */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const base = "http://127.0.0.1:18536";
const server = spawn("./node_modules/.bin/astro", ["preview", "--host", "127.0.0.1", "--port", "18536", "--strictPort"], { stdio: "pipe" });
let browser;
let log = "";
server.stdout.on("data", (bytes) => { log += bytes.toString(); });
server.stderr.on("data", (bytes) => { log += bytes.toString(); });
async function ready() {
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw Error("preview failed: " + log);
    try { if ((await fetch(base + "/tools/pdf-form-inspector/")).ok) return; } catch {}
    await new Promise((done) => setTimeout(done, 200));
  }
  throw Error("Preview unavailable: " + log);
}
async function fixture() {
  const pdf = await PDFDocument.create();
  const first = pdf.addPage([360, 420]);
  const second = pdf.addPage([360, 420]);
  const form = pdf.getForm();
  const text = form.createTextField("cliente.nome");
  text.addToPage(first, { x: 24, y: 280, width: 190, height: 30 });
  text.addToPage(second, { x: 24, y: 280, width: 190, height: 30 });
  form.createCheckBox("consenso").addToPage(first, { x: 24, y: 250, width: 20, height: 20 });
  const province = form.createDropdown("provincia");
  province.addOptions(["Bari", "Lecce"]);
  province.addToPage(first, { x: 24, y: 200, width: 100, height: 24 });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
async function unsafeFixture(kind) {
  const doc = await PDFDocument.load(await fixture());
  if (kind === "XFA") doc.getForm().acroForm.dict.set(PDFName.of("XFA"), PDFString.of("template"));
  if (kind === "signature") doc.getForm().acroForm.dict.set(PDFName.of("SigFlags"), doc.context.obj(3));
  if (kind === "JavaScript") doc.catalog.set(PDFName.of("OpenAction"), doc.context.obj({ S: "JavaScript", JS: "app.alert('unsafe')" }));
  return Buffer.from(await doc.save({ useObjectStreams: false, updateFieldAppearances: false }));
}
function verifyPypdf(path, flattened) {
  const code = [
    "import sys,json",
    "from pypdf import PdfReader",
    "r=PdfReader(sys.argv[1],strict=True)",
    "data={'pages':len(r.pages),'widgets':[len(page.get('/Annots',[])) for page in r.pages], 'fields':{key:str(value.get('/V','')) for key,value in (r.get_fields() or {}).items()}}",
    "print(json.dumps(data,ensure_ascii=False))",
  ].join("\n");
  const process = spawnSync("python3", ["-c", code, path], { encoding: "utf8", timeout: 20000 });
  assert.equal(process.status, 0, "pypdf rejected output: " + process.stderr);
  const data = JSON.parse(process.stdout);
  assert.equal(data.pages, 2);
  assert.deepEqual(data.widgets, flattened ? [0, 0] : [3, 1]);
  if (flattened) assert.equal(Object.keys(data.fields).length, 0);
  else assert.equal(data.fields["cliente.nome"], "Città di Bari – € 42");
  return data;
}
async function verifyPdf(bytes, flattened) {
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2);
  if (flattened) assert.equal(doc.getForm().getFields().length, 0);
  else {
    assert.equal(doc.getForm().getTextField("cliente.nome").getText(), "Città di Bari – € 42");
    assert.equal(doc.getForm().getTextField("cliente.nome").acroField.getWidgets().length, 2);
    assert.equal(doc.getForm().getCheckBox("consenso").isChecked(), true);
    assert.deepEqual(doc.getForm().getDropdown("provincia").getSelected(), ["Lecce"]);
  }
  const task = getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    assert.equal(pdf.numPages, 2);
    for (let i = 1; i <= 2; i++) {
      const p = await pdf.getPage(i);
      const annotations = await p.getAnnotations();
      assert.equal(annotations.length, flattened ? 0 : i === 1 ? 3 : 1);
      if (!flattened) assert(annotations.some((entry) => entry.fieldName === "cliente.nome" && entry.fieldValue === "Città di Bari – € 42"), "PDF.js field value not retained on page " + i);
      if (flattened) {
        const text = (await p.getTextContent()).items.map((item) => item.str ?? "").join(" ");
        assert(text.includes("Città di Bari"), "Flatten text missing on page " + i + ": " + text);
      }
      p.cleanup();
    }
  } finally { await task.destroy(); }
}
try {
  await ready();
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(base) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) {
      errors.push("External request " + request.url());
    }
  });
  // Exercise the same user flow under a restrictive CSP while remaining fully local.
  const policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'; base-uri 'self'";
  await page.route(base + "/tools/pdf-form-inspector/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": policy } });
  });
  const navigation = await page.goto(base + "/tools/pdf-form-inspector/", { waitUntil: "networkidle" });
  assert.equal(navigation.status(), 200);
  assert.equal(navigation.headers()["content-security-policy"], policy);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px overflow");
  const heapBefore = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
  const begin = performance.now();
  const source = await fixture();
  await page.getByLabel("Modulo PDF da compilare").setInputFiles({ name: "modulo.pdf", mimeType: "application/pdf", buffer: source });
  await page.locator("[data-form-fields-136]").waitFor({ timeout: 20000 });
  assert.equal(await page.locator("[data-form-fields-136] input[type=text]").count(), 1);
  await page.locator("[data-form-fields-136] input[type=text]").fill("Città di Bari – € 42");
  await page.locator("[data-form-fields-136] input[type=checkbox]").first().check();
  await page.locator("[data-form-fields-136] select").selectOption("Lecce");
  await context.setOffline(true);
  let pending = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("button", { name: "Compila e verifica PDF" }).click();
  await page.locator("[data-form-result-136]").waitFor({ timeout: 30000 });
  await page.getByRole("link", { name: "Scarica PDF verificato" }).click();
  let downloaded = await pending;
  const editablePath = await downloaded.path();
  const editable = await readFile(editablePath);
  await verifyPdf(editable, false);
  verifyPypdf(editablePath, false);
  await writeFile("/tmp/str136-consumer-editable.pdf", editable);
  await context.setOffline(false);
  await page.locator("[data-form-fields-136] input[type=checkbox]").last().check();
  pending = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("button", { name: "Compila e verifica PDF" }).click();
  await page.locator("[data-form-result-136]").waitFor({ timeout: 30000 });
  await page.getByRole("link", { name: "Scarica PDF verificato" }).click();
  downloaded = await pending;
  const flattenedPath = await downloaded.path();
  const flattened = await readFile(flattenedPath);
  await verifyPdf(flattened, true);
  verifyPypdf(flattenedPath, true);
  await writeFile("/tmp/str136-consumer-flattened.pdf", flattened);
  await page.getByRole("button", { name: "Ricomincia" }).click();
  const upload = page.getByLabel("Modulo PDF da compilare");
  assert.equal(await upload.inputValue(), "", "Reset must clear native file selection");
  await upload.setInputFiles({ name: "modulo.pdf", mimeType: "application/pdf", buffer: source });
  await page.locator("[data-form-fields-136]").waitFor({ timeout: 20000 });
  for (const kind of ["XFA", "signature", "JavaScript"]) {
    const rejected = await unsafeFixture(kind);
    const snapshot = Buffer.from(rejected);
    await upload.setInputFiles({ name: kind + ".pdf", mimeType: "application/pdf", buffer: rejected });
    const alert = page.getByRole("alert");
    await alert.waitFor({ timeout: 20000 });
    assert.match(await alert.textContent(), /UNSUPPORTED_CAPABILITY/, kind + " must be refused");
    assert.equal(await page.locator("[data-form-result-136]").count(), 0, "Rejected input cannot be downloaded");
    assert.deepEqual(rejected, snapshot, "Browser must not mutate the source");
  }
  assert.deepEqual(errors, [], "Browser errors or external requests");
  const heapAfter = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
  console.log(JSON.stringify({ status: "PASS", editableBytes: editable.byteLength, flattenedBytes: flattened.byteLength, offlineEditable: true, fields: 3, linkedWidgets: 2, viewport: 390, outsideRequests: 0, pageErrors: 0, elapsedMs: Math.round(performance.now()-begin), heapBefore, heapAfter }));
  await context.close();
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

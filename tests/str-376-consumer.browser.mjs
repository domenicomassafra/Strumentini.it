/** Independent real-browser acceptance for editable PDF form export (#136). */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openPdf136Cdp } from "./str-376-cdp-client.mjs";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const base = "http://127.0.0.1:18536";
const server = spawn("./node_modules/.bin/astro", ["preview", "--host", "127.0.0.1", "--port", "18536", "--strictPort"], { stdio: "pipe" });
let client;
let temporary;
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
const policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'; base-uri 'self'";
const errors = [];
const externalRequests = [];
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
  temporary = await mkdtemp(join(tmpdir(), "str136-consumer-"));
  client = await openPdf136Cdp({ base, directory: temporary, policy, errors, externalRequests });
  assert(await client.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), "390px overflow");
  const heapBefore = await client.evaluate("performance.memory?.usedJSHeapSize ?? null");
  const begin = performance.now();
  const source = await fixture();
  const original = Buffer.from(source);
  await client.upload(source, "original.pdf");
  await client.waitFor('!!document.querySelector("[data-form-fields-136]")', "editable fields");
  assert.equal(await client.evaluate('document.querySelectorAll("[data-form-fields-136] input[type=text]").length'), 1);
  await client.select("[data-form-fields-136] input[type=text]", "Città di Bari – € 42");
  await client.click("[data-form-fields-136] input[type=checkbox]");
  await client.select("[data-form-fields-136] select", "Lecce", "change");
  await client.offline(true);
  await client.click('[data-form-fields-136] button[type=submit]');
  await client.waitFor('!!document.querySelector("[data-form-result-136] a[download]")', "editable export", 30000);
  const editable = await client.download();
  await verifyPdf(editable.bytes, false);
  verifyPypdf(editable.path, false);
  await writeFile("/tmp/str136-consumer-editable.pdf", editable.bytes);
  await client.offline(false);
  await client.click("[data-form-fields-136] label.field:last-of-type input[type=checkbox]");
  assert.equal(await client.evaluate('document.querySelector("[data-form-fields-136] label.field:last-of-type input[type=checkbox]").checked'), true);
  await client.click('[data-form-fields-136] button[type=submit]');
  await client.waitFor('document.querySelector("[data-form-result-136] a[download]")?.download.includes("appiattito")', "flattened export", 30000);
  const flattened = await client.download();
  await verifyPdf(flattened.bytes, true);
  verifyPypdf(flattened.path, true);
  await writeFile("/tmp/str136-consumer-flattened.pdf", flattened.bytes);
  await client.click('[data-form-fields-136] button[type=button]');
  assert.equal(await client.evaluate('document.querySelector("[data-pdf-form-editor-136] input[type=file]").value'), "", "Reset must clear native file selection");
  await client.upload(source, "reset-original.pdf");
  await client.waitFor('!!document.querySelector("[data-form-fields-136]")', "fields after reset");
  for (const kind of ["XFA", "signature", "JavaScript"]) {
    const rejected = await unsafeFixture(kind);
    const snapshot = Buffer.from(rejected);
    await client.upload(rejected, kind + ".pdf");
    await client.waitFor('document.querySelector("[data-pdf-form-editor-136] [role=alert]")?.textContent.includes("UNSUPPORTED_CAPABILITY")', kind + " refusal");
    assert.equal(await client.evaluate('document.querySelectorAll("[data-form-result-136]").length'), 0, "Rejected PDF must not generate download");
    assert.deepEqual(rejected, snapshot, "Rejected source changed: " + kind);
  }
  assert.deepEqual(source, original, "Source PDF changed");
  assert.deepEqual(errors, [], "Unexpected Chrome page errors");
  assert.deepEqual(externalRequests, [], "Offline-locality violation");
  const heapAfter = await client.evaluate("performance.memory?.usedJSHeapSize ?? null");
  console.log(JSON.stringify({
    status: "PASS", editableBytes: editable.bytes.length, flattenedBytes: flattened.bytes.length,
    offlineEditable: true, fields: 3, linkedWidgets: 2, viewport: 390, outsideRequests: 0, pageErrors: 0,
    cspIntercepts: client.cspCount, elapsedMs: Math.round(performance.now() - begin),
    heapBefore, heapAfter, chrome: "managed MiniPC CDP17629 temporary context",
  }));
} finally {
  await client?.close();
  if (temporary) await rm(temporary, { recursive: true, force: true });
  server.kill("SIGTERM");
}

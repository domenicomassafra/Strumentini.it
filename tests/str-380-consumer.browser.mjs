/** Run after npm run build on MiniPC with the existing automation Chrome (:17629). */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { PDFDocument, PDFHexString } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(import.meta.dirname, "..");
const origin = "http://127.0.0.1:18480";
const server = spawn("python3", ["-m", "http.server", "18480", "--bind", "127.0.0.1", "--directory", "dist"],
  { cwd: root, stdio: "ignore" });
let browser;
let page;
let scratch;
const errors = [];
const external = [];

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fixture() {
  const pdf = await PDFDocument.create();
  pdf.addPage([310, 410]).drawText("SOURCE_ALPHA");
  const second = pdf.addPage([360, 440]);
  second.drawText("SOURCE_BETA");
  const appearance = pdf.context.register(pdf.context.flateStream(
    "q 1 0.82 0 rg 0 0 95 18 re f Q",
    { Type: "XObject", Subtype: "Form", BBox: [0, 0, 95, 18] },
  ));
  second.node.addAnnot(pdf.context.register(pdf.context.obj({
    Type: "Annot", Subtype: "Highlight", Rect: [24, 176, 119, 194], F: 4,
    AP: { N: appearance }, Contents: PDFHexString.fromText("Browser comment"),
    QuadPoints: [24, 194, 119, 194, 24, 176, 119, 176],
  })));
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

async function independentPdfJs(bytes) {
  const task = getDocument({ data: Uint8Array.from(bytes), stopAtErrors: true, useSystemFonts: false });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const text = (await page.getTextContent()).items.map((part) => "str" in part ? part.str : "").join("");
      const annotations = (await page.getAnnotations()).map((a) => [a.subtype, a.contentsObj?.str, a.rect]);
      pages.push({ text, annotations });
      page.cleanup();
    }
    return pages;
  } finally { await task.destroy(); }
}

function poppler(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, `${command} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}

try {
  scratch = await mkdtemp(join(tmpdir(), "str-380-consumer-"));
  const sourceBytes = await fixture();
  const input = join(scratch, "input.pdf");
  await writeFile(input, sourceBytes);
  const sourceHash = hash(await readFile(input));
  let ready = false;
  for (let n = 0; n < 50; n++) {
    try {
      if ((await fetch(origin + "/tools/pdf-page-reorder/")).ok) { ready = true; break; }
    } catch { /* Server startup. */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  assert(ready, "Compiled /tools/pdf-page-reorder/ route missing; run npm run build first");
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629");
  const context = browser.contexts()[0];
  assert(context, "Existing Chrome automation context unavailable");
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) {
      external.push(request.method() + " " + url);
    }
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/tools/pdf-page-reorder/", { waitUntil: "domcontentloaded" });
  const workspace = page.locator("[data-pdf-workspace-372]");
  await workspace.locator('input[type="file"]').setInputFiles(input);
  await workspace.locator("[data-pdf-order-status]").waitFor();
  await workspace.getByRole("button", { name: "Inverti ordine" }).click();
  await workspace.getByRole("button", { name: "Crea PDF e verifica" }).click();
  const link = page.locator('a[download$=".pdf"]').first();
  await link.waitFor({ state: "visible", timeout: 45_000 });
  const encoded = await link.evaluate(async (anchor) => {
    const bytes = new Uint8Array(await (await fetch(anchor.href)).arrayBuffer());
    let result = "";
    for (const byte of bytes) result += String.fromCharCode(byte);
    return btoa(result);
  });
  const exported = Buffer.from(encoded, "base64");
  assert.equal(exported.subarray(0, 5).toString(), "%PDF-");
  assert.notEqual(hash(exported), sourceHash);
  assert.equal(hash(await readFile(input)), sourceHash, "Original PDF mutated");
  const output = join(scratch, "export.pdf");
  await writeFile(output, exported);
  const pdfjsPages = await independentPdfJs(exported);
  assert.deepEqual(pdfjsPages.map((item) => item.text), ["SOURCE_BETA", "SOURCE_ALPHA"]);
  assert.deepEqual(pdfjsPages[0]?.annotations, [
    ["Highlight", "Browser comment", [24, 176, 119, 194]],
  ]);
  assert.deepEqual(pdfjsPages[1]?.annotations, []);
  const info = poppler("pdfinfo", [output]);
  assert.match(info, /Pages:\s+2\b/u);
  const popplerText = poppler("pdftotext", [output, "-"]);
  assert(popplerText.indexOf("SOURCE_BETA") < popplerText.indexOf("SOURCE_ALPHA"),
    "Poppler text order differs from editor");
  poppler("pdftoppm", ["-f", "1", "-l", "1", "-singlefile", "-scale-to", "200", "-png",
    output, join(scratch, "render")]);
  const raster = await readFile(join(scratch, "render.png"));
  assert.equal(raster.subarray(1, 4).toString(), "PNG", "Poppler renderer output invalid");

  // A syntactically valid but unsupported form must have no download.
  const form = await PDFDocument.create();
  form.addPage([300, 400]);
  form.getForm().createTextField("unsafe");
  const unsupported = join(scratch, "form.pdf");
  await writeFile(unsupported, await form.save({ useObjectStreams: false }));
  await workspace.locator('input[type="file"]').setInputFiles(unsupported);
  await workspace.locator("[data-pdf-order-status]").waitFor();
  await workspace.getByRole("button", { name: "Crea PDF e verifica" }).click();
  await workspace.getByRole("alert").filter({ hasText: /non supportato|non leggibile|originale|verific/iu })
    .waitFor({ timeout: 45_000 });
  assert.equal(await page.locator('a[download$=".pdf"]').count(), 0, "Unsupported model exposed a download");
  assert.equal(hash(await readFile(input)), sourceHash);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log("STR380_CONSUMER_PASS", JSON.stringify({
    sourceHash, exportHash: hash(exported), pages: 2,
    annotations: 1, viewers: ["PDF.js", "Poppler pdfinfo/pdftotext/pdftoppm"],
    offsiteRequests: external.length, physicalDevice: "NOT_RUN",
  }));
} finally {
  await page?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  if (scratch) await rm(scratch, { force: true, recursive: true });
  server.kill("SIGTERM");
}

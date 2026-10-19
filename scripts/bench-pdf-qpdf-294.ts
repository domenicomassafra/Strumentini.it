/** Reproducible STR-294 donor spike; read-only corpus, no production routing. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import compression from "../src/tools/pdf-compression-lite/module";
import { createPdfToolkit } from "../src/engines/pdf/vendor/pdfstudio/index.js";
import type { PdfCompressionOutput } from "../src/tools/pdf-compression-lite/types";

const cases = [
  "quality/fixtures/pdf-gold/simple-2page.pdf",
  "quality/fixtures/pdf-gold/jpeg-1page.pdf",
  "quality/fixtures/pdf-gold/annotated.pdf",
  "quality/fixtures/pdf-gold/hidden-widget-form.pdf",
  "tests/fixtures/pdf-redaction-malicious-237/fake-signed-byte-range-237.pdf",
  "tests/fixtures/pdf-redaction-malicious-237/hybrid-xrefstm-237.pdf",
  "tests/fixtures/pdf-image-mixed-218/safe-mixed-218.pdf",
  "quality/reference-data/italy/artifacts/117-fiscal-annual/gu-law145-2018-supplement-annex2.pdf",
  "quality/reference-data/italy/artifacts/119-fatturapa-v1.4/Specifiche_tecniche_del_formato_FatturaPA_V1.4.pdf",
  "quality/reference-data/italy/artifacts/129-inps-employee-2026/inps-circolare-43-2026.pdf",
  "quality/reference-data/italy/artifacts/118-inps-2026/inps-circolare-8-2026.pdf",
] as const;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readback(bytes: Uint8Array) {
  const task = getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true, disableFontFace: true });
  try {
    const document = await task.promise;
    const pages = [];
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const view = page.getViewport({ scale: 1 });
      const text = await page.getTextContent();
      const annotations = await page.getAnnotations({ intent: "display" });
      pages.push({
        width: view.width, height: view.height, rotation: view.rotation,
        text: text.items.map((item) => "str" in item ? item.str : "").join(""),
        annotations: annotations.map((a) => ({
          subtype: a.subtype, rect: a.rect, annotationFlags: a.annotationFlags,
          contents: a.contentsObj?.str ?? "", fieldName: a.fieldName,
          fieldValue: a.fieldValue, url: a.url, unsafeUrl: a.unsafeUrl,
        })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      });
    }
    const fields = await document.getFieldObjects() as Record<string, Array<Record<string, unknown>>> | null;
    return { pages, fields: fields === null ? null : Object.fromEntries(Object.entries(fields).map(([key, entries]) =>
      [key, entries.map((entry) => ({ type: entry.type, value: entry.value, name: entry.name,
        charLimit: entry.charLimit, required: entry.required, readOnly: entry.readOnly }))])) };
  } finally { await task.destroy(); }
}

const toolkit = await createPdfToolkit();
console.log("STR-294 comparison: legacy vs pdfstudio@0.4.0 qpdf WASM; independent PDF.js readback");
let regression = 0;
for (const path of cases) {
  const source = new Uint8Array(readFileSync(path));
  const hash = sha256(source);
  const started = performance.now();
  const rssBefore = process.memoryUsage().rss;
  const row: Record<string, unknown> = { file: path.split("/").at(-1), original: source.length };
  try {
    const candidate = await toolkit.compress(source);
    row.qpdf = candidate.length;
    row.qpdfMs = Math.round(performance.now() - started);
    row.qpdfRssDeltaMiB = Math.round((process.memoryUsage().rss - rssBefore) / 1048576);
    const [before, after] = await Promise.all([readback(source), readback(candidate)]);
    row.readback = JSON.stringify(before) === JSON.stringify(after) ? "PASS" : "MISMATCH";
    if (row.readback !== "PASS") regression++;
    if (candidate.length > source.length) row.growth = true;
  } catch (error) {
    row.qpdfError = error instanceof Error ? error.message.slice(0, 180) : String(error);
  }
  try {
    const legacy = await compression.run({ file: new Blob([source.slice().buffer]), profile: "structural-only" }, { defaults: {} }) as PdfCompressionOutput;
    row.legacy = legacy.artifacts[0]?.bytes.length;
  } catch (error) {
    row.legacyError = error instanceof Error ? error.message.slice(0, 120) : String(error);
  }
  row.sourceUnchanged = sha256(source) === hash;
  console.log(JSON.stringify(row));
}
console.log(JSON.stringify({ summary: "readback-mismatch-count", regression }));
if (regression > 0) process.exitCode = 2;

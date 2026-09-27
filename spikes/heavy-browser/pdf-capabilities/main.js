import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { assert, fail, finish, heapUsed, now } from "../shared/harness.js";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

async function makeFixture() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.setTitle("Synthetic StrumentiUtili.it Fixture");
  pdf.setAuthor("StrumentiUtili.it Lane 04");
  pdf.setSubject("Synthetic browser-local PDF spike");
  for (let index = 1; index <= 4; index += 1) {
    const page = pdf.addPage([420, 240]);
    page.drawText(`STRUMENTIUTILI-PAGE-${index}`, { x: 36, y: 150, size: 28, font });
    page.drawText(`synthetic fixture ${index}`, { x: 36, y: 110, size: 14, font });
  }
  return pdf.save();
}

async function extract(pdfBytes) {
  const task = getDocument({ data: pdfBytes });
  const doc = await task.promise;
  const texts = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    texts.push(content.items.map((item) => item.str ?? "").join(" "));
  }
  const metadata = await doc.getMetadata();
  return { doc, texts, metadata };
}

async function run() {
  const heapBefore = heapUsed();
  const t0 = now();
  const sourceBytes = await makeFixture();
  const fixtureMs = now() - t0;

  const mutationStart = now();
  const source = await PDFDocument.load(sourceBytes);
  const mutated = await PDFDocument.create();
  const order = [3, 1, 0, 2];
  const copied = await mutated.copyPages(source, order);
  copied.forEach((page, index) => {
    if (index === 0) page.setRotation(degrees(90));
    mutated.addPage(page);
  });
  mutated.setTitle("");
  mutated.setAuthor("");
  mutated.setSubject("");
  mutated.setKeywords([]);
  mutated.setProducer("");
  mutated.setCreator("");
  const reorderedBytes = await mutated.save();

  const splitA = await PDFDocument.create();
  (await splitA.copyPages(mutated, [0, 1])).forEach((page) => splitA.addPage(page));
  const splitB = await PDFDocument.create();
  (await splitB.copyPages(mutated, [2, 3])).forEach((page) => splitB.addPage(page));
  const splitABytes = await splitA.save();
  const splitBBytes = await splitB.save();

  const merged = await PDFDocument.create();
  const a = await PDFDocument.load(splitABytes);
  const b = await PDFDocument.load(splitBBytes);
  (await merged.copyPages(a, a.getPageIndices())).forEach((page) => merged.addPage(page));
  (await merged.copyPages(b, b.getPageIndices())).forEach((page) => merged.addPage(page));
  const mergedBytes = await merged.save();
  const mutationMs = now() - mutationStart;

  const inspectStart = now();
  const sourceView = await extract(sourceBytes.slice());
  const mergedView = await extract(mergedBytes.slice());
  const inspectMs = now() - inspectStart;

  assert(sourceView.doc.numPages === 4, "fixture has four pages");
  assert(mergedView.doc.numPages === 4, "split + merge preserves page count");
  assert(mergedView.texts[0].includes("STRUMENTIUTILI-PAGE-4"), "reorder puts page 4 first");
  assert(mergedView.texts[1].includes("STRUMENTIUTILI-PAGE-2"), "reorder puts page 2 second");
  assert(sourceView.metadata.info?.Title === "Synthetic StrumentiUtili.it Fixture", "metadata title is readable");

  const renderStart = now();
  const firstPage = await mergedView.doc.getPage(1);
  const viewport = firstPage.getViewport({ scale: 0.75 });
  const canvas = document.querySelector("#preview");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await firstPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  const renderMs = now() - renderStart;

  const heapAfter = heapUsed();
  finish({
    ok: true,
    capability: "pdf",
    libraries: { "pdf-lib": "1.17.1", "pdfjs-dist": "6.3.289" },
    bytes: { source: sourceBytes.byteLength, reordered: reorderedBytes.byteLength, splitA: splitABytes.byteLength, splitB: splitBBytes.byteLength, merged: mergedBytes.byteLength },
    timingsMs: { fixture: fixtureMs, mutationSplitMerge: mutationMs, extractionMetadata: inspectMs, renderFirstPage: renderMs },
    heap: { before: heapBefore, after: heapAfter, delta: heapBefore != null && heapAfter != null ? heapAfter - heapBefore : null },
    extracted: mergedView.texts,
    metadata: {
      sourceTitle: sourceView.metadata.info?.Title ?? null,
      sourceAuthor: sourceView.metadata.info?.Author ?? null,
      scrubbedTitle: mergedView.metadata.info?.Title ?? null,
      scrubbedAuthor: mergedView.metadata.info?.Author ?? null,
      note: "Targeted Info fields were blanked; this is not a proof of complete privacy metadata removal."
    },
    rotationDegrees: firstPage.rotate,
  });
}

run().catch(fail);

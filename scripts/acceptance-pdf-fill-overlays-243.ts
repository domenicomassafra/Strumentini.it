/**
 * Independent #243 real Chromium test, source PDF -> preview -> flattened PDF.
 * Run with a single prestarted local dev server:
 * PDF243_DEV_BASE=http://127.0.0.1:18543 npx tsx scripts/acceptance-pdf-fill-overlays-243.ts
 */
import { readFile } from "node:fs/promises";
import { chromium, type Page } from "@playwright/test";
import { PdfBuilder, createSimplePdf } from "../src/engines/pdf/writer";
import { pdfArray, pdfDict, pdfName, pdfNumber, pdfString } from "../src/engines/pdf/parser";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const base = process.env.PDF243_DEV_BASE ?? "http://127.0.0.1:18543";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function fixture(): Uint8Array {
  const builder = new PdfBuilder(), pages = builder.reserve();
  const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const stream = builder.putAuto({ kind: "stream", dictionary: pdfDict({}),
    bytes: new TextEncoder().encode("BT /F1 16 Tf 48 330 Td (SOURCE243) Tj ET\n") });
  const page = builder.reserve();
  const widget = builder.putAuto(pdfDict({
    Type: pdfName("Annot"), Subtype: pdfName("Widget"), FT: pdfName("Tx"),
    T: pdfString("Ragione"), Rect: pdfArray([pdfNumber(48), pdfNumber(220), pdfNumber(270), pdfNumber(260)]),
    P: page,
  }));
  builder.put(page, pdfDict({
    Type: pdfName("Page"), Parent: pages, MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(360), pdfNumber(400)]),
    Resources: pdfDict({ Font: pdfDict({ F1: font }) }), Contents: stream, Annots: pdfArray([widget]),
  }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const acro = builder.putAuto(pdfDict({ Fields: pdfArray([widget]) }));
  return builder.build(builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages, AcroForm: acro })), null);
}
async function download(page: Page): Promise<Uint8Array> {
  const event = page.waitForEvent("download", { timeout: 15000 });
  await page.getByRole("link", { name: "Scarica PDF appiattito" }).click();
  const received = await event;
  assert(received.suggestedFilename() === "pdf-overlay-flattened.pdf", "Wrong PDF filename");
  return new Uint8Array(await readFile(await received.path()));
}
async function independentPdfJs(bytes: Uint8Array, expectedText: string) {
  const task = getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    assert(pdf.numPages === 1, "Page count changed");
    const page = await pdf.getPage(1);
    const annotationCount = (await page.getAnnotations()).length;
    const items = (await page.getTextContent()).items.filter((item) => "str" in item);
    const texts = items.map((item) => "str" in item ? item.str : "").join(" ");
    assert(texts.includes("SOURCE243") && texts.includes(expectedText), `PDF.js missing flattened text: ${texts}`);
    assert(annotationCount === 0, `PDF.js still sees editable widgets: ${annotationCount}`);
    const opList = await page.getOperatorList();
    assert(opList.fnArray.length > 10, "No PDF page drawing operations");
    return { items: items.length, annotations: annotationCount, operations: opList.fnArray.length };
  } finally { await task.destroy(); }
}
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let report: Record<string, unknown> = { status: "FAIL", test: "pdf-fill-overlays-243" };
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const errors: string[] = [];
  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (!(request.url().startsWith(base) || request.url().startsWith("blob:") ||
        request.url().startsWith("data:")) || request.method() !== "GET") {
        errors.push(`Unexpected ${request.method()} ${request.url()}`);
      }
    });
    const response = await page.goto(`${base}/tools/pdf-fill-overlays/`, { waitUntil: "networkidle" });
    assert(response?.status() === 200, "Standalone route unavailable");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
      "390px horizontal overflow");
    assert((await page.locator("[data-243-disclosure]").innerText()).includes("sempre appiattita"),
      "No honest flattened-only disclosure");
    await page.getByLabel("Documento PDF").setInputFiles({
      name: "modulo243.pdf", mimeType: "application/pdf", buffer: Buffer.from(fixture()),
    });
    await page.locator("[data-243-source-preview]").waitFor({ timeout: 25000 });
    assert(await page.locator("[data-243-source-preview]").evaluate((img) =>
      (img as HTMLImageElement).naturalWidth > 0), "PDF.js source preview not decoded");
    await page.getByLabel("Operazione").selectOption("text-field");
    assert((await page.getByLabel("Campo testo").inputValue()) === "Ragione", "Real PDF /Tx widget not detected");
    await page.getByLabel("Testo da scrivere").fill("ACRO 001");
    await page.getByRole("button", { name: "Appiattisci e verifica PDF" }).click();
    await page.locator("[data-243-result]").waitFor({ timeout: 20000 });
    await page.locator("[data-243-output-preview]").waitFor({ timeout: 25000 });
    const formPdf = await download(page);
    const formReport = await independentPdfJs(formPdf, "ACRO 001");

    // Test keyboard coordinate edit AND touch-style pointer placement with a
    // separate source-only PDF, not a previously flattened form PDF.
    await page.getByLabel("Documento PDF").setInputFiles({
      name: "pagina243.pdf", mimeType: "application/pdf",
      buffer: Buffer.from(createSimplePdf(["SOURCE243"], { width: 360, height: 400 })),
    });
    await page.getByLabel("Operazione").selectOption("text");
    await page.getByLabel("Testo da scrivere").fill("OVR 002");
    await page.getByLabel("X dall'angolo alto sinistro (pt)").fill("75");
    await page.getByLabel("Y dall'alto (pt)").fill("95");
    assert((await page.getByLabel("Y dall'alto (pt)").inputValue()) === "95", "Numeric keyboard placement failed");
    const thumb = page.locator("[data-243-source-preview]");
    await thumb.waitFor({ timeout: 15000 });
    const bounds = await thumb.boundingBox();
    assert(bounds !== null, "Cannot tap source PDF preview");
    await page.mouse.click(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.35);
    assert(Number(await page.getByLabel("Y dall'alto (pt)").inputValue()) > 0, "Pointer placement not synchronized");
    await page.getByRole("button", { name: "Appiattisci e verifica PDF" }).click();
    await page.locator("[data-243-result]").waitFor({ timeout: 15000 });
    const overlay = await download(page);
    const overlayReport = await independentPdfJs(overlay, "OVR 002");

    await page.getByLabel("Operazione").selectOption("highlight");
    await page.getByLabel("X dall'angolo alto sinistro (pt)").fill("60");
    await page.getByLabel("Y dall'alto (pt)").fill("150");
    await page.getByLabel("Larghezza (pt)").fill("140");
    await page.getByLabel("Altezza (pt)").fill("30");
    await page.getByRole("button", { name: "Appiattisci e verifica PDF" }).click();
    const highlightPreview = page.locator("[data-243-output-preview]");
    await highlightPreview.waitFor({ timeout: 18000 });
    const highlighted = await highlightPreview.evaluate((element) => {
      const img = element as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Missing 2D canvas");
      context.drawImage(img, 0, 0);
      const sample = context.getImageData(Math.floor(canvas.width * 90 / 360),
        Math.floor(canvas.height * 165 / 400), 1, 1).data;
      return Array.from(sample.slice(0, 3));
    });
    assert(highlighted[0]! > 205 && highlighted[1]! > 165 && highlighted[2]! < 225,
      `Highlight PDF.js raster lacks visible yellow: ${highlighted.join(",")}`);
    const highlightedPdf = await download(page);
    const highlightedTask = getDocument({ data: Uint8Array.from(highlightedPdf) });
    try {
      const highlightedDocument = await highlightedTask.promise;
      assert((await (await highlightedDocument.getPage(1)).getAnnotations()).length === 0,
        "Highlight unexpectedly serialized as editable annotation");
    } finally { await highlightedTask.destroy(); }

    await page.getByLabel("Operazione").selectOption("text");
    // HTML single-line inputs normalize line breaks: exercise unsupported Unicode.
    await page.getByLabel("Testo da scrivere").fill("INJECT 🧪 FAIL");
    await page.getByRole("button", { name: "Appiattisci e verifica PDF" }).click();
    await page.getByRole("alert").waitFor({ timeout: 15000 });
    assert((await page.getByRole("alert").innerText()).includes("INVALID_TEXT"), "Unsupported glyph was accepted");
    assert(await page.locator("[data-243-result]").count() === 0, "Stale downloadable PDF after invalid operation");
    assert(errors.length === 0, `Browser errors/offsite: ${errors.join("; ")}`);
    report = { status: "PASS", viewport: "390x844", browser: "Chromium headless",
      supportedField: "AcroForm /Tx Ragione", formFlattenedPdfJs: formReport,
      overlayFlattenedPdfJs: overlayReport, keyboardAndPointerPlacement: true,
      outputPreviewDecoded: true, highlightRasterRGB: highlighted, highlightAnnotations: 0,
      unsupportedGlyphRejected: true, staleDownloadAbsent: true, offsiteRequests: 0 };
  } finally { await context.close(); }
} catch (error) {
  report = { ...report, error: error instanceof Error ? error.stack ?? error.message : String(error) };
  process.exitCode = 1;
} finally {
  await browser?.close();
  console.log(JSON.stringify(report, null, 2));
}

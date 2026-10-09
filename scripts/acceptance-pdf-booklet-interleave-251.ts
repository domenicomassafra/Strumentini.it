/**
 * Independent #251 browser acceptance on real downloaded PDFs and ALL pages:
 * run after existing `npx astro build` with
 * `npx tsx scripts/acceptance-pdf-booklet-interleave-251.ts`.
 *
 * Single localhost static server + single Chromium 390px instance.
 * The browser independently reopens and rasterizes every printed PDF page
 * using existing PDF-to-images; Sharp decodes PNGs and checks source colors
 * in imposition slots, true white blank padding, and flipped backs.
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import sharp from "sharp";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { extractPdfText, inspectPdfBytes } from "../src/engines/pdf";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_251_PORT ?? 18551);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"],
  { cwd: root, stdio: "ignore" });
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const colors: Readonly<Record<string, readonly [number, number, number]>> = {
  P1: [201, 34, 42], P2: [29, 155, 59], P3: [43, 84, 199], P4: [215, 161, 29], P5: [170, 56, 180],
  F1: [201, 34, 42], F2: [43, 84, 199], F3: [29, 155, 59],
  B1: [215, 161, 29], B2: [170, 56, 180],
};

function numberedPdf(labels: readonly string[]): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const children = labels.map((label) => {
    const color = colors[label]!;
    const [r, g, b] = color.map((n) => (n / 255).toFixed(5));
    const content = builder.putAuto({
      kind: "stream", dictionary: pdfDict({}),
      bytes: new TextEncoder().encode(`q ${r} ${g} ${b} rg 0 0 320 480 re f Q\nBT /F1 85 Tf 1 1 1 rg 62 224 Td (${label}) Tj ET\n`),
    });
    return builder.putAuto(pdfDict({
      Type: pdfName("Page"), Parent: pages, MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(320), pdfNumber(480)]),
      Resources: pdfDict({ Font: pdfDict({ F1: font }) }), Contents: content,
    }));
  });
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray(children), Count: pdfNumber(children.length) }));
  return builder.build(builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages })), null);
}
function upload(bytes: Uint8Array, name: string) {
  return { name, mimeType: "application/pdf", buffer: Buffer.from(bytes) };
}
async function ready() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${origin}/tools/pdf-booklet-interleave/`)).ok) return; } catch { /* startup */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Standalone #251 static route missing: build Astro first");
}
async function download(page: Page, label: string) {
  const event = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("link", { name: label }).click();
  const saved = await event;
  const bytes = new Uint8Array(await readFile(await saved.path()));
  assert(new TextDecoder("ascii").decode(bytes.subarray(0, 5)) === "%PDF-", "Output has no PDF signature");
  return bytes;
}
type Pixel = readonly [number, number, number];
function comparePixel(actual: Pixel, expected: Pixel, label: string) {
  const max = Math.max(...expected.map((n, index) => Math.abs(n - actual[index]!)));
  assert(max <= 26, `${label}: pixel ${actual.join(",")} != ${expected.join(",")}; maxDelta ${max}`);
}

async function allPagesAsPng(page: Page, input: Uint8Array, expectedPages: number) {
  await page.goto(`${origin}/tools/pdf-to-images/`, { waitUntil: "networkidle" });
  await page.locator('form input[type="file"]').first().setInputFiles(upload(input, "result-251.pdf"));
  await page.getByLabel("Pagine (facoltativo)").fill(`1-${expectedPages}`);
  await page.getByLabel("Formato uscita").selectOption("image/png");
  await page.getByLabel("Scala render").fill("1");
  await page.locator('form button[type="submit"]').first().click();
  await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 60000 });
  const event = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("link", { name: "Scarica pdf-pages.zip" }).click();
  const save = await event;
  const archive = unzipSync(new Uint8Array(await readFile(await save.path())));
  assert(Object.keys(archive).length === expectedPages, `Missing generated PNGs: ${Object.keys(archive).length}/${expectedPages}`);
  const output = [];
  for (let index = 1; index <= expectedPages; index++) {
    const key = `page-${String(index).padStart(3, "0")}.png`;
    const bytes = archive[key];
    assert(bytes !== undefined && bytes[0] === 137 && bytes[1] === 80, `Invalid raster page ${index}`);
    const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    output.push({ data, width: info.width, height: info.height, channels: info.channels });
  }
  return output;
}
function pixel(image: Awaited<ReturnType<typeof allPagesAsPng>>[number], x: number, y: number): Pixel {
  const cx = Math.floor(image.width * x);
  const cy = Math.floor(image.height * y);
  const index = (cy * image.width + cx) * image.channels;
  return [image.data[index]!, image.data[index + 1]!, image.data[index + 2]!];
}

const booklet = numberedPdf(["P1", "P2", "P3", "P4", "P5"]);
const front = numberedPdf(["F1", "F2", "F3"]);
const back = numberedPdf(["B1", "B2"]);
const tests: Array<{ mode: string; pages: number; verifiedSlots: number; blanks: number }> = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const browserErrors: string[] = [];
let failure: string | null = null;
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  try {
    const page = await context.newPage();
    page.on("pageerror", (err) => browserErrors.push(err.message));
    page.on("request", (request) => {
      if (request.method() !== "GET" || !(request.url().startsWith(origin) || request.url().startsWith("blob:") || request.url().startsWith("data:"))) {
        browserErrors.push(`${request.method()} ${request.url()}`);
      }
    });
    for (const flip of ["short-edge", "long-edge"] as const) {
      await page.goto(`${origin}/tools/pdf-booklet-interleave/`, { waitUntil: "networkidle" });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px overflow");
      assert((await page.locator("[data-251-fidelity]").innerText()).includes("rasterizzato"), "Raster quality disclosure missing");
      await page.getByLabel("Documento PDF da piegare").setInputFiles(upload(booklet, "five.pdf"));
      await page.locator("[data-251-plan]").waitFor();
      await page.getByLabel("Duplex: lato di ribaltamento").selectOption(flip);
      assert((await page.locator("[data-251-blank-count]").innerText()).includes("3 bianche"), "Missing explicit booklet blank padding");
      const mapping = [["blank", "1"], ["2", "blank"], ["blank", "3"], ["4", "5"]];
      for (let face = 1; face <= 4; face++) {
        assert(JSON.stringify(await page.locator("[data-251-face] [data-source-page]").evaluateAll((elements) =>
          elements.map((el) => el.getAttribute("data-source-page")))) === JSON.stringify(mapping[face - 1]),
          `${flip}: plan differs at face ${face}`);
        if (face < 4) await page.getByRole("button", { name: "Facciata successiva" }).click();
      }
      assert((await page.locator("[data-251-all-faces] li").count()) === 4, "Missing complete booklet order preview");
      await page.getByRole("button", { name: "Crea PDF e verifica" }).click();
      await page.locator("[data-251-result]").waitFor({ timeout: 60000 });
      await page.locator("[data-251-preview]").waitFor({ timeout: 25000 });
      const produced = await download(page, "Scarica PDF booklet");
      const report = inspectPdfBytes(produced);
      assert(report.pageCount === 4 && report.pages.every((p, index) =>
        Math.abs(p.width - 841.89) < 0.1 && Math.abs(p.height - 595.28) < 0.1 &&
        p.rotation === (flip === "long-edge" && index % 2 === 1 ? 180 : 0)), `${flip}: geometry/duplex rotation mismatch`);
      const images = await allPagesAsPng(page, produced, 4);
      let slots = 0;
      let blanks = 0;
      const colorsByPage = ["P1", "P2", "P3", "P4", "P5"] as const;
      for (let face = 0; face < 4; face++) {
        for (let slot = 0; slot < 2; slot++) {
          const number = mapping[face]![slot]!;
          const longBack = flip === "long-edge" && face % 2 === 1;
          const sampleX = longBack ? slot === 0 ? 0.75 : 0.25 : slot === 0 ? 0.25 : 0.75;
          const image = images[face]!;
          assert(image.width === 842 && image.height === 596, "Unexpected booklet PNG dimensions");
          const expected = number === "blank" ? [255, 255, 255] as const : colors[colorsByPage[Number(number) - 1]!]!;
          comparePixel(pixel(image, sampleX, 0.26), expected, `${flip} face ${face + 1} slot ${slot} source ${number}`);
          if (number === "blank") blanks++;
          slots++;
        }
      }
      tests.push({ mode: `booklet-${flip}`, pages: 4, verifiedSlots: slots, blanks });
    }

    await page.goto(`${origin}/tools/pdf-booklet-interleave/`, { waitUntil: "networkidle" });
    await page.getByLabel("Operazione").selectOption("interleave");
    await page.getByLabel("Scansione delle pagine fronte").setInputFiles(upload(front, "front.pdf"));
    await page.getByLabel("Scansione delle pagine retro").setInputFiles(upload(back, "back.pdf"));
    await page.getByRole("alert").waitFor({ timeout: 15000 });
    assert((await page.getByRole("alert").innerText()).includes("LENGTH_MISMATCH"), "Mismatch did not fail closed");
    assert(await page.locator("[data-251-result]").count() === 0, "Stale PDF visible on mismatch");
    await page.getByLabel("Se le due scansioni hanno lunghezze diverse").selectOption("pad-shorter");
    const rowMapping = [["front", "1"], ["back", "2"], ["front", "2"], ["back", "1"], ["front", "3"], ["back", "blank"]];
    assert(JSON.stringify(await page.locator("[data-251-all-pages] li").evaluateAll((nodes) => nodes.map((node) =>
      [node.getAttribute("data-source"), node.getAttribute("data-source-page")]))) === JSON.stringify(rowMapping),
      "Interleave preview order or explicit blank mismatch");
    await page.getByRole("button", { name: "Crea PDF e verifica" }).click();
    await page.locator("[data-251-result]").waitFor({ timeout: 20000 });
    const composed = await download(page, "Scarica PDF intercalato");
    const outputInfo = inspectPdfBytes(composed);
    assert(outputInfo.pageCount === 6, "Interleave output lost pages");
    const text = (await extractPdfText(composed)).map((p) => p.text.trim());
    assert(JSON.stringify(text) === JSON.stringify(["F1", "B2", "F2", "B1", "F3", ""]),
      `Interleave wrong source order/blank: ${JSON.stringify(text)}`);
    const images = await allPagesAsPng(page, composed, 6);
    const expected = ["F1", "B2", "F2", "B1", "F3", "blank"] as const;
    for (let index = 0; index < images.length; index++) {
      const want = expected[index] === "blank" ? [255, 255, 255] as const : colors[expected[index]!]!;
      comparePixel(pixel(images[index]!, 0.22, 0.23), want, `Interleave output page ${index + 1}`);
    }
    tests.push({ mode: "interleave-pad-shorter-reverse", pages: 6, verifiedSlots: 6, blanks: 1 });
    assert(browserErrors.length === 0, `Browser errors/offsite: ${browserErrors.join(" | ")}`);
  } finally { await context.close(); }
} catch (cause) {
  failure = cause instanceof Error ? cause.stack ?? cause.message : String(cause);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  console.log(JSON.stringify({
    test: "pdf-booklet-interleave-251-independent-browser", status: failure === null && tests.length === 3 ? "PASS" : "FAIL",
    viewport: "390x844", browser: "Chromium headless", renderer: "PDF.js every output page + PNG/Sharp independent color oracle",
    renderedPages: tests.reduce((total, row) => total + row.pages, 0), offsiteOrBrowserErrors: browserErrors,
    tests, ...(failure ? { failure } : {}),
  }, null, 2));
}

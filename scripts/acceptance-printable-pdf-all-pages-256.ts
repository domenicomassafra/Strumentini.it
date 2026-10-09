/**
 * Independent #256 AC2 acceptance: EVERY page, not only the download preview.
 *
 * Prerequisite: existing static dist from the integrated main build.
 * Run: npx tsx scripts/acceptance-printable-pdf-all-pages-256.ts
 * One local static server, one Chromium instance, no dev server or catalog writes.
 *
 * Oracle A: independently open downloaded PDF with PDF.js, inspect every
 * text glyph run's measured width/height, pairwise physical overlap, page
 * bounds, repeated CSV headers, expected source row markers and footer.
 * Oracle B: upload that SAME download into /tools/pdf-to-images, let browser
 * PDF.js rasterize ALL pages to PNG, download ZIP and independently decode
 * each PNG with sharp. Check per-page dimensions, nonblank ink and blank
 * outer margins; fail on missing/extra/duplicate/empty PNG pages.
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import sharp from "sharp";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

const project = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PRINTABLE_AC2_PORT ?? 18527);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("INVALID_PORT");
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: project, stdio: "ignore",
});

type Kind = "txt" | "csv";
interface Fixture {
  name: string;
  kind: Kind;
  source: string;
  ids: readonly string[];
  size: "a4" | "letter";
  orientation: "portrait" | "landscape";
  margin: number;
  font: number;
  columns: number;
}
type Box = { text: string; left: number; right: number; bottom: number; top: number };
type SemanticPage = { page: number; width: number; height: number; text: string; runs: number };

function assert(value: unknown, description: string): asserts value {
  if (!value) throw new Error(description);
}

const fixtures: Fixture[] = [
  {
    name: "txt-a4-portrait-winansi-unbroken-word-wrap",
    kind: "txt", size: "a4", orientation: "portrait", margin: 48, font: 10, columns: 1,
    ids: Array.from({ length: 100 }, (_, i) => `TX${i.toString().padStart(4, "0")}`),
    source: Array.from({ length: 100 }, (_, i) =>
      `TX${i.toString().padStart(4, "0")} Città caffè perché € “virgolette” ${"sezione ".repeat(9)} CHIUSA${i.toString().padStart(4, "0")}` +
      (i % 17 === 0 ? `\n${"1234567890".repeat(13)}\n\n` : "")).join("\n"),
  },
  {
    name: "csv-letter-landscape-multiline-cells-headers",
    kind: "csv", size: "letter", orientation: "landscape", margin: 36, font: 9, columns: 5,
    ids: Array.from({ length: 72 }, (_, i) => `CR${i.toString().padStart(4, "0")}`),
    source: [
      "IDENTIFICATORE,DATA,DESCRIZIONE,NOTE,STATO",
      ...Array.from({ length: 72 }, (_, i) =>
        `CR${i.toString().padStart(4, "0")},2026-10-09,"${"descrizione ".repeat(12)}","blocco ${i} e riga due\ncontinuazione cella ${i}",OK`),
    ].join("\n"),
  },
  {
    name: "csv-a4-portrait-small-font-page-boundaries",
    kind: "csv", size: "a4", orientation: "portrait", margin: 62, font: 8, columns: 3,
    ids: Array.from({ length: 65 }, (_, i) => `PR${i.toString().padStart(4, "0")}`),
    source: [
      "IDENTIFICATORE,COMMENTO,VALORE",
      ...Array.from({ length: 65 }, (_, i) => `PR${i.toString().padStart(4, "0")},"${"stampa ".repeat(24)}",${i}`),
    ].join("\n"),
  },
];

async function waitForStatic() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch(`${origin}/tools/printable-pdf-from-text/`);
      if (response.status === 200) return;
    } catch { /* startup */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("NO_STATIC_ROUTE: build dist on main first");
}

function fileUpload(bytes: Uint8Array) {
  return { name: "downloaded-printable-256.pdf", mimeType: "application/pdf", buffer: Buffer.from(bytes) };
}

async function downloadPdf(page: Page, fixture: Fixture): Promise<Uint8Array> {
  await page.getByLabel("Tipo del contenuto").selectOption(fixture.kind);
  await page.getByLabel("Formato pagina").selectOption(fixture.size);
  await page.getByLabel("Orientamento").selectOption(fixture.orientation);
  await page.getByLabel("Margini (punti)", { exact: true }).fill(String(fixture.margin));
  await page.getByLabel("Dimensione font").fill(String(fixture.font));
  await page.getByRole("textbox", { name: "Contenuto" }).fill(fixture.source);
  await page.getByRole("button", { name: "Genera e verifica PDF" }).click();
  const panel = page.locator('[data-printable-result="success"]');
  await panel.waitFor({ timeout: 60000 });
  assert(await panel.locator("img").first().evaluate((img) => (img as HTMLImageElement).naturalWidth > 0),
    `${fixture.name}: first-page PDF.js preview did not decode`);
  const pendingDownload = page.waitForEvent("download", { timeout: 20000 });
  await panel.getByRole("link", { name: "Scarica documento-stampabile.pdf" }).click();
  const downloaded = await pendingDownload;
  assert(downloaded.suggestedFilename() === "documento-stampabile.pdf", `${fixture.name}: filename changed`);
  const bytes = new Uint8Array(await readFile(await downloaded.path()));
  assert(Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-", `${fixture.name}: wrong PDF header`);
  return bytes;
}

function intersects(a: Box, b: Box): boolean {
  const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const overlapY = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
  return overlapX > 0.8 && overlapY > 0.8;
}

// Self-test the independent oracle with an intentionally bad intersecting pair.
assert(intersects({ text: "a", left: 48, right: 70, bottom: 70, top: 80 },
  { text: "b", left: 56, right: 77, bottom: 73, top: 84 }), "Overlap oracle broken: missed collision");
assert(!intersects({ text: "a", left: 48, right: 70, bottom: 70, top: 80 },
  { text: "b", left: 80, right: 95, bottom: 73, top: 84 }), "Overlap oracle broken: false positive");

async function inspectAllPdfText(bytes: Uint8Array, fixture: Fixture): Promise<SemanticPage[]> {
  // PDF.js is independent of the project's PDF serializer/parser.
  const task = getDocument({
    data: Uint8Array.from(bytes),
    standardFontDataUrl: resolve(project, "node_modules/pdfjs-dist/standard_fonts") + "/",
    useSystemFonts: true,
  });
  try {
    const pdf = await task.promise;
    assert(pdf.numPages >= 3 && pdf.numPages <= 80, `${fixture.name}: unexpected ${pdf.numPages} pages`);
    const all: SemanticPage[] = [];
    const combined: string[] = [];
    const expectedSize = fixture.size === "letter" ? [612, 792] : [595.28, 841.89];
    const [width, height] = fixture.orientation === "landscape" ?
      [expectedSize[1]!, expectedSize[0]!] : [expectedSize[0]!, expectedSize[1]!];
    let totalRuns = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      assert(Math.abs(viewport.width - width) < 0.2 && Math.abs(viewport.height - height) < 0.2,
        `${fixture.name}: page ${pageNumber} wrong MediaBox ${viewport.width}x${viewport.height}`);
      const textContent = await page.getTextContent();
      const items = textContent.items.filter((item): item is TextItem => "str" in item && item.str.length > 0);
      const text = items.map((item) => item.str).join(" ");
      assert(items.length > 3, `${fixture.name}: page ${pageNumber} empty/unrenderable text`);
      assert(new RegExp(`(?:^|\\s)${pageNumber}\\s*\\/\\s*${pdf.numPages}(?:\\s|$)`, "u").test(text),
        `${fixture.name}: missing/wrong page number on page ${pageNumber}; PDF.js extracted tail: ${text.slice(-240)}`);
      if (fixture.kind === "csv") assert(text.includes("IDENTIFICATORE"), `${fixture.name}: CSV header missing on page ${pageNumber}`);
      const body: Box[] = [];
      for (const item of items) {
        const [a, b, c, d, x, baseline] = item.transform;
        assert([a, b, c, d, x, baseline, item.width, item.height].every((num) => typeof num === "number" && Number.isFinite(num)),
          `${fixture.name}: page ${pageNumber} nonfinite glyph transform`);
        assert(Math.abs(b!) < 0.1 && Math.abs(c!) < 0.1 && a! > 0 && d! > 0,
          `${fixture.name}: page ${pageNumber} unexpected rotated/mirrored text`);
        // PDF.js may split the same Courier page-number operator into separate
        // text runs at smaller font sizes: identify the footer by its reserved
        // baseline region, not by tokenization of the extracted string.
        const isFooter = baseline! < fixture.margin;
        const box = { text: item.str, left: x!, right: x! + item.width, bottom: baseline!, top: baseline! + item.height };
        if (isFooter) {
          assert(box.bottom > 0 && box.top < fixture.margin,
            `${fixture.name}: page ${pageNumber} footer overlaps printable content`);
          continue;
        }
        const slack = 0.85;
        assert(box.left >= fixture.margin - slack && box.right <= width! - fixture.margin + slack,
          `${fixture.name}: page ${pageNumber} text outside horizontal margins: "${item.str.slice(0, 45)}" ${box.left.toFixed(1)}..${box.right.toFixed(1)} allowed ${fixture.margin}..${width! - fixture.margin}`);
        assert(box.bottom >= fixture.margin + 17 - slack && box.top <= height! - fixture.margin + slack,
          `${fixture.name}: page ${pageNumber} text outside vertical content: "${item.str.slice(0, 45)}" ${box.bottom.toFixed(1)}..${box.top.toFixed(1)}`);
        for (const previous of body) {
          assert(!intersects(previous, box),
            `${fixture.name}: page ${pageNumber} text runs overlap: "${previous.text.slice(0, 35)}" and "${box.text.slice(0, 35)}"`);
        }
        body.push(box);
      }
      assert(body.length > 2, `${fixture.name}: page ${pageNumber} has no body rows`);
      totalRuns += body.length;
      all.push({ page: pageNumber, width: viewport.width, height: viewport.height, text, runs: body.length });
      combined.push(text);
      page.cleanup();
    }
    const allText = combined.join(" ");
    for (const id of fixture.ids) {
      const hits = allText.match(new RegExp(`\\b${id}\\b`, "gu"))?.length ?? 0;
      assert(hits === 1, `${fixture.name}: ${id} expected once in PDF; actual ${hits}`);
    }
    assert(totalRuns >= fixture.ids.length, `${fixture.name}: insufficient measured text runs`);
    return all;
  } finally {
    await task.destroy();
  }
}

async function renderAndInspectEveryPng(page: Page, bytes: Uint8Array, semantic: readonly SemanticPage[], fixture: Fixture) {
  await page.goto(`${origin}/tools/pdf-to-images/`, { waitUntil: "networkidle" });
  await page.locator('form input[type="file"]').first().setInputFiles(fileUpload(bytes));
  await page.getByLabel("Pagine (facoltativo)").fill(`1-${semantic.length}`);
  await page.getByLabel("Formato uscita").selectOption("image/png");
  await page.getByLabel("Scala render").fill("1");
  await page.locator('form button[type="submit"]').first().click();
  const result = page.locator(".result-panel[data-state='success']");
  await result.waitFor({ timeout: 120000 });
  const event = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("link", { name: "Scarica pdf-pages.zip" }).click();
  const downloaded = await event;
  assert(downloaded.suggestedFilename() === "pdf-pages.zip", `${fixture.name}: ZIP download filename changed`);
  const archive = unzipSync(new Uint8Array(await readFile(await downloaded.path())));
  const names = Object.keys(archive);
  assert(names.length === semantic.length,
    `${fixture.name}: PDF.js rendered only ${names.length}/${semantic.length} pages`);
  let nonWhiteTotal = 0;
  let checkedPixels = 0;
  for (const info of semantic) {
    const expected = `page-${String(info.page).padStart(3, "0")}.png`;
    const png = archive[expected];
    assert(png !== undefined, `${fixture.name}: missing page ${info.page} PNG in browser ZIP`);
    assert(Buffer.from(png.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      `${fixture.name}: page ${info.page} is not a valid PNG`);
    const decoded = await sharp(Buffer.from(png)).raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = decoded.info;
    assert(Math.abs(width - info.width) <= 1 && Math.abs(height - info.height) <= 1,
      `${fixture.name}: page ${info.page} raster geometry mismatched PDF MediaBox`);
    // Rendered PDF's outer 12px band must be pure paper, never clipped glyphs.
    let ink = 0;
    let clipped = 0;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * channels;
      if (decoded.data[at]! < 210 || decoded.data[at + 1]! < 210 || decoded.data[at + 2]! < 210) {
        ink += 1;
        if (x < 12 || x >= width - 12 || y < 12 || y >= height - 8) clipped += 1;
      }
    }
    assert(ink > 100, `${fixture.name}: page ${info.page} blank PDF.js raster`);
    assert(clipped === 0, `${fixture.name}: page ${info.page} has ${clipped} ink pixels touching outer page margins`);
    nonWhiteTotal += ink;
    checkedPixels += width * height;
  }
  assert(nonWhiteTotal > 150 * semantic.length, `${fixture.name}: insufficient printed pixels`);
  return { pages: names.length, pixels: checkedPixels, inkPixels: nonWhiteTotal, clippedPixels: 0 };
}

let browser: Browser | undefined;
const checks: Array<{ fixture: string; pages: number; textRuns: number; rasterPixels: number; inkPixels: number; clipped: number }> = [];
const requests: string[] = [];
let error: string | undefined;
try {
  await waitForStatic();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  try {
    const page = await context.newPage();
    page.on("pageerror", (err) => requests.push(`PAGE_ERROR: ${err.message}`));
    page.on("request", (request) => {
      if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) {
        requests.push(`OFFSITE: ${request.url()}`);
      }
      if (request.method() !== "GET") requests.push(`HTTP_METHOD: ${request.method()}`);
    });
    for (const fixture of fixtures) {
      await page.goto(`${origin}/tools/printable-pdf-from-text/`, { waitUntil: "networkidle" });
      const bytes = await downloadPdf(page, fixture);
      const semantic = await inspectAllPdfText(bytes, fixture);
      const raster = await renderAndInspectEveryPng(page, bytes, semantic, fixture);
      checks.push({ fixture: fixture.name, pages: semantic.length,
        textRuns: semantic.reduce((sum, item) => sum + item.runs, 0),
        rasterPixels: raster.pixels, inkPixels: raster.inkPixels, clipped: raster.clippedPixels });
    }
    assert(requests.length === 0, `Offsite/unexpected browser requests: ${requests.join(" | ")}`);
  } finally {
    await context.close();
  }
} catch (caught) {
  error = caught instanceof Error ? caught.stack ?? caught.message : String(caught);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  console.log(JSON.stringify({
    test: "printable-pdf-256-all-pages-independent",
    status: error === undefined && checks.length === fixtures.length ? "PASS" : "FAIL",
    browser: "chromium-headless-390px",
    renderer: "PDF.js browser every-page PDF-to-images ZIP",
    semanticOracle: "independent PDF.js text run geometry + complete source marker census",
    renderedTotalPages: checks.reduce((sum, item) => sum + item.pages, 0),
    checkedTextRuns: checks.reduce((sum, item) => sum + item.textRuns, 0),
    offsiteRequests: requests.length,
    cases: checks,
    ...error === undefined ? {} : { error },
  }, null, 2));
}

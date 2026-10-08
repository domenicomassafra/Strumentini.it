import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parsePdf, pdfArray, pdfDict, pdfName, pdfNumber, pdfReference } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { planPdfNUp, verifyPdfNUp } from "../src/engines/pdf/n-up";

const root = resolve(import.meta.dirname, "..");
const port = 18650;
const origin = `http://127.0.0.1:${port}`;
const fixtureColors: number[][] = [
  [204, 25, 25], [25, 135, 35], [40, 65, 205], [225, 175, 20], [170, 35, 175],
];

function numberedPdf(): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const refs = fixtureColors.map((color, index) => {
    const [r, g, b] = color.map((component) => (component / 255).toFixed(6));
    const stream = `q ${r} ${g} ${b} rg 0 0 320 480 re f Q\nBT /F1 110 Tf 1 1 1 rg 36 220 Td (${index + 1}) Tj ET\n`;
    const content = builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(stream) });
    return builder.putAuto(pdfDict({
      Type: pdfName("Page"), Parent: pages,
      MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(320), pdfNumber(480)]),
      Resources: pdfDict({ Font: pdfDict({ F1: font }) }), Contents: content,
    }));
  });
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray(refs), Count: pdfNumber(refs.length) }));
  return builder.build(builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages })), null);
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}
const fixture = numberedPdf();
const source = parsePdf(fixture);
assert(source.pages.length === 5, "Numerated PDF fixture generation failed");
const dependencyDir = await realpath(resolve(root, "node_modules"));
const temporaryConfig = resolve(root, ".scratch", `pdf-250-${process.pid}.config.mjs`);
await writeFile(temporaryConfig, `import base from "../astro.config.mjs";\nexport default { ...base, vite: { ...base.vite, server: { fs: { allow: [${JSON.stringify(root)}, ${JSON.stringify(dependencyDir)}] } } } };\n`);
const server = spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port), "--config", `.scratch/pdf-250-${process.pid}.config.mjs`], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { serverOutput = (serverOutput + String(chunk)).slice(-5000); });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let ready = false;
  for (let i = 0; i < 125; i++) {
    try { if ((await fetch(`${origin}/tools/pdf-n-up/`)).ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise((done) => setTimeout(done, 120));
  }
  assert(ready, `Local n-up route not running: ${serverOutput}`);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.method() !== "GET" || (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:"))) errors.push(`Network ${request.method()} ${request.url()}`);
    });
    const response = await page.goto(`${origin}/tools/pdf-n-up/`, { waitUntil: "networkidle" });
    assert(response?.status() === 200, "n-up route does not return HTTP200");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), "390px horizontal overflow");
    assert((await page.locator("[data-nup-fidelity]").innerText()).includes("rasterizzato"), "Lossy warning absent");
    await page.locator('input[type="file"]').setInputFiles({ name: "cinque-pagine-numerate.pdf", mimeType: "application/pdf", buffer: Buffer.from(fixture) });
    await page.locator('[data-nup-preview]').waitFor({ timeout: 20000 });
    await page.getByLabel("Impaginazione").selectOption("4-up");
    await page.getByLabel("Orientamento foglio").selectOption("landscape");
    const preview = page.locator("[data-nup-preview]");
    assert((await preview.getByRole("status").innerText()).includes("3 celle vuote"), "Blank padding summary absent");
    assert(JSON.stringify(await page.locator("[data-nup-slot]").evaluateAll((els) => els.map((el) => el.getAttribute("data-source-page")))) === JSON.stringify(["1", "2", "3", "4"]), "First sheet mapping mismatch");
    await page.getByRole("button", { name: "Foglio successivo" }).click();
    assert(JSON.stringify(await page.locator("[data-nup-slot]").evaluateAll((els) => els.map((el) => el.getAttribute("data-source-page")))) === JSON.stringify(["5", "blank", "blank", "blank"]), "Last sheet padding mapping mismatch");
    await page.getByRole("button", { name: "Crea PDF n-up" }).click();
    await page.locator("[data-nup-result]").waitFor({ timeout: 30000 });
    await page.locator("[data-nup-result-preview]").waitFor({ timeout: 20000 });
    const event = page.waitForEvent("download");
    await page.getByRole("link", { name: "Scarica PDF n-up" }).click();
    const download = await event;
    const output = new Uint8Array(await readFile(await download.path()));
    const plan = planPdfNUp(5, { mode: "4-up", paper: "a4", orientation: "landscape", margin: 18, gap: 12, order: "row-major" });
    verifyPdfNUp(output, plan);
    assert(parsePdf(output).pages.length === 2, "Expected exactly two imposed sheets");
    const raster = await page.evaluate(async ({ bytes, geometry, colors }) => {
      const { openPdfThumbnailSession } = await import("/src/engines/pdf/thumbnails.ts");
      const session = await openPdfThumbnailSession(new File([Uint8Array.from(bytes)], "nup-output.pdf", { type: "application/pdf" }));
      try {
        const readings = [];
        for (let sheetNumber = 1; sheetNumber <= session.pageCount; sheetNumber++) {
          const png = await session.renderPage(sheetNumber);
          const bitmap = await createImageBitmap(png);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(bitmap, 0, 0);
          const sheet = geometry[sheetNumber - 1];
          readings.push(sheet.cells.map((cell) => {
            const cx = Math.max(0, Math.min(canvas.width - 1, Math.floor((cell.x + cell.width * 0.88) / sheet.width * canvas.width)));
            const cy = Math.max(0, Math.min(canvas.height - 1, Math.floor((sheet.height - cell.y - cell.height * 0.16) / sheet.height * canvas.height)));
            return { expectedPage: cell.sourcePage, pixel: Array.from(ctx.getImageData(cx, cy, 1, 1).data).slice(0, 3) };
          }));
          bitmap.close();
          canvas.width = 0;
          canvas.height = 0;
        }
        return { readings, colors };
      } finally { await session.close(); }
    }, { bytes: Array.from(output), colors: fixtureColors, geometry: plan.sheets.map((sheet) => ({ width: plan.sheetWidth, height: plan.sheetHeight, cells: sheet.cells })) });
    for (const cells of raster.readings) {
      for (const cell of cells) {
        const wanted = cell.expectedPage === null ? [255, 255, 255] : fixtureColors[cell.expectedPage - 1]!;
        const difference = Math.max(...wanted.map((value, index) => Math.abs(value - cell.pixel[index])));
        assert(difference <= 22, `Page order, rendered color or blank padding differ: ${JSON.stringify({ cell, wanted, difference })}`);
      }
    }
    assert(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
    console.log(JSON.stringify({ status: "PASS", fixture: "5 numbered colored source PDF pages", viewport: "390x844",
      sourcePages: 5, outputSheets: plan.sheetCount, padding: plan.blankSlots, renderedCellColors: raster.readings,
      mediaBox: [plan.sheetWidth, plan.sheetHeight], outputBytes: output.length, noExternalRequests: true }));
  } finally { await context.close(); }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await unlink(temporaryConfig);
}

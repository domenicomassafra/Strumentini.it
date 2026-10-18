import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getDocument } from "pdfjs-dist";

const root = resolve(import.meta.dirname, "..");
const port = 18191;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser;

async function exportPdf(page, expectedPages) {
  await page.getByRole("button", { name: "Crea PDF", exact: true }).click();
  const link = page.getByRole("link", { name: /Scarica .*\.pdf/u }).first();
  await link.waitFor({ state: "visible", timeout: 60_000 });
  const downloadPromise = page.waitForEvent("download");
  await link.click();
  const download = await downloadPromise;
  const bytes = await readFile(await download.path());
  if (!download.suggestedFilename().endsWith(".pdf") || bytes.subarray(0, 5).toString() !== "%PDF-") {
    throw new Error("The downloaded artifact is not a PDF");
  }
  const task = getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages !== expectedPages) throw new Error(`Expected ${expectedPages} pages, got ${pdf.numPages}`);
    const first = await pdf.getPage(1);
    const { width, height } = first.getViewport({ scale: 1 });
    if (Math.abs(width - 841.89) > 0.2 || Math.abs(height - 595.28) > 0.2) {
      throw new Error(`Expected A4 landscape, got ${width} × ${height}`);
    }
  } finally {
    await task.destroy();
  }
  return bytes.length;
}

try {
  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  if (!ready) throw new Error("Local static preview did not start");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${origin}/tools/images-to-pdf/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`Tool route returned ${response?.status()}`);
  const fixtureDir = resolve(root, "quality/fixtures/image-format-matrix");
  await page.locator('input[type="file"]').setInputFiles([resolve(fixtureDir, "source.png"), resolve(fixtureDir, "source.jpg")]);
  await page.locator("[data-images-pdf-preview]").waitFor({ state: "visible" });
  await page.getByLabel("Ordine immagini (facoltativo)").fill("2, 1");
  await page.getByLabel("Formato pagina").selectOption("a4");
  await page.getByLabel("Orientamento").selectOption("landscape");
  await page.getByLabel("Margine (mm)").fill("12");
  const pagesBytes = await exportPdf(page, 2);
  await page.getByLabel("Composizione").selectOption("contact-sheet");
  await page.getByLabel("Colonne contact sheet").fill("2");
  const sheetBytes = await exportPdf(page, 1);
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error("390px horizontal overflow");
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  console.log(`STR-235 PASS: 2 images reordered (2,1), A4 landscape, 2-page PDF downloaded/reopened (${pagesBytes} bytes); 2-column contact sheet 1-page PDF downloaded/reopened (${sheetBytes} bytes); viewport 390px`);
  await context.close();
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

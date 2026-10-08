/**
 * #256 bounded local route acceptance, no Gold/physical-device claim.
 * Run after `npx astro build`: `npx tsx scripts/acceptance-printable-pdf-256.ts`.
 * Uses Chromium at 390px, downloaded actual PDF and visible PDF.js PNG preview.
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { extractPdfText, inspectPdfBytes } from "../src/engines/pdf";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PRINTABLE_PDF_PORT ?? 18526);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"],
  { cwd: root, stdio: "ignore" });
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(`${origin}/tools/printable-pdf-from-text/`)).ok) return; } catch { /* startup */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Static preview route unavailable");
}

async function generate(page: Page, source: string, kind: string) {
  await page.getByLabel("Tipo del contenuto").selectOption(kind);
  await page.getByRole("textbox", { name: "Contenuto" }).fill(source);
  await page.getByRole("button", { name: "Genera e verifica PDF" }).click();
  const result = page.locator('[data-printable-result="success"]');
  await result.waitFor({ timeout: 35_000 });
  const preview = result.locator('img[alt="Prima pagina del PDF renderizzata localmente"]');
  await preview.waitFor({ state: "visible" });
  const visual = await preview.evaluate((node) => {
    const image = node as HTMLImageElement;
    return { width: image.naturalWidth, height: image.naturalHeight, complete: image.complete };
  });
  assert(visual.complete && visual.width > 500 && visual.height > 600, "PDF.js PNG preview was not visibly decoded");
  const event = page.waitForEvent("download", { timeout: 15_000 });
  await result.getByRole("link", { name: "Scarica documento-stampabile.pdf" }).click();
  const file = await event;
  assert(file.suggestedFilename() === "documento-stampabile.pdf", "Incorrect PDF download filename");
  const bytes = new Uint8Array(await readFile(await file.path()));
  assert(bytes.slice(0, 5).every((byte, index) => byte === [37, 80, 68, 70, 45][index]), "Not a PDF signature");
  return { bytes, visual };
}

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let report: Record<string, unknown> = { status: "FAIL", test: "printable-pdf-256-browser", physicalMobile: false };
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (!(request.url().startsWith(origin) || request.url().startsWith("blob:") || request.url().startsWith("data:"))) {
        errors.push(`Offsite: ${request.url()}`);
      }
      if (request.method() !== "GET") errors.push(`Unsafe HTTP ${request.method()} ${request.url()}`);
    });
    const response = await page.goto(`${origin}/tools/printable-pdf-from-text/`, { waitUntil: "networkidle" });
    assert(response?.status() === 200, "Printable PDF route missing");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px horizontal overflow");
    const txt = Array.from({ length: 120 }, (_, i) => `Stampa-${String(i).padStart(3, "0")} ${"colonna ".repeat(14)} fine-${i}`).join("\n");
    const txtOutput = await generate(page, txt, "txt");
    const txtReport = inspectPdfBytes(txtOutput.bytes);
    assert(txtReport.pageCount > 2, "Long TXT did not paginate");
    const allTxt = (await extractPdfText(txtOutput.bytes)).map((entry) => entry.text).join("\n");
    assert(allTxt.includes("Stampa-000") && allTxt.includes("fine-119"), "TXT source lost first or last record");
    const html = `<h1>Locale</h1><script>window.PDF256_SNEAKY="bad"</script><img src="https://example.com/offsite.png" alt="Senza rete"><p>Città sicura</p>`;
    const htmlOutput = await generate(page, html, "html");
    const htmlText = (await extractPdfText(htmlOutput.bytes)).map((entry) => entry.text).join("\n");
    assert(htmlText.includes("Locale") && htmlText.includes("Città sicura"), "HTML parser lost content");
    assert(!htmlText.includes("PDF256_SNEAKY"), "HTML scripts were printed");
    assert(await page.evaluate(() => (window as typeof window & { PDF256_SNEAKY?: string }).PDF256_SNEAKY === undefined),
      "HTML source script was executed");
    const csv = ["Titolo,Valore,Note", ...Array.from({ length: 125 }, (_, i) =>
      `ID${i},${i},"cella con testo lungo ${"ripetuto ".repeat(18)}"`), "ULTIMA,999,conclusione"].join("\n");
    const csvOutput = await generate(page, csv, "csv");
    const csvInfo = inspectPdfBytes(csvOutput.bytes);
    assert(csvInfo.pageCount > 2, "CSV table did not paginate");
    const csvPages = await extractPdfText(csvOutput.bytes);
    assert(csvPages.every((entry) => entry.text.includes("Titolo")), "CSV heading not repeated on every page");
    assert(csvPages.some((entry) => entry.text.includes("ULTIMA")), "CSV final record lost");
    await page.getByRole("textbox", { name: "Contenuto" }).fill("Emoji 🧪");
    await page.getByRole("button", { name: "Genera e verifica PDF" }).click();
    await page.getByRole("alert").waitFor({ timeout: 15000 });
    assert((await page.getByRole("alert").innerText()).includes("UNSUPPORTED_UNICODE"), "Unicode rejection not visible");
    assert(await page.locator('[data-printable-result="success"]').count() === 0, "Stale downloadable PDF after failure");
    assert(errors.length === 0, `Browser errors/offsite requests: ${errors.join(" | ")}`);
    report = { status: "PASS", test: "printable-pdf-256-browser", browser: "chromium-desktop-headless",
      viewport: [390, 844], txtPages: txtReport.pageCount, csvPages: csvInfo.pageCount,
      htmlPages: inspectPdfBytes(htmlOutput.bytes).pageCount, txtPreview: txtOutput.visual,
      htmlPreview: htmlOutput.visual, csvPreview: csvOutput.visual,
      unicodeFailsClosed: true, scriptsNotExecuted: true, offsiteRequests: 0,
      physicalMobile: false };
  } finally {
    await context.close();
  }
} catch (error) {
  report = { ...report, error: error instanceof Error ? error.stack ?? error.message : String(error) };
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  console.log(JSON.stringify(report, null, 2));
}

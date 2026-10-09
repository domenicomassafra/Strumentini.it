/**
 * Ticket #254 independent browser proof.
 * npx astro build && npx tsx scripts/acceptance-pdf-table-xlsx-254.ts
 * Single static localhost server + one Chromium instance, no dev server.
 *
 * The browser must expose a 3x3 selected grid BEFORE export, then download a
 * real XLSX. An independent XLSX reader reopens its exact source text cells
 * and SHA256/page/region/file provenance. Unruled PDFs fail closed.
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import readXlsxFile from "read-excel-file/universal";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_254_PORT ?? 18554);
// A caller-provided single development server avoids writing to the shared
// generated catalog when this worktree's main hasn't synchronized registry.
const base = process.env.PDF254_DEV_BASE ?? `http://127.0.0.1:${port}`;
const server = process.env.PDF254_DEV_BASE ? null : spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root, stdio: "ignore",
});
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const rows = [
  ["Codice", "Valore", "Note"],
  ["000123", "=2+2", "testo letterale"],
  ["008", "+FORMULA", "fine"],
] as const;
function fixture(withRules: boolean): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const commands: string[] = ["q 1 w"];
  if (withRules) {
    for (const x of [30, 120, 210, 330]) commands.push(`${x} 100 m ${x} 280 l S`);
    for (const y of [100, 160, 220, 280]) commands.push(`30 ${y} m 330 ${y} l S`);
  }
  rows.forEach((row, r) => row.forEach((cell, c) => {
    commands.push(`BT /F1 9 Tf ${42 + c * 90} ${246 - r * 60} Td (${cell}) Tj ET`);
  }));
  commands.push("Q");
  const content = builder.putAuto({ kind: "stream", dictionary: pdfDict({}),
    bytes: new TextEncoder().encode(commands.join("\n") + "\n") });
  const page = builder.putAuto(pdfDict({
    Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(360), pdfNumber(400)]),
    Resources: pdfDict({ Font: pdfDict({ F1: font }) }), Contents: content,
  }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Count: pdfNumber(1), Kids: pdfArray([page]) }));
  return builder.build(builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages })), null);
}
async function waitForStatic() {
  for (let attempt = 0; attempt < 90; attempt++) {
    try { if ((await fetch(`${base}/tools/pdf-tables-to-xlsx/`)).ok) return; } catch { /* booting */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("No built #254 route found; use npx astro build first");
}
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const errors: string[] = [];
let report: Record<string, unknown> = { status: "FAIL", test: "pdf-table-xlsx-254-browser" };
try {
  await waitForStatic();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.method() !== "GET" || !(request.url().startsWith(base) || request.url().startsWith("blob:") || request.url().startsWith("data:"))) {
        errors.push(`OFFSITE/WRITE ${request.method()} ${request.url()}`);
      }
    });
    const response = await page.goto(`${base}/tools/pdf-tables-to-xlsx/`, { waitUntil: "networkidle" });
    assert(response?.status() === 200, "PDF table route not served");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px horizontal overflow");
    const validBytes = fixture(true);
    await page.getByLabel("Documento PDF").setInputFiles({
      name: "origine-000123.pdf", mimeType: "application/pdf", buffer: Buffer.from(validBytes),
    });
    await page.locator("[data-pdf-table-thumbnail]").waitFor({ timeout: 25000 });
    assert(await page.locator("[data-pdf-table-thumbnail]").evaluate((img) => (img as HTMLImageElement).naturalWidth > 0),
      "PDF.js source-page thumbnail failed");
    assert(await page.locator("[data-pdf-table-selection]").isVisible(), "Region selection not visible");
    await page.getByRole("button", { name: "Estrai e mostra griglia" }).click();
    const preview = page.locator("[data-pdf-table-preview]");
    await preview.waitFor({ timeout: 25000 });
    const visibleCells = await preview.locator("table tr").evaluateAll((trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll("td"), (cell) => cell.textContent?.trim() ?? "")));
    assert(JSON.stringify(visibleCells) === JSON.stringify(rows), `Grid preview wrong: ${JSON.stringify(visibleCells)}`);
    const provenance = await page.locator("[data-pdf-table-provenance]").innerText();
    assert(provenance.includes("origine-000123.pdf") && provenance.includes("pagina 1") &&
      provenance.includes("x=0, y=0, larghezza=360, altezza=400"), `Missing page/region provenance: ${provenance}`);
    assert((provenance.match(/[a-f0-9]{64}/u) ?? []).length === 1, "Missing SHA256 provenance in visible preview");
    assert(await page.locator("[data-pdf-table-result]").count() === 0, "Download before export is not allowed");
    await page.getByRole("button", { name: "Verifica e genera XLSX" }).click();
    const result = page.locator("[data-pdf-table-result]");
    await result.waitFor({ timeout: 30000 });
    const downloading = page.waitForEvent("download", { timeout: 20000 });
    await result.getByRole("link", { name: "Scarica XLSX verificato" }).click();
    const saved = await downloading;
    assert(saved.suggestedFilename() === "tabella-pdf-verificata.xlsx", "Wrong XLSX filename");
    const workbook = new Uint8Array(await readFile(await saved.path()));
    assert(workbook[0] === 0x50 && workbook[1] === 0x4b, "Downloaded output not an OOXML ZIP");
    const sheets = await readXlsxFile(workbook.buffer.slice(workbook.byteOffset, workbook.byteOffset + workbook.byteLength));
    assert(sheets.length === 1 && sheets[0]?.sheet === "P01_Griglia", "Unexpected workbook sheets");
    const decoded = sheets[0]!.data;
    assert(decoded.length === 9, `Provenance and data row count incorrect: ${decoded.length}`);
    assert(decoded[0]?.[1] === "origine-000123.pdf" && decoded[2]?.[1] === "1" &&
      decoded[3]?.[1] === "x=0;y=0;w=360;h=400", "Source metadata missing from XLSX sheet");
    const owned = new Uint8Array(new ArrayBuffer(validBytes.byteLength));
    owned.set(validBytes);
    const sourceHash = await crypto.subtle.digest("SHA-256", owned);
    const sha = Array.from(new Uint8Array(sourceHash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    assert(decoded[1]?.[1] === sha, "Source sha256 does not match uploaded PDF");
    const exportedGrid = decoded.slice(6).map((row) => row.map((value) => value ?? ""));
    assert(JSON.stringify(exportedGrid) === JSON.stringify(rows), `Downloaded XLSX source parity wrong: ${JSON.stringify(exportedGrid)}`);
    assert(decoded[7]?.[0] === "000123" && decoded[7]?.[1] === "=2+2" && decoded[8]?.[0] === "008",
      "Leading zeros/formula escaping lost");

    // Once a source changes, stale preview/download must vanish and no fake
    // success is permitted for an unruled aligned-text document.
    await page.getByLabel("Documento PDF").setInputFiles({
      name: "senza-griglia.pdf", mimeType: "application/pdf", buffer: Buffer.from(fixture(false)),
    });
    await page.getByRole("button", { name: "Estrai e mostra griglia" }).click();
    await page.getByRole("alert").waitFor({ timeout: 25000 });
    assert((await page.getByRole("alert").innerText()).includes("NOT_A_RULED_TABLE"), "Unruled PDF accepted incorrectly");
    assert(await page.locator("[data-pdf-table-result]").count() === 0, "Stale XLSX link after invalid PDF");
    assert(errors.length === 0, `Page errors/offsite requests: ${errors.join("; ")}`);
    report = {
      status: "PASS", browser: "Chromium headless", viewport: "390x844",
      pdfSourcePreview: true, extractedGrid: "3x3", previewBeforeExport: true,
      downloadedXlsxBytes: workbook.length, workbookReopenedBy: "read-excel-file/universal",
      originalPdfSha256Parity: true, leadingZerosAndFormulaText: true,
      unruledRejected: true, staleDownloadAbsent: true, offsiteRequests: 0,
    };
  } finally { await context.close(); }
} catch (error) {
  report = { ...report, error: error instanceof Error ? error.stack ?? error.message : String(error) };
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
  console.log(JSON.stringify(report, null, 2));
}

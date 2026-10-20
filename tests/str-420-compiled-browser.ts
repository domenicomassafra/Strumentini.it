/**
 * STR-420: execute the compiled Astro route in Chromium, download real DOCX,
 * and reopen independently with Python ZIP/XML (no production deployment).
 */
import { chromium } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createSimplePdf } from "../src/engines/pdf/index";
import { readFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";

const root = resolve(import.meta.dirname, "..");
const origin = "http://127.0.0.1:19420";
const server = spawn(resolve(root, "node_modules/.bin/astro"),
  ["preview", "--host", "127.0.0.1", "--port", "19420"],
  { cwd: root, stdio: ["ignore", "ignore", "pipe"] });
let serverError = "";
server.stderr?.on("data", (chunk: Buffer) => { serverError = (serverError + chunk.toString()).slice(-2000); });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function ready() {
  for (let i = 0; i < 300; i++) {
    try { if ((await fetch(origin + "/tools/pdf-to-markdown/")).ok) return; } catch {}
    if (server.exitCode !== null) break;
    await sleep(200);
  }
  throw new Error("Compiled Astro preview unavailable: " + (serverError || "startup timed out"));
}
function independentlyRead(bytes: Buffer) {
  const python = [
    "import io,sys,json,zipfile,xml.etree.ElementTree as E",
    "z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))",
    "r=E.fromstring(z.read('word/document.xml'))",
    "w='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'",
    "text=' '.join((x.text or '') for x in r.iter(w+'t'))",
    "tbls=list(r.iter(w+'tbl'))",
    "print(json.dumps({'text':text,'tables':len(tbls),'rows':[len(list(t.iter(w+'tr'))) for t in tbls],'editableRuns':len(list(r.iter(w+'t')))}))",
  ].join("\n");
  const result = spawnSync("python3", ["-c", python], { input: bytes, encoding: "utf8", timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as { text: string; tables: number; rows: number[]; editableRuns: number };
}
async function tableFixture() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const x of [70, 185, 300]) page.drawLine({ start: { x, y: 540 }, end: { x, y: 620 }, thickness: 1 });
  for (const y of [540, 580, 620]) page.drawLine({ start: { x: 70, y }, end: { x: 300, y }, thickness: 1 });
  for (const [label, x, y] of [["Codice",81,596],["Nome",196,596],["001",81,556],["Alice",196,556]] as const) {
    page.drawText(label, { x, y, size: 12, font });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
async function columnFixture() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("colonna sinistra", { x: 50, y: 680, font });
  page.drawText("colonna destra", { x: 340, y: 680, font });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
try {
  await ready();
  // Reuse the MiniPC's existing automation-browser session; never start an
  // additional Chromium profile for this integration acceptance.
  const browser = await chromium.connectOverCDP("http://127.0.0.1:17629");
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    try {
    const page = await context.newPage();
    const browserErrors: string[] = [];
    const external: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(String(error)));
    page.on("request", (request) => {
      if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) {
        external.push(request.url());
      }
    });
    const response = await page.goto(origin + "/tools/pdf-to-markdown/", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    const upload = page.locator('input[aria-label="PDF sorgente per Word"]');
    await page.waitForFunction(() => {
      const input = document.querySelector('input[aria-label="PDF sorgente per Word"]');
      return !!input && !input.closest("astro-island")?.hasAttribute("ssr");
    }, undefined, { timeout: 60_000 });
    for (const [kind, bytes] of [
      ["paragraph", Buffer.from(createSimplePdf(["TESTO_BROWSER_STR420"]))],
      ["table", await tableFixture()],
    ] as const) {
      await upload.setInputFiles({ name: kind + ".pdf", mimeType: "application/pdf", buffer: bytes });
      await page.getByRole("button", { name: "Crea DOCX modificabile" }).click();
      await page.locator("[data-pdf-docx-57-result]").waitFor({ timeout: 60_000 });
      const downloadPromise = page.waitForEvent("download");
      await page.locator("[data-pdf-docx-57-download]").click();
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), kind + ".docx");
      const imported = independentlyRead(await readFile(await download.path()));
      assert.ok(imported.editableRuns > 0);
      if (kind === "table") {
        assert.equal(imported.tables, 1);
        assert.deepEqual(imported.rows, [2]);
        assert.ok(imported.text.includes("001") && imported.text.includes("Alice"));
      } else {
        assert.equal(imported.tables, 0);
        assert.ok(imported.text.includes("TESTO_BROWSER_STR420"));
      }
      console.log("COMPILED_BROWSER_PASS " + kind + " docxReopen=PASS");
    }
    await upload.setInputFiles({ name: "columns.pdf", mimeType: "application/pdf", buffer: await columnFixture() });
    await page.getByRole("button", { name: "Crea DOCX modificabile" }).click();
    await page.locator("[role=alert]").filter({ hasText: "PDF420_COLUMNS_UNSUPPORTED" }).waitFor({ timeout: 30_000 });
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(external, []);
    console.log("COMPILED_BROWSER_PASS columns=REFUSED externalRequests=0 pageErrors=0");
    } finally { await context.close(); }
  } finally { await browser.close(); }
} finally { server.kill("SIGTERM"); }

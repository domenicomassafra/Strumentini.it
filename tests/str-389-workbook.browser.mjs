/** Compiled Astro + existing MiniPC automation-browser; no separate Chrome profile. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import writeXlsxFile from "write-excel-file/universal";
import readXlsxFile from "read-excel-file/universal";
import { unzipSync, zipSync } from "fflate";

const port = 18389;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser, context, page;
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error("Server compilato non disponibile");
    try { if ((await fetch(origin)).ok) break; } catch { /* avvio */ }
    if (i === 99) throw new Error("Timeout server compilato");
    await delay(200);
  }
  const inputBlob = await writeXlsxFile([{
    sheet: "Dati", data: [
      [{ value: "id", type: String }, { value: "numero", type: String }, { value: "totale", type: String }],
      [{ value: "00123", type: String }, { value: 4, type: Number }, { value: "temp", type: String }],
      [{ value: "00007", type: String }, { value: 5, type: Number }, { value: "temp", type: String }],
    ],
  }]).toBlob();
  const parts = unzipSync(new Uint8Array(await inputBlob.arrayBuffer()));
  const original = new TextDecoder().decode(parts["xl/worksheets/sheet1.xml"]);
  const patchFormula = original.replace(/<c r="C2"[^>]*>[^]*?<\/c>/u, '<c r="C2"><f>SUM(B2:B3)</f><v>777</v></c>');
  assert.notEqual(patchFormula, original, "real fixture cell C2");
  parts["xl/worksheets/sheet1.xml"] = new TextEncoder().encode(patchFormula);
  const source = Buffer.from(zipSync(parts, { level: 6 }));
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629", { timeout: 45_000 });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page = await context.newPage();
  const errors = [], requests = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  assert.equal((await page.goto(origin + "/tools/csv-viewer/", { waitUntil: "domcontentloaded" })).status(), 200);
  const editor = page.getByTestId("workbook-editor-389");
  await editor.getByLabel("Apri workbook .xlsx").setInputFiles({ name: "conti.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: source });
  await editor.getByLabel("Cella B2").waitFor({ timeout: 30_000 });
  assert.equal(await editor.getByLabel("Cella A2").inputValue(), "00123");
  assert.equal(await editor.getByLabel("Risultato C2").innerText(), "9", "non usare cache originale 777");
  await editor.getByLabel("Cella B2").fill("6");
  assert.equal(await editor.getByLabel("Risultato C2").innerText(), "11");
  const downloadPromise = page.waitForEvent("download");
  await editor.getByRole("button", { name: "Scarica XLSX con formule" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "conti.formule.xlsx");
  const bytes = await readFile(await download.path());
  const independent = await readXlsxFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.deepEqual(independent[0].data[1], ["00123", 6, 11]);
  const outputParts = unzipSync(bytes);
  assert.match(new TextDecoder().decode(outputParts["xl/worksheets/sheet1.xml"]), /<f>SUM\(B2:B3\)<\/f><v>11<\/v>/u);
  await editor.getByLabel("Cella B2").fill("=C2");
  await editor.getByRole("alert").getByText(/FORMULA_CYCLE/u).waitFor();
  assert.equal(await editor.getByRole("button", { name: "Scarica XLSX con formule" }).isDisabled(), true);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.filter((request) => !request.url.startsWith(origin)), [], "nessun egress esterno");
  assert.deepEqual(requests.filter((request) => !["GET", "HEAD"].includes(request.method)), [], "nessun upload");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  console.log(JSON.stringify({ status: "PASS", route: "/tools/csv-viewer/", viewport: "390x844", independentReader: "read-excel-file", formulas: "REAL_XML_CACHED", staleSourceCache: "RECOMPUTED", cycle: "REFUSED", upload: 0, egress: 0, pageErrors: 0 }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
}

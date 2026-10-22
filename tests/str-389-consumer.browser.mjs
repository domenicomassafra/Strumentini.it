/** Compiled Astro + existing MiniPC automation-browser; no separate Chrome profile. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  const originalSha = createHash("sha256").update(source).digest("hex");
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
  // Real key sequence: clearing the original numeric cell must not turn it into text.
  const numberCell = editor.getByLabel("Cella B2");
  await numberCell.click();
  await numberCell.press("ControlOrMeta+A");
  await numberCell.press("Backspace");
  assert.equal(await numberCell.inputValue(), "");
  await numberCell.press("6");
  assert.equal(await numberCell.inputValue(), "6");
  assert.equal(await editor.getByLabel("Risultato C2").innerText(), "11");
  const downloadPromise = page.waitForEvent("download");
  await editor.getByRole("button", { name: "Scarica XLSX con formule" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "conti.formule.xlsx");
  const bytes = await readFile(await download.path());
  const independent = await readXlsxFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.deepEqual(independent[0].data[1], ["00123", 6, 11]);
  assert.equal(createHash("sha256").update(source).digest("hex"), originalSha, "first input bytes unchanged");
  const outputParts = unzipSync(bytes);
  assert.match(new TextDecoder().decode(outputParts["xl/worksheets/sheet1.xml"]), /<f>SUM\(B2:B3\)<\/f><v>11<\/v>/u);
  await editor.getByLabel("Cella B2").fill("=C2");
  await editor.getByRole("alert").getByText(/FORMULA_CYCLE/u).waitFor();
  assert.equal(await editor.getByRole("button", { name: "Scarica XLSX con formule" }).isDisabled(), true);
  // Separate decimal fixture: stale cache, 15-digit result and semantic calcPr readback.
  const decimalBlob = await writeXlsxFile([{
    sheet: "Dati", data: [
      [{ value: "A", type: String }, { value: "B", type: String }, { value: "Totale", type: String }],
      [{ value: 0.1, type: Number }, { value: 0.2, type: Number }, { value: "stale", type: String }],
    ],
  }]).toBlob();
  const decimalParts = unzipSync(new Uint8Array(await decimalBlob.arrayBuffer()));
  const decimalXml = new TextDecoder().decode(decimalParts["xl/worksheets/sheet1.xml"]);
  const withStaleCache = decimalXml.replace(/<c r="C2"[^>]*>[^]*?<\/c>/u, '<c r="C2"><f>A2+B2</f><v>999</v></c>');
  assert.notEqual(withStaleCache, decimalXml, "stale formula fixture must be applied");
  decimalParts["xl/worksheets/sheet1.xml"] = new TextEncoder().encode(withStaleCache);
  const workbookXml = new TextDecoder().decode(decimalParts["xl/workbook.xml"]);
  const calcXml = '<calcPr calcMode="manual" fullPrecision="0" calcId="191029"/>';
  const withCalc = /<calcPr\b[^>]*\/>/u.test(workbookXml)
    ? workbookXml.replace(/<calcPr\b[^>]*\/>/u, calcXml)
    : workbookXml.replace("</workbook>", calcXml + "</workbook>");
  assert.notEqual(withCalc, workbookXml, "calcPr fixture must be applied");
  decimalParts["xl/workbook.xml"] = new TextEncoder().encode(withCalc);
  const decimalSource = Buffer.from(zipSync(decimalParts, { level: 6 }));
  const decimalSha = createHash("sha256").update(decimalSource).digest("hex");
  await editor.getByLabel("Apri workbook .xlsx").setInputFiles({
    name: "decimali.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: decimalSource,
  });
  await editor.getByLabel("Risultato C2").waitFor();
  assert.equal(await editor.getByLabel("Risultato C2").innerText(), "0.3", "ignore stale cached 999 and round decimal");
  const decimalDownload = page.waitForEvent("download");
  await editor.getByRole("button", { name: "Scarica XLSX con formule" }).click();
  const decimalSaved = await decimalDownload;
  const decimalBytes = await readFile(await decimalSaved.path());
  const decimalOutput = unzipSync(decimalBytes);
  const decimalResult = new TextDecoder().decode(decimalOutput["xl/worksheets/sheet1.xml"]);
  assert.match(decimalResult, /<f>A2\+B2<\/f><v>0\.3<\/v>/u);
  const decimalCalc = new TextDecoder().decode(decimalOutput["xl/workbook.xml"]);
  assert.match(decimalCalc, /fullPrecision="0"/u);
  assert.match(decimalCalc, /calcId="191029"/u);
  assert.match(decimalCalc, /calcMode="auto"/u);
  const independentDecimal = await readXlsxFile(decimalBytes.buffer.slice(decimalBytes.byteOffset, decimalBytes.byteOffset + decimalBytes.byteLength));
  assert.deepEqual(independentDecimal[0].data[1], [0.1, 0.2, 0.3]);
  assert.equal(createHash("sha256").update(decimalSource).digest("hex"), decimalSha, "source XLSX bytes unchanged");

  // Refuse macro and external relation packages through the compiled UI.
  const unsafeCases = [
    {
      label: "macro",
      expected: /Macro|macro/u,
      path: "[Content_Types].xml",
      transform: (xml) => xml.replace("spreadsheetml.sheet.main+xml", "ms-excel.sheet.macroEnabled.main+xml"),
    },
    {
      label: "external",
      expected: /remot|estern/iu,
      path: "xl/_rels/workbook.xml.rels",
      transform: (xml) => xml.replace("</Relationships>", '<Relationship Id="external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" TargetMode="External" Target="https://remote.invalid/a.xlsx"/></Relationships>'),
    },
  ];
  for (const unsafe of unsafeCases) {
    const archive = unzipSync(decimalSource);
    const oldXml = new TextDecoder().decode(archive[unsafe.path]);
    const nextXml = unsafe.transform(oldXml);
    assert.notEqual(nextXml, oldXml, unsafe.label + " fixture must be applied");
    archive[unsafe.path] = new TextEncoder().encode(nextXml);
    await editor.getByLabel("Apri workbook .xlsx").setInputFiles({
      name: unsafe.label + ".xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(zipSync(archive)),
    });
    await editor.getByRole("alert").getByText(unsafe.expected).waitFor();
    assert.match(await editor.getByRole("alert").innerText(), /UNSUPPORTED_WORKBOOK/u);
    assert.equal(await editor.getByRole("button", { name: "Scarica XLSX con formule" }).count(), 0);
  }

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

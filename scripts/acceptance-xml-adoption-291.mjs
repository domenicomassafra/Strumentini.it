import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = 18291;
const origin = `http://127.0.0.1:${port}`;
const sample = "<rows><row code='001'><name>A &amp; B</name><amount>10</amount></row><row code='002'><name><![CDATA[C < D]]></name><amount>20</amount></row></rows>";
const grid = [["attr:code", "name", "amount"], ["001", "A & B", "10"], ["002", "C < D", "20"]];
const workspace = await mkdtemp(join(tmpdir(), "str-291-"));
const server = spawn("node_modules/.bin/vite", ["--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: root, stdio: "ignore" });

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await fetch(`${origin}/scripts/fixtures/office-interchange-browser/index.html`)).ok) return;
    } catch { /* startup */ }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 100));
  }
  throw new Error("Vite XML browser acceptance server did not start");
}

// Standard-library ZIP/XML and CSV readers, independent of our spreadsheet/CSV engines.
const independentReader = String.raw`
import csv,json,sys,zipfile,xml.etree.ElementTree as ET
with open(sys.argv[1],newline='',encoding='utf-8') as f: csv_rows=list(csv.reader(f))
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(sys.argv[2]) as z:
    sheet=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    strings=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        shared=ET.fromstring(z.read('xl/sharedStrings.xml'))
        strings=[''.join(node.itertext()) for node in shared.findall('m:si',ns)]
    rows=[]
    for row in sheet.findall('.//m:sheetData/m:row',ns):
        values=[]
        for cell in row.findall('m:c',ns):
            value=cell.find('m:v',ns)
            if cell.get('t')=='inlineStr':
                value=''.join(cell.find('m:is',ns).itertext())
            elif cell.get('t')=='s':
                value=strings[int(value.text)]
            else:
                value='' if value is None else value.text
            values.append(value)
        rows.append(values)
print(json.dumps({'csv':csv_rows,'xlsx':rows},ensure_ascii=False))
`;

let browser;
try {
  await waitForServer();
  // The MiniPC's shared automation-browser is the approved browser runtime.
  // Connect to it instead of launching an independent Chrome profile/process.
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629");
  const outcomes = [];
  for (const [name, viewport, isMobile] of [
    ["desktop", { width: 1280, height: 800 }, false],
    ["mobile-emulation", { width: 390, height: 844 }, true],
  ]) {
    const context = await browser.newContext({ viewport, isMobile, acceptDownloads: true });
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:18291; img-src 'self' blob:; style-src 'self' 'unsafe-inline'; object-src 'none'";
    await page.route(`${origin}/scripts/fixtures/office-interchange-browser/index.html`, async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": csp } });
    });
    page.on("request", (request) => requests.push({ url: request.url(), method: request.method(), data: request.postData() }));
    page.on("pageerror", (error) => errors.push(String(error)));
    const response = await page.goto(`${origin}/scripts/fixtures/office-interchange-browser/index.html`, { waitUntil: "networkidle" });
    assert.equal(response?.headers()["content-security-policy"], csp);
    const download = page.waitForEvent("download");
    const result = await page.evaluate(async (xml) => {
      const engine = await import("/src/engines/table/xml-interchange.ts");
      const start = performance.now();
      const heaps = [performance.memory?.usedJSHeapSize ?? null];
      const json = engine.xmlToJson(xml).value;
      heaps.push(performance.memory?.usedJSHeapSize ?? null);
      const csv = engine.xmlToCsv(xml).csv;
      heaps.push(performance.memory?.usedJSHeapSize ?? null);
      const xlsx = await engine.xmlToXlsx(xml, { sheetName: "Rows" });
      heaps.push(performance.memory?.usedJSHeapSize ?? null);
      const elapsedMs = performance.now() - start;
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(new Blob([xlsx.bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      anchor.download = "rows.xlsx";
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      return { json, csv, elapsedMs, peakSampledHeapBytes: heaps.every((v) => v !== null) ? Math.max(...heaps) : null, xlsxBytes: xlsx.byteLength };
    }, sample);
    const xlsxFile = join(workspace, `${name}.xlsx`);
    const csvFile = join(workspace, `${name}.csv`);
    await (await download).saveAs(xlsxFile);
    await writeFile(csvFile, result.csv);
    const independent = spawnSync("python3", ["-c", independentReader, csvFile, xlsxFile], { encoding: "utf8" });
    if (independent.status !== 0) throw new Error(`Independent file read failed: ${independent.stderr}`);
    const reopened = JSON.parse(independent.stdout);
    assert.deepEqual(reopened.csv, grid);
    assert.deepEqual(reopened.xlsx, grid);
    assert.deepEqual(result.json, { rows: { row: [
      { "@code": "001", name: "A & B", amount: "10" },
      { "@code": "002", name: "C < D", amount: "20" },
    ] } });
    assert.equal(errors.length, 0, errors.join(" | "));
    const unexpected = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || request.data !== null);
    assert.equal(unexpected.length, 0, JSON.stringify(unexpected));
    outcomes.push({ name, result: "PASS", csvRows: reopened.csv.length, xlsxRows: reopened.xlsx.length, bytes: result.xlsxBytes,
      elapsedMs: Math.round(result.elapsedMs * 100) / 100, peakSampledHeapBytes: result.peakSampledHeapBytes,
      csp: "enforced in browser fixture", externalOrUploadRequests: 0, pageErrors: errors.length });
    await context.close();
  }
  console.log(JSON.stringify({ status: "PASS", test: "STR#291 browser/download/independent reopen", outcomes }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await rm(workspace, { recursive: true, force: true });
}

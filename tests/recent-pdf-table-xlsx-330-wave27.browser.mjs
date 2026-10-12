/** Real Chrome 390px PDF drawn-grid → downloaded XLSX → Recenti regression.
 * Run: node tests/recent-pdf-table-xlsx-330-wave27.browser.mjs
 * Requires installed reportlab (fixture only); XLSX verification uses stdlib ZIP/XML
 * and openpyxl, independent of the TypeScript export reader.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.PDFTABLE330_PORT ?? 18672);
const origin = process.env.PDFTABLE330_ORIGIN ?? `http://127.0.0.1:${port}`;
const id = "pdf-tables-to-xlsx";
const sourceName = "PRIVATE_XLSX_00127.pdf";
const fixturePy = String.raw`
import io,sys
from reportlab.pdfgen import canvas
b=io.BytesIO();c=canvas.Canvas(b,pagesize=(360,400),pageCompression=0)
if sys.argv[1]=='ruled':
 for x in [30,120,210,330]: c.line(x,100,x,280)
 for y in [100,160,220,280]: c.line(30,y,330,y)
for row,values in enumerate([['Codice','Valore','Nota'],['00127','=2+2','Formula letterale'],['00009','42','+testo']]):
 for col,text in enumerate(values):
  c.setFont('Helvetica',9);c.drawString(42+col*90,246-row*60,text)
c.save();sys.stdout.buffer.write(b.getvalue())
`;
function fixture(kind) {
  const run = spawnSync("python3", ["-c", fixturePy, kind], { timeout: 15000, maxBuffer: 2_000_000 });
  assert.equal(run.status, 0, `PDF fixture: ${run.stderr}`);
  assert.equal(run.stdout.subarray(0, 5).toString(), "%PDF-");
  return run.stdout;
}
const ruled = fixture("ruled"), unruled = fixture("plain");
const independentPy = String.raw`
import sys, zipfile, xml.etree.ElementTree as ET, json, io
path=sys.argv[1];z=zipfile.ZipFile(path)
assert z.testzip() is None
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
sheet=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
shared=[]
if 'xl/sharedStrings.xml' in z.namelist():
 shared_xml=ET.fromstring(z.read('xl/sharedStrings.xml'))
 shared=[''.join(e.itertext()) for e in shared_xml.findall('s:si',ns)]
values={}
for cell in sheet.findall('.//s:sheetData/s:row/s:c',ns):
 name=cell.get('r');typ=cell.get('t');v=cell.find('s:v',ns)
 if typ=='inlineStr': value=''.join(cell.find('s:is',ns).itertext())
 elif typ=='s':value=shared[int(v.text)]
 else:value=v.text if v is not None else ''
 values[name]=(typ,value)
assert values['A8'][1]=='00127',values
assert values['B8'][1]=='=2+2',values
assert values['A9'][1]=='00009',values
assert values['C9'][1]=='+testo',values
assert all(c.find('s:f',ns) is None for c in sheet.findall('.//s:c',ns)),'Unsafe formulas in exported sheet'
assert all(values[k][0] in ('s','inlineStr','str') for k in ['A8','B8','A9','C9']),values
assert 'PRIVATE_XLSX_00127.pdf' in values['B1'][1]
assert len(values['B2'][1])==64 and all(c in '0123456789abcdef' for c in values['B2'][1])
import openpyxl
with open(path,'rb') as input_file: wb=openpyxl.load_workbook(io.BytesIO(input_file.read()),read_only=True,data_only=False)
ws=wb.active
assert wb.sheetnames==['P01_Griglia']
assert ws['A8'].value=='00127' and ws['B8'].value=='=2+2'
assert ws['A9'].value=='00009' and ws['C9'].value=='+testo'
assert all(ws[coord].data_type=='s' for coord in ('A8','B8','A9','C9'))
print('OPENPYXL_PASS independent ZIP/XML PASS')
print('XLSX330_ZIP_XML_PASS '+json.dumps({'file':values['B1'][1],'a8':values['A8'][1],'b8':values['B8'][1],'count':len(values)}))
`;
async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" && !(await indexedDB.databases()).some(db => db.name === "utility-workbench")) return [];
    return new Promise((ok, fail) => {
      const request = indexedDB.open("utility-workbench", 1);
      request.onerror = () => fail(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); ok([]); return; }
        const tx = db.transaction("state", "readonly");
        const read = tx.objectStore("state").get("workbench/state:v1");
        read.onerror = () => fail(read.error);
        read.onsuccess = () => ok(read.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}
async function expectCount(page, expected, timeout = 8500) {
  const until = Date.now() + timeout;
  let rows = [];
  do {
    rows = await recent(page);
    const matching = rows.filter(row => row.toolId === id);
    if ((expected === 0 && matching.length === 0) || (matching.length === 1 && matching[0].useCount === expected)) {
      if (expected) {
        assert.deepEqual(Object.keys(matching[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
        assert(Number.isFinite(Date.parse(matching[0].lastUsedAt)));
      }
      assert(!JSON.stringify(rows).includes(sourceName), "Private PDF filename persisted in Recenti");
      assert(!JSON.stringify(rows).includes("00127"), "Private PDF cell persisted in Recenti");
      return;
    }
    await new Promise(ok => setTimeout(ok, 100));
  } while (Date.now() < until);
  assert.fail(`Expected ${id} Recenti ${expected}, found ${JSON.stringify(rows)}`);
}
let logs = "";
const server = process.env.PDFTABLE330_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
server?.stdout?.on("data", buf => { logs = (logs + String(buf)).slice(-3500); });
server?.stderr?.on("data", buf => { logs = (logs + String(buf)).slice(-3500); });
async function ready() {
  for (let i = 0; i < 130; i++) {
    if (server && server.exitCode !== null) throw Error(`Astro exited: ${logs}`);
    try { if ((await fetch(origin + "/tools/pdf-tables-to-xlsx/")).ok) return; } catch { /* boot */ }
    await new Promise(ok => setTimeout(ok, 180));
  }
  throw Error(`Local route unavailable: ${logs}`);
}
const faults = [], writes = [];
function watch(page) {
  page.on("pageerror", err => faults.push(err.message));
  page.on("request", req => {
    if (!["GET", "HEAD"].includes(req.method()) || req.postData() !== null) writes.push(`${req.method()} ${req.url()}`);
    if (!req.url().startsWith(origin) && !req.url().startsWith("blob:") && !req.url().startsWith("data:")) writes.push(`OFFSITE ${req.url()}`);
  });
}
async function upload(page, bytes, name = sourceName) {
  await page.getByLabel("Documento PDF").setInputFiles({ name, mimeType: "application/pdf", buffer: bytes });
  await page.getByRole("button", { name: "Estrai e mostra griglia" }).waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector('[data-pdf-table-254] button[type="submit"]')?.hasAttribute("disabled"));
}
async function extract(page) {
  await page.getByRole("button", { name: "Estrai e mostra griglia" }).click();
  await Promise.race([
    page.locator("[data-pdf-table-preview]").waitFor({ timeout: 30000 }),
    page.locator("[data-pdf-table-254] [role=alert]").waitFor({ timeout: 30000 })
      .then(async () => { throw Error(`PDF extraction failed: ${await page.locator("[data-pdf-table-254] [role=alert]").innerText()} pageerrors=${JSON.stringify(faults)}`); }),
  ]);
  assert.deepEqual(await page.locator("[data-pdf-table-grid] tr").evaluateAll(trs => trs.map(tr =>
    [...tr.querySelectorAll("td")].map(cell => cell.textContent?.trim()))),
  [["Codice", "Valore", "Nota"], ["00127", "=2+2", "Formula letterale"], ["00009", "42", "+testo"]]);
}
async function downloadAndInspect(page) {
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }),
    page.getByRole("link", { name: "Scarica XLSX verificato" }).click()]);
  assert.equal(download.suggestedFilename(), "tabella-pdf-verificata.xlsx");
  const file = await download.path();
  assert(file);
  assert.equal((await readFile(file)).subarray(0,2).toString(), "PK");
  const preferredPy = process.env.PDFTABLE330_OPENPYXL_PYTHON ?? "/tmp/strumentini-370-openpyxl/bin/python";
  const python = existsSync(preferredPy) ? preferredPy : "python3";
  const inspect = spawnSync(python, ["-c", independentPy, file], { encoding: "utf8", timeout: 15000 });
  assert.equal(inspect.status, 0, `Independent Excel parse: ${inspect.stderr}`);
  assert.match(inspect.stdout, /OPENPYXL_PASS/u);
  assert.match(inspect.stdout, /XLSX330_ZIP_XML_PASS/u);
  return inspect.stdout.trim();
}
let browser;
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage(); watch(page);
  assert.equal((await page.goto(origin + "/tools/pdf-tables-to-xlsx/", { waitUntil: "networkidle" }))?.status(), 200);
  await page.locator("[data-pdf-table-254]").waitFor();
  await expectCount(page, 0);
  await upload(page, unruled, "PRIVATE_INVALID_UNRULED.pdf");
  await page.getByRole("button", { name: "Estrai e mostra griglia" }).click();
  await page.getByRole("alert").waitFor({ timeout: 30000 });
  assert.match(await page.getByRole("alert").innerText(), /NOT_A_RULED_TABLE/u);
  await expectCount(page, 0);
  await upload(page, ruled);
  await extract(page);
  await expectCount(page, 0); // A preview alone does not complete the tool.
  assert.equal(await page.locator("[data-pdf-table-result]").count(), 0);
  // Replace the source while a second extraction is awaiting its PDF.js work.
  // The obsolete PDF preview must not resurface after the change event.
  await page.locator("[data-pdf-table-254] form").evaluate((form, payload) => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const input = form.querySelector('input[type="file"]');
    const replacement = new DataTransfer();
    replacement.items.add(new File([new Uint8Array(payload)], "PRIVATE_CHANGED_DURING_EXTRACTION.pdf", { type: "application/pdf" }));
    input.files = replacement.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, Array.from(unruled));
  await page.waitForTimeout(450);
  assert.equal(await page.locator("[data-pdf-table-preview]").count(), 0, "Obsolete preview shown after file replacement");
  assert.equal(await page.locator("[data-pdf-table-result]").count(), 0);
  await expectCount(page, 0);
  await upload(page, ruled);
  await extract(page);
  // Two DOM clicks in the same task try to bypass the asynchronously re-rendered busy button.
  await page.getByRole("button", { name: "Verifica e genera XLSX" }).evaluate(button => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.locator("[data-pdf-table-result]").waitFor({ timeout: 35000 });
  const verification1 = await downloadAndInspect(page);
  await expectCount(page, 1); // RED: real verified XLSX currently never enters Recenti.
  // A region edit retires the prior workbook and preview before a new export.
  await page.getByLabel("Origine X (pt)").fill("1");
  assert.equal(await page.locator("[data-pdf-table-result]").count(), 0);
  assert.equal(await page.locator("[data-pdf-table-preview]").count(), 0);
  await expectCount(page, 1);
  await page.getByLabel("Origine X (pt)").fill("0");
  await extract(page);
  await page.getByRole("button", { name: "Verifica e genera XLSX" }).click();
  await page.locator("[data-pdf-table-result]").waitFor({ timeout: 35000 });
  const verification2 = await downloadAndInspect(page);
  await expectCount(page, 2);
  // Cancel a live export within the same event turn; no stale download/Recenti.
  await page.getByRole("button", { name: /Verifica e genera XLSX/u }).evaluate(button => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.querySelector('[data-pdf-table-cancel]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForTimeout(500);
  assert.equal(await page.locator("[data-pdf-table-result]").count(), 0, "Canceled export still downloadable");
  await expectCount(page, 2);
  await upload(page, unruled, "PRIVATE_INVALID_UNRULED.pdf");
  await page.getByRole("button", { name: "Estrai e mostra griglia" }).click();
  await page.getByRole("alert").waitFor({ timeout: 25000 });
  assert.equal(await page.locator("[data-pdf-table-result]").count(), 0);
  await expectCount(page, 2);
  await page.goto(origin + "/preferiti/", { waitUntil: "networkidle" });
  assert.match(await page.locator("[data-area-activity]").innerText(), /tabelle|XLSX/iu);
  await page.reload({ waitUntil: "networkidle" });
  await expectCount(page, 2);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px horizontal overflow");
  await context.close();
  const denied = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await denied.addInitScript(() => Object.defineProperty(window, "indexedDB", { configurable: true,
    get() { throw new DOMException("blocked", "SecurityError"); } }));
  const blocked = await denied.newPage(); watch(blocked);
  await blocked.goto(origin + "/tools/pdf-tables-to-xlsx/", { waitUntil: "networkidle" });
  await upload(blocked, ruled);
  await extract(blocked);
  await blocked.getByRole("button", { name: "Verifica e genera XLSX" }).click();
  await blocked.locator("[data-pdf-table-result]").waitFor({ timeout: 35000 });
  const deniedVerification = await downloadAndInspect(blocked);
  await blocked.goto(origin + "/preferiti/", { waitUntil: "networkidle" });
  assert.match(await blocked.locator("body").innerText(), /memoria|browser|temporane|disponibil/iu);
  await denied.close();
  assert.deepEqual(faults, [], "Uncaught browser exceptions");
  assert.deepEqual(writes, [], "POST, offsite or body-bearing request");
  console.log(`PDF_TABLE_330_WAVE27_PASS Recenti=2 no-invalid no-cancel no-double mobile390 independent XLSX:\n${verification1}\n${verification2}\n${deniedVerification}`);
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

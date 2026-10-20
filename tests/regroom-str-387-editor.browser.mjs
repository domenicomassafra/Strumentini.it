/** #146: compiled editor tested in the installed automation-browser at 390px. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import readXlsxFile from "read-excel-file/universal";
import writeXlsxFile from "write-excel-file/universal";

const port = 18388;
const origin = "http://127.0.0.1:" + port;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser, context, page;
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error("Static preview exited");
    try { if ((await fetch(origin)).ok) break; } catch { /* start */ }
    if (i === 99) throw Error("Static preview unavailable");
    await delay(200);
  }
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629", { timeout: 45_000 });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page = await context.newPage();
  const requests = [], errors = [];
  page.on("request", r => requests.push({ url: r.url(), method: r.method() }));
  page.on("pageerror", e => errors.push(String(e)));
  assert.equal((await page.goto(origin + "/tools/csv-viewer/", { waitUntil: "domcontentloaded" })).status(), 200);
  const editor = page.getByTestId("spreadsheet-editor-387");
  const input = editor.getByLabel("Apri CSV UTF-8 o XLSX");
  const csv = "id;valore;data;note\n00123;12.50;03/04/2026;Caffè\n00007;123456789012345678901;11/12/2026;Roma";
  await input.setInputFiles({ name: "origine.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await editor.getByLabel("Riga 1 colonna 4").waitFor();
  await editor.getByLabel("Riga 1 colonna 4").fill("Città");
  let downloadPromise = page.waitForEvent("download");
  await editor.getByRole("button", { name: "Scarica CSV modificato" }).click();
  let downloaded = await downloadPromise;
  const csvText = await readFile(await downloaded.path(), "utf8");
  assert.equal(downloaded.suggestedFilename(), "origine.edited.csv");
  assert.equal(csvText, csv.replace("Caffè", "Città"));
  await editor.getByLabel("Tipo Excel colonna 2").selectOption("text");
  downloadPromise = page.waitForEvent("download");
  await editor.getByRole("button", { name: "Scarica Excel modificato" }).click();
  downloaded = await downloadPromise;
  const bytes = await readFile(await downloaded.path());
  const independent = await readXlsxFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const rows = independent[0].data;
  assert.equal(rows[1][0], "00123");
  assert.equal(rows[1][1], "12.50");
  assert.equal(rows[1][2], "03/04/2026");
  assert.equal(rows[2][1], "123456789012345678901");
  assert.equal(rows[1][3], "Città");
  await input.setInputFiles({ name: "imported.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes });
  await editor.getByLabel("Riga 1 colonna 4").waitFor();
  assert.equal(await editor.getByLabel("Riga 1 colonna 4").inputValue(), "Città");

  await input.setInputFiles({ name: "poison.csv", mimeType: "text/csv", buffer: Buffer.from("id,value\n001,=HYPERLINK(1)") });
  await editor.getByRole("alert").getByText(/Formula/u).waitFor();
  assert.equal(await editor.getByRole("button", { name: "Scarica Excel modificato" }).count(), 0);

  const multi = await writeXlsxFile([
    { sheet: "A", data: [[{ value: "a", type: String }]] },
    { sheet: "B", data: [[{ value: "b", type: String }]] },
  ]).toBlob();
  await input.setInputFiles({ name: "multi.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await multi.arrayBuffer()) });
  await editor.getByRole("alert").getByText(/SHEET_SELECTION_REQUIRED|più fogli/u).waitFor();
  assert.equal(await editor.getByRole("button", { name: "Scarica Excel modificato" }).count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.filter(r => !r.url.startsWith(origin)), [], "no external network");
  assert.deepEqual(requests.filter(r => !["GET", "HEAD"].includes(r.method)), [], "no uploads");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  console.log(JSON.stringify({ status: "PASS", consumer: "compiled Astro + Chrome automation-browser", viewport: "390x844",
    csv: "roundtrip-edit-utf8", xlsx: "independent-read-excel-file-reopened", formula: "REFUSED", multisheet: "REFUSED",
    networkEgress: 0, uploads: 0, pageErrors: 0 }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  if (page && context) {
    try { await Promise.race([(async () => { await page.close(); await context.close(); })(), delay(5_000)]); } catch { /* cleanup */ }
  }
  if (browser) await browser.close().catch(() => undefined);
  process.exit(process.exitCode ?? 0);
}

// Compile then exercise real relation consumers through the installed MiniPC
// automation browser. No personal Chrome profile or external site is used.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import writeXlsxFile from "write-excel-file/universal";

const port = 18490;
const origin = "http://127.0.0.1:" + port;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser, context;
const errors = [];
const uploads = [];
try {
  for (let index = 0; index < 100; index++) {
    if (server.exitCode !== null) throw Error("Compiled static preview quit");
    try { if ((await fetch(origin)).ok) break; } catch { /* start */ }
    if (index === 99) throw Error("Compiled preview unavailable");
    await delay(200);
  }
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629", { timeout: 45_000 });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (!["GET", "HEAD"].includes(request.method())) uploads.push(request.method() + " " + request.url());
    if (!request.url().startsWith(origin + "/")) uploads.push("external " + request.url());
  });
  const openTool = async (slug, islandName) => {
    assert.equal((await page.goto(origin + "/tools/" + slug + "/", { waitUntil: "domcontentloaded" })).status(), 200);
    await page.waitForFunction((needle) => {
      const island = [...document.querySelectorAll("astro-island")].find(node => node.getAttribute("component-url")?.includes(needle));
      return island && !island.hasAttribute("ssr");
    }, islandName);
  };

  await openTool("csv-join", "CsvJoinTool");
  await page.getByLabel("Prima tabella CSV").fill("id,name\nx,L1\nx,L2");
  await page.getByLabel("Seconda tabella CSV").fill("id,name\nx,R1\nx,R2");
  await page.getByRole("button", { name: "Unisci tabelle" }).click();
  await page.getByText(/AMBIGUOUS_JOIN_KEYS/u).waitFor();
  assert.equal(await page.locator("[data-result-class=table]").count(), 0);
  await page.getByLabel("Chiavi duplicate").selectOption("expand");
  await page.getByRole("button", { name: "Unisci tabelle" }).click();
  await page.getByText(/4 righe · 4 colonne/u).waitFor();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica CSV completo" }).click();
  const received = await download;
  assert.equal(received.suggestedFilename(), "tabelle-unite.csv");
  assert.equal((await readFile(await received.path(), "utf-8")).split("\n").length, 5);

  await page.getByLabel("Operazione").selectOption("merge-parts");
  await page.getByLabel("Prima tabella CSV").fill("id,name\n1,uno\n1,uno");
  await page.getByLabel("Seconda tabella CSV").fill("id,name\n2,due");
  await page.getByRole("button", { name: "Ricomponi parti" }).click();
  await page.getByText(/3 righe · 2 colonne/u).waitFor();
  const downloadMerged = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica CSV completo" }).click();
  const merged = await downloadMerged;
  assert.equal(await readFile(await merged.path(), "utf-8"), "id,name\n1,uno\n1,uno\n2,due");

  await openTool("table-compare", "TableCompareTool");
  await page.getByLabel("Prima tabella CSV").fill("id,value\n01,old");
  await page.getByLabel("Seconda tabella CSV").fill("id,value\n1,new");
  await page.getByLabel("Interpretazione delle chiavi").selectOption("decimal-exact");
  await page.getByRole("button", { name: "Confronta tabelle" }).click();
  await page.getByText(/1 cambiate/u).waitFor();
  assert.match(await page.locator("[data-result-slot=table-preview]").innerText(), /old/u);
  assert.match(await page.locator("[data-result-slot=table-preview]").innerText(), /new/u);

  const xlsx = await writeXlsxFile([{
    sheet: "Test", data: [
      [{ value: "id", type: String }, { value: "value", type: String }],
      [{ value: "01", type: String }, { value: "old", type: String }],
    ],
  }]).toBlob();
  await page.getByLabel("File sinistro · facoltativo").setInputFiles({
    name: "source.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await xlsx.arrayBuffer()),
  });
  await page.waitForFunction(() => [...document.querySelectorAll("textarea")].some((element) => element.value.includes("01,old")));
  await page.getByRole("button", { name: "Confronta tabelle" }).click();
  await page.getByText(/1 cambiate/u).waitFor();

  assert.deepEqual(errors, []);
  assert.deepEqual(uploads, [], "No upload or external requests");
  console.log("PASS #149 compiled Chrome: duplicate refusal/explicit expansion, download, lossless split-merge, numeric-key compare, XLSX worker source, no uploads/errors");
} finally {
  await context?.close();
  await browser?.close();
  server.kill("SIGTERM");
}

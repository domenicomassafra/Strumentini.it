import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync, strFromU8 } from "fflate";

const root = new URL("../", import.meta.url).pathname;
const port = 18231;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("node_modules/.bin/vite", ["--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${origin}/scripts/fixtures/office-interchange-browser/index.html`);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("Office acceptance Vite server did not start.");
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const requests = [];
  const workers = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method(), postData: request.postData() }));
  page.on("worker", (worker) => workers.push(worker.url()));
  await page.goto(`${origin}/scripts/fixtures/office-interchange-browser/index.html`, { waitUntil: "networkidle" });
  const before = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  if (before.some((url) => /office-local|read-excel-file|write-excel-file|fflate/iu.test(url))) throw new Error("Office implementation loaded before explicit user action.");
  await page.getByRole("button", { name: "Run bounded office acceptance" }).press("Enter");
  await page.waitForFunction(() => (document.querySelector("#result")?.textContent?.trim().length ?? 0) > 0, undefined, { timeout: 60_000 });
  const raw = await page.locator("#result").innerText();
  if (raw.startsWith("ERROR:")) throw new Error(raw);
  const result = JSON.parse(raw);
  if (!String(result.csv).includes("00123,03/04/2026,12.5")) throw new Error("XLSX browser roundtrip changed typed/text values.");
  if (result.docx?.kind !== "docx" || result.docx?.verification?.memberBytesUnchanged !== true || result.docx?.verification?.relationshipBytesUnchanged !== true || result.docx?.verification?.contentTypesBytesUnchanged !== true || result.docx?.verification?.outputCompression !== "deflate") {
    throw new Error(`OOXML browser rebuild verification failed: ${raw}`);
  }
  if (result.docx?.structure?.previewPolicy !== "semantic-structure-only-not-faithful-rendering" || result.docx?.structure?.activeContentPolicy !== "macros-refused-scripts-never-executed-external-links-never-resolved") throw new Error(`Office structure policy missing: ${raw}`);
  if (!String(result.docx?.semanticText ?? "").includes("Fattura di prova")) throw new Error(`DOCX semantic extraction missing expected text: ${raw}`);
  if (!(result.docx?.metadata?.removed > 0) || result.docx?.metadata?.after !== 0 || result.docx?.metadata?.verification?.metadataReinspectionEmpty !== true || result.docx?.metadata?.verification?.relationshipBytesUnchanged !== true) throw new Error(`Office metadata cleanup verification failed: ${raw}`);
  if (result.docx?.generated?.kind !== "docx" || !String(result.docx?.generated?.text ?? "").includes("Browser DOCX") || result.docx?.generated?.verification?.reopened !== true) throw new Error(`DOCX generation/reopen failed: ${raw}`);
  const downloadPending = page.waitForEvent("download");
  await page.locator("#download-docx").click();
  const download = await downloadPending;
  if (download.suggestedFilename() !== "browser-office.docx") throw new Error("Generated DOCX download name mismatch");
  const saved = new Uint8Array(await readFile(await download.path()));
  const extractedPackage = unzipSync(saved);
  if (!extractedPackage["word/document.xml"] || !strFromU8(extractedPackage["word/document.xml"]).includes("Browser DOCX")) {
    throw new Error("Downloaded DOCX did not independently reopen as a valid ZIP/WordprocessingML package.");
  }
  if (result.pptx?.slides?.[0]?.title !== "Presentazione di prova" || result.pptx?.rasterExport?.status !== "REFUSED") throw new Error(`PPTX outline/raster refusal mismatch: ${raw}`);
  if (workers.length < 8) throw new Error(`Expected isolated workers for office operations, observed ${workers.length}.`);
  if (consoleErrors.length > 0) throw new Error(`Browser runtime errors: ${consoleErrors.join(" | ")}`);
  const badRequests = requests.filter(({ url, method, postData }) => !url.startsWith(origin) || method !== "GET" || (postData ?? "") !== "");
  if (badRequests.length > 0) throw new Error(`Unexpected external/non-GET/task-body request: ${JSON.stringify(badRequests)}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("Office acceptance fixture overflows at 390px.");
  const after = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  const receipt = { schemaVersion: 1, status: "PASS", scope: "bounded Office downstream 161/163/225/226/227/260-outline/261; no faithful raster claim", workersObserved: workers.length, lazyResourcesAdded: after.length - before.length, downloadedDocxBytes: saved.length, externalRequests: 0, mobileOverflow: false, result };
  const receiptDir = resolve(root, "quality/receipts/office-downstream");
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
  await context.close();
  await browser.close();
} finally {
  server.kill("SIGTERM");
}

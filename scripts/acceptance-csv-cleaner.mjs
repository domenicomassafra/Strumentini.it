import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18136;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await sleep(500);
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let started = false;
  const requests = [];
  page.on("request", (r) => { if (started) requests.push({ url: r.url(), method: r.method(), postData: r.postData() }); });
  await page.goto(`${origin}/tools/csv-cleaner/`, { waitUntil: "networkidle" });
  await page.locator('[data-tool-page][data-runtime="LOCAL"]').waitFor();
  const content = "\uFEFFa,b\r\n 1 , 2 \r\n";
  await page.getByLabel("File CSV").setInputFiles({ name: "sample.csv", mimeType: "text/csv", buffer: Buffer.from(content) });
  started = true;
  await page.getByRole("button", { name: "Pulisci CSV" }).click();
  await page.getByText("2 righe", { exact: true }).waitFor();
  await page.locator(".gutter-rows").getByText("2", { exact: true }).first().waitFor();
  await page.getByText("BOM rimosso: sì", { exact: true }).waitFor();
  await page.locator("pre.csv-preview").filter({ hasText: "a,b" }).first().waitFor();
  if (requests.some((r) => !r.url.startsWith(origin) || r.method !== "GET" || `${r.url}\n${r.postData ?? ""}`.includes(" 1 , 2 "))) throw new Error("CSV task content escaped browser");
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("CSV mobile overflow");
  await browser.close();
  await mkdir(resolve(root, "quality/receipts/csv-cleaner"), { recursive: true });
  await writeFile(resolve(root, "quality/receipts/csv-cleaner/browser-acceptance.json"), `${JSON.stringify({ schemaVersion: 1, status: "PASS", mobileViewport: "390x844", filePicker: "PASS", network: "zero external/task-content requests", preview: "PASS" }, null, 2)}\n`);
  console.log("CSV Cleaner browser acceptance PASS");
} finally {
  server.kill("SIGTERM");
}

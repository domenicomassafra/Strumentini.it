import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18148;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root,
  stdio: "ignore",
});

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
    }
    await sleep(100);
  }
  throw new Error(`static server did not become ready at ${origin}`);
}

async function submitAtMobile(context, toolId) {
  const page = await context.newPage();
  const requests = [];
  let started = false;
  page.on("request", (request) => {
    if (started) requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });
  const response = await page.goto(`${origin}/tools/${toolId}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`${toolId}: HTTP ${response?.status()}`);
  await page.locator('[data-tool-page][data-runtime="LOCAL"]').waitFor();
  const submit = page.locator("article[data-tool-page] form button[type='submit']").first();
  started = true;
  await submit.focus();
  await page.keyboard.press("Enter");
  await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 10000 });
  await page.waitForTimeout(50);

  const externalOrWrite = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
  if (externalOrWrite.length > 0) throw new Error(`${toolId}: task emitted external/write/body requests`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${toolId}: horizontal overflow at 390px`);
  return page;
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });

  const mortgage = await submitAtMobile(context, "mortgage-amortization-calculator");
  const previewRows = mortgage.locator('section[aria-label="Anteprima piano di ammortamento"] .gutter-rows > div');
  if (await previewRows.count() !== 8) throw new Error(`mortgage: expected bounded 8-row preview, got ${await previewRows.count()}`);
  const downloadButton = mortgage.locator('button[data-result-action="download"]');
  await downloadButton.waitFor();
  const [download] = await Promise.all([
    mortgage.waitForEvent("download"),
    downloadButton.click(),
  ]);
  if (download.suggestedFilename() !== "piano-ammortamento-mutuo.csv") throw new Error(`mortgage: unexpected download filename ${download.suggestedFilename()}`);
  const downloadPath = await download.path();
  if (downloadPath === null) throw new Error("mortgage: downloaded CSV has no local path");
  const csv = await readFile(downloadPath, "utf8");
  const lines = csv.trimEnd().split("\n");
  if (lines.length !== 241) throw new Error(`mortgage: expected header + 240 rows, got ${lines.length}`);
  if (lines[0] !== "period,payment,principal,interest,balance") throw new Error("mortgage: CSV header mismatch");
  if (!lines.at(-1)?.endsWith(",0.00")) throw new Error("mortgage: final CSV balance is not zero");
  await mortgage.close();

  const geometry = await submitAtMobile(context, "geometry-equation-motion-helper");
  await geometry.close();
  const everyday = await submitAtMobile(context, "everyday-cost-calculator");
  await everyday.close();

  await context.close();
  await browser.close();
  console.log("business-math expansion browser acceptance PASS: 3 routes, 390px, local task network, bounded mortgage preview and 240-row CSV download");
} finally {
  server.kill("SIGTERM");
}

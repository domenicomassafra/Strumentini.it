import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_CVD_ACCEPTANCE_PORT ?? 18174);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`invalid acceptance port: ${String(port)}`);
const origin = `http://127.0.0.1:${port}`;
const route = `${origin}/tests/browser-fixtures/color-vision-simulation-harness.html`;
const server = spawn(resolve(root, "node_modules/.bin/vite"), ["--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: root,
  stdio: "ignore",
});
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const modes = [
  ["protanopia", "Protanopia"],
  ["deuteranopia", "Deuteranopia"],
  ["tritanopia", "Tritanopia"],
];

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(route);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Vite acceptance server did not become ready at ${route}`);
}

async function acceptMode(context, mode, label) {
  const page = await context.newPage();
  const taskRequests = [];
  const runtimeErrors = [];
  let started = false;
  page.on("request", (request) => {
    if (started) taskRequests.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  try {
    const response = await page.goto(route, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`${mode}: harness HTTP ${String(response?.status())}`);
    await page.locator("#mode").selectOption(mode);
    started = true;
    await page.locator("#run").click();
    const comparison = page.locator('[data-result-slot="comparison"]');
    await comparison.waitFor({ timeout: 15_000 });
    await comparison.locator("img").nth(1).waitFor({ timeout: 15_000 });
    const comparisonImages = await comparison.locator("img").count();
    if (comparisonImages !== 2) throw new Error(`${mode}: expected two comparison images, got ${comparisonImages}`);
    const text = await page.locator("#result").innerText();
    if (!text.includes(`Simulazione: ${label}`)) throw new Error(`${mode}: exact selected mode is not visible`);
    if (!text.includes("DOI 10.1109/TVCG.2009.113")) throw new Error(`${mode}: model source is not visible`);
    if (!/non una diagnosi medica/iu.test(text) || !/non una rappresentazione universale/iu.test(text)) {
      throw new Error(`${mode}: simulation limitation language is missing`);
    }
    if (!/Firma\/contenitore coerenti/iu.test(text)) throw new Error(`${mode}: verified artifact evidence is not visible`);
    const download = page.locator("#result a[download]").first();
    await download.waitFor({ timeout: 15_000 });
    const filename = await download.getAttribute("download");
    if (filename === null || !filename.includes(`${mode}-simulation`) || !filename.endsWith(".png")) {
      throw new Error(`${mode}: download filename does not disclose the exact mode: ${String(filename)}`);
    }
    if (runtimeErrors.length > 0) throw new Error(`${mode}: runtime/console errors: ${runtimeErrors.join(" | ")}`);
    const badRequests = taskRequests.filter((request) => {
      const local = request.url.startsWith(origin) || request.url.startsWith(`blob:${origin}/`) || request.url.startsWith("data:");
      return !local || request.method !== "GET" || (request.postData ?? "") !== "";
    });
    if (badRequests.length > 0) throw new Error(`${mode}: external/non-GET/task-body request: ${JSON.stringify(badRequests)}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (horizontalOverflow) throw new Error(`${mode}: horizontal overflow at 390px`);
    return {
      mode,
      label,
      status: "PASS",
      comparisonImages,
      downloadFilename: filename,
      outputSha256: sha256(text),
      externalTaskRequests: 0,
      nonGetTaskRequests: 0,
      taskContentLeaks: 0,
      runtimeErrors: 0,
      horizontalOverflow: false,
    };
  } finally {
    await page.close();
  }
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const results = [];
    try {
      for (const [mode, label] of modes) results.push(await acceptMode(context, mode, label));
    } finally {
      await context.close();
    }
    const receipt = {
      schemaVersion: 1,
      status: "PASS",
      acceptanceToolId: "color-blindness-image-simulation",
      harness: "production simulation engine + production ImageResultV2",
      model: "Machado, Oliveira & Fernandes (2009)",
      modelDoi: "10.1109/TVCG.2009.113",
      modes: results,
      comparison: "original and simulated image are both rendered and labeled with the exact selected mode",
      artifact: "shared verifier enables a PNG download whose filename contains the exact selected mode",
      medicalClaim: "result states simulation-not-diagnosis and not-universal-perception limits",
      mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
      network: "zero external/non-GET/task-body requests after simulation starts",
    };
    const outputDir = resolve(root, "quality/receipts/color-vision-simulation");
    await mkdir(outputDir, { recursive: true });
    await writeFile(resolve(outputDir, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    console.log(`color-vision simulation browser acceptance PASS: ${results.length} modes`);
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}

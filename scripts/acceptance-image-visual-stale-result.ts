/** Built-site Chromium regression: changing an image or calculator input revokes its previous result. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, type Page } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STR316_PORT ?? 19616);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const source = resolve(root, "quality/fixtures/image-format-matrix/source.png");
const result = (page: Page) => page.locator("section.result-panel [data-result-class]");
const downloads = (page: Page) => page.locator("section.result-panel a[download]");
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(`Preview server exited ${server.exitCode}`);
    try { if ((await fetch(origin)).ok) return; } catch { /* Starting. */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw Error("STR-316 preview server did not start");
}

async function open(page: Page, tool: string) {
  assert.equal((await page.goto(`${origin}/tools/${tool}/`, { waitUntil: "networkidle" }))?.status(), 200);
  await expect(page.getByRole("button", { name: "Esegui in locale" })).toBeEnabled();
}

async function run(page: Page, kind: "image" | "calculator" | "validator" = "calculator") {
  await page.getByRole("button", { name: "Esegui in locale" }).click();
  await expect(result(page)).toHaveAttribute("data-result-class", kind, { timeout: 20_000 });
}

async function cleared(page: Page, label: string) {
  await expect(result(page), `${label}: stale result`).toHaveCount(0);
  await expect(downloads(page), `${label}: stale download`).toHaveCount(0);
  await expect(page.locator("section.result-panel .result-placeholder")).toBeVisible();
}

async function downloadJpeg(page: Page): Promise<Buffer> {
  const link = downloads(page).first();
  await expect(link).toBeVisible();
  const received = page.waitForEvent("download");
  await link.click();
  const bytes = await readFile(await (await received).path());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], "JPEG signature");
  assert.ok(bytes.length > 100, "nonempty encoded JPEG");
  return bytes;
}

async function changeColor(page: Page, label: string, hex: string) {
  await page.getByLabel(label).evaluate((element, color) => {
    const input = element as HTMLInputElement;
    input.value = color;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, hex, { timeout: 7_000 });
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const offsite: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) offsite.push(request.url());
  });

  // File result and its download must disappear on quality changes before another submit.
  await open(page, "image-format-conversion");
  await page.locator('form input[type="file"]').setInputFiles(source);
  await page.getByLabel("Formato di uscita").selectOption("image/jpeg");
  await run(page, "image");
  const firstJpeg = await downloadJpeg(page);
  const firstJpegUrl = await downloads(page).first().getAttribute("href");
  await page.getByLabel("Qualità, se supportata").fill("0.20");
  await cleared(page, "JPEG quality 0.85 → 0.20");
  await run(page, "image");
  const secondJpeg = await downloadJpeg(page);
  assert.notEqual(await downloads(page).first().getAttribute("href"), firstJpegUrl, "quality 0.20 must prepare a fresh verified JPEG");
  assert.ok(firstJpeg.length > 100 && secondJpeg.length > 100, "both qualities produced real JPEG files");

  await changeColor(page, "Sfondo per trasparenza → JPEG", "#000000");
  await cleared(page, "JPEG background white → black");
  await run(page, "image");
  const backgroundJpeg = await downloadJpeg(page);
  assert.notEqual(sha(secondJpeg), sha(backgroundJpeg), "JPEG flattening background must affect decoded output");

  await page.getByLabel("Formato di uscita").selectOption("image/webp");
  await cleared(page, "JPEG → WebP format");
  await run(page, "image");
  await page.getByLabel("Qualità, se supportata").fill("0.70");
  await cleared(page, "WebP quality");
  await run(page, "image");
  const webpLink = downloads(page).first();
  const webpDownload = page.waitForEvent("download");
  await webpLink.click();
  const webpBytes = await readFile(await (await webpDownload).path());
  assert.equal(webpBytes.toString("ascii", 0, 4), "RIFF", "WebP RIFF signature");
  assert.equal(webpBytes.toString("ascii", 8, 12), "WEBP", "WebP format signature");

  await page.getByLabel("Formato di uscita").selectOption("image/png");
  await cleared(page, "WebP → PNG format");
  await run(page, "image");
  const autoDownload = page.getByLabel("Download automatico condiviso (WAV, JSON, CSV, PDF singolo e prossimo PNG verificato)");
  await autoDownload.check();
  await expect(result(page), "consent alone must preserve current PNG result").toHaveCount(1);
  await expect(downloads(page), "consent alone must preserve current PNG download").not.toHaveCount(0);
  await autoDownload.uncheck();

  // Calculator output is equally sensitive: both numeric inputs must revoke prior ratios.
  await open(page, "aspect-ratio-calculator");
  await page.getByLabel("Larghezza").fill("4");
  await page.getByLabel("Altezza").fill("3");
  await run(page);
  assert.match(await result(page).innerText(), /4\s*:\s*3/u, "initial 4:3 ratio");
  await page.getByLabel("Larghezza").fill("16");
  await cleared(page, "ratio width 4 → 16");
  await run(page);
  assert.match(await result(page).innerText(), /16\s*:\s*3/u, "recalculated 16:3 ratio");
  await page.getByLabel("Altezza").fill("9");
  await cleared(page, "ratio height 3 → 9");

  // Color picker, second background field and plain text are all input-dependent.
  await open(page, "contrast-checker");
  await run(page, "validator");
  const firstContrast = await result(page).innerText();
  await changeColor(page, "Primo piano", "#ff0000");
  await cleared(page, "foreground color");
  await run(page, "validator");
  assert.notEqual(await result(page).innerText(), firstContrast, "foreground recalculation");
  await changeColor(page, "Sfondo", "#000000");
  await cleared(page, "contrast background");
  await run(page, "validator");

  await open(page, "color-converter");
  await page.getByLabel("Modalità colore").selectOption("named-color");
  await page.getByLabel("Nome colore CSS").fill("rebeccapurple");
  await run(page);
  const namedBefore = await result(page).innerText();
  await page.getByLabel("Nome colore CSS").fill("tomato");
  await cleared(page, "text color input");
  await run(page);
  assert.notEqual(await result(page).innerText(), namedBefore, "new CSS color calculation");

  assert.deepEqual(offsite, [], "all image and color jobs must remain local");
  console.log("PASS STR-316 Chromium: JPEG/WebP quality, JPEG background, ratio 4×3→16×3, foreground/background colors and CSS text invalidate results/downloads; consent preserves result; reruns are local");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

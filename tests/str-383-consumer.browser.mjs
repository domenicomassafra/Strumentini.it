/**
 * STR-383 built consumer pixel oracle.
 * Run on MiniPC after npm run build:
 *   node tests/str-383-consumer.browser.mjs
 * Connects to the authorized existing automation-browser CDP 17629.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const origin = "http://127.0.0.1:19383";
const server = spawn("python3", ["-m", "http.server", "19383", "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
let browser;
let context;
let page;

async function ready() {
  for (let i = 0; i < 80; i += 1) {
    if (server.exitCode != null) throw Error(`Static server exited: ${server.exitCode}`);
    try { if ((await fetch(origin)).ok) return; } catch { /* Server starting. */ }
    await delay(250);
  }
  throw Error("Built consumer server unavailable");
}

try {
  await ready();
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629");
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  const errors = [];
  const uploads = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) uploads.push(`${request.method()} ${request.url()}`);
  });
  const response = await page.goto(`${origin}/tools/image-resize/`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);
  await page.locator("summary").filter({ hasText: "Regolazioni avanzate" }).click();
  const editor = page.locator("[data-str-383]");
  await editor.locator("[data-str-383-file]").waitFor();
  // Reference fixture has only IHDR/IDAT/IEND, no embedded profile or EXIF.
  // Each input pixel is opaque [64,128,192,255].
  const source = await readFile("tests/fixtures/str-383-srgb-2x2.png");
  const sourceHash = sha(source);
  await editor.locator("[data-str-383-file]").setInputFiles({ name: "source.png", mimeType: "image/png", buffer: source });
  await page.waitForFunction(() => {
    const editor = document.querySelector("[data-str-383]");
    return editor?.querySelectorAll('input[type="number"]')[0]?.value === "2";
  });
  await editor.getByLabel("Larghezza (px)").fill("1");
  await editor.getByLabel("Altezza (px)").fill("1");
  await editor.getByLabel("Livello nero (0–254)").fill("64");
  await editor.getByLabel("Livello bianco (1–255)").fill("192");
  await editor.getByRole("button", { name: "Applica regolazioni" }).click();
  await editor.locator("[data-str-383-result] a[download]").waitFor({ timeout: 30_000 });
  const output = await page.evaluate(async () => {
    const url = document.querySelector("[data-str-383-result] a[download]").href;
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const blob = new Blob([bytes], { type: "image/png" });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { colorSpace: "srgb" });
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return {
      bytes: Array.from(bytes.subarray(0, 8)),
      size: [canvas.width, canvas.height],
      rgba: Array.from(context.getImageData(0, 0, 1, 1, { colorSpace: "srgb" }).data),
    };
  });
  assert.deepEqual(output.bytes, [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(output.size, [1, 1]);
  assert.deepEqual(output.rgba, [0, 128, 255, 255], "Independent PNG decoded pixel oracle");
  assert.equal(sha(source), sourceHash, "Source original bytes unchanged");

  for (const [name, buffer] of [
    ["icc.jpg", await readFile("tests/fixtures/image-exifr-272/jpeg-icc-iptc.jpg")],
    ["exif.png", await readFile("quality/fixtures/image-metadata-segments/with-exif.png")],
  ]) {
    const unchanged = sha(buffer);
    await editor.locator("[data-str-383-file]").setInputFiles({ name, mimeType: name.endsWith("jpg") ? "image/jpeg" : "image/png", buffer });
    await editor.getByRole("button", { name: "Applica regolazioni" }).click();
    await editor.getByRole("alert").getByText(/Profilo colore o orientamento non verificabile/u).waitFor();
    assert.equal(await editor.locator("[data-str-383-result]").count(), 0);
    assert.equal(sha(buffer), unchanged);
  }
  assert.deepEqual(uploads, [], "No user image uploaded");
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log("PASS STR-383 built consumer: sRGB levels/curve/resize PNG pixel oracle, ICC/EXIF refusals, original hashes, no upload; mobile physical NOT_RUN");
} catch (error) {
  console.error("FAIL STR-383 built consumer", error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  if (page) await page.close().catch(() => {});
  if (context) await context.close().catch(() => {});
  // Disconnect only this test context; the shared CDP browser stays running.
  process.exit(process.exitCode ?? 0);
}

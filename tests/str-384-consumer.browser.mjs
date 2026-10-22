/** STR-384: run against an existing `npm run build` dist with MiniPC automation Chrome (CDP 17629). */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const port = 18384;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser;
let context;

async function rgba(buffer, x, y) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 4)];
}

try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error("Built static server exited");
    try { if ((await fetch(origin)).ok) break; } catch { /* starting */ }
    if (i === 99) throw Error("Built site unavailable: first run npm run build");
    await delay(200);
  }
  browser = await chromium.connectOverCDP(process.env.STR_384_CDP ?? "http://127.0.0.1:17629", { timeout: 10_000 });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("request", (request) => requests.push([request.method(), request.url()]));
  assert.equal((await page.goto(`${origin}/tools/screenshot-border-background-helper/`))?.status(), 200);
  await page.getByLabel("Modalità workspace screenshot").selectOption("text-shapes");
  const panel = page.locator("[data-str-384]");
  const original = await sharp({ create: { width: 96, height: 64, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } }).png().toBuffer();
  await panel.getByLabel("Immagine originale").setInputFiles({ name: "originale.png", mimeType: "image/png", buffer: original });
  await panel.getByLabel("Testo 1").fill("STR384");
  await panel.getByRole("button", { name: "Aggiungi livello" }).click();
  await panel.getByLabel("X 2").fill("0");
  await panel.getByLabel("Y 2").fill("0");
  await panel.getByLabel("Larghezza 2").fill("10");
  await panel.getByLabel("Altezza 2").fill("10");
  await panel.getByLabel("Opacità 2").fill("0.5");
  await panel.getByRole("button", { name: "Componi PNG" }).click();
  await panel.locator("[data-shapes-preview]").waitFor();
  const previewBytes = Buffer.from(await panel.locator("[data-shapes-preview]").evaluate(async (image) => [...new Uint8Array(await (await fetch(image.src)).arrayBuffer())]));
  const downloadWait = page.waitForEvent("download");
  await panel.getByRole("link", { name: "Scarica lo stesso PNG" }).click();
  const download = await downloadWait;
  const exported = await readFile(await download.path());
  assert.equal(download.suggestedFilename(), "originale-text-shapes.png");
  assert.deepEqual(exported, previewBytes, "preview and export must be identical bytes");
  assert.deepEqual(await rgba(exported, 5, 5), [128, 0, 127, 255], "independent source-over pixel oracle");
  assert.deepEqual(await rgba(original, 5, 5), [0, 0, 255, 255], "original bytes remain unchanged");
  const { info, data } = await sharp(exported).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [96, 64], "downloaded raster reopens at exact dimensions");
  assert(data.some((v, i) => i % 4 === 0 && v > 0), "visible text/shape pixels in reopened PNG");

  await panel.getByRole("button", { name: "Aggiungi livello" }).click();
  await panel.getByLabel("Tipo 3").selectOption("ellipse");
  await panel.getByLabel("X 3").fill("0");
  await panel.getByLabel("Y 3").fill("0");
  await panel.getByLabel("Larghezza 3").fill("10");
  await panel.getByLabel("Altezza 3").fill("10");
  await panel.getByRole("button", { name: "Componi PNG" }).click();
  await panel.locator("[data-shapes-preview]").waitFor();
  let stacked = Buffer.from(await panel.locator("[data-shapes-preview]").evaluate(async (image) => [...new Uint8Array(await (await fetch(image.src)).arrayBuffer())]));
  assert.deepEqual(await rgba(stacked, 5, 5), [0, 255, 0, 255], "top ellipse is painted above rectangle");
  await panel.locator("[data-shape-layer]").nth(2).getByRole("button", { name: "Sposta sotto" }).click();
  await panel.getByRole("button", { name: "Componi PNG" }).click();
  await panel.locator("[data-shapes-preview]").waitFor();
  stacked = Buffer.from(await panel.locator("[data-shapes-preview]").evaluate(async (image) => [...new Uint8Array(await (await fetch(image.src)).arrayBuffer())]));
  assert.deepEqual(await rgba(stacked, 5, 5), [128, 127, 0, 255], "reordering reverses source-over contribution");
  await panel.locator("[data-shape-layer]").nth(1).getByRole("button", { name: "Rimuovi" }).click();
  await panel.getByLabel("Visibile 2").uncheck();
  await panel.getByRole("button", { name: "Componi PNG" }).click();
  await panel.locator("[data-shapes-preview]").waitFor();
  const hidden = Buffer.from(await panel.locator("[data-shapes-preview]").evaluate(async (image) => [...new Uint8Array(await (await fetch(image.src)).arrayBuffer())]));
  assert.deepEqual(await rgba(hidden, 5, 5), [0, 0, 255, 255], "hidden rectangle cannot contribute pixels");
  const textOnly = await sharp(hidden).ensureAlpha().raw().toBuffer();
  assert(textOnly.some((v, i) => i % 4 === 0 && v > 0), "text remains visible in reopened PNG with shapes hidden");
  await panel.getByLabel("Testo 1").fill("مرحبا");
  await panel.getByRole("button", { name: "Componi PNG" }).click();
  await panel.getByRole("alert").getByText(/UNSUPPORTED_RTL/u).waitFor();
  assert.equal(await panel.locator("[data-shapes-output]").count(), 0, "failure invalidates previous export");
  await panel.getByLabel("Testo 1").fill("Emoji 🦉");
  await panel.getByRole("button", { name: "Componi PNG" }).click();
  await panel.getByRole("alert").getByText(/UNSUPPORTED_EMOJI/u).waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.filter(([method, url]) => !["GET", "HEAD"].includes(method) || !url.startsWith(origin)), [], "no uploads or remote network");
  console.log(JSON.stringify({ status: "PASS", ticket: "STR-384", compiledConsumer: true, pixelOracle: [128, 0, 127, 255], reopened: true, previewExportIdentity: true, rtl: "REFUSED", emoji: "REFUSED", originalUnchanged: true }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await context?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  server.kill("SIGTERM");
}

/** STR-212 acceptance on `dist/` after `npm run build`. No production deploy.
 * Runs a local Astro preview and exercises real browser downloads. The HEIC
 * orientation gate remains NOT_RUN if the available fixture has no rotation.
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const origin = "http://127.0.0.1:19579";
const fixtures = {
  avif: resolve(root, "quality/fixtures/image-format-matrix/source.avif"),
  heic: resolve(root, "quality/fixtures/image-format-matrix/source.heic"),
  gif: resolve(root, "spikes/heavy-local-feasibility/public/corpus/sample-animated.gif"),
};
const fingerprint = bytes => createHash("sha256").update(bytes).digest("hex");
const original = Object.fromEntries(await Promise.all(Object.entries(fixtures)
  .map(async ([key, path]) => [key, await readFile(path)])));
const hashes = Object.fromEntries(Object.entries(original).map(([key, bytes]) => [key, fingerprint(bytes)]));
assert(existsSync(resolve(root, "dist/tools/image-format-conversion/index.html")),
  "First build the consumer with npm run build");

const scratch = await mkdtemp(join(tmpdir(), "str-212-built-"));
const python = process.env.PYTHON ?? "python3";
const oracle = resolve(root, "scripts/acceptance-gif-animation-273.py");
const preview = spawn(resolve(root, "node_modules/.bin/astro"),
  ["preview", "--host", "127.0.0.1", "--port", "19579"],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let previewLog = "";
for (const stream of [preview.stdout, preview.stderr]) {
  stream.on("data", chunk => { previewLog = (previewLog + String(chunk)).slice(-3000); });
}
let browser;
let checks = 0;
let heicState = "NOT_RUN";
try {
  let running = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (preview.exitCode !== null) throw new Error(`Astro preview terminated: ${previewLog}`);
    try {
      const response = await fetch(origin + "/tools/image-format-conversion/", { signal: AbortSignal.timeout(700) });
      if (response.status === 200) { running = true; break; }
    } catch { /* preview still starting */ }
    await delay(200);
  }
  assert(running, `Astro preview did not start: ${previewLog}`);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const escaped = [];
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request();
    if (["GET", "HEAD"].includes(request.method()) &&
        (request.url().startsWith(origin + "/") || /^(blob|data):/u.test(request.url()))) return route.continue();
    escaped.push(`${request.method()} ${request.url()}`);
    return route.abort();
  });
  const response = await page.goto(origin + "/tools/image-format-conversion/", { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => {
    const island = document.querySelector('astro-island[component-url*="ImageFormatConversionTool"]');
    return island && !island.hasAttribute("ssr");
  });
  const stillForm = page.locator('form:has(input[type="file"])').first();
  const choose = stillForm.locator('input[type="file"]');

  async function stillDownload(name, mimeType, buffer) {
    await choose.setInputFiles({ name, mimeType, buffer });
    await page.locator('[data-result-class="image"] a[download$=".png"]').first()
      .waitFor({ state: "hidden" });
    await stillForm.getByRole("button", { name: "Esegui in locale" }).click();
    const link = page.locator('[data-result-class="image"] a[download$=".png"]').first();
    await link.waitFor({ timeout: 30_000 });
    const next = page.waitForEvent("download");
    await link.click();
    const download = await next;
    assert.match(download.suggestedFilename(), /\.png$/u);
    const bytes = await readFile(await download.path());
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    checks += 3;
    return decoded;
  }

  // Compare the real browser's AVIF pixel decode with a separate Sharp PNG decode.
  await choose.setInputFiles({ name: "still.avif", mimeType: "image/avif", buffer: original.avif });
  const nativeAvif = await choose.evaluate(async input => {
    const bitmap = await createImageBitmap(input.files[0], { imageOrientation: "from-image" });
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0);
      return [...ctx.getImageData(0, 0, bitmap.width, bitmap.height).data];
    } finally { bitmap.close(); }
  });
  const avifPng = await stillDownload("still.avif", "image/avif", original.avif);
  assert.deepEqual([...avifPng.data], nativeAvif, "AVIF pixels/alpha must match native orientation-aware decode");
  assert.deepEqual([avifPng.info.width, avifPng.info.height], [2, 2]);
  checks += 2;

  const first = await stillDownload("animated.gif", "image/gif", original.gif);
  const expectedFirst = await sharp(original.gif).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(first.data, expectedFirst.data, "First GIF frame must retain exact alpha/offset pixels");
  assert.deepEqual([first.info.width, first.info.height], [64, 64]);
  assert.match(await page.locator('[data-result-slot="media-metrics"]').innerText(), /4 frame.*100 centesimi.*animazione non esportata/su);
  checks += 3;

  // The separate animated form must keep timing; compare every output frame
  // with independent Pillow oracle, including disposal and explicit alpha matte.
  execFileSync(python, [oracle, "make", scratch], { timeout: 15_000 });
  const animatedSource = await readFile(join(scratch, "disposal-offset-loop.gif"));
  const animated = page.locator("[data-gif-animation-273]");
  await animated.locator('input[type="file"]').setInputFiles({
    name: "disposal-offset-loop.gif", mimeType: "image/gif", buffer: animatedSource,
  });
  await animated.getByRole("button", { name: "Ricrea GIF animata in locale" }).click();
  const result = animated.locator("[data-gif-animation-result]");
  await result.waitFor({ timeout: 30_000 });
  assert.match(await result.innerText(), /6 frame.*10, 20, 30, 40, 50, 20 centesimi/su);
  assert.match(await result.innerText(), /trasparenza.*bianco/su);
  const pending = page.waitForEvent("download");
  await result.getByRole("link", { name: "Scarica GIF animata verificata" }).click();
  const output = await readFile(await (await pending).path());
  assert.equal(output.toString("ascii", 0, 6), "GIF89a");
  const outputPath = join(scratch, "download.gif");
  await writeFile(outputPath, output);
  assert.match(execFileSync(python, [oracle, "compare", join(scratch, "disposal-offset-loop.gif"), outputPath],
    { encoding: "utf8", timeout: 15_000 }), /PILLOW_EXTERNAL_DECODE_PASS/);
  checks += 4;

  // Unsupported input: the UI must refuse to produce a downloadable image.
  await choose.setInputFiles({ name: "forged.avif", mimeType: "image/avif", buffer: Buffer.from("BMinvalid") });
  await page.locator('[data-result-class="image"] a[download$=".png"]').first()
    .waitFor({ state: "hidden" });
  await stillForm.getByRole("button", { name: "Esegui in locale" }).click();
  await stillForm.getByText("L'operazione non è riuscita. Controlla i file e i parametri inseriti.")
    .waitFor({ timeout: 15_000 });
  assert.equal(await page.locator('[data-result-class="image"] a[download]').count(), 0);
  checks += 2;

  // On Linux Chromium commonly lacks HEIC decoding. Confirm its explicit
  // refusal instead of inferring success from the macOS-generated fixture.
  await choose.setInputFiles({ name: "sample.heic", mimeType: "image/heic", buffer: original.heic });
  await stillForm.getByRole("button", { name: "Esegui in locale" }).click();
  const heicLink = page.locator('[data-result-class="image"] a[download$=".png"]').first();
  const heicError = stillForm.getByText("L'operazione non è riuscita. Controlla i file e i parametri inseriti.");
  await Promise.race([heicLink.waitFor({ timeout: 15_000 }), heicError.waitFor({ timeout: 15_000 })]);
  if (await heicLink.count()) {
    const receipt = page.waitForEvent("download");
    await heicLink.click();
    const decoded = await sharp(await readFile(await (await receipt).path())).metadata();
    assert(decoded.width > 0 && decoded.height > 0);
    heicState = "native HEIC still decode PASS; rotation NOT_RUN (fixture lacks certified orientation)";
  } else {
    assert.equal(await page.locator('[data-result-class="image"] a[download]').count(), 0);
    heicState = "native HEIC unavailable; explicit refusal PASS; rotation NOT_RUN";
  }
  checks++;
  assert.deepEqual(escaped, [], "No uploads, offsite requests or non-GET requests");
  assert.deepEqual(pageErrors, [], "No uncaught browser errors");
  checks += 2;
  await context.close();
  for (const [key, path] of Object.entries(fixtures)) {
    assert.equal(fingerprint(await readFile(path)), hashes[key], `${key} source fixture mutated`);
    checks++;
  }
  console.log(`STR-212 BUILT CONSUMER PASS (${checks} checks): GIF animation/timing and first frame/alpha, AVIF native PNG/alpha, codec refusals, input immutable; HEIC ${heicState}; physical mobile NOT_RUN`);
} finally {
  await browser?.close();
  preview.kill("SIGTERM");
  await rm(scratch, { recursive: true, force: true });
}

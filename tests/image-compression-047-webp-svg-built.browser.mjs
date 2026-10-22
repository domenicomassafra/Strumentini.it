/** #81 production-style built route: WebP/JPEG downloads and SVG optimizer with raw/gzip/unsafe guards. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "@playwright/test";
import { gzipSync } from "fflate";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const browserName = process.env.STR_047_BROWSER ?? "chromium";
assert(["chromium", "webkit"].includes(browserName), "Only verified browser engines are supported");
const port = Number(process.env.STR_047_SVG_BUILT_PORT ?? 18583);
const origin = "http://127.0.0.1:" + port;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const width = 96, height = 64;
const rgba = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const at = (y * width + x) * 4;
  rgba[at] = (x * 13 + y * 11) & 255;
  rgba[at + 1] = (x * 7 + y * 3) & 255;
  rgba[at + 2] = (x * 5 + y * 17) & 255;
  rgba[at + 3] = x % 3 === 0 ? 87 : 255;
}
// A small smooth lossless WebP can already fit in tens of bytes, so re-encoding
// may legitimately enlarge it. Use a deterministic, noisy RGB fixture to prove
// this public lossy path can actually reduce bytes while preserving alpha.
const webpRgba = Buffer.from(rgba);
let seed = 0x81_047_047;
for (let at = 0; at < webpRgba.length; at += 4) {
  for (let channel = 0; channel < 3; channel++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    webpRgba[at + channel] = seed & 255;
  }
}
const webpOriginal = await sharp(webpRgba, { raw: { width, height, channels: 4 } }).webp({ lossless: true }).toBuffer();
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">' +
  "\n   ".repeat(125) + '<rect x="0" y="0" width="96" height="64" fill="#00ff00"/></svg>';
async function ready() {
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(origin + "/tools/image-compression/")).ok) return; }
    catch { /* server warmup */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Built route unavailable");
}
let browser;
try {
  await ready();
  browser = await (browserName === "webkit" ? webkit : chromium).launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
  const errors = [], offsite = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", route => {
    if (route.request().url().startsWith(origin) && route.request().method() === "GET") return route.continue();
    offsite.push(route.request().url()); return route.abort();
  });
  assert.equal((await page.goto(origin + "/tools/image-compression/"))?.status(), 200);
  await page.locator("[data-image-compression-hydration-gate]:not([disabled])").waitFor();
  const form = page.locator("form").filter({ has: page.locator("[data-png-lossless-47]") });
  assert.equal(await form.count(), 1);
  // The public PNG IDAT path must also result in a real, byte-exact browser download.
  const pngOriginal = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 0, palette: false }).toBuffer();
  await form.locator("[data-png-lossless-47] input").check();
  await form.locator('input[type="file"]').setInputFiles({
    name: "alpha.png", mimeType: "image/png", buffer: pngOriginal,
  });
  await form.getByRole("button", { name: "Esegui in locale" }).click();
  await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 30000 });
  const savingPng = page.waitForEvent("download");
  await page.locator('[data-result-class="image"] a[download]').first().click();
  const pngDownload = await savingPng;
  assert.equal(pngDownload.suggestedFilename(), "alpha-idat-lossless.png");
  const pngBytes = await readFile(await pngDownload.path());
  assert.equal((await sharp(pngBytes).metadata()).format, "png");
  assert(pngBytes.length < pngOriginal.length, "IDAT did not reduce test PNG");
  assert.deepEqual(
    await sharp(pngBytes).ensureAlpha().raw().toBuffer(),
    await sharp(pngOriginal).ensureAlpha().raw().toBuffer(),
    "Public PNG IDAT download changed pixel or alpha",
  );
  await form.locator("[data-png-lossless-47] input").uncheck();

  await form.getByLabel("Formato di uscita").selectOption("image/webp");
  await form.getByLabel("Qualità, se supportata").fill("0.6");
  await form.locator('input[type="file"]').setInputFiles({ name: "alpha.webp", mimeType: "image/webp", buffer: webpOriginal });
  await form.getByRole("button", { name: "Esegui in locale" }).click();
  const webpState = await Promise.race([
    page.locator(".result-panel[data-state='success']").waitFor({ timeout: 30000 }).then(() => "success"),
    page.locator(".result-panel[data-state='error']").waitFor({ timeout: 30000 }).then(() => "error"),
  ]);
  let webpSummary;
  if (webpState === "error") {
    assert.equal(browserName, "webkit", "Chromium must encode the supported WebP output");
    const message = await page.locator(".result-panel[data-state='error']").innerText();
    assert.match(message, /ENCODE_FAILED|OUTPUT_VALIDATION_FAILED|could not encode|expected image\/webp/iu);
    assert.equal(await page.locator('[data-result-class="image"] a[download]').count(), 0, "Unsupported WebP must not download a mislabeled PNG");
    webpSummary = "WebKit WebP unsupported: explicit refusal and no download";
  } else {
    const savingWebp = page.waitForEvent("download");
    await page.locator('[data-result-class="image"] a[download]').first().click();
    const webpDownload = await savingWebp;
    assert.equal(webpDownload.suggestedFilename(), "alpha-compressed.webp");
    const webpBytes = await readFile(await webpDownload.path());
    assert(webpBytes.length < webpOriginal.length, "Lossy WebP did not shrink the noisy lossless fixture");
    assert.equal(webpBytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(webpBytes.toString("ascii", 8, 12), "WEBP");
    assert.equal(webpBytes.readUInt32LE(4) + 8, webpBytes.length);
    const chunks = [];
    for (let at = 12; at + 8 <= webpBytes.length;) {
      const count = webpBytes.readUInt32LE(at + 4);
      assert(count <= webpBytes.length - at - 8);
      chunks.push(webpBytes.toString("ascii", at, at + 4));
      at += 8 + count + (count & 1);
    }
    assert(chunks.includes("VP8 "), "Browser WebP lossy output is not VP8");
    assert(!chunks.includes("VP8L"), "Browser returned unchanged lossless subtype");
    assert.equal((await sharp(webpBytes).metadata()).format, "webp");
    const expectedAlpha = await sharp(webpOriginal).ensureAlpha().raw().toBuffer();
    const actualAlpha = await sharp(webpBytes).ensureAlpha().raw().toBuffer();
    assert.equal(actualAlpha.length, expectedAlpha.length);
    for (let i = 3; i < actualAlpha.length; i += 4) {
      assert.equal(actualAlpha[i], expectedAlpha[i], "WebP alpha changed at pixel " + i / 4);
    }
    webpSummary = `WebP VP8 download ${webpOriginal.length}→${webpBytes.length} B with Sharp/RIFF/alpha`;
  }

  const svgForm = page.locator("[data-svg-compression-47] form");
  await svgForm.locator('input[type="file"]').setInputFiles({ name: "square.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) });
  await svgForm.getByRole("button", { name: "Ottimizza e verifica SVG" }).click();
  await page.locator('[data-svg-optimized="true"]').waitFor({ timeout: 30000 });
  const previews = await page.locator('[data-svg-optimized="true"] img').evaluateAll(images => images.map(img => img.complete && img.naturalWidth > 0));
  assert.deepEqual(previews, [true, true], "Original/optimized previews failed");
  const saveSvg = page.waitForEvent("download");
  await page.getByRole("link", { name: "Scarica SVG ottimizzato" }).click();
  const svgDownload = await saveSvg;
  assert.equal(svgDownload.suggestedFilename(), "square-ottimizzato.svg");
  const svgOutput = await readFile(await svgDownload.path());
  assert(svgOutput.length < Buffer.byteLength(svg));
  assert.match(svgOutput.toString("utf8"), /^<svg\b/u);
  // SVG UI reports fflate's actual gzip payload bytes, not zlib's potentially
  // different output size for the same uncompressed bytes.
  const gzipOriginal = gzipSync(Buffer.from(svg), { level: 9 }).length;
  const gzipOutput = gzipSync(svgOutput, { level: 9 }).length;
  const details = await page.locator('[data-svg-optimized="true"]').innerText();
  assert(details.includes(`${Buffer.byteLength(svg)} byte · gzip ${gzipOriginal} byte`), "Incorrect original gzip byte count");
  assert(details.includes(`${svgOutput.length} byte · gzip ${gzipOutput} byte`), "Incorrect output gzip byte count");
  const opened = await sharp(svgOutput).metadata();
  assert.deepEqual([opened.width, opened.height], [96, 64]);
  await svgForm.locator('input[type="file"]').setInputFiles({ name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>') });
  await svgForm.getByRole("button", { name: "Ottimizza e verifica SVG" }).click();
  await page.locator('[data-svg-compression-47] [role="alert"]').waitFor({ timeout: 30000 });
  assert.equal(await page.locator('[data-svg-optimized="true"]').count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(offsite, []);
  console.log("PASS #81 " + browserName + " built PNG IDAT download " + pngOriginal.length + "→" + pngBytes.length + " B exact; " + webpSummary + "; SVG raw " + Buffer.byteLength(svg) + "→" + svgOutput.length + " B; gzip " + gzipOriginal + "→" + gzipOutput + " B, two previews, Sharp reopen, unsafe reject, zero offsite requests");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

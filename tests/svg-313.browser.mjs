// Execute after Astro static build. One Playwright desktop engine per process,
// e.g. STRUMENTINI_SVG_BROWSER=firefox node tests/svg-313.browser.mjs.
import { chromium, firefox, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";

const root = resolve(import.meta.dirname, "..");
const engineName = process.env.STRUMENTINI_SVG_BROWSER ?? "chromium";
const engines = { chromium, firefox, webkit };
if (!Object.hasOwn(engines, engineName)) throw new Error(`Unknown SVG test browser: ${engineName}`);
const port = Number(process.env.STRUMENTINI_SVG_PORT ?? 18476);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const receiptDir = resolve(root, "tests/svg-313-receipts");
let browser;
let checks = 0;
const outputEvidence = [];
const pageErrors = [];

async function awaitServer() {
  for (let attempt = 0; attempt < 70; attempt++) {
    try { if ((await fetch(origin)).ok) return; } catch { /* starting */ }
    await new Promise((done) => setTimeout(done, 125));
  }
  throw new Error("Cannot serve static SVG conversion route");
}

try {
  await awaitServer();
  // No parallel windows/processes: cross-engine runs are issued sequentially.
  browser = await engines[engineName].launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const offsite = [];
  const browserWebpEncoderMime = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 3;
    canvas.height = 2;
    canvas.getContext("2d").fillRect(0, 0, 3, 2);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/webp", 0.8));
    return blob?.type ?? null;
  });
  assert(["image/webp", "image/png", null].includes(browserWebpEncoderMime));
  page.on("request", (req) => {
    if (!req.url().startsWith(origin) && !req.url().startsWith("blob:") && !req.url().startsWith("data:")) offsite.push(req.url());
  });
  page.on("pageerror", (err) => { pageErrors.push(err.message); });
  const response = await page.goto(`${origin}/tools/image-format-conversion/`, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.locator("input[type=file]").setInputFiles(resolve(root, "tests/svg-313-safe.svg"));
  await page.locator("[data-svg-export-options]").waitFor();
  checks += 2;
  await page.getByLabel("Larghezza viewport SVG (px)").fill("150");
  await page.getByLabel("Altezza viewport SVG (px)").fill("100");
  await page.getByLabel("Scala raster (0,1–4)").fill("2");

  for (const format of [
    { mime: "image/png", ext: "png" },
    { mime: "image/jpeg", ext: "jpg" },
    { mime: "image/webp", ext: "webp" },
    { mime: "application/pdf", ext: "pdf" },
  ]) {
    await page.getByLabel("Formato di uscita").selectOption(format.mime);
    if (format.mime === "image/jpeg") {
      await page.getByLabel("Colore di sfondo esplicito per rasterizzazione").fill("#00ff00");
    }
    await page.getByRole("button", { name: /Esegui in locale/u }).click();
    if (format.mime === "image/webp" && browserWebpEncoderMime !== "image/webp") {
      // The browser itself has no native WebP encoder. A PNG with .webp
      // extension is NOT acceptable; the safe expected behavior is refusal.
      await page.locator('[role="alert"]').first().waitFor({ timeout: 10000 });
      assert.equal(await page.locator("[data-result-class=image]").count(), 0);
      assert.equal(await page.getByRole("link", { name: /Scarica .*svg-raster\.webp/u }).count(), 0);
      outputEvidence.push({
        mime: format.mime,
        outcome: "EXPECTED_REJECTED_UNSUPPORTED_ENCODER",
        nativeCanvasReturnedMime: browserWebpEncoderMime,
        downloadOffered: false,
      });
      checks += 5;
      continue;
    }
    try {
      await page.locator("[data-result-class=image]").waitFor({ timeout: 15000 });
    } catch (error) {
      console.error("SVG export diagnostic", {
        engine: engineName,
        format: format.mime,
        alerts: await page.locator('[role="alert"]').allTextContents(),
        pageErrors,
        offsite,
        state: (await page.locator("form").first().innerText()).slice(-800),
      });
      throw error;
    }
    const download = page.getByRole("link", { name: /Scarica .*svg-raster/u }).first();
    await download.waitFor();
    const pending = page.waitForEvent("download");
    await download.click();
    const saved = await pending;
    assert(saved.suggestedFilename().endsWith(`.${format.ext}`));
    const bytes = new Uint8Array(await readFile(await saved.path()));
    outputEvidence.push({ mime: format.mime, outcome: "VERIFIED_DOWNLOAD", filename: saved.suggestedFilename(), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    if (format.mime === "image/png") {
      assert.deepEqual(Array.from(bytes.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
      const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      assert.equal(header.getUint32(16), 300);
      assert.equal(header.getUint32(20), 200);
    } else if (format.mime === "image/jpeg") {
      assert.equal(bytes[0], 0xff);
      assert.equal(bytes[1], 0xd8);
      assert.equal(bytes.at(-1), 0xd9);
      const background = await page.evaluate(async (raw) => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(raw)], { type: "image/jpeg" }));
        try {
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width; canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(bitmap, 0, 0);
          return Array.from(ctx.getImageData(290, 190, 1, 1).data);
        } finally { bitmap.close(); }
      }, Array.from(bytes));
      assert(background[1] > 220 && background[0] < 50 && background[2] < 50, "JPEG exported with explicit green background");
      checks++;
    } else if (format.mime === "image/webp") {
      assert.equal(new TextDecoder().decode(bytes.subarray(0, 4)), "RIFF");
      assert.equal(new TextDecoder().decode(bytes.subarray(8, 12)), "WEBP");
    } else {
      const pdf = new TextDecoder("latin1").decode(bytes);
      assert(pdf.startsWith("%PDF-1.4"));
      assert(pdf.includes("/MediaBox [0 0 300 200]"));
      assert(pdf.includes("/DCTDecode"));
      assert(pdf.includes("/Subtype /Image"));
      assert(!pdf.includes("/Font") && !pdf.includes("/ToUnicode"), "PDF must be raster-only");
      assert(pdf.trimEnd().endsWith("%%EOF"));
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const loading = getDocument({ data: Uint8Array.from(bytes), useSystemFonts: false });
      const parsed = await loading.promise;
      try {
        assert.equal(parsed.numPages, 1);
        const first = await parsed.getPage(1);
        assert.equal(first.getViewport({ scale: 1 }).width, 300);
        assert.equal(first.getViewport({ scale: 1 }).height, 200);
      } finally { await loading.destroy(); }
      assert.match(await page.locator("[data-result-class=image]").innerText(), /non vettoriale/iu);
      checks += 3;
    }
    checks += 5;
  }

  // Measure actual pixels on the successful PNG as independent browser reopen.
  await page.getByLabel("Formato di uscita").selectOption("image/png");
  await page.getByRole("button", { name: /Esegui in locale/u }).click();
  const preview = page.locator('[data-result-slot="visual-preview"] img');
  await preview.waitFor();
  const colors = await preview.evaluate(async (img) => {
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return { size: [canvas.width, canvas.height], red: Array.from(ctx.getImageData(40, 40, 1, 1).data), blue: Array.from(ctx.getImageData(225, 100, 1, 1).data), transparent: Array.from(ctx.getImageData(290, 190, 1, 1).data) };
  });
  assert.deepEqual(colors.size, [300, 200]);
  assert.deepEqual(colors.red.slice(0, 3), [255, 0, 0]);
  assert.deepEqual(colors.blue.slice(0, 3), [0, 0, 255]);
  assert.equal(colors.transparent[3], 0, "PNG alpha outside SVG shapes stays transparent");
  checks += 4;
  await mkdir(receiptDir, { recursive: true });
  await page.locator("[data-result-class=image]").screenshot({ path: resolve(receiptDir, `${engineName}-png-result.png`) });

  const attacks = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5" onload="alert(1)"><rect width="5" height="5"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"><foreignObject width="5" height="5"><div>bad</div></foreignObject></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"><style>@import url(https://invalid.example/evil.css)</style></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"><rect width="5" height="5" style="fill:red"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"><rect width="5" height="5" fill="url(https://invalid.example/img)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"><image href="https://invalid.example/a.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"><use href="#safe"/></svg>',
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5">&xxe;</svg>',
    '<?xml-stylesheet href="https://invalid.example/main.css"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 5 5"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"><animate attributeName="fill" from="red" to="blue" dur="1s"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"><rect width="5" height="5" fill="data:image/png;base64,AQID"/></svg>',
  ];
  for (const [index, malicious] of attacks.entries()) {
    await page.locator("input[type=file]").setInputFiles({ name: `attack-${index}.svg`, mimeType: "image/svg+xml", buffer: Buffer.from(malicious) });
    await page.getByRole("button", { name: /Esegui in locale/u }).click();
    await page.locator('[role="alert"]').first().waitFor();
    assert.equal(await page.locator("[data-result-class=image]").count(), 0, "Malicious SVG must never create a result");
    checks++;
  }
  assert.deepEqual(offsite, [], "No requests to script/CSS/image remote origins");
  assert.deepEqual(pageErrors, [], "No unhandled browser page errors");
  checks++;
  const receipt = {
    ticket: 313,
    scope: "bounded-static-svg-subset",
    browserEngine: engineName,
    browserVersion: browser.version(),
    viewport: { width: 390, height: 844 },
    deviceClass: "desktop-headless-viewport-emulation",
    checks,
    result: "PASS",
    exports: outputEvidence,
    webpCapability: {
      nativeCanvasEncodedMime: browserWebpEncoderMime,
      supportsActualWebpOutput: browserWebpEncoderMime === "image/webp",
      fallbackPolicy: "reject without download; never relabel PNG as WebP",
    },
    pdf: "single-page JPEG /DCTDecode PDF.js-reopened",
    security: { hostileSvgFilesRejected: attacks.length, offsiteRequests: offsite.length, pageErrors: pageErrors.length },
    pixelChecks: { pngSize: colors.size, opaqueRed: colors.red, opaqueBlue: colors.blue, transparentPixel: colors.transparent, jpegBackground: "#00ff00" },
    screenshot: `${engineName}-png-result.png`,
    limitations: [
      "not a physical-device test",
      "not arbitrary/advanced SVG support",
      "not a Gold certification",
      ...(browserWebpEncoderMime === "image/webp" ? [] : ["WebP export unavailable in this browser; expected refusal is tested, not a WebP success"]),
    ],
  };
  await writeFile(resolve(receiptDir, `${engineName}.json`), JSON.stringify(receipt, null, 2) + "\n");
  console.log(`STR-313 SVG static ${engineName} browser acceptance: PASS (${checks} checks) · receipt tests/svg-313-receipts/${engineName}.json`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

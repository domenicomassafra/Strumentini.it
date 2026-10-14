/** #212: a genuine 4-frame AVIF sequence must not silently become a still PNG.
 * Run: node tests/image-directional-212-20261014-animated-avif.browser.mjs
 * Needs the installed ffmpeg/ffprobe to author/independently inspect the AV1
 * sequence; no checked-in media, remote requests, or production route changes.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { build } from "esbuild";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const dir = await mkdtemp(join(tmpdir(), "str-212-avif-"));
const sequencePath = join(dir, "real-4-frame.avif");
let server;
try {
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
    "-i", "testsrc2=size=32x24:rate=2:duration=2",
    "-frames:v", "4", "-c:v", "libsvtav1", "-preset", "11", "-crf", "48",
    "-f", "avif", sequencePath,
  ], { stdio: "pipe", timeout: 30_000 });
  const declared = JSON.parse(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height,nb_frames",
    "-of", "json", sequencePath,
  ], { encoding: "utf8", timeout: 10_000 }));
  assert(declared.streams.some(s => s.codec_name === "av1" && s.width === 32 && s.height === 24 && s.nb_frames === "4"),
    "Independent ffprobe must confirm an actual 4-frame AV1 image sequence");
  assert.equal(declared.format.duration, "2.000000");
  const sequence = await readFile(sequencePath);
  assert.equal(sequence.toString("ascii", 4, 8), "ftyp");
  assert.equal(sequence.toString("ascii", 8, 12), "avis"); // genuine sequence brand
  assert.equal(sequence.toString("ascii", 16, 20), "avis"); // compatible sequence brand
  const staticAvif = await readFile(resolve(root, "quality/fixtures/image-format-matrix/source.avif"));
  const staticPixels = await sharp(staticAvif).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(staticPixels.info.width, 2);
  assert.equal(staticPixels.info.height, 2);

  const { outputFiles } = await build({
    stdin: {
      contents: 'import { identifyPortableImage } from "./src/engines/image/portable-decode.ts"; import { convertImageFormatLocal } from "./src/engines/image/visual-tools.ts"; import { probeAvifDecode212 } from "./src/engines/image/directional-212.ts"; window.image212 = { identifyPortableImage, convertImageFormatLocal, probeAvifDecode212 };',
      loader: "ts", resolveDir: root,
    },
    bundle: true, platform: "browser", format: "iife", target: "es2022", write: false,
  });
  server = createServer((req, res) => {
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; img-src blob:; connect-src 'none'; object-src 'none'; base-uri 'none'");
    if (req.url === "/") return res.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><script src="/app.js"></script>');
    if (req.url === "/app.js") return res.writeHead(200, { "content-type": "text/javascript" }).end(outputFiles[0].text);
    res.writeHead(404).end();
  });
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
  const origin = `http://127.0.0.1:${server.address().port}`;

  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const unexpectedRequests = [], pageErrors = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      await page.route("**/*", route => {
        if (route.request().method() === "GET" && route.request().url().startsWith(origin + "/")) return route.continue();
        unexpectedRequests.push(`${route.request().method()} ${route.request().url()}`);
        return route.abort();
      });
      await page.goto(origin);
      const result = await page.evaluate(async ({ sequence, still }) => {
        const animatedBytes = Uint8Array.from(sequence);
        const animated = new File([animatedBytes], "four-frames.avif", { type: "image/avif" });
        const native = await createImageBitmap(animated);
        const nativeSize = [native.width, native.height];
        native.close(); // Real Chromium/Firefox/WebKit decoder can open this AV1 sequence.
        const isolated = await window.image212.probeAvifDecode212(animated);
        let identificationError = null;
        try { window.image212.identifyPortableImage(animatedBytes, animated); }
        catch (error) { identificationError = String(error); }
        const compatibleSequence = animatedBytes.slice();
        compatibleSequence.set([97, 118, 105, 102], 8); // major 'avif'; compatible 'avis' remains.
        let compatibleBrandError = null;
        try { window.image212.identifyPortableImage(compatibleSequence, animated); }
        catch (error) { compatibleBrandError = String(error); }
        const malformedFtyp = animatedBytes.slice();
        malformedFtyp.set([0, 0, 16, 0], 0); // ftyp claims more than the inspected bytes.
        let incompleteBrandError = null;
        try { window.image212.identifyPortableImage(malformedFtyp, animated); }
        catch (error) { incompleteBrandError = String(error); }
        let conversionError = null;
        try { await window.image212.convertImageFormatLocal({ file: animated, mime: "image/png" }); }
        catch (error) { conversionError = String(error); }
        const stillBytes = Uint8Array.from(still);
        const stillFile = new File([stillBytes], "source.avif", { type: "image/avif" });
        const stillIdentified = window.image212.identifyPortableImage(stillBytes, stillFile);
        const saved = await window.image212.convertImageFormatLocal({ file: stillFile, mime: "image/png" });
        const canvasPixels = async blob => {
          const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
          try {
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(bitmap, 0, 0);
            return [...ctx.getImageData(0, 0, bitmap.width, bitmap.height).data];
          } finally { bitmap.close(); }
        };
        return {
          nativeSize, isolated,
          identificationError, compatibleBrandError, incompleteBrandError, conversionError,
          stillIdentified, stillOutput: [...new Uint8Array(await saved.blob.arrayBuffer())],
          stillKind: saved.inputKind, stillPolicy: saved.framePolicy,
          nativeStillPixels: await canvasPixels(stillFile),
          nativeSavedPixels: await canvasPixels(saved.blob),
        };
      }, { sequence: [...sequence], still: [...staticAvif] });
      assert.deepEqual(result.nativeSize, [32, 24], `${name}: real AVIF sequence native decode`);
      assert.equal(result.isolated.runtimeDecodeSupported, false);
      assert.match(result.isolated.reason, /sequence unsupported/u);
      assert.match(result.identificationError ?? "", /UNSUPPORTED_AVIF_SEQUENCE/u,
        `${name}: actual 4-frame AVIF was identified as a still image`);
      assert.match(result.compatibleBrandError ?? "", /UNSUPPORTED_AVIF_SEQUENCE/u,
        `${name}: compatible sequence brand was ignored when major brand was avif`);
      assert.match(result.incompleteBrandError ?? "", /UNVERIFIED_BMFF_BRANDS/u,
        `${name}: malformed oversized ftyp could conceal a sequence brand`);
      assert.match(result.conversionError ?? "", /UNSUPPORTED_AVIF_SEQUENCE/u,
        `${name}: public converter silently discarded the animation`);
      assert.deepEqual(result.stillIdentified, {
        kind: "avif", mime: "image/avif", framePolicy: "single-image", decoder: "browser",
      });
      assert.equal(result.stillKind, "avif");
      assert.equal(result.stillPolicy, "single-image");
      assert.deepEqual(result.nativeSavedPixels, result.nativeStillPixels,
        `${name}: genuine still AVIF output must equal this browser's decoded RGBA`);
      const staticOutput = Buffer.from(result.stillOutput);
      assert.deepEqual([...staticOutput.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      const reopened = await sharp(staticOutput).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([reopened.info.width, reopened.info.height], [2, 2]);
      for (let at = 0; at < reopened.data.length; at++) {
        assert.equal(reopened.data[at], result.nativeSavedPixels[at],
          `${name}: independent Sharp PNG decoder agrees with browser output at byte ${at}`);
      }
      assert.deepEqual(unexpectedRequests, [], `${name}: no uploads/offsite network`);
      assert.deepEqual(pageErrors, [], `${name}: no uncaught JS errors`);
      console.log(`PASS #212 ${name}: genuine 4-frame AVIF refused, genuine still AVIF -> PNG independently Sharp-decoded`);
    } finally { await browser.close(); }
  }
} finally {
  if (server) await new Promise((ok, fail) => server.close(error => error ? fail(error) : ok()));
  await rm(dir, { recursive: true, force: true });
}

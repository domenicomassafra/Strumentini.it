/** #246: real APNG may display different frames while local OCR silently reads
 * a still. Generate a two-frame Italian corpus variant, check actual decoder
 * frames with Pillow, and run the real local Tesseract worker in Chromium.
 * No added model/assets, remote service, mocked OCR text, or production claim.
 * Run: node tests/ocr-246-20261014-apng.browser.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const originalBytes = await readFile(join(root, "spikes/heavy-local-feasibility/public/corpus/ocr-it.png"));
assert.equal(createHash("sha256").update(originalBytes).digest("hex"),
  "1bfc71b54560679f6b6d0e8f978201b2ca27fdfcd84d47ef9344d41db0a2f27b");
const temp = await mkdtemp(join(tmpdir(), "strumentini-ocr246-apng-"));
const animatedFile = join(temp, "original-invoice-then-empty.png");
const script = [
  "import sys, json, io",
  "from PIL import Image",
  "with Image.open(sys.argv[1]) as src:",
  "  first = src.convert('RGB')",
  "second = Image.new('RGB', first.size, 'white')",
  "first.save(sys.argv[2], format='PNG', save_all=True, append_images=[second], duration=[400,400], loop=0, disposal=0, blend=0)",
  "with Image.open(sys.argv[2]) as out:",
  "  assert out.n_frames == 2, out.n_frames",
  "  out.seek(0)",
  "  first_rgba = out.convert('RGBA').tobytes()",
  "  out.seek(1)",
  "  second_rgba = out.convert('RGBA').tobytes()",
  "  assert first_rgba != second_rgba",
  "  assert all(byte == 255 for byte in second_rgba)",
  "  print(json.dumps({'frames':out.n_frames,'width':out.width,'height':out.height}))",
].join("\n");
let server;
try {
  const pillow = spawnSync("python3", ["-c", script,
    join(root, "spikes/heavy-local-feasibility/public/corpus/ocr-it.png"), animatedFile],
  { encoding: "utf8", timeout: 20_000 });
  assert.equal(pillow.status, 0, pillow.stderr || "Pillow APNG generation failed");
  assert.deepEqual(JSON.parse(pillow.stdout), { frames: 2, width: 1280, height: 240 });
  const animatedBytes = await readFile(animatedFile);
  assert.equal(animatedBytes.includes(Buffer.from("acTL")), true);
  assert.equal(animatedBytes.includes(Buffer.from("fcTL")), true);
  assert(animatedBytes.length < 5 * 1024 * 1024);

  const { outputFiles } = await build({
    stdin: {
      contents: 'import { recognizeLocalItalianOcr246 } from "./src/engines/ocr/local-italian-246.ts"; window.ocr246 = recognizeLocalItalianOcr246;',
      resolveDir: root, loader: "ts",
    },
    bundle: true, write: false, platform: "browser", format: "iife", target: "es2022",
  });
  const outputJS = outputFiles[0].text;
  server = createServer(async (req, res) => {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Security-Policy",
        "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' blob: data:; object-src 'none'; base-uri 'none'");
      if (req.url === "/") return res.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><script src="/engine.js"></script>');
      if (req.url === "/engine.js") return res.writeHead(200, { "content-type": "text/javascript" }).end(outputJS);
      if (!req.url?.startsWith("/ocr-246/") || req.url.includes("..")) return res.writeHead(404).end();
      const local = join(root, "public", req.url);
      const data = await readFile(local);
      const mime = local.endsWith(".wasm") ? "application/wasm" :
        local.endsWith(".js") || local.endsWith(".mjs") ? "text/javascript" :
        local.endsWith(".gz") ? "application/gzip" : "application/octet-stream";
      res.writeHead(200, { "content-type": mime }).end(data);
    } catch (error) {
      res.writeHead(404).end(String(error));
    }
  });
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [name, browserType] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await browserType.launch({ headless: true });
    try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const seen = [], forbidden = [], errors = [];
    page.on("request", request => seen.push(request.url()));
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      if (route.request().url().startsWith(origin + "/") && route.request().method() === "GET") return route.continue();
      forbidden.push(`${route.request().method()} ${route.request().url()}`);
      return route.abort();
    });
    await page.goto(origin);
    const apng = await page.evaluate(async arr => {
      const source = new File([Uint8Array.from(arr)], "documento-animato.png", { type: "image/png" });
      const bitmap = await createImageBitmap(source);
      const native = [bitmap.width, bitmap.height];
      bitmap.close();
      try {
        const output = await window.ocr246(source, { timeoutMs: 60_000 });
        return { native, text: output.text, confidence: output.confidence };
      } catch (error) { return { native, error: String(error) }; }
    }, [...animatedBytes]);
    assert.deepEqual(apng.native, [1280, 240], "the real browser can display the APNG while using its first frame for bitmap creation");
    assert.match(apng.error ?? "", /OCR246_ANIMATED_PNG_UNSUPPORTED/u,
      `animated invoice still received an OCR artifact: ${JSON.stringify(apng)}`);
    assert.equal(seen.filter(url => url.includes("/ocr-246/")).length, 0,
      "unsupported APNG must be refused before downloading the Italian OCR worker, WASM, or model");
    // One real OCR run, in Chromium, proves the supported 1280x240 Italian
    // control remains functional with the actual local worker/model. The other
    // engines are checked for APNG refusal before any heavy allocation.
    if (name === "chromium") {
      const still = await page.evaluate(async arr => {
        const image = new File([Uint8Array.from(arr)], "fattura.png", { type: "image/png" });
        const output = await window.ocr246(image, { timeoutMs: 90_000 });
        return { text: output.text, confidence: output.confidence, origin: output.source, bytes: output.image.bytes };
      }, [...originalBytes]);
      assert.equal(still.text, "Fattura numero 12345 - Totale euro 678,90");
      assert.equal(still.bytes, originalBytes.length);
      assert.equal(still.origin, "UPLOADED_IMAGE_LOCAL_ONLY");
      assert(Number.isFinite(still.confidence), "real Tesseract confidence exists but is uncalibrated");
      assert(seen.some(url => url.includes("ita.traineddata.gz")), "real Italian OCR model loaded lazily after supported input");
      assert(seen.some(url => url.includes("tesseract-core") && url.includes(".wasm")), "real WASM core loaded same-origin");
    }
    assert.deepEqual(forbidden, [], "no offsite/upload/network fallback");
    assert.deepEqual(errors, [], "no uncaught browser JS exceptions");
    console.log(`PASS #246 ${name}: Pillow real 2-frame APNG refused before OCR assets, no offsite requests${name === "chromium" ? "; SHA-pinned still invoice recognized exactly via local Tesseract.js" : ""}`);
    } finally { await browser.close(); }
  }
} finally {
  if (server) await new Promise((ok, fail) => server.close(err => err ? fail(err) : ok()));
  await rm(temp, { recursive: true, force: true });
}

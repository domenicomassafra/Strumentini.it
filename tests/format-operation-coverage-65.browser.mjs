/** #65: browser execution of every implemented image/PDF direction.
 * Uses the real engines and binary corpus; outputs can be inspected with --write.
 * Run `node tests/format-operation-coverage-65.browser.mjs` for fresh CI evidence.
 */
import { strict as assert } from "node:assert";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const originals = await Promise.all(["source.jpg", "source.png", "source.avif", "source.heic", "source.gif"]
  .map((name) => readFile(resolve(root, "quality/fixtures/image-format-matrix", name))));
const sourcePdf = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-2page.pdf"));
const registry = JSON.parse(await readFile(resolve(root, "quality/format-operations/registry.json"), "utf8"));
const rows = new Map(registry.map((row) => [row.id, row]));
const port = 18265;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--force"],
  { cwd: root, stdio: "ignore" });

function matchingSignature(mime, signature) {
  if (mime === "image/jpeg") return signature[0] === 255 && signature[1] === 216 && signature[2] === 255;
  if (mime === "image/png") return signature.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (mime === "image/webp") return String.fromCharCode(...signature.slice(0, 4)) === "RIFF" && String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
  if (mime === "application/pdf") return String.fromCharCode(...signature.slice(0, 5)) === "%PDF-";
  return false;
}

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error("Astro server exited before acceptance started");
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 125));
  }
  assert(ready, "Astro localhost server did not start");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (line) => { if (line.text().startsWith("FORMAT65")) console.log(line.text()); });
  page.on("pageerror", (error) => console.error("FORMAT65 browser error:", error.message));
  const badRequests = [];
  page.on("request", (request) => { if (!request.url().startsWith(origin) && !request.url().startsWith(`blob:${origin}/`)) badRequests.push(request.url()); });
  assert.equal((await page.goto(origin))?.status(), 200);
  const observations = await page.evaluate(async ({ buffers, pdf }) => {
    const image = await import("/src/engines/image/visual-tools.ts");
    const toPdf = (await import("/src/tools/images-to-pdf/module.ts")).default;
    const fromPdf = (await import("/src/tools/pdf-to-images/module.ts")).default;
    const pdfEngine = await import("/src/engines/pdf/index.ts");
    const bytes = (index) => Uint8Array.from(buffers[index]);
    const make = (blobBytes, name, mime) => new File([blobBytes], name, { type: mime });
    const png = make(bytes(1), "fixture.png", "image/png");
    const canvas = document.createElement("canvas");
    const bitmap = await createImageBitmap(png);
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();
    const webp = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("WebP source encode failed")), "image/webp", 0.9));
    if (webp.type !== "image/webp") throw new Error("Browser has no truthful WebP input codec");
    const inputs = {
      jpeg: make(bytes(0), "fixture.jpg", "image/jpeg"), png,
      webp: make(webp, "fixture.webp", "image/webp"),
      avif: make(bytes(2), "fixture.avif", "image/avif"),
      heic: make(bytes(3), "fixture.heic", "image/heic"),
      gif: make(bytes(4), "fixture.gif", "image/gif"),
    };
    const results = [];
    const observe = async (id, inputBytes, mime, output, extra = {}) => {
      const actual = new Uint8Array(await output.arrayBuffer());
      const bitmap = mime.startsWith("image/") ? await createImageBitmap(output) : null;
      const result = { id, inputBytes, outputBytes: actual.byteLength, mime,
        signature: Array.from(actual.subarray(0, 12)),
        reopen: bitmap ? { method: "browser createImageBitmap", width: bitmap.width, height: bitmap.height }
          : { method: "PDF parser", pageCount: extra.pageCount },
        ...extra };
      bitmap?.close();
      results.push(result);
      console.log("FORMAT65 " + id + " " + String(actual.byteLength));
    };
    const rasterDirections = [
      ["jpeg", "png"], ["jpeg", "webp"], ["png", "jpeg"], ["png", "webp"],
      ["webp", "jpeg"], ["webp", "png"], ["avif", "jpeg"], ["avif", "png"],
      ["avif", "webp"], ["heic", "jpeg"], ["heic", "png"], ["heic", "webp"],
      ["gif", "png"], ["gif", "jpeg"], ["gif", "webp"],
    ];
    const mime = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
    for (const [from, to] of rasterDirections) {
      const input = inputs[from];
      const transformed = await image.convertImageFormatLocal({ file: input, mime: mime[to], quality: 0.9, background: "#ffffff" });
      await observe(from === "gif" ? "convert-gif-static-raster" : `convert-${from}-${to}`,
        input.size, mime[to], transformed.blob,
        { decoder: transformed.decoder, framePolicy: transformed.framePolicy, alphaPolicy: transformed.alphaPolicy });
    }
    for (const from of ["jpeg", "png", "webp", "avif", "heic"]) {
      const input = inputs[from];
      const converted = await toPdf.run({ files: [input], quality: 0.9, background: "#ffffff", pageSize: "a4" }, { defaults: {} });
      const artifact = converted.artifacts[0];
      const parsed = pdfEngine.inspectPdfBytes(artifact.bytes);
      await observe(`convert-${from}-pdf`, input.size, "application/pdf", artifact.blob,
        { pageCount: parsed.pageCount, embeddedAs: converted.conversions[0]?.embeddedAs,
          framePolicy: converted.conversions[0]?.framePolicy, alphaPolicy: converted.conversions[0]?.alphaPolicy });
    }
    const pdfFile = make(Uint8Array.from(pdf), "two-pages.pdf", "application/pdf");
    for (const to of ["jpeg", "png", "webp"]) {
      const converted = await fromPdf.run({ file: pdfFile, pages: [1], mime: mime[to], scale: 1, quality: 0.9 }, { defaults: {} });
      const artifact = converted.artifacts.find((item) => item.mime === mime[to]);
      if (!artifact) throw new Error("Missing PDF raster output: " + to);
      await observe(`convert-pdf-${to}`, pdfFile.size, mime[to], artifact.blob,
        { renderer: converted.renderer, selectedPages: converted.selectedPages });
    }
    return results;
  }, { buffers: originals.map((buffer) => Array.from(buffer)), pdf: Array.from(sourcePdf) });

  assert.equal(badRequests.length, 0, `Unexpected external requests: ${badRequests.join(", ")}`);
  assert.equal(observations.length, 23);
  for (const observation of observations) {
    const row = rows.get(observation.id);
    assert(row && row.state === "IMPLEMENT", `Unclassified or unimplemented direction: ${observation.id}`);
    assert(row.outputFormats.includes(observation.mime), `${observation.id} output MIME contradicts registry`);
    assert(observation.inputBytes > 0 && observation.outputBytes > 0, `${observation.id} missing actual byte measurements`);
    assert(matchingSignature(observation.mime, observation.signature), `${observation.id} output signature does not match MIME`);
    if (observation.mime === "application/pdf") assert.equal(observation.reopen.pageCount, 1, observation.id);
    else assert(observation.reopen.width > 0 && observation.reopen.height > 0, `${observation.id} undecodable output`);
    if (observation.id === "convert-gif-static-raster") assert.equal(observation.framePolicy, "first-frame-only");
  }
  const proof = { schemaVersion: 1, gate: "65", browser: "chromium", viewport: "390x844",
    locality: "zero off-origin requests", status: "PASS", directions: observations };
  if (process.argv.includes("--write")) {
    await writeFile(resolve(root, "quality/format-operations/conversion-output-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
  }
  console.log(JSON.stringify({ gate: 65, status: "PASS", directionRuns: observations.length,
    distinctIds: new Set(observations.map((entry) => entry.id)).size, physicalDevice: false }));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

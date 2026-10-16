/** #367 feasibility only. Run `npx tsx scripts/donor-codecs-367.ts --browser`.
 * Uses installed browser APIs / #047 source and independent Sharp/libvips readback.
 * No donor installation, product mutation, external request or release decision.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { enforceLocalNetwork367 } from "./codec-browser-network-367";

export type CodecMime367 = "image/png" | "image/jpeg" | "image/webp";

/** An external decoder is mandatory: header/MIME alone is insufficient. */
export async function verifyCodecReadback367(
  output: Uint8Array,
  expectedMime: CodecMime367,
  expected: { width: number; height: number; source?: Uint8Array; requirePixelsExact?: boolean },
) {
  if (!output.length || output.length > 8 * 1024 * 1024) throw new Error("OUTPUT_LIMIT");
  const magic = output[0] === 0xff && output[1] === 0xd8 && output[2] === 0xff ? "image/jpeg"
    : output.length >= 8 && Buffer.from(output.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
    : output.length >= 12 && Buffer.from(output.subarray(0, 4)).toString("ascii") === "RIFF"
      && Buffer.from(output.subarray(8, 12)).toString("ascii") === "WEBP" ? "image/webp" : "unknown";
  if (magic !== expectedMime) throw new Error(`FORMAT_MISMATCH: expected ${expectedMime}, bytes ${magic}`);
  const decode = async (data: Uint8Array) => {
    try {
      const pipe = sharp(Buffer.from(data), { failOn: "error", limitInputPixels: 1_000_000 });
      const meta = await pipe.metadata();
      const rgba = await pipe.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { meta, rgba };
    } catch (e) { throw new Error(`DECODE_FAILED: ${String(e)}`); }
  };
  const decoded = await decode(output);
  if (decoded.meta.format !== expectedMime.slice(6)) {
    throw new Error(`FORMAT_MISMATCH: decoder format ${decoded.meta.format}`);
  }
  if (decoded.rgba.info.width !== expected.width || decoded.rgba.info.height !== expected.height) {
    throw new Error("DIMENSION_MISMATCH: independent decoder disagrees");
  }
  let alphaExact: boolean | null = null;
  let pixelsExact: boolean | null = null;
  let rgbMeanAbsoluteDelta: number | null = null;
  if (expected.source) {
    const source = await decode(expected.source);
    if (source.rgba.info.width !== expected.width || source.rgba.info.height !== expected.height) {
      throw new Error("SOURCE_DIMENSION_MISMATCH");
    }
    let rgbDelta = 0;
    alphaExact = true;
    pixelsExact = true;
    for (let i = 0; i < source.rgba.data.length; i++) {
      const diff = Math.abs(source.rgba.data[i]! - decoded.rgba.data[i]!);
      if (diff) pixelsExact = false;
      if (i % 4 === 3 && diff) alphaExact = false;
      else if (i % 4 !== 3) rgbDelta += diff;
    }
    if (!alphaExact) throw new Error("ALPHA_MISMATCH: independent pixel readback differs");
    if (expected.requirePixelsExact && !pixelsExact) throw new Error("PIXEL_MISMATCH: lossless promise violated");
    rgbMeanAbsoluteDelta = rgbDelta / (expected.width * expected.height * 3);
  }
  return {
    width: decoded.rgba.info.width, height: decoded.rgba.info.height,
    byteLength: output.length, sha256: createHash("sha256").update(output).digest("hex"),
    exifBytes: decoded.meta.exif?.length ?? 0,
    alphaExact, pixelsExact, rgbMeanAbsoluteDelta,
  };
}

const root = resolve(import.meta.dirname, "..");
const file = (p: string) => readFile(resolve(root, p));
const median = (times: number[]) => times.toSorted((a, b) => a - b)[Math.floor(times.length / 2)] ?? null;

/** Synthetic bounded desktop corpus; reproducible pixels, generated only in RAM.
 * 512x384 exercises real codec allocation without violating the installed 1MP
 * admission guard. This is not a substitute for camera/mobile samples.
 */
export async function makeCodecCorpus367() {
  const width = 512;
  const height = 384;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      rgba[at] = (x * 13 + y * 7 + ((x * y) % 251)) % 256;
      rgba[at + 1] = (x * 5 + y * 11) % 256;
      rgba[at + 2] = (x * 3 + y * 19) % 256;
      rgba[at + 3] = ((x + y) % 7 === 0) ? 0 : ((x + y) % 7 === 1) ? 128 : 255;
    }
  }
  const raw = { raw: { width, height, channels: 4 as const } };
  const alphaPng = await sharp(rgba, raw).png({ compressionLevel: 6 }).toBuffer();
  const photoJpeg = await sharp(rgba, raw).flatten({ background: "#ffffff" }).jpeg({ quality: 86 }).toBuffer();
  return { width, height, alphaPng, photoJpeg };
}

async function runBrowser367() {
  const { createServer } = await import("vite");
  const { chromium, firefox, webkit } = await import("@playwright/test");
  const fixtures = {
    jpeg: await file("quality/fixtures/image-format-matrix/source.jpg"),
    png: await file("quality/fixtures/image-metadata/transparent-2x2-rgba.png"),
    avif: await file("quality/fixtures/image-format-matrix/source.avif"),
    svg: await file("tests/svg-313-safe.svg"),
  };
  const corpus = await makeCodecCorpus367();
  const sample = [
    { label: "png-lossless", mode: "png-lossless", blob: fixtures.png, mime: "image/png" as CodecMime367, output: "image/png" as CodecMime367, exact: true, width: 2, height: 2 },
    { label: "jpeg-normal", mode: "jpeg-normal", blob: fixtures.jpeg, mime: "image/jpeg" as CodecMime367, output: "image/jpeg" as CodecMime367, exact: false, width: 2, height: 2 },
    { label: "webp-alpha", mode: "webp-lossy", blob: fixtures.png, mime: "image/png" as CodecMime367, output: "image/webp" as CodecMime367, exact: false, width: 2, height: 2 },
    { label: "webp-exif", mode: "webp-lossy", blob: fixtures.jpeg, mime: "image/jpeg" as CodecMime367, output: "image/webp" as CodecMime367, exact: false, width: 2, height: 2 },
    { label: "png-512-alpha", mode: "png-lossless", blob: corpus.alphaPng, mime: "image/png" as CodecMime367, output: "image/png" as CodecMime367, exact: true, width: corpus.width, height: corpus.height },
    { label: "jpeg-512-texture", mode: "jpeg-normal", blob: corpus.photoJpeg, mime: "image/jpeg" as CodecMime367, output: "image/jpeg" as CodecMime367, exact: false, width: corpus.width, height: corpus.height },
    { label: "webp-512-alpha", mode: "webp-lossy", blob: corpus.alphaPng, mime: "image/png" as CodecMime367, output: "image/webp" as CodecMime367, exact: false, width: corpus.width, height: corpus.height },
  ];
  const vite = await createServer({
    root, configFile: false, logLevel: "silent", server: { host: "127.0.0.1", port: 0 },
    plugins: [{ name: "donor-codecs-367-csp", configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/__codec367") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; img-src 'self' blob:; connect-src 'none'; style-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'");
        res.end("<!doctype html><title>Image codec 367 local fixture</title>");
      });
    } }],
  });
  const report: Record<string, unknown> = {
    date: new Date().toISOString(), platform: `${process.platform}/${process.arch}`, node: process.version,
    scope: "desktop Chromium/Firefox/WebKit 2x2 fixtures and synthetic 512x384 corpus; no camera/physical mobile evidence",
    corpus: "deterministic RAM-only 512x384 RGBA transparency and textured JPEG; no source file or output persisted",
    wasmDonors: "NOT_INSTALLED_NOT_RUN", deviceMemoryPeak: "NOT_RUN", userCspProduction: "NOT_RUN",
    memoryMethod: "Chromium CDP Performance.getMetrics sampled JSHeapUsedSize before/after codec calls (not peak, native/graphics/WASM heap, browser RSS, or device RAM); other browsers NOT_AVAILABLE",
    engines: [] as unknown[],
  };
  try {
    await vite.listen();
    const address = vite.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Missing Vite loopback port");
    const origin = `http://127.0.0.1:${address.port}`;
    for (const engine of [chromium, firefox, webkit]) {
      const browser = await engine.launch({ headless: true });
      const engineResult: { engine: string; browserVersion: string; cases: unknown[]; externalRequests: string[]; blockedOffsiteRequests: string[]; cspViolations: string[] } = {
        engine: engine.name(), browserVersion: browser.version(), cases: [], externalRequests: [], blockedOffsiteRequests: [], cspViolations: [],
      };
      try {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 }, serviceWorkers: "block",
        });
        await enforceLocalNetwork367(context, origin, engineResult.blockedOffsiteRequests);
        const page = await context.newPage();
        const cdp = engine.name() === "chromium" ? await context.newCDPSession(page) : null;
        if (cdp) await cdp.send("Performance.enable");
        const heapUsed = async (): Promise<number | null> => {
          if (!cdp) return null;
          const { metrics } = await cdp.send("Performance.getMetrics");
          return metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? null;
        };
        page.on("request", (request) => {
          const address = request.url();
          // A blob: URL minted at our loopback origin is an in-memory local image,
          // not an external network request; all http(s) hosts must be loopback.
          if (!address.startsWith(`${origin}/`) && address !== origin &&
              !address.startsWith(`blob:${origin}/`)) engineResult.externalRequests.push(address);
        });
        await page.goto(`${origin}/__codec367`);
        await page.evaluate(() => document.addEventListener("securitypolicyviolation", (e) => {
          document.documentElement.dataset.csp = `${document.documentElement.dataset.csp || ""},${e.violatedDirective}`;
        }));
        for (const c of sample) {
          const times: number[] = [];
          const usedHeapSamples: number[] = [];
          const heapBefore = await heapUsed();
          let last: { output?: string; code?: string; keptOriginal?: boolean } = {};
          for (let rep = 0; rep < 3; rep++) {
            const evalResult = await page.evaluate(async ({ bytes64, mime, mode }) => {
              const sourceModule = "/src/engines/image/compression-donor-047.ts";
              const { compressImageWithDonor47 } = await import(/* @vite-ignore */ sourceModule);
              const input = new Blob([Uint8Array.from(atob(bytes64), (v) => v.charCodeAt(0))], { type: mime });
              const start = performance.now();
              try {
                const result = await compressImageWithDonor47(input, { mode });
                const bytes = new Uint8Array(await result.blob.arrayBuffer());
                return { ms: performance.now() - start, output: btoa(Array.from(bytes, (v) => String.fromCharCode(v)).join("")), keptOriginal: result.keptOriginal };
              } catch (e) { return { ms: performance.now() - start, code: String(e) }; }
            }, { bytes64: c.blob.toString("base64"), mime: c.mime, mode: c.mode });
            times.push(evalResult.ms);
            const heapAfterRep = await heapUsed();
            if (heapAfterRep !== null) usedHeapSamples.push(heapAfterRep);
            last = evalResult;
          }
          const jsHeap = heapBefore === null ? { status: "NOT_AVAILABLE" } : {
            status: "CHROMIUM_CDP_SAMPLED_JS_ONLY",
            beforeBytes: heapBefore,
            maxSampledAfterBytes: Math.max(...usedHeapSamples),
            // Samples after each call cannot measure transient peak codec RAM.
          };
          if (last.code) {
            if (c.mode === "webp-lossy") {
              if (!/OUTPUT_VERIFICATION|ALPHA_CHANGED/u.test(last.code)) throw new Error(`${engine.name()} ${c.label}: unrecognized refusal ${last.code}`);
              engineResult.cases.push({ label: c.label, status: "REFUSED", reason: last.code, medianMs: median(times), inputBytes: c.blob.length, inputSha256: createHash("sha256").update(c.blob).digest("hex"), jsHeap });
              continue;
            }
            throw new Error(`${engine.name()} ${c.label}: ${last.code}`);
          }
          if (!last.output) throw new Error(`${c.label}: no result`);
          const bytes = Buffer.from(last.output, "base64");
          const verified = await verifyCodecReadback367(bytes, c.output, { width: c.width, height: c.height, source: c.blob, requirePixelsExact: c.exact });
          engineResult.cases.push({ label: c.label, status: "PASS", medianMs: median(times), inputBytes: c.blob.length, inputSha256: createHash("sha256").update(c.blob).digest("hex"), keptOriginal: last.keptOriginal, jsHeap, ...verified });
        }
        const refusal = await page.evaluate(async (bytes64) => {
          const sourceModule = "/src/engines/image/compression-donor-047.ts";
          const { compressImageWithDonor47 } = await import(/* @vite-ignore */ sourceModule);
          const bytes = Uint8Array.from(atob(bytes64), (v) => v.charCodeAt(0));
          const source = new Blob([bytes], { type: "image/png" });
          const controller = new AbortController();
          controller.abort();
          let aborted = "";
          try { await compressImageWithDonor47(source, { mode: "png-lossless", signal: controller.signal }); }
          catch (error) { aborted = (error as Error).name; }
          const malformed = new Blob([bytes.subarray(0, 35)], { type: "image/png" });
          let truncated = "";
          try { await compressImageWithDonor47(malformed, { mode: "png-lossless" }); }
          catch (error) { truncated = String(error); }
          const original = new Uint8Array(await source.arrayBuffer());
          return {
            aborted, truncated,
            sourceUnchanged: original.length === bytes.length && original.every((value, at) => value === bytes[at]),
          };
        }, fixtures.png.toString("base64"));
        if (refusal.aborted !== "AbortError" || !/IMAGE_DONOR_47_INVALID_INPUT/u.test(refusal.truncated) || !refusal.sourceUnchanged) {
          throw new Error(`${engine.name()} source-refusal/cancel preservation mismatch: ${JSON.stringify(refusal)}`);
        }
        engineResult.cases.push({ label: "cancel-and-truncated-source", status: "REFUSED_AS_EXPECTED", ...refusal });
        // Probe native AVIF decoder versus encoder independently: do not infer encode from decode.
        const avif = await page.evaluate(async (base64) => {
          const bytes = Uint8Array.from(atob(base64), (v) => v.charCodeAt(0));
          let decode = "REFUSED";
          try {
            const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/avif" }));
            decode = `${bitmap.width}x${bitmap.height}`;
            bitmap.close();
          } catch (e) { decode = `REFUSED: ${String(e)}`; }
          const canvas = document.createElement("canvas"); canvas.width = 2; canvas.height = 2;
          const output = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/avif"));
          const result = output ? new Uint8Array(await output.arrayBuffer()) : null;
          return { decode, encodeReturnedMime: output?.type || "none", outputBase64: result ? btoa(Array.from(result, (v) => String.fromCharCode(v)).join("")) : null };
        }, fixtures.avif.toString("base64"));
        let avifVerdict = "ENCODER_NOT_SUPPORTED";
        let avifOutput: Record<string, unknown> = {};
        if (avif.encodeReturnedMime === "image/avif" && avif.outputBase64) {
          const actual = Buffer.from(avif.outputBase64, "base64");
          // AVIF is an ISO-BMFF image: verify an avif brand as well as libvips
          // independent AV1 decoding. A MIME label alone is never sufficient.
          const ftyp = actual.subarray(4, 8).toString("ascii") === "ftyp";
          const hasAvifBrand = actual.subarray(8, Math.min(48, actual.length)).includes(Buffer.from("avif"));
          if (!ftyp || !hasAvifBrand) throw new Error(`${engine.name()} AVIF claim lacked AVIF ftyp brand`);
          const meta = await sharp(actual, { failOn: "error", limitInputPixels: 1_000_000 }).metadata();
          const decoded = await sharp(actual).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          if (meta.format !== "heif" || meta.compression !== "av1" || decoded.info.width !== 2 || decoded.info.height !== 2) {
            throw new Error(`${engine.name()} AVIF independent decode mismatch`);
          }
          avifVerdict = "NATIVE_BYTES_REOPENED_UNAPPROVED";
          avifOutput = { bytes: actual.length, sha256: createHash("sha256").update(actual).digest("hex"), alphaAllTransparent: decoded.data.every((v, i) => i % 4 !== 3 || v === 0) };
        }
        engineResult.cases.push({ label: "native-avif-capability-probe", decode: avif.decode, encodeReturnedMime: avif.encodeReturnedMime, status: avifVerdict, ...avifOutput });
        // Real product SVG sanitizer -> canvas -> byte readback. No direct SVG loading.
        const svg = await page.evaluate(async (base64) => {
          const sourceModule = "/src/engines/image/svg-export.ts";
          const { exportSvgLocal } = await import(/* @vite-ignore */ sourceModule);
          const bytes = Uint8Array.from(atob(base64), (v) => v.charCodeAt(0));
          const start = performance.now();
          const result = await exportSvgLocal({ file: new Blob([bytes], { type: "image/svg+xml" }), mime: "image/png", width: 100, height: 80, scale: 1, background: "transparent" });
          const output = new Uint8Array(await result.blob.arrayBuffer());
          return { ms: performance.now() - start, output: btoa(Array.from(output, (v) => String.fromCharCode(v)).join("")) };
        }, fixtures.svg.toString("base64"));
        const svgBytes = Buffer.from(svg.output, "base64");
        const verified = await verifyCodecReadback367(svgBytes, "image/png", { width: 100, height: 80 });
        const rgba = await sharp(svgBytes).ensureAlpha().raw().toBuffer();
        if (rgba[(0 * 100 + 90) * 4 + 3] !== 0 || rgba[(10 * 100 + 10) * 4 + 3] !== 255) throw new Error("SVG_ALPHA_MISMATCH");
        engineResult.cases.push({ label: "safe-svg-to-png", status: "PASS", elapsedMs: svg.ms, transparentOutside: true, ...verified });
        const svgInjection = await page.evaluate(async () => {
          const sourceModule = "/src/engines/image/svg-export.ts";
          const { exportSvgLocal } = await import(/* @vite-ignore */ sourceModule);
          const file = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><image href="https://example.invalid/pixel.png"/></svg>'], { type: "image/svg+xml" });
          try { await exportSvgLocal({ file, mime: "image/png", width: 100, height: 80, scale: 1, background: "transparent" }); return "UNEXPECTED_ACCEPT"; }
          catch (e) { return String(e); }
        });
        if (!/UNSAFE_SVG/u.test(svgInjection)) throw new Error(`SVG malicious URL accepted: ${svgInjection}`);
        engineResult.cases.push({ label: "svg-external-resource-refusal", status: "REFUSED_AS_EXPECTED" });
        engineResult.cspViolations = (await page.evaluate(() => document.documentElement.dataset.csp || "")).split(",").filter(Boolean);
        if (engineResult.externalRequests.length || engineResult.blockedOffsiteRequests.length) {
          throw new Error(`Attempted offsite request blocked: ${JSON.stringify({
            blocked: engineResult.blockedOffsiteRequests, observed: engineResult.externalRequests,
          })}`);
        }
        // Vite development HMR may attempt WS and be refused by CSP; that's not the production CSP acceptance gate.
      } finally { await browser.close(); }
      (report.engines as unknown[]).push(engineResult);
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally { await vite.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] !== "--browser") throw new Error("Use --browser to run bounded desktop codec probe");
  await runBrowser367();
}

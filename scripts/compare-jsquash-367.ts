/** #367 optional, explicit donor comparison. Run only when the exact packages
 * are staged in .scratch/local-codec-367-20261016/node_modules (isolated from
 * the product dependency tree). No donor is imported by production code.
 *
 * npx tsx scripts/compare-jsquash-367.ts --browser
 */
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";
import { chromium, firefox, webkit } from "@playwright/test";
import type { Page } from "@playwright/test";
import sharp from "sharp";
import { makeCodecCorpus367, verifyCodecReadback367 } from "./donor-codecs-367";
import { enforceLocalNetwork367 } from "./codec-browser-network-367";

const root = resolve(import.meta.dirname, "..");
const donorRelative = ".scratch/local-codec-367-20261016/node_modules";
const donorRoot = resolve(root, donorRelative);
const packages = ["jpeg", "webp", "oxipng", "avif"] as const;
const sourceModule367 = `/${donorRelative}/@jsquash/jpeg/index.js`;
const wasmPath367 = `/${donorRelative}/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm`;
// Committed, independently decoded 2026-10-16 inventory: never learn pins from
// the installed vendor bytes (or a mutable benchmark run).
const pinnedReceiptSha256367 = "c9c24dd7ee6989c69ae427ffa2265ec5974175727c90404ef2da3c7e217a98ad";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const asBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
};

/** A measured refusal is useful evidence but never a green codec parity run.
 * This gate deliberately operates on the actual emitted report structure.
 */
export function assertCspProof367(run: {
  engine: string;
  positiveControl: unknown;
  strictCsp: unknown;
  evalBlockedCsp: unknown;
  noConnectCsp: unknown;
}, moduleUrl: string, wasmPath: string): void {
  const positive = run.positiveControl;
  if (!positive || typeof positive !== "object" || !("status" in positive) ||
      positive.status !== "DONOR_ENCODED" || !("moduleUrl" in positive) ||
      positive.moduleUrl !== moduleUrl || !("wasmPath" in positive) ||
      positive.wasmPath !== wasmPath || !("size" in positive) ||
      typeof positive.size !== "number" || positive.size < 1 ||
      !("moduleHttpStatus" in positive) || positive.moduleHttpStatus !== 200 ||
      !("wasmHttpStatus" in positive) || positive.wasmHttpStatus !== 200) {
    throw new Error(`CODEC_367_CSP_POSITIVE_CONTROL_MISSING: ${run.engine} ${JSON.stringify(positive)}`);
  }
  for (const [label, observation] of [
    ["strict", run.strictCsp], ["eval-blocked", run.evalBlockedCsp], ["connect-blocked", run.noConnectCsp],
  ] as const) {
    if (!observation || typeof observation !== "object" || !("status" in observation) ||
        observation.status !== "REFUSED") {
      throw new Error(`CODEC_367_CSP_UNEXPECTED_SUCCESS: ${run.engine} ${label} ${JSON.stringify(observation)}`);
    }
    const expectedDirective = label === "eval-blocked" ? "script-src" : "connect-src";
    const sameModule = "moduleUrl" in observation && observation.moduleUrl === positive.moduleUrl;
    const eventVerified = sameModule &&
      "violations" in observation && Array.isArray(observation.violations) &&
      observation.violations.some((candidate: unknown) => {
        if (!candidate || typeof candidate !== "object" ||
            !("effectiveDirective" in candidate) || !("blockedURI" in candidate) ||
            !("disposition" in candidate) || candidate.disposition !== "enforce" ||
            candidate.effectiveDirective !== expectedDirective || typeof candidate.blockedURI !== "string") return false;
        return expectedDirective === "connect-src"
          ? candidate.blockedURI.includes(wasmPath)
          : ["wasm-eval", "eval"].includes(candidate.blockedURI);
      });
    // WebKit 26.6 throws an explicit WASM CompileError naming the CSP policy
    // but emits no SecurityPolicyViolationEvent for that specific compile.
    // This narrow exception is corroborated by the same-module HTTP 200/WASM
    // 200 positive control; generic Failed to fetch/404 can never pass.
    const wasmCompilerVerified = sameModule && label === "eval-blocked" &&
      "message" in observation && typeof observation.message === "string" &&
      /\bCompileError\b/u.test(observation.message) &&
      /(?:Content Security Policy|\bCSP\b)/iu.test(observation.message) &&
      /(?:WebAssembly|wasm-unsafe-eval)/iu.test(observation.message) &&
      /script-src 'self'/u.test(observation.message);
    if (!eventVerified && !wasmCompilerVerified) throw new Error(`CODEC_367_CSP_CAUSE_UNPROVEN: ${run.engine} ${label} ${JSON.stringify(observation)}`);
  }
}

export function assertDonorRun367(run: {
  engine: string;
  positiveControl: unknown;
  strictCsp: unknown;
  evalBlockedCsp: unknown;
  noConnectCsp: unknown;
  cases: unknown[];
  remoteRequests: string[];
  blockedOffsiteRequests: string[];
  errors: string[];
}): void {
  assertCspProof367(run, sourceModule367, wasmPath367);
  if (run.errors.length || run.remoteRequests.length || run.blockedOffsiteRequests.length) {
    throw new Error(`CODEC_367_BROWSER_EGRESS_OR_ERROR: ${run.engine} ${JSON.stringify({
      errors: run.errors, observed: run.remoteRequests, blocked: run.blockedOffsiteRequests,
    })}`);
  }
  for (const name of packages) {
    const result = run.cases.find((item) => item !== null && typeof item === "object" &&
      "name" in item && item.name === name);
    if (!result || typeof result !== "object" || !("status" in result) ||
        result.status !== "DONOR_BYTES_REOPENED") {
      throw new Error(`CODEC_367_MISSING_DECODER_PROOF: ${run.engine} ${name} ${JSON.stringify(result)}`);
    }
  }
}

/** Direct browser event instrumentation: no error-string heuristics. */
export async function probeCspInBrowser367(page: Page, origin: string, moduleUrl: string, policyPath: string) {
  await page.goto(`${origin}${policyPath}`);
  return page.evaluate(async (sourceModule) => {
    const violations: { effectiveDirective: string; blockedURI: string; disposition: string }[] = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push({ effectiveDirective: event.effectiveDirective, blockedURI: event.blockedURI,
        disposition: event.disposition });
    });
    let result: { status: string; size?: number; message?: string };
    try {
      const { encode } = await import(/* @vite-ignore */ sourceModule);
      const encoded = await encode(new ImageData(new Uint8ClampedArray(16).fill(255), 2, 2));
      result = { status: "UNEXPECTED_SUCCESS", size: encoded.byteLength };
    } catch (error) { result = { status: "REFUSED", message: String(error).slice(0, 350) }; }
    // CSP violation dispatch can follow a rejected fetch/compile promise. This
    // is bounded, not an unbounded wait or a substitute for the actual event.
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    return { ...result, moduleUrl: sourceModule, violations };
  }, moduleUrl);
}

/** Fail closed if locally installed WASM bytes/licenses/versions have drifted
 * from the committed prior receipt. The comparison is set-complete and cannot
 * silently accept an extra, omitted or substituted binary.
 */
export function assertDonorInventory367(actual: unknown, pinned: unknown): void {
  function normalized(value: unknown): string {
    if (!value || typeof value !== "object" || !("packages" in value) || !("wasm" in value) ||
        !Array.isArray(value.packages) || !Array.isArray(value.wasm)) throw new Error("CODEC_367_INVENTORY_INVALID");
    const groups = [value.packages, value.wasm].map((records) => records
      .map((record) => JSON.stringify(record))
      .sort());
    return JSON.stringify(groups);
  }
  if (normalized(actual) !== normalized(pinned)) throw new Error("CODEC_367_DONOR_PIN_MISMATCH");
}

async function inventory() {
  const packagesInfo = [];
  const wasm: { package: string; file: string; bytes: number; sha256: string }[] = [];
  for (const name of packages) {
    const path = resolve(donorRoot, "@jsquash", name);
    const pkg = JSON.parse(await readFile(resolve(path, "package.json"), "utf8"));
    const lic = await readFile(resolve(path, "LICENSE"), "utf8");
    packagesInfo.push({ name, version: pkg.version, declaredLicense: pkg.license,
      includedLicenseSha256: hash(Buffer.from(lic)), dependencies: pkg.dependencies ?? {} });
    async function walk(folder: string): Promise<void> {
      for (const item of await readdir(folder, { withFileTypes: true })) {
        const path = resolve(folder, item.name);
        if (item.isDirectory()) await walk(path);
        else if (item.name.endsWith(".wasm")) {
          const content = await readFile(path);
          wasm.push({ package: name, file: relative(root, path), bytes: content.length, sha256: hash(content) });
        }
      }
    }
    await walk(path);
  }
  return { packages: packagesInfo, wasm };
}

async function run() {
  for (const name of packages) await access(resolve(donorRoot, "@jsquash", name, "index.js"));
  const assets = await inventory();
  const pinnedReceiptBytes = await readFile(resolve(root, "docs/codec-jsquash-367-2026-10-16.json"));
  if (hash(pinnedReceiptBytes) !== pinnedReceiptSha256367) throw new Error("CODEC_367_RECEIPT_PIN_MISMATCH");
  const pinnedReceipt = JSON.parse(pinnedReceiptBytes.toString("utf8"));
  assertDonorInventory367(assets, pinnedReceipt.assets);
  const corpus = await makeCodecCorpus367();
  const smallAlpha = await sharp(corpus.alphaPng).resize(128, 96).png().toBuffer();
  const sources = {
    jpeg: { bytes: corpus.photoJpeg, mime: "image/jpeg", output: "image/jpeg", width: corpus.width, height: corpus.height },
    webp: { bytes: corpus.alphaPng, mime: "image/png", output: "image/webp", width: corpus.width, height: corpus.height },
    oxipng: { bytes: corpus.alphaPng, mime: "image/png", output: "image/png", width: corpus.width, height: corpus.height },
    avif: { bytes: smallAlpha, mime: "image/png", output: "image/avif", width: 128, height: 96 },
  } as const;
  const vite = await createServer({
    root, configFile: false, logLevel: "silent", optimizeDeps: { noDiscovery: true },
    server: { host: "127.0.0.1", port: 0 },
    plugins: [{ name: "jsquash-367-conditional-csp", configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!["/__strict367", "/__wasm367", "/__no_connect367", "/__eval_block367"].includes(req.url ?? "")) return next();
        const wasmAllowed = req.url === "/__no_connect367" || req.url === "/__wasm367";
        const connectAllowed = req.url === "/__eval_block367" || req.url === "/__wasm367";
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'self'${wasmAllowed ? " 'wasm-unsafe-eval'" : ""}; connect-src '${connectAllowed ? "self" : "none"}'; img-src 'self' blob:; worker-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'`);
        res.end("<!doctype html><title>Isolated jSquash browser probe #367</title>");
      });
    } }],
  });
  const report = {
    timestamp: new Date().toISOString(), source: "isolated npm packages in ignored scratch; product dependencies unchanged",
    host: `${process.platform}/${process.arch}`, node: process.version,
    sourcePixels: "synthetic 512x384 PNG alpha/JPEG textured; AVIF 128x96 derived from same fixture",
    limits: "desktop headless only; no mobile hardware, battery, native RSS, WASM peak or production CSP",
    cspDecision: "strict rejects fetch or WASM compilation; script-src wasm-unsafe-eval and connect-src self both required and NOT approved for production",
    licenses: "npm wrappers and included LICENSE hashed, compiled codec license/source obligations not independently resolved",
    pinProvenance: { receipt: "docs/codec-jsquash-367-2026-10-16.json", sha256: pinnedReceiptSha256367,
      contract: "versions, included LICENSE sha256, transitive deps, exact 10 WASM names/sizes/sha256 matched before any browser probe; JS wrapper bytes not separately pinned" },
    assets, engines: [] as unknown[],
    svg: "jSquash has no SVG encoder: product SVG allowlist + svgo installed, not an equivalent jSquash codec",
  };
  try {
    await vite.listen();
    const address = vite.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Missing loopback listener");
    const origin = `http://127.0.0.1:${address.port}`;
    for (const engine of [chromium, firefox, webkit]) {
      const browser = await engine.launch({ headless: true });
      const engineResult: {
        engine: string; browserVersion: string; positiveControl: unknown; strictCsp: unknown; evalBlockedCsp: unknown; noConnectCsp: unknown; cases: unknown[];
        remoteRequests: string[]; blockedOffsiteRequests: string[];
        wasmResponses: { path: string; status: number; responseLengthHeader: string | null }[]; errors: string[];
      } = { engine: engine.name(), browserVersion: browser.version(), positiveControl: null, strictCsp: null, evalBlockedCsp: null, noConnectCsp: null,
        cases: [], remoteRequests: [], blockedOffsiteRequests: [], wasmResponses: [], errors: [] };
      try {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 }, serviceWorkers: "block",
        });
        // Install the network guard before any page/popup or donor module can run.
        await enforceLocalNetwork367(context, origin, engineResult.blockedOffsiteRequests);
        const page = await context.newPage();
        page.on("request", (request) => {
          if (!request.url().startsWith(`${origin}/`) && request.url() !== origin &&
              !request.url().startsWith(`blob:${origin}/`)) {
            engineResult.remoteRequests.push(request.url());
          }
        });
        const httpResponses: { path: string; status: number }[] = [];
        page.on("response", (response) => {
          const pathname = new URL(response.url()).pathname;
          httpResponses.push({ path: pathname, status: response.status() });
          if (pathname.endsWith(".wasm")) {
            engineResult.wasmResponses.push({ path: pathname, status: response.status(),
              responseLengthHeader: response.headers()["content-length"] ?? null });
          }
        });
        page.on("pageerror", (error) => engineResult.errors.push(String(error).slice(0, 400)));
        // Same exact module under the permissive CSP is a mandatory positive
        // control BEFORE any negative probes: a missing module/WASM cannot be
        // misreported as proof of a CSP refusal.
        await page.goto(`${origin}/__wasm367`);
        const positive = await page.evaluate(async (moduleUrl) => {
          try {
            const { encode } = await import(/* @vite-ignore */ moduleUrl);
            const encoded = await encode(new ImageData(new Uint8ClampedArray(16).fill(255), 2, 2));
            return { status: "DONOR_ENCODED", size: encoded.byteLength, moduleUrl };
          } catch (error) { return { status: "CONTROL_FAILED", message: String(error).slice(0, 350), moduleUrl }; }
        }, sourceModule367);
        engineResult.positiveControl = { ...positive, wasmPath: wasmPath367,
          moduleHttpStatus: httpResponses.find((r) => r.path === sourceModule367)?.status ?? 0,
          wasmHttpStatus: httpResponses.find((r) => r.path === wasmPath367)?.status ?? 0 };
        // Listener installed synchronously before import; the browser's CSP
        // events (not the generic catch) are our cause-specific oracle.
        engineResult.strictCsp = await probeCspInBrowser367(page, origin, sourceModule367, "/__strict367");
        engineResult.evalBlockedCsp = await probeCspInBrowser367(page, origin, sourceModule367, "/__eval_block367");
        engineResult.noConnectCsp = await probeCspInBrowser367(page, origin, sourceModule367, "/__no_connect367");
        // Fresh realm avoids retaining the Emscripten aborted singleton after
        // the strict-CSP negative test.
        await page.goto(`${origin}/__wasm367`);
        const cdp = engine.name() === "chromium" ? await page.context().newCDPSession(page) : null;
        if (cdp) await cdp.send("Performance.enable");
        const jsHeap = async () => {
          if (!cdp) return null;
          const { metrics } = await cdp.send("Performance.getMetrics");
          return metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? null;
        };
        for (const name of packages) {
          const source = sources[name];
          const times: number[] = [];
          const heapBefore = await jsHeap();
          let last: { ok: boolean; bytes?: string; error?: string } = { ok: false };
          for (let attempt = 0; attempt < 2; attempt++) {
            const result = await page.evaluate(async ({ name, base64, mime }) => {
              const filename = `/.scratch/local-codec-367-20261016/node_modules/@jsquash/${name}/index.js`;
              const bytes = Uint8Array.from(atob(base64), (v) => v.charCodeAt(0));
              const started = performance.now();
              try {
                const library = await import(/* @vite-ignore */ filename);
                let output: ArrayBuffer;
                if (name === "oxipng") {
                  output = await library.optimise(bytes.buffer, { level: 2 });
                } else {
                  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }), { imageOrientation: "from-image" });
                  const canvas = document.createElement("canvas");
                  canvas.width = bitmap.width; canvas.height = bitmap.height;
                  const context = canvas.getContext("2d", { willReadFrequently: true });
                  if (!context) throw new Error("Canvas unavailable");
                  context.drawImage(bitmap, 0, 0);
                  bitmap.close();
                  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                  const options = name === "jpeg" ? { quality: 84 }
                    : name === "webp" ? { lossless: 1, exact: 1, method: 4, alpha_quality: 100 }
                      : { quality: 75, speed: 8 };
                  output = await library.encode(pixels, options);
                }
                const encoded = new Uint8Array(output);
                if (encoded.length === 0 || encoded.length > 8 * 1024 * 1024) throw new Error("OUTPUT_LIMIT");
                // Encode output is returned as actual bytes and reopened outside the browser.
                let binary = "";
                for (let at = 0; at < encoded.length; at += 16_384) {
                  binary += String.fromCharCode(...encoded.subarray(at, at + 16_384));
                }
                return { ok: true, bytes: btoa(binary), ms: performance.now() - started };
              } catch (error) {
                return { ok: false, error: String(error).slice(0, 400), ms: performance.now() - started };
              }
            }, { name, base64: asBase64(source.bytes), mime: source.mime });
            times.push(result.ms);
            last = result;
            if (!result.ok) break;
          }
          const heapAfter = await jsHeap();
          const shared = { name, sourceBytes: source.bytes.length, sourceSha256: hash(source.bytes),
            elapsedMs: times, medianMs: median(times),
            jsHeapSample: heapBefore === null ? "NOT_AVAILABLE" : {
              beforeBytes: heapBefore, afterBytes: heapAfter, metric: "CHROMIUM_CDP_JS_ONLY_NOT_PEAK",
            } };
          if (!last.ok || !last.bytes) {
            engineResult.cases.push({ ...shared, status: "DONOR_RUNTIME_FAILED", error: last.error });
            continue;
          }
          const output = Buffer.from(last.bytes, "base64");
          try {
            if (name === "avif") {
              const metadata = await sharp(output, { failOn: "error", limitInputPixels: 1_000_000 }).metadata();
              if (metadata.format !== "heif" || metadata.compression !== "av1") throw new Error("Not independently decoded AVIF");
              const rgba = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
              const original = await sharp(source.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
              if (rgba.info.width !== source.width || rgba.info.height !== source.height) throw new Error("AVIF axes mismatch");
              let alphaMismatches = 0;
              for (let at = 3; at < rgba.data.length; at += 4) if (rgba.data[at] !== original.data[at]) alphaMismatches++;
              engineResult.cases.push({ ...shared, status: "DONOR_BYTES_REOPENED", outputBytes: output.length, outputSha256: hash(output),
                alphaMismatches, decoder: "Sharp/libvips heif/AV1" });
            } else {
              const expectedMime = name === "jpeg" ? "image/jpeg" : name === "webp" ? "image/webp" : "image/png";
              const checked = await verifyCodecReadback367(output, expectedMime, {
                width: source.width, height: source.height, source: source.bytes, requirePixelsExact: name === "oxipng",
              });
              engineResult.cases.push({ ...shared, status: "DONOR_BYTES_REOPENED", ...checked });
            }
          } catch (error) {
            engineResult.cases.push({ ...shared, status: "INDEPENDENT_DECODER_REFUSED", outputBytes: output.length,
              outputSha256: hash(output), reason: String(error) });
          }
        }
        assertDonorRun367(engineResult);
      } finally { await browser.close(); }
      report.engines.push(engineResult);
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally { await vite.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] !== "--browser") throw new Error("Use --browser with isolated donor packages present");
  await run();
}

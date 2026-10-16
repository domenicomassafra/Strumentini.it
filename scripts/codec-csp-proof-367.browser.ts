/** #367 opt-in real-browser CSP causality test. NO donor downloads, no npm
 * installation, no production change. Same locally served synthetic ES module
 * and 8-byte valid WASM binary on the permitted and forbidden pages.
 * Run: ./node_modules/.bin/tsx scripts/codec-csp-proof-367.browser.ts
 */
import { createServer } from "node:http";
import { chromium, firefox, webkit } from "@playwright/test";
import { assertCspProof367, probeCspInBrowser367 } from "./compare-jsquash-367";
import { enforceLocalNetwork367 } from "./codec-browser-network-367";

const moduleUrl = "/__fixture367/module.js";
const wasmPath = "/__fixture367/fixture.wasm";
const wasmBytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const server = createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const path = req.url;
  if (path === moduleUrl) {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.end(`export async function encode() {
      const response = await fetch('${wasmPath}');
      if (!response.ok) throw new Error('WASM_NOT_FOUND');
      await WebAssembly.compile(await response.arrayBuffer());
      return new Uint8Array([1,2,3,4]);
    }`);
  } else if (path === wasmPath) {
    res.setHeader("Content-Type", "application/wasm");
    res.end(Buffer.from(wasmBytes));
  } else if (["/__strict367", "/__eval_block367", "/__no_connect367", "/__wasm367"].includes(path ?? "")) {
    const allowWasm = ["/__no_connect367", "/__wasm367"].includes(path ?? "");
    const allowConnect = ["/__eval_block367", "/__wasm367"].includes(path ?? "");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'self'${allowWasm ? " 'wasm-unsafe-eval'" : ""}; connect-src '${allowConnect ? "self" : "none"}'; object-src 'none'; base-uri 'none'`);
    res.end("<!doctype html><title>367 CSP causal fixture</title>");
  } else { res.writeHead(404); res.end("not found"); }
});

async function main(): Promise<void> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No loopback listener");
  const origin = `http://127.0.0.1:${address.port}`;
  const results: unknown[] = [];
  try {
    for (const engine of [chromium, firefox, webkit]) {
      const browser = await engine.launch({ headless: true });
      try {
        const blockedOffsiteRequests: string[] = [];
        const context = await browser.newContext({ serviceWorkers: "block" });
        await enforceLocalNetwork367(context, origin, blockedOffsiteRequests);
        const page = await context.newPage();
        const httpResponses: { path: string; status: number }[] = [];
        page.on("response", (response) => httpResponses.push({ path: new URL(response.url()).pathname, status: response.status() }));
        await page.goto(`${origin}/__wasm367`);
        const positive = await page.evaluate(async (module) => {
          const { encode } = await import(/* @vite-ignore */ module);
          const bytes = await encode();
          return { status: "DONOR_ENCODED", size: bytes.byteLength, moduleUrl: module };
        }, moduleUrl);
        const positiveControl = { ...positive, wasmPath,
          moduleHttpStatus: httpResponses.find((r) => r.path === moduleUrl)?.status ?? 0,
          wasmHttpStatus: httpResponses.find((r) => r.path === wasmPath)?.status ?? 0 };
        // A genuine HTTP 404 on precisely the same script URL, after its
        // positive control, must NOT be accepted as a CSP refusal.
        await page.route(`**${moduleUrl}`, (route) => route.fulfill({ status: 404, contentType: "text/plain", body: "missing" }));
        const missing = await probeCspInBrowser367(page, origin, moduleUrl, "/__strict367");
        await page.unroute(`**${moduleUrl}`);
        if (missing.status !== "REFUSED" || missing.violations.length !== 0) {
          throw new Error(`CODEC_367_BAD_HTTP_404_FIXTURE: ${engine.name()} ${JSON.stringify(missing)}`);
        }
        const strictCsp = await probeCspInBrowser367(page, origin, moduleUrl, "/__strict367");
        const evalBlockedCsp = await probeCspInBrowser367(page, origin, moduleUrl, "/__eval_block367");
        const noConnectCsp = await probeCspInBrowser367(page, origin, moduleUrl, "/__no_connect367");
        const run = { engine: engine.name(), positiveControl, strictCsp, evalBlockedCsp, noConnectCsp };
        let rejected404 = false;
        try { assertCspProof367({ ...run, strictCsp: missing }, moduleUrl, wasmPath); }
        catch (error) { rejected404 = String(error).includes("CODEC_367_CSP_CAUSE_UNPROVEN"); }
        if (!rejected404) throw new Error(`CODEC_367_404_FALSE_GREEN: ${engine.name()}`);
        assertCspProof367(run, moduleUrl, wasmPath);
        if (blockedOffsiteRequests.length) throw new Error(`CODEC_367_NETWORK_EGRESS: ${blockedOffsiteRequests.join(",")}`);
        results.push({ browser: engine.name(), version: browser.version(), positiveControl,
          rejected404, strictCsp, evalBlockedCsp, noConnectCsp, offsite: blockedOffsiteRequests });
      } finally { await browser.close(); }
    }
    process.stdout.write(`${JSON.stringify({ fixture: "SYNTHETIC_WASM_NOT_DONOR", policy: "loopback, headless desktop, same module and WASM", results }, null, 2)}\n`);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

await main();

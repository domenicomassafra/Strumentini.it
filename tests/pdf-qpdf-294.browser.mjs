/** Browser-only donor feasibility probe for STR-294; does not change product routing. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = 18694;
const origin = process.env.STR294_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.STR294_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { ready = (await fetch(`${origin}/tools/pdf-compression-lite/`)).ok; if (ready) break; } catch { /* starting */ }
    await new Promise((done) => setTimeout(done, 500));
  }
  assert(ready, "Local Astro route unavailable");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const remote = [];
  const errors = [];
  page.on("request", (request) => { if (!request.url().startsWith(origin) && !request.url().startsWith("blob:")) remote.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/tools/pdf-compression-lite/`, { waitUntil: "domcontentloaded" });
  const bytes = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-2page.pdf"));
  const payload = Array.from(bytes);
  const result = await page.evaluate(async (input) => {
    const { createPdfToolkit } = await import("/src/engines/pdf/vendor/pdfstudio/index.js");
    const toolkit = await createPdfToolkit({ wasmUrl: new URL("/src/engines/pdf/vendor/pdfstudio/wasm/qpdf.wasm", location.origin) });
    const browserResult = await toolkit.compress(new Uint8Array(input));
    const worker = new Worker("/tests/fixtures/pdf-qpdf-294-worker.js", { type: "module" });
    const send = () => new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data.size);
      worker.onerror = (error) => reject(new Error(error.message));
      worker.postMessage(input);
    });
    const first = await send();
    globalThis.__str294 = { toolkit, worker, send };
    const memoryAvailable = Boolean(performance.memory);
    const baseline = performance.memory?.usedJSHeapSize ?? null;
    await new Promise((r) => setTimeout(r, 0));
    const second = await send();
    const after = performance.memory?.usedJSHeapSize ?? null;
    return { browserBytes: browserResult.length, workerBytes: first, repeatWorkerBytes: second, memoryAvailable, baseline, after };
  }, payload);
  assert.equal(result.browserBytes, 871);
  assert.equal(result.workerBytes, 871);
  assert.equal(result.repeatWorkerBytes, 871);
  await context.setOffline(true);
  const offline = await page.evaluate(async (input) => {
    const direct = await globalThis.__str294.toolkit.compress(new Uint8Array(input));
    const inWorker = await globalThis.__str294.send();
    return { direct: direct.length, worker: inWorker };
  }, payload);
  assert.deepEqual(offline, { direct: 871, worker: 871 });
  await context.setOffline(false);
  const aborted = await page.evaluate(() => {
    const worker = globalThis.__str294.worker;
    let completed = false;
    worker.onmessage = () => { completed = true; };
    worker.postMessage(new Uint8Array(8 * 1024 * 1024));
    worker.terminate();
    return new Promise((resolve) => setTimeout(() => resolve(!completed), 100));
  });
  assert.equal(aborted, true, "Terminating the heavy worker must prevent a completion message");
  const cspPage = await context.newPage();
  await cspPage.route(`${origin}/tools/pdf-compression-lite/`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: {
      ...response.headers(),
      "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self' ws:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:",
    } });
  });
  await cspPage.goto(`${origin}/tools/pdf-compression-lite/`, { waitUntil: "domcontentloaded" });
  const cspBytes = await cspPage.evaluate(async (input) => {
    const { createPdfToolkit } = await import("/src/engines/pdf/vendor/pdfstudio/index.js");
    const toolkit = await createPdfToolkit({ wasmUrl: new URL("/src/engines/pdf/vendor/pdfstudio/wasm/qpdf.wasm", location.origin) });
    return (await toolkit.compress(new Uint8Array(input))).length;
  }, payload);
  assert.equal(cspBytes, 871, "WASM must load under strict same-origin CSP with wasm-unsafe-eval");
  assert.deepEqual(remote, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ STR294_BROWSER_PASS: true, ...result, offline, workerTermination: aborted,
    cspBytes, remoteRequests: remote.length, errors: errors.length }));
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

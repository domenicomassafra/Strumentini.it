/**
 * #056 browser-local acceptance through Vite's real module and Worker pipeline.
 * Source-only test harness: it does not enable unverified Office rendering.
 * Run: node scripts/acceptance-office-print-56.browser.mjs
 */
import { strict as assert } from "node:assert";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const vite = await createServer({
  configFile: false,
  root,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, strictPort: false },
  plugins: [{
    name: "acceptance-office-56-page",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/__acceptance-office-56") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end('<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="check56">PDF stampabile locale #056</main></body></html>');
      });
    },
  }],
});
let browser;
try {
  await vite.listen();
  const addr = vite.httpServer?.address();
  assert(addr && typeof addr !== "string", "Vite test server must listen on an assigned port");
  const origin = `http://127.0.0.1:${addr.port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const remoteRequests = [];
  const errors = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) remoteRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  assert.equal((await page.goto(`${origin}/__acceptance-office-56`))?.status(), 200);

  const result = await page.evaluate(async () => {
    const { exportOfficePrintable56 } = await import("/src/engines/pdf/office-print-pack-56.ts");
    const example = new File(["Capitolo locale\nRiga verificata 123\nFine documento"], "appunti.txt", { type: "text/plain" });
    const output = await exportOfficePrintable56(example, { pageSize: "a4", pageNumbers: true });
    const bytes = output.artifact.bytes;
    const pdfMagic = String.fromCharCode(...bytes.subarray(0, 5));
    const pdfjs = await import("/node_modules/pdfjs-dist/legacy/build/pdf.mjs");
    // Independent, unbundled PDF.js instance must configure its OWN worker:
    // it is deliberately a different module instance from the app's Vite bundle.
    pdfjs.GlobalWorkerOptions.workerSrc = "/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs";
    const loader = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true, disableFontFace: true });
    let reopened;
    try {
      const pdf = await loader.promise;
      const first = await pdf.getPage(1);
      const text = (await first.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ");
      const pageView = [...first.view];
      first.cleanup();
      reopened = { pageCount: pdf.numPages, text, pageView };
    } finally { await loader.destroy(); }
    let readCalls = 0;
    let officeRefused = false;
    try {
      await exportOfficePrintable56({ name: "prova.docx", type: "application/octet-stream", size: 15,
        arrayBuffer: async () => { readCalls++; return new ArrayBuffer(15); } });
    } catch (error) { officeRefused = String(error).includes("PDF56_OFFICE_FIDELITY_REFUSED"); }

    // Abort while the actual Worker is processing a large valid text document.
    const cancellation = new AbortController();
    const slow = new File(["Riga molto lunga, ma rappresentabile 123\n".repeat(9000)], "grande.txt", { type: "text/plain" });
    const pending = exportOfficePrintable56(slow, { fontPt: 8 }, cancellation.signal);
    cancellation.abort();
    let cancelled = false;
    try { await pending; } catch (error) { cancelled = error?.name === "AbortError"; }
    return {
      pdfMagic, bytes: bytes.byteLength, outputPages: output.artifact.pageCount,
      verifiedPages: output.documentVerification.checkedPages,
      sourceKind: output.sourceKind, policy: output.fidelity, reopened,
      officeRefused, readCalls, cancelled,
    };
  });
  assert.equal(result.pdfMagic, "%PDF-");
  assert(result.bytes > 500);
  assert.equal(result.outputPages, 1);
  assert.equal(result.verifiedPages, result.outputPages);
  assert.equal(result.sourceKind, "txt");
  assert.equal(result.policy, "SEMANTIC_PRINT_ONLY");
  assert.equal(result.reopened.pageCount, 1);
  assert.match(result.reopened.text, /Capitolo locale.*Riga verificata 123.*Fine documento/u);
  assert(Math.abs(result.reopened.pageView[2] - 595.28) < 0.1);
  assert.equal(result.officeRefused, true);
  assert.equal(result.readCalls, 0);
  assert.equal(result.cancelled, true);
  assert.deepEqual(remoteRequests, []);
  assert.deepEqual(errors, []);
  console.log("PASS #056 Chromium browser Worker + independent PDF.js reopen + fail-closed Office + abort + no offsite (14 checks)");
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  await vite.close();
}

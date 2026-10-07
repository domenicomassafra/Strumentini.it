import { createServer } from "vite";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const repoRoot = path.resolve(root, "../..");
const outputDir = path.join(repoRoot, "quality/benchmarks/heavy-browser");
const executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const targets = ["pdf-capabilities", "image-pipeline", "file-pipeline"];

await fs.mkdir(outputDir, { recursive: true });
const server = await createServer({ root, server: { host: "127.0.0.1", port: 41741, strictPort: true }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ executablePath, headless: true, args: ["--enable-precise-memory-info"] });
const results = {};
try {
  for (const target of targets) {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    const started = performance.now();
    await page.goto(`http://127.0.0.1:41741/${target}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__STRUMENTINI_SPIKE_RESULT__ != null, null, { timeout: 120000 });
    const result = await page.evaluate(() => window.__STRUMENTINI_SPIKE_RESULT__);
    const browserMetrics = await page.evaluate(() => ({
      usedJSHeapSize: performance.memory?.usedJSHeapSize ?? null,
      totalJSHeapSize: performance.memory?.totalJSHeapSize ?? null,
      jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit ?? null,
      resources: performance.getEntriesByType("resource").map((r) => ({ name: r.name.split("/").pop(), transferSize: r.transferSize, decodedBodySize: r.decodedBodySize, duration: r.duration })),
    }));
    results[target] = { ...result, wallMs: performance.now() - started, browserMetrics, consoleErrors };
    if (!result?.ok || consoleErrors.length) {
      throw new Error(`${target} failed: ${JSON.stringify({ result, consoleErrors })}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

const artifact = { generatedAt: new Date().toISOString(), browser: "system Google Chrome headless via playwright-core 1.63.0", results };
await fs.writeFile(path.join(outputDir, "observed-runtime.json"), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify(artifact, null, 2));

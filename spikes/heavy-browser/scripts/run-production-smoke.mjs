import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const repoRoot = path.resolve(root, "../..");
const distRoot = path.join(root, "dist-heavy-browser");
const outputDir = path.join(repoRoot, "quality/benchmarks/heavy-browser");
const executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const targets = ["pdf-capabilities", "image-pipeline", "file-pipeline"];

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".wasm", "application/wasm"],
]);

function startServer(dir, port) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${port}`);
      const requested = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = path.join(dir, requested);
      if (!filePath.startsWith(dir)) throw new Error("invalid path");
      const body = await fs.readFile(filePath);
      response.writeHead(200, { "content-type": mime.get(path.extname(filePath)) ?? "application/octet-stream", "cache-control": "no-store" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const browser = await chromium.launch({ executablePath, headless: true, args: ["--enable-precise-memory-info"] });
const results = {};
try {
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const port = 41810 + i;
    const server = await startServer(path.join(distRoot, target), port);
    try {
      const page = await browser.newPage();
      const consoleErrors = [];
      page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
      page.on("pageerror", (error) => consoleErrors.push(error.message));
      const started = performance.now();
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__UTILITYOS_SPIKE_RESULT__ != null, null, { timeout: 120000 });
      const result = await page.evaluate(() => window.__UTILITYOS_SPIKE_RESULT__);
      results[target] = { ok: result?.ok === true, wallMs: performance.now() - started, result, consoleErrors };
      if (!result?.ok || consoleErrors.length) throw new Error(`${target} production smoke failed: ${JSON.stringify(results[target])}`);
      await page.close();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }
} finally {
  await browser.close();
}

const artifact = { generatedAt: new Date().toISOString(), browser: "system Google Chrome headless against production Vite builds", results };
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "production-smoke.json"), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify(artifact, null, 2));

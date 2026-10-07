import http from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "../..");
const dist = path.join(root, "dist");
const outputDir = path.join(repoRoot, "quality/benchmarks/heavy-local-feasibility");
const port = 41934;
const origin = `http://127.0.0.1:${port}`;

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json"],
  [".wasm", "application/wasm"],
  [".gz", "application/gzip"],
  [".png", "image/png"],
  [".heic", "image/heic"],
  [".mp4", "video/mp4"],
  [".wav", "audio/wav"],
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
]);

function startServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, origin);
      const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const file = path.resolve(dist, relative);
      if (!file.startsWith(`${dist}${path.sep}`) && file !== path.join(dist, "index.html")) throw new Error("invalid path");
      const metadata = await stat(file);
      if (!metadata.isFile()) throw new Error("not file");
      response.writeHead(200, {
        "content-type": mime.get(path.extname(file)) ?? "application/octet-stream",
        "cache-control": "no-store",
        "cross-origin-opener-policy": "same-origin",
        "cross-origin-embedder-policy": "require-corp",
      });
      response.end(await readFile(file));
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

const engines = [
  { id: "chrome", label: "system Google Chrome", launcher: chromium, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", classification: "real-desktop-browser" },
  { id: "edge", label: "system Microsoft Edge", launcher: chromium, executablePath: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", classification: "real-desktop-browser" },
  { id: "chromium", label: "Playwright Chromium", launcher: chromium, executablePath: chromium.executablePath(), classification: "desktop-regression" },
  { id: "firefox", label: "Playwright Firefox", launcher: firefox, executablePath: firefox.executablePath(), classification: "desktop-regression" },
  { id: "webkit", label: "Playwright WebKit", launcher: webkit, executablePath: webkit.executablePath(), classification: "desktop-regression-not-safari" },
];

async function runEngine(engine) {
  if (!existsSync(engine.executablePath)) {
    return { engine: engine.id, label: engine.label, classification: engine.classification, status: "UNAVAILABLE", reason: `executable unavailable: ${engine.executablePath}` };
  }
  const browser = await engine.launcher.launch({ executablePath: engine.executablePath, headless: true, args: engine.id === "chrome" || engine.id === "edge" || engine.id === "chromium" ? ["--enable-precise-memory-info"] : [] });
  const externalRequests = [];
  const localRequests = [];
  const consoleErrors = [];
  try {
    const context = await browser.newContext();
    await context.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      if (requestUrl.startsWith(origin) || requestUrl.startsWith("blob:") || requestUrl.startsWith("data:")) {
        if (requestUrl.startsWith(origin)) localRequests.push(requestUrl);
        await route.continue();
      } else {
        externalRequests.push(requestUrl);
        await route.abort("blockedbyclient");
      }
    });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    const wallStart = performance.now();
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(() => window.__STRUMENTINI_HEAVY_FEASIBILITY__ != null, null, { timeout: 180_000 });
    const payload = await page.evaluate(() => window.__STRUMENTINI_HEAVY_FEASIBILITY__);
    const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => ({
      url: entry.name,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      durationMs: entry.duration,
    })));
    await context.close();
    return {
      engine: engine.id,
      label: engine.label,
      classification: engine.classification,
      status: "OBSERVED",
      wallMs: performance.now() - wallStart,
      localRequests: [...new Set(localRequests)],
      externalRequests,
      consoleErrors,
      payload,
      resources,
    };
  } catch (error) {
    return {
      engine: engine.id,
      label: engine.label,
      classification: engine.classification,
      status: "RUN_FAILED",
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      localRequests: [...new Set(localRequests)],
      externalRequests,
      consoleErrors,
    };
  } finally {
    await browser.close();
  }
}

await mkdir(outputDir, { recursive: true });
const server = await startServer();
try {
  const results = [];
  for (const engine of engines) results.push(await runEngine(engine));
  const receipt = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    origin,
    networkPolicy: "All non-loopback requests are aborted by the browser context before transmission.",
    physicalMobile: {
      iosSafari: { status: "NOT_RUN", evidence: null },
      androidChrome: { status: "NOT_RUN", evidence: null },
      note: "Desktop browsers, Playwright WebKit, device descriptors and viewport emulation are not physical-device evidence.",
    },
    results,
  };
  await writeFile(path.join(outputDir, "desktop-runtime.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({
    output: path.join(outputDir, "desktop-runtime.json"),
    engines: results.map((result) => ({ engine: result.engine, status: result.status, passed: result.payload?.results?.filter((item) => item.status === "PASS").length ?? 0, failed: result.payload?.results?.filter((item) => item.status === "FAIL").map((item) => item.id) ?? [] })),
  }, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

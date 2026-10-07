import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, resolve, sep } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const assetDir = resolve(dist, "_astro");
const output = resolve(root, "quality/benchmarks/heavy-local-runtime/preflight-browser-bundle.json");
const temporary = await mkdtemp(resolve(tmpdir(), "strumentini-heavy-preflight-"));
const port = 18231;
const origin = `http://127.0.0.1:${port}`;

const mimeByExtension = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
]);

async function compileFixtureModule() {
  const source = await readFile(resolve(root, "src/runtime/heavy-preflight.ts"), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      strict: true,
    },
    fileName: "heavy-preflight.ts",
    reportDiagnostics: true,
  });
  const errors = (transpiled.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) {
    throw new Error(`heavy-preflight fixture transpile failed: ${errors.map((item) => item.messageText).join("; ")}`);
  }
  await writeFile(resolve(temporary, "heavy-preflight.mjs"), transpiled.outputText, "utf8");
  await writeFile(resolve(temporary, "index.html"), `<!doctype html><meta charset="utf-8"><script type="module">
    import { detectHeavyJobCapabilities, preflightHeavyLocalJob } from "/fixture/heavy-preflight.mjs";
    const policy = { capabilities: { worker: "required", wasm: "required", "image-decode": "required" } };
    globalThis.__heavyPreflightEvidence = {
      capabilities: detectHeavyJobCapabilities(),
      result: preflightHeavyLocalJob(policy),
    };
  </script>`, "utf8");
}

async function heavyAssetNames() {
  const files = await readdir(assetDir);
  const markers = [
    /(?:^|\/)src\/runtime\/heavy-(?:local-job|preflight)\.ts$/u,
    /(?:^|\/)node_modules\/(?:libheif-js|tesseract\.js|pdfjs-dist|mammoth|docx|mediabunny|mp4box)\//u,
    /(?:^|\/)spikes\/heavy-local-feasibility\//u,
  ];
  const assets = [];
  for (const file of files.filter((entry) => entry.endsWith(".js.map"))) {
    const map = JSON.parse(await readFile(resolve(assetDir, file), "utf8"));
    const sources = Array.isArray(map.sources) ? map.sources.map(String) : [];
    if (sources.some((source) => markers.some((marker) => marker.test(source)))) assets.push(file.slice(0, -4));
  }
  return assets.toSorted();
}

function safeDistPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const candidate = resolve(dist, relative.endsWith("/") ? `${relative}index.html` : relative);
  if (candidate !== dist && !candidate.startsWith(`${dist}${sep}`)) return null;
  return candidate;
}

function startServer() {
  return createServer(async (request, response) => {
    try {
      const requestUrl = request.url ?? "/";
      let path;
      if (requestUrl.startsWith("/fixture/")) {
        path = resolve(temporary, requestUrl.replace(/^\/fixture\//u, ""));
        if (path !== temporary && !path.startsWith(`${temporary}${sep}`)) path = null;
      } else {
        path = safeDistPath(requestUrl);
      }
      if (path === null) {
        response.writeHead(403).end("forbidden");
        return;
      }
      const info = await stat(path);
      const finalPath = info.isDirectory() ? resolve(path, "index.html") : path;
      const body = await readFile(finalPath);
      response.writeHead(200, { "content-type": mimeByExtension.get(extname(finalPath)) ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  });
}

async function listen(server) {
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, "127.0.0.1", resolveListen);
  });
}

await compileFixtureModule();
const heavyAssets = await heavyAssetNames();
const server = startServer();
let browser;
try {
  await listen(server);
  browser = await chromium.launch({ headless: true });

  const missingContext = await browser.newContext();
  await missingContext.addInitScript(() => {
    for (const key of ["Worker", "WebAssembly", "createImageBitmap", "ImageDecoder"]) {
      try {
        Object.defineProperty(globalThis, key, { configurable: true, value: undefined, writable: true });
      } catch {
        try { globalThis[key] = undefined; } catch {}
      }
    }
  });
  const missingPage = await missingContext.newPage();
  await missingPage.goto(`${origin}/fixture/index.html`, { waitUntil: "networkidle" });
  const missingFeature = await missingPage.evaluate(() => globalThis.__heavyPreflightEvidence);
  await missingContext.close();

  const lightContext = await browser.newContext();
  const lightPage = await lightContext.newPage();
  const requests = [];
  lightPage.on("request", (request) => requests.push(request.url()));
  const response = await lightPage.goto(`${origin}/tools/business-day/`, { waitUntil: "networkidle" });
  const requestedAssets = [...new Set(requests.map((url) => basename(new URL(url).pathname)).filter(Boolean))].toSorted();
  const requestedHeavyAssets = requestedAssets.filter((asset) => heavyAssets.includes(asset));
  const requestedHeavyBinary = requests.filter((url) => /\.(?:wasm|data|traineddata(?:\.gz)?)$/u.test(new URL(url).pathname));
  await lightContext.close();

  const missingFeaturePass = missingFeature?.result?.state === "unsupported"
    && missingFeature?.capabilities?.worker === false
    && missingFeature?.capabilities?.wasm === false
    && missingFeature?.capabilities?.["image-decode"] === false
    && ["worker", "wasm", "image-decode"].every((item) => missingFeature?.result?.missingRequired?.includes(item));
  const lightRoutePass = response?.status() === 200 && requestedHeavyAssets.length === 0 && requestedHeavyBinary.length === 0;
  const receipt = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    browser: { engine: "chromium", version: browser.version() },
    missingFeature: { status: missingFeaturePass ? "PASS" : "FAIL", evidence: missingFeature },
    lightRouteBundle: {
      status: lightRoutePass ? "PASS" : "FAIL",
      route: "/tools/business-day/",
      httpStatus: response?.status() ?? null,
      identifiedHeavyAssets: heavyAssets,
      requestedHeavyAssets,
      requestedHeavyBinary,
      requestedAssets,
    },
  };
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output, missingFeature: receipt.missingFeature.status, lightRouteBundle: receipt.lightRouteBundle.status, heavyAssets }, null, 2));
  if (!missingFeaturePass || !lightRoutePass) throw new Error("heavy preflight browser acceptance failed");
} finally {
  await browser?.close().catch(() => undefined);
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(temporary, { recursive: true, force: true });
}

import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { build } from "vite";

const root = resolve(import.meta.dirname, "../..");
const temp = await mkdtemp(join(tmpdir(), "utilityos-file-hash-bench-"));
const dist = join(temp, "dist");
const receiptPath = resolve(root, "quality/receipts/file-hash/dependency-benchmark.json");

interface CandidateMeasurement {
  name: string;
  moduleLoadMs: number;
  hashMs: number;
  mibPerSecond: number;
  digestHex: string;
  jsHeapDeltaBytes: number | null;
  resources: Array<{ name: string; transferSize: number; decodedBodySize: number }>;
}

await writeFile(join(temp, "index.html"), '<!doctype html><meta charset="utf-8"><script type="module" src="/bench.ts"></script>\n');
await writeFile(join(temp, "hash-wasm-candidate.ts"), `
  import { createSHA256 } from "hash-wasm";
  export async function run(chunk) {
    const hasher = await createSHA256();
    hasher.init();
    for (let i = 0; i < 64; i += 1) hasher.update(chunk);
    return hasher.digest("hex");
  }
`);
await writeFile(join(temp, "noble-candidate.ts"), `
  import { sha256 } from "@noble/hashes/sha2.js";
  export async function run(chunk) {
    const hasher = sha256.create();
    for (let i = 0; i < 64; i += 1) hasher.update(chunk);
    return Array.from(hasher.digest(), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
`);
await writeFile(join(temp, "bench.ts"), `
  const chunk = new Uint8Array(1024 * 1024);
  for (let i = 0; i < chunk.length; i += 1) chunk[i] = i & 255;
  window.runCandidate = async (name) => {
    const heapBefore = performance.memory?.usedJSHeapSize ?? null;
    const loadStart = performance.now();
    const module = name === "hash-wasm" ? await import("./hash-wasm-candidate") : await import("./noble-candidate");
    const moduleLoadMs = performance.now() - loadStart;
    const hashStart = performance.now();
    const digestHex = await module.run(chunk);
    const hashMs = performance.now() - hashStart;
    const heapAfter = performance.memory?.usedJSHeapSize ?? null;
    return {
      name,
      moduleLoadMs,
      hashMs,
      mibPerSecond: 64 / (hashMs / 1000),
      digestHex,
      jsHeapDeltaBytes: heapBefore === null || heapAfter === null ? null : heapAfter - heapBefore,
    };
  };
`);

await build({
  root: temp,
  configFile: false,
  logLevel: "silent",
  resolve: {
    alias: {
      "hash-wasm": resolve(root, "node_modules/hash-wasm/dist/index.esm.js"),
      "@noble/hashes/sha2.js": resolve(root, "node_modules/@noble/hashes/sha2.js"),
    },
  },
  build: { outDir: dist, emptyOutDir: true },
});

const mime = (path: string) => extname(path) === ".js" ? "text/javascript" : "text/html";
const server = createServer(async (request, response) => {
  const pathname = request.url === "/" ? "/index.html" : (request.url ?? "/index.html");
  try {
    const body = await readFile(join(dist, pathname));
    response.writeHead(200, { "content-type": mime(pathname) });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const address = server.address();
if (address === null || typeof address === "string") throw new Error("benchmark server did not bind a TCP port");
const origin = `http://127.0.0.1:${address.port}`;

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

try {
  const results: CandidateMeasurement[] = [];
  for (const candidate of ["hash-wasm", "noble"] as const) {
    const page = await browser.newPage();
    await page.goto(origin, { waitUntil: "networkidle" });
    const result = await page.evaluate(async (name) => {
      const run = (window as unknown as {
        runCandidate: (candidate: string) => Promise<Omit<CandidateMeasurement, "resources">>;
      }).runCandidate;
      const measured = await run(name);
      const resources = performance.getEntriesByType("resource").map((entry) => {
        const item = entry as PerformanceResourceTiming;
        return { name: item.name, transferSize: item.transferSize, decodedBodySize: item.decodedBodySize };
      });
      return { ...measured, resources };
    }, candidate) as CandidateMeasurement;
    results.push(result);
    await page.close();
  }

  const hashWasm = results[0];
  const noble = results[1];
  if (hashWasm === undefined || noble === undefined) throw new Error("benchmark did not return both candidates");
  if (hashWasm.digestHex !== noble.digestHex) throw new Error("candidate digests disagreed");
  await mkdir(resolve(root, "quality/receipts/file-hash"), { recursive: true });
  const receipt = {
    schemaVersion: 1,
    environment: "Google Chrome headless via Playwright",
    payload: "64 MiB incremental SHA-256 using one reusable 1 MiB chunk",
    candidates: {
      "hash-wasm": { version: "4.12.0", license: "MIT" },
      "@noble/hashes": { version: "2.4.0", license: "MIT" },
    },
    results,
    decision: "hash-wasm",
    evaluationOnly: "@noble/hashes",
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await browser.close();
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  await rm(temp, { recursive: true, force: true });
}

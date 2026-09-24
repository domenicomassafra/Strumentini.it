import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const updateBaseline = process.argv.includes("--update-baseline");
const dist = resolve(root, "dist");
const assetDir = resolve(dist, "_astro");
const generatedDir = resolve(root, "src/generated");
const pagePath = resolve(dist, "tools/business-day/index.html");
const page = await readFile(pagePath, "utf8");
const files = await readdir(assetDir);
const jsFiles = files.filter((file) => file.endsWith(".js"));
const jsStats = await Promise.all(
  jsFiles.map(async (file) => ({ file, bytes: (await stat(resolve(assetDir, file))).size, text: await readFile(resolve(assetDir, file), "utf8") })),
);
const jsByFile = new Map(jsStats.map((entry) => [entry.file, entry]));

async function sourceMapSources(file: string): Promise<string[]> {
  const map = await readFile(resolve(assetDir, `${file}.map`), "utf8").catch(() => "");
  if (map === "") return [];
  try {
    const parsed = JSON.parse(map) as { sources?: unknown };
    return Array.isArray(parsed.sources) ? parsed.sources.map((source) => String(source)) : [];
  } catch {
    return [];
  }
}

const sourceMapEntries = new Map(await Promise.all(
  jsFiles.map(async (file) => [file, await sourceMapSources(file)] as const),
));

const implementationAssets = [...sourceMapEntries.entries()]
  .filter(([, sources]) => sources.some((source) => /(?:^|\/)src\/tools\/[^/]+\/module\.ts$/u.test(source)))
  .map(([file]) => file)
  .sort();
const workerAssets = files.filter((file) => /worker(?!-client).*\.js$/u.test(file)).sort();
const workerClientAssets = files.filter((file) => /worker-client.*\.js$/u.test(file)).sort();
const wasmAssets = files.filter((file) => file.endsWith(".wasm")).sort();
const implementationSet = new Set(implementationAssets);
const workerSet = new Set(workerAssets);
const wasmSet = new Set(wasmAssets);

function directAssets(html: string): string[] {
  const assets = new Set<string>();
  for (const match of html.matchAll(/(?:src|component-url|href)="\/([^"]+\.js)"/gu)) {
    const file = basename(match[1] ?? "");
    if (file !== "") assets.add(file);
  }
  return [...assets];
}

function staticAssetGraph(start: readonly string[]): string[] {
  const seen = new Set<string>();
  const pending = [...start];
  while (pending.length > 0) {
    const file = pending.pop();
    if (file === undefined || seen.has(file) || !jsByFile.has(file)) continue;
    seen.add(file);
    const text = jsByFile.get(file)?.text ?? "";
    for (const match of text.matchAll(/\b(?:from|import)\s*["']([^"']+\.js)["']/gu)) {
      const dependency = basename(match[1] ?? "");
      if (dependency !== "") pending.push(dependency);
    }
  }
  return [...seen].sort();
}

function routeInspection(route: string): Record<string, unknown> {
  const html = readFileSyncText(route);
  const direct = directAssets(html);
  const initial = staticAssetGraph(direct);
  const initialSources = [...new Set(initial.flatMap((file) => sourceMapEntries.get(file) ?? []))];
  const initialImplementationAssets = initial.filter((file) => implementationSet.has(file));
  const initialWorkerAssets = initial.filter((file) => workerSet.has(file));
  const initialWasmAssets = initial.filter((file) => wasmSet.has(file));
  const initialParserAssets = initial.filter((file) => {
    const sources = sourceMapEntries.get(file) ?? [];
    return sources.some((source) => /(?:^|\/)src\/engines\/table\/csv\.ts$/u.test(source)) || /papaparse/iu.test(jsByFile.get(file)?.text ?? "");
  });
  const initialGeneratedSources = initialSources.filter((source) => /(?:^|\/)src\/generated\//u.test(source));
  const initialFullCatalogSources = initialGeneratedSources.filter((source) => /(?:^|\/)(?:catalog|tool-loaders)\.ts$/u.test(source));
  const initialBytes = initial.reduce((sum, file) => sum + (jsByFile.get(file)?.bytes ?? 0), 0);
  const failures: string[] = [];
  if (initialImplementationAssets.length > 0) failures.push("implementation-assets");
  if (initialWorkerAssets.length > 0) failures.push("worker-assets");
  if (initialWasmAssets.length > 0) failures.push("wasm-assets");
  if (initialParserAssets.length > 0) failures.push("table-parser-assets");
  if (initialFullCatalogSources.length > 0) failures.push("full-catalog-assets");
  return {
    route,
    htmlBytes: Buffer.byteLength(html),
    directScripts: direct,
    initialAssets: initial,
    initialJsBytes: initialBytes,
    initialSources,
    initialGeneratedSources,
    initialFullCatalogSources,
    initialImplementationAssets,
    initialWorkerAssets,
    initialWasmAssets,
    initialParserAssets,
    gate: failures.length === 0 ? "PASS" : "FAIL",
    failures,
  };
}

function readFileSyncText(route: string): string {
  return readFileSync(resolve(dist, route), "utf8");
}

const routePaths = [
  "index.html",
  "library/index.html",
  "tools/business-day/index.html",
  "tools/csv-dedupe/index.html",
  "tools/image-resize/index.html",
  ...(existsSync(resolve(dist, "test.html")) ? ["test.html"] : []),
];
const routes = routePaths.map((route) => routeInspection(route));

const generatedNames = ["catalog.ts", "tool-loaders.ts", "search-catalog.ts", "workbench-catalog.ts", "runtime-tool-index.ts", "handoff-catalog.ts"];
const generatedBytes = Object.fromEntries(await Promise.all(generatedNames.map(async (name) => [name, (await stat(resolve(generatedDir, name))).size] as const)));
const generatedText = await Promise.all(generatedNames.map((name) => readFile(resolve(generatedDir, name), "utf8")));

function parseGeneratedArray(name: string, text: string): unknown[] {
  const marker = `export const ${name} = `;
  const start = text.indexOf(marker);
  if (start < 0) return [];
  const valueStart = start + marker.length;
  const end = text.indexOf(" as const", valueStart);
  if (end < 0) return [];
  return JSON.parse(text.slice(valueStart, end)) as unknown[];
}

const catalogCount = parseGeneratedArray("catalog", generatedText[0] ?? "").length;
const searchCount = parseGeneratedArray("searchCatalog", generatedText[2] ?? "").length;
const workbenchCount = parseGeneratedArray("workbenchCatalog", generatedText[3] ?? "").length;
const runtimeIndexCount = parseGeneratedArray("runtimeToolIndex", generatedText[4] ?? "").length;
const handoffCount = parseGeneratedArray("handoffCatalog", generatedText[5] ?? "").length;
const productionNetworkApiFiles: string[] = [];
const toolsRoot = resolve(root, "src/tools");
async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.(?:ts|tsx|mjs|js)$/u.test(entry.name)) files.push(path);
  }
  return files;
}
for (const path of await sourceFiles(toolsRoot)) {
  const source = await readFile(path, "utf8");
  if (/fetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|new\s+EventSource/u.test(source)) {
    productionNetworkApiFiles.push(path.slice(root.length + 1));
  }
}

const routeFailures = routes.flatMap((route) => {
  const value = route as { route: string; gate: string; failures: string[] };
  return value.gate === "PASS" ? [] : [`${value.route}:${value.failures.join(",")}`];
});
const auditFailures = [
  ...routeFailures,
  ...(productionNetworkApiFiles.length === 0 ? [] : [`network-api:${productionNetworkApiFiles.join(",")}`]),
];
const status = routeFailures.length === 0 && catalogCount === searchCount && searchCount === workbenchCount && searchCount === runtimeIndexCount && productionNetworkApiFiles.length === 0 ? "PASS" : "FAIL";
const baseline = JSON.parse(await readFile(resolve(root, "quality/receipts/build-baseline.json"), "utf8")) as { totalJsBytes: number; jsAssetCount: number };
const totalJsBytes = jsStats.reduce((sum, entry) => sum + entry.bytes, 0);
const receipt = {
  schemaVersion: 1,
  status,
  portableReceipt: { path: "quality/receipts/catalog-performance.json", absolutePaths: false },
  generatedAt: new Date().toISOString(),
  catalog: {
    toolCount: catalogCount,
    searchCount,
    workbenchCount,
    runtimeIndexCount,
    handoffCount,
    generatedBytes,
  },
  routes,
  boundaries: {
    implementationAssetCount: implementationAssets.length,
    workerAssets,
    workerClientAssets,
    wasmAssets,
    productionNetworkApiFiles,
    lazyImplementationAssets: implementationAssets.filter((file) => !routes.some((route) => (route as { initialImplementationAssets: string[] }).initialImplementationAssets.includes(file))),
  },
  historicalBuildBaseline: {
    jsAssetCount: baseline.jsAssetCount,
    totalJsBytes: baseline.totalJsBytes,
    currentJsAssetCount: jsStats.length,
    currentTotalJsBytes: totalJsBytes,
    currentDeltaBytes: totalJsBytes - baseline.totalJsBytes,
    currentDeltaPercent: baseline.totalJsBytes === 0 ? null : ((totalJsBytes - baseline.totalJsBytes) / baseline.totalJsBytes) * 100,
  },
  failures: auditFailures,
};

if (updateBaseline) {
  await mkdir(resolve(root, "quality/receipts"), { recursive: true });
  await writeFile(
    resolve(root, "quality/receipts/build-baseline.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      page: "tools/business-day/index.html",
      htmlBytes: Buffer.byteLength(page),
      jsAssetCount: jsStats.length,
      totalJsBytes,
      initialScriptFiles: directAssets(page),
      businessDayEngineChunks: jsStats.filter((entry) => entry.text.includes("INVALID_WORKWEEK")).map(({ file, bytes }) => ({ file, bytes })),
      unrelatedToolChunks: implementationAssets.filter((file) => !directAssets(page).includes(file)),
    }, null, 2)}\n`,
    "utf8",
  );
}

await mkdir(resolve(root, "quality/receipts"), { recursive: true });
await writeFile(resolve(root, "quality/receipts/catalog-performance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
if (status !== "PASS") throw new Error(`catalog performance audit failed: ${auditFailures.join("; ")}`);
console.log(`catalog performance audit PASS: ${catalogCount} tool(s); ${implementationAssets.length} lazy implementation asset(s); heavy boundaries remain lazy`);

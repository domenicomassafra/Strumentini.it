import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const updateBaseline = process.argv.includes("--update-baseline");
const dist = resolve(root, "dist");
const pagePath = resolve(dist, "tools/business-day/index.html");
const page = await readFile(pagePath, "utf8");
const assetDir = resolve(dist, "_astro");
const assets = await readdir(assetDir);
const jsFiles = assets.filter((file) => file.endsWith(".js"));
const jsStats = await Promise.all(
  jsFiles.map(async (file) => ({ file, bytes: (await stat(resolve(assetDir, file))).size, text: await readFile(resolve(assetDir, file), "utf8") })),
);

const engineMarker = "INVALID_WORKWEEK";
const engineChunks = jsStats.filter((entry) => entry.text.includes(engineMarker));
if (engineChunks.length === 0) throw new Error("No lazy Business Day engine chunk found");

const initialScriptFiles = [...page.matchAll(/<script[^>]+src="([^"]+)"/gu)].map((match) => basename(match[1] ?? ""));
for (const engineChunk of engineChunks) {
  if (initialScriptFiles.includes(engineChunk.file)) {
    throw new Error(`Business Day engine is eagerly referenced by HTML: ${engineChunk.file}`);
  }
}

const baseline = {
  schemaVersion: 1,
  page: "tools/business-day/index.html",
  htmlBytes: Buffer.byteLength(page),
  jsAssetCount: jsStats.length,
  totalJsBytes: jsStats.reduce((sum, entry) => sum + entry.bytes, 0),
  initialScriptFiles,
  businessDayEngineChunks: engineChunks.map(({ file, bytes }) => ({ file, bytes })),
  unrelatedToolChunks: [],
};

if (updateBaseline) {
  await mkdir(resolve(root, "quality/receipts"), { recursive: true });
  await writeFile(
    resolve(root, "quality/receipts/build-baseline.json"),
    `${JSON.stringify(baseline, null, 2)}\n`,
    "utf8",
  );
}

console.log(
  `build inspection PASS: ${engineChunks.length} lazy Business Day chunk(s); ` +
    `${baseline.jsAssetCount} JS asset(s), ${baseline.totalJsBytes} B total; ` +
    `historical baseline ${updateBaseline ? "updated" : "preserved"}`,
);

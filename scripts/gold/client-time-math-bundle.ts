import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const assets = resolve(root, "dist/_astro");
const files = await readdir(assets);
const engineChunk = files.find((file) => /^client-time-math\.[^.]+\.js$/u.test(file));
if (engineChunk === undefined) throw new Error("shared client-time-math chunk not found");

const toolIds = ["timezone-overlap", "rate-converter", "margin-markup"] as const;
const moduleChunks: Partial<Record<(typeof toolIds)[number], string>> = {};
for (const mapFile of files.filter((file) => file.endsWith(".js.map"))) {
  const map = JSON.parse(await readFile(resolve(assets, mapFile), "utf8")) as { sources?: string[] };
  for (const id of toolIds) {
    if (map.sources?.some((source) => source.includes(`/src/tools/${id}/module.ts`))) {
      moduleChunks[id] = mapFile.replace(/\.map$/u, "");
    }
  }
}

for (const id of toolIds) {
  const chunk = moduleChunks[id];
  if (chunk === undefined) throw new Error(`${id}: module chunk not found`);
  const chunkText = await readFile(resolve(assets, chunk), "utf8");
  if (!chunkText.includes(engineChunk)) throw new Error(`${id}: does not import shared ${engineChunk}`);
  const html = await readFile(resolve(root, `dist/tools/${id}/index.html`), "utf8");
  if (html.includes(engineChunk)) throw new Error(`${id}: shared engine eagerly referenced by route HTML`);
}

await mkdir(resolve(root, "quality/receipts/client-time-math"), { recursive: true });
await writeFile(
  resolve(root, "quality/receipts/client-time-math/bundle.json"),
  `${JSON.stringify({
    schemaVersion: 1,
    status: "PASS",
    sharedEngineChunk: engineChunk,
    moduleChunks,
    eagerEngineReferences: 0,
  }, null, 2)}\n`,
);
console.log(`client/time/math bundle PASS: ${engineChunk} shared lazily by 3 tools`);

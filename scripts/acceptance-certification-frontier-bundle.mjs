import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const tools = [
  "ai-code-fence-bundle",
  "file-size-analyzer",
  "fatturapa-reader",
  "pdf-multi-text-search",
  "pdf-to-markdown",
  "color-blindness-image-simulation",
  "barcode-generator",
  "audio-generator",
  "browser-text-to-speech",
  "subtitle-srt-vtt-transform",
  "microphone-recorder",
];

function assetRefs(html) {
  return [...new Set([...html.matchAll(/\/_astro\/[^"'\s>]+\.js/gu)].map((match) => match[0]))];
}

const homeHtml = await readFile(resolve(dist, "index.html"), "utf8");
const homeScripts = new Set(assetRefs(homeHtml));
const assets = await readdir(resolve(dist, "_astro"));
const initialTexts = await Promise.all([...homeScripts].map(async (path) => {
  const name = path.split("/").at(-1);
  return name && assets.includes(name) ? readFile(resolve(dist, "_astro", name), "utf8") : "";
}));
const results = [];
for (const toolId of tools) {
  const routeHtml = await readFile(resolve(dist, "tools", toolId, "index.html"), "utf8");
  const routeScripts = assetRefs(routeHtml);
  const routeOnlyScripts = routeScripts.filter((path) => !homeScripts.has(path));
  if (routeOnlyScripts.length < 1) throw new Error(`${toolId}: route has no script isolated from home initial scripts`);
  if (initialTexts.some((text) => text.includes(toolId))) throw new Error(`${toolId}: tool id marker appears in home initial JS`);
  results.push({ toolId, routeOnlyScriptCount: routeOnlyScripts.length, routeOnlyScripts });
}
const receipt = {
  schemaVersion: 1,
  status: "PASS",
  tools,
  implementationEager: false,
  check: "each tool route has at least one JS script absent from home initial scripts; home initial JS contains no tool-id marker",
  homeInitialScripts: [...homeScripts],
  results,
};
const outputDir = resolve(root, "quality/receipts/certification-frontier");
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "bundle-isolation.json"), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`certification frontier bundle isolation PASS: ${results.length} tools`);

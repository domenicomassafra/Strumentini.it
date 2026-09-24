import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { catalog } from "../src/generated/catalog";

const root = resolve(import.meta.dirname, "..");
const updateBaseline = process.argv.includes("--update-baseline");
const dist = resolve(root, "dist");
const pagePath = resolve(dist, "tools/business-day/index.html");
const page = await readFile(pagePath, "utf8");

async function collectHtmlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtmlFiles(path));
    else if (entry.name === "index.html") files.push(path);
  }
  return files;
}

const htmlFiles = await collectHtmlFiles(dist);
const htmlPages = await Promise.all(htmlFiles.map(async (path) => ({ path, html: await readFile(path, "utf8") })));
const pageMetadata = htmlPages.map(({ path, html }) => ({
  path,
  title: html.match(/<title>([^<]*)<\/title>/u)?.[1] ?? "",
  description: html.match(/<meta name="description" content="([^"]*)"/u)?.[1] ?? "",
  canonical: html.match(/<link rel="canonical" href="([^"]+)"/u)?.[1] ?? "",
  ogTitle: html.match(/<meta property="og:title" content="([^"]+)"/u)?.[1] ?? "",
  jsonLd: html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/u)?.[1] ?? "",
  h1: html.match(/<h1\b[^>]*>/u)?.[0] ?? "",
}));
const expectedPageCount = catalog.length + 2;
if (htmlPages.length !== expectedPageCount) throw new Error(`Expected ${expectedPageCount} HTML pages, found ${htmlPages.length}`);
for (const metadata of pageMetadata) {
  if (metadata.title === "" || metadata.description === "" || metadata.canonical === "" || metadata.ogTitle === "" || metadata.jsonLd === "" || metadata.h1 === "") {
    throw new Error(`Incomplete discovery metadata: ${metadata.path}`);
  }
  if (metadata.canonical.includes("localhost") || metadata.jsonLd.includes("localhost")) throw new Error(`Localhost URL leaked into discovery metadata: ${metadata.path}`);
  try {
    JSON.parse(metadata.jsonLd);
  } catch {
    throw new Error(`Invalid JSON-LD: ${metadata.path}`);
  }
}
const titles = pageMetadata.map(({ title }) => title);
const descriptions = pageMetadata.map(({ description }) => description);
if (new Set(titles).size !== titles.length) throw new Error("Rendered page titles are not unique");
if (new Set(descriptions).size !== descriptions.length) throw new Error("Rendered page descriptions are not unique");
const sitemap = await readFile(resolve(dist, "sitemap.xml"), "utf8");
const sitemapLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1] ?? "");
if (sitemapLocations.length !== expectedPageCount || new Set(sitemapLocations).size !== expectedPageCount) throw new Error("Sitemap does not contain one unique entry per public page");
if (sitemapLocations.some((location) => location.includes("localhost"))) throw new Error("Localhost URL leaked into sitemap");
for (const tool of catalog) if (!sitemap.includes(tool.route)) throw new Error(`Sitemap is missing ${tool.route}`);
const robots = await readFile(resolve(dist, "robots.txt"), "utf8");
if (!robots.includes("User-agent: *") || !robots.includes("Allow: /") || !robots.includes("Sitemap:")) throw new Error("robots.txt is missing public discovery directives");
if (robots.includes("localhost")) throw new Error("Localhost URL leaked into robots.txt");
const discoveryUrlMode = sitemapLocations.every((location) => /^https?:\/\//u.test(location))
  ? "absolute discovery URLs"
  : "relative discovery URLs (set SITE_URL for public deployment)";

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
    `${htmlPages.length} unique metadata page(s); ` +
    `${discoveryUrlMode}; ` +
    `historical baseline ${updateBaseline ? "updated" : "preserved"}`,
);

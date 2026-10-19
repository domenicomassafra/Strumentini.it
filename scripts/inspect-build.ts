import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { catalog } from "../src/generated/catalog";
import { groups } from "../src/catalog/groups";
import { publicIndexPaths } from "../src/seo/public-discovery";

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
// An explicitly scoped, non-catalog experiment may be pre-rendered only while
// noindex/nofollow, invisible to search/sitemap and visibly bounded. This is
// NOT a tool promotion or an open-ended allowance for stray public routes.
const designStudyPath = "prototipi/351/index.html";
const fiscalBoundedPath = "tools/calcoli-fiscali-italia/index.html";
const pdfOcr247Path = "tools/pdf-scansionato-ocr-247/index.html";
const previewOnlyPaths = [
  "tools/codice-fiscale/index.html",
  "tools/iva-calcolo/index.html",
  "tools/irpef-annuale/index.html",
  "tools/irpef-componenti/index.html",
  "tools/stipendio-netto/index.html",
  "tools/ocr-italiano-locale-246/index.html",
  pdfOcr247Path,
  designStudyPath,
  fiscalBoundedPath,
] as const;
for (const previewPath of previewOnlyPaths) {
  const route = `/${previewPath.replace(/\/index\.html$/u, "")}`;
  if (catalog.some((tool) => tool.route.replace(/\/+$/u, "") === route.replace(/\/+$/u, "")) ||
      publicIndexPaths.some((path) => path.replace(/\/+$/u, "") === route.replace(/\/+$/u, ""))) {
    throw new Error(`Unreviewed preview route promoted into index/catalog: ${previewPath}`);
  }
  const preview = htmlPages.find(({ path }) => relative(dist, path).replaceAll("\\", "/") === previewPath)?.html;
  const sourceSafe = previewPath === "tools/codice-fiscale/index.html"
    ? preview?.includes('data-cf-canonical-route="/tools/codice-fiscale/"') &&
      preview.includes("ANPR") && preview.includes("Agenzia delle Entrate")
    : previewPath === "tools/iva-calcolo/index.html"
      ? preview?.includes("data-tax-iva") && preview.includes("13") &&
        preview.includes("dicembre 2025") && preview.includes("categorie") &&
        preview.includes("Calcolo locale")
    : previewPath === "tools/irpef-annuale/index.html"
      ? preview?.includes("data-irpef-annuale") && preview.includes("imposta finale modellata") &&
        preview.includes("2025") && preview.includes("2026") &&
        preview.includes("Puglia") && preview.includes("Bari") &&
        preview.includes("non sono calcolate") && preview.includes("Normattiva")
    : previewPath === "tools/stipendio-netto/index.html"
      ? preview?.includes("data-salary-estimate-13") && preview.includes("stima parziale") &&
        preview.includes("cedolino") && preview.includes("IRPEF") &&
        preview.includes("2025") && preview.includes("2026")
    : previewPath === "tools/irpef-componenti/index.html"
      ? preview?.includes("data-irpef-components") && preview.includes("2025") &&
        preview.includes("Puglia") && preview.includes("Bari") &&
        preview.includes("risultato parziale")
    : previewPath === fiscalBoundedPath
      ? preview?.includes('data-fiscal-t1') &&
        preview.includes("Stipendio netto annuo") &&
        preview.includes("Regime forfettario 2025") &&
        preview.includes("TFR maturato e rivalutazione") &&
        preview.includes("Bollo in fattura") &&
        preview.includes("Le fonti valgono per gli anni")
    : previewPath === pdfOcr247Path
      ? preview?.includes('data-ocr247-preview="experimental-local-only"') &&
        preview.includes("PDF scansionato con testo selezionabile")
    : previewPath === designStudyPath
      ? ["minimal", "editorial", "workspace"].every((direction) => preview?.includes(`data-direction="${direction}"`)) &&
        preview?.includes("nessuna scelta approvata") && preview.includes("Studio isolato:") &&
        /<title>[^<]+<\/title>/u.test(preview) && /<h1\b/u.test(preview)
      : preview?.includes('data-ocr246-preview="experimental-local-only"') &&
      preview.toLowerCase().includes("sperimentale") &&
      preview.toLowerCase().includes("browser");
  const robotsSafe = previewPath === designStudyPath
    ? /<meta name="robots" content="noindex, nofollow, noarchive"\s*\/?\s*>/u.test(preview ?? "")
    : /<meta name="robots" content="noindex, nofollow"\s*\/?\s*>/u.test(preview ?? "");
  if (preview === undefined || !robotsSafe || !sourceSafe) {
    throw new Error(`Expected source-limited, noindex-only preview missing or unsafe: ${previewPath}`);
  }
}
// The catalogue, the indexable routes the sitemap advertises, the content pages
// that are deliberately left out of the sitemap (the per-group category islands
// and the account/utility pages) and the legacy /library redirects that keep
// inbound links alive. Anything else is a stray page and must fail the gate.
const expectedPaths = new Set([
  ...catalog.map((tool) => `${tool.route.replace(/^\/+/u, "").replace(/\/+$/u, "")}/index.html`),
  ...publicIndexPaths.map((route) => route === "/" ? "index.html" : `${route.replace(/^\/+/u, "").replace(/\/+$/u, "")}/index.html`),
  "accedi/index.html",
  "cerca/index.html",
  "impostazioni/index.html",
  "preferiti/index.html",
  "codici-geografici-italia/index.html",
  "fonti-fiscali-italia/index.html",
  ...groups.map((group) => `categorie/${group.slug}/index.html`),
  "library/index.html",
  ...previewOnlyPaths,
]);
const actualPaths = new Set(htmlFiles.map((path) => relative(dist, path).replaceAll("\\", "/")));
const unexpectedPages = [...actualPaths].filter((path) => !expectedPaths.has(path)).sort();
const missingPages = [...expectedPaths].filter((path) => !actualPaths.has(path)).sort();
if (unexpectedPages.length > 0 || missingPages.length > 0) {
  throw new Error(`Unexpected HTML page set (missing: ${missingPages.join(", ") || "none"}; unexpected: ${unexpectedPages.join(", ") || "none"})`);
}
// Redirect stubs intentionally carry a meta refresh and no discovery metadata.
const isRedirectStub = (html: string) => /http-equiv="refresh"/u.test(html);
for (const { path, html } of htmlPages) {
  const isExpectedRedirect = relative(dist, path).replaceAll("\\", "/") === "library/index.html";
  if (isRedirectStub(html) !== isExpectedRedirect) throw new Error(`Unexpected redirect page: ${path}`);
}
const pageMetadata = htmlPages.filter(({ path, html }) => !isRedirectStub(html) &&
  relative(dist, path).replaceAll("\\", "/") !== designStudyPath).map(({ path, html }) => ({
  path,
  title: html.match(/<title>([^<]*)<\/title>/u)?.[1] ?? "",
  description: html.match(/<meta name="description" content="([^"]*)"/u)?.[1] ?? "",
  canonical: html.match(/<link rel="canonical" href="([^"]+)"/u)?.[1] ?? "",
  ogTitle: html.match(/<meta property="og:title" content="([^"]+)"/u)?.[1] ?? "",
  jsonLd: html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/u)?.[1] ?? "",
  h1: html.match(/<h1\b[^>]*>/u)?.[0] ?? "",
}));
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
// `/categorie/<slug>` is an indexable destination, exactly as `sitemap.xml.ts` declares it.
const indexablePaths = [...publicIndexPaths, ...groups.map((group) => `/categorie/${group.slug}`), ...catalog.map((tool) => tool.route)]
  .map((route) => route === "/" ? "/" : `${route.replace(/\/+$/u, "")}/`)
  .sort();
const sitemapPaths = sitemapLocations.map((location) => decodeURIComponent(new URL(location, "https://build.invalid").pathname)).sort();
if (sitemapPaths.some((path) => previewOnlyPaths.some((preview) => path === `/${preview.replace(/index\.html$/u, "")}`))) {
  throw new Error("Noindex preview leaked into public sitemap discovery");
}
if (indexablePaths.length !== new Set(indexablePaths).size) throw new Error("Indexable routes are not unique");
if (sitemapPaths.length !== indexablePaths.length || sitemapPaths.some((path, index) => path !== indexablePaths[index])) {
  throw new Error("Sitemap does not contain one unique entry per indexable page");
}
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

const initialScriptFiles = [...new Set(
  [...page.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.js[^"]*)"/gu)]
    .map((match) => basename((match[1] ?? "").split("?")[0] ?? ""))
    .filter(Boolean),
)];
const initialJsStats = jsStats.filter((entry) => initialScriptFiles.includes(entry.file));
const initialJsBytes = initialJsStats.reduce((sum, entry) => sum + entry.bytes, 0);
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
  initialJsBytes,
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
    `${baseline.jsAssetCount} JS asset(s), ${baseline.totalJsBytes} B total, ${baseline.initialJsBytes} B initial route JS; ` +
    `${pageMetadata.length} unique metadata page(s), ${sitemapLocations.length} sitemap entry(ies); ` +
    `${discoveryUrlMode}; ` +
    `historical baseline ${updateBaseline ? "updated" : "preserved"}`,
);

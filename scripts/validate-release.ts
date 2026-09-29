import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir, mkdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import type {
  PublicMetadataSurface,
  PublicSource,
  ReleaseCatalogEntry,
  ReleaseValidationInput,
  StaticAssetSurface,
  ToolCertificationReceipt,
} from "../src/release/validation";
import {
  createUnprovenRollbackReceipt,
  extractPublicMetadata,
  validateRelease,
} from "../src/release/validation";
import { currentEvidenceSourceFingerprint } from "./lib/current-revision";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const distRoot = resolve(root, "dist");
const args = new Set(process.argv.slice(2));
const requireReady = args.has("--require-ready");
const writeReceipts = !args.has("--no-write-receipt");
const receiptDirectory = resolve(root, process.argv.find((value) => value.startsWith("--receipt-dir="))?.slice("--receipt-dir=".length) ?? "quality/receipts/release");
const defaultSite = new URL("https://strumentiutili.it");

async function git(...command: string[]): Promise<string> {
  const result = await execFileAsync("git", command, { cwd: root });
  return result.stdout.trim();
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

async function relativeFiles(directory: string): Promise<string[]> {
  const files = await walk(directory);
  return files.map((path) => relative(root, path).replaceAll("\\", "/"));
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function isVerifiedRollback(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && (value as Record<string, unknown>).status === "VERIFIED";
}

async function loadCatalog(): Promise<ReleaseCatalogEntry[]> {
  const generatedPath = resolve(root, "src/generated/catalog.ts");
  if (await pathExists(generatedPath)) {
    const generated = await import(`${pathToFileURL(generatedPath).href}?release=${Date.now()}`) as { catalog?: unknown };
    if (Array.isArray(generated.catalog)) return generated.catalog as ReleaseCatalogEntry[];
  }
  const manifestFiles = (await relativeFiles(resolve(root, "src/tools"))).filter((path) => path.endsWith("/manifest.ts"));
  const entries = await Promise.all(manifestFiles.map(async (path, index) => {
    const module = await import(`${pathToFileURL(resolve(root, path)).href}?release=${Date.now()}-${index}`) as { default?: { id?: unknown; route?: unknown } };
    if (typeof module.default?.id !== "string" || typeof module.default.route !== "string") throw new Error(`${path}: invalid manifest shape`);
    return { id: module.default.id, route: module.default.route };
  }));
  return entries;
}

async function loadGoldReceipts(): Promise<ToolCertificationReceipt[]> {
  const files = await walk(resolve(root, "quality/receipts"));
  const receipts: ToolCertificationReceipt[] = [];
  for (const path of files.filter((file) => file.endsWith(".json"))) {
    const value = await readJson(path);
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (typeof record.toolId !== "string" || typeof record.status !== "string") continue;
    const fixtureFamilies = Array.isArray(record.fixtureFamilies) && record.fixtureFamilies.every((value): value is string => typeof value === "string") ? record.fixtureFamilies : undefined;
    const oracleEntryIds = Array.isArray(record.oracleEntryIds) && record.oracleEntryIds.every((value): value is string => typeof value === "string") ? record.oracleEntryIds : undefined;
    const identities = typeof record.identities === "object" && record.identities !== null && !Array.isArray(record.identities)
      ? Object.fromEntries(Object.entries(record.identities as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string")) as Record<string, string>
      : undefined;
    receipts.push({
      toolId: record.toolId,
      status: record.status,
      ...(typeof record.schemaVersion === "number" ? { schemaVersion: record.schemaVersion } : {}),
      ...(record.runtime === undefined ? {} : { runtime: record.runtime }),
      ...(typeof record.oracleEntryId === "string" ? { oracleEntryId: record.oracleEntryId } : {}),
      ...(oracleEntryIds === undefined ? {} : { oracleEntryIds }),
      ...(fixtureFamilies === undefined ? {} : { fixtureFamilies }),
      ...(identities === undefined ? {} : { identities }),
      ...(typeof record.goldEligible === "boolean" ? { goldEligible: record.goldEligible } : {}),
      ...(typeof record.revision === "string" ? { revision: record.revision } : {}),
      ...(typeof record.sourceFingerprint === "string" ? { sourceFingerprint: record.sourceFingerprint } : {}),
    });
  }
  return receipts;
}

async function loadPublicSources(): Promise<PublicSource[]> {
  const paths = [
    ...await relativeFiles(resolve(root, "src/pages")),
    "src/layouts/BaseLayout.astro",
    "src/components/shell/ShellChrome.astro",
  ].filter((path, index, values) => path.endsWith(".astro") && values.indexOf(path) === index);
  const sources: PublicSource[] = [];
  for (const path of paths) {
    sources.push({ path, text: await readFile(resolve(root, path), "utf8") });
  }
  return sources;
}

async function loadMetadata(catalog: readonly ReleaseCatalogEntry[], site: URL): Promise<{
  readonly surfaces: { readonly path: string; readonly surface: PublicMetadataSurface; readonly expectedCanonical: string }[];
  readonly sitemap?: { readonly xml: string; readonly expectedUrls: readonly string[]; readonly path: string };
  readonly robots?: { readonly text: string; readonly expectedSitemapUrl: string; readonly path: string };
}> {
  const paths = [
    "index.html",
    "library/index.html",
    "404.html",
    ...catalog.map((entry) => `${entry.route.replace(/^\/+/u, "").replace(/\/+$/u, "")}/index.html`),
  ];
  const surfaces: { path: string; surface: PublicMetadataSurface; expectedCanonical: string }[] = [];
  for (const path of paths) {
    const absolute = resolve(distRoot, path);
    if (!(await pathExists(absolute))) continue;
    const route = path === "index.html" ? "/" : path === "404.html" ? "/404/" : `/${path.replace(/\/index\.html$/u, "/")}`;
    surfaces.push({
      path: `dist/${path}`,
      surface: extractPublicMetadata(await readFile(absolute, "utf8")),
      expectedCanonical: new URL(route, site).href,
    });
  }
  const sitemapPath = resolve(distRoot, "sitemap.xml");
  const robotsPath = resolve(distRoot, "robots.txt");
  const routes = ["/", "/library/", "/onboarding/", ...catalog.map((entry) => entry.route)];
  const expectedUrls = routes.map((route) => new URL(route === "/" ? "/" : `${route.replace(/\/+$/u, "")}/`, site).href);
  const sitemap = await pathExists(sitemapPath) ? {
    xml: await readFile(sitemapPath, "utf8"),
    expectedUrls,
    path: "dist/sitemap.xml",
  } : undefined;
  const robots = await pathExists(robotsPath) ? {
    text: await readFile(robotsPath, "utf8"),
    expectedSitemapUrl: new URL("sitemap.xml", site).href,
    path: "dist/robots.txt",
  } : undefined;
  return { surfaces, ...(sitemap === undefined ? {} : { sitemap }), ...(robots === undefined ? {} : { robots }) };
}

async function loadPhysicalReceipts(): Promise<unknown[]> {
  const paths = [
    resolve(root, "quality/receipts/image-resize/ios-safari-physical.json"),
    resolve(root, "quality/receipts/image-resize/android-chrome-physical.json"),
  ];
  const receipts: unknown[] = [];
  for (const path of paths) {
    const value = await readJson(path);
    if (value !== undefined) receipts.push(value);
  }
  return receipts;
}

async function inventoryHash(files: readonly string[]): Promise<string> {
  const hash = createHash("sha256");
  for (const file of [...files].sort()) {
    hash.update(file);
    hash.update(await readFile(resolve(distRoot, file)));
  }
  return hash.digest("hex");
}

async function main(): Promise<void> {
  const revision = await git("rev-parse", "HEAD").catch(() => "unknown");
  const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
  const workingTreeDirty = (await git("status", "--porcelain").catch(() => "")).length > 0;
  const catalog = await loadCatalog();
  const manifestFiles = (await relativeFiles(resolve(root, "src/tools"))).filter((path) => path.endsWith("/manifest.ts"));
  const toolPageFiles = (await relativeFiles(resolve(root, "src/pages/tools"))).filter((path) => path.endsWith(".astro"));
  const siteUrl = process.env.PUBLIC_SITE_URL ?? defaultSite.href;
  let site: URL;
  try {
    site = new URL(siteUrl);
  } catch {
    site = defaultSite;
  }
  const distExists = await pathExists(distRoot);
  const distFiles = distExists ? (await walk(distRoot)).map((path) => relative(distRoot, path).replaceAll("\\", "/")) : [];
  const metadata = distExists ? await loadMetadata(catalog, site) : { surfaces: [] };
  const rollbackPath = resolve(receiptDirectory, "rollback.json");
  const existingRollback = await readJson(rollbackPath);
  const rollbackReceipt = isVerifiedRollback(existingRollback) ? existingRollback : createUnprovenRollbackReceipt(revision);
  const browser = await readJson(resolve(root, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
  const input: ReleaseValidationInput = {
    catalog,
    manifestFiles,
    toolPageFiles,
    cloudflareConfig: await readFile(resolve(root, "wrangler.jsonc"), "utf8"),
    siteUrl,
    publicSources: await loadPublicSources(),
    metadataSurfaces: metadata.surfaces,
    ...(metadata.sitemap === undefined ? {} : { sitemap: metadata.sitemap }),
    ...(metadata.robots === undefined ? {} : { robots: metadata.robots }),
    staticAssets: { distExists, files: distFiles, toolIds: catalog.map((entry) => entry.id) } satisfies StaticAssetSurface,
    rollbackReceipt,
    goldReceipts: await loadGoldReceipts(),
    evidence: { browser, physicalDeviceReceipts: await loadPhysicalReceipts() },
    revision,
    sourceFingerprint,
    workingTreeDirty,
  };
  const result = validateRelease(input);
  const checkStatus = (prefixes: readonly string[], checked: boolean): "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN" => {
    if (!checked) return "NOT_RUN";
    const related = result.findings.filter((item) => prefixes.some((prefix) => item.code.startsWith(prefix)));
    if (related.some((item) => item.severity === "error")) return "FAIL";
    if (related.some((item) => item.severity === "blocker")) return "BLOCKED";
    return "PASS";
  };
  const validationReceipt = {
    schemaVersion: 1,
    kind: "release-validation",
    generatedBy: "scripts/validate-release.ts",
    revision,
    sourceFingerprint,
    workingTreeDirty,
    checks: {
      toolSurface: checkStatus(["TOOL_", "MANIFEST_", "DUPLICATE_", "UNINDEXED_", "INVALID_PUBLIC_"], true),
      cloudflareStaticAssets: checkStatus(["CLOUDFLARE_"], true),
      publicSiteUrl: checkStatus(["PUBLIC_SITE_URL_"], true),
      publicMetadata: checkStatus(["METADATA_", "SITEMAP_", "ROBOTS_", "PUBLIC_METADATA_", "PUBLIC_SITEMAP_", "PUBLIC_ROBOTS_"], metadata.surfaces.length > 0),
      staticAssets: checkStatus(["STATIC_"], distExists),
      truthfulClaims: checkStatus(["PUBLIC_BRAND_", "PUBLIC_COPY_", "UNSUPPORTED_"], true),
      gold: checkStatus(["GOLD_"], true),
      browserEvidence: checkStatus(["BROWSER_", "EXTERNAL_EVIDENCE_"], true),
      physicalDeviceEvidence: checkStatus(["PHYSICAL_", "EXTERNAL_EVIDENCE_"], true),
      rollback: checkStatus(["ROLLBACK_"], true),
    },
    staticAssets: {
      status: checkStatus(["STATIC_"], distExists),
      fileCount: distFiles.length,
      contentSha256: distExists ? await inventoryHash(distFiles) : null,
      directory: "./dist",
      externalDeploymentPerformed: false,
    },
    rollback: rollbackReceipt,
    evidence: {
      browser: "UNVERIFIED",
      physicalDevices: "UNVERIFIED",
      note: "This local validator does not run or substitute external browser/device acceptance.",
    },
    validation: result,
  };
  if (writeReceipts) {
    await mkdir(receiptDirectory, { recursive: true });
    await writeFile(resolve(receiptDirectory, "validation.json"), `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
    await writeFile(resolve(receiptDirectory, "rollback.json"), `${JSON.stringify(rollbackReceipt, null, 2)}\n`, "utf8");
  }
  const output = {
    status: result.status,
    expectedToolCount: result.expectedToolCount,
    catalogToolCount: result.catalogToolCount,
    manifestCount: result.manifestCount,
    toolPageCount: result.toolPageCount,
    counts: result.counts,
    checks: validationReceipt.checks,
    receipt: writeReceipts ? relative(root, resolve(receiptDirectory, "validation.json")) : null,
    findings: result.findings,
  };
  console.log(JSON.stringify(output, null, 2));
  if (result.status === "FAIL" || (requireReady && result.status !== "PASS")) process.exitCode = 1;
}

await main();

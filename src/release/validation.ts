export const RELEASE_TOOL_COUNT = 200;

export type ReleaseFindingSeverity = "error" | "blocker" | "warning";

export interface ReleaseFinding {
  readonly code: string;
  readonly severity: ReleaseFindingSeverity;
  readonly message: string;
  readonly path?: string;
}

export interface ReleaseCatalogEntry {
  readonly id: string;
  readonly route: string;
}

export interface PublicSource {
  readonly path: string;
  readonly text: string;
}

export interface ToolCertificationReceipt {
  readonly toolId: string;
  readonly status: string;
  readonly schemaVersion?: number;
  readonly runtime?: unknown;
  readonly oracleEntryId?: string;
  readonly oracleEntryIds?: readonly string[];
  readonly fixtureFamilies?: readonly string[];
  readonly identities?: Readonly<Record<string, string>>;
  readonly goldEligible?: boolean;
  readonly revision?: string;
  readonly sourceFingerprint?: string;
}

export interface PublicMetadataSurface {
  readonly title: string | null;
  readonly description: string | null;
  readonly canonical: string | null;
  readonly openGraph: Readonly<Record<string, string>>;
  readonly twitter: Readonly<Record<string, string>>;
  readonly robots: string | null;
  readonly sitemap: string | null;
}

export interface StaticAssetSurface {
  readonly distExists: boolean;
  readonly files: readonly string[];
  readonly toolIds: readonly string[];
}

export interface RollbackReceipt {
  readonly schemaVersion: 1;
  readonly kind: "cloudflare-static-assets-rollback";
  readonly status: "UNPROVEN" | "VERIFIED";
  readonly externalDeploymentPerformed: boolean;
  readonly currentRevision: string | null;
  readonly sourceFingerprint: string | null;
  readonly currentDeploymentId: string | null;
  readonly previousKnownGoodDeploymentId: string | null;
  readonly rollbackCommand: string;
  readonly dryRunCommand: string;
  readonly rollbackVerified: boolean;
  readonly reason: string;
}

export interface ReleaseEvidence {
  readonly browser: unknown;
  readonly physicalDeviceReceipts: readonly unknown[];
}

export interface ReleaseValidationInput {
  readonly catalog: readonly ReleaseCatalogEntry[];
  readonly manifestFiles: readonly string[];
  readonly toolPageFiles: readonly string[];
  readonly cloudflareConfig: string;
  readonly siteUrl?: string;
  readonly publicSources?: readonly PublicSource[];
  readonly metadataSurfaces?: readonly { readonly path: string; readonly surface: PublicMetadataSurface; readonly expectedCanonical?: string }[];
  readonly sitemap?: { readonly xml: string; readonly expectedUrls: readonly string[]; readonly path?: string };
  readonly robots?: { readonly text: string; readonly expectedSitemapUrl: string; readonly path?: string };
  readonly staticAssets?: StaticAssetSurface;
  readonly rollbackReceipt?: unknown;
  readonly goldReceipts?: readonly ToolCertificationReceipt[];
  readonly evidence?: ReleaseEvidence;
  readonly revision?: string;
  readonly sourceFingerprint?: string;
  readonly workingTreeDirty?: boolean;
}

export interface ReleaseValidationResult {
  readonly schemaVersion: 1;
  readonly status: "PASS" | "BLOCKED" | "FAIL";
  readonly expectedToolCount: number;
  readonly catalogToolCount: number;
  readonly manifestCount: number;
  readonly toolPageCount: number;
  readonly findings: readonly ReleaseFinding[];
  readonly counts: {
    readonly errors: number;
    readonly blockers: number;
    readonly warnings: number;
  };
}

function finding(
  code: string,
  severity: ReleaseFindingSeverity,
  message: string,
  path?: string,
): ReleaseFinding {
  return path === undefined ? { code, severity, message } : { code, severity, message, path };
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//u, "").replace(/^\/+/u, "");
}

function expectedManifestPath(id: string): string {
  return `src/tools/${id}/manifest.ts`;
}

function expectedPagePath(route: string): string {
  const path = route.replace(/^\/+/u, "").replace(/\/+$/u, "");
  return `src/pages/${path}.astro`;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function validateToolSurface(
  catalog: readonly ReleaseCatalogEntry[],
  manifestFiles: readonly string[],
  toolPageFiles: readonly string[],
): ReleaseFinding[] {
  const findings: ReleaseFinding[] = [];
  if (catalog.length !== RELEASE_TOOL_COUNT) {
    findings.push(finding(
      "TOOL_COUNT_MISMATCH",
      "error",
      `expected ${RELEASE_TOOL_COUNT} catalog entries, found ${catalog.length}`,
      "src/generated/catalog.ts",
    ));
  }
  if (manifestFiles.length !== RELEASE_TOOL_COUNT) {
    findings.push(finding(
      "MANIFEST_COUNT_MISMATCH",
      "error",
      `expected ${RELEASE_TOOL_COUNT} tool manifests, found ${manifestFiles.length}`,
      "src/tools",
    ));
  }
  if (toolPageFiles.length !== RELEASE_TOOL_COUNT) {
    findings.push(finding(
      "TOOL_PAGE_COUNT_MISMATCH",
      "error",
      `expected ${RELEASE_TOOL_COUNT} public tool pages, found ${toolPageFiles.length}`,
      "src/pages/tools",
    ));
  }

  const ids = catalog.map((entry) => entry.id);
  const routes = catalog.map((entry) => entry.route);
  for (const [kind, values] of [["id", ids], ["route", routes]] as const) {
    const duplicates = unique(values.filter((value, index) => values.indexOf(value) !== index));
    for (const value of duplicates) {
      findings.push(finding("DUPLICATE_TOOL_KEY", "error", `duplicate ${kind} ${JSON.stringify(value)}`));
    }
  }

  const manifestSet = new Set(manifestFiles.map(normalizePath));
  const pageSet = new Set(toolPageFiles.map(normalizePath));
  const expectedManifests = new Set<string>();
  const expectedPages = new Set<string>();
  for (const entry of catalog) {
    expectedManifests.add(expectedManifestPath(entry.id));
    expectedPages.add(expectedPagePath(entry.route));
    if (!manifestSet.has(expectedManifestPath(entry.id))) {
      findings.push(finding("MANIFEST_MISSING", "error", `missing manifest for ${entry.id}`, expectedManifestPath(entry.id)));
    }
    if (!pageSet.has(expectedPagePath(entry.route))) {
      findings.push(finding("TOOL_PAGE_MISSING", "error", `missing public page for ${entry.id}`, expectedPagePath(entry.route)));
    }
    if (!entry.route.startsWith("/tools/") || entry.route.includes("?") || entry.route.includes("#")) {
      findings.push(finding("INVALID_PUBLIC_ROUTE", "error", `invalid public route ${JSON.stringify(entry.route)}`, expectedPagePath(entry.route)));
    }
  }
  for (const path of manifestSet) {
    if (!expectedManifests.has(path)) findings.push(finding("UNINDEXED_MANIFEST", "error", "manifest has no catalog entry", path));
  }
  for (const path of pageSet) {
    if (!expectedPages.has(path)) findings.push(finding("UNINDEXED_TOOL_PAGE", "error", "tool page has no catalog entry", path));
  }
  return findings;
}

function stripJsonComments(value: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") inString = false;
      continue;
    }
    if (character === "\"") {
      inString = true;
      output += character;
      continue;
    }
    if (character === "/" && next === "/") {
      while (index < value.length && value[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (character === "/" && next === "*") {
      index += 2;
      while (index < value.length && !(value[index] === "*" && value[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    output += character;
  }
  return output;
}

export function validatePublicSiteUrl(value: string | undefined): ReleaseFinding[] {
  if (value === undefined || value.length === 0) return [finding("PUBLIC_SITE_URL_MISSING", "blocker", "PUBLIC_SITE_URL must be supplied before a public release", "astro.config.mjs")];
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return [finding("PUBLIC_SITE_URL_INVALID", "error", "PUBLIC_SITE_URL must be an absolute URL", "astro.config.mjs")];
  }
  if (url.protocol !== "https:") return [finding("PUBLIC_SITE_URL_PROTOCOL", "error", "PUBLIC_SITE_URL must use HTTPS", "astro.config.mjs")];
  if (url.hostname.endsWith(".invalid")) return [finding("PUBLIC_SITE_URL_PLACEHOLDER", "blocker", "placeholder PUBLIC_SITE_URL cannot certify a public deployment", "astro.config.mjs")];
  return [];
}

export function validateCloudflareStaticAssets(config: string): ReleaseFinding[] {
  const findings: ReleaseFinding[] = [];
  const normalized = stripJsonComments(config);
  if (!/"assets"\s*:/u.test(normalized)) {
    findings.push(finding("CLOUDFLARE_ASSETS_MISSING", "error", "wrangler config does not declare assets", "wrangler.jsonc"));
    return findings;
  }
  const directory = normalized.match(/"directory"\s*:\s*"([^"]+)"/u)?.[1];
  if (directory !== "./dist" && directory !== "dist" && directory !== "dist/") {
    findings.push(finding("CLOUDFLARE_ASSETS_DIRECTORY", "error", "Cloudflare assets.directory must point to the static dist directory", "wrangler.jsonc"));
  }
  if (!/"compatibility_date"\s*:\s*"\d{4}-\d{2}-\d{2}"/u.test(normalized)) {
    findings.push(finding("CLOUDFLARE_COMPATIBILITY_DATE", "error", "Cloudflare compatibility_date is required", "wrangler.jsonc"));
  }
  const notFoundHandling = normalized.match(/"not_found_handling"\s*:\s*"([^"]+)"/u)?.[1];
  if (notFoundHandling !== "404-page") {
    findings.push(finding("CLOUDFLARE_NOT_FOUND_HANDLING", "error", "static deployment must use 404-page handling", "wrangler.jsonc"));
  }
  // The account API is an optional Worker in front of the static assets. When it
  // is declared it must be this repository's own entry point and must have an
  // assets binding to delegate to — the proof that `dist/` stays ordinary
  // static output lives in scripts/check-portable-static.mjs, not here.
  const workerMain = normalized.match(/"main"\s*:\s*"([^"]+)"/u)?.[1];
  if (workerMain !== undefined && !/^\.?\/?worker\/index\.ts$/u.test(workerMain)) {
    findings.push(finding("CLOUDFLARE_WORKER_MAIN", "error", "a Worker main entry must be the repository's own ./worker/index.ts", "wrangler.jsonc"));
  }
  if (workerMain !== undefined && !/"binding"\s*:\s*"ASSETS"/u.test(normalized)) {
    findings.push(finding("CLOUDFLARE_ASSETS_BINDING", "error", "a Worker in front of the assets must declare the ASSETS binding it delegates to", "wrangler.jsonc"));
  }
  if (/"run_worker_first"\s*:/u.test(normalized)) {
    findings.push(finding("CLOUDFLARE_WORKER_FIRST", "error", "static routes must not be routed through a Worker first", "wrangler.jsonc"));
  }
  return findings;
}

function contentValue(tag: string): string | null {
  const match = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/iu);
  return match?.[1] ?? null;
}

function decodeXml(value: string): string {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", "\"").replaceAll("&apos;", "'");
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&apos;");
}

export function buildSitemapXml(site: URL, routes: readonly string[]): string {
  const paths = unique(routes.map((route) => route === "/" ? "/" : `${route.replace(/\/+$/u, "")}/`));
  const urls = paths.map((path) => new URL(path, site).href);
  const entries = urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function buildRobotsTxt(site: URL): string {
  return `User-agent: *\nAllow: /\nSitemap: ${new URL("sitemap.xml", site).href}\n`;
}

export function extractPublicMetadata(html: string): PublicMetadataSurface {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1]?.trim() ?? null;
  const description = contentValue(html.match(/<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*>/iu)?.[0] ?? "");
  const canonicalTag = html.match(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/iu)?.[0] ?? "";
  const sitemapTag = html.match(/<link\b[^>]*\brel\s*=\s*["']sitemap["'][^>]*>/iu)?.[0] ?? "";
  const openGraph: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/giu) ?? []) {
    const property = tag.match(/\bproperty\s*=\s*["']([^"']+)["']/iu)?.[1];
    const name = tag.match(/\bname\s*=\s*["']([^"']+)["']/iu)?.[1];
    const value = contentValue(tag);
    if (property?.startsWith("og:") && value !== null) openGraph[property] = value;
    if (name?.startsWith("twitter:") && value !== null) twitter[name] = value;
  }
  return {
    title,
    description,
    canonical: canonicalTag.match(/\bhref\s*=\s*["']([^"']+)["']/iu)?.[1] ?? null,
    openGraph,
    twitter,
    robots: contentValue(html.match(/<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*>/iu)?.[0] ?? ""),
    sitemap: sitemapTag.match(/\bhref\s*=\s*["']([^"']+)["']/iu)?.[1] ?? null,
  };
}

export function validatePublicMetadata(surface: PublicMetadataSurface, path = "dist", expectedCanonical?: string): ReleaseFinding[] {
  const findings: ReleaseFinding[] = [];
  if (surface.title === null || surface.title.length === 0) findings.push(finding("METADATA_TITLE_MISSING", "error", "page has no title", path));
  if (surface.description === null || surface.description.length === 0) findings.push(finding("METADATA_DESCRIPTION_MISSING", "error", "page has no description", path));
  if (surface.canonical === null || !/^https:\/\//u.test(surface.canonical)) findings.push(finding("METADATA_CANONICAL_MISSING", "error", "page has no absolute HTTPS canonical URL", path));
  if (expectedCanonical !== undefined && surface.canonical !== expectedCanonical) findings.push(finding("METADATA_CANONICAL_MISMATCH", "error", "canonical URL does not match the configured site and route", path));
  for (const property of ["og:title", "og:description", "og:type", "og:url", "og:image"]) {
    if (!surface.openGraph[property]) findings.push(finding("METADATA_OG_MISSING", "error", `page is missing ${property}`, path));
  }
  if (surface.canonical !== null && surface.openGraph["og:url"] !== surface.canonical) findings.push(finding("METADATA_OG_URL_MISMATCH", "error", "og:url must match the canonical URL", path));
  if (surface.openGraph["og:image"] !== undefined && !/^https:\/\//u.test(surface.openGraph["og:image"])) findings.push(finding("METADATA_OG_IMAGE_URL", "error", "og:image must be an absolute HTTPS URL", path));
  for (const name of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
    if (!surface.twitter[name]) findings.push(finding("METADATA_TWITTER_MISSING", "error", `page is missing ${name}`, path));
  }
  if (surface.twitter["twitter:image"] !== undefined && !/^https:\/\//u.test(surface.twitter["twitter:image"])) findings.push(finding("METADATA_TWITTER_IMAGE_URL", "error", "twitter:image must be an absolute HTTPS URL", path));
  if (surface.robots !== "index, follow" && surface.robots !== "noindex, nofollow") findings.push(finding("METADATA_ROBOTS_INVALID", "error", "page robots directive must be explicit", path));
  if (surface.sitemap !== "/sitemap.xml") findings.push(finding("METADATA_SITEMAP_LINK_MISSING", "error", "page must link to /sitemap.xml", path));
  return findings;
}

export function validateSitemapXml(xml: string, expectedUrls: readonly string[], path = "dist/sitemap.xml"): ReleaseFinding[] {
  const findings: ReleaseFinding[] = [];
  const locations = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/giu)].map((match) => decodeXml(match[1]?.trim() ?? ""));
  const expected = new Set(expectedUrls);
  const seen = new Set<string>();
  for (const location of locations) {
    if (seen.has(location)) findings.push(finding("SITEMAP_DUPLICATE_URL", "error", `duplicate sitemap URL ${location}`, path));
    seen.add(location);
    if (!expected.has(location)) findings.push(finding("SITEMAP_UNEXPECTED_URL", "error", `unexpected sitemap URL ${location}`, path));
  }
  for (const location of expected) {
    if (!seen.has(location)) findings.push(finding("SITEMAP_MISSING_URL", "error", `missing sitemap URL ${location}`, path));
  }
  if (!xml.includes("http://www.sitemaps.org/schemas/sitemap/0.9")) findings.push(finding("SITEMAP_NAMESPACE_MISSING", "error", "sitemap namespace is missing", path));
  return findings;
}

export function validateRobotsTxt(text: string, expectedSitemapUrl: string, path = "dist/robots.txt"): ReleaseFinding[] {
  const findings: ReleaseFinding[] = [];
  if (!/^User-agent:\s*\*\s*$/mu.test(text)) findings.push(finding("ROBOTS_USER_AGENT_MISSING", "error", "robots.txt must address generic crawlers", path));
  if (!/^Allow:\s*\/\s*$/mu.test(text)) findings.push(finding("ROBOTS_ALLOW_MISSING", "error", "robots.txt must allow public static routes", path));
  if (!text.includes(`Sitemap: ${expectedSitemapUrl}`)) findings.push(finding("ROBOTS_SITEMAP_MISSING", "error", "robots.txt must point to the generated sitemap", path));
  return findings;
}

export function validateStaticAssetSurface(surface: StaticAssetSurface, catalog: readonly ReleaseCatalogEntry[]): ReleaseFinding[] {
  const findings: ReleaseFinding[] = [];
  if (!surface.distExists) {
    findings.push(finding("STATIC_DIST_MISSING", "error", "static build output is missing", "dist"));
    return findings;
  }
  const files = new Set(surface.files.map(normalizePath));
  for (const required of ["index.html", "strumenti/index.html", "404.html", "sitemap.xml", "robots.txt", "og-image.png"]) {
    if (!files.has(required)) findings.push(finding("STATIC_REQUIRED_FILE_MISSING", "error", `required static file is missing: ${required}`, `dist/${required}`));
  }
  const expectedToolPages = new Set(catalog.map((entry) => `${entry.route.replace(/^\/+/u, "").replace(/\/+$/u, "")}/index.html`));
  const actualToolPages = new Set([...files].filter((file) => /^tools\/[^/]+\/index\.html$/u.test(file)));
  for (const path of expectedToolPages) {
    if (!actualToolPages.has(path)) findings.push(finding("STATIC_TOOL_PAGE_MISSING", "error", `static tool page is missing: ${path}`, `dist/${path}`));
  }
  for (const path of actualToolPages) {
    if (!expectedToolPages.has(path)) findings.push(finding("STATIC_UNEXPECTED_TOOL_PAGE", "error", `static page has no catalog entry: ${path}`, `dist/${path}`));
  }
  const assetFiles = [...files].filter((file) => file.startsWith("_astro/") && /\.(?:js|css)$/u.test(file));
  if (assetFiles.length === 0) findings.push(finding("STATIC_ASSETS_MISSING", "error", "no JavaScript or CSS assets were emitted", "dist/_astro"));
  for (const file of assetFiles) {
    const name = file.slice(file.lastIndexOf("/") + 1);
    if (!/[.-][A-Za-z0-9_-]{8,}\.(?:js|css)$/u.test(name)) findings.push(finding("STATIC_ASSET_NOT_CONTENT_HASHED", "error", `asset is not content-hashed: ${file}`, `dist/${file}`));
  }
  return findings;
}

const forbiddenClaims: readonly { readonly code: string; readonly pattern: RegExp; readonly message: string }[] = [
  { code: "PUBLIC_BRAND_PLACEHOLDER", pattern: /\[BRAND\]|\bworking codename\b|\bbrand is not final\b/iu, message: "public copy must use the selected StrumentiUtili.it brand rather than a placeholder" },
  { code: "UNSUPPORTED_BEST", pattern: /\b(?:the\s+)?best\b/iu, message: "unsupported superiority claim" },
  { code: "UNSUPPORTED_UNIQUE", pattern: /\bunique\s+(?:technology|tool|suite|platform|product|workspace)\b/iu, message: "unsupported uniqueness claim" },
  { code: "UNSUPPORTED_PRIVACY", pattern: /\b(?:most\s+private|privacy[- ]first|private\s+by\s+design)\b/iu, message: "generic privacy claim must state concrete mechanics near the operation" },
  { code: "UNSUPPORTED_SCALE", pattern: /\b(?:hundreds\s+of|200)\s+(?:gold\s+)?tools\b/iu, message: "catalog-size claim requires current Gold evidence" },
  { code: "UNSUPPORTED_PROMISE", pattern: /\b(?:offline|PWA\s+(?:support|installable)|AI[- ]first)\b/iu, message: "out-of-scope product promise" },
  { code: "UNSUPPORTED_HYPE", pattern: /\b(?:revolutionize|revolutionary|supercharge|effortlessly\s+optimize|all[- ]in[- ]one\s+operating\s+system)\b/iu, message: "unsupported marketing hype" },
];

export function validateTruthfulClaims(sources: readonly PublicSource[]): ReleaseFinding[] {
  const findings: ReleaseFinding[] = [];
  for (const source of sources) {
    for (const claim of forbiddenClaims) {
      const match = source.text.match(claim.pattern);
      if (match !== null) findings.push(finding(claim.code, "error", `${claim.message}: ${JSON.stringify(match[0])}`, source.path));
    }
  }
  return findings;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function createUnprovenRollbackReceipt(revision: string, sourceFingerprint?: string): RollbackReceipt {
  return {
    schemaVersion: 1,
    kind: "cloudflare-static-assets-rollback",
    status: "UNPROVEN",
    externalDeploymentPerformed: false,
    currentRevision: revision,
    sourceFingerprint: sourceFingerprint ?? null,
    currentDeploymentId: null,
    previousKnownGoodDeploymentId: null,
    rollbackCommand: "wrangler rollback <previous-known-good-version-id>",
    dryRunCommand: "wrangler deploy --dry-run --outdir .wrangler-dry-run",
    rollbackVerified: false,
    reason: "No external Cloudflare deployment or rollback was performed by local release validation.",
  };
}

export function validateRollbackReceipt(value: unknown, path = "quality/receipts/release/rollback.json", sourceFingerprint?: string): ReleaseFinding[] {
  const record = asRecord(value);
  if (record === undefined) return [finding("ROLLBACK_RECEIPT_MISSING", "blocker", "rollback receipt is missing or malformed", path)];
  const findings: ReleaseFinding[] = [];
  if (record.schemaVersion !== 1) findings.push(finding("ROLLBACK_SCHEMA", "error", "rollback receipt schemaVersion must be 1", path));
  if (record.kind !== "cloudflare-static-assets-rollback") findings.push(finding("ROLLBACK_KIND", "error", "rollback receipt kind is invalid", path));
  const status = asString(record.status);
  if (status === "UNPROVEN") {
    if (record.externalDeploymentPerformed !== false) findings.push(finding("ROLLBACK_UNPROVEN_DEPLOYMENT_FLAG", "error", "UNPROVEN receipt must state that no external deployment occurred", path));
    if (record.rollbackVerified !== false) findings.push(finding("ROLLBACK_UNPROVEN_VERIFIED_FLAG", "error", "UNPROVEN receipt cannot claim rollback verification", path));
    if (record.currentDeploymentId !== null || record.previousKnownGoodDeploymentId !== null) findings.push(finding("ROLLBACK_UNPROVEN_IDS", "error", "UNPROVEN receipt must not contain deployment IDs", path));
  } else if (status === "VERIFIED") {
    for (const field of ["currentRevision", "currentDeploymentId", "previousKnownGoodDeploymentId"] as const) {
      const value = asString(record[field]);
      if (value === undefined || value.length === 0) findings.push(finding("ROLLBACK_VERIFIED_FIELD", "error", `verified rollback receipt requires ${field}`, path));
    }
    if (record.externalDeploymentPerformed !== true) findings.push(finding("ROLLBACK_VERIFIED_DEPLOYMENT_FLAG", "error", "verified rollback receipt must record an external deployment", path));
    const receiptSourceFingerprint = asString(record.sourceFingerprint);
    if (receiptSourceFingerprint === undefined || !/^[a-f0-9]{64}$/u.test(receiptSourceFingerprint)) {
      findings.push(finding("ROLLBACK_SOURCE_FINGERPRINT", "error", "verified rollback receipt requires a valid sourceFingerprint", path));
    } else if (sourceFingerprint !== undefined && receiptSourceFingerprint !== sourceFingerprint) {
      findings.push(finding("ROLLBACK_SOURCE_STALE", "blocker", "verified rollback receipt targets different source content", path));
    }
    if (record.rollbackVerified !== true) findings.push(finding("ROLLBACK_VERIFIED_FLAG", "error", "verified rollback receipt requires rollbackVerified=true", path));
  } else {
    findings.push(finding("ROLLBACK_STATUS", "error", "rollback receipt status must be UNPROVEN or VERIFIED", path));
  }
  const rollbackCommand = asString(record.rollbackCommand);
  const dryRunCommand = asString(record.dryRunCommand);
  if (rollbackCommand === undefined || !rollbackCommand.startsWith("wrangler rollback ")) findings.push(finding("ROLLBACK_COMMAND", "error", "rollback receipt must record a Wrangler rollback command", path));
  if (dryRunCommand !== "wrangler deploy --dry-run --outdir .wrangler-dry-run") findings.push(finding("ROLLBACK_DRY_RUN_COMMAND", "error", "rollback receipt must record the exact non-deploying dry-run command", path));
  if (status === "VERIFIED") {
    const previous = asString(record.previousKnownGoodDeploymentId);
    if (previous !== undefined && (rollbackCommand === undefined || !rollbackCommand.includes(previous))) findings.push(finding("ROLLBACK_COMMAND_TARGET", "error", "rollback command must target the recorded previous known-good deployment", path));
    if (previous !== undefined && previous === asString(record.currentDeploymentId)) findings.push(finding("ROLLBACK_SAME_DEPLOYMENT", "error", "current and previous deployment IDs must differ", path));
  }
  if (asString(record.reason) === undefined) findings.push(finding("ROLLBACK_REASON", "error", "rollback receipt must explain its evidence boundary", path));
  return findings;
}

export function validateGoldReceipts(
  catalog: readonly ReleaseCatalogEntry[],
  receipts: readonly ToolCertificationReceipt[],
  revision?: string,
  sourceFingerprint?: string,
): ReleaseFinding[] {
  const findings: ReleaseFinding[] = [];
  const byId = new Map<string, ToolCertificationReceipt[]>();
  for (const receipt of receipts) {
    const current = byId.get(receipt.toolId) ?? [];
    current.push(receipt);
    byId.set(receipt.toolId, current);
  }
  const missing: string[] = [];
  const duplicate: string[] = [];
  const notGold: string[] = [];
  const sourceMismatch: string[] = [];
  const sourceUnbound: string[] = [];
  const unbound: string[] = [];
  const weakEvidence: string[] = [];
  for (const entry of catalog) {
    const candidates = byId.get(entry.id) ?? [];
    if (candidates.length === 0) missing.push(entry.id);
    else if (candidates.length > 1) duplicate.push(entry.id);
    const receipt = candidates[0];
    if (receipt !== undefined && (receipt.status !== "GOLD" || receipt.goldEligible === false)) notGold.push(entry.id);
    if (receipt !== undefined && (receipt.schemaVersion !== 1 || receipt.runtime === undefined || (receipt.oracleEntryId === undefined && (receipt.oracleEntryIds === undefined || receipt.oracleEntryIds.length === 0)) || receipt.fixtureFamilies === undefined || receipt.fixtureFamilies.length === 0 || receipt.identities === undefined || Object.keys(receipt.identities).length === 0)) weakEvidence.push(entry.id);
    if (receipt !== undefined && revision !== undefined && receipt.revision === undefined) unbound.push(entry.id);
    if (receipt !== undefined && sourceFingerprint !== undefined && receipt.sourceFingerprint === undefined) sourceUnbound.push(entry.id);
    if (receipt?.sourceFingerprint !== undefined && sourceFingerprint !== undefined && receipt.sourceFingerprint !== sourceFingerprint) sourceMismatch.push(entry.id);
  }
  if (missing.length > 0) findings.push(finding("GOLD_RECEIPT_MISSING", "blocker", `${missing.length} tool(s) have no certification receipt`, "quality/receipts"));
  if (duplicate.length > 0) findings.push(finding("GOLD_RECEIPT_DUPLICATE", "error", `${duplicate.length} tool(s) have duplicate certification receipts`, "quality/receipts"));
  if (notGold.length > 0) findings.push(finding("GOLD_RECEIPT_NOT_GOLD", "blocker", `${notGold.length} tool receipt(s) are not Gold`, "quality/receipts"));
  if (weakEvidence.length > 0) findings.push(finding("GOLD_RECEIPT_EVIDENCE_MISSING", "blocker", `${weakEvidence.length} Gold receipt(s) lack required certification evidence`, "quality/receipts"));
  if (unbound.length > 0) findings.push(finding("GOLD_RECEIPT_UNBOUND", "blocker", `${unbound.length} Gold receipt(s) do not identify the current revision`, "quality/receipts"));
  if (sourceUnbound.length > 0) findings.push(finding("GOLD_RECEIPT_SOURCE_UNBOUND", "blocker", `${sourceUnbound.length} Gold receipt(s) do not identify the certified source fingerprint`, "quality/receipts"));
  if (sourceMismatch.length > 0) findings.push(finding("GOLD_RECEIPT_SOURCE_STALE", "blocker", `${sourceMismatch.length} tool receipt(s) target different source content`, "quality/receipts"));
  return findings;
}

function browserFindings(value: unknown, sourceFingerprint: string | undefined): ReleaseFinding[] {
  const record = asRecord(value);
  if (record === undefined) return [finding("BROWSER_EVIDENCE_MISSING", "blocker", "fresh browser evidence is missing", "quality/receipts/browser-performance/fresh-browser-matrix.json")];
  const findings: ReleaseFinding[] = [];
  const receiptRevision = asString(record.revision);
  if (receiptRevision === undefined) findings.push(finding("BROWSER_EVIDENCE_REVISION", "blocker", "browser evidence does not identify a revision", "quality/receipts/browser-performance/fresh-browser-matrix.json"));
  const receiptSourceFingerprint = asString(record.sourceFingerprint);
  if (sourceFingerprint !== undefined && receiptSourceFingerprint === undefined) findings.push(finding("BROWSER_EVIDENCE_SOURCE_UNBOUND", "blocker", "browser evidence does not identify the certified source fingerprint", "quality/receipts/browser-performance/fresh-browser-matrix.json"));
  else if (sourceFingerprint !== undefined && receiptSourceFingerprint !== sourceFingerprint) findings.push(finding("BROWSER_EVIDENCE_SOURCE_STALE", "blocker", "browser evidence targets different source content", "quality/receipts/browser-performance/fresh-browser-matrix.json"));
  const matrix = asRecord(record.browserMatrix);
  const requested = matrix === undefined ? undefined : matrix.requestedEngines;
  const requiredEngines = new Set(["chrome", "edge", "chromium", "firefox", "webkit"]);
  const seenEngines = new Set<string>();
  if (matrix === undefined) findings.push(finding("BROWSER_MATRIX_MISSING", "blocker", "browser matrix is missing", "quality/receipts/browser-performance/fresh-browser-matrix.json"));
  if (!Array.isArray(requested) || requested.length === 0) findings.push(finding("BROWSER_MATRIX_EMPTY", "blocker", "browser matrix has no observed engines", "quality/receipts/browser-performance/fresh-browser-matrix.json"));
  else {
    for (const engine of requested) {
      const item = asRecord(engine);
      if (item === undefined) {
        findings.push(finding("BROWSER_ENGINE_MALFORMED", "blocker", "browser matrix contains a malformed engine entry", "quality/receipts/browser-performance/fresh-browser-matrix.json"));
        continue;
      }
      const name = asString(item.engine);
      if (name === undefined) findings.push(finding("BROWSER_ENGINE_MALFORMED", "blocker", "browser matrix entry has no engine name", "quality/receipts/browser-performance/fresh-browser-matrix.json"));
      else if (seenEngines.has(name)) findings.push(finding("BROWSER_ENGINE_DUPLICATE", "blocker", `browser engine appears more than once: ${name}`, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
      else seenEngines.add(name);
      const status = asString(item.status);
      const classification = asString(item.classification);
      const supportedClassification = classification === "observed" || classification === "longtask-observer-unsupported";
      if (status !== "PASS" || !supportedClassification) {
        findings.push(finding("BROWSER_ENGINE_UNPROVEN", "blocker", `browser engine evidence is ${asString(item.status) ?? "missing"}`, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
        continue;
      }
      for (const route of ["coreRoute", "homeRoute", "directoryRoute"]) {
        if (asString(item[route]) !== "PASS") findings.push(finding("BROWSER_ROUTE_UNPROVEN", "blocker", `${name ?? "browser engine"} has no ${route} pass`, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
      }
      const mobile = asRecord(item.mobile);
      if (mobile === undefined || mobile.toolOverflow !== false || mobile.homeOverflow !== false || mobile.directoryOverflow !== false) findings.push(finding("BROWSER_MOBILE_UNPROVEN", "blocker", `${name ?? "browser engine"} has no clean 390px result`, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
      const lazy = asRecord(item.lazy);
      if (lazy === undefined || !Array.isArray(lazy.observedEngineChunk) || lazy.observedEngineChunk.length === 0) findings.push(finding("BROWSER_LAZY_UNPROVEN", "blocker", `${name ?? "browser engine"} has no observed lazy engine chunk`, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
      const longTasks = asRecord(item.longTasks);
      const longTaskObserverSupported = longTasks?.observerSupported;
      const longTaskGate = longTasks === undefined ? undefined : asString(longTasks.gate);
      const longTaskEvidenceValid = longTasks !== undefined && (
        (longTaskObserverSupported === true && longTaskGate === "PASS")
        || (longTaskObserverSupported === false && longTaskGate === "UNSUPPORTED" && classification === "longtask-observer-unsupported")
      );
      if (!longTaskEvidenceValid) findings.push(finding("BROWSER_LONG_TASK_UNPROVEN", "blocker", `${name ?? "browser engine"} long-task evidence is not valid for this engine`, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
      const network = asRecord(item.networkPrivacy);
      if (network === undefined || network.externalTaskRequests !== 0 || network.taskContentLeaks !== 0 || network.nonGetTaskRequests !== 0) findings.push(finding("BROWSER_NETWORK_UNPROVEN", "blocker", `${name ?? "browser engine"} network/privacy evidence is not clean`, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
      if (asRecord(item.performance) === undefined) findings.push(finding("BROWSER_PERFORMANCE_MISSING", "blocker", `${name ?? "browser engine"} performance evidence is missing`, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
      for (const errors of ["consoleErrors", "pageErrors", "failures"]) {
        if (!Array.isArray(item[errors]) || (item[errors] as unknown[]).length > 0) findings.push(finding("BROWSER_ERRORS_UNPROVEN", "blocker", `${name ?? "browser engine"} has ${errors}`, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
      }
    }
  }
  for (const engine of requiredEngines) {
    if (!seenEngines.has(engine)) findings.push(finding("BROWSER_ENGINE_MISSING", "blocker", `declared browser engine is missing: ${engine}`, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
  }
  const inspection = asRecord(record.staticInspection);
  const baseline = inspection === undefined ? undefined : asRecord(inspection.bundleBaseline);
  if (inspection === undefined || baseline === undefined) findings.push(finding("BROWSER_BUNDLE_INSPECTION_MISSING", "blocker", "browser bundle inspection is missing", "quality/receipts/browser-performance/fresh-browser-matrix.json"));
  else if (asString(baseline.gate) !== "PASS") findings.push(finding("BROWSER_BUNDLE_GATE", "blocker", "browser bundle gate is not PASS", "quality/receipts/browser-performance/fresh-browser-matrix.json"));
  const acceptance = record.freshAcceptance;
  if (!Array.isArray(acceptance) || acceptance.length === 0) findings.push(finding("BROWSER_ACCEPTANCE_MISSING", "blocker", "fresh browser acceptance results are missing", "quality/receipts/browser-performance/fresh-browser-matrix.json"));
  else {
    for (const item of acceptance) {
      const entry = asRecord(item);
      if (entry === undefined) findings.push(finding("BROWSER_ACCEPTANCE_MALFORMED", "blocker", "browser acceptance contains a malformed result", "quality/receipts/browser-performance/fresh-browser-matrix.json"));
      else if (asString(entry.status) !== "PASS") findings.push(finding("BROWSER_ACCEPTANCE_BLOCKED", "blocker", `browser acceptance is ${asString(entry.status) ?? "missing"}`, "quality/receipts/browser-performance/fresh-browser-matrix.json"));
    }
  }
  return findings;
}

export function validateExternalEvidence(evidence: ReleaseEvidence, revision: string | undefined, sourceFingerprint?: string): ReleaseFinding[] {
  const findings = browserFindings(evidence.browser, sourceFingerprint);
  const targets = new Set<string>();
  for (const value of evidence.physicalDeviceReceipts) {
    const record = asRecord(value);
    if (record === undefined) {
      findings.push(finding("PHYSICAL_DEVICE_RECEIPT_MALFORMED", "blocker", "physical device receipt is not an object", "quality/receipts/image-resize"));
      continue;
    }
    const target = asString(record.target);
    if (target !== "ios-safari" && target !== "android-chrome") {
      findings.push(finding("PHYSICAL_DEVICE_TARGET", "blocker", "physical device receipt has an unsupported target", "quality/receipts/image-resize"));
      continue;
    }
    if (targets.has(target)) findings.push(finding("PHYSICAL_DEVICE_DUPLICATE", "blocker", `duplicate ${target} physical receipt`, "quality/receipts/image-resize"));
    targets.add(target);
    if (record.status !== "PASS") findings.push(finding("PHYSICAL_DEVICE_STATUS", "blocker", `${target} physical receipt is not PASS`, "quality/receipts/image-resize"));
    if ((asString(record.device) ?? "").trim().length < 2 || (asString(record.browser) ?? "").trim().length < 2 || record.route !== "/tools/image-resize/") findings.push(finding("PHYSICAL_DEVICE_IDENTITY", "blocker", `${target} physical receipt does not identify a real route/device/browser`, "quality/receipts/image-resize"));
    if ((target === "ios-safari" && !/safari/iu.test(asString(record.browser) ?? "")) || (target === "android-chrome" && !/chrome/iu.test(asString(record.browser) ?? ""))) findings.push(finding("PHYSICAL_DEVICE_BROWSER", "blocker", `${target} receipt browser does not match the required physical browser`, "quality/receipts/image-resize"));
    if (record.schemaVersion !== 1) findings.push(finding("PHYSICAL_DEVICE_SCHEMA", "blocker", `${target} physical receipt schemaVersion must be 1`, "quality/receipts/image-resize"));
    if (revision !== undefined && asString(record.revision) === undefined) findings.push(finding("PHYSICAL_DEVICE_REVISION", "blocker", `${target} physical receipt does not identify an observed source revision`, "quality/receipts/image-resize"));
    if (sourceFingerprint !== undefined && asString(record.sourceFingerprint) !== sourceFingerprint) findings.push(finding("PHYSICAL_DEVICE_SOURCE_STALE", "blocker", `${target} physical receipt does not match the certified source content`, "quality/receipts/image-resize"));
    if (asString(record.observedAt) === undefined || !Number.isFinite(Date.parse(asString(record.observedAt) ?? ""))) findings.push(finding("PHYSICAL_DEVICE_TIMESTAMP", "blocker", `${target} physical receipt has no valid observedAt`, "quality/receipts/image-resize"));
    const checks = asRecord(record.checks);
    const requiredChecks = ["filesOrPhotosPicker", "resizeCompleted", "verifiedDownloadOpened", "noCrashOrReload", "mobileLayoutUsable", "boundaryPolicyCase"];
    if (checks === undefined || requiredChecks.some((check) => checks[check] !== "PASS") || Object.keys(checks).length !== requiredChecks.length) findings.push(finding("PHYSICAL_DEVICE_CHECKS", "blocker", `${target} physical receipt has incomplete checks`, "quality/receipts/image-resize"));
    const source = asRecord(record.source);
    const output = asRecord(record.output);
    const sourceWidth = asFiniteNumber(source?.width);
    const sourceHeight = asFiniteNumber(source?.height);
    const outputWidth = asFiniteNumber(output?.width);
    const outputHeight = asFiniteNumber(output?.height);
    if (sourceWidth === undefined || sourceHeight === undefined || outputWidth === undefined || outputHeight === undefined || sourceWidth < 1 || sourceHeight < 1 || outputWidth < 1 || outputHeight < 1 || source?.pixels !== sourceWidth * sourceHeight || output?.pixels !== outputWidth * outputHeight) findings.push(finding("PHYSICAL_DEVICE_MEASUREMENTS", "blocker", `${target} physical receipt has inconsistent image measurements`, "quality/receipts/image-resize"));
    const coverage = asRecord(record.thresholdCoverage);
    if (coverage === undefined || asFiniteNumber(coverage.sourcePixelLimitFraction) === undefined || asFiniteNumber(coverage.decodedWorkingSetLimitFraction) === undefined || (asFiniteNumber(coverage.sourcePixelLimitFraction) ?? 0) < 0.95 || (asFiniteNumber(coverage.decodedWorkingSetLimitFraction) ?? 0) < 0.85) findings.push(finding("PHYSICAL_DEVICE_THRESHOLD_COVERAGE", "blocker", `${target} physical receipt does not cover the declared policy boundary`, "quality/receipts/image-resize"));
    if (asRecord(record.policyLimits) === undefined || asFiniteNumber(record.maxSourcePixelsTested) === undefined || asFiniteNumber(record.maxEstimatedDecodedBytesTested) === undefined) findings.push(finding("PHYSICAL_DEVICE_POLICY", "blocker", `${target} physical receipt does not bind the current policy limits`, "quality/receipts/image-resize"));
  }
  for (const target of ["ios-safari", "android-chrome"]) {
    if (!targets.has(target)) findings.push(finding("PHYSICAL_DEVICE_EVIDENCE_MISSING", "blocker", `${target} physical receipt is required`, "quality/receipts/image-resize"));
  }
  return findings;
}

export function validateRelease(input: ReleaseValidationInput): ReleaseValidationResult {
  const rollbackFindings = input.rollbackReceipt === undefined
    ? [finding("ROLLBACK_RECEIPT_MISSING", "blocker", "rollback receipt is missing", "quality/receipts/release/rollback.json")]
    : validateRollbackReceipt(input.rollbackReceipt, "quality/receipts/release/rollback.json", input.sourceFingerprint);
  const rollbackRecord = asRecord(input.rollbackReceipt);
  if (rollbackRecord?.status === "UNPROVEN") rollbackFindings.push(finding("ROLLBACK_UNPROVEN", "blocker", "rollback is explicitly unproven; release is not deployable", "quality/receipts/release/rollback.json"));
  const findings: ReleaseFinding[] = [
    ...validateToolSurface(input.catalog, input.manifestFiles, input.toolPageFiles),
    ...validateCloudflareStaticAssets(input.cloudflareConfig),
    ...validatePublicSiteUrl(input.siteUrl),
    ...(input.publicSources === undefined ? [finding("PUBLIC_COPY_NOT_RUN", "blocker", "public copy validation was not run", "src/pages")] : validateTruthfulClaims(input.publicSources)),
    ...(input.metadataSurfaces === undefined || input.metadataSurfaces.length === 0
      ? [finding("PUBLIC_METADATA_NOT_RUN", "blocker", "rendered public metadata was not checked", "dist")]
      : input.metadataSurfaces.flatMap(({ path, surface, expectedCanonical }) => [
        ...validatePublicMetadata(surface, path, expectedCanonical),
        ...(expectedCanonical === undefined ? [finding("METADATA_CANONICAL_BINDING_NOT_RUN", "blocker", "page canonical was not bound to the configured site and route", path)] : []),
      ])),
    ...(input.sitemap === undefined ? [finding("PUBLIC_SITEMAP_NOT_RUN", "blocker", "sitemap validation was not run", "dist/sitemap.xml")] : validateSitemapXml(input.sitemap.xml, input.sitemap.expectedUrls, input.sitemap.path)),
    ...(input.robots === undefined ? [finding("PUBLIC_ROBOTS_NOT_RUN", "blocker", "robots validation was not run", "dist/robots.txt")] : validateRobotsTxt(input.robots.text, input.robots.expectedSitemapUrl, input.robots.path)),
    ...(input.staticAssets === undefined ? [finding("STATIC_ASSETS_NOT_RUN", "blocker", "static asset inventory was not checked", "dist")] : validateStaticAssetSurface(input.staticAssets, input.catalog)),
    ...(input.goldReceipts === undefined ? [finding("GOLD_RECEIPTS_NOT_RUN", "blocker", "Gold receipt validation was not run", "quality/receipts")] : validateGoldReceipts(input.catalog, input.goldReceipts, input.revision, input.sourceFingerprint)),
    ...(input.evidence === undefined ? [finding("EXTERNAL_EVIDENCE_NOT_RUN", "blocker", "external evidence boundaries were not checked", "quality/receipts")] : validateExternalEvidence(input.evidence, input.revision, input.sourceFingerprint)),
    ...rollbackFindings,
  ];
  if (input.revision === undefined || input.revision.length === 0 || input.revision === "unknown") findings.push(finding("RELEASE_REVISION_NOT_RUN", "blocker", "release revision was not identified", "git"));
  if (input.sourceFingerprint === undefined || !/^[a-f0-9]{64}$/u.test(input.sourceFingerprint)) findings.push(finding("RELEASE_SOURCE_FINGERPRINT_NOT_RUN", "blocker", "release source fingerprint was not identified", "git"));
  if (input.workingTreeDirty === undefined) findings.push(finding("RELEASE_TREE_STATE_NOT_RUN", "blocker", "working-tree state was not checked", "git"));
  else if (input.workingTreeDirty) findings.push(finding("WORKTREE_DIRTY", "blocker", "release receipt was generated from a dirty working tree", "git"));
  const counts = {
    errors: findings.filter((item) => item.severity === "error").length,
    blockers: findings.filter((item) => item.severity === "blocker").length,
    warnings: findings.filter((item) => item.severity === "warning").length,
  };
  const status = counts.errors > 0 ? "FAIL" : counts.blockers > 0 ? "BLOCKED" : "PASS";
  const orderedFindings = [...findings].sort((left, right) => left.code.localeCompare(right.code) || left.path?.localeCompare(right.path ?? "") || left.message.localeCompare(right.message));
  return {
    schemaVersion: 1,
    status,
    expectedToolCount: RELEASE_TOOL_COUNT,
    catalogToolCount: input.catalog.length,
    manifestCount: input.manifestFiles.length,
    toolPageCount: input.toolPageFiles.length,
    findings: orderedFindings,
    counts,
  };
}

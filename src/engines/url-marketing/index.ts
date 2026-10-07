import {
  SOCIAL_PLATFORM_RULES,
  xWeightedLength,
  type SocialPlatformRule,
} from "./social-limits";
import {
  getPreviewPreset,
  PREVIEW_PRESETS,
  type PreviewPreset,
  type PreviewPresetId,
} from "./preview-presets";

export const URL_MARKETING_ENGINE_VERSION = "url-marketing-v2";
const MAX_URL_MARKETING_TEXT = 2 * 1024 * 1024;
const MAX_SCANNED_TAGS = 20_000;

const TRACKING_KEYS = new Set([
  "dclid",
  "fbclid",
  "gclid",
  "gbraid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "wbraid",
  "_hsenc",
  "_hsmi",
]);

const SECOND_LEVEL_SUFFIXES = new Set([
  "ac.uk",
  "co.uk",
  "gov.uk",
  "ltd.uk",
  "plc.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "com.br",
  "com.cn",
  "co.jp",
  "co.kr",
  "co.in",
  "com.mx",
  "com.tr",
]);

export interface UrlEntry {
  readonly key: string;
  readonly value: string;
}

export interface NormalizeUrlOptions {
  readonly sortQuery?: boolean;
  readonly removeFragment?: boolean;
  readonly removeTrailingSlash?: boolean;
  readonly dropTracking?: boolean;
}

export interface NormalizedUrlDetails {
  readonly url: string;
  readonly changed: boolean;
  readonly dropped: readonly string[];
  readonly credentialWarning: boolean;
  readonly engineVersion: string;
}

export const SITEMAP_MAX_URLS = 50_000;
export const SITEMAP_MAX_BYTES = 50 * 1024 * 1024;
export const SITEMAP_LOC_MAX_CHARACTERS = 2_047;

export const SITEMAP_CHANGEFREQ_VALUES = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
] as const;

export type SitemapChangefreq = (typeof SITEMAP_CHANGEFREQ_VALUES)[number];

export interface SitemapEntry {
  readonly loc: string;
  readonly lastmod?: string;
  readonly changefreq?: SitemapChangefreq;
  readonly priority?: string;
}

export interface SitemapXmlResult {
  readonly xml: string;
  readonly entries: readonly SitemapEntry[];
  readonly count: number;
  readonly byteLength: number;
  readonly host: string;
  readonly metadataCounts: {
    readonly lastmod: number;
    readonly changefreq: number;
    readonly priority: number;
  };
  readonly engineVersion: string;
}

export interface ParsedUtmUrl {
  readonly url: string;
  readonly source?: string;
  readonly medium?: string;
  readonly campaign?: string;
  readonly id?: string;
  readonly term?: string;
  readonly content?: string;
  readonly parameters: readonly UrlEntry[];
  readonly utmParameters: readonly UrlEntry[];
  readonly unknownParameters: readonly UrlEntry[];
  readonly hasCredentials: boolean;
  readonly engineVersion: string;
}

export interface UrlComparison {
  readonly equal: boolean;
  readonly mode: "exact" | "semantic";
  readonly left: string;
  readonly right: string;
  readonly differences: readonly {
    readonly field: string;
    readonly left: string;
    readonly right: string;
  }[];
  readonly credentialWarning: boolean;
  /** The URL standard the normalisation follows, and when it was last checked. */
  readonly comparisonSource: string;
  readonly comparisonVerifiedOn: string;
  readonly normalizationRules: {
    readonly sortQuery: boolean;
    readonly ignoreFragment: boolean;
    readonly removeTrailingSlash: boolean;
    readonly dropTracking: boolean;
  };
  readonly network: "not-used";
  readonly verificationScope: "local-transform-only";
  readonly engineVersion: string;
}

/**
 * Comparison semantics are the WHATWG URL standard's, not this repository's:
 * host and scheme lowercased, default port dropped, dot segments resolved, and
 * percent-encoding left exactly as written.
 */
export const URL_COMPARISON_SOURCE = "WHATWG URL Standard — parsing and serialisation";
export const URL_COMPARISON_VERIFIED_ON = "2026-09-23";

export interface CanonicalUrlResult {
  readonly pageUrl: string;
  readonly canonicalUrl: string;
  readonly sameOrigin: boolean;
  readonly html: string;
  readonly warnings: readonly string[];
  readonly guidanceSource: string;
  readonly guidanceCheckedAt: string;
  readonly guidanceScope: "local-syntax";
  readonly network: "not-used";
  readonly engineVersion: string;
}

export const CANONICAL_GUIDANCE_SOURCE = "Google Search Central — canonical URL guidance";
export const CANONICAL_GUIDANCE_CHECKED_AT = "2026-09-23";

export interface DomainExtractionResult {
  readonly domains: readonly string[];
  readonly invalid: readonly string[];
  readonly engineVersion: string;
}

export interface DomainGroup {
  readonly domain: string;
  readonly subdomains: readonly string[];
  readonly count: number;
}

export interface DomainGroupingResult {
  readonly groups: readonly DomainGroup[];
  readonly byDomain: Readonly<Record<string, readonly string[]>>;
  readonly engineVersion: string;
}

export interface EmailDomainResult {
  readonly emails: readonly string[];
  readonly domains: readonly string[];
  readonly unmatched: readonly string[];
  readonly engineVersion: string;
}

export interface RobotsGroup {
  readonly userAgents: readonly string[];
  readonly rules: readonly {
    readonly directive: "allow" | "disallow";
    readonly path: string;
  }[];
}

export interface RobotsResult {
  readonly groups: readonly RobotsGroup[];
  readonly sitemaps: readonly string[];
  readonly errors: readonly string[];
  readonly guidanceSource: string;
  readonly guidanceCheckedAt: string;
  readonly guidanceScope: "local-syntax";
  readonly network: "not-used";
  readonly engineVersion: string;
}

export const ROBOTS_GUIDANCE_SOURCE = "Google Search Central — robots.txt introduction";
export const ROBOTS_GUIDANCE_CHECKED_AT = "2026-09-23";

export interface OpenGraphResult {
  readonly tags: Readonly<Record<string, string>>;
  /** Number of social tags actually found, so an empty paste is visible. */
  readonly tagCount: number;
  readonly title: string | null;
  readonly description: string | null;
  readonly image: string | null;
  readonly url: string | null;
  readonly type: string | null;
  /** Which key supplied the image, e.g. `og:image` or `og:image:secure_url`. */
  readonly imageSourceKey: string | null;
  /** Set when a relative URL was made absolute, naming the placeholder host. */
  readonly relativeBase: string | null;
  readonly titleCharacters: number;
  readonly descriptionCharacters: number;
  /** Core Open Graph properties still absent, without the `og:` prefix. */
  readonly missingCore: readonly string[];
  /** The specification this extractor follows, and when it was last checked. */
  readonly protocolSource: string;
  readonly protocolVerifiedOn: string;
  readonly previewPreset: PreviewPreset;
  readonly warnings: readonly string[];
  readonly engineVersion: string;
}

export type SocialCountingMethod = "codePoints" | "xWeighted";
export { SOCIAL_PLATFORM_RULES };
export type { SocialPlatformRule };

export type SocialPlatform =
  | "x"
  | "twitter"
  | "linkedin"
  | "instagram"
  | "facebook"
  | "youtube"
  | "tiktok"
  | "mastodon"
  | "bluesky";

export interface SocialLimitResult {
  readonly platform: SocialPlatform;
  readonly platformLabelIt: string;
  /** The limit actually applied, which may be a reader-supplied override. */
  readonly limit: number;
  readonly declaredLimit: number;
  readonly limitOverridden: boolean;
  readonly limitScopeIt: string;
  readonly limitSource: string;
  readonly limitVerifiedOn: string;
  /** Unicode code points, counted the same way for every platform. */
  readonly characters: number;
  /** Only filled for platforms that publish a weighted rule (today: X). */
  readonly weightedCharacters: number | null;
  readonly countingMethod: SocialCountingMethod;
  readonly remaining: number;
  readonly remainingWeighted: number | null;
  readonly overBy: number;
  readonly withinLimit: boolean;
  readonly withinLimitWeighted: boolean | null;
  readonly lineBreaks: number;
  readonly previewPreset: PreviewPreset;
  readonly engineVersion: string;
}

export interface MetaPreviewResult {
  readonly title: string;
  readonly description: string;
  readonly titleCharacters: number;
  readonly descriptionCharacters: number;
  readonly titleLimit: number;
  readonly descriptionLimit: number;
  readonly titleLimitOverridden: boolean;
  readonly descriptionLimitOverridden: boolean;
  readonly titleLimitSource: string;
  readonly descriptionLimitSource: string;
  readonly titleOverBy: number;
  readonly descriptionOverBy: number;
  readonly titleWithinLimit: boolean;
  readonly descriptionWithinLimit: boolean;
  /**
   * A search listing does not fail when a field is too long; it truncates.
   * These are what a reader would actually see, so the tool shows them rather
   * than only a number.
   */
  readonly truncatedTitle: string;
  readonly truncatedDescription: string;
  readonly escapedTitle: string;
  readonly escapedDescription: string;
  readonly previewPreset: PreviewPreset;
  readonly engineVersion: string;
}

export { PREVIEW_PRESETS };
export type { PreviewPreset, PreviewPresetId };

/** The reference lengths a SERP preview is measured against. */
export const META_TITLE_DEFAULT_LIMIT = 60;
export const META_DESCRIPTION_DEFAULT_LIMIT = 160;
export const META_TITLE_LIMIT_SOURCE = "Google Search Central — guida ai title link, lunghezza indicativa";
export const META_DESCRIPTION_LIMIT_SOURCE = "Google Search Central — guida alle meta description, lunghezza indicativa";

export interface RedirectHop {
  readonly url: string;
  readonly status: number;
  readonly location: string | null;
  readonly delayMs: number | null;
}

export interface RedirectChainResult {
  readonly hops: readonly RedirectHop[];
  readonly hopCount: number;
  readonly loopDetected: boolean;
  readonly terminalUrl: string;
  readonly warnings: readonly string[];
  readonly engineVersion: string;
}

export type RedirectLiveOutcome = "complete" | "loop" | "timeout" | "blocked" | "hop-limit";

export interface RedirectFetchResponse {
  readonly status: number;
  readonly headers: {
    get(name: string): string | null;
  };
}

export type RedirectFetcher = (input: string, init: RequestInit) => Promise<RedirectFetchResponse>;

export interface RedirectLiveResult {
  readonly requestedUrl: string;
  readonly hops: readonly RedirectHop[];
  readonly hopCount: number;
  readonly loopDetected: boolean;
  readonly terminalUrl: string;
  readonly outcome: RedirectLiveOutcome;
  readonly retrievedAt: string;
  readonly warnings: readonly string[];
  readonly failureCode: string | null;
  readonly network: "used";
  readonly privacyBoundary: string;
  readonly engineVersion: string;
}

function invalid(code: string): never {
  throw new Error(code);
}

function assertMarketingText(value: string): void {
  if (value.length > MAX_URL_MARKETING_TEXT) invalid("INPUT_TOO_LARGE");
}

function redactMarketingOutput(value: string): string {
  try {
    return redactUrl(new URL(value));
  } catch {
    return redactUrlCredentials(value);
  }
}

function validatePercentEscapes(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "%") continue;
    const escape = value.slice(index + 1, index + 3);
    if (!/^[0-9a-f]{2}$/iu.test(escape)) invalid("INVALID_URL");
  }
}

export function parseHttpUrl(input: string): URL {
  if (typeof input !== "string" || input.trim() === "") invalid("INVALID_URL");
  const value = input.trim();
  validatePercentEscapes(value);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid("INVALID_URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") invalid("UNSAFE_URL_SCHEME");
  if (url.hostname === "") invalid("INVALID_URL");
  return url;
}

export function hasUrlCredentials(url: URL): boolean {
  return url.username !== "" || url.password !== "";
}

export function redactUrl(url: URL): string {
  const copy = new URL(url.href);
  copy.username = "";
  copy.password = "";
  return copy.href;
}

export function redactUrlCredentials(input: string): string {
  const value = input.trim();
  try {
    const url = new URL(value);
    if (url.username === "" && url.password === "") return value;
    return value.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/\s@]*@/iu, "$1[redacted]@");
  } catch {
    return value.replace(/^((?:[a-z][a-z0-9+.-]*:)?\/\/)[^/\s@]*@/iu, "$1[redacted]@");
  }
}

export function displayUrl(input: URL | string): string {
  return input instanceof URL ? redactUrl(input) : redactUrl(parseHttpUrl(input));
}

function isTrackingKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_KEYS.has(normalized);
}

export function queryEntries(url: URL): readonly UrlEntry[] {
  return [...url.searchParams.entries()].map(([key, value]) => ({ key, value }));
}

function decodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(value.replaceAll("+", " "));
  } catch {
    return value;
  }
}

/**
 * Query parameters as raw `key=value` text.
 *
 * Re-serialising through `URLSearchParams` would be shorter to write and wrong:
 * it rewrites `%20` as `+`, so `?q=a%20b` and `?q=a+b` would compare equal even
 * though RFC 3986 does not define them as equivalent. Reordering is therefore
 * done on the original text, sorted by decoded key so the order a reader expects
 * is unchanged.
 */
function rawQuerySegments(url: URL): readonly string[] {
  const body = url.search.startsWith("?") ? url.search.slice(1) : url.search;
  if (body === "") return [];
  return body.split("&").filter((segment) => segment !== "");
}

function segmentKey(segment: string): string {
  return decodeQueryComponent(segment.split("=")[0] ?? "");
}

function sortedSegments(segments: readonly string[]): readonly string[] {
  return segments
    .map((segment, index) => ({ segment, index, key: segmentKey(segment) }))
    .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : left.index - right.index))
    .map(({ segment }) => segment);
}

export function normalizeUrlDetails(input: string, options: NormalizeUrlOptions = {}): NormalizedUrlDetails {
  const source = parseHttpUrl(input);
  const original = displayUrl(source);
  const url = new URL(source.href);
  const entries = queryEntries(url);
  const dropped = options.dropTracking === true ? [...new Set(entries.filter(({ key }) => isTrackingKey(key)).map(({ key }) => key))] : [];
  const raw = rawQuerySegments(url);
  const keptRaw = options.dropTracking === true ? raw.filter((segment) => !isTrackingKey(segmentKey(segment))) : raw;
  url.search = ((options.sortQuery ?? true) ? sortedSegments(keptRaw) : keptRaw).join("&");
  if (options.removeFragment === true) url.hash = "";
  if (options.removeTrailingSlash === true && url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  const output = displayUrl(url);
  return {
    url: output,
    changed: output !== original,
    dropped,
    credentialWarning: hasUrlCredentials(source),
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

export function normalizeUrl(input: string, options: NormalizeUrlOptions = {}): string {
  return normalizeUrlDetails(input, { sortQuery: true, ...options }).url;
}

function sitemapXmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 0 || month < 1 || month > 12 || day < 1) return false;
  const monthLengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
  return day <= (monthLengths[month - 1] ?? 0);
}

export function isValidSitemapLastmod(value: string): boolean {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (dateMatch !== null) {
    return validCalendarDate(Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3]));
  }
  const dateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/u.exec(value);
  if (dateTimeMatch === null) return false;
  const validDate = validCalendarDate(Number(dateTimeMatch[1]), Number(dateTimeMatch[2]), Number(dateTimeMatch[3]));
  if (!validDate) return false;
  const hour = Number(dateTimeMatch[4]);
  const minute = Number(dateTimeMatch[5]);
  const second = Number(dateTimeMatch[6]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  const zone = dateTimeMatch[7] ?? "";
  if (zone === "Z") return true;
  const zoneMatch = /^[+-](\d{2}):(\d{2})$/u.exec(zone);
  return zoneMatch !== null && Number(zoneMatch[1]) <= 23 && Number(zoneMatch[2]) <= 59;
}

function validSitemapPriority(value: string): boolean {
  if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/u.test(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1;
}

export function assertSitemapBounds(urlCount: number, byteLength: number): void {
  if (!Number.isSafeInteger(urlCount) || urlCount < 1) invalid("INVALID_SITEMAP_EMPTY");
  if (urlCount > SITEMAP_MAX_URLS) invalid("INVALID_SITEMAP_URL_COUNT_LIMIT");
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > SITEMAP_MAX_BYTES) invalid("INVALID_SITEMAP_SIZE_LIMIT");
}

function parseSitemapLine(line: string, row: number): { rawUrl: string; lastmod?: string; changefreq?: SitemapChangefreq; priority?: string } {
  const columns = line.split("\t");
  if (columns.length > 4) invalid(`INVALID_SITEMAP_ROW_${row}_COLUMN_COUNT`);
  const rawUrl = (columns[0] ?? "").trim();
  if (rawUrl === "") invalid(`INVALID_SITEMAP_ROW_${row}_URL`);
  const lastmod = (columns[1] ?? "").trim();
  const changefreq = (columns[2] ?? "").trim();
  const priority = (columns[3] ?? "").trim();
  if (lastmod !== "" && !isValidSitemapLastmod(lastmod)) invalid(`INVALID_SITEMAP_ROW_${row}_LASTMOD`);
  if (changefreq !== "" && !SITEMAP_CHANGEFREQ_VALUES.includes(changefreq as SitemapChangefreq)) invalid(`INVALID_SITEMAP_ROW_${row}_CHANGEFREQ`);
  if (priority !== "" && !validSitemapPriority(priority)) invalid(`INVALID_SITEMAP_ROW_${row}_PRIORITY`);
  return {
    rawUrl,
    ...(lastmod === "" ? {} : { lastmod }),
    ...(changefreq === "" ? {} : { changefreq: changefreq as SitemapChangefreq }),
    ...(priority === "" ? {} : { priority }),
  };
}

export function generateSitemapXml(input: string): SitemapXmlResult {
  if (typeof input !== "string") invalid("INVALID_SITEMAP_INPUT");
  const inputBytes = new TextEncoder().encode(input).byteLength;
  if (inputBytes > SITEMAP_MAX_BYTES) invalid("INVALID_SITEMAP_INPUT_SIZE_LIMIT");
  const sourceLines = input.replace(/\r\n?/gu, "\n").split("\n");
  const rows = sourceLines
    .map((line, index) => ({ line, row: index + 1 }))
    .filter(({ line }) => line.trim() !== "");
  if (rows.length === 0) invalid("INVALID_SITEMAP_EMPTY");
  if (rows.length > SITEMAP_MAX_URLS) invalid("INVALID_SITEMAP_URL_COUNT_LIMIT");

  const entries: SitemapEntry[] = [];
  let requiredHost: string | null = null;
  for (const { line, row } of rows) {
    const parsed = parseSitemapLine(line, row);
    let source: URL;
    try {
      source = parseHttpUrl(parsed.rawUrl);
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_URL";
      invalid(`INVALID_SITEMAP_ROW_${row}_${code}`);
    }
    if (hasUrlCredentials(source)) invalid(`INVALID_SITEMAP_ROW_${row}_CREDENTIALS`);
    const normalized = normalizeUrlDetails(parsed.rawUrl, {
      sortQuery: true,
      removeFragment: false,
      removeTrailingSlash: false,
      dropTracking: false,
    }).url;
    if ([...normalized].length > SITEMAP_LOC_MAX_CHARACTERS) invalid(`INVALID_SITEMAP_ROW_${row}_LOC_LENGTH`);
    const normalizedHost = new URL(normalized).host;
    if (requiredHost === null) requiredHost = normalizedHost;
    else if (normalizedHost !== requiredHost) invalid(`INVALID_SITEMAP_ROW_${row}_HOST_MISMATCH`);
    entries.push({
      loc: normalized,
      ...(parsed.lastmod === undefined ? {} : { lastmod: parsed.lastmod }),
      ...(parsed.changefreq === undefined ? {} : { changefreq: parsed.changefreq }),
      ...(parsed.priority === undefined ? {} : { priority: parsed.priority }),
    });
  }

  const body = entries.map((entry) => {
    const metadata = [
      entry.lastmod === undefined ? "" : `\n    <lastmod>${sitemapXmlEscape(entry.lastmod)}</lastmod>`,
      entry.changefreq === undefined ? "" : `\n    <changefreq>${sitemapXmlEscape(entry.changefreq)}</changefreq>`,
      entry.priority === undefined ? "" : `\n    <priority>${sitemapXmlEscape(entry.priority)}</priority>`,
    ].join("");
    return `  <url>\n    <loc>${sitemapXmlEscape(entry.loc)}</loc>${metadata}\n  </url>`;
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  const byteLength = new TextEncoder().encode(xml).byteLength;
  assertSitemapBounds(entries.length, byteLength);
  return {
    xml,
    entries,
    count: entries.length,
    byteLength,
    host: requiredHost ?? "",
    metadataCounts: {
      lastmod: entries.filter((entry) => entry.lastmod !== undefined).length,
      changefreq: entries.filter((entry) => entry.changefreq !== undefined).length,
      priority: entries.filter((entry) => entry.priority !== undefined).length,
    },
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

const UTM_FIELDS: Readonly<Record<string, string>> = {
  utm_source: "source",
  utm_medium: "medium",
  utm_campaign: "campaign",
  utm_id: "id",
  utm_term: "term",
  utm_content: "content",
};

export function parseUtmUrl(input: string): ParsedUtmUrl {
  const url = parseHttpUrl(input);
  const parameters = queryEntries(url);
  const utmParameters: UrlEntry[] = [];
  const unknownParameters: UrlEntry[] = [];
  const values: Record<string, string> = {};
  for (const entry of parameters) {
    const field = UTM_FIELDS[entry.key.toLowerCase()];
    if (field === undefined) {
      unknownParameters.push(entry);
      continue;
    }
    utmParameters.push(entry);
    if (values[field] === undefined) values[field] = entry.value;
  }
  return {
    url: displayUrl(url),
    ...(values.source === undefined ? {} : { source: values.source }),
    ...(values.medium === undefined ? {} : { medium: values.medium }),
    ...(values.campaign === undefined ? {} : { campaign: values.campaign }),
    ...(values.id === undefined ? {} : { id: values.id }),
    ...(values.term === undefined ? {} : { term: values.term }),
    ...(values.content === undefined ? {} : { content: values.content }),
    parameters,
    utmParameters,
    unknownParameters,
    hasCredentials: hasUrlCredentials(url),
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

function comparePart(left: URL, right: URL, field: string, ignoreFragment: boolean): { field: string; left: string; right: string } | null {
  const leftValue = field === "hash" && ignoreFragment ? "" : field === "query" ? left.search : field === "path" ? left.pathname : field === "origin" ? left.origin : field === "credentials" ? `${left.username}:${left.password}` : left[field as keyof URL] as string;
  const rightValue = field === "hash" && ignoreFragment ? "" : field === "query" ? right.search : field === "path" ? right.pathname : field === "origin" ? right.origin : field === "credentials" ? `${right.username}:${right.password}` : right[field as keyof URL] as string;
  if (leftValue === rightValue) return null;
  return {
    field,
    left: field === "credentials" ? "[redacted]" : leftValue,
    right: field === "credentials" ? "[redacted]" : rightValue,
  };
}

export function compareUrls(
  leftInput: string,
  rightInput: string,
  options: {
    readonly mode?: "exact" | "semantic";
    readonly ignoreFragment?: boolean;
    readonly sortQuery?: boolean;
    readonly removeTrailingSlash?: boolean;
    readonly dropTracking?: boolean;
  } = {},
): UrlComparison {
  const left = parseHttpUrl(leftInput);
  const right = parseHttpUrl(rightInput);
  const mode = options.mode ?? "semantic";
  if (mode !== "exact" && mode !== "semantic") invalid("INVALID_COMPARISON_MODE");
  const ignoreFragment = options.ignoreFragment ?? mode === "semantic";
  const sortQuery = options.sortQuery ?? mode === "semantic";
  const removeTrailingSlash = options.removeTrailingSlash ?? false;
  const dropTracking = options.dropTracking ?? false;
  const normalizationRules = { sortQuery, ignoreFragment, removeTrailingSlash, dropTracking };
  const leftNormalized = normalizeUrlDetails(left.href, {
    sortQuery,
    removeFragment: ignoreFragment,
    removeTrailingSlash,
    dropTracking,
  });
  const rightNormalized = normalizeUrlDetails(right.href, {
    sortQuery,
    removeFragment: ignoreFragment,
    removeTrailingSlash,
    dropTracking,
  });
  const leftUrl = parseHttpUrl(leftNormalized.url);
  const rightUrl = parseHttpUrl(rightNormalized.url);
  const differences = ["origin", "path", "query", "hash"]
    .map((field) => comparePart(leftUrl, rightUrl, field, ignoreFragment))
    .filter((difference): difference is { field: string; left: string; right: string } => difference !== null);
  if (hasUrlCredentials(left) !== hasUrlCredentials(right)) {
    differences.push({ field: "credentials", left: hasUrlCredentials(left) ? "present" : "absent", right: hasUrlCredentials(right) ? "present" : "absent" });
  }
  return {
    equal: differences.length === 0,
    mode,
    left: leftNormalized.url,
    right: rightNormalized.url,
    differences,
    credentialWarning: leftNormalized.credentialWarning || rightNormalized.credentialWarning,
    comparisonSource: URL_COMPARISON_SOURCE,
    comparisonVerifiedOn: URL_COMPARISON_VERIFIED_ON,
    normalizationRules,
    network: "not-used",
    verificationScope: "local-transform-only",
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function canonicalUrlDetails(
  pageInput: string,
  canonicalInput: string,
  options: { readonly removeFragment?: boolean } = {},
): CanonicalUrlResult {
  const page = parseHttpUrl(pageInput);
  let canonical: URL;
  try {
    canonical = new URL(canonicalInput, page);
  } catch {
    return invalid("INVALID_URL");
  }
  if (canonical.protocol !== "http:" && canonical.protocol !== "https:") invalid("UNSAFE_URL_SCHEME");
  validatePercentEscapes(canonical.href);
  if (hasUrlCredentials(canonical)) invalid("URL_CREDENTIALS_NOT_ALLOWED");
  if (options.removeFragment === true) canonical.hash = "";
  const warnings: string[] = [];
  if (canonical.origin !== page.origin) warnings.push("CROSS_ORIGIN_CANONICAL");
  if (canonical.search !== "") warnings.push("CANONICAL_HAS_QUERY");
  return {
    pageUrl: displayUrl(page),
    canonicalUrl: canonical.href,
    sameOrigin: canonical.origin === page.origin,
    html: `<link rel="canonical" href="${escapeAttribute(canonical.href)}">`,
    warnings,
    guidanceSource: CANONICAL_GUIDANCE_SOURCE,
    guidanceCheckedAt: CANONICAL_GUIDANCE_CHECKED_AT,
    guidanceScope: "local-syntax",
    network: "not-used",
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

function domainFromToken(token: string): string | null {
  const cleaned = token.trim().replace(/^[\s<("']+|[\s>)"',;!?]+$/gu, "");
  if (cleaned === "" || cleaned.includes("@")) return null;
  try {
    const url = cleaned.includes("://") ? parseHttpUrl(cleaned) : parseHttpUrl(`https://${cleaned}`);
    return url.hostname.toLowerCase().replace(/\.$/u, "");
  } catch {
    return null;
  }
}

function redactToken(value: string): string {
  try {
    return value.includes("://") ? redactUrl(parseHttpUrl(value)) : value;
  } catch {
    return redactUrlCredentials(value);
  }
}

function inputTokens(input: string | readonly string[]): readonly string[] {
  if (typeof input !== "string") return input;
  return input.split(/[\s,;]+/u).map((token) => token.trim()).filter((token) => token !== "");
}

export function extractDomains(input: string | readonly string[]): DomainExtractionResult {
  const domains: string[] = [];
  const invalidTokens: string[] = [];
  for (const token of inputTokens(input)) {
    const domain = domainFromToken(token);
    if (domain === null) {
      invalidTokens.push(redactToken(token));
      continue;
    }
    if (!domains.includes(domain)) domains.push(domain);
  }
  return { domains, invalid: invalidTokens, engineVersion: URL_MARKETING_ENGINE_VERSION };
}

function registrableDomain(domain: string): string {
  const labels = domain.toLowerCase().split(".");
  if (labels.length <= 2) return labels.join(".");
  const suffix = labels.slice(-2).join(".");
  if (SECOND_LEVEL_SUFFIXES.has(suffix) && labels.length >= 3) return labels.slice(-3).join(".");
  return suffix;
}

export function groupDomains(input: string | readonly string[]): DomainGroupingResult {
  const extraction = extractDomains(input);
  const grouped = new Map<string, string[]>();
  for (const domain of extraction.domains) {
    const base = registrableDomain(domain);
    const values = grouped.get(base) ?? [];
    if (!values.includes(domain)) values.push(domain);
    grouped.set(base, values);
  }
  const groups = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, subdomains]) => ({ domain, subdomains, count: subdomains.length }));
  return {
    groups,
    byDomain: Object.fromEntries(groups.map(({ domain, subdomains }) => [domain, subdomains])),
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

const EMAIL_PATTERN = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/giu;

export function extractEmailDomains(input: string | readonly string[]): EmailDomainResult {
  const source = typeof input === "string" ? input : input.join("\n");
  assertMarketingText(source);
  const emails: string[] = [];
  for (const match of source.matchAll(EMAIL_PATTERN)) {
    const email = match[0].toLowerCase();
    if (!emails.includes(email)) emails.push(email);
  }
  const domains: string[] = [];
  for (const email of emails) {
    const domain = email.slice(email.lastIndexOf("@") + 1);
    if (!domains.includes(domain)) domains.push(domain);
  }
  const unmatched = inputTokens(source).filter((token) => token.includes("@") && !emails.some((email) => token.toLowerCase() === email));
  return { emails, domains, unmatched, engineVersion: URL_MARKETING_ENGINE_VERSION };
}

function decodeEntities(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
    nbsp: "\u00a0",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole, entity: string) => {
    try {
      if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    } catch {
      return whole;
    }
    return named[entity.toLowerCase()] ?? whole;
  });
}

function metadataValues(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  if (record.tags !== undefined && typeof record.tags === "object" && record.tags !== null) return record.tags as Record<string, unknown>;
  return record;
}

export interface ScannedTag {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
}

/**
 * A real HTML tag scanner rather than a regular expression over `<meta ...>`.
 * A regex stops at the first `>`, which silently truncates
 * `<meta content="a > b" property="og:title">`; quoted attribute values are
 * therefore tracked explicitly, and self-closing tags are handled. Nothing is
 * executed or fetched: the input is only read.
 */
export function scanHtmlTags(html: string): readonly ScannedTag[] {
  if (typeof html !== "string") invalid("INVALID_INPUT");
  assertMarketingText(html);
  const tags: ScannedTag[] = [];
  let index = 0;
  while (index < html.length) {
    const start = html.indexOf("<", index);
    if (start === -1) break;
    const opening = /^<\s*([a-z][a-z0-9-]*)/iu.exec(html.slice(start, start + 40));
    const closing = /^<\s*\/\s*[a-z]/iu.test(html.slice(start, start + 4));
    if (closing) {
      index = start + 1;
      continue;
    }
    if (opening === null) {
      index = start + 1;
      continue;
    }
    const attributes: Record<string, string> = {};
    let cursor = start + opening[0].length;
    let quote: string | null = null;
    while (cursor < html.length) {
      const character = html[cursor]!;
      if (quote !== null) {
        if (character === quote) quote = null;
        cursor += 1;
        continue;
      }
      if (character === "\"" || character === "'") {
        quote = character;
        cursor += 1;
        continue;
      }
      if (character === ">") break;
      if (character === "/" || /\s/u.test(character)) {
        cursor += 1;
        continue;
      }
      const key = /^([^\s=/>]+)/u.exec(html.slice(cursor));
      if (key === null) {
        cursor += 1;
        continue;
      }
      cursor += key[0].length;
      let value = "";
      const equals = /^\s*=\s*/u.exec(html.slice(cursor));
      if (equals !== null) {
        cursor += equals[0].length;
        const quoteStart = html[cursor];
        if (quoteStart === "\"" || quoteStart === "'") {
          cursor += 1;
          const end = html.indexOf(quoteStart, cursor);
          if (end === -1) {
            value = html.slice(cursor);
            cursor = html.length;
          } else {
            value = html.slice(cursor, end);
            cursor = end + 1;
          }
        } else {
          const bare = /^[^\s>]*/u.exec(html.slice(cursor));
          value = bare?.[0] ?? "";
          cursor += value.length;
        }
      }
      attributes[key[0]!.toLowerCase()] = decodeEntities(value);
    }
    tags.push({ name: opening[1]!.toLowerCase(), attributes });
    if (tags.length >= MAX_SCANNED_TAGS) break;
    index = cursor + 1;
  }
  return tags;
}

/** Host used to make a relative social URL absolute, so nothing is fetched. */
export const RELATIVE_RESOLUTION_BASE = "https://relative.invalid/";

const OG_CORE_KEYS = ["og:title", "og:description", "og:image", "og:url", "og:type"] as const;

/**
 * The specification this extractor follows. The published sizes of the OGP
 * image properties are advisory rather than binding, so the declared width and
 * height are reported as warnings only when present and malformed, never as a
 * failure.
 */
export const OPEN_GRAPH_PROTOCOL_SOURCE = "The Open Graph protocol (ogp.me) — basic metadata";
export const OPEN_GRAPH_PROTOCOL_VERIFIED_ON = "2026-09-23";

export function parseOpenGraph(
  value: string | Readonly<Record<string, unknown>>,
  options: { readonly preset?: PreviewPresetId } = {},
): OpenGraphResult {
  const tags: Record<string, string> = {};
  let tagCount = 0;
  if (typeof value === "string") {
    if (value.trim() === "") invalid("INVALID_INPUT");
    for (const tag of scanHtmlTags(value)) {
      if (tag.name !== "meta") continue;
      tagCount += 1;
      const key = tag.attributes.property ?? tag.attributes.name;
      if (key === undefined) continue;
      const normalized = key.toLowerCase();
      if (!normalized.startsWith("og:") && !normalized.startsWith("twitter:")) continue;
      tags[normalized] = redactUrlCredentials(tag.attributes.content ?? "");
    }
  } else {
    for (const [key, raw] of Object.entries(metadataValues(value))) {
      if (typeof raw !== "string") continue;
      const normalized = key.toLowerCase();
      if (!normalized.startsWith("og:") && !normalized.startsWith("twitter:")) continue;
      tags[normalized] = redactUrlCredentials(decodeEntities(raw));
      tagCount += 1;
    }
  }
  const warnings: string[] = [];
  let resolvedImageKey: string | null = null;
  let relativeResolved = false;
  const resolve = (...keys: readonly string[]): string | null => {
    for (const key of keys) {
      const candidate = tags[key];
      if (candidate === undefined || candidate.trim() === "") continue;
      try {
        const parsed = new URL(candidate, RELATIVE_RESOLUTION_BASE);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          warnings.push(`UNSAFE_${key.toUpperCase().replaceAll(":", "_")}`);
          continue;
        }
        if (!/^[a-z]+:/u.test(candidate)) relativeResolved = true;
        if (resolvedImageKey === null && (key.startsWith("og:image") || key.startsWith("twitter:image"))) resolvedImageKey = key;
        return redactUrl(parsed);
      } catch {
        warnings.push(`INVALID_${key.toUpperCase().replaceAll(":", "_")}`);
      }
    }
    return null;
  };
  const first = (...keys: readonly string[]): string | null => {
    for (const key of keys) {
      const value = tags[key];
      if (value !== undefined && value.trim() !== "") return value;
    }
    return null;
  };
  const title = first("og:title", "twitter:title");
  const description = first("og:description", "twitter:description");
  const type = first("og:type");
  const image = resolve("og:image", "og:image:secure_url", "og:image:url", "twitter:image", "twitter:image:src");
  const url = resolve("og:url", "twitter:url");
  for (const [name, value] of [["title", title], ["description", description], ["image", image], ["url", url], ["type", type]] as const) {
    if (value === null) warnings.push(`MISSING_${name.toUpperCase()}`);
  }
  if (relativeResolved) warnings.push("RELATIVE_URL_RESOLVED");
  if (image !== null) {
    for (const key of ["og:image:width", "og:image:height"]) {
      const raw = tags[key];
      if (raw === undefined) continue;
      if (!/^[1-9][0-9]{0,5}$/u.test(raw.trim())) warnings.push(`INVALID_${key.toUpperCase().replaceAll(":", "_")}`);
    }
  }
  const present = new Set(Object.keys(tags));
  const missingCore = OG_CORE_KEYS.filter((key) => !present.has(key) && !(key === "og:image" && resolvedImageKey !== null));
  return {
    tags,
    tagCount,
    title,
    description,
    image,
    url,
    type,
    imageSourceKey: resolvedImageKey,
    relativeBase: relativeResolved ? RELATIVE_RESOLUTION_BASE : null,
    titleCharacters: title === null ? 0 : [...title].length,
    descriptionCharacters: description === null ? 0 : [...description].length,
    missingCore: missingCore.map((key) => key.replaceAll("og:", "")),
    protocolSource: OPEN_GRAPH_PROTOCOL_SOURCE,
    protocolVerifiedOn: OPEN_GRAPH_PROTOCOL_VERIFIED_ON,
    previewPreset: getPreviewPreset(options.preset ?? "social-card"),
    warnings: [...new Set(warnings)],
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

function parseRobotsLine(line: string): { readonly directive: string; readonly value: string } | null {
  const separator = line.indexOf(":");
  if (separator <= 0) return null;
  return { directive: line.slice(0, separator).trim().toLowerCase(), value: line.slice(separator + 1).trim() };
}

export function parseRobots(text: string): RobotsResult {
  if (typeof text !== "string") invalid("INVALID_INPUT");
  assertMarketingText(text);
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  const errors: string[] = [];
  let current: { userAgents: string[]; rules: { directive: "allow" | "disallow"; path: string }[] } | null = null;
  const finish = () => {
    if (current !== null && current.userAgents.length > 0) groups.push({ userAgents: current.userAgents, rules: current.rules });
    current = null;
  };
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.replace(/#.*$/u, "").trim();
    if (line === "") continue;
    const parsed = parseRobotsLine(line);
    if (parsed === null) {
      errors.push(rawLine);
      continue;
    }
    if (parsed.directive === "user-agent") {
      if (current === null || current.rules.length > 0) finish();
      current ??= { userAgents: [], rules: [] };
      current.userAgents.push(parsed.value);
    } else if (parsed.directive === "allow" || parsed.directive === "disallow") {
      if (current === null) current = { userAgents: ["*"], rules: [] };
      current.rules.push({ directive: parsed.directive, path: parsed.value });
    } else if (parsed.directive === "sitemap") {
      const sitemap = redactMarketingOutput(parsed.value);
      if (sitemap !== "" && !sitemaps.includes(sitemap)) sitemaps.push(sitemap);
    } else {
      errors.push(rawLine);
    }
  }
  finish();
  return {
    groups,
    sitemaps,
    errors,
    guidanceSource: ROBOTS_GUIDANCE_SOURCE,
    guidanceCheckedAt: ROBOTS_GUIDANCE_CHECKED_AT,
    guidanceScope: "local-syntax",
    network: "not-used",
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

/**
 * Resolves a platform name, including the names people actually type ("X.com",
 * "x / twitter"), and returns its published rule. An unknown platform fails
 * closed: the tool never falls back to a guessed limit.
 */
function socialRule(value: string): SocialPlatformRule {
  if (typeof value !== "string") invalid("INVALID_SOCIAL_PLATFORM");
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/gu, " ")
    .replace(/^x\s*\.\s*com$/u, "x")
    .replace(/^x\s+ex\s+twitter$/u, "x")
    .replace(/^x\s+twitter$/u, "x")
    .replace(/^(?:ex\s+)?twitter$/u, "x");
  const rule = SOCIAL_PLATFORM_RULES.find((candidate) => candidate.id === normalized || candidate.labelIt.toLowerCase() === normalized);
  if (rule === undefined) invalid("INVALID_SOCIAL_PLATFORM");
  return rule;
}

export function listSocialPlatformRules(): readonly SocialPlatformRule[] {
  return SOCIAL_PLATFORM_RULES;
}

export function checkSocialLimit(platformInput: string, text: string, customLimit?: number): SocialLimitResult {
  if (typeof text !== "string") invalid("INVALID_INPUT");
  assertMarketingText(text);
  const rule = socialRule(platformInput);
  const limit = customLimit ?? rule.limit;
  if (!Number.isInteger(limit) || limit < 1) invalid("INVALID_SOCIAL_LIMIT");
  const characters = [...text].length;
  const weighted = rule.counting === "xWeighted" ? xWeightedLength(text) : null;
  const effective = weighted ?? characters;
  return {
    platform: rule.id as SocialPlatform,
    platformLabelIt: rule.labelIt,
    limit,
    declaredLimit: rule.limit,
    limitOverridden: customLimit !== undefined && customLimit !== rule.limit,
    limitScopeIt: rule.scopeIt,
    limitSource: rule.source,
    limitVerifiedOn: rule.verifiedOn,
    characters,
    weightedCharacters: weighted,
    countingMethod: rule.counting,
    remaining: limit - characters,
    remainingWeighted: weighted === null ? null : limit - weighted,
    overBy: Math.max(0, effective - limit),
    withinLimit: effective <= limit,
    withinLimitWeighted: weighted === null ? null : weighted <= limit,
    lineBreaks: (text.match(/\r\n|\r|\n/gu) ?? []).length,
    previewPreset: getPreviewPreset("social-card"),
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

/**
 * HTML text escaping. The apostrophe is included because the escaped value is
 * meant to be pasted into a meta tag, where it can land inside an attribute.
 */
function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function previewMeta(
  titleInput: string,
  descriptionInput: string,
  limits: {
    readonly title?: number;
    readonly description?: number;
    readonly preset?: PreviewPresetId;
  } = {},
): MetaPreviewResult {
  if (typeof titleInput !== "string" || typeof descriptionInput !== "string") invalid("INVALID_INPUT");
  assertMarketingText(titleInput);
  assertMarketingText(descriptionInput);
  const title = titleInput.trim();
  const description = descriptionInput.trim();
  const titleLimit = limits.title ?? META_TITLE_DEFAULT_LIMIT;
  const descriptionLimit = limits.description ?? META_DESCRIPTION_DEFAULT_LIMIT;
  if (!Number.isInteger(titleLimit) || titleLimit < 1 || !Number.isInteger(descriptionLimit) || descriptionLimit < 1) invalid("INVALID_META_LIMIT");
  const titleCharacters = [...title].length;
  const descriptionCharacters = [...description].length;
  const titleCodePoints = [...title];
  const descriptionCodePoints = [...description];
  return {
    title,
    description,
    titleCharacters,
    descriptionCharacters,
    titleLimit,
    descriptionLimit,
    titleLimitOverridden: limits.title !== undefined && limits.title !== META_TITLE_DEFAULT_LIMIT,
    descriptionLimitOverridden: limits.description !== undefined && limits.description !== META_DESCRIPTION_DEFAULT_LIMIT,
    titleLimitSource: META_TITLE_LIMIT_SOURCE,
    descriptionLimitSource: META_DESCRIPTION_LIMIT_SOURCE,
    titleOverBy: Math.max(0, titleCharacters - titleLimit),
    descriptionOverBy: Math.max(0, descriptionCharacters - descriptionLimit),
    titleWithinLimit: titleCharacters <= titleLimit,
    descriptionWithinLimit: descriptionCharacters <= descriptionLimit,
    truncatedTitle: titleCodePoints.slice(0, titleLimit).join(""),
    truncatedDescription: descriptionCodePoints.slice(0, descriptionLimit).join(""),
    escapedTitle: escapeText(title),
    escapedDescription: escapeText(description),
    previewPreset: getPreviewPreset(limits.preset ?? "search-mobile"),
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

function redirectLocation(location: string, base: URL): string {
  try {
    const next = new URL(location, base);
    validatePercentEscapes(next.href);
    if (next.protocol !== "http:" && next.protocol !== "https:") invalid("UNSAFE_URL_SCHEME");
    return redactUrl(next);
  } catch (error) {
    if (error instanceof Error && error.message === "UNSAFE_URL_SCHEME") throw error;
    return invalid("INVALID_REDIRECT_LOCATION");
  }
}

export function inspectRedirectChain(hopsInput: readonly RedirectHop[]): RedirectChainResult {
  if (hopsInput.length === 0) invalid("INVALID_REDIRECT_CHAIN");
  if (hopsInput.length > 50) invalid("TOO_MANY_REDIRECTS");
  const seen = new Set<string>();
  const warnings: string[] = [];
  const hops: RedirectHop[] = [];
  for (const hop of hopsInput) {
    const url = parseHttpUrl(hop.url);
    if (hasUrlCredentials(url)) warnings.push("CREDENTIALS_REDACTED");
    const status = hop.status;
    if (!Number.isInteger(status) || status < 100 || status > 599) invalid("INVALID_REDIRECT_STATUS");
    const safeUrl = redactUrl(url);
    if (seen.has(safeUrl)) {
      warnings.push("REDIRECT_LOOP");
      hops.push({ url: safeUrl, status, location: hop.location === null ? null : redirectLocation(hop.location, url), delayMs: hop.delayMs ?? null });
    } else {
      seen.add(safeUrl);
      hops.push({ url: safeUrl, status, location: hop.location === null ? null : redirectLocation(hop.location, url), delayMs: hop.delayMs ?? null });
    }
  }
  const terminal = hops.at(-1);
  if (terminal === undefined) invalid("INVALID_REDIRECT_CHAIN");
  return {
    hops,
    hopCount: hops.length,
    loopDetected: warnings.includes("REDIRECT_LOOP"),
    terminalUrl: terminal.location ?? terminal.url,
    warnings: [...new Set(warnings)],
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

const LIVE_REDIRECT_PRIVACY_BOUNDARY = "The browser requests the starting URL and redirect targets exposed by the chain. No pasted local hop list or unrelated task data is sent.";

function redirectLiveResult(
  requestedUrl: string,
  hops: readonly RedirectHop[],
  outcome: RedirectLiveOutcome,
  terminalUrl: string,
  warnings: readonly string[],
  failureCode: string | null,
  now: () => string,
): RedirectLiveResult {
  return {
    requestedUrl,
    hops,
    hopCount: hops.length,
    loopDetected: outcome === "loop",
    terminalUrl,
    outcome,
    retrievedAt: now(),
    warnings: [...new Set(warnings)],
    failureCode,
    network: "used",
    privacyBoundary: LIVE_REDIRECT_PRIVACY_BOUNDARY,
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

export async function inspectRedirectChainLive(
  input: string,
  options: {
    readonly fetcher?: RedirectFetcher;
    readonly maxHops?: number;
    readonly timeoutMs?: number;
    readonly signal?: AbortSignal;
    readonly now?: () => string;
  } = {},
): Promise<RedirectLiveResult> {
  const start = parseHttpUrl(input);
  if (hasUrlCredentials(start)) invalid("URL_CREDENTIALS_NOT_ALLOWED");
  const maxHops = options.maxHops ?? 10;
  const timeoutMs = options.timeoutMs ?? 8_000;
  if (!Number.isInteger(maxHops) || maxHops < 1 || maxHops > 50) invalid("INVALID_REDIRECT_HOP_LIMIT");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) invalid("INVALID_REDIRECT_TIMEOUT");
  const fetcher: RedirectFetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  const now = options.now ?? (() => new Date().toISOString());
  const requestedUrl = displayUrl(start);
  const hops: RedirectHop[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let current = start;

  for (let index = 0; index < maxHops; index += 1) {
    if (options.signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const safeCurrent = displayUrl(current);
    if (seen.has(safeCurrent)) {
      warnings.push("REDIRECT_LOOP");
      return redirectLiveResult(requestedUrl, hops, "loop", safeCurrent, warnings, "REDIRECT_LOOP", now);
    }
    seen.add(safeCurrent);

    const controller = new AbortController();
    let timedOut = false;
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    let response: RedirectFetchResponse;
    try {
      response = await fetcher(current.href, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onExternalAbort);
      if (options.signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
      if (timedOut) {
        warnings.push("REQUEST_TIMEOUT");
        return redirectLiveResult(requestedUrl, hops, "timeout", safeCurrent, warnings, "REQUEST_TIMEOUT", now);
      }
      warnings.push("NETWORK_REQUEST_BLOCKED");
      return redirectLiveResult(requestedUrl, hops, "blocked", safeCurrent, warnings, error instanceof TypeError ? "NETWORK_REQUEST_BLOCKED" : "NETWORK_REQUEST_FAILED", now);
    }
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onExternalAbort);

    if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
      warnings.push("OPAQUE_OR_INVALID_RESPONSE");
      return redirectLiveResult(requestedUrl, hops, "blocked", safeCurrent, warnings, "OPAQUE_OR_INVALID_RESPONSE", now);
    }
    const rawLocation = response.headers.get("location");
    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) {
      hops.push({ url: safeCurrent, status: response.status, location: null, delayMs: null });
      return redirectLiveResult(requestedUrl, hops, "complete", safeCurrent, warnings, null, now);
    }
    if (rawLocation === null || rawLocation.trim() === "") {
      hops.push({ url: safeCurrent, status: response.status, location: null, delayMs: null });
      warnings.push("REDIRECT_LOCATION_UNAVAILABLE");
      return redirectLiveResult(requestedUrl, hops, "blocked", safeCurrent, warnings, "REDIRECT_LOCATION_UNAVAILABLE", now);
    }

    let nextUrl: string;
    try {
      nextUrl = redirectLocation(rawLocation, current);
    } catch {
      hops.push({ url: safeCurrent, status: response.status, location: null, delayMs: null });
      warnings.push("INVALID_REDIRECT_LOCATION");
      return redirectLiveResult(requestedUrl, hops, "blocked", safeCurrent, warnings, "INVALID_REDIRECT_LOCATION", now);
    }
    hops.push({ url: safeCurrent, status: response.status, location: nextUrl, delayMs: null });
    if (seen.has(nextUrl)) {
      warnings.push("REDIRECT_LOOP");
      return redirectLiveResult(requestedUrl, hops, "loop", nextUrl, warnings, "REDIRECT_LOOP", now);
    }
    current = parseHttpUrl(nextUrl);
  }

  warnings.push("REDIRECT_HOP_LIMIT");
  return redirectLiveResult(requestedUrl, hops, "hop-limit", displayUrl(current), warnings, "REDIRECT_HOP_LIMIT", now);
}

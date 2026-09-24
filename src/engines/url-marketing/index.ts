export const URL_MARKETING_ENGINE_VERSION = "url-marketing-v1";
const MAX_URL_MARKETING_TEXT = 2 * 1024 * 1024;

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
  readonly engineVersion: string;
}

export interface CanonicalUrlResult {
  readonly pageUrl: string;
  readonly canonicalUrl: string;
  readonly sameOrigin: boolean;
  readonly html: string;
  readonly warnings: readonly string[];
  readonly engineVersion: string;
}

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
  readonly engineVersion: string;
}

export interface OpenGraphResult {
  readonly tags: Readonly<Record<string, string>>;
  readonly title: string | null;
  readonly description: string | null;
  readonly image: string | null;
  readonly url: string | null;
  readonly warnings: readonly string[];
  readonly engineVersion: string;
}

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
  readonly limit: number;
  readonly characters: number;
  readonly codePoints: number;
  readonly remaining: number;
  readonly overBy: number;
  readonly withinLimit: boolean;
  readonly lineBreaks: number;
  readonly engineVersion: string;
}

export interface MetaPreviewResult {
  readonly title: string;
  readonly description: string;
  readonly titleCharacters: number;
  readonly descriptionCharacters: number;
  readonly titleLimit: number;
  readonly descriptionLimit: number;
  readonly titleWithinLimit: boolean;
  readonly descriptionWithinLimit: boolean;
  readonly escapedTitle: string;
  readonly escapedDescription: string;
  readonly engineVersion: string;
}

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

function serializeEntries(entries: readonly UrlEntry[]): string {
  const params = new URLSearchParams();
  for (const entry of entries) params.append(entry.key, entry.value);
  return params.toString();
}

function sortedEntries(entries: readonly UrlEntry[]): readonly UrlEntry[] {
  return entries.toSorted((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
}

export function normalizeUrlDetails(input: string, options: NormalizeUrlOptions = {}): NormalizedUrlDetails {
  const source = parseHttpUrl(input);
  const original = displayUrl(source);
  const url = new URL(source.href);
  const entries = queryEntries(url);
  const dropped = options.dropTracking === true ? [...new Set(entries.filter(({ key }) => isTrackingKey(key)).map(({ key }) => key))] : [];
  const kept = options.dropTracking === true ? entries.filter(({ key }) => !isTrackingKey(key)) : entries;
  url.search = serializeEntries((options.sortQuery ?? true) ? sortedEntries(kept) : kept);
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
  options: { readonly mode?: "exact" | "semantic"; readonly ignoreFragment?: boolean } = {},
): UrlComparison {
  const left = parseHttpUrl(leftInput);
  const right = parseHttpUrl(rightInput);
  const mode = options.mode ?? "semantic";
  if (mode !== "exact" && mode !== "semantic") invalid("INVALID_COMPARISON_MODE");
  const ignoreFragment = options.ignoreFragment ?? mode === "semantic";
  const leftNormalized = normalizeUrlDetails(left.href, { sortQuery: mode === "semantic", removeFragment: ignoreFragment });
  const rightNormalized = normalizeUrlDetails(right.href, { sortQuery: mode === "semantic", removeFragment: ignoreFragment });
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

function parseAttributes(tag: string): Readonly<Record<string, string>> {
  const attributes: Record<string, string> = {};
  const pattern = /([a-z_:][a-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/giu;
  for (const match of tag.matchAll(pattern)) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (key !== undefined) attributes[key.toLowerCase()] = decodeEntities(value);
  }
  return attributes;
}

function metadataValues(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  if (record.tags !== undefined && typeof record.tags === "object" && record.tags !== null) return record.tags as Record<string, unknown>;
  return record;
}

export function parseOpenGraph(value: string | Readonly<Record<string, unknown>>): OpenGraphResult {
  const tags: Record<string, string> = {};
  if (typeof value === "string") {
    assertMarketingText(value);
    if (value.trim() === "") invalid("INVALID_INPUT");
    for (const match of value.matchAll(/<meta\b[^>]*>/giu)) {
      const attributes = parseAttributes(match[0]);
      const key = attributes.property ?? attributes.name;
      if (key !== undefined && (key.toLowerCase().startsWith("og:") || key.toLowerCase().startsWith("twitter:"))) tags[key.toLowerCase()] = redactUrlCredentials(attributes.content ?? "");
    }
  } else {
    for (const [key, raw] of Object.entries(metadataValues(value))) {
      if (typeof raw === "string" && (key.toLowerCase().startsWith("og:") || key.toLowerCase().startsWith("twitter:"))) tags[key.toLowerCase()] = redactUrlCredentials(decodeEntities(raw));
    }
  }
  const warnings: string[] = [];
  const resolve = (key: string): string | null => {
    const candidate = tags[key];
    if (candidate === undefined || candidate.trim() === "") return null;
    try {
      const resolved = new URL(candidate, "https://preview.invalid/");
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
        warnings.push(`UNSAFE_${key.toUpperCase().replaceAll(":", "_")}`);
        return null;
      }
      return redactUrl(resolved);
    } catch {
      warnings.push(`INVALID_${key.toUpperCase().replaceAll(":", "_")}`);
      return null;
    }
  };
  const title = tags["og:title"] ?? tags["twitter:title"] ?? null;
  const description = tags["og:description"] ?? tags["twitter:description"] ?? null;
  const image = resolve("og:image") ?? resolve("twitter:image");
  const url = resolve("og:url") ?? resolve("twitter:url");
  for (const [name, value] of [["title", title], ["description", description], ["image", image], ["url", url]] as const) {
    if (value === null) warnings.push(`MISSING_${name.toUpperCase()}`);
  }
  return { tags, title, description, image, url, warnings: [...new Set(warnings)], engineVersion: URL_MARKETING_ENGINE_VERSION };
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
  return { groups, sitemaps, errors, engineVersion: URL_MARKETING_ENGINE_VERSION };
}

const SOCIAL_LIMITS: Readonly<Record<SocialPlatform, number>> = {
  x: 280,
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  facebook: 63206,
  youtube: 100,
  tiktok: 2200,
  mastodon: 500,
  bluesky: 300,
};

function socialPlatform(value: string): SocialPlatform {
  if (typeof value !== "string") invalid("INVALID_SOCIAL_PLATFORM");
  const normalized = value.trim().toLowerCase().replace(/^\s*x\s*(?:\/\s*)?twitter\s*$/u, "x").replace(/^\s*x\.com\s*$/u, "x");
  if (normalized in SOCIAL_LIMITS) return normalized as SocialPlatform;
  invalid("INVALID_SOCIAL_PLATFORM");
}

export function checkSocialLimit(platformInput: string, text: string, customLimit?: number): SocialLimitResult {
  if (typeof text !== "string") invalid("INVALID_INPUT");
  const platform = socialPlatform(platformInput);
  const limit = customLimit ?? SOCIAL_LIMITS[platform];
  if (!Number.isInteger(limit) || limit < 1) invalid("INVALID_SOCIAL_LIMIT");
  const characters = [...text].length;
  return {
    platform,
    limit,
    characters,
    codePoints: characters,
    remaining: limit - characters,
    overBy: Math.max(0, characters - limit),
    withinLimit: characters <= limit,
    lineBreaks: (text.match(/\r\n|\r|\n/gu) ?? []).length,
    engineVersion: URL_MARKETING_ENGINE_VERSION,
  };
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function previewMeta(titleInput: string, descriptionInput: string, limits: { readonly title?: number; readonly description?: number } = {}): MetaPreviewResult {
  if (typeof titleInput !== "string" || typeof descriptionInput !== "string") invalid("INVALID_INPUT");
  const title = titleInput.trim();
  const description = descriptionInput.trim();
  const titleLimit = limits.title ?? 60;
  const descriptionLimit = limits.description ?? 160;
  if (!Number.isInteger(titleLimit) || titleLimit < 1 || !Number.isInteger(descriptionLimit) || descriptionLimit < 1) invalid("INVALID_META_LIMIT");
  const titleCharacters = [...title].length;
  const descriptionCharacters = [...description].length;
  return {
    title,
    description,
    titleCharacters,
    descriptionCharacters,
    titleLimit,
    descriptionLimit,
    titleWithinLimit: titleCharacters <= titleLimit,
    descriptionWithinLimit: descriptionCharacters <= descriptionLimit,
    escapedTitle: escapeText(title),
    escapedDescription: escapeText(description),
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

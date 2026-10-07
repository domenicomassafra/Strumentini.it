import {
  hasUrlCredentials,
  parseHttpUrl,
  parseUtmUrl,
  redactUrl,
  redactUrlCredentials,
  type ParsedUtmUrl,
} from "../url-marketing";

export const CAMPAIGN_URL_ENGINE_VERSION = "1";

export const TRACKING_PARAMETER_KEYS = new Set([
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

export interface UtmValues {
  source: string;
  medium: string;
  campaign: string;
  id?: string;
  term?: string;
  content?: string;
}

export const UTM_ENCODING_POLICY = "New UTM keys use WHATWG URLSearchParams UTF-8 encoding (spaces become +); existing non-tracking query segments keep their original raw encoding and order.";
export const UTM_DUPLICATE_POLICY = "Builder: one value per UTM key, replacing every prior duplicate. Parser: first duplicate UTM value wins while all entries remain visible. Cleaner: every tracking-key occurrence is removed.";

export interface CampaignBulkRow<T> {
  readonly sourceIndex: number;
  readonly sourceRow: number;
  readonly input: string;
  readonly value?: T;
  readonly error?: string;
}

export interface CampaignBulkResult<T> {
  readonly rows: readonly CampaignBulkRow<T>[];
  readonly count: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly encodingPolicy: string;
  readonly duplicatePolicy: string;
  readonly engineVersion: string;
}

export interface TrackingCleanResult {
  url: string;
  dropped: string[];
}

export const CAMPAIGN_FIELDS = ["client", "channel", "campaign", "market", "date"] as const;
export type CampaignField = (typeof CAMPAIGN_FIELDS)[number];

export interface CampaignNamingPreset {
  fields: readonly CampaignField[];
  separator: "-" | "_" | ".";
  lowercase: boolean;
}

export interface CampaignNamingValues {
  client?: string;
  channel?: string;
  campaign?: string;
  market?: string;
  date?: string;
}

function parseAbsoluteUrl(input: string): URL {
  return parseHttpUrl(input);
}

function decodeRawQueryKey(segment: string): string {
  const rawKey = segment.split("=", 1)[0] ?? "";
  try {
    return decodeURIComponent(rawKey.replaceAll("+", " "));
  } catch {
    return rawKey;
  }
}

function rawQuerySegments(url: URL): readonly string[] {
  if (url.search === "") return [];
  return url.search.slice(1).split("&");
}

function encodedQuerySegment(key: string, value: string): string {
  return new URLSearchParams([[key, value]]).toString();
}

function normalizedUtmSegments(values: UtmValues): readonly string[] {
  const entries: readonly [string, string | undefined][] = [
    ["utm_source", values.source],
    ["utm_medium", values.medium],
    ["utm_campaign", values.campaign],
    ["utm_id", values.id],
    ["utm_term", values.term],
    ["utm_content", values.content],
  ];
  return entries.flatMap(([key, value]) => {
    const normalized = value?.trim() ?? "";
    return normalized === "" ? [] : [encodedQuerySegment(key, normalized)];
  });
}

export function buildUtmUrl(baseUrl: string, values: UtmValues): string {
  const url = parseAbsoluteUrl(baseUrl);
  if (hasUrlCredentials(url)) throw new Error("URL_CREDENTIALS_NOT_ALLOWED");
  if (values.source.trim() === "" || values.medium.trim() === "" || values.campaign.trim() === "") {
    throw new Error("INVALID_UTM");
  }
  const kept = rawQuerySegments(url).filter((segment) => !decodeRawQueryKey(segment).toLowerCase().startsWith("utm_"));
  url.search = [...kept, ...normalizedUtmSegments(values)].join("&");
  return url.href;
}

export function isTrackingKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_PARAMETER_KEYS.has(normalized);
}

export function cleanTrackingParameters(input: string): TrackingCleanResult {
  const url = parseAbsoluteUrl(input);
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const segment of rawQuerySegments(url)) {
    const key = decodeRawQueryKey(segment);
    if (isTrackingKey(key)) {
      if (!dropped.includes(key)) dropped.push(key);
    } else {
      kept.push(segment);
    }
  }
  url.search = kept.join("&");
  return { url: redactUrl(url), dropped };
}

function bulkResult<T>(
  inputs: readonly string[],
  run: (input: string) => T,
): CampaignBulkResult<T> {
  const rows = inputs.map((input, sourceIndex): CampaignBulkRow<T> => {
    try {
      return {
        sourceIndex,
        sourceRow: sourceIndex + 1,
        input: redactUrlCredentials(input),
        value: run(input),
      };
    } catch (error) {
      return {
        sourceIndex,
        sourceRow: sourceIndex + 1,
        input: redactUrlCredentials(input),
        error: error instanceof Error ? error.message : "INVALID_URL",
      };
    }
  });
  return {
    rows,
    count: rows.length,
    successCount: rows.filter((row) => row.value !== undefined).length,
    errorCount: rows.filter((row) => row.error !== undefined).length,
    encodingPolicy: UTM_ENCODING_POLICY,
    duplicatePolicy: UTM_DUPLICATE_POLICY,
    engineVersion: CAMPAIGN_URL_ENGINE_VERSION,
  };
}

export function buildUtmUrlsBulk(inputs: readonly string[], values: UtmValues): CampaignBulkResult<{ readonly url: string }> {
  return bulkResult(inputs, (input) => ({ url: buildUtmUrl(input, values) }));
}

export function parseUtmUrlsBulk(inputs: readonly string[]): CampaignBulkResult<ParsedUtmUrl> {
  return bulkResult(inputs, parseUtmUrl);
}

export function cleanTrackingParametersBulk(inputs: readonly string[]): CampaignBulkResult<TrackingCleanResult> {
  return bulkResult(inputs, cleanTrackingParameters);
}

function normalizeCampaignPart(value: string, lowercase: boolean): string {
  const normalized = value.normalize("NFC").trim().replace(/\s+/gu, "-");
  return lowercase ? normalized.toLocaleLowerCase("en-US") : normalized;
}

export function buildCampaignName(
  preset: CampaignNamingPreset,
  values: CampaignNamingValues,
): string {
  if (preset.fields.length === 0 || new Set(preset.fields).size !== preset.fields.length) {
    throw new Error("INVALID_NAMING_PRESET");
  }
  if (!preset.fields.every((field) => CAMPAIGN_FIELDS.includes(field))) throw new Error("INVALID_NAMING_PRESET");
  const parts = preset.fields.map((field) => normalizeCampaignPart(values[field] ?? "", preset.lowercase));
  if (parts.some((part) => part === "")) throw new Error("MISSING_NAMING_VALUE");
  return parts.join(preset.separator);
}

export function parseCampaignFieldOrder(value: string): CampaignField[] {
  const fields = value.split(",").map((field) => field.trim()) as CampaignField[];
  if (fields.length === 0 || fields.some((field) => !CAMPAIGN_FIELDS.includes(field))) {
    throw new Error("INVALID_NAMING_PRESET");
  }
  if (new Set(fields).size !== fields.length) throw new Error("INVALID_NAMING_PRESET");
  return fields;
}

export {
  canonicalUrlDetails,
  compareUrls,
  extractDomains,
  extractEmailDomains,
  groupDomains,
  normalizeUrl,
  normalizeUrlDetails,
  parseOpenGraph,
  parseRobots,
  parseUtmUrl,
  URL_MARKETING_ENGINE_VERSION,
} from "../url-marketing";

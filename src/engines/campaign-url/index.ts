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
  term?: string;
  content?: string;
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
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("INVALID_URL");
  return url;
}

function setOrDelete(search: URLSearchParams, key: string, value: string | undefined) {
  const normalized = value?.trim() ?? "";
  if (normalized === "") search.delete(key);
  else search.set(key, normalized);
}

export function buildUtmUrl(baseUrl: string, values: UtmValues): string {
  const url = parseAbsoluteUrl(baseUrl);
  if (values.source.trim() === "" || values.medium.trim() === "" || values.campaign.trim() === "") {
    throw new Error("INVALID_UTM");
  }
  setOrDelete(url.searchParams, "utm_source", values.source);
  setOrDelete(url.searchParams, "utm_medium", values.medium);
  setOrDelete(url.searchParams, "utm_campaign", values.campaign);
  setOrDelete(url.searchParams, "utm_term", values.term);
  setOrDelete(url.searchParams, "utm_content", values.content);
  return url.href;
}

export function isTrackingKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_PARAMETER_KEYS.has(normalized);
}

export function cleanTrackingParameters(input: string): TrackingCleanResult {
  const url = parseAbsoluteUrl(input);
  const kept = new URLSearchParams();
  const dropped: string[] = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (isTrackingKey(key)) {
      if (!dropped.includes(key)) dropped.push(key);
    } else {
      kept.append(key, value);
    }
  }
  url.search = kept.toString();
  return { url: url.href, dropped };
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

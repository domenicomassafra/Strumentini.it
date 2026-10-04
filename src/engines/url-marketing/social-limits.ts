/*
 * Published social-platform limits, with their provenance.
 *
 * These numbers are data, not code: platforms change them, and a checker that
 * shows a bare "280" with no date invites a reader to trust a value that
 * nobody in this repository can keep fresh automatically. Each entry therefore
 * carries the platform's own published guidance as its source and the date it
 * was last verified against it. The tool shows that date and lets a reader
 * override the limit, rather than pretending the repository is the authority.
 *
 * Counting method is declared too, because "characters" means different things
 * per platform: `codePoints` is what this tool counts by default, and only X
 * publishes a weighted rule, which is implemented separately.
 */

export type SocialCountingMethod = "codePoints" | "xWeighted";

export interface SocialPlatformRule {
  readonly id: string;
  readonly labelIt: string;
  readonly limit: number;
  /** What the limit applies to, in Italian. */
  readonly scopeIt: string;
  readonly counting: SocialCountingMethod;
  readonly source: string;
  readonly verifiedOn: string;
}

export const SOCIAL_PLATFORM_RULES: readonly SocialPlatformRule[] = [
  {
    id: "x",
    labelIt: "X (ex Twitter)",
    limit: 280,
    scopeIt: "lunghezza del post",
    counting: "xWeighted",
    source: "X Help Center — Counting characters",
    verifiedOn: "2026-09-23",
  },
  {
    id: "linkedin",
    labelIt: "LinkedIn",
    limit: 3000,
    scopeIt: "lunghezza del post",
    counting: "codePoints",
    source: "LinkedIn Help — post character limits",
    verifiedOn: "2026-09-23",
  },
  {
    id: "instagram",
    labelIt: "Instagram",
    limit: 2200,
    scopeIt: "didascalia",
    counting: "codePoints",
    source: "Instagram Help Centre — caption length",
    verifiedOn: "2026-09-23",
  },
  {
    id: "facebook",
    labelIt: "Facebook",
    limit: 63_206,
    scopeIt: "lunghezza del post",
    counting: "codePoints",
    source: "Facebook Help — post length",
    verifiedOn: "2026-09-23",
  },
  {
    id: "youtube",
    labelIt: "YouTube (titolo)",
    limit: 100,
    scopeIt: "titolo del video",
    counting: "codePoints",
    source: "YouTube Help — video title and description limits",
    verifiedOn: "2026-09-23",
  },
  {
    id: "tiktok",
    labelIt: "TikTok",
    limit: 2200,
    scopeIt: "didascalia",
    counting: "codePoints",
    source: "TikTok Support — caption length",
    verifiedOn: "2026-09-23",
  },
  {
    id: "mastodon",
    labelIt: "Mastodon (istanza da 500 caratteri)",
    limit: 500,
    scopeIt: "lunghezza del post, secondo il limite dell'istanza",
    counting: "codePoints",
    source: "Mastodon documentation — status character limit",
    verifiedOn: "2026-09-23",
  },
  {
    id: "bluesky",
    labelIt: "Bluesky",
    limit: 300,
    scopeIt: "lunghezza del post",
    counting: "codePoints",
    source: "Bluesky — post character limit",
    verifiedOn: "2026-09-23",
  },
];

/**
 * The two key ranges X counts double: CJK and Hangul blocks, plus the
 * supplementary ideographic planes, exactly as the published rule lists them.
 */
const X_DOUBLE_WIDTH_RANGES: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x20000, 0x3fffd],
];

/** X counts every detected link as a fixed 23 weighted characters. */
export const X_LINK_WEIGHT = 23;
const LINK_PATTERN = /https?:\/\/[^\s<>"']+/giu;

export function xWeightedLength(text: string): number {
  let weight = 0;
  let cursor = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index ?? 0;
    weight += xWeightedSegment(text.slice(cursor, start));
    weight += X_LINK_WEIGHT;
    cursor = start + match[0].length;
  }
  weight += xWeightedSegment(text.slice(cursor));
  return weight;
}

function xWeightedSegment(segment: string): number {
  let weight = 0;
  for (const character of segment) {
    const codePoint = character.codePointAt(0) ?? 0;
    weight += X_DOUBLE_WIDTH_RANGES.some(([low, high]) => codePoint >= low && codePoint <= high) ? 2 : 1;
  }
  return weight;
}
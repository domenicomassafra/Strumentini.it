import Bowser from "bowser";
import { assertInputSize, type DeveloperWebResult } from "./types";

export interface UserAgentInfo {
  readonly raw: string;
  readonly browser: string;
  readonly version: string | null;
  readonly os: string;
  readonly device: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  readonly engine: string | null;
  readonly mobile: boolean;
  readonly bot: boolean;
  readonly warnings: string[];
}

const WARNING = "L'analisi dello User-Agent è soltanto descrittiva; le capacità vanno determinate verificando direttamente le funzionalità disponibili.";

// Keep the small original classifier as an offline fallback for unknown/partial
// UA strings and for bot hints that Bowser does not classify (curl, wget, etc.).
export function parseLegacyUserAgent(raw: string): UserAgentInfo {
  assertInputSize(raw, 100_000);
  const bot = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|curl|wget|headlesschrome/iu.test(raw);
  const mobile = /Mobile|Android|iPhone|iPod|Windows Phone/iu.test(raw);
  const tablet = /iPad|Tablet|PlayBook|Silk/iu.test(raw) || (/Android/iu.test(raw) && !/Mobile/iu.test(raw));
  let browser = "Sconosciuto";
  let version: string | null = null;
  const patterns: Array<[string, RegExp]> = [
    ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/iu],
    ["Opera", /(?:OPR|Opera)\/([\d.]+)/iu],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/iu],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/iu],
    ["Safari", /Version\/([\d.]+).*Safari/iu],
    ["Internet Explorer", /(?:MSIE\s|rv:)([\d.]+)/iu],
  ];
  for (const [name, pattern] of patterns) {
    const match = pattern.exec(raw);
    if (match !== null) {
      browser = name;
      version = match[1] ?? null;
      break;
    }
  }
  let os = "Sconosciuto";
  if (/Windows NT/iu.test(raw)) os = "Windows";
  else if (/iPhone|iPod|iPad/iu.test(raw)) os = "iOS";
  else if (/Android/iu.test(raw)) os = "Android";
  else if (/Mac OS X|Macintosh/iu.test(raw)) os = "macOS";
  else if (/CrOS/iu.test(raw)) os = "ChromeOS";
  else if (/Linux/iu.test(raw)) os = "Linux";
  const engine = /Gecko\//iu.test(raw) && !/like Gecko/iu.test(raw) ? "Gecko" : /WebKit\//iu.test(raw) ? "WebKit" : /Trident\//iu.test(raw) ? "Trident" : null;
  const device = bot ? "bot" : tablet ? "tablet" : mobile ? "mobile" : /Windows|Macintosh|X11|Linux/iu.test(raw) ? "desktop" : "unknown";
  return { raw, browser, version, os, device, engine, mobile, bot, warnings: [WARNING] };
}

export function parseUserAgent(raw: string): UserAgentInfo {
  const fallback = parseLegacyUserAgent(raw); // Validate the 100k-character bound before parsing.
  const { browser, os, platform, engine } = Bowser.parse(raw);
  const bot = fallback.bot || platform.type === "bot";
  const platformType = platform.type;
  const device = bot ? "bot"
    : platformType === "desktop" || platformType === "mobile" || platformType === "tablet" ? platformType
      : fallback.device;
  const browserName = browser.name === "Microsoft Edge" ? "Edge" : browser.name?.trim();
  const osName = os.name === "Chrome OS" ? "ChromeOS" : os.name?.trim();
  return {
    ...fallback,
    browser: browserName || fallback.browser,
    version: browser.version && /^[0-9]+(?:\.[0-9]+)*$/u.test(browser.version) ? browser.version : fallback.version,
    os: osName || fallback.os,
    device,
    // Bowser reports EdgeHTML for EdgiOS; every iOS browser using this UA
    // signature is running WebKit, so retain the original correct hint.
    engine: osName === "iOS" && /AppleWebKit\//iu.test(raw) ? "WebKit" : engine.name?.trim() || fallback.engine,
    mobile: fallback.mobile || platformType === "mobile",
    bot,
  };
}

export function userAgentOperation(raw: string): DeveloperWebResult {
  return { valid: true, ...parseUserAgent(raw) } as DeveloperWebResult;
}

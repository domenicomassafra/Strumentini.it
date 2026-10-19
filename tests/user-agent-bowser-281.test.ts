import { describe, expect, it } from "vitest";
import { parseLegacyUserAgent, parseUserAgent } from "../src/engines/developer-web/user-agent";
import { runDeveloperWebTool } from "../src/engines/developer-web";
import { normalizeBrowserDeviceInfo } from "../src/tools/connection-device-info/module";

// Cross-browser UA signatures with independently known browser/OS/engine hints.
// UA is spoofable: expected values describe the string, never the real device.
const corpus = [
  { id: "iphone-safari", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", expected: { browser: "Safari", version: "17.0", os: "iOS", device: "mobile", engine: "WebKit" } },
  { id: "ipad-safari", ua: "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1", expected: { browser: "Safari", version: "16.6", os: "iOS", device: "tablet", engine: "WebKit" } },
  { id: "mac-safari", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15", expected: { browser: "Safari", version: "17.2", os: "macOS", device: "desktop", engine: "WebKit" } },
  { id: "windows-edge", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0", expected: { browser: "Edge", version: "126.0.0.0", os: "Windows", device: "desktop", engine: "Blink" } },
  { id: "edge-ios", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/115.1901.203 Mobile/15E148 Safari/605.1.15", expected: { browser: "Edge", version: "115.1901.203", os: "iOS", device: "mobile", engine: "WebKit" } },
  { id: "firefox-ios", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/116.0 Mobile/15E148 Safari/605.1.15", expected: { browser: "Firefox", version: "116.0", os: "iOS", device: "mobile", engine: "WebKit" } },
  { id: "chrome-ios", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1", expected: { browser: "Chrome", version: "126.0.0.0", os: "iOS", device: "mobile", engine: "WebKit" } },
  { id: "android-chrome", ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36", expected: { browser: "Chrome", version: "126.0.0.0", os: "Android", device: "mobile", engine: "Blink" } },
  { id: "android-tablet", ua: "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", expected: { browser: "Chrome", version: "120.0.0.0", os: "Android", device: "tablet", engine: "Blink" } },
  { id: "samsung-browser", ua: "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36", expected: { browser: "Samsung Internet for Android", version: "23.0", os: "Android", device: "mobile", engine: "Blink" } },
  { id: "windows-opera", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0", expected: { browser: "Opera", version: "111.0.0.0", os: "Windows", device: "desktop", engine: "Blink" } },
  { id: "windows-ie", ua: "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)", expected: { browser: "Internet Explorer", version: "10.0", os: "Windows", device: "desktop", engine: "Trident" } },
  { id: "linux-firefox", ua: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0", expected: { browser: "Firefox", version: "126.0", os: "Linux", device: "desktop", engine: "Gecko" } },
  { id: "chrome-os", ua: "Mozilla/5.0 (X11; CrOS x86_64 15572.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36", expected: { browser: "Chrome", version: "119.0.0.0", os: "ChromeOS", device: "desktop", engine: "Blink" } },
  { id: "windows-vivaldi", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Vivaldi/6.7.3329.17", expected: { browser: "Vivaldi", version: "6.7.3329.17", os: "Windows", device: "desktop", engine: "Blink" } },
  { id: "googlebot", ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", expected: { browser: "Googlebot", version: "2.1", os: "Sconosciuto", device: "bot", engine: null } },
  { id: "bingbot", ua: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", expected: { browser: "BingCrawler", version: "2.0", os: "Sconosciuto", device: "bot", engine: null } },
  { id: "headless-chrome", ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36", expected: { browser: "Chrome", version: "126.0.0.0", os: "Linux", device: "bot", engine: "Blink" } },
  { id: "curl", ua: "curl/8.5.0", expected: { browser: "Sconosciuto", version: null, os: "Sconosciuto", device: "bot", engine: null } },
  { id: "unknown", ua: "totally fake user agent", expected: { browser: "Sconosciuto", version: null, os: "Sconosciuto", device: "unknown", engine: null } },
  // UA spoof: indistinguishable from a desktop Mac from the User-Agent alone.
  { id: "spoofed-ipados-desktop", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15", expected: { browser: "Safari", version: "16.0", os: "macOS", device: "desktop", engine: "WebKit" } },
] as const;

describe("Bowser 2.14.1 UA differential #281", () => {
  it("parses user agents descriptively without capability claims", () => {
    const result = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1");
    expect(result).toMatchObject({ browser: "Safari", os: "iOS", device: "mobile", mobile: true });
    expect(result.warnings[0]).toMatch(/funzionalità disponibili/u);
  });

  it("preserves or improves independently expected hints across desktop/mobile/tablet/bot/spoofs", () => {
    let legacyMatches = 0;
    let donorMatches = 0;
    for (const { id, ua, expected } of corpus) {
      const legacy = parseLegacyUserAgent(ua);
      const adopted = parseUserAgent(ua);
      for (const field of ["browser", "version", "os", "device", "engine"] as const) {
        if (legacy[field] === expected[field]) legacyMatches += 1;
        if (adopted[field] === expected[field]) donorMatches += 1;
      }
      expect(adopted, id).toMatchObject(expected);
      expect(adopted.raw).toBe(ua);
      expect(adopted.bot).toBe(legacy.bot);
      expect(adopted.warnings).toEqual(legacy.warnings);
    }
    expect(donorMatches).toBeGreaterThan(legacyMatches);
    console.info(`STR-281 differential: ${corpus.length} UA / ${corpus.length * 5} field hints, legacy ${legacyMatches}, Bowser+fallback ${donorMatches}`);
  });

  it("rejects oversized input before donor parsing and preserves cancellation", async () => {
    expect(() => parseUserAgent("A".repeat(100_001))).toThrow(/INPUT_TOO_LARGE/u);
    await expect(runDeveloperWebTool("user-agent-parser", { userAgent: "A".repeat(100_001) })).rejects.toThrow(/INPUT_TOO_LARGE/u);
    const abort = new AbortController();
    abort.abort();
    await expect(runDeveloperWebTool("user-agent-parser", { userAgent: "Chrome/100" }, abort.signal)).rejects.toThrow(/cancelled/u);
    const result = await runDeveloperWebTool("user-agent-parser", { userAgent: corpus[0]!.ua });
    expect(result).toMatchObject({ valid: true, browser: "Safari", device: "mobile" });
  });

  it("keeps the installed connection/device consumer on the same parser", () => {
    const input = {
      userAgent: corpus[9]!.ua, locale: "it-IT", screenWidth: 390, screenHeight: 844,
      viewportWidth: 390, viewportHeight: 800, devicePixelRatio: 3,
      orientationType: "portrait-primary", orientationAngle: 0,
      maxTouchPoints: 5, touchEventAvailable: true, coarsePointer: true,
    };
    expect(normalizeBrowserDeviceInfo(input)).toMatchObject({ browser: "Samsung Internet for Android", os: "Android", deviceHint: "mobile", breakpoint: "piccolo" });
  });
});

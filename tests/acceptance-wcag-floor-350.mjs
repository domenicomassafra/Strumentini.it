/**
 * #350 bounded WCAG 2.2 AA smoke in installed Google Chrome.
 * Run: node tests/acceptance-wcag-floor-350.mjs
 * Reuse a developer-owned local server: WCAG350_ORIGIN=http://127.0.0.1:4321 node ...
 * Run diagnostics before promoting a new assertion: WCAG350_DIAG=1 node ...
 * This is real browser keyboard/CSS/DOM evidence, NOT VoiceOver/TalkBack,
 * physical touch testing, automated axe conformance, or full WCAG certification.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 19550;
const origin = process.env.WCAG350_ORIGIN ?? `http://127.0.0.1:${port}`;
const diagnostic = process.env.WCAG350_DIAG === "1";
const serverLogs = [];
const server = process.env.WCAG350_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(), detached: true, stdio: ["ignore", "pipe", "pipe"],
});
server?.stdout.on("data", (chunk) => serverLogs.push(String(chunk).slice(-300)));
server?.stderr.on("data", (chunk) => serverLogs.push(String(chunk).slice(-300)));
const problems = [];
let checks = 0;
let browser;

function check(value, why, details) {
  checks++;
  if (value) return;
  const failure = `${why}${details ? ` — ${JSON.stringify(details)}` : ""}`;
  problems.push(failure);
  if (!diagnostic) throw new Error(failure);
}

async function ready() {
  for (let i = 0; i < 120; i++) {
    if (server && server.exitCode !== null) throw new Error(`Astro exited: ${serverLogs.join(" ")}`);
    try { if ((await fetch(`${origin}/`)).ok) return; } catch { /* local startup */ }
    await sleep(250);
  }
  throw new Error(`Local Astro unreachable: ${serverLogs.join(" ")}`);
}

// sRGB color channels and opacity are deliberately required to be opaque here:
// a composited translucent background needs a separate surface oracle.
function contrast(fg, bg) {
  const color = (value) => {
    const match = /^rgba?\((\d+),?\s+(\d+),?\s+(\d+)(?:\s*\/\s*([\d.]+))?\)$/.exec(value);
    assert(match, `unsupported computed opaque color ${value}`);
    assert.equal(match[4] ?? "1", "1", `translucent color ${value}`);
    return [Number(match[1]), Number(match[2]), Number(match[3])].map((n) => {
      const s = n / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }).reduce((a, n, i) => a + n * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const a = color(fg);
  const b = color(bg);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

async function measuredContrast(page, textSelector, surfaceSelector) {
  const colors = await page.evaluate(([textSelector, surfaceSelector]) => {
    const text = document.querySelector(textSelector);
    const surface = document.querySelector(surfaceSelector);
    if (!text || !surface) return null;
    return { fg: getComputedStyle(text).color, bg: getComputedStyle(surface).backgroundColor };
  }, [textSelector, surfaceSelector]);
  assert(colors, `missing text or background: ${textSelector}, ${surfaceSelector}`);
  return contrast(colors.fg, colors.bg);
}

async function targetSize(page, selector, label) {
  const info = await page.locator(selector).first().evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height, visible: Boolean(el.getClientRects().length) };
  });
  check(info.visible && info.width >= 44 && info.height >= 44, `44px target ${label}`, info);
}

async function noOverflow(page, label) {
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  check(sizes.document <= sizes.viewport + 1, `reflow ${label}`, sizes);
}

async function keyboardTarget(page, selector, label, limit = 140) {
  const target = page.locator(selector).first();
  let reached = false;
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    reached = await target.evaluate((element) => document.activeElement === element);
    if (reached) break;
  }
  check(reached, `keyboard Tab reaches ${label}`);
  if (!reached) return;
  const visibleFocus = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return { matches: element.matches(":focus-visible"), outline: style.outlineStyle, width: parseFloat(style.outlineWidth), shadow: style.boxShadow };
  });
  check(visibleFocus.matches && ((visibleFocus.width >= 2 && visibleFocus.outline !== "none") || visibleFocus.shadow !== "none"), `visible keyboard focus ${label}`, visibleFocus);
}

async function pageSmoke(page, path, width, label) {
  await page.setViewportSize({ width, height: 850 });
  const response = await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
  check(response?.status() === 200, `HTTP 200 ${label}`, response?.status());
  check(await page.locator("html[lang=it]").count() === 1, `Italian lang ${label}`);
  check(await page.locator("main#main-content").count() === 1, `one main landmark ${label}`);
  check(await page.locator("h1").count() === 1, `one H1 ${label}`);
  await noOverflow(page, `${label} ${width}px`);
}

async function zoomTest(page, path, label) {
  // A desktop Chrome zoom of 200%/400% on a 1280 CSS-px viewport reduces
  // layout space to 640/320 CSS px, respectively. Test that *reflow* using
  // those layout widths; style.zoom on <html> leaves desktop media queries
  // active and produces misleading false positives. Native browser zoom itself
  // is not controlled by Playwright and remains a manual verification gate.
  for (const [factor, width] of [[2, 640], [4, 320]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
    await noOverflow(page, `${label} equivalent desktop reflow ${factor * 100}% of 1280px`);
    const heading = await page.locator("main h1").evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    check(heading.scrollWidth <= heading.clientWidth + 1, `H1 not clipped ${label} ${factor * 100}% reflow`, heading);
  }
}

try {
  await ready();
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport: { width: 320, height: 850 }, reducedMotion: "reduce", locale: "it-IT" });
  // Fail-safe staging: never call live auth APIs or send requests to remote providers.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Fixture locale: API non configurata" }) });
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(90_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const [path, label] of [["/", "home"], ["/accedi/", "login"], ["/preferiti/", "area"], ["/tools/rate-converter/", "tool"]]) {
    for (const width of [320, 390]) await pageSmoke(page, path, width, label);
  }

  await pageSmoke(page, "/", 320, "home");
  await page.keyboard.press("Tab");
  check(await page.locator("a.shell-skip-link").evaluate((el) => document.activeElement === el), "skip link first Tab");
  await page.keyboard.press("Enter");
  check(new URL(page.url()).hash === "#main-content", "keyboard skip link to main");
  await keyboardTarget(page, "[data-search-open]", "home search");
  await keyboardTarget(page, "[data-home-file-picker]", "home file input");
  await targetSize(page, "[data-search-open]", "home search");
  await targetSize(page, "[data-home-file-picker]", "home file input");
  await targetSize(page, "[data-mobile-toggle]", "header mobile menu");
  const hintLight = await measuredContrast(page, ".home-hero-hint", "body");
  check(hintLight >= 4.5, "home supporting hint contrast AA in light theme", { ratio: hintLight });
  await page.evaluate(() => { localStorage.setItem("strumentini:theme:v1", "dark"); });
  await page.reload({ waitUntil: "domcontentloaded" });
  check(await page.locator("html[data-theme=dark]").count() === 1, "home dark theme persisted and applied");
  const hintDark = await measuredContrast(page, ".home-hero-hint", "body");
  check(hintDark >= 4.5, "home supporting hint contrast AA in dark theme", { ratio: hintDark });
  await page.evaluate(() => { localStorage.removeItem("strumentini:theme:v1"); });
  await page.reload({ waitUntil: "domcontentloaded" });
  const pickerStatus = page.locator("[data-home-file-status]");
  check(await pickerStatus.getAttribute("role") === "status" && await pickerStatus.getAttribute("aria-live") === "polite", "file input status polite live announcement");
  await page.locator("[data-home-file-picker]").setInputFiles({ name: "vuoto.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) });
  await page.waitForFunction(() => (document.querySelector("[data-home-file-status]")?.textContent ?? "").includes("vuoto"));
  check((await pickerStatus.textContent()).includes("vuoto"), "invalid file announces failure in live region");

  await pageSmoke(page, "/accedi/", 320, "login");
  await keyboardTarget(page, "#tab-login", "login tab");
  await page.keyboard.press("End");
  check(await page.locator("#tab-register").getAttribute("aria-selected") === "true", "tablist End selects register");
  await page.keyboard.press("Home");
  check(await page.locator("#tab-login").getAttribute("aria-selected") === "true", "tablist Home selects login");
  await targetSize(page, "#tab-login", "login tab");
  await targetSize(page, "[data-access-submit]", "login submit");
  await targetSize(page, "[data-password-reveal]", "password reveal");
  const loginHelpRatio = await measuredContrast(page, ".ac-access .ac-support", ".ac-card");
  check(loginHelpRatio >= 4.5, "login support copy contrast AA", { ratio: loginHelpRatio });
  await page.evaluate(() => { localStorage.setItem("strumentini:theme:v1", "dark"); });
  await page.reload({ waitUntil: "domcontentloaded" });
  check(await page.locator("html[data-theme=dark]").count() === 1, "login dark theme persisted and applied");
  const loginHelpDarkRatio = await measuredContrast(page, ".ac-access .ac-support", ".ac-card");
  check(loginHelpDarkRatio >= 4.5, "login support copy contrast AA dark", { ratio: loginHelpDarkRatio });
  await page.evaluate(() => { localStorage.removeItem("strumentini:theme:v1"); });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#panel-login [data-access-submit]").click();
  check(await page.locator("#login-email-error").isVisible(), "empty login visibly flags required email");
  check(await page.locator("#login-email").evaluate((el) => document.activeElement === el), "invalid login focuses first field");
  const fieldDescribed = await page.locator("#login-email").getAttribute("aria-describedby");
  check((fieldDescribed ?? "").includes("login-email-error"), "invalid email references error description");

  await pageSmoke(page, "/preferiti/", 320, "area");
  await keyboardTarget(page, ".area-nav a", "area navigation");
  await targetSize(page, ".area-nav a", "area navigation");
  check(await page.getByRole("navigation", { name: "La mia area" }).count() === 1, "area has named nav landmark");

  await pageSmoke(page, "/tools/rate-converter/", 320, "tool");
  await page.locator("[data-tool-run-control]").waitFor();
  await keyboardTarget(page, "[data-tool-run-control]", "tool submit");
  await targetSize(page, "[data-tool-run-control]", "tool submit");
  await page.keyboard.press("Enter");
  const error = page.locator("[data-tool-error]");
  await error.waitFor();
  check(await error.evaluate((el) => document.activeElement === el), "tool failure focuses inline error");
  check((await page.locator('[data-result-announcement="assertive"]').textContent())?.includes("Operazione non riuscita"), "tool error concise assertive live region");
  await page.getByLabel("Importo della tariffa").fill("50");
  await page.locator("[data-tool-run-control]").click();
  await page.locator('.result-panel[data-state="success"]').waitFor();
  check((await page.getByRole("status").allTextContents()).some((text) => text.includes("Operazione completata")), "tool success polite live status");
  check(await page.locator(".result-panel").getAttribute("aria-live") === null, "full result panel excluded from live region");

  const motion = await page.locator("[data-tool-run-control]").evaluate((el) => ({
    media: matchMedia("(prefers-reduced-motion: reduce)").matches,
    duration: getComputedStyle(el).transitionDuration,
  }));
  check(motion.media && motion.duration.split(",").every((value) => parseFloat(value) <= 0.001), "reduced-motion removes UI transitions", motion);

  for (const [path, label] of [["/", "home"], ["/accedi/", "login"], ["/preferiti/", "area"], ["/tools/rate-converter/", "tool"]]) await zoomTest(page, path, label);
  check(pageErrors.length === 0, "no browser uncaught exceptions", pageErrors);

  const cssDigest = createHash("sha256").update(await readFile("src/styles/global.css")).digest("hex").slice(0, 16);
  const source = { cssDigest, chrome: browser.version(), routes: ["/", "/accedi/", "/preferiti/", "/tools/rate-converter/"], widths: [320, 390], zoomEquivalentReflow: [200, 400], nativeBrowserZoom: "NOT_RUN", checks, issues: problems };
  console.log(JSON.stringify(source, null, 2));
  if (!diagnostic) assert.equal(problems.length, 0);
  console.log(`#350 Chrome browser acceptance ${problems.length ? "DIAGNOSTIC FAIL" : "PASS"} (${checks} assertions), keyboard/focus, effective contrast, target sizes, Italian landmarks, result/error live regions, 320/390 px, 200/400% equivalent layout reflow, reduced motion. Actual browser zoom/physical/mobile/VoiceOver/TalkBack/axe NOT_RUN.`);
  await context.close();
} finally {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* already exited */ } }
}

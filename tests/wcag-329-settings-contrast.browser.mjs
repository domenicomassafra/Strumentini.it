/**
 * #329 settings navigation: computed normal-text contrast and focus at 320/390.
 * Requires one locally running Astro server (e.g. astro dev --port 19570).
 * ACCOUNT329_ORIGIN=http://127.0.0.1:19570 node tests/wcag-329-settings-contrast.browser.mjs
 * Session/API responses are isolated 503 fixtures; no real account or egress.
 */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const origin = process.env.ACCOUNT329_ORIGIN ?? "http://127.0.0.1:19570";
const channels = [];
let assertions = 0;
let sessionFailures = 0;
let authMutations = 0;
let outboundAttempts = 0;
const browserErrors = [];

function check(condition, reason, details) {
  assertions++;
  assert(condition, `${reason}${details === undefined ? "" : `: ${JSON.stringify(details)}`}`);
}

function luminance(color) {
  const match = /^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:\s*\/\s*([\d.]+))?\)$/.exec(color);
  assert(match, `CSS color not supported by the contrast oracle: ${color}`);
  assert(!match[4] || Number(match[4]) === 1, `Alpha requires compositing: ${color}`);
  return match.slice(1, 4).map(Number).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function ratio(foreground, background) {
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

async function checkLabel(page, selector, label, width, theme) {
  // Navigation backgrounds transition from transparent after keyboard selection.
  // Read the settled text/background pair instead of a mid-transition alpha.
  await page.waitForFunction((target) => {
    const element = document.querySelector(target);
    if (!element) return false;
    const background = getComputedStyle(element).backgroundColor;
    return background !== "rgba(0, 0, 0, 0)" && !background.startsWith("color(");
  }, selector);
  const style = await page.locator(selector).evaluate((element) => {
    const css = getComputedStyle(element);
    return {
      text: element.textContent.trim(),
      foreground: css.color,
      background: css.backgroundColor,
      fontSize: css.fontSize,
      fontWeight: css.fontWeight,
    };
  });
  const measured = ratio(style.foreground, style.background);
  channels.push({ label, width, theme, ratio: +measured.toFixed(3), ...style });
  // Navigation is ordinary 14px semibold text, not WCAG large text.
  check(measured >= 4.5, `AA navigation text ${label} ${width}px ${theme}`, { measured: +measured.toFixed(3), ...style });
}

async function testMatrix(browser, width, theme) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: "it-IT", reducedMotion: "reduce" });
  if (theme === "dark") {
    // Real app theme boot is exercised; no CSS variable injection.
    await context.addInitScript(() => localStorage.setItem("strumentini:theme:v1", "dark"));
  }
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { outboundAttempts++; return route.abort(); }
    if (url.pathname === "/api/auth/session") {
      sessionFailures++;
      return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Servizio non disponibile"}' });
    }
    if (url.pathname.startsWith("/api/auth/")) {
      if (route.request().method() !== "GET") authMutations++;
      return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Servizio non disponibile"}' });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => browserErrors.push(error.message));
  try {
    const response = await page.goto(`${origin}/impostazioni/`, { waitUntil: "domcontentloaded" });
    check(response?.status() === 200, `real settings HTTP 200 ${width}px ${theme}`);
    await page.locator("[data-session-signedout]:visible").first().waitFor();
    check(await page.locator("[data-session-signedin]:visible").count() === 0, "503 must not create a user session");
    check(await page.locator("html").getAttribute("data-theme") === theme, `actual theme boot ${theme}`);
    const documentSize = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    check(documentSize.scroll <= documentSize.viewport + 1, `no horizontal clipping ${width}px ${theme}`, documentSize);

    const tabs = page.locator("[data-settings-nav] [role=tab]");
    check(await tabs.count() === 4, "four account settings tabs remain available under 503");
    await checkLabel(page, '#tab-profilo[aria-selected="true"]', "selected profile tab", width, theme);
    // Browser keyboard moves the roving tabindex and visual focus through all settings panels.
    await page.keyboard.press("Tab");
    let reached = false;
    for (let i = 0; i < 60; i++) {
      if (await page.locator("#tab-profilo").evaluate((el) => el === document.activeElement)) { reached = true; break; }
      await page.keyboard.press("Tab");
    }
    check(reached, `keyboard reaches settings nav ${width}px ${theme}`);
    for (const name of ["preferenze", "tema", "privacy", "profilo"]) {
      await page.keyboard.press("ArrowRight");
      const tab = page.locator(`#tab-${name}`);
      const focused = await tab.evaluate((element) => {
        const css = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return {
          active: document.activeElement === element,
          visible: element.matches(":focus-visible"),
          outline: css.outlineStyle,
          outlineWidth: parseFloat(css.outlineWidth),
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
        };
      });
      check(focused.active && focused.visible && focused.outline !== "none" && focused.outlineWidth >= 2,
        `focused ${name} has visible keyboard ring`, focused);
      check(focused.left < focused.viewportWidth && focused.right > 0 && focused.top < focused.viewportHeight && focused.bottom > 0,
        `focused ${name} stays in viewport`, focused);
      check(await tab.getAttribute("aria-selected") === "true" && await page.locator(`#panel-${name}`).isVisible(),
        `${name} tab reveals its section under 503`);
      await checkLabel(page, `#tab-${name}[aria-selected="true"]`, `selected ${name} tab`, width, theme);
    }
    // Hover is a distinct state with the same foreground and tinted background.
    await page.locator("#tab-preferenze").hover();
    await checkLabel(page, "#tab-preferenze:hover", "hovered preferences tab", width, theme);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
    await testMatrix(browser, width, theme);
  }
  // The settings page and the global account chip each probe the session.
  check(sessionFailures === 8, "both session probes are denied HTTP 503 in every variant", { sessionFailures });
  check(authMutations === 0, "no hidden authentication writes", { authMutations });
  check(outboundAttempts === 0, "no network egress", { outboundAttempts });
  check(browserErrors.length === 0, "no uncaught browser errors", browserErrors);
  console.log(JSON.stringify({ ticket: 329, chrome: browser.version(), assertions, channels, sessionFailures,
    nativeZoom: "NOT_RUN", screenreaders: "NOT_RUN", physicalDevices: "NOT_RUN" }));
  console.log(`PASS wcag-329 ${assertions} checks, actual /impostazioni/ at 320/390 in light/dark, with denied 503 session.`);
} finally {
  await browser.close();
}

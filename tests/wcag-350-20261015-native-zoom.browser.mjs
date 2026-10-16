/** #350: true Chromium tab zoom on real compiled routes, not CSS/viewport emulation.
 * Run at both native desktop widths: ZOOM350_DESKTOP_WIDTH=1280|1560 node ...
 * All account APIs are fixtures; no remote calls, account writes, release or Gold.
 */
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const origin = process.env.ZOOM350_ORIGIN ?? "http://127.0.0.1:19851";
assert.equal(new URL(origin).hostname, "127.0.0.1", "Only local compiled pages can be tested");
const desktopWidth = Number(process.env.ZOOM350_DESKTOP_WIDTH ?? 1280);
assert([1280, 1560].includes(desktopWidth), "Native desktop width must be 1280 or 1560");
const routes = ["/", "/accedi/", "/preferiti/", "/tools/rate-converter/"];
const dir = await mkdtemp(join(tmpdir(), "strum350-native-zoom-"));
const results = [], pageErrors = [], unexpected = [], abortedThirdParty = [];
let context, control, tabId;

try {
  await writeFile(join(dir, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "Local AA native zoom", version: "1.0",
    host_permissions: [`${origin}/*`], background: { service_worker: "worker.js" } }));
  await writeFile(join(dir, "worker.js"), "chrome.runtime.onInstalled.addListener(() => {});");
  await writeFile(join(dir, "control.html"), "<!doctype html><title>Native tab zoom probe</title>");
  context = await chromium.launchPersistentContext("", {
    channel: "chromium", headless: true, viewport: null, reducedMotion: "reduce",
    args: ["--screen-info={1920x1200}", `--window-size=${desktopWidth},1000`,
      `--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  control = await context.newPage();
  await control.goto(`chrome-extension://${new URL(worker.url()).host}/control.html`);
  await context.route("**/*", (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { abortedThirdParty.push(url.origin); return route.abort(); }
    if (url.pathname === "/api/auth/session") return route.fulfill({ json: { user: null } });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, json: { error: "Local test only" } });
    if (!["GET", "HEAD"].includes(request.method())) {
      unexpected.push(`${request.method()} ${url.pathname}`); return route.abort();
    }
    return route.continue();
  });
  const page = context.pages()[0];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  assert.equal((await page.goto(`${origin}/`))?.status(), 200);
  tabId = await control.evaluate(async (url) => (await chrome.tabs.query({ url: `${url}/*` }))[0].id, origin);
  const baseline = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
  assert.equal(baseline.width, desktopWidth, "Browser OS window width, not viewport emulation");
  for (const theme of ["light", "dark"]) for (const factor of [4, 2, 1]) {
    await control.evaluate(async ({ id, factor, scope }) => {
      await chrome.tabs.setZoomSettings(id, { mode: "automatic", scope });
      await chrome.tabs.setZoom(id, factor);
    }, { id: tabId, factor, scope: process.env.ZOOM350_FAULT === "navigation-reset" ? "per-tab" : "per-origin" });
    for (const route of routes) {
      await page.evaluate((value) => localStorage.setItem("strumentini:theme:v1", value), theme);
      assert.equal((await page.goto(origin + route, { waitUntil: "domcontentloaded" }))?.status(), 200);
      const zoom = await control.evaluate(async (id) => ({ value: await chrome.tabs.getZoom(id),
        settings: await chrome.tabs.getZoomSettings(id) }), tabId);
      assert(Math.abs(zoom.value - factor) < 0.0001, `Native zoom survived navigation ${JSON.stringify({route, theme, factor, zoom})}`);
      await page.waitForFunction(({ width, dpr, factor }) =>
        Math.abs(innerWidth - width / factor) <= 1 && Math.abs(devicePixelRatio - dpr * factor) <= 0.01,
      { ...baseline, factor });
      await page.locator("main#main-content").waitFor();
      const audit = await page.evaluate(() => ({
        width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
        dpr: devicePixelRatio, visualScale: visualViewport.scale,
        theme: document.documentElement.dataset.theme,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        h1: document.querySelector("main h1")?.textContent?.trim(),
      }));
      assert.equal(audit.theme, theme);
      assert.equal(audit.reducedMotion, true);
      assert.equal(audit.visualScale, 1, "No pinch or page-scale trick");
      assert(audit.documentWidth <= audit.width + 1, `Reflow overflow ${JSON.stringify({route,theme,factor,audit})}`);
      assert(audit.h1, `Main heading absent at ${route}`);
      await page.keyboard.press("Tab");
      const skip = await page.evaluate(() => ({
        href: document.activeElement?.getAttribute("href"),
        focusVisible: document.activeElement?.matches(":focus-visible"),
      }));
      assert.equal(skip.href, "#main-content", `Keyboard skip link at ${route}`);
      assert.equal(skip.focusVisible, true);
      if (audit.width < 1060) {
        const menu = page.locator(".site-menu-button:visible");
        const rect = await menu.boundingBox();
        assert(rect && rect.width >= 44 && rect.height >= 44, `44px mobile navigation target ${route}`);
        await menu.focus();
        await page.keyboard.press("Enter");
        assert.equal(await menu.getAttribute("aria-expanded"), "true");
        await page.keyboard.press("Escape");
        assert.equal(await menu.getAttribute("aria-expanded"), "false");
        assert(await menu.evaluate((el) => document.activeElement === el && el.matches(":focus-visible")));
      }
      results.push({ route, theme, factor, width: audit.width, dpr: audit.dpr, nativeZoom: zoom.value });
    }
  }
  assert.equal(results.length, 24);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(unexpected, []);
  console.log("#350 TRUE_NATIVE_ZOOM_PASS", JSON.stringify({ browser: context.browser().version(), desktopWidth,
    results, abortedThirdParty: [...new Set(abortedThirdParty)], physicalMobile: "NOT_RUN", manualScreenreader: "NOT_RUN" }));
} finally {
  try {
    if (control && tabId !== undefined) await control.evaluate(async (id) => chrome.tabs.setZoom(id, 1), tabId);
  } finally {
    await context?.close();
    await rm(dir, { recursive: true, force: true });
  }
}

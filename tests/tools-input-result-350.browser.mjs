/**
 * #350 browser audit: catalog inputs and runnable results, real compiled Chrome.
 *
 * Scans every catalog input, and additionally tests the keyboard-produced result
 * when a form's run control is available. Records unexercised cases explicitly;
 * Axe does not certify scenarios it never reached. Reflow here uses CSS widths,
 * while tests/wcag-350-20261015-native-zoom.browser.mjs covers real tab zoom.
 *
 * Scope owned by #350: automated Axe, keyboard and zoom/reflow only. VoiceOver,
 * TalkBack, physical iOS/Android and Safari are explicitly NOT gates here.
 *
 * Run after `npm run build` (or `./node_modules/.bin/astro build`):
 *   node tests/tools-input-result-350.browser.mjs
 * Reuse an existing local static server:
 *   A11Y350_ORIGIN=http://127.0.0.1:8080 node tests/tools-input-result-350.browser.mjs
 * Fast subset while iterating:
 *   A11Y350_FILTER=csv,sort node tests/tools-input-result-350.browser.mjs
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.A11Y350_PORT ?? 19860);
const origin = process.env.A11Y350_ORIGIN ?? `http://127.0.0.1:${port}`;
assert.equal(new URL(origin).hostname, "127.0.0.1", "Only a local compiled site can be audited");
const axePath = resolve(root, "node_modules/axe-core/axe.min.js");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEME_KEY = "strumentini:theme:v1";
const filter = (process.env.A11Y350_FILTER ?? "").split(",").map((v) => v.trim()).filter(Boolean);

// The catalog is generated; read routes without importing TypeScript.
const catalogSource = await readFile(resolve(root, "src/generated/catalog.ts"), "utf8");
const allRoutes = [...catalogSource.matchAll(/"route":\s*"([^"]+)"/g)].map((m) => `${m[1]}/`);
const routes = filter.length === 0 ? allRoutes : allRoutes.filter((r) => filter.some((f) => r.includes(f)));
assert(allRoutes.length >= 250, `Expected the full catalog, found ${allRoutes.length} routes`);
assert(routes.length > 0, "Filter matched no route");

// A checkbox control in a tool's form is a run control even when the tool does
// not opt into the shared `data-tool-run-control` hook.
const RUN_CONTROL = '[data-tool-run-control], form button[type="submit"]:not([disabled]), .actions .primary:not([disabled])';

const serverLogs = [];
const server = process.env.A11Y350_ORIGIN
  ? null
  : spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", resolve(root, "dist")], { stdio: ["ignore", "pipe", "pipe"] });
server?.stdout.on("data", (b) => serverLogs.push(String(b).slice(0, 200)));
server?.stderr.on("data", (b) => serverLogs.push(String(b).slice(0, 200)));

// A raw TCP probe avoids depending on the static server's HTTP/1.0 keep-alive
// behaviour while it is still starting.
function ping() {
  const { hostname, port: urlPort } = new URL(origin);
  return new Promise((done) => {
    const socket = net.connect(Number(urlPort), hostname);
    const settle = (ok) => { socket.destroy(); done(ok); };
    socket.setTimeout(1_000, () => settle(false));
    socket.once("connect", () => settle(true));
    socket.once("error", () => settle(false));
  });
}

async function ready() {
  for (let i = 0; i < 120; i++) {
    if (server && server.exitCode !== null) throw new Error(`Static server exited: ${serverLogs.join(" ")}`);
    if (await ping()) return;
    await delay(200);
  }
  throw new Error(`Static server unavailable: ${serverLogs.join(" ")}`);
}

async function axeScan(page, label) {
  assert(await page.evaluate(() => typeof window.axe?.run === "function"), `Axe must be loaded for ${label}`);
  return page.evaluate(async (tags) => {
    const report = await window.axe.run(document, { runOnly: { type: "tag", values: tags } });
    return {
      engine: report.testEngine?.version,
      passes: report.passes.length,
      incomplete: report.incomplete.map((v) => v.id),
      violations: report.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: (n.failureSummary ?? "").slice(0, 200) })) })),
    };
  }, AXE_TAGS);
}

// Wait for the focused skip-link overlay to leave the viewport again, so an Axe
// pass always describes the page at rest rather than a keyboard-only overlay.
async function settleSkipLink(page) {
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.waitForFunction(() => {
    const link = document.querySelector(".shell-skip-link");
    return !link || link.getBoundingClientRect().bottom <= 0;
  }, null, { timeout: 2_000, polling: 50 }).catch(() => {});
}

// Images and canvases finish reflowing a frame or two after the viewport change;
// measure the settled layout, not the mid-resize one.
async function settledReflow(page, width) {
  await page.setViewportSize({ width, height: 850 });
  await page.waitForFunction(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    null, { timeout: 2_000, polling: 100 }).catch(() => {});
  return page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
}

const scans = [];
const pageErrors = [];
const unreachable = [];
const overflow = [];
const keyboardGaps = [];
let browser;

try {
  await ready();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "it-IT", reducedMotion: "reduce" });
  await context.route("**/*", (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, json: { error: "Fixture locale: servizio non disponibile" } });
    if (!["GET", "HEAD"].includes(request.method())) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  const meta = { route: "", state: "" };
  page.on("pageerror", (error) => pageErrors.push({ ...meta, error: error.message }));

  // Normalise the theme store once; after that every `goto` starts on light and
  // dark is a real reload of a stored choice, never a mid-transition repaint.
  await page.goto(origin + routes[0], { waitUntil: "domcontentloaded" });
  await page.evaluate((key) => localStorage.setItem(key, "light"), THEME_KEY);

  for (const route of routes) {
    meta.route = route;
    const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 45_000 });
    assert.equal(response?.status(), 200, `${route} should serve HTTP 200`);
    await page.locator("main#main-content").waitFor({ timeout: 20_000 });
    assert.equal(await page.locator("h1").count(), 1, `${route} exposes exactly one H1`);
    assert.equal(await page.locator("html[lang=it]").count(), 1, `${route} is Italian`);
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light", `${route} starts on the stored light theme`);
    await page.waitForFunction(() => document.querySelector("[data-tool-page]") !== null, { timeout: 20_000 }).catch(() => {});

    // Reflow: 320 CSS px stands in for 400% desktop zoom on 1280; 390 for 200%.
    for (const width of [320, 390]) {
      const sizes = await settledReflow(page, width);
      if (sizes.scroll > sizes.client + 1) overflow.push({ route, width, ...sizes });
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    // Keyboard: the first Tab reaches the visible skip link, then the page is
    // returned to rest before the Axe passes below.
    await page.keyboard.press("Tab");
    const skip = await page.evaluate(() => ({
      href: document.activeElement?.getAttribute("href"),
      visible: document.activeElement?.matches(":focus-visible") ?? false,
    }));
    if (skip.href !== "#main-content" || !skip.visible) keyboardGaps.push({ route, step: "skip-link", ...skip });
    await settleSkipLink(page);

    const audit = async (state) => {
      meta.state = state;
      scans.push({ route, state, ...(await axeScan(page, `${route} ${state}`)) });
    };

    await page.addScriptTag({ path: axePath });
    await audit("input-light");

    // Run the primary operation from the keyboard and audit the result it produces.
    const runControl = page.locator(RUN_CONTROL).first();
    const RESULT_STATUSES = ["error", "success", "warning", "partial"];
    const exercise = async (state) => {
      if (await runControl.count() === 0) { unreachable.push({ route, reason: "no-run-control" }); return false; }
      await runControl.scrollIntoViewIfNeeded();
      await runControl.focus();
      await runControl.press("Enter");
      const TERMINAL = '[data-result-state="error"], [data-result-state="success"], [data-result-state="warning"], [data-result-state="partial"], [data-tool-error]';
      const settled = await page.locator(TERMINAL)
        .first().waitFor({ timeout: 8_000 }).then(() => true).catch(() => false);
      if (!settled) { unreachable.push({ route, reason: "no-settled-state" }); return false; }
      // The keyboard run must surface a text cue (never colour alone) and announce
      // it; a failure that renders the shared inline error target must land focus
      // there. Success focus position is left to each tool and not asserted.
      const outcome = await page.evaluate((terminal) => {
        const cue = document.querySelector(terminal);
        const errorTarget = document.querySelector("[data-tool-error]");
        const announcement = (priority) => (document.querySelector(`[data-result-announcement="${priority}"]`)?.textContent ?? "").trim();
        return {
          status: cue?.getAttribute("data-result-state") ?? (errorTarget ? "error" : "unknown"),
          cueText: (cue?.textContent ?? errorTarget?.textContent ?? "").trim(),
          polite: announcement("polite"),
          assertive: announcement("assertive"),
          hasErrorTarget: errorTarget !== null,
          errorFocus: errorTarget !== null && document.activeElement === errorTarget,
        };
      }, TERMINAL);
      if (!RESULT_STATUSES.includes(outcome.status)) keyboardGaps.push({ route, step: "unknown-state", status: outcome.status });
      else if (!outcome.cueText) keyboardGaps.push({ route, step: "colour-only-state", status: outcome.status });
      else if (outcome.status === "error") {
        if (!outcome.assertive) keyboardGaps.push({ route, step: "error-not-announced" });
        if (outcome.hasErrorTarget && !outcome.errorFocus) keyboardGaps.push({ route, step: "error-focus" });
      } else if (!outcome.polite) keyboardGaps.push({ route, step: "result-not-announced", status: outcome.status });
      await audit(state);
      return true;
    };

    await exercise("result-light");

    // Dark ground is a stored choice, so it is re-read from a reload and never
    // sampled while the theme transition is still repainting.
    await page.evaluate((key) => localStorage.setItem(key, "dark"), THEME_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("main#main-content").waitFor({ timeout: 20_000 });
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark", `${route} honours the stored dark theme`);
    await page.addScriptTag({ path: axePath });
    await audit("input-dark");
    await exercise("result-dark");
    await page.evaluate((key) => localStorage.setItem(key, "light"), THEME_KEY);
  }

  // The global header menu is shared vocabulary and part of "menu": prove it
  // stays keyboard-operable and Axe-clean when a desktop dropdown is open, in
  // both grounds, then that the mobile menu button round-trips without a mouse.
  meta.route = routes[0];
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [THEME_KEY, theme]);
    await page.goto(`${origin}${routes[0]}`, { waitUntil: "domcontentloaded" });
    await page.locator("main#main-content").waitFor({ timeout: 20_000 });
    const summary = page.locator(".site-nav-menu > summary").first();
    if (await summary.count() === 0) { unreachable.push({ route: routes[0], reason: "no-desktop-menu" }); break; }
    await summary.focus();
    await page.keyboard.press("Enter");
    if (await page.locator(".site-nav-menu[open]").count() !== 1) keyboardGaps.push({ route: routes[0], step: "menu-open", theme });
    await page.addScriptTag({ path: axePath });
    meta.state = `menu-${theme}`;
    scans.push({ route: routes[0], state: meta.state, ...(await axeScan(page, `${routes[0]} menu ${theme}`)) });
    await page.keyboard.press("Escape");
  }
  await page.evaluate((key) => localStorage.setItem(key, "light"), THEME_KEY);

  await page.goto(`${origin}${routes[0]}`, { waitUntil: "domcontentloaded" });
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.locator(".site-menu-button:visible");
  if (await menu.count() === 1) {
    await menu.focus();
    await page.keyboard.press("Enter");
    const expanded = await menu.getAttribute("aria-expanded");
    await page.keyboard.press("Escape");
    const collapsed = await menu.getAttribute("aria-expanded");
    if (expanded !== "true" || collapsed !== "false") keyboardGaps.push({ route: routes[0], step: "menu", expanded, collapsed });
  }

  const violations = scans.flatMap((scan) => scan.violations.map((v) => ({ route: scan.route, state: scan.state, ...v })));
  const violatedRules = [...new Set(violations.map((v) => v.id))];
  console.log("#350_TOOL_SWEEP_SUMMARY", JSON.stringify({
    axe: scans[0]?.engine ?? "unloaded",
    routes: routes.length,
    scans: scans.length,
    violatingRoutes: [...new Set(violations.map((v) => v.route))].length,
    violatedRules,
    overflow: overflow.length,
    keyboardGaps: keyboardGaps.length,
    unexercisedResults: unreachable.length,
    pageErrors: pageErrors.length,
    physicalMobile: "NOT_RUN",
    manualScreenreader: "NOT_RUN",
  }));
  for (const v of violations.slice(0, 40)) console.log("AXE_VIOLATION", JSON.stringify(v));
  for (const o of overflow.slice(0, 20)) console.log("OVERFLOW", JSON.stringify(o));
  for (const k of keyboardGaps.slice(0, 20)) console.log("KEYBOARD_GAP", JSON.stringify(k));
  for (const u of unreachable.slice(0, 20)) console.log("NO_RUN_CONTROL", JSON.stringify(u));
  for (const e of pageErrors.slice(0, 20)) console.log("PAGE_ERROR", JSON.stringify(e));

  assert.deepEqual(overflow, [], "No tool route may overflow horizontally at 320/390 CSS px");
  assert.deepEqual(keyboardGaps, [], "Keyboard activation, first-Tab skip link and menu must hold");
  assert.deepEqual(violations, [], "Axe must report zero WCAG A/AA violations on input and result, light and dark");
  assert.deepEqual(pageErrors, [], "No uncaught page errors across audited tool states");
  if (filter.length) assert.deepEqual(unreachable, [], "Every selected route must expose and settle a keyboard-run result");
  console.log(`#350 browser audit PASS (${scans.length} Axe scans over ${routes.length} routes, ${unreachable.length} unexercised results)`);
} finally {
  await browser?.close();
  if (server?.exitCode === null) server.kill("SIGTERM");
}

/** #350 scoped axe-core 4.14 browser audit of actual compiled site.
 * Not full WCAG, physical touch, or AT.
 * Run after `npm ci` and `npm run build`; axe-core is a pinned devDependency.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 19850;
const origin = `http://127.0.0.1:${port}`;
const axePath = resolve("node_modules/axe-core/axe.min.js");
const server = spawn("./node_modules/.bin/astro", ["preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
const logs = [];
server.stdout.on("data", buf => logs.push(String(buf).slice(0, 500)));
server.stderr.on("data", buf => logs.push(String(buf).slice(0, 500)));
const routes = ["/", "/accedi/", "/preferiti/", "/tools/rate-converter/"];
const scans = [], errors = [], unexpected = [];
let browser;

async function ready() {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error(`Preview exited: ${logs.join(" ")}`);
    try { if ((await fetch(origin + "/", { signal: AbortSignal.timeout(1000) })).ok) return; }
    catch { /* Preview may be starting. */ }
    await delay(200);
  }
  throw Error(`Preview unavailable: ${logs.join(" ")}`);
}

async function axeScan(page, metadata, state) {
  assert(await page.evaluate(() => typeof window.axe?.run === "function"), "Real axe-core browser bundle must be loaded");
  const result = await page.evaluate(async () => {
    const report = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    });
    return {
      engine: report.testEngine,
      violations: report.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help,
        nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary?.slice(0, 220) })) })),
      incomplete: report.incomplete.map(v => ({ id: v.id, count: v.nodes.length })),
      passes: report.passes.length,
    };
  });
  scans.push({ ...metadata, state, ...result });
  console.log("AXE", JSON.stringify(scans.at(-1)));
}

try {
  await ready();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const route of routes) for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height: 850 }, locale: "it-IT", reducedMotion: "reduce" });
    try {
      await context.addInitScript(t => localStorage.setItem("strumentini:theme:v1", t), theme);
      await context.route("**/*", async r => {
        const request = r.request(), url = new URL(request.url());
        if (url.origin !== origin) return r.abort();
        if (url.pathname.startsWith("/api/")) return r.fulfill({ status: 503, json: { error: "Fixture locale: servizio non disponibile" } });
        if (!["GET", "HEAD"].includes(request.method())) { unexpected.push({ route, method: request.method(), path: url.pathname }); return r.abort(); }
        return r.continue();
      });
      const page = await context.newPage();
      const meta = { route, width, theme };
      page.on("pageerror", e => errors.push({ ...meta, error: e.message }));
      const response = await page.goto(origin + route, { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, `Compiled ${route} should serve HTTP 200`);
      await page.locator("main#main-content").waitFor();
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      assert(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
      const before = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert(before.scroll <= before.client + 1, `No horizontal page clipping at ${JSON.stringify(meta)}: ${JSON.stringify(before)}`);
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("href")), "#main-content", "Keyboard-first skip link");
      const firstFocus = await page.evaluate(() => document.activeElement?.matches(":focus-visible"));
      assert(firstFocus, "Visible keyboard skip-link focus");
      await page.addScriptTag({ path: axePath });
      await axeScan(page, meta, "initial");

      if (route === "/") {
        const chooser = page.locator("[data-home-file-picker]");
        await chooser.setInputFiles({ name: "vuoto.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) });
        await page.waitForFunction(() => (document.querySelector("[data-home-file-status]")?.textContent ?? "").includes("vuoto"));
        await axeScan(page, meta, "invalid-file");
      } else if (route === "/accedi/") {
        await page.locator("#panel-login [data-access-submit]").click();
        await page.locator("#login-email-error:visible").waitFor();
        assert.equal(await page.evaluate(() => document.activeElement?.id), "login-email");
        await axeScan(page, meta, "invalid-login");
      } else if (route === "/tools/rate-converter/") {
        await page.locator("[data-tool-run-control]").waitFor();
        await page.locator("[data-tool-run-control]").focus();
        await page.keyboard.press("Enter");
        await page.locator("[data-tool-error]:visible").waitFor();
        assert(await page.locator("[data-tool-error]").evaluate(el => document.activeElement === el));
        await axeScan(page, meta, "invalid-tool");
        await page.getByLabel("Importo della tariffa").fill("50");
        await page.locator("[data-tool-run-control]").click();
        await page.locator('.result-panel[data-state="success"]').waitFor();
        await axeScan(page, meta, "tool-result");
      }
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(unexpected, [], "Only local GET/HEAD and mocked /api/ may occur");
  assert.deepEqual(errors, [], "No uncaught page errors in audited user states");
  const failures = scans.filter(x => x.violations.length > 0);
  console.log("#350_AUDIT_SUMMARY", JSON.stringify({ source: "compiled local dist", chrome: browser.version(), axe: "4.14.0",
    scans: scans.length, failures: failures.length, totalViolatedRules: failures.reduce((a, s) => a + s.violations.length, 0),
    states: [...new Set(scans.map(s => s.state))], physicalMobile: "NOT_RUN", screenreader: "NOT_RUN", nativeZoom: "NOT_RUN" }));
  if (failures.length) process.exitCode = 2;
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill("SIGTERM");
}

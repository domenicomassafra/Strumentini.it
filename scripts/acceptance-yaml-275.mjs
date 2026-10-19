// #275 — real-browser acceptance for the lazily adopted yaml@2.9.1 formatter.
// Run after `npm run build`:
//   node --import tsx scripts/acceptance-yaml-275.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { chromium, webkit } from "@playwright/test";
import { yamlFormatterOperation } from "../src/engines/developer-web/index.ts";

const root = resolve(import.meta.dirname, "..");
const port = 18157;
const origin = `http://127.0.0.1:${port}`;
const corpus = JSON.parse(await readFile(resolve(root, "quality/fixtures/yaml-275/corpus.json"), "utf8")).fixtures;
const fixtures = corpus.filter((fixture) => fixture.id !== "merge-keys-refused" && fixture.id !== "comments-only");
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

/** Identifies the lazily imported yaml@2.9.1 chunk by a string that only the donor bundle contains. */
async function donorChunkFile() {
  const { readdir } = await import("node:fs/promises");
  for (const name of await readdir(resolve(root, "dist/_astro"))) {
    if (!name.endsWith(".js")) continue;
    if ((await readFile(resolve(root, "dist/_astro", name), "utf8")).includes("Map keys must be unique")) return name;
  }
  throw new Error("yaml donor chunk not found in dist/_astro");
}
const donorChunk = await donorChunkFile();

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await sleep(100);
  }
  throw new Error(`static server did not become ready at ${origin}`);
}

async function measure(engineName, engineType, viewport) {
  const browser = await engineType.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    const page = await context.newPage();
    const session = await context.newCDPSession(page).catch(() => null);
    if (session !== null) await session.send("Performance.enable");
    const heap = async () => session === null ? 0 : ((await session.send("Performance.getMetrics")).metrics
      .find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0);
    const loadScripts = [];
    const taskRequests = [];
    const cspViolations = [];
    let active = false;
    page.on("request", (request) => {
      if (request.resourceType() === "script" && !active) loadScripts.push(request.url());
      if (active) taskRequests.push({ url: request.url(), method: request.method(), body: request.postData() });
    });
    const response = await page.goto(`${origin}/tools/yaml-formatter/`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);
    await page.evaluate(() => document.addEventListener("securitypolicyviolation", (event) => {
      globalThis.__yaml275Csp ??= [];
      globalThis.__yaml275Csp.push(event.violatedDirective);
    }));
    const form = page.locator("article[data-tool-page] form").first();
    const textarea = form.locator("textarea").first();
    const submit = form.locator("[data-tool-run-control='true']").first();
    active = true;
    const t0 = Date.now();
    let firstResultMs = null;
    let peakObservedHeapBytes = await heap();
    for (const [index, fixture] of fixtures.entries()) {
      await textarea.fill(fixture.source);
      const started = Date.now();
      await submit.click();
      await page.locator(".gutter[data-state='success']").waitFor({ timeout: 15000 });
      const actual = await page.locator(".bounded-result-preview pre").first().textContent();
      if (firstResultMs === null) firstResultMs = Date.now() - started;
      const normalizedSource = fixture.source.replace(/\r\n?/gu, "\n");
      const baseline = await yamlFormatterOperation(normalizedSource);
      const rendered = JSON.parse(String(actual));
      assert.equal(rendered.formattato, baseline.formatted, `${engineName} ${viewport.width}px ${fixture.id}: rendered output must match the lazy adapter byte for byte`);
      assert.deepEqual(rendered.valore, JSON.parse(JSON.stringify(baseline.value)), `${fixture.id}: rendered value`);
      assert.equal((await textarea.inputValue()).replace(/\r\n?/gu, "\n"), normalizedSource, `${fixture.id}: source must not be mutated`);
      peakObservedHeapBytes = Math.max(peakObservedHeapBytes, await heap());
      if (index === 0) {
        const [download] = await Promise.all([
          page.waitForEvent("download"),
          page.locator('[data-result-action="download"]').first().click(),
        ]);
        assert.equal(download.suggestedFilename(), "yaml-formatter-risultato.yaml");
        assert.equal(await readFile(await download.path(), "utf8"), String(rendered.formattato), "downloaded YAML reopens independently");
      }
    }
    const overLimit = "a: " + "x".repeat(1_000_001) + "\n";
    await textarea.fill(overLimit);
    await submit.click();
    await page.locator("[data-tool-error]").first().waitFor({ timeout: 15000 });
    assert.equal((await textarea.inputValue()).replace(/\r\n?/gu, "\n"), overLimit);
    cspViolations.push(...await page.evaluate(() => globalThis.__yaml275Csp ?? []));
    assert.deepEqual(cspViolations, [], "CSP violation during local formatting");
    assert.deepEqual(taskRequests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.body ?? "") !== ""), [], "no upload, egress or non-GET during the task");
    const lazyChunks = taskRequests.filter((request) => request.url.endsWith(`/${donorChunk}`)).map((request) => request.url.split("/").at(-1));
    assert.equal(loadScripts.filter((url) => url.endsWith(`/${donorChunk}`)).length, 0, "the donor chunk must not be part of the initial page load");
    assert.ok(lazyChunks.length > 0, "the donor chunk must be fetched on the first formatting request");
    console.log(JSON.stringify({
      engine: engineName, viewport: viewport.width, matched: fixtures.length,
      elapsedMs: Date.now() - t0, firstResultMs, peakObservedHeapBytes,
      cspViolations: cspViolations.length, egress: 0, lazyChunks,
      overLimit: "INPUT_TOO_LARGE", downloadedAndReopened: true,
    }));
    await context.close();
  } finally {
    await browser.close();
  }
}

try {
  await waitForServer();
  // Chromium has CDP (heap sampling); WebKit is the mobile-Safari proxy and reports the rest.
  await measure("chromium", chromium, { width: 1440, height: 900 });
  await measure("chromium-mobile", chromium, { width: 390, height: 844 });
  await measure("webkit-mobile", webkit, { width: 390, height: 844 });
} finally {
  server.kill();
}

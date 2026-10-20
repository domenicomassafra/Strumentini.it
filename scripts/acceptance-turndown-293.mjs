// Run after catalog:build and an Astro dev/preview server:
// TEXT_MARKUP_ACCEPTANCE_ORIGIN=http://127.0.0.1:18154 node --import tsx scripts/acceptance-turndown-293.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { convertTextMarkup } from "../src/engines/text-markup-conversion/index.ts";

const origin = (process.env.TEXT_MARKUP_ACCEPTANCE_ORIGIN ?? "http://127.0.0.1:18154").replace(/\/$/u, "");
const fixtures = [
  ["pre-and-break", "<h2>Caffè</h2><p><strong>forte</strong><br>linea</p><pre> a\n  b </pre>"],
  ["inline", '<p>Una <em>nota</em>, <del>tagliata</del>, <code>x</code> e <a href="https://example.com/a">link</a>.</p>'],
  ["quote", "<blockquote><p>Ciao <strong>mondo</strong></p></blockquote>"],
  ["list", "<ul><li>uno</li><li>due</li></ul>"],
  ["nested-list", "<ul><li>uno<ul><li>figlio</li></ul></li><li>due</li></ul>"],
  ["table", "<table><tr><th>Nome</th><th>Età</th></tr><tr><td>È</td><td>2</td></tr></table>"],
  ["unicode", "<p>Cafe\u0301, Caffè &amp; ☕</p>"],
  ["hostile", '<script>alert(1)</script><p>a <a href="jav&#x61;script:alert(2)">safe</a><img src="https://example.com/x" alt="ALT" onerror="alert(3)"></p>'],
  ["entities", "<p>A&nbsp;B &quot;C&quot; &lt;D&gt;</p>"],
  ["mixed", "<h1>T</h1><hr><p>m <b>n</b></p><textarea>  a\n<b>x</b> </textarea>"],
];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    const page = await context.newPage();
    const metricsSession = await context.newCDPSession(page);
    await metricsSession.send("Performance.enable");
    const sampledHeap = async () => (await metricsSession.send("Performance.getMetrics")).metrics
      .find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;
    const taskRequests = [];
    const cspViolations = [];
    let active = false;
    page.on("request", (request) => {
      if (active) taskRequests.push({ url: request.url(), method: request.method(), body: request.postData() });
    });
    const response = await page.goto(`${origin}/tools/text-markup-converter/`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);
    await page.evaluate(() => document.addEventListener("securitypolicyviolation", (event) => {
      globalThis.__turndown293CspViolations ??= [];
      globalThis.__turndown293CspViolations.push(event.violatedDirective);
    }));
    const form = page.locator("article[data-tool-page] form").first();
    await form.locator("select").first().selectOption("html-to-markdown");
    const textarea = form.locator("textarea").first();
    const submit = form.locator('button[type="submit"]').first();
    active = true;
    const t0 = Date.now();
    let peakObservedHeapBytes = await sampledHeap();
    for (const [id, source] of fixtures) {
      await textarea.fill(source);
      await submit.click();
      await page.waitForFunction((value) => document.querySelector('[aria-label="Anteprima sorgente normalizzata"] pre')?.textContent === value, source);
      await page.locator('.result-panel[data-state="success"]').waitFor();
      const actual = await page.locator('[aria-label="Anteprima risultato"] pre').textContent();
      const baseline = convertTextMarkup({ mode: "html-to-markdown", text: source });
      assert.equal(actual, baseline.output, `${viewport.width}px ${id}: donor must preserve the existing subset`);
      assert.equal(await textarea.inputValue(), source, `${id}: original source was mutated`);
      peakObservedHeapBytes = Math.max(peakObservedHeapBytes, await sampledHeap());
      const preview = await page.locator('[data-sanitized-preview="true"]').innerHTML();
      assert.doesNotMatch(preview, /<script|<img|<iframe|onerror=|onclick=|javascript:/iu, `${id}: unsafe preview`);
      if (id === "hostile") assert.equal(actual, "a safeALT");
      if (id === "unicode") assert.equal(actual, "Cafe\u0301, Caffè & ☕");
      if (id === "pre-and-break") {
        const [download] = await Promise.all([
          page.waitForEvent("download"),
          page.locator('button[data-result-action="download"]').click(),
        ]);
        assert.equal(download.suggestedFilename(), "documento-convertito.md");
        assert.equal(await readFile(await download.path(), "utf8"), actual, "downloaded bytes reopen independently as UTF-8");
      }
    }
    // A typed refusal is required before the donor parses an unbounded input.
    await textarea.fill(`<p>${"a".repeat(1_000_001)}</p>`);
    await submit.click();
    await page.locator('.result-panel[data-state="error"]').waitFor();
    assert.equal(await textarea.inputValue(), `<p>${"a".repeat(1_000_001)}</p>`);
    cspViolations.push(...await page.evaluate(() => globalThis.__turndown293CspViolations ?? []));
    assert.deepEqual(cspViolations, [], "CSP violation during local conversion");
    assert.deepEqual(taskRequests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || request.body !== null), [], "unwanted upload or egress");
    console.log(JSON.stringify({ viewport: viewport.width, matched: fixtures.length, elapsedMs: Date.now() - t0, peakObservedHeapBytes, cspViolations: cspViolations.length, egress: 0, downloadedAndReopened: true, overLimit: "INPUT_TOO_LARGE" }));
    await context.close();
  }
} finally {
  await browser.close();
}

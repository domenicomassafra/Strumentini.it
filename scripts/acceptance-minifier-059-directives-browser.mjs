/**
 * #059 public static-page acceptance. Downloads the actual transformed artifact
 * from each browser rather than invoking an engine in Node. No builds, Gold
 * writes, cloud, SVG optimizer or production promotion.
 *
 * STRUMENTINI_059_DIST: static Astro output (default this checkout's dist,
 * otherwise the concurrently available canonical Strumentini.it/dist).
 * STRUMENTINI_059_PORT: independent loopback port; default 18559.
 * STRUMENTINI_059_BROWSERS: comma-separated subset of chromium,firefox,webkit.
 */
import { chromium, firefox, webkit } from "@playwright/test";
import * as cssTree from "css-tree";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseFragment } from "parse5";

const root = resolve(import.meta.dirname, "..");
const ownDist = resolve(root, "dist");
const dist = resolve(process.env.STRUMENTINI_059_DIST ?? (existsSync(join(ownDist, "tools/html-minifier/index.html"))
  ? ownDist : resolve(root, "../Strumentini.it/dist")));
const port = Number(process.env.STRUMENTINI_059_PORT ?? 18559);
assert(Number.isInteger(port) && port >= 1024 && port <= 65535, "Invalid loopback port");
const origin = `http://127.0.0.1:${port}`;
const engines = { chromium, firefox, webkit };
const requested = (process.env.STRUMENTINI_059_BROWSERS ?? "chromium,firefox,webkit").split(",").map((value) => value.trim());
assert(requested.length > 0 && requested.every((value) => Object.hasOwn(engines, value)), "Unknown or empty browser selection");
assert(new Set(requested).size === requested.length, "Duplicate browser selection");

// Relevant deployed bundle must contain the integrated Gutenberg/Svelte fix.
// A stale dist is a hard failure even if older code could pass weaker cases.
async function requireCurrentBundle() {
  for (const route of ["html-minifier", "css-minifier", "json-formatter"]) {
    assert(existsSync(join(dist, "tools", route, "index.html")), `Static build missing public route ${route}: ${dist}`);
  }
  const assets = join(dist, "_astro");
  const bundles = (await readdir(assets)).filter((entry) => /^developer-web\..*\.js$/u.test(entry));
  assert(bundles.length > 0, "Static build missing developer-web JS bundle");
  let found = false;
  for (const filename of bundles) {
    const value = await readFile(join(assets, filename), "utf8");
    if (value.includes("svelte-") && value.includes("wp:")) found = true;
  }
  assert(found, "Stale static build: Gutenberg/Svelte advanced-comment fix absent");
  assert((await stat(join(dist, "tools", "html-minifier", "index.html"))).size > 0, "Empty built HTML route");
}

const directiveInput = '<article><!-- wp:paragraph {"style":"special"} --><p>Caffè ☕ <strong>oggi</strong></p><!-- /wp:paragraph --><!--svelte-h0--><span>Idratazione</span><!--/svelte-h0--><!--$--><div>React&nbsp;<em>stream</em></div><!--/$--><template id="tpl"><!-- internal unknown marker --><span>Conserva  due</span></template></article>';
const unknownInput = '<article><!-- unknown-framework:start --><p>È presente ☕</p><!-- unknown-framework:end --></article>';
const cssInput = '@layer components { @media (width >= 20em) { .item::before { content:"Caffè  ☕"; background:url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E"); } } }';
const jsonInput = '{ "caffè":"☕", "html":"<template>  A </template>", "__proto__":{"literal":true}, "count":2 }';
const cases = [
  { name: "known directives advanced", route: "html-minifier", mode: "advanced", source: directiveInput, type: "html", ext: ".html" },
  { name: "known directives safe", route: "html-minifier", mode: "safe", source: directiveInput, type: "html", ext: ".html" },
  { name: "unknown directive safe", route: "html-minifier", mode: "safe", source: unknownInput, type: "html", ext: ".html" },
  { name: "unknown structured directive advanced", route: "html-minifier", mode: "advanced", source: unknownInput, type: "html", ext: ".html" },
  { name: "nested CSS", route: "css-minifier", mode: "minify", source: cssInput, type: "css", ext: ".css" },
  { name: "Unicode JSON", route: "json-formatter", mode: "minify", source: jsonInput, type: "json", ext: ".json" },
];

/** Preserve all text/comment nodes, attributes and template.content. */
function htmlDom(source) {
  function visit(node) {
    return {
      name: node.nodeName,
      tag: node.tagName ?? null,
      value: node.value ?? node.data ?? null,
      attrs: (node.attrs ?? []).map(({ name, value }) => [name, value]),
      children: (node.childNodes ?? []).map(visit),
      template: node.content === undefined ? null : visit(node.content),
    };
  }
  return visit(parseFragment(source));
}

function checkDownloaded(example, value, bytes) {
  assert.equal(new TextEncoder().encode(value).byteLength, bytes.byteLength, `${example.name}: UTF-8 decoded bytes changed`);
  assert(!value.includes('"engineVersion"'), `${example.name}: downloaded metadata instead of transformed text`);
  if (example.type === "html") {
    assert.deepEqual(htmlDom(value), htmlDom(example.source), `${example.name}: actual downloaded HTML DOM/comments changed`);
    if (example.source === directiveInput) {
      for (const marker of ["wp:paragraph", "/wp:paragraph", "svelte-h0", "/svelte-h0", "<!--$-->", "<!--/$-->", "internal unknown marker"]) {
        assert(value.includes(marker), `${example.name}: missing functional comment ${marker}`);
      }
    } else {
      assert(value.includes("unknown-framework:start") && value.includes("unknown-framework:end"), "Safe mode lost unknown comments");
    }
    return;
  }
  if (example.type === "css") {
    const before = cssTree.generate(cssTree.parse(example.source, { parseCustomProperty: true }));
    const after = cssTree.generate(cssTree.parse(value, { parseCustomProperty: true }));
    assert.equal(after, before, "Downloaded CSS parser canonical AST changed");
    assert(value.includes('"Caffè  ☕"'), "CSS string whitespace or UTF-8 changed");
    assert(value.includes("data:image/svg+xml"), "CSS data URI dropped");
    return;
  }
  assert.deepEqual(JSON.parse(value), JSON.parse(example.source), "Downloaded JSON value changed");
  assert(Object.hasOwn(JSON.parse(value), "__proto__"), "JSON dangerous-looking data key was silently removed");
}

async function waitForServer() {
  for (let attempt = 0; attempt < 70; attempt += 1) {
    try {
      const response = await fetch(`${origin}/tools/html-minifier/`);
      if (response.status === 200) return;
    } catch { /* Local server may still be binding. */ }
    await new Promise((done) => setTimeout(done, 120));
  }
  throw new Error(`Static HTTP server not available at ${origin}`);
}

let server;
let checked = 0;
try {
  await requireCurrentBundle();
  server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { cwd: root, stdio: "ignore" });
  await waitForServer();
  for (const browserName of requested) {
    const browser = await engines[browserName].launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      for (const example of cases) {
        const page = await context.newPage();
        const offsite = [];
        const pageErrors = [];
        page.on("pageerror", (error) => pageErrors.push(String(error)));
        await page.route("**/*", (route) => {
          const url = route.request().url();
          if (url.startsWith(origin + "/") || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
          offsite.push(url);
          return route.abort();
        });
        try {
          const response = await page.goto(`${origin}/tools/${example.route}/`, { waitUntil: "networkidle" });
          assert.equal(response?.status(), 200, `${browserName}/${example.name}: public route unavailable`);
          await page.locator("form textarea").first().fill(example.source);
          await page.locator("form select").first().selectOption(example.mode);
          await page.locator('form button[type="submit"]').click();
          const action = page.locator('[data-result-action="download"]');
          await action.waitFor({ timeout: 15000 });
          const pending = page.waitForEvent("download");
          await action.click();
          const download = await pending;
          assert(download.suggestedFilename().endsWith(example.ext), `${browserName}/${example.name}: expected raw ${example.ext}`);
          const bytes = await readFile(await download.path());
          const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          checkDownloaded(example, content, bytes);
          const gutter = await page.locator(".gutter").last().innerText();
          const inputBytes = new TextEncoder().encode(example.source).byteLength;
          assert(gutter.includes("Byte ingresso (UTF-8)") && gutter.includes(String(inputBytes)), `${browserName}/${example.name}: input byte count absent`);
          assert(gutter.includes("Byte output trasformato (UTF-8)") && gutter.includes(String(bytes.byteLength)), `${browserName}/${example.name}: output byte count absent`);
          assert.deepEqual(offsite, [], `${browserName}/${example.name}: unexpected offsite request`);
          assert.deepEqual(pageErrors, [], `${browserName}/${example.name}: uncaught browser error`);
          const layout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
          assert(layout.scroll <= layout.client + 2, `${browserName}/${example.name}: 390px horizontal overflow ${JSON.stringify(layout)}`);
          checked += 1;
          console.log(`PASS ${browserName}/${example.name}: ${bytes.byteLength} downloaded UTF-8 bytes; public DOM/parser verified; no offsite; 390px`);
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`MINIFIER_059_DIRECTIVES_BROWSER_PASS ${checked}/${requested.length * cases.length} validated real browser downloads (static ${dist}; browsers ${requested.join(",")})`);
} finally {
  if (server && server.exitCode === null) server.kill("SIGTERM");
}

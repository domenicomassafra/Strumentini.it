/** #303 — compiled local CIDR UI acceptance in real browser engines. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve("dist");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    let target = resolve(root, "." + pathname);
    if (!target.startsWith(root + sep)) throw Error("invalid local path");
    if (pathname.endsWith("/")) target = join(target, "index.html");
    const content = await readFile(target);
    response.setHeader("Content-Type", mime[extname(target)] ?? "application/octet-stream");
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
const origin = "http://127.0.0.1:" + server.address().port;

const selected = process.env.STR303_BROWSER ? [process.env.STR303_BROWSER] : ["chromium", "firefox", "webkit"];
const engines = { chromium, firefox, webkit };
async function within(promise, label, timeout = 20000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + " timed out")), timeout);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

assert.ok(selected.every((name) => engines[name]), "STR303_BROWSER must be chromium, firefox or webkit");

try {
  for (const name of selected) {
    const start = performance.now();
    let phase = "launch";
    let page;
    const diagnostics = [];
    const browser = await engines[name].launch({ headless: true, timeout: 20000 });
    try {
      phase = "newPage";
      page = await within(browser.newPage({ viewport: { width: 390, height: 844 } }), name + " newPage");
      const externalRequests = [];
      const pageErrors = [];
      page.on("pageerror", (error) => { pageErrors.push(error.message); diagnostics.push("pageerror " + error.message); });
      page.on("requestfailed", (request) => diagnostics.push("requestfailed " + request.url() + " " + (request.failure()?.errorText ?? "")));
      page.on("response", (response) => { if (response.status() >= 400) diagnostics.push("http " + response.status() + " " + response.url()); });
      await page.route("**/*", async (route) => {
        const request = route.request();
        if (!request.url().startsWith(origin + "/") || request.method() !== "GET" || request.postData()) {
          externalRequests.push(request.method() + " " + request.url());
          await route.abort();
        } else {
          await route.continue();
        }
      });
      phase = "navigation";
      const response = await page.goto(origin + "/tools/cidr-calculator/", { waitUntil: "domcontentloaded", timeout: 20000 });
      assert.equal(response?.status(), 200, "compiled CIDR route");
      // Astro renders the form during SSR; wait for the Preact client:load island
      // to hydrate before interacting with input or submit handlers.
      await page.locator('astro-island[component-export="DeveloperWebTool"]:not([ssr])').waitFor({ timeout: 20000 });
      const input = page.locator("#cidr-calculator-cidr");
      await input.waitFor({ timeout: 15000 });
      const form = input.locator("xpath=ancestor::form");
      const button = form.locator('button[type="submit"]');
      const valid = [
        ["192.0.2.10/31", "192.0.2.10/31"],
        ["192.0.2.10/32", "192.0.2.10/32"],
        ["2001:db8::5/127", "2001:db8::4/127"],
        ["2001:db8::5/128", "2001:db8::5/128"],
        ["::ffff:192.0.2.1/120", "::ffff:c000:200/120"],
      ];
      for (const [value, expected] of valid) {
        phase = "valid " + value;
        await input.fill(value);
        await button.click();
        await page.locator("pre.result-code").filter({ hasText: expected }).waitFor({ timeout: 15000 });
        assert.equal(await page.locator('form[aria-label] [role="alert"]').count(), 0, value + " should succeed");
      }
      for (const value of ["127.1/8", "192.0.2.1/33", "2001:db8::1/129", "fe80::1%eth0/64"]) {
        phase = "refusal " + value;
        await input.fill(value);
        await button.click();
        const alert = page.locator('form[aria-label] [role="alert"]');
        await alert.waitFor({ timeout: 15000 });
        assert.match(await alert.innerText(), /Controlla i valori inseriti|INVALID_INPUT/, value + " should refuse");
        assert.equal(await page.locator("pre.result-code").count(), 0, "stale result after " + value);
      }
      assert.deepEqual(pageErrors, [], name + " page errors");
      assert.deepEqual(externalRequests, [], name + " offline GET-only policy");
      console.log("PASS " + name + ": 5 valid, 4 refusals, no stale result, no offsite/POST, " + Math.round(performance.now() - start) + " ms");
      await page.close();
    } catch (error) {
      console.error("FAIL " + name + " at " + phase + ": " + error.message);
      if (page) {
        console.error("FORM DEBUG:", (await page.locator("#cidr-calculator-cidr").locator("xpath=ancestor::form").innerText().catch(() => "")).slice(0, 800));
        console.error("PRE DEBUG:", (await page.locator("pre").allTextContents().catch(() => [])).slice(0, 3).map((t) => t.slice(0, 500)));
        console.error("PAGE DEBUG:", (await page.locator("body").innerText().catch(() => "")).slice(0, 750));
        console.error("NET/ERROR DEBUG:", diagnostics.slice(-15));
      }
      throw error;
    } finally {
      await within(browser.close(), name + " close");
    }
  }
} finally {
  await new Promise((ok) => server.close(ok));
}

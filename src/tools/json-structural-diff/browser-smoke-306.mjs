// STR-306: test the installed static consumer after `npm run build`.
// Serve `dist` on 127.0.0.1:43906 before running this script.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, firefox, webkit } from "playwright";

const url = process.env.STR306_TEST_URL ?? "http://127.0.0.1:43906/tools/json-structural-diff/";
function bounded(promise, milliseconds, operation) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${operation} timed out after ${milliseconds}ms`)), milliseconds); }),
  ]).finally(() => clearTimeout(timer));
}
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  if (process.env.STR306_BROWSER && process.env.STR306_BROWSER !== name) continue;
  let browser;
  const external = [];
  const errors = [];
  try {
    browser = await engine.launch({ headless: true, timeout: 20_000 });
    const page = await bounded(browser.newPage({ acceptDownloads: true, serviceWorkers: "block" }), 20_000, `${name}.newPage`);
    page.setDefaultTimeout(10_000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      const target = new URL(route.request().url());
      if (!["localhost", "127.0.0.1"].includes(target.hostname)) {
        external.push(target.href);
        return route.abort();
      }
      return route.continue();
    });
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
    assert.equal(response?.status(), 200);
    const left = page.getByLabel("JSON prima");
    const right = page.getByLabel("JSON dopo");
    await left.fill('{"items":[1,2],"__proto__":{"safe":true}}');
    await right.fill('{"items":[2,1],"__proto__":{"safe":true},"toString":"new"}');
    await page.getByRole("button", { name: "Confronta JSON" }).click();
    await page.locator("pre").filter({ hasText: '"/items"' }).first().waitFor({ state: "visible" });
    const button = page.getByRole("button", { name: /Scarica|Download/i }).first();
    const downloaded = page.waitForEvent("download", { timeout: 10_000 });
    await button.click();
    const artifact = await downloaded;
    const result = JSON.parse(readFileSync(await artifact.path(), "utf8"));
    assert.equal(result.differenceCount, 2);
    assert.deepEqual(result.differences.map(({ kind, path }) => ({ kind, path })), [
      { kind: "order", path: "/items" },
      { kind: "add", path: "/toString" },
    ]);
    await left.fill("1");
    await right.fill("2");
    await page.getByRole("button", { name: "Confronta JSON" }).click();
    await page.locator("pre").filter({ hasText: '"kind": "value"' }).first().waitFor({ state: "visible" });
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ browser: name, http: 200, arrayReorder: "PASS", inheritedKeys: "PASS", rootPrimitive: "PASS", egressRequests: 0, pageErrors: 0 }));
  } catch (error) {
    console.error(`${name} FAILED`, error);
    process.exitCode = 1;
  } finally {
    if (browser) await bounded(browser.close(), 10_000, `${name}.close`).catch((error) => console.error(error.message));
  }
}

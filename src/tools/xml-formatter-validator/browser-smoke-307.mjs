// STR-307: browser acceptance of the existing compiled XML route.
// Run `npm run build`, then serve dist on the local port, for example:
// python3 -m http.server 43907 --bind 127.0.0.1 --directory dist
// node src/tools/xml-formatter-validator/browser-smoke-307.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, firefox, webkit } from "playwright";

const url = process.env.STR307_TEST_URL ?? "http://127.0.0.1:43907/tools/xml-formatter-validator/";
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  if (process.env.STR307_BROWSER && process.env.STR307_BROWSER !== name) continue;
  let browser;
  const external = [];
  const errors = [];
  try {
    browser = await engine.launch({ headless: true, timeout: 20_000 });
    const page = await browser.newPage({ acceptDownloads: true, serviceWorkers: "block" });
    page.setDefaultTimeout(10_000);
    page.on("request", (request) => {
      const target = new URL(request.url());
      if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost" && target.protocol !== "data:") external.push(request.url());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      const target = new URL(route.request().url());
      if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost") return route.abort();
      return route.continue();
    });
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
    assert.equal(response?.status(), 200);
    const field = page.locator("#xml-formatter-validator-text");
    await field.waitFor({ state: "visible" });
    await field.fill("<p>Hello <b>world</b> !</p>");
    await page.getByRole("button", { name: "Elabora XML" }).click();
    await page.waitForFunction(() => [...document.querySelectorAll("pre")]
      .some((element) => element.textContent?.includes("Hello <b>world</b> !")));
    const result = (await page.locator("pre").allTextContents())
      .find((value) => value.includes("Hello <b>world</b> !"));
    assert.ok(result?.includes("valid"), `missing local XML output in ${name}`);
    const download = page.getByRole("button", { name: /Scarica|Download/i }).first();
    assert.equal(await download.count(), 1);
    const pendingDownload = page.waitForEvent("download", { timeout: 10_000 });
    await download.click();
    const file = await pendingDownload;
    assert.equal(readFileSync(await file.path(), "utf8"), "<p>Hello <b>world</b> !</p>");
    await field.fill('<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>');
    await page.getByRole("button", { name: "Elabora XML" }).click();
    await page.getByText(/INVALID_XML_EXTERNAL_ENTITY_DISABLED/).first().waitFor({ state: "visible" });
    assert.deepEqual(external, [], `external requests in ${name}`);
    assert.deepEqual(errors, [], `page errors in ${name}`);
    console.log(JSON.stringify({ browser: name, http: 200, mixedContent: "PRESERVED", xxe: "REJECTED",
      egressRequests: external.length, pageErrors: errors.length, download: "EXACT_XML" }));
  } catch (error) {
    console.error(name, "FAILED", error);
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}

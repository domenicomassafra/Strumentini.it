import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium, firefox, webkit } from "@playwright/test";

const port = 18155;
const origin = process.env.STR305_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.STR305_ORIGIN ? undefined : spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
const cases = [
  ["  Café déjà vu / notes ", "cafe-deja-vu-notes"],
  ["Straße & Ærø", "strasse-aero"],
  ["你好 世界", "你好-世界"],
];
const engines = { chromium, firefox, webkit };
const selected = process.env.STR305_BROWSER ? [engines[process.env.STR305_BROWSER]] : Object.values(engines);
assert.ok(selected.every(Boolean), "STR305_BROWSER must be chromium, firefox or webkit");

function within(promise, label, ms = 20000) {
  let timeout;
  return Promise.race([promise, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms); })])
    .finally(() => clearTimeout(timeout));
}

try {
  let ready = false;
  for (let i = 0; i < 50; i += 1) {
    try { ready = (await fetch(origin)).ok; } catch { /* server not ready */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "local static build server should start");
  for (const engine of selected) {
    let phase = "launch";
    const browser = await within(engine.launch({ headless: true }), `${engine.name()} launch`);
    let primaryError;
    try {
      phase = "newPage";
      const page = await within(browser.newPage(), `${engine.name()} page creation`);
      const errors = [];
      const unexpectedRequests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (!request.url().startsWith(origin) || request.method() !== "GET" || request.postData()) unexpectedRequests.push(request.url());
      });
      phase = "navigation";
      const response = await within(page.goto(`${origin}/tools/slug-generator/`, { waitUntil: "networkidle" }), `${engine.name()} navigation`, 20000);
      assert.equal(response.status(), 200);
      const form = page.locator("form").last();
      for (const [text, expected] of cases) {
        phase = `submit ${JSON.stringify(text)}`;
        await form.locator("textarea").first().fill(text);
        await form.locator('button[type="submit"]').click();
        const result = page.locator('.result-panel[data-state="success"]');
        await result.waitFor({ timeout: 10000 });
        assert.ok((await result.innerText()).includes(expected), `${engine.name()}: ${text}`);
      }
      assert.deepEqual(errors, [], `${engine.name()}: browser page errors`);
      assert.deepEqual(unexpectedRequests, [], `${engine.name()}: requests must be local GET`);
      console.log(`PASS ${engine.name()}: 3 interactive slugs, no page errors, no egress/POST`);
      phase = "close page";
      await page.close();
    } catch (error) {
      primaryError = error;
      console.error(`FAIL ${engine.name()} during ${phase}: ${error.message}`);
      throw error;
    } finally {
      try {
        await within(browser.close(), `${engine.name()} cleanup`, 10000);
      } catch (error) {
        if (!primaryError) throw error;
        console.error(`WARN ${engine.name()} cleanup after failure: ${error.message}`);
      }
    }
  }
} finally {
  server?.kill("SIGTERM");
}

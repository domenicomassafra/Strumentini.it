/**
 * #346 actual Chromium-network acceptance against isolated 127.0.0.1 fixture.
 * Run: node tests/acceptance-privacy-events-346.mjs
 * No production telemetry endpoint, credentials, deployment, or longitudinal
 * data are involved. All requests stay on this ephemeral loopback server.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const base = resolve(root, "src/telemetry");
const script = [
  `import { configureTelemetry, getTelemetryAdapter } from ${JSON.stringify(resolve(base, "browser.ts"))};`,
  `import { createHttpTelemetryTransport } from ${JSON.stringify(resolve(base, "adapter.ts"))};`,
  `import { saveValidationTelemetryConsent } from ${JSON.stringify(resolve(base, "consent.ts"))};`,
  `import { trackToolCompleted, trackToolFailed } from ${JSON.stringify(resolve(base, "events.ts"))};`,
  "const consent = document.querySelector('#grant');",
  "const disclosure = document.querySelector('#disclosure');",
  "const transport = createHttpTelemetryTransport('/local-telemetry-sink');",
  "function getStore() { try { return localStorage; } catch { return null; } }",
  "function refresh() {",
  "  configureTelemetry({ enabled: true, disclosed: true, cohort: 'validation', transport, now: () => '2026-10-11T19:12:41.000Z' });",
  "  disclosure.dataset.telemetryActive = consent.checked ? 'true' : 'false';",
  "}",
  "consent.addEventListener('change', () => { saveValidationTelemetryConsent(getStore(), consent.checked); refresh(); });",
  "document.querySelector('#success').addEventListener('click', () => {",
  "  trackToolCompleted(getTelemetryAdapter(), 'pdf-rotate', 650, 'document', {subjectId:'private-operator'});",
  "});",
  "document.querySelector('#error').addEventListener('click', () => {",
  "  trackToolFailed(getTelemetryAdapter(), 'pdf-rotate', 'invalid-input', 'document', {subjectId:'private-operator'});",
  "});",
  "refresh();",
].join("\n");

const bundled = await build({
  stdin: { contents: script, resolveDir: root, sourcefile: "privacy-events-346-fixture.ts", loader: "ts" },
  bundle: true, format: "esm", platform: "browser", target: "es2022", write: false, logLevel: "silent",
});
const bundle = bundled.outputFiles[0].text;
let loggedIn = false;
let authChecks = 0;
const payloads = [];
const forbidden = /pdf-rotate|private-operator|filename|file_name|fingerprint|subject_id|tool_id|raw_input|raw_output|2026-10-11T19:12:41/iu;
const html = `<!doctype html><html lang="it"><meta charset="utf-8"><title>Privacy telemetry 346 local browser fixture</title>
<details id="disclosure" open><summary>Privacy e telemetria di validazione</summary>
<p>Disattivata per impostazione predefinita. Consenti eventi tecnici anonimi di esito e revoca quando vuoi.</p>
<label><input id="grant" type="checkbox">Consento eventi tecnici di validazione anonimi</label></details>
<button id="success">Simulate successful tool run</button>
<button id="error">Simulate failed tool run</button>
<script type="module" src="/privacy-fixture.js"></script></html>`;
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(html);
    return;
  }
  if (req.method === "GET" && url.pathname === "/privacy-fixture.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    res.end(bundle);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/auth/session") {
    authChecks++;
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ user: loggedIn ? { id: "fixture-user-id" } : null }));
    return;
  }
  if (req.method === "POST" && url.pathname === "/local-telemetry-sink") {
    let input = "";
    for await (const chunk of req) {
      input += chunk.toString();
      if (input.length > 2048) {
        res.writeHead(413);
        res.end();
        return;
      }
    }
    payloads.push({ body: JSON.parse(input), headers: req.headers, path: url.pathname });
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(404);
  res.end();
});
let browser;
try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const outgoing = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/local-telemetry-sink") {
      outgoing.push({ method: request.method(), url: request.url(), body: request.postData() });
    }
  });
  page.on("request", (request) => {
    assert(request.url().startsWith(origin + "/"), "unexpected remote request: " + request.url());
  });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(origin + "/", { waitUntil: "networkidle" });
  assert.equal(await page.locator("#disclosure").getAttribute("open"), "");
  assert.equal(await page.locator("#grant").isChecked(), false);
  await page.locator("#success").click();
  await page.locator("#error").click();
  assert.equal(payloads.length, 0, "default-off browser sent an event");
  assert.equal(authChecks, 0, "default-off browser must not probe auth for telemetry");

  await page.locator("#grant").check();
  await page.locator("#success").click();
  await page.waitForFunction(() => performance.getEntriesByType("resource").some((r) => r.name.includes("/api/auth/session")));
  assert.equal(payloads.length, 0, "unauthenticated browser sent an event");

  loggedIn = true;
  await page.locator("#success").click();
  await page.locator("#error").click();
  await page.waitForFunction(() => performance.getEntriesByType("resource").filter((r) => r.name.includes("/local-telemetry-sink")).length >= 2);
  assert.equal(payloads.length, 2, "only authenticated, consented successes/errors should send");
  assert.deepEqual(payloads.map((item) => item.body), [
    {
      event: "validation_operation_result",
      properties: { outcome: "success", duration_bucket: "100ms-to-1s", tool_family: "document" },
      occurred_at: "2026-10-11T00:00:00.000Z",
      cohort: "validation",
    },
    {
      event: "validation_operation_result",
      properties: { outcome: "error", error_code: "invalid-input", tool_family: "document" },
      occurred_at: "2026-10-11T00:00:00.000Z",
      cohort: "validation",
    },
  ]);
  assert(payloads.every(({ headers, path }) => headers.cookie === undefined && path === "/local-telemetry-sink"));
  assert(outgoing.every(({ method, url, body }) => method === "POST" && url.startsWith(origin) && !forbidden.test(body ?? "")));
  assert(!forbidden.test(JSON.stringify(payloads.map(({ body }) => body))), "sensitive identifier/value in payload");

  await page.locator("#grant").uncheck();
  const priorCount = authChecks;
  await page.locator("#success").click();
  await page.locator("#error").click();
  assert.equal(payloads.length, 2, "rejected consent did not suppress network");
  assert.equal(authChecks, priorCount, "revoked consent should not check auth");
  await page.locator("#grant").check();
  loggedIn = false;
  await page.locator("#success").click();
  await page.waitForFunction((prior) => performance.getEntriesByType("resource").filter((r) => r.name.includes("/api/auth/session")).length > prior,
    await page.evaluate(() => performance.getEntriesByType("resource").filter((r) => r.name.includes("/api/auth/session")).length - 1));
  assert.equal(payloads.length, 2, "logout did not suppress network");

  const privateContext = await browser.newContext();
  await privateContext.addInitScript(() => Object.defineProperty(window, "localStorage", { get: () => { throw Error("blocked"); } }));
  const privatePage = await privateContext.newPage();
  await privatePage.goto(origin + "/", { waitUntil: "networkidle" });
  await privatePage.locator("#grant").check();
  await privatePage.locator("#success").click();
  assert.equal(payloads.length, 2, "denied storage bypassed opt-in");
  assert.deepEqual(pageErrors, [], "browser script error");
  await privateContext.close();
  await context.close();
  console.log("#346 browser PASS: default off, disclosed grant, signed-out denial, authenticated success/error POST inspection, revoke, logout, storage denial, zero production requests");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

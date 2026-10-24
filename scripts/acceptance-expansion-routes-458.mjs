/**
 * Compiled consumer smoke for the *delta* from original-200, not Gold.
 * Checks actual route response, public runtime declaration and initial
 * network locality without claiming positive/refusal/file/physical coverage.
 */
import { chromium } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const parts = (await readdir(resolve(root, "quality/expansion-458")))
  .filter((filename) => /^routes-\d{2}\.jsonl$/u.test(filename)).sort();
if (!parts.length) throw new Error("MATRIX_458_MISSING");
const rows = (await Promise.all(parts.map((part) => readFile(resolve(root, "quality/expansion-458", part), "utf8"))))
  .flatMap((text) => text.trim().split("\n").map((line) => JSON.parse(line)));
if (rows.length === 0 || new Set(rows.map((row) => row.id)).size !== rows.length)
  throw new Error("MATRIX_458_IDENTITY_INVALID");

const port = 18458;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root, stdio: "ignore",
});
let browser;
try {
  let started = false;
  for (let attempt = 0; attempt < 35; attempt++) {
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(400) });
      if (response.ok) { started = true; break; }
    } catch { /* server not up */ }
    await new Promise((done) => setTimeout(done, 150));
  }
  if (!started) throw new Error("COMPILED_458_SERVER_UNAVAILABLE");
  browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const failures = [];
  for (const row of rows) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    page.on("request", (request) => {
      if (!request.url().startsWith(origin) || !["GET", "HEAD"].includes(request.method())) {
        requests.push({ method: request.method(), urlOrigin: (() => { try { return new URL(request.url()).origin; } catch { return "unknown"; } })() });
      }
    });
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const response = await page.goto(`${origin}${row.route}/`, { waitUntil: "networkidle", timeout: 20000 });
      if (response?.status() !== 200) throw new Error(`HTTP_${response?.status()}`);
      if (await page.locator(`[data-tool-page="${row.id}"]`).count() === 0)
        throw new Error("TOOL_COMPONENT_MISSING");
      const runtime = await page.locator(`[data-tool-page="${row.id}"]`).first().getAttribute("data-runtime");
      const network = await page.locator(`[data-tool-page="${row.id}"]`).first().getAttribute("data-network");
      if (runtime !== row.runtime.location || network !== row.runtime.network)
        throw new Error(`RUNTIME_DECLARATION_DRIFT:${runtime}:${network}`);
      if (await page.getByRole("heading", { level: 1 }).count() === 0)
        throw new Error("HEADING_MISSING");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      if (overflow) throw new Error("MOBILE_OVERFLOW");
      if (requests.length) throw new Error(`UNEXPECTED_REQUESTS_${JSON.stringify(requests)}`);
      if (errors.length) throw new Error(`PAGE_ERRORS_${JSON.stringify(errors)}`);
    } catch (error) {
      failures.push({ id: row.id, reason: error instanceof Error ? error.message : String(error) });
    } finally { await context.close(); }
  }
  console.log(JSON.stringify({ audited: rows.length, compiledRouteAndInitialNetwork: rows.length - failures.length,
    failures, operationPositive: "NOT_RUN", operationRefusal: "NOT_RUN",
    physical: "NOT_RUN", release: "NO_GO" }));
  if (failures.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

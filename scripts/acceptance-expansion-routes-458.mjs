/**
 * Compiled consumer smoke for the *delta* from original-200, not Gold.
 * Checks actual route response, public runtime declaration and initial
 * network locality without claiming positive/refusal/file/physical coverage.
 */
import { chromium } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
// Refuse stale or extra matrix parts before serving a compiled consumer.
execFileSync("python3", ["-B", "scripts/audit-expansion-routes-458.py", "--check"], { cwd: root });
const parts = (await readdir(resolve(root, "quality/expansion-458")))
  .filter((filename) => /^routes-\d{2}\.jsonl$/u.test(filename)).sort();
if (!parts.length) throw new Error("MATRIX_458_MISSING");
const rows = (await Promise.all(parts.map((part) => readFile(resolve(root, "quality/expansion-458", part), "utf8"))))
  .flatMap((text) => text.trim().split("\n").map((line) => JSON.parse(line)));
if (rows.length === 0 || new Set(rows.map((row) => row.id)).size !== rows.length)
  throw new Error("MATRIX_458_IDENTITY_INVALID");

const port = await new Promise((done, fail) => {
  const reservation = createServer();
  reservation.once("error", fail);
  reservation.listen(0, "127.0.0.1", () => {
    const address = reservation.address();
    reservation.close(() => done(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root, stdio: "ignore",
});
let serverExited = false;
server.on("exit", () => { serverExited = true; });
let browser;
try {
  let started = false;
  for (let attempt = 0; attempt < 35; attempt++) {
    if (serverExited) throw new Error("COMPILED_458_SERVER_EXITED");
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
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if ((url.origin !== origin && !["blob:", "data:"].includes(url.protocol))
        || !["GET", "HEAD"].includes(request.method())) {
        requests.push({ method: request.method(), urlOrigin: url.origin });
        await route.abort();
      } else {
        await route.continue();
      }
    });
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const response = await page.goto(`${origin}${row.route}/`, { waitUntil: "networkidle", timeout: 20000 });
      if (response?.status() !== 200) throw new Error(`HTTP_${response?.status()}`);
      const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
      // Independent readback: reopen the built file and compare it with the
      // actual HTTP response, both bound to the audited matrix row.
      const compiledPath = resolve(root, "dist", row.route.replace(/^\/+/, ""), "index.html");
      const compiledBytes = await readFile(compiledPath);
      const responseBytes = await response.body();
      if (!row.compiled.routeSha256 || digest(compiledBytes) !== row.compiled.routeSha256
        || digest(responseBytes) !== row.compiled.routeSha256)
        throw new Error("COMPILED_HTTP_BYTES_DRIFT");
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
    independentCompiledHttpByteReadback: rows.length - failures.length,
    failures, operationPositive: "NOT_RUN", operationRefusal: "NOT_RUN",
    physical: "NOT_RUN", release: "NO_GO" }));
  if (failures.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

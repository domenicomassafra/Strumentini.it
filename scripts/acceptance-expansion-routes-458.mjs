/**
 * Compiled consumer acceptance for the catalog delta from original-200.
 * HTTP-only verifies distribution bytes; browser mode additionally verifies
 * DOM, runtime declarations, network locality and mobile overflow.
 * Neither mode claims positive/refusal operations, exports or Gold.
 */
import { chromium } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
execFileSync("python3", ["-B", "scripts/audit-expansion-routes-458.py", "--check"], { cwd: root });
const parts = (await readdir(resolve(root, "quality/expansion-458")))
  .filter((filename) => /^routes-\d{2}\.jsonl$/u.test(filename)).sort();
if (!parts.length) throw new Error("MATRIX_458_MISSING");
const rows = (await Promise.all(parts.map((part) => readFile(resolve(root, "quality/expansion-458", part), "utf8"))))
  .flatMap((text) => text.trim().split("\n").map((line) => JSON.parse(line)));
if (rows.length === 0 || new Set(rows.map((row) => row.id)).size !== rows.length)
  throw new Error("MATRIX_458_IDENTITY_INVALID");

const httpOnly = process.argv.includes("--http-only");
if (process.argv.some((arg) => arg.startsWith("--") && arg !== "--http-only"))
  throw new Error("EXPANSION_458_UNKNOWN_ARGUMENT");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
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

async function compareCompiledBytes(row, responseBytes) {
  const compiledPath = resolve(root, "dist", row.route.replace(/^\/+/, ""), "index.html");
  const compiledBytes = await readFile(compiledPath);
  if (!row.compiled.routeSha256 || digest(compiledBytes) !== row.compiled.routeSha256
    || digest(responseBytes) !== row.compiled.routeSha256)
    throw new Error("COMPILED_HTTP_BYTES_DRIFT");
}

async function verifyBrowserRoute(context, row) {
  const page = await context.newPage();
  const blocked = [];
  const errors = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if ((url.origin !== origin && !["blob:", "data:"].includes(url.protocol))
      || !["GET", "HEAD"].includes(request.method())) {
      blocked.push({ method: request.method(), urlOrigin: url.origin });
      await route.abort();
    } else {
      await route.continue();
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const response = await page.goto(`${origin}${row.route}/`, { waitUntil: "networkidle", timeout: 20000 });
    if (response?.status() !== 200) throw new Error(`HTTP_${response?.status()}`);
    await compareCompiledBytes(row, await response.body());
    const tool = page.locator(`[data-tool-page="${row.id}"]`).first();
    if (await tool.count() === 0) throw new Error("TOOL_COMPONENT_MISSING");
    const runtime = await tool.getAttribute("data-runtime");
    const network = await tool.getAttribute("data-network");
    if (runtime !== row.runtime.location || network !== row.runtime.network)
      throw new Error(`RUNTIME_DECLARATION_DRIFT:${runtime}:${network}`);
    if (await page.getByRole("heading", { level: 1 }).count() === 0)
      throw new Error("HEADING_MISSING");
    if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth))
      throw new Error("MOBILE_OVERFLOW");
    if (blocked.length) throw new Error(`UNEXPECTED_REQUESTS_${JSON.stringify(blocked)}`);
    if (errors.length) throw new Error(`PAGE_ERRORS_${JSON.stringify(errors)}`);
  } finally {
    await page.close();
  }
}

try {
  let started = false;
  for (let attempt = 0; attempt < 35; attempt++) {
    if (serverExited) throw new Error("COMPILED_458_SERVER_EXITED");
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(400) });
      if (response.ok) { started = true; break; }
    } catch { /* Local server not ready. */ }
    await new Promise((done) => setTimeout(done, 150));
  }
  if (!started) throw new Error("COMPILED_458_SERVER_UNAVAILABLE");
  const failures = [];
  let checked = 0;
  if (httpOnly) {
    for (const row of rows) {
      try {
        const response = await fetch(`${origin}${row.route}/`, { signal: AbortSignal.timeout(8000) });
        if (response.status !== 200) throw new Error(`HTTP_${response.status}`);
        await compareCompiledBytes(row, Buffer.from(await response.arrayBuffer()));
        checked++;
      } catch (error) {
        failures.push({ id: row.id, reason: String(error) });
      }
    }
  } else {
    // Reuse the existing dedicated Studio Chrome; never create a new profile.
    try {
      browser = await chromium.connectOverCDP(process.env.STRUMENTINI_ACCEPTANCE_CDP
        ?? "http://127.0.0.1:17630", { timeout: 15000 });
    } catch (error) {
      failures.push({ id: "AUTOMATION_BROWSER_CONNECTION", reason: String(error) });
    }
    if (browser) {
      const context = browser.contexts()[0];
      if (!context) throw new Error("AUTOMATION_BROWSER_CONTEXT_UNAVAILABLE");
      for (const row of rows) {
        try { await verifyBrowserRoute(context, row); checked++; }
        catch (error) { failures.push({ id: row.id, reason: String(error) }); }
      }
    }
  }
  console.log(JSON.stringify({
    audited: rows.length,
    compiledHttpByteReadback: httpOnly ? checked : "NOT_RUN",
    compiledBrowserAndInitialNetwork: httpOnly ? "NOT_RUN" : checked,
    browserNotRun: httpOnly ? rows.length : browser ? 0 : rows.length,
    failures,
    operationPositive: "NOT_RUN", operationRefusal: "NOT_RUN",
    exportedFileReadback: "NOT_RUN", physical: "NOT_RUN", release: "NO_GO",
  }));
  if (failures.length || checked !== rows.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

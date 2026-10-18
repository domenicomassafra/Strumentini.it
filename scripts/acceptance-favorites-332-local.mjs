/**
 * #332 real local Worker/D1 acceptance. No HTTP responses are mocked: two
 * separate Chromium processes authenticate over the loopback Worker endpoint.
 * On localhost with no TURNSTILE_SECRET the normal dev-only auth path omits
 * Turnstile. This is NOT a Cloudflare-hosted or production auth acceptance.
 *
 * Run after `npm run build`:
 *   node scripts/acceptance-favorites-332-local.mjs
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const browserExecutable = process.env.STRUMENTINI_CHROME_EXECUTABLE
  ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : chromium.executablePath());
const wrangler = join(root, "node_modules", ".bin", "wrangler");
const state = { child: null, browsers: [], temporary: null };
let checks = 0;
let port;
let origin;
const log = [];
const pass = (description) => { checks++; console.log(`PASS ${description}`); };
const allowed = (request) => {
  const url = new URL(request.url());
  assert.equal(url.origin, origin, `Unexpected external request ${url.origin}`);
};

function capture(stream) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    log.push(chunk);
    if (log.length > 80) log.shift();
  });
}

async function command(args) {
  return await new Promise((done, reject) => {
    const child = spawn(wrangler, args, { cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => { output += chunk; });
    }
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? done(output) : reject(new Error(`Wrangler command failed (${code}): ${output.slice(-1800)}`)));
  });
}

async function startWorker() {
  state.child = spawn(wrangler, ["dev", "--local", "--ip", "127.0.0.1", "--port", String(port),
    "--persist-to", state.temporary, "--local-upstream", "127.0.0.1"], {
    cwd: root, detached: true, env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG: "warn" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  capture(state.child.stdout);
  capture(state.child.stderr);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (state.child.exitCode !== null) throw new Error(`Local Worker exited early (${state.child.exitCode})`);
    try {
      const response = await fetch(`${origin}/api/auth/session`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).user === null) return;
    } catch { /* Startup */ }
    await sleep(350);
  }
  throw new Error("Local Worker did not become ready");
}

async function sql(commandText) {
  const output = await command(["d1", "execute", "AUTH_DB", "--local", "--persist-to", state.temporary,
    "--json", "--command", commandText]);
  const result = JSON.parse(output.trim());
  assert.equal(result[0]?.success, true);
  return result[0].results;
}

async function snapshot(page) {
  return await page.evaluate(async () => {
    const response = await fetch("/api/favorites/sync", { credentials: "same-origin", headers: { accept: "application/json" } });
    if (response.status !== 200) throw new Error(`Favorite snapshot HTTP ${response.status}`);
    return await response.json();
  });
}

async function authenticated(page) {
  return await page.evaluate(async () => {
    const response = await fetch("/api/auth/session", { credentials: "same-origin" });
    return { status: response.status, hasUser: Boolean((await response.json()).user) };
  });
}

async function main() {
  assert.ok(existsSync(join(root, "dist", "strumenti", "index.html")), "Build dist/ first");
  assert.ok(existsSync(browserExecutable), "Supply STRUMENTINI_CHROME_EXECUTABLE");
  state.temporary = await mkdtemp(join(tmpdir(), "strumentini-332-local-"));
  // OS assigns a free loopback port. No production Worker, DB, or route used.
  const { createServer } = await import("node:net");
  port = await new Promise((done, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close(() => done(value)); });
  });
  origin = `http://127.0.0.1:${port}`;
  const migrationOutput = await command(["d1", "migrations", "apply", "AUTH_DB", "--local", "--persist-to", state.temporary]);
  assert.match(migrationOutput, /0004_favorite_operation_ids.sql/);
  const migrationRows = await sql("SELECT name FROM d1_migrations ORDER BY id");
  assert.ok(migrationRows.some((row) => row.name === "0004_favorite_operation_ids.sql"));
  pass("local D1 migrations 0001–0004 (real SQLite)");
  await startWorker();

  const originCheck = await fetch(`${origin}/strumenti/`);
  const favoritesCheck = await fetch(`${origin}/preferiti/`);
  const absentCheck = await fetch(`${origin}/api/favorites/sync`);
  const missingAsset = await fetch(`${origin}/definitely-missing-332/`);
  assert.deepEqual([originCheck.status, favoritesCheck.status, absentCheck.status, missingAsset.status], [200, 200, 401, 404]);
  assert.match(originCheck.headers.get("content-type") ?? "", /text\/html/);
  assert.match(absentCheck.headers.get("content-type") ?? "", /application\/json/);
  pass("static ASSETS delegation and /api/** Worker routing");

  for (let i = 0; i < 2; i++) state.browsers.push(await chromium.launch({ headless: true, executablePath: browserExecutable }));
  const aContext = await state.browsers[0].newContext({ serviceWorkers: "block" });
  const bContext = await state.browsers[1].newContext({ serviceWorkers: "block" });
  const a = await aContext.newPage();
  const b = await bContext.newPage();
  const errors = [];
  for (const [name, page] of [["A", a], ["B", b]]) {
    page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
    page.on("request", allowed);
  }
  const observed = [];
  for (const [name, page] of [["A", a], ["B", b]]) {
    page.on("response", (response) => {
      if (response.url() === `${origin}/api/favorites/sync` && response.request().method() === "POST") {
        observed.push({ browser: name, status: response.status() });
      }
    });
  }

  const user = { name: "Local QA 332", email: `qa-332-${randomUUID()}@example.test`,
    password: randomBytes(28).toString("base64url") };
  // APIRequestContext is bound to each browser's separate cookie jar. Register
  // through A, independently login through B; never copy a session or cookie.
  const registered = await aContext.request.post(`${origin}/api/auth/register`, { data: user });
  assert.equal(registered.status(), 201, "Real registration through localhost Worker");
  const signedInB = await bContext.request.post(`${origin}/api/auth/login`, {
    data: { email: user.email, password: user.password },
  });
  assert.equal(signedInB.status(), 200, "Real independent password login through Worker");
  await Promise.all([a.goto(`${origin}/strumenti/`), b.goto(`${origin}/strumenti/`)]);
  assert.deepEqual(await authenticated(a), { status: 200, hasUser: true });
  assert.deepEqual(await authenticated(b), { status: 200, hasUser: true });
  const sessions = await sql("SELECT COUNT(*) AS n, COUNT(DISTINCT token_hash) AS distinct_sessions FROM sessions");
  assert.deepEqual([sessions[0].n, sessions[0].distinct_sessions], [2, 2]);
  pass("2 separate Chromium OS processes, 2 real sessions and 2 D1 session hashes");

  const tool = await a.locator("button[data-membership-toggle]:visible").first().getAttribute("data-membership-toggle");
  assert.ok(tool, "Built catalog must expose an actual visible favorite control");
  const locator = (page, id = tool) => page.locator(`button[data-membership-toggle="${id}"]`).first();
  const aTool = locator(a);
  const bTool = locator(b);
  await expect(aTool).toBeEnabled();
  await expect(bTool).toBeEnabled();
  await aTool.click();
  await expect.poll(async () => (await snapshot(a)).tools.includes(tool)).toBe(true);
  assert.ok(observed.some((response) => response.browser === "A" && response.status === 200), "UI add must produce a real Worker POST");
  const afterAdd = await snapshot(a);
  await b.reload({ waitUntil: "domcontentloaded" });
  await expect(bTool).toHaveAttribute("aria-pressed", "true");
  pass("A real UI add -> Worker POST/D1 -> B UI convergence");

  await b.goto(`${origin}/preferiti/`, { waitUntil: "domcontentloaded" });
  const remove = locator(b);
  await expect(remove).toHaveAttribute("aria-pressed", "true");
  await remove.click();
  await expect.poll(async () => (await snapshot(b)).tools.includes(tool)).toBe(false);
  assert.ok(observed.some((response) => response.browser === "B" && response.status === 200), "UI remove must produce a real Worker POST");
  await a.reload({ waitUntil: "domcontentloaded" });
  await expect(aTool).toHaveAttribute("aria-pressed", "false");
  const removed = await snapshot(b);
  assert.ok(removed.entries.find((entry) => entry.toolId === tool && !entry.installed && entry.operationId));
  pass("B real UI remove -> Worker POST/D1 tombstone -> A UI convergence");

  const stale = await b.evaluate(async ({ toolId, baseRevision, account }) => {
    const response = await fetch("/api/favorites/sync", { method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ toolId, installed: true, baseRevision, expectedAccount: account, operationId: crypto.randomUUID() }),
    });
    return { status: response.status, body: await response.json() };
  }, { toolId: tool, baseRevision: afterAdd.revision, account: removed.account });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.applied, false);
  assert.equal(stale.body.entries.find((entry) => entry.toolId === tool).installed, false);
  pass("real stale CAS POST HTTP409 with authoritative tombstone");

  await b.goto(`${origin}/strumenti/`, { waitUntil: "domcontentloaded" });
  await expect(bTool).toBeEnabled();
  await bContext.setOffline(true);
  await bTool.click();
  await expect(bTool).toHaveAttribute("aria-pressed", "true");
  const beforeRace = removed.revision;
  // A writes newer versions of the same tool while B's re-add is offline.
  await aTool.click();
  await expect.poll(async () => (await snapshot(a)).tools.includes(tool)).toBe(true);
  await aTool.click();
  await expect.poll(async () => (await snapshot(a)).tools.includes(tool)).toBe(false);
  const tombstone = await snapshot(a);
  assert.ok(tombstone.revision > beforeRace);
  assert.equal(observed.filter((response) => response.browser === "A" && response.status === 200).length, 3,
    "A's UI add/removal sequence must have three successful Worker POSTs");
  const beforeReconnect = observed.length;
  await bContext.setOffline(false);
  await b.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(bTool).toHaveAttribute("aria-pressed", "false", { timeout: 15_000 });
  assert.equal((await snapshot(b)).entries.find((entry) => entry.toolId === tool).revision,
    tombstone.entries.find((entry) => entry.toolId === tool).revision);
  assert.equal((await snapshot(b)).tools.includes(tool), false);
  assert.equal((await snapshot(b)).revision, tombstone.revision);
  assert.equal(observed.length, beforeReconnect, "No stale mutation sent after tombstone");
  pass("real offline B intent loses to A's newer tombstone after reconnect");

  const otherTool = await b.locator("button[data-membership-toggle]:visible").nth(1).getAttribute("data-membership-toggle");
  assert.ok(otherTool && otherTool !== tool);
  const otherButton = locator(b, otherTool);
  await expect(otherButton).toBeEnabled();
  await bContext.setOffline(true);
  await otherButton.click();
  await expect(otherButton).toHaveAttribute("aria-pressed", "true");
  await bContext.setOffline(false);
  await b.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await snapshot(b)).tools.includes(otherTool), { timeout: 15_000 }).toBe(true);
  assert.equal(observed.filter((response) => response.browser === "B" && response.status === 200).length, 2,
    "B's online replay must create one additional real Worker POST");
  await a.reload({ waitUntil: "domcontentloaded" });
  await expect(locator(a, otherTool)).toHaveAttribute("aria-pressed", "true");
  pass("real offline B addition is replayed online and converges to A");

  const d1Rows = await sql("SELECT tool_id, installed, revision, operation_id FROM favorite_sync_state ORDER BY revision DESC");
  const deleted = d1Rows.find((row) => row.tool_id === tool);
  const installed = d1Rows.find((row) => row.tool_id === otherTool);
  assert.ok(deleted && deleted.installed === 0 && deleted.operation_id);
  assert.ok(installed && installed.installed === 1 && installed.operation_id);
  const eventCount = await sql("SELECT COUNT(*) AS n FROM favorite_sync_events");
  assert.ok(eventCount[0].n >= 5);
  assert.deepEqual(errors, []);
  pass("actual local D1 tombstone and installed rows; no uncaught browser errors");
  console.log(JSON.stringify({ kind: "#332-local-worker-d1-two-browsers", result: "PASS", checks,
    browserProcesses: 2, distinctAuthenticatedSessions: sessions[0].distinct_sessions,
    backend: "actual wrangler dev + locally migrated D1 (0001–0004)", servedPages: ["/strumenti/", "/preferiti/"],
    responses: observed, d1: { events: eventCount[0].n, tombstone: { installed: deleted.installed, revision: deleted.revision },
      replayed: { installed: installed.installed, revision: installed.revision } },
    limits: "localhost developer auth skips Turnstile without secret; no remote Cloudflare or production acceptance" }));
}

async function cleanup() {
  for (const browser of state.browsers) await browser.close().catch(() => undefined);
  if (state.child?.pid) {
    try { process.kill(-state.child.pid, "SIGTERM"); } catch { /* already stopped */ }
    await sleep(800);
    try { process.kill(-state.child.pid, "SIGKILL"); } catch { /* already stopped */ }
  }
  if (state.temporary) await rm(state.temporary, { recursive: true, force: true });
}

let cleaned = false;
async function terminate(code, error) {
  if (cleaned) return;
  cleaned = true;
  if (error) console.error(`FAIL #332 real local D1/browser acceptance: ${error.message}`);
  await cleanup();
  process.exitCode = code;
}
for (const [signal, status] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.on(signal, () => void terminate(status));
}
try { await main(); await terminate(0); } catch (error) { await terminate(1, error); }

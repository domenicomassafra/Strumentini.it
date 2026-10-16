/** #332: two real isolated Chromium processes exercising catalog and favorites
 * against a deterministic account-bound HTTP fixture. Not a cloud deployment
 * or proof of two authenticated hosted sessions.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";

const originPort = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") return reject(new Error("No port"));
    server.close(() => resolve(address.port));
  });
});
const origin = `http://127.0.0.1:${originPort}`;
const server = spawn("python3", ["-m", "http.server", String(originPort), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: process.cwd(), stdio: "ignore",
});
const browsers = [];

let revision = 0;
const tools = new Map();
const writes = [];
const blockedEgress = [];
let offline = false;
const account = "browser-fixture-account";
const snapshot = () => ({
  version: 1, account, revision,
  entries: [...tools.values()].sort((a, b) => b.revision - a.revision),
  tools: [...tools.values()].filter((entry) => entry.installed).map((entry) => entry.toolId),
});
function apply(toolId, installed, operationId) {
  const entry = { toolId, installed, revision: ++revision, ...(operationId ? { operationId } : {}) };
  tools.set(toolId, entry);
  writes.push(entry);
}

async function context(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  // Fail closed: neither third-party scripts nor ambient host/browser auth
  // may supply a hidden consumer. The following two API routes are fixtures;
  // every other request must stay on this exact ephemeral local origin.
  await ctx.route("**/*", (route) => {
    const url = route.request().url();
    if (new URL(url).origin === origin) return route.continue();
    blockedEgress.push(url);
    return route.abort("blockedbyclient");
  });
  await ctx.route("**/api/auth/session", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ user: { email: "browser@example.test" } }),
  }));
  await ctx.route("**/api/favorites/sync", async (route) => {
    if (offline && ctx === offlineContext) return route.abort("internetdisconnected");
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      if (body.expectedAccount !== account) return route.fulfill({ status: 409, contentType: "application/json", body: '{"error":"Account changed"}' });
      const current = tools.get(body.toolId);
      if ((current?.revision ?? 0) > body.baseRevision || current?.operationId === body.operationId) {
        return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify(snapshot()) });
      }
      apply(body.toolId, body.installed, body.operationId);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...snapshot(), applied: true, appliedRevision: revision }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot()) });
  });
  return ctx;
}
let offlineContext;

try {
  for (let tries = 0; tries < 80; tries++) {
    try { if ((await fetch(`${origin}/strumenti/`, { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* startup */ }
    if (tries === 79) throw new Error("Static server unavailable");
    await sleep(180);
  }
  const first = await chromium.launch({ headless: true });
  const second = await chromium.launch({ headless: true });
  browsers.push(first, second);
  const ctxA = await context(first);
  const ctxB = await context(second);
  offlineContext = ctxB;
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const errors = [];
  a.on("pageerror", (error) => errors.push(`A: ${error.message}`));
  b.on("pageerror", (error) => errors.push(`B: ${error.message}`));

  assert.equal((await a.goto(`${origin}/strumenti/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
  assert.equal((await b.goto(`${origin}/strumenti/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
  const btnA = a.locator("button[data-membership-toggle]:visible").first();
  await expect(btnA).toHaveAttribute("aria-pressed", "false");
  const toolId = await btnA.getAttribute("data-membership-toggle");
  assert.ok(toolId, "The actual catalog must expose a favorite button");
  const btnB = b.locator(`button[data-membership-toggle="${toolId}"]`);
  await expect(btnB).toHaveAttribute("aria-pressed", "false");

  await btnA.click();
  await expect.poll(() => snapshot().tools.includes(toolId)).toBe(true);
  await b.reload({ waitUntil: "domcontentloaded" });
  await expect(btnB).toHaveAttribute("aria-pressed", "true");
  assert.equal((await b.goto(`${origin}/preferiti/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
  const removeButton = b.locator(`button[data-membership-toggle="${toolId}"]`);
  await expect(removeButton).toBeVisible();
  await expect(removeButton).toHaveAttribute("aria-pressed", "true");
  assert.equal(await removeButton.evaluate((button) => getComputedStyle(button.closest(".tool-card").querySelector(".tool-card-name a"), "::after").content), "none",
    "Remove must be clickable separately from the card's stretched title link");
  await removeButton.click({ timeout: 7000 });
  await expect.poll(() => snapshot().tools.includes(toolId)).toBe(false);
  await a.reload({ waitUntil: "domcontentloaded" });
  await expect(btnA).toHaveAttribute("aria-pressed", "false");

  await b.goto(`${origin}/strumenti/`, { waitUntil: "domcontentloaded" });
  await expect(btnB).toHaveAttribute("aria-pressed", "false");
  offline = true;
  await btnB.click();
  await expect(btnB).toHaveAttribute("aria-pressed", "true");
  assert.equal(snapshot().tools.includes(toolId), false);
  apply(toolId, true);
  apply(toolId, false); // A's newer tombstone must beat B's offline re-add.
  const before = writes.length;
  offline = false;
  await b.reload({ waitUntil: "domcontentloaded" });
  await expect(btnB).toHaveAttribute("aria-pressed", "false");
  assert.equal(writes.length, before, "Stale browser must not resurrect an independently deleted item");
  assert.equal(snapshot().tools.includes(toolId), false);
  assert.deepEqual(errors, [], "No uncaught browser errors");
  assert.deepEqual(blockedEgress, [], "No page attempted third-party network egress");
  console.log(JSON.stringify({ kind: "#332-real-chromium-isolated-processes", page: "/strumenti/ and /preferiti/",
    source: "current compiled dist", browserProcesses: 2, accountBackend: "deterministic fixture", toolId,
    checks: ["add/converge", "remove/converge", "offline-newer-tombstone", "zero-pageerrors", "zero-external-requests"],
    result: "PASS", actualAuthenticatedStaging: "NOT_RUN" }));
} finally {
  for (const browser of browsers) await browser.close().catch(() => undefined);
  server.kill("SIGTERM");
}

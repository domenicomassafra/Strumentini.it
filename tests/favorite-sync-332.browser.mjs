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
let holdNextAuth = false;
let releaseAuth;
let guestContext;
let offlineAuthContext;
let raceAuthContext;
let raceAuthCalls = 0;
const raceAuthRelease = [];
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
  await ctx.route("**/api/auth/session", async (route) => {
    if (ctx === raceAuthContext && ++raceAuthCalls <= 2) {
      await new Promise((resolve) => raceAuthRelease.push(resolve));
      return route.abort("internetdisconnected");
    }
    if (ctx === offlineAuthContext) {
      return route.abort("internetdisconnected");
    }
    if (holdNextAuth && ctx === deferredContext) {
      holdNextAuth = false;
      await new Promise((resolve) => { releaseAuth = resolve; });
    }
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ user: ctx === guestContext ? null : { email: "browser@example.test" } }) });
  });
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
let deferredContext;

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
  deferredContext = ctxA;
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
  await expect(btnA).toBeEnabled();
  assert.ok((await btnA.boundingBox()).width >= 44 && (await btnA.boundingBox()).height >= 44,
    "Catalog heart must meet the 44px touch target");
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
  assert.ok((await removeButton.boundingBox()).width >= 44 && (await removeButton.boundingBox()).height >= 44,
    "Remove button must meet the 44px touch target");
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
  // A clicked control must not race the initial account/session read. Hold the
  // actual auth HTTP response, verify disabled UI, then release and click.
  holdNextAuth = true;
  const authRequest = a.waitForRequest((request) => request.url().endsWith("/api/auth/session"));
  await a.reload({ waitUntil: "domcontentloaded" });
  await authRequest;
  await expect(btnA).toBeDisabled();
  const beforeAuthRelease = writes.length;
  await expect.poll(() => typeof releaseAuth).toBe("function");
  assert.equal(writes.length, beforeAuthRelease);
  releaseAuth();
  await expect(btnA).toBeEnabled();
  await btnA.click();
  await expect.poll(() => snapshot().tools.includes(toolId)).toBe(true);
  assert.equal(writes.length, beforeAuthRelease + 1);

  // After a reconnect event, replay a distinct tool's offline intent using
  // its unchanged baseline; no artificial page reload is required.
  const nextButton = b.locator("button[data-membership-toggle]:visible").nth(1);
  const anotherId = await nextButton.getAttribute("data-membership-toggle");
  assert.ok(anotherId && anotherId !== toolId);
  offline = true;
  await nextButton.click();
  await expect(nextButton).toHaveAttribute("aria-pressed", "true");
  assert.equal(snapshot().tools.includes(anotherId), false);
  offline = false;
  await b.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => snapshot().tools.includes(anotherId)).toBe(true);
  // A signed-out visitor must not see persisted favorites that were created
  // while another account was authenticated in this same browser profile.
  guestContext = ctxA;
  await a.reload({ waitUntil: "domcontentloaded" });
  await expect(btnA).toBeDisabled();
  await expect(btnA).toHaveAttribute("aria-pressed", "false");
  await a.goto(`${origin}/preferiti/`, { waitUntil: "domcontentloaded" });
  await expect(a.locator("[data-area-favorites] [data-membership-toggle]")).toHaveCount(0);
  guestContext = undefined;
  await a.goto(`${origin}/strumenti/`, { waitUntil: "domcontentloaded" });
  await expect(btnA).toBeEnabled();
  await expect(btnA).toHaveAttribute("aria-pressed", "true");
  // Offline same-tab reload: an earlier authenticated A account with a
  // durable per-tool baseline stays locally editable despite auth GET outage.
  // An ordinary signed-out GET above revoked the old trust marker; this new
  // successful login issued a fresh tab-local marker for the current account.
  await ctxA.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => window.__onlineFixture ?? false });
  });
  offlineAuthContext = ctxA;
  await a.reload({ waitUntil: "domcontentloaded" });
  await expect(btnA).toBeEnabled();
  await expect(btnA).toHaveAttribute("aria-pressed", "true");
  const offlineWrites = writes.length;
  await btnA.click();
  await expect(btnA).toHaveAttribute("aria-pressed", "false");
  assert.equal(writes.length, offlineWrites, "Offline click should stay local until reconnect");
  offlineAuthContext = undefined;
  await a.evaluate(() => { window.__onlineFixture = true; window.dispatchEvent(new Event("online")); });
  await expect.poll(() => snapshot().tools.includes(toolId)).toBe(false);
  // Reconnection can arrive while initial session GET is unresolved. The
  // listener must enqueue a retry instead of dropping the only online event.
  raceAuthContext = ctxA;
  raceAuthCalls = 0;
  await a.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(() => raceAuthCalls).toBeGreaterThanOrEqual(2);
  await expect(btnA).toBeDisabled();
  await a.evaluate(() => { window.__onlineFixture = true; window.dispatchEvent(new Event("online")); });
  raceAuthContext = undefined;
  for (const release of raceAuthRelease.splice(0)) release();
  await expect(btnA).toBeEnabled({ timeout: 7000 });
  assert.deepEqual(errors, [], "No uncaught browser errors");
  assert.deepEqual(blockedEgress, [], "No page attempted third-party network egress");
  console.log(JSON.stringify({ kind: "#332-real-chromium-isolated-processes", page: "/strumenti/ and /preferiti/",
    source: "current compiled dist", browserProcesses: 2, accountBackend: "deterministic fixture", toolId,
    checks: ["add/converge", "remove/converge", "offline-newer-tombstone", "delayed-auth-initial-controls-disabled", "touch-targets-44", "online-reconnect-replay", "signed-out-favorites-private", "same-tab-offline-reload-and-reconnect", "online-during-pending-auth-retry", "zero-pageerrors", "zero-external-requests"],
    result: "PASS", actualAuthenticatedStaging: "NOT_RUN" }));
} finally {
  for (const browser of browsers) await browser.close().catch(() => undefined);
  server.kill("SIGTERM");
}

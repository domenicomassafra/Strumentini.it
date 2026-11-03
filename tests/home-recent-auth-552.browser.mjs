/** #552: Home Recenti must honor the same account baseline as Preferiti.
 * Run against the actual static build: node tests/home-recent-auth-552.browser.mjs
 * All account endpoints are local Playwright fixtures; no provider requests.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(process.env.HOME_RECENT_552_DIST ?? "dist");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") return response.writeHead(405).end();
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    const path = resolve(root, `.${pathname}`, pathname.endsWith("/") ? "index.html" : "");
    const rel = relative(root, path);
    if (rel === ".." || rel.startsWith(`..${sep}`)) return response.writeHead(403).end();
    const bytes = await readFile(path);
    response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch { response.writeHead(404).end(); }
});

let browser;
let mode = "signed-out";
const outbound = [];
const errors = [];
const owner = "private-account-552";
const snapshot = { version: 1, account: owner, revision: 0, tools: [], entries: [] };

async function seed(page, privateBaseline) {
  await page.evaluate(async ({ baseline, account }) => {
    const opening = indexedDB.open("utility-workbench", 1);
    const db = await new Promise((resolve, reject) => {
      opening.onupgradeneeded = () => opening.result.createObjectStore("state");
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      const store = tx.objectStore("state");
      store.put({
        version: 1, installedTools: [], packs: [], layout: { mode: "list" },
        profile: { locale: "it-IT", timezone: "Europe/Rome", currency: "EUR", dateFormat: "system", numberFormat: "system", preferredUnits: "metric", workweek: ["MON", "TUE", "WED", "THU", "FRI"] },
        preferences: { compactRows: false },
        recent: [{ toolId: "utm-builder", lastUsedAt: "2026-11-03T09:00:00.000Z", useCount: 1 }],
      }, "workbench/state:v1");
      if (baseline) store.put({ version: 1, account, revision: 0, tools: [] }, "membership/favorites-sync:v1");
      else store.delete("membership/favorites-sync:v1");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { baseline: privateBaseline, account: owner });
}

async function visibleRecent(page, expected, label) {
  const section = page.locator("[data-recent-section]");
  assert.equal(await section.count(), 1, `${label}: Home Recenti exists`);
  assert.equal(await section.isVisible(), expected, `${label}: disclosure must follow verified account state`);
  const links = page.locator('[data-recent-list] a[href="/tools/utm-builder"]');
  assert.equal(await links.count() > 0, expected, `${label}: private tool IDs must not remain in the hidden DOM`);
}

try {
  await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
  const addr = server.address();
  assert(addr && typeof addr !== "string");
  const origin = `http://127.0.0.1:${addr.port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.platform === "darwin" ? { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      outbound.push(`${request.method()} ${url}`);
      return route.abort();
    }
    if (url.pathname === "/api/auth/session") return route.fulfill({ status: mode === "offline" ? 503 : 200,
      contentType: "application/json", body: JSON.stringify({ user: mode === "verified" ? { email: "test@example.test" } : null }) });
    if (url.pathname === "/api/favorites/sync") return route.fulfill({ status: mode === "verified" ? 200 : 401,
      contentType: "application/json", body: JSON.stringify(snapshot) });
    if (url.pathname === "/api/auth/logout" && request.method() === "POST") {
      assert.equal(mode, "verified");
      mode = "signed-out";
      return route.fulfill({ status: 204, headers: { "set-cookie": "su_session=; Path=/; Max-Age=0" }, body: "" });
    }
    if (url.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method())) {
      outbound.push(`${request.method()} ${url}`);
      return route.abort();
    }
    return route.continue();
  });

  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  assert.equal((await page.goto(origin, { waitUntil: "networkidle" }))?.status(), 200);
  await seed(page, true);

  await page.reload({ waitUntil: "networkidle" });
  await visibleRecent(page, false, "signed-out with previous-account baseline");

  mode = "verified";
  await page.reload({ waitUntil: "networkidle" });
  await visibleRecent(page, true, "verified account");
  await page.locator("[data-account-toggle]").click();
  const redirected = page.waitForEvent("framenavigated", { timeout: 15_000 });
  await page.locator("[data-account-logout]").click();
  await redirected;
  await page.waitForLoadState("networkidle");
  await visibleRecent(page, false, "confirmed logout");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("strumentini:membership-changed", {
    detail: { installed: [], recent: [{ toolId: "utm-builder", lastUsedAt: "2026-11-03T09:00:00.000Z", useCount: 2 }] },
  })));
  await visibleRecent(page, false, "raw membership update after logout");

  await seed(page, false);
  await page.reload({ waitUntil: "networkidle" });
  await visibleRecent(page, true, "anonymous device without account baseline");

  await seed(page, true);
  mode = "verified";
  await page.reload({ waitUntil: "networkidle" });
  await visibleRecent(page, true, "verified tab before offline reload");
  await context.addInitScript(() => Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false }));
  mode = "offline";
  await page.reload({ waitUntil: "networkidle" });
  await visibleRecent(page, true, "previously verified tab offline");
  const fresh = await context.newPage();
  fresh.on("pageerror", (error) => errors.push(error.message));
  await fresh.goto(origin, { waitUntil: "networkidle" });
  await visibleRecent(fresh, false, "unverified fresh tab offline");

  assert.deepEqual(outbound, [], "only same-origin static assets and fixture API requests are allowed");
  assert.deepEqual(errors, [], "no browser errors");
  await context.close();
  console.log("PASS #552: signed-out previous-account private, verified visible, logout private, anonymous visible, offline verified-tab only; no offsite requests");
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}

/**
 * #551 consumer smoke, two tabs, both viewports.
 *
 * The Preferenze panel saves from the state it painted when the page opened. A
 * second tab that adds a favourite, records a recent tool and installs a pack
 * while that panel stays open must survive the save; a favourite the second tab
 * removed must not come back. Owner decision of 8 November 2026 14:49: this
 * scenario is proved on the iPhone/mobile viewport AND on the desktop one.
 *
 * Run against the built site:
 *   npm run build
 *   node scripts/acceptance-preferences-two-tabs-551.mjs
 * Run against an origin that is already served (read-only, staging or
 * production):
 *   P551_ORIGIN=https://strumentini.it node scripts/acceptance-preferences-two-tabs-551.mjs
 *
 * Every write here belongs to the disposable browser profile created by this
 * script; it is deleted on exit.
 */
import { strict as assert } from "node:assert";
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, expect as playwrightExpect } from "@playwright/test";

// A remote origin is slower than the local preview: keep the assertions patient.
const expect = playwrightExpect.configure({ timeout: 15_000 });

const port = Number(process.env.P551_PORT ?? 18551);
const externalOrigin = process.env.P551_ORIGIN;
const origin = externalOrigin ?? `http://127.0.0.1:${port}`;
const root = resolve(import.meta.dirname, "..");
const astroBin = resolve(root, "node_modules/.bin/astro");

/** Favourites, recents and packs written by the second tab. */
const ADDED_FAVORITE = "add-subtract-days";
const REMOVED_FAVORITE = "business-day";
const INSTALLED_PACK = "client-services";
const CHOSEN_CURRENCY = "USD";

const VIEWPORTS = [
  {
    name: "desktop 1280x800",
    options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  },
  {
    name: "iPhone 390x844",
    options: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    },
  },
];

let serverPid;
let browser;
let checks = 0;
const pass = (description) => { checks += 1; console.log(`PASS ${description}`); };

/**
 * `astro preview` runs the server as its own background process, so the pid to
 * stop is the one the CLI reports, not the pid of the command that started it.
 */
function previewStatus() {
  return new Promise((resolve) => {
    execFile(astroBin, ["preview", "status"], { cwd: root }, (error, stdout, stderr) => {
      resolve(`${stdout}${stderr}`);
    });
  });
}

async function previewPid() {
  const status = await previewStatus();
  if (!status.includes(`127.0.0.1:${String(port)}`)) return undefined;
  const match = /pid (\d+)/u.exec(status);
  return match === null ? undefined : Number(match[1]);
}

function stopPreview() {
  if (serverPid === undefined) return;
  const recorded = serverPid;
  serverPid = undefined;
  try {
    process.kill(recorded, "SIGTERM");
  } catch { /* already gone */ }
}

async function startPreview() {
  const existing = await previewPid();
  if (existing !== undefined) {
    throw new Error(`a preview is already running on port ${String(port)} (pid ${String(existing)}): stop it or set P551_PORT/P551_ORIGIN`);
  }
  spawn(astroBin, ["preview", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    stdio: "ignore",
    detached: process.platform !== "win32",
  });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${origin}/impostazioni/`)).ok) break;
    } catch { /* the preview is still starting */ }
    if (attempt === 119) throw new Error("astro preview never became ready: run `npm run build` first");
    await sleep(500);
  }
  serverPid = await previewPid();
  if (serverPid === undefined) throw new Error("astro preview did not report the pid it started");
}

/** The durable record every page of the site shares. */
const readRecord = (page) => page.evaluate(async () => {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open("utility-workbench", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("state")) request.result.createObjectStore("state");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const value = await new Promise((resolve, reject) => {
    const transaction = database.transaction("state", "readonly");
    const read = transaction.objectStore("state").get("workbench/state:v1");
    read.onsuccess = () => resolve(read.result);
    read.onerror = () => reject(read.error);
  });
  database.close();
  return value;
});

/** Export the device configuration, then add the pack and the recent tool. */
async function importFromSecondTab(tabB) {
  await tabB.locator("[data-local-export]").waitFor({ state: "visible" });
  const [download] = await Promise.all([
    tabB.waitForEvent("download"),
    tabB.click("[data-local-export]"),
  ]);
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  // Schema v1 (a site older than the fix) has no recent list to carry over.
  const carriesRecent = exported.version === 2;
  if (!carriesRecent) console.log("NOTE: the served configuration schema is v1, recent activity is not covered");
  exported.installedTools = [...new Set([...exported.installedTools, ADDED_FAVORITE])];
  exported.packs = [...new Set([...exported.packs, INSTALLED_PACK])];
  if (carriesRecent) {
    exported.recent = [
      { toolId: ADDED_FAVORITE, lastUsedAt: new Date().toISOString(), useCount: 1 },
      ...exported.recent.filter((entry) => entry.toolId !== ADDED_FAVORITE),
    ].slice(0, 12);
  }
  await tabB.setInputFiles("[data-local-import]", {
    name: "strumentini-config-v2.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported), "utf8"),
  });
  await expect(tabB.locator("[data-local-import-preview]")).toBeVisible();
  await Promise.all([
    tabB.waitForEvent("load"),
    tabB.click("[data-local-import-confirm]"),
  ]);
  await expect(tabB.locator("[data-local-import]")).toBeAttached();
  return carriesRecent;
}

async function runViewport(viewport) {
  const context = await browser.newContext({ acceptDownloads: true, ...viewport.options });
  const problems = [];
  try {
    // Tab A: the Preferenze panel paints here and keeps this snapshot.
    const tabA = await context.newPage();
    tabA.on("pageerror", (error) => problems.push(`tab A (+${viewport.name}): ${error.message}`));
    await tabA.goto(`${origin}/impostazioni/#preferenze`, { waitUntil: "networkidle" });
    await expect(tabA.locator('[data-profile-field="currency"]')).toHaveValue("EUR");
    await expect(tabA.locator("[data-compact-rows]")).not.toBeChecked();
    pass(`${viewport.name}: Preferenze panel painted from its own snapshot`);

    // Tab B: real UI writes while tab A's snapshot stays open.
    const tabB = await context.newPage();
    tabB.on("pageerror", (error) => problems.push(`tab B (+${viewport.name}): ${error.message}`));
    await tabB.goto(`${origin}/impostazioni/#privacy`, { waitUntil: "networkidle" });
    const carriesRecent = await importFromSecondTab(tabB);
    await tabB.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" });
    const removedToggle = tabB.locator(`[data-membership-toggle="${REMOVED_FAVORITE}"]`);
    await expect(removedToggle).toHaveAttribute("data-installed", "true");
    // The cards are client-rendered, so the click is repeated until the island
    // that owns the toggles has verified the session and accepted it.
    await expect(async () => {
      await removedToggle.click({ timeout: 1000 }).catch(() => undefined);
      const written = await readRecord(tabB);
      assert.ok(written !== undefined && !written.installedTools.includes(REMOVED_FAVORITE),
        `the second tab has not removed ${REMOVED_FAVORITE} yet`);
    }).toPass({ timeout: 20_000 });
    pass(`${viewport.name}: second tab added a favourite, a recent and a pack, then removed one favourite`);

    // Tab A still holds the older snapshot and now saves the preferences.
    await tabA.locator('[data-profile-field="currency"]').fill(CHOSEN_CURRENCY);
    await tabA.locator("[data-compact-rows]").check();
    await tabA.locator("[data-preferences-submit]").click();
    await expect(tabA.locator("[data-preferences-message]"))
      .toHaveText("Preferenze salvate su questo dispositivo.");
    pass(`${viewport.name}: preferences saved from the tab holding the older snapshot`);

    const stored = await readRecord(tabA);
    assert.ok(stored !== undefined, "the workbench record is missing after the save");
    assert.ok(stored.installedTools.includes(ADDED_FAVORITE),
      `favourite ${ADDED_FAVORITE} written by the other tab was erased: ${JSON.stringify(stored.installedTools)}`);
    assert.ok(!stored.installedTools.includes(REMOVED_FAVORITE),
      `favourite ${REMOVED_FAVORITE} removed by the other tab came back: ${JSON.stringify(stored.installedTools)}`);
    if (carriesRecent) {
      assert.ok(stored.recent.some((entry) => entry.toolId === ADDED_FAVORITE),
        `recent activity written by the other tab was erased: ${JSON.stringify(stored.recent)}`);
    }
    assert.ok(stored.packs.includes(INSTALLED_PACK),
      `pack ${INSTALLED_PACK} written by the other tab was erased: ${JSON.stringify(stored.packs)}`);
    assert.equal(stored.preferences.compactRows, true, "the saved preference is missing");
    assert.equal(stored.profile.currency, CHOSEN_CURRENCY, "the saved profile change is missing");
    pass(`${viewport.name}: IndexedDB keeps the other tab's favourite, recent and pack plus the saved preference`);

    // The visible consumer after a reload, not only the stored record.
    await tabA.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" });
    await expect(tabA.locator(`[data-membership-toggle="${ADDED_FAVORITE}"]`)).toBeVisible();
    await expect(tabA.locator(`[data-membership-toggle="${REMOVED_FAVORITE}"]`)).toHaveCount(0);
    await tabA.goto(`${origin}/impostazioni/#preferenze`, { waitUntil: "networkidle" });
    await expect(tabA.locator("[data-compact-rows]")).toBeChecked();
    await expect(tabA.locator('[data-profile-field="currency"]')).toHaveValue(CHOSEN_CURRENCY);
    pass(`${viewport.name}: favourites page and preferences after reload show the merged result`);

    assert.deepEqual(problems, [], `page errors: ${problems.join(" | ")}`);
  } finally {
    await context.close();
  }
}

try {
  if (externalOrigin === undefined) await startPreview();
  // The bundled Chromium is the default; a host Chromium can stand in for it.
  const executablePath = process.env.STRUMENTINI_CHROME_EXECUTABLE
    ?? ["/usr/bin/chromium", "/usr/bin/google-chrome-stable"].find((path) => existsSync(path))
    ?? chromium.executablePath();
  browser = await chromium.launch({ headless: true, executablePath });
  for (const viewport of VIEWPORTS) await runViewport(viewport);
  console.log(`\n#551 two-tab preferences smoke: ${checks} checks PASS on desktop and iPhone viewports (${origin})`);
} finally {
  await browser?.close();
  stopPreview();
}

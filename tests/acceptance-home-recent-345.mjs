/** #345: real local Chrome navigation, metadata-only history and reload. */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = 19451;
const origin = process.env.HOME_RECENT_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.HOME_RECENT_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root, stdio: "ignore",
});
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* waiting for local server */ }
    if (server?.exitCode != null) throw new Error(`Dev server exited with ${server.exitCode}`);
    await pause(250);
    if (i === 79) throw new Error("Local server did not become ready");
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  assert.equal((await page.goto(origin))?.status(), 200);

  await page.evaluate(async () => {
    const opening = indexedDB.open("utility-workbench", 1);
    await new Promise((resolve, reject) => {
      opening.onupgradeneeded = () => {
        if (!opening.result.objectStoreNames.contains("state")) opening.result.createObjectStore("state");
      };
      opening.onsuccess = resolve;
      opening.onerror = () => reject(opening.error);
    });
    const db = opening.result;
    await new Promise((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put({
        version: 1, installedTools: ["business-day"], packs: [], layout: { mode: "list" },
        profile: { locale: "it-IT", timezone: "Europe/Rome", currency: "EUR", dateFormat: "system", numberFormat: "system", preferredUnits: "metric", workweek: ["MON", "TUE", "WED", "THU", "FRI"] },
        preferences: { compactRows: false },
        recent: [
          { toolId: "utm-builder", lastUsedAt: "2026-10-11T00:00:00.000Z", useCount: 2 },
          { toolId: "pdf-merge", lastUsedAt: "2026-10-10T00:00:00.000Z", useCount: 1 },
        ],
      }, "workbench/state:v1");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    localStorage.setItem("strumentini:last-values:v1", JSON.stringify({
      "pdf-merge": { toolId: "pdf-merge", value: "NEVER_RENDER_SECRET_VALUE", at: "2026-10-11T01:00:00.000Z" },
    }));
  });
  await page.reload();
  const links = page.locator("[data-recent-list] .tool-card-name a");
  await links.first().waitFor();
  assert.deepEqual(await links.allTextContents(), ["Crea URL con UTM", "Unisci PDF"]);
  assert.equal(await links.first().getAttribute("href"), "/tools/utm-builder");
  assert.equal(await links.last().getAttribute("href"), "/tools/pdf-merge");
  assert(!((await page.locator("[data-recent-section]").innerText()).includes("NEVER_RENDER_SECRET_VALUE")));
  assert.equal(await page.locator("[data-recent-list] a[href*='?']").count(), 0);

  await links.first().click();
  assert.match(new URL(page.url()).pathname, /^\/tools\/utm-builder\/?$/u);
  await page.goBack();
  await links.first().waitFor();
  assert.equal(await links.count(), 2);
  assert(!((await page.locator("[data-recent-section]").innerText()).includes("NEVER_RENDER_SECRET_VALUE")));
  assert(!page.url().includes("SECRET"));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);

  assert.deepEqual(pageErrors, []);
  await context.close();
  console.log("#345 local Chromium PASS: recent IDs, reload, browser back, no legacy values in DOM, safe links and mobile-width layout");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

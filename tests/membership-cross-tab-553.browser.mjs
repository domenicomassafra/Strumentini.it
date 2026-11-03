/** Two real tabs with independent JS realms and one shared IndexedDB origin. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";

const port = await new Promise((resolve, reject) => {
  const socket = createServer();
  socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const address = socket.address();
    if (!address || typeof address === "string") return reject(new Error("No port"));
    socket.close(() => resolve(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser;

try {
  for (let attempts = 0; attempts < 60; attempts += 1) {
    try { if ((await fetch(`${origin}/strumenti/`)).ok) break; } catch { /* starting */ }
    if (attempts === 59) throw new Error("Local static server did not start");
    await sleep(150);
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    return route.abort("blockedbyclient");
  });
  const [a, b] = await Promise.all([context.newPage(), context.newPage()]);
  await Promise.all([a.goto(`${origin}/strumenti/`), b.goto(`${origin}/strumenti/`)]);
  const choices = a.locator('button[data-membership-toggle][aria-pressed="false"]:visible');
  await expect(choices.first()).toBeEnabled();
  const ids = [...new Set(await choices.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-membership-toggle"))))];
  assert.ok(ids.length >= 2 && ids[0] && ids[1], "Two uninstalled catalog favorites required");
  const first = a.locator(`button[data-membership-toggle="${ids[0]}"]`).first();
  const second = b.locator(`button[data-membership-toggle="${ids[1]}"]`).first();
  await expect(second).toBeEnabled();
  await Promise.all([first.click(), second.click()]);
  const durable = await a.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const opening = indexedDB.open("utility-workbench", 1);
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("state", "readonly");
        const read = tx.objectStore("state").get("workbench/state:v1");
        read.onsuccess = () => resolve(read.result?.installedTools ?? []);
        read.onerror = () => reject(read.error);
      });
    } finally { db.close(); }
  });
  assert.ok(durable.includes(ids[0]) && durable.includes(ids[1]), `Both favorites must survive: ${JSON.stringify(durable)}`);
  await Promise.all([a.reload(), b.reload()]);
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  console.log(`PASS #553: two real tabs kept ${ids[0]} and ${ids[1]} in one IndexedDB after reload`);
  await context.close();
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

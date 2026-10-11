// Regression #330: changing a FilePrivacy input invalidates completed output,
// removes its stale actions, and does not record an additional completion.
// node tests/acceptance-file-privacy-stale-330.mjs http://127.0.0.1:4978
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:4978";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const open = async (route) => {
    await page.goto(`${base}/tools/${route}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
      .every((island) => !island.hasAttribute("ssr")));
  };
  const run = async () => {
    await page.getByRole("button", { name: "Esegui in locale" }).click();
    await page.locator(".result-panel [data-result-class]").first().waitFor({ timeout: 20_000 });
    assert.equal(await page.locator(".result-panel").getAttribute("data-state"), "success");
  };
  const cleared = async (label) => {
    await page.locator(".result-panel [data-result-class]").first().waitFor({ state: "detached" });
    assert.equal(await page.locator(".result-panel").getAttribute("data-state"), "idle", label);
    assert.equal(await page.locator(".result-panel [data-result-slot]").count(), 0, `${label}: old result actions must vanish`);
  };
  const completedCount = async () => page.evaluate(async () => new Promise((resolve, reject) => {
    const open = indexedDB.open("utility-workbench", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("state", "readonly");
      const get = tx.objectStore("state").get("workbench/state:v1");
      get.onerror = () => reject(get.error);
      get.onsuccess = () => resolve((get.result?.recent ?? []).find((item) => item.toolId === "filename-sanitizer")?.useCount ?? 0);
      tx.oncomplete = () => db.close();
    };
  }));

  // An actual success is visible, present in Recenti, and offers result actions.
  await open("filename-sanitizer");
  await page.getByPlaceholder("Un nome per riga").fill("before.txt");
  await run();
  await page.waitForFunction(async () => {
    try {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("utility-workbench", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      const count = await new Promise((resolve) => {
        const tx = db.transaction("state", "readonly");
        const get = tx.objectStore("state").get("workbench/state:v1");
        get.onerror = () => resolve(0);
        get.onsuccess = () => resolve((get.result?.recent ?? []).find((item) => item.toolId === "filename-sanitizer")?.useCount ?? 0);
      });
      db.close();
      return count === 1;
    } catch { return false; }
  });
  assert.equal(await completedCount(), 1);
  assert((await page.locator(".result-panel [data-result-class]").count()) > 0);

  // Merely editing the form must remove the entire previous result + actions.
  await page.getByPlaceholder("Un nome per riga").fill("after.txt");
  await cleared("names edit");
  assert.equal(await completedCount(), 1, "editing must never add a Recenti event");

  assert.deepEqual(errors, [], "no uncaught browser errors");
  await page.close();
  console.log("PASS #330 FilePrivacy: successful filename-sanitizer → edit removes stale result/actions; count remains one");
} finally {
  await browser.close();
}

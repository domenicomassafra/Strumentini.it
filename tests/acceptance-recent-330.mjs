// Run against the current local Astro dev server, not production:
// node tests/acceptance-recent-330.mjs http://127.0.0.1:4932
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:4932";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

async function recentFromIndexedDb(page) {
  return page.evaluate(async () => {
    return new Promise((resolveRead, reject) => {
      const request = indexedDB.open("utility-workbench", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("state", "readonly");
        const read = tx.objectStore("state").get("workbench/state:v1");
        read.onerror = () => reject(read.error);
        read.onsuccess = () => resolveRead(read.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}

async function waitForRecent(page, toolId, count) {
  await page.waitForFunction(async ([id, expected]) => {
    try {
      const request = indexedDB.open("utility-workbench", 1);
      return await new Promise((resolveRead) => {
        request.onerror = () => resolveRead(false);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("state", "readonly");
          const read = tx.objectStore("state").get("workbench/state:v1");
          read.onsuccess = () => resolveRead(read.result?.recent?.find((x) => x.toolId === id)?.useCount === expected);
          read.onerror = () => resolveRead(false);
          tx.oncomplete = () => db.close();
        };
      });
    } catch { return false; }
  }, [toolId, count], { timeout: 20_000 });
}

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base + "/tools/utm-builder/", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "URL di destinazione" }).fill("https://example.com/path?ref=partner#details");
  await page.getByRole("textbox", { name: "Sorgente" }).fill("newsletter");
  await page.getByRole("textbox", { name: "Mezzo" }).fill("email");
  await page.getByRole("textbox", { name: "Campagna" }).fill("ottobre");
  await page.getByRole("button", { name: "Crea URL" }).click();
  await page.locator('[data-result-class="text-code"]').waitFor();
  await waitForRecent(page, "utm-builder", 1);
  const completed = await recentFromIndexedDb(page);
  assert.deepEqual(completed.map((entry) => Object.keys(entry).sort()), [["lastUsedAt", "toolId", "useCount"]]);
  assert(!JSON.stringify(completed).includes("example.com"));
  assert(!JSON.stringify(completed).includes("newsletter"));

  await page.goto(base + "/preferiti/", { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.match(await page.locator("[data-area-activity]").innerText(), /UTM/i);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.match(await page.locator("[data-area-activity]").innerText(), /UTM/i);

  await page.goto(base + "/tools/utm-builder/", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "URL di destinazione" }).fill("not a url");
  await page.getByRole("textbox", { name: "Sorgente" }).fill("newsletter");
  await page.getByRole("textbox", { name: "Mezzo" }).fill("email");
  await page.getByRole("textbox", { name: "Campagna" }).fill("ottobre");
  await page.getByRole("button", { name: "Crea URL" }).click();
  await page.locator('[data-state="error"].result-panel').waitFor();
  assert.equal((await recentFromIndexedDb(page)).find((item) => item.toolId === "utm-builder")?.useCount, 1);

  await page.goto(base + "/tools/pdf-merge/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Unisci PDF", exact: true }).click();
  assert.equal((await recentFromIndexedDb(page)).some((item) => item.toolId === "pdf-merge"), false);
  await page.locator('input[type="file"]').first().setInputFiles([
    resolve("quality/fixtures/pdf-gold/simple-2page.pdf"),
    resolve("quality/fixtures/pdf-gold/simple-3page.pdf"),
  ]);
  // Two synchronous submits exercise the real PDF in-flight guard: one result
  // must produce one recent event, even if the UI has not disabled the button.
  await page.getByRole("button", { name: "Unisci PDF", exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });
  await page.locator('[data-result-class="pdf"]').first().waitFor({ timeout: 20_000 });
  await waitForRecent(page, "pdf-merge", 1);
  await page.goto(base + "/preferiti/", { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  const text = await page.locator("[data-area-activity]").innerText();
  assert.match(text, /PDF/i);
  assert.match(text, /UTM/i);
  assert(!/example\.com|newsletter|simple-2page\.pdf/u.test(text));
  console.log("PASS #330: UTM success, reload, invalid UTM, invalid PDF, valid PDF and ID-only recents.");
  await context.close();

  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get() { throw new DOMException("Storage blocked", "SecurityError"); },
    });
  });
  const blocked = await blockedContext.newPage();
  await blocked.goto(base + "/tools/utm-builder/", { waitUntil: "networkidle" });
  await blocked.getByRole("textbox", { name: "URL di destinazione" }).fill("https://example.com/");
  await blocked.getByRole("textbox", { name: "Sorgente" }).fill("a");
  await blocked.getByRole("textbox", { name: "Mezzo" }).fill("b");
  await blocked.getByRole("textbox", { name: "Campagna" }).fill("c");
  await blocked.getByRole("button", { name: "Crea URL" }).click();
  await blocked.locator('[data-result-class="text-code"]').waitFor();
  await blocked.goto(base + "/preferiti/", { waitUntil: "networkidle" });
  await blocked.locator("[data-area-storage-warning]:not([hidden])").waitFor();
  console.log("PASS #330: IndexedDB denied does not block tool result; /preferiti discloses unavailable persistence.");
  await blockedContext.close();
} finally {
  await browser.close();
}

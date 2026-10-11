/** #330 wave14: genuine focused keyboard capture session → Recenti.
 * npx astro dev --host 127.0.0.1 --port 4995 --strictPort
 * node tests/recent-wave14-330.browser.mjs http://127.0.0.1:4995
 */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://127.0.0.1:4995").replace(/\/$/u, "");
const id = "keyboard-event-diagnostic";
const secret = "PRIVATE_KEYS_330_";

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" && !(await indexedDB.databases()).some((item) => item.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("utility-workbench", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
        const tx = db.transaction("state", "readonly");
        const get = tx.objectStore("state").get("workbench/state:v1");
        get.onerror = () => reject(get.error);
        get.onsuccess = () => resolve(get.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}

async function expectCount(page, count) {
  const deadline = Date.now() + 9000;
  let rows = [];
  do {
    rows = await recent(page);
    const item = rows.find((row) => row.toolId === id);
    if (item?.useCount === count) {
      assert.deepEqual(Object.keys(item).sort(), ["lastUsedAt", "toolId", "useCount"]);
      assert(Number.isFinite(Date.parse(item.lastUsedAt)));
      assert.equal(rows.filter((entry) => entry.toolId === id).length, 1);
      assert(!JSON.stringify(rows).includes(secret) && !JSON.stringify(rows).includes("KeyA"));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  assert.fail(`Expected ${id} count ${count}, observed ${JSON.stringify(rows)}`);
}

const browser = await chromium.launch({ headless: true });
const badRequests = [];
const errors = [];
function watch(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (!["GET", "HEAD"].includes(request.method())
      || (request.postData() ?? "").includes(secret)
      || (!url.startsWith(base) && !url.startsWith("blob:") && !url.startsWith("data:"))) {
      badRequests.push(`${request.method()} ${url}`);
    }
  });
}
async function hydrated(page) {
  const response = await page.goto(`${base}/tools/${id}/`, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')].every((island) => !island.hasAttribute("ssr")), null, { timeout: 20_000 });
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  watch(page);
  await hydrated(page);
  const area = page.getByRole("region", { name: "Area di prova eventi tastiera" });
  const history = page.locator(".keyboard-history tbody tr");
  assert.deepEqual(await recent(page), [], "Viewing the page must never be counted");

  // Non-started key presses are ignored. Start / Stop with no actual event is
  // also not a successful capture, and Reset of an empty history is disabled.
  await area.focus();
  await page.keyboard.press("F8");
  assert.equal(await history.count(), 0);
  assert.deepEqual(await recent(page), []);
  await page.getByRole("button", { name: "Avvia test" }).click();
  await page.waitForFunction(() => document.querySelector('.keyboard-test-surface')?.getAttribute('data-active') === 'true');
  assert.deepEqual(await recent(page), [], "Merely activating capture cannot count");
  await page.getByRole("button", { name: "Ferma test" }).click();
  assert.deepEqual(await recent(page), [], "Stopping without input cannot count");

  await page.getByRole("button", { name: "Avvia test" }).click();
  await area.focus();
  await page.keyboard.press("a");
  await page.waitForFunction(() => document.querySelectorAll('.keyboard-history tbody tr').length >= 2);
  assert.match(await history.first().innerText(), /keyup|keydown/u);
  assert.match(await page.locator(".keyboard-history").innerText(), /KeyA/u);
  // First real event in a capture session means one completed operation, not
  // two completions for keydown+keyup or every repeated/other key event.
  await expectCount(page, 1);
  await page.keyboard.type(secret);
  await page.keyboard.press("a");
  assert.equal((await recent(page)).find((row) => row.toolId === id)?.useCount, 1);
  assert.equal(await history.count(), 12, "Ephemeral history bounded to 12 events");
  assert(!JSON.stringify(await recent(page)).includes(secret), "Secret keystrokes never persisted");

  await page.getByRole("button", { name: "Ferma test" }).click();
  await page.getByRole("button", { name: "Cancella cronologia" }).click();
  assert.equal(await history.count(), 0);
  assert.equal((await recent(page))[0]?.useCount, 1, "Clearing historical output not another use");
  await area.focus();
  await page.keyboard.press("b");
  assert.equal(await history.count(), 0, "Capture after Stop must remain disabled");
  assert.equal((await recent(page))[0]?.useCount, 1);

  // A new explicitly activated capture session starts a second independent
  // diagnostic only when it actually observes a keyboard event.
  await page.getByRole("button", { name: "Avvia test" }).click();
  await area.focus();
  await page.keyboard.press("c");
  await page.waitForFunction(() => document.querySelectorAll('.keyboard-history tbody tr').length >= 2);
  await expectCount(page, 2);

  await page.goto(`${base}/preferiti/`, { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.match(await page.locator("[data-area-activity]").innerText(), /tastiera|keyboard|eventi/iu);
  await page.reload({ waitUntil: "networkidle" });
  await expectCount(page, 2);

  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await deniedContext.addInitScript(() => Object.defineProperty(window, "indexedDB", {
    configurable: true, get() { throw new DOMException("Storage denied", "SecurityError"); },
  }));
  const deniedPage = await deniedContext.newPage();
  watch(deniedPage);
  await hydrated(deniedPage);
  await deniedPage.getByRole("button", { name: "Avvia test" }).click();
  await deniedPage.getByRole("region", { name: "Area di prova eventi tastiera" }).focus();
  await deniedPage.keyboard.press("x");
  await deniedPage.waitForFunction(() => document.querySelectorAll('.keyboard-history tbody tr').length >= 2);
  await deniedPage.goto(`${base}/preferiti/`, { waitUntil: "networkidle" });
  assert(await deniedPage.locator("main").count() > 0);
  await deniedContext.close();

  assert.deepEqual(errors, [], "Zero browser page errors");
  assert.deepEqual(badRequests, [], "Zero POST/offsite/private request");
  await context.close();
  console.log("PASS #330 wave14 keyboard: real focused keydown/up once per session, activation/stop/clear/extra keys zero, private ephemeral key history, metadata-only IDB, preferiti reload, denied IDB, zero POST/offsite.");
} finally {
  await browser.close();
}

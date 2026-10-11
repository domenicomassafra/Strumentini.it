/** #330 Wave 11b: genuine audio-generator Web Audio success -> private Recenti.
 * Start local Astro dev at an isolated port then run:
 * node tests/recent-wave11b-330.browser.mjs http://127.0.0.1:4998
 */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const origin = (process.argv[2] ?? "http://127.0.0.1:4998").replace(/\/$/u, "");
const id = "audio-generator";

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function"
      && !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("utility-workbench", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
        const tx = db.transaction("state", "readonly");
        const req = tx.objectStore("state").get("workbench/state:v1");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}

async function expectCount(page, expected) {
  const deadline = Date.now() + 9000;
  let rows;
  do {
    rows = await recent(page);
    const entry = rows.find((row) => row.toolId === id);
    if (entry?.useCount === expected) {
      assert.deepEqual(Object.keys(entry).sort(), ["lastUsedAt", "toolId", "useCount"]);
      assert(Number.isFinite(Date.parse(entry.lastUsedAt)), "valid ISO time");
      assert.equal(rows.filter((row) => row.toolId === id).length, 1);
      assert(!JSON.stringify(rows).includes("440") && !JSON.stringify(rows).includes("pink"));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  assert.fail(`Expected ${id} useCount ${expected}, observed ${JSON.stringify(rows)}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    // Observer delegates unmodified start() to the real browser Web Audio engine.
    // Entries keep the real AudioContext so a UI message alone cannot prove sound.
    const calls = [];
    Object.defineProperty(window, "__wave11bAudioCalls", { value: calls, configurable: false });
    for (const [type, prototype] of [["tone", OscillatorNode.prototype], ["noise", AudioBufferSourceNode.prototype]]) {
      const original = prototype.start;
      prototype.start = function (...args) {
        const result = original.apply(this, args);
        calls.push({ type, context: this.context });
        return result;
      };
    }
  });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (!["GET", "HEAD"].includes(request.method())
      || (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:"))) {
      requests.push(`${request.method()} ${url}`);
    }
  });
  const response = await page.goto(`${origin}/tools/${id}/`, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every((island) => !island.hasAttribute("ssr")), null, { timeout: 20_000 });
  // Concurrent dev-server Vite overlays from unrelated routes can intercept
  // clicks. They are diagnostic UI, not the source operation under test.
  await page.addStyleTag({ content: "vite-error-overlay { pointer-events: none !important; }" });
  assert.deepEqual(await recent(page), [], "page load is not tool use");

  // Real invalid engine settings: no oscillator start, no Recenti.
  await page.getByRole("spinbutton", { name: /Frequenza/u }).fill("0");
  await page.getByRole("button", { name: "Avvia" }).click();
  assert.match(await page.locator("[data-audio-generator] > [role='status']").innerText(), /Impostazione non valida/u);
  assert.equal(await page.evaluate(() => window.__wave11bAudioCalls.length), 0);
  assert.deepEqual(await recent(page), [], "invalid start must never count");

  // Two synchronous clicks while start is pending must represent one attempt.
  await page.getByRole("spinbutton", { name: /Frequenza/u }).fill("440");
  await page.getByRole("button", { name: "Avvia" }).evaluate((button) => { button.click(); button.click(); });
  await page.waitForFunction(() => window.__wave11bAudioCalls.some((call) => call.type === "tone" && call.context.state === "running"));
  await expectCount(page, 1);
  assert.equal(await page.evaluate(() => window.__wave11bAudioCalls.filter((call) => call.type === "tone").length), 1);
  await page.getByRole("button", { name: "Ferma" }).click();
  assert.equal((await recent(page))[0]?.useCount, 1, "stop after a success is not another success");
  assert.equal(await page.evaluate(() => window.__wave11bAudioCalls.at(-1).context.state), "closed");

  // A distinct actual noise buffer starts; source-only tone status is insufficient.
  await page.getByRole("combobox", { name: "Modalità" }).selectOption("noise");
  await page.getByRole("button", { name: "Avvia" }).click();
  await page.waitForFunction(() => window.__wave11bAudioCalls.some((call) => call.type === "noise" && call.context.state === "running"));
  await expectCount(page, 2);
  await page.getByRole("button", { name: "Ferma" }).click();

  // Tap tempo only measures interactions; start metronome schedules real clicks.
  await page.getByRole("combobox", { name: "Modalità" }).selectOption("metronome");
  await page.getByRole("button", { name: "Tap tempo" }).click();
  assert.equal((await recent(page))[0]?.useCount, 2, "tap-only is not a completed audio operation");
  await page.getByRole("button", { name: "Avvia" }).click();
  await page.waitForFunction(() => window.__wave11bAudioCalls.filter((call) => call.type === "tone" && call.context.state === "running").length > 0);
  await expectCount(page, 3);
  await page.getByRole("button", { name: "Ferma" }).click();

  // Deterministic cancellation of an unresolved browser resume promise.
  // Keep native Web Audio execution; delay only resolution visible to the UI.
  await page.evaluate(() => {
    const original = AudioContext.prototype.resume;
    window.__resolveResume330 = [];
    window.__restoreResume330 = () => { AudioContext.prototype.resume = original; };
    AudioContext.prototype.resume = function (...args) {
      const resumed = original.apply(this, args);
      return new Promise((resolve, reject) => {
        window.__resolveResume330.push(() => resumed.then(resolve, reject));
      });
    };
  });
  await page.getByRole("button", { name: "Avvia" }).click();
  await page.getByRole("button", { name: "Ferma" }).click();
  await page.evaluate(async () => {
    window.__restoreResume330();
    for (const settle of window.__resolveResume330) settle();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  assert.equal((await recent(page))[0]?.useCount, 3, "cancelled pending audio must not record stale success");

  await page.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.match(await page.locator("[data-area-activity]").innerText(), /tono|metronomo|rumore|audio/iu);
  await page.reload({ waitUntil: "networkidle" });
  await expectCount(page, 3);

  // Storage-denied browser: live audio must still be produced and stoppable.
  const denied = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await denied.addInitScript(() => Object.defineProperty(window, "indexedDB", {
    configurable: true, get() { throw new DOMException("Storage disabled", "SecurityError"); },
  }));
  const deniedPage = await denied.newPage();
  deniedPage.on("pageerror", (error) => errors.push(`storage-denied ${error.message}`));
  deniedPage.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())
      || (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:"))) {
      requests.push(`denied ${request.method()} ${request.url()}`);
    }
  });
  assert.equal((await deniedPage.goto(`${origin}/tools/${id}/`, { waitUntil: "networkidle" })).status(), 200);
  await deniedPage.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every((island) => !island.hasAttribute("ssr")));
  await deniedPage.getByRole("button", { name: "Avvia" }).click();
  await deniedPage.locator('[data-audio-generator] > [role="status"]').getByText(/attivo/u).waitFor();
  await deniedPage.getByRole("button", { name: "Ferma" }).click();
  await deniedPage.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" });
  assert.equal(await deniedPage.locator("main").count() > 0, true);
  await denied.close();
  assert.deepEqual(errors, [], "no page exceptions");
  assert.deepEqual(requests, [], "zero POST and no offsite requests");
  await context.close();
  console.log("PASS #330 wave11b audio-generator: real AudioContext running tone/noise/metronome, failed/tap/stop excluded, duplicate start single count, metadata-only IDB, preferiti reload, denied IDB usable, no POST/external.");
} finally {
  await browser.close();
}

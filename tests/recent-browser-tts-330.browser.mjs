/** Real /tools/browser-text-to-speech/ user flow, with a controllable browser
 * SpeechSynthesis event source so rejected/cancelled callbacks are falsifiable.
 * Run: node tests/recent-browser-tts-330.browser.mjs http://127.0.0.1:19812
 */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const origin = (process.argv[2] ?? "http://127.0.0.1:19812").replace(/\/$/u, "");
const toolId = "browser-text-to-speech";

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function"
      && !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
    let request;
    try { request = indexedDB.open("utility-workbench", 1); }
    catch (error) { reject(error); return; }
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
      const tx = db.transaction("state", "readonly");
      const item = tx.objectStore("state").get("workbench/state:v1");
      item.onerror = () => reject(item.error);
      item.onsuccess = () => resolve(item.result?.recent ?? []);
      tx.oncomplete = () => db.close();
    };
    });
  });
}

async function count(page, expected) {
  const deadline = Date.now() + 8000;
  let rows = [];
  do {
    rows = await recent(page);
    const item = rows.find((row) => row.toolId === toolId);
    if ((item?.useCount ?? 0) === expected) {
      if (item !== undefined) {
        assert.deepEqual(Object.keys(item).sort(), ["lastUsedAt", "toolId", "useCount"]);
        assert(Number.isFinite(Date.parse(item.lastUsedAt)));
        assert(!JSON.stringify(rows).includes("SECRETO_TTS_330"));
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 75));
  } while (Date.now() < deadline);
  assert.fail(`Expected ${expected} recent completions, got ${JSON.stringify(rows)}`);
}

function mockSpeech() {
  const utterances = [];
  const controller = {
    utterances,
    cancellations: 0,
    emit(index, event) {
      const utterance = utterances[index];
      if (!utterance) throw new Error(`Missing utterance ${index}`);
      const handler = utterance[`on${event}`];
      handler?.({ type: event });
    },
  };
  Object.defineProperty(window, "__recentTts330", { value: controller });
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      getVoices: () => [],
      addEventListener() {},
      removeEventListener() {},
      cancel() { controller.cancellations++; },
      speak(utterance) { utterances.push(utterance); },
    },
  });
  window.SpeechSynthesisUtterance = class {
    constructor(text) { this.text = text; }
  };
}

const browser = await chromium.launch({ headless: true });
const errors = [];
const egress = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(mockSpeech);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())
      || (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:"))) {
      egress.push(`${request.method()} ${request.url()}`);
    }
  });
  assert.equal((await page.goto(`${origin}/tools/${toolId}/`, { waitUntil: "networkidle" })).status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')].every((island) => !island.hasAttribute("ssr")), null, { timeout: 20000 });
  await page.addStyleTag({ content: "vite-error-overlay { pointer-events: none !important; }" });
  await count(page, 0);

  await page.getByRole("textbox", { name: /Testo/u }).fill("");
  await page.getByRole("button", { name: "Leggi" }).click();
  assert.equal(await page.evaluate(() => window.__recentTts330.utterances.length), 0);
  await count(page, 0);

  await page.getByRole("textbox", { name: /Testo/u }).fill("SECRETO_TTS_330");
  await page.getByRole("button", { name: "Leggi" }).click();
  assert.equal(await page.evaluate(() => window.__recentTts330.utterances.length), 1);
  await count(page, 0); // queued request is not speaking
  await page.getByRole("button", { name: "Ferma" }).click();
  await page.evaluate(() => window.__recentTts330.emit(0, "start"));
  await count(page, 0); // browser sent a late callback from a cancelled request

  await page.getByRole("button", { name: "Leggi" }).click();
  await count(page, 0);
  await page.evaluate(() => { window.__recentTts330.emit(1, "start"); window.__recentTts330.emit(1, "start"); });
  await count(page, 1); // one actual speech start despite duplicate native event
  await page.evaluate(() => window.__recentTts330.emit(1, "end"));
  assert.match(await page.getByRole("status").last().innerText(), /Lettura conclusa/u);
  await page.getByRole("button", { name: "Leggi" }).click();
  await page.evaluate(() => window.__recentTts330.emit(2, "error"));
  await count(page, 1); // engine refuses before actual start
  await page.evaluate(() => window.__recentTts330.emit(2, "start"));
  await count(page, 1);

  await page.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.match(await page.locator("[data-area-activity]").innerText(), /voce|testo|sintesi|speech/iu);
  await page.reload({ waitUntil: "networkidle" });
  await count(page, 1);

  const denied = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await denied.addInitScript(mockSpeech);
  await denied.addInitScript(() => Object.defineProperty(window, "indexedDB", {
    configurable: true, get() { throw new DOMException("Storage disabled", "SecurityError"); },
  }));
  const deniedPage = await denied.newPage();
  deniedPage.on("pageerror", (error) => errors.push(`storage denied ${error.message}`));
  assert.equal((await deniedPage.goto(`${origin}/tools/${toolId}/`, { waitUntil: "networkidle" })).status(), 200);
  await deniedPage.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')].every((island) => !island.hasAttribute("ssr")));
  await deniedPage.getByRole("button", { name: "Leggi" }).click();
  await deniedPage.evaluate(() => window.__recentTts330.emit(0, "start"));
  await deniedPage.getByRole("button", { name: "Ferma" }).click();
  await deniedPage.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" });
  assert(await deniedPage.locator("main").count() > 0, "storage denial does not break user flow");
  await denied.close();

  assert.deepEqual(errors, []);
  assert.deepEqual(egress, []);
  console.log("PASS #330 browser TTS: native start-only completion, cancellation/invalid/error/duplicate refusal, private ID/time/count, Preferiti reload, denied IndexedDB.");
} finally {
  await browser.close();
}

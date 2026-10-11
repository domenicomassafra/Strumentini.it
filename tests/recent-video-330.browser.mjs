// Public-route acceptance for #330 VIDEO bespoke producers.
// Run with: node tests/recent-video-330.browser.mjs http://127.0.0.1:4987
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const base = (process.argv[2] ?? "http://127.0.0.1:4987").replace(/\/$/u, "");
const browser = await chromium.launch({ headless: true });

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function"
      && !(await indexedDB.databases()).some(db => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("utility-workbench", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("state", "readonly");
        const lookup = tx.objectStore("state").get("workbench/state:v1");
        lookup.onerror = () => reject(lookup.error);
        lookup.onsuccess = () => resolve(lookup.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}

async function expectCount(page, expected) {
  let state = [];
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    state = await recent(page);
    if (state.find(x => x.toolId === "video-inspector")?.useCount === expected) {
      assert.deepEqual(Object.keys(state[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
      assert(!JSON.stringify(state).includes("video-plus-audio"));
      assert(!JSON.stringify(state).includes("video-frame-305"));
      assert(!JSON.stringify(state).includes("PRIVATE_VIDEO_SENTINEL"));
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail(`expected video-inspector ${expected} completions, got ${JSON.stringify(state)}`);
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const outgoing = [], errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (!request.url().startsWith(base) && !/^(blob:|data:)/u.test(request.url())
      || !["GET", "HEAD"].includes(request.method()) || (request.postData() ?? "").includes("PRIVATE_VIDEO_SENTINEL"))
      outgoing.push(`${request.method()} ${request.url()}`);
  });
  assert.equal((await page.goto(`${base}/tools/video-inspector/`, { waitUntil: "networkidle" })).status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every(island => !island.hasAttribute("ssr")));
  assert.deepEqual(await recent(page), []);

  // Refused invalid MP4 is not a completed operation.
  const inspectorFile = page.locator('form[aria-label="Analisi metadati MP4"] input[type="file"]');
  await inspectorFile.setInputFiles({ name: "PRIVATE_VIDEO_SENTINEL.mp4", mimeType: "video/mp4", buffer: Buffer.from("not an MP4") });
  await page.getByRole("button", { name: "Analizza metadati" }).click();
  await page.locator(".video-tool-alert").waitFor();
  assert.deepEqual(await recent(page), []);

  // Real MP4 metadata success, double-click must count one operation.
  await inspectorFile.setInputFiles(resolve(root, "quality/fixtures/video-inspection/video-plus-audio.mp4"));
  await page.getByRole("button", { name: "Analizza metadati" }).evaluate(button => { button.click(); button.click(); });
  await page.locator("[data-video-inspection]").waitFor();
  assert.match(await page.locator("[data-video-inspection]").innerText(), /mp4a/u);
  await expectCount(page, 1);

  // A second independent success on this route: theoretical bitrate calculator.
  await page.locator("[data-video-target]").fill("100");
  await page.getByRole("button", { name: "Calcola bitrate teorico" }).click();
  await page.locator("[data-video-plan]").waitFor();
  await expectCount(page, 2);

  // Real decoded PNG frame; camera permission is not requested.
  const frame = page.locator("[data-video-frame-camera-305]");
  await frame.locator('input[type="file"]').setInputFiles(resolve(root, "tests/video-frame-305-red-green.mp4"));
  await frame.locator("p.file-note").filter({ hasText: /Sorgente:/u }).first().waitFor();
  await frame.getByRole("button", { name: "Estrai fotogramma PNG" }).click();
  await frame.locator("[data-frame-result]").waitFor({ timeout: 20_000 });
  await expectCount(page, 3);
  await frame.getByRole("spinbutton", { name: "Timestamp richiesto, secondi" }).fill("20");
  await frame.getByRole("button", { name: "Estrai fotogramma PNG" }).click();
  await frame.locator("[data-frame-status]").getByText(/VIDEO_FRAME_RANGE/u).waitFor();
  assert.equal(await recent(page).then(rows => rows[0]?.useCount), 3, "failed frame must not record");

  // Real GIF encoding (not merely an encoder capability probe).
  const gif = page.locator("[data-video-gif-306]");
  await gif.getByRole("spinbutton", { name: "Inizio clip (secondi)" }).fill("0.25");
  await gif.getByRole("spinbutton", { name: /Fine clip/u }).fill("1.25");
  await gif.getByRole("button", { name: "Converti video in GIF" }).evaluate(button => { button.click(); button.click(); });
  await Promise.race([
    gif.locator("[data-video-gif-result]").waitFor({ timeout: 35_000 }),
    gif.locator("[data-video-gif-status]").getByText(/VIDEO_GIF_306_/u).waitFor({ timeout: 35_000 })
      .then(async () => { throw Error(await gif.locator("[data-video-gif-status]").innerText()); }),
  ]);
  await expectCount(page, 4);
  // Cancellation after a prior success cannot publish a second stale result.
  await gif.getByRole("button", { name: "Converti video in GIF" }).click();
  await gif.getByRole("button", { name: "Annulla conversione GIF" }).click();
  await gif.locator("[data-video-gif-status]").getByText(/VIDEO_GIF_306_CANCELLED/u).waitFor();
  assert.equal((await recent(page))[0]?.useCount, 4, "cancelled GIF must not record");

  // Contact sheet can either finish verified PNG+ZIP or honestly refuse when
  // Chromium cannot attest the presentation timestamp within the deadline.
  const sheet = page.locator("[data-video-contact-sheet-308]");
  await sheet.getByRole("button", { name: "Genera contact sheet e ZIP" }).click();
  const sheetOutcome = await Promise.race([
    sheet.locator("[data-contact-result]").waitFor({ timeout: 35_000 }).then(() => "success"),
    sheet.locator("[data-contact-status]").getByText(/VIDEO_CONTACT_|non verificabile/iu).waitFor({ timeout: 35_000 })
      .then(() => "refused"),
  ]);
  if (sheetOutcome === "success") {
    await expectCount(page, 5);
  } else {
    assert.match(await sheet.locator("[data-contact-status]").innerText(), /VIDEO_CONTACT_/u);
    assert.equal(await sheet.locator("[data-contact-result]").count(), 0);
    assert.equal((await recent(page))[0]?.useCount, 4, "unverified contact sheet must not count");
  }
  const expectedAfterSheet = sheetOutcome === "success" ? 5 : 4;

  // The audio extractor has its own verified PCM16 output; its parent is still
  // the catalogued video-inspector page, not a separate invented tool ID.
  await frame.locator('input[type="file"]').setInputFiles(resolve(root, "tests/video-audio-234-two-tones.mp4"));
  const audio = page.locator("[data-video-audio-234]");
  await audio.getByRole("spinbutton", { name: "Inizio audio (secondi)" }).fill("0.25");
  await audio.getByRole("spinbutton", { name: /Fine audio/u }).fill("0.75");
  await audio.getByRole("button", { name: "Estrai WAV dal video" }).click();
  await Promise.race([
    audio.locator("[data-video-audio-result]").waitFor({ timeout: 35_000 }),
    audio.locator("[data-video-audio-status]").getByText(/VIDEO_AUDIO_/u).waitFor({ timeout: 35_000 })
      .then(async () => { throw Error(await audio.locator("[data-video-audio-status]").innerText()); }),
  ]);
  await expectCount(page, expectedAfterSheet + 1);

  await page.goto(`${base}/preferiti/`, { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.match(await page.locator("[data-area-activity]").innerText(), /video|MP4/iu);
  await page.reload({ waitUntil: "networkidle" });
  await expectCount(page, expectedAfterSheet + 1);
  assert.deepEqual(errors, []);
  assert.deepEqual(outgoing, [], "video file content must not leave browser");
  console.log(`PASS recent-video-330: ${expectedAfterSheet + 1} real video-family outputs (inspect, bitrate, PNG, GIF, WAV${sheetOutcome === "success" ? ", contact sheet" : ""}), contact sheet ${sheetOutcome}, invalid/no count, duplicate click once, metadata-only IDB, preferiti reload, no egress`);
} finally {
  await browser.close();
}

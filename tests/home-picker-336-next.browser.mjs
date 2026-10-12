// #336 regression: real Chrome/WebKit engines, mobile-sized native file controls.
// This is browser simulation, not a physical iOS Safari/Android Chrome receipt.
// Run: node tests/home-picker-336-next.browser.mjs [optional origin]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, devices, webkit } from "@playwright/test";

const origin = process.argv[2] ?? "http://127.0.0.1:19336";
const server = process.argv[2] ? null : spawn("node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", "19336", "--strictPort"], {
  stdio: "ignore",
});
const photo = { name: "foto-336.png", mimeType: "image/png", buffer: await readFile("quality/fixtures/image-metadata/synthetic-1x1-rgb.png") };
const pdf = { name: "lento-336.pdf", mimeType: "application/pdf", buffer: await readFile("quality/fixtures/pdf-gold/simple-2page.pdf") };

async function awaitServer() {
  for (let attempt = 0; attempt < 140; attempt++) {
    if (server?.exitCode != null) throw Error(`Astro server exit: ${server.exitCode}`);
    try { if ((await fetch(origin)).ok) return; } catch { /* server starting */ }
    await delay(200);
  }
  throw Error("Astro dev server did not respond");
}

async function visibleActions(page) {
  return page.locator("[data-home-file-action-format]:visible a").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
}

async function runEngine(label, engine, profile) {
  const browser = await engine.launch(label === "Chrome" ? {
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  } : { headless: true });
  try {
    const context = await browser.newContext({ ...profile, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(90_000);
    const pageErrors = [];
    const fileTransfers = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      if (!["GET", "HEAD"].includes(request.method())) fileTransfers.push(`${request.method()} ${request.url()}`);
    });
    await page.goto(origin + "/", { waitUntil: "networkidle" });
    const photos = page.locator("[data-home-photos-picker]");
    const files = page.locator("[data-home-file-picker]");
    const status = page.locator("[data-home-file-status]");
    const panel = page.locator("[data-home-file-result]");

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const measurements = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        controls: [...document.querySelectorAll(".home-file-picker")].map((element) => {
          const rect = element.getBoundingClientRect();
          return { height: rect.height, width: rect.width, label: Boolean(element.labels?.length) };
        }),
      }));
      assert(measurements.scrollWidth <= measurements.viewport + 1, `${label} ${width}px horizontal overflow: ${JSON.stringify(measurements)}`);
      assert.equal(measurements.controls.length, 2);
      assert(measurements.controls.every(({ width: w, height, label: hasLabel }) => w > 0 && height >= 44 && hasLabel),
        `${label} ${width}px picker accessibility: ${JSON.stringify(measurements)}`);
      for (const locator of [photos, files]) {
        await locator.focus();
        assert(await locator.evaluate((element) => element === document.activeElement), `${label} keyboard focus`);
      }
    }
    assert.equal(await photos.getAttribute("accept"), "image/*");
    assert.equal(await photos.getAttribute("capture"), null);
    assert.equal(await files.getAttribute("capture"), null);

    // A real native input receives a file, and identifies the source only after
    // reading bytes. Do not interpret Playwright as the real OS photo picker.
    const photoChooser = page.waitForEvent("filechooser");
    await photos.click();
    await (await photoChooser).setFiles(photo);
    await status.getByText(/PNG riconosciuto localmente/u).waitFor();
    const initialActions = await visibleActions(page);
    assert(initialActions.includes("/tools/image-metadata-viewer/"), `${label}: real PNG route`);
    assert.equal(await photos.inputValue(), "", `${label}: same-file reselect must work`);
    await page.evaluate(() => {
      window.__photoChanges336 = 0;
      document.querySelector("[data-home-photos-picker]").addEventListener("change", () => { window.__photoChanges336++; });
    });
    const duplicateChooser = page.waitForEvent("filechooser");
    await photos.click();
    await (await duplicateChooser).setFiles(photo);
    await page.waitForFunction(() => window.__photoChanges336 === 1);
    await status.getByText(/PNG riconosciuto localmente/u).waitFor();
    assert.deepEqual(await visibleActions(page), initialActions, `${label}: same photo selection revalidated`);

    // Make a REAL PDF file's Blob read slow. Cancelling a SECOND chooser before
    // it returns should not destroy the already selected first file's work.
    await page.evaluate(() => {
      const original = File.prototype.slice;
      File.prototype.slice = function (...args) {
        const result = original.apply(this, args);
        if (this.name === "lento-336.pdf" && !window.__slowReadInstalled336) {
          window.__slowReadInstalled336 = true;
          const read = result.arrayBuffer.bind(result);
          Object.defineProperty(result, "arrayBuffer", {
            value: async () => {
              window.__slowReadStarted336 = true;
              await new Promise((resolve) => { window.__releaseSlow336 = resolve; });
              return read();
            },
          });
        }
        return result;
      };
    });
    await files.setInputFiles(pdf);
    await page.waitForFunction(() => window.__slowReadStarted336 === true);
    assert(await panel.isVisible(), `${label}: previous validated result while PDF is pending`);
    assert(await page.locator("[data-home-file-prior-notice]").isVisible(), `${label}: stale result is disclosed`);
    assert.deepEqual(await visibleActions(page), initialActions);

    const cancelChooser = page.waitForEvent("filechooser");
    await photos.click();
    await (await cancelChooser).setFiles([]);
    // Browser-dispatched cancel models the DOM callback, not an OS-permission receipt.
    await photos.dispatchEvent("cancel");
    assert(await page.locator("[data-home-file-prior-notice]").isVisible(), `${label}: second chooser cancellation does not hide pending warning`);
    await page.evaluate(() => window.__releaseSlow336());
    await status.getByText(/PDF riconosciuto localmente/u).waitFor({ timeout: 8_000 });
    assert((await visibleActions(page)).includes("/tools/pdf-page-count-verifier/"), `${label}: PDF work survived unrelated cancel`);
    assert(!(await panel.innerText()).includes("Il controllo del nuovo file è in corso"), `${label}: no stale warning after completion`);

    // A subsequent read denial preserves the last validated PDF, even after
    // a distinct Photo selection, and retrying the same photo succeeds.
    await page.evaluate(() => {
      const original = File.prototype.slice;
      File.prototype.slice = function (...args) {
        if (this.name === "negata-336.png") throw new DOMException("Permission denied", "NotAllowedError");
        return original.apply(this, args);
      };
    });
    await photos.setInputFiles({ ...photo, name: "negata-336.png" });
    await status.getByText(/Impossibile leggere il file/u).waitFor();
    assert((await visibleActions(page)).includes("/tools/pdf-page-count-verifier/"), `${label}: denied Photo preserves previous PDF`);
    assert.match(await status.innerText(), /ultimo file riconosciuto/u);
    const sameChooser = page.waitForEvent("filechooser");
    await photos.click();
    await (await sameChooser).setFiles(photo);
    await status.getByText(/PNG riconosciuto localmente/u).waitFor();
    assert((await visibleActions(page)).includes("/tools/image-metadata-viewer/"), `${label}: same-photo retry`);

    assert.deepEqual(fileTransfers, [], `${label}: selection must not upload`);
    assert.deepEqual(pageErrors, [], `${label}: page errors`);
    await context.close();
    console.log(`PASS #336 ${label} 320/390px chooser, cancel-during-read, denied read, previous result, same-file retry, keyboard, zero POST`);
  } finally {
    await browser.close();
  }
}

try {
  await awaitServer();
  await runEngine("Chrome", chromium, devices["Pixel 7"]);
  await runEngine("WebKit", webkit, devices["iPhone 13"]);
  console.log("NOT_RUN #336 native/physical iOS Safari Photos, Android Chrome Files, OS permission and app-return receipts.");
} finally {
  server?.kill("SIGTERM");
}

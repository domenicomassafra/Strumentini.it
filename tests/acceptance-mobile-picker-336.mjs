// #336: Chrome mobile emulation only (NOT physical iOS Safari / Android Chrome).
// Run with: node tests/acceptance-mobile-picker-336.mjs http://127.0.0.1:4966
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium, devices } from "@playwright/test";

// With no URL argument, exercise the actual dist/ built by npm run build.
const dist = resolve(import.meta.dirname, "../dist");
const mime = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript",
  ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".wasm": "application/wasm", ".json": "application/json" };
const server = process.argv[2] ? null : createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    const candidate = resolve(dist, pathname.replace(/^\/+/u, ""), pathname.endsWith("/") ? "index.html" : "");
    if (!candidate.startsWith(dist + sep)) throw Error("Outside dist");
    const path = (await stat(candidate)).isDirectory() ? resolve(candidate, "index.html") : candidate;
    response.writeHead(200, { "content-type": mime[extname(path)] ?? "application/octet-stream" });
    response.end(await readFile(path));
  } catch { response.writeHead(404).end("Not found"); }
});
if (server) await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = process.argv[2] ?? `http://127.0.0.1:${server.address().port}`;
// Use installed Playwright Chromium on MiniPC; a dedicated Chrome binary can
// still be selected explicitly without embedding a Mac-only path.
const browser = await chromium.launch({
  headless: true,
  ...(process.env.STR336_CHROME_BIN ? { executablePath: process.env.STR336_CHROME_BIN } : {}),
});
const source = await readFile("quality/fixtures/pdf-gold/simple-2page.pdf");
const png = await readFile("quality/fixtures/image-metadata/synthetic-1x1-rgb.png");
const photo = { name: "dalla-galleria.png", mimeType: "image/png", buffer: png };
const pdf = { name: "da-file.pdf", mimeType: "application/pdf", buffer: source };

async function open(context) {
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90_000);
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator("[data-home-file-entry]").waitFor();
  return page;
}

async function verified(page, pattern) {
  await page.locator("[data-home-file-status]").getByText(pattern).waitFor({ timeout: 15_000 });
}

async function choose(page, selector, file) {
  const chooserEvent = page.waitForEvent("filechooser");
  await page.locator(selector).click();
  const chooser = await chooserEvent;
  assert.equal(chooser.isMultiple(), false);
  await chooser.setFiles(file);
  return chooser;
}

async function visibleLinks(page) {
  return page.locator("[data-home-file-action-format]:visible a").evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute("href")),
  );
}

try {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
  });
  const page = await open(context);
  const errors = [];
  const unexpectedTransfers = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      unexpectedTransfers.push({ method: request.method(), url: request.url() });
    }
  });

  assert.equal(await page.locator("[data-home-photos-picker]").getAttribute("accept"), "image/*");
  assert.equal(await page.locator("[data-home-photos-picker]").getAttribute("capture"), null);
  assert.equal(await page.locator("[data-home-file-picker]").getAttribute("accept"), null);
  assert.equal(await page.locator("[data-home-file-picker]").getAttribute("capture"), null);
  assert.equal(await page.locator("[data-home-file-picker]").getAttribute("multiple"), null);

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    const layout = await page.evaluate(() => {
      const inputs = ["[data-home-file-picker]", "[data-home-photos-picker]"].map((selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return { visible: Boolean(element && rect?.width && rect?.height), height: rect?.height ?? 0 };
      });
      return { scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth, inputs };
    });
    assert(layout.scrollWidth <= layout.viewport + 1, "horizontal overflow at " + width + ": " + JSON.stringify(layout));
    assert(layout.inputs.every((input) => input.visible && input.height >= 44),
      "mobile picker height/visibility failure at " + width + ": " + JSON.stringify(layout));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("[data-home-photos-picker]").focus();
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-home-photos-picker")), true);
  await page.locator("[data-home-file-picker]").focus();
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-home-file-picker")), true);

  // Chrome's actual filechooser event, selecting an image through the Photos
  // native input. This does not prove the iOS Photo Library/Android Photos UI.
  await choose(page, "[data-home-photos-picker]", photo);
  await verified(page, /PNG riconosciuto localmente/u);
  assert.equal(await page.locator("[data-home-photos-picker]").inputValue(), "");
  assert((await visibleLinks(page)).includes("/tools/image-metadata-viewer/"));

  // Cancelling a new native chooser, an OS-style denied-selection event and
  // returning to the tab must keep previous valid recommendations.
  const priorLinks = await visibleLinks(page);
  const cancelEvent = page.waitForEvent("filechooser");
  await page.locator("[data-home-photos-picker]").click();
  await (await cancelEvent).setFiles([]);
  await page.locator("[data-home-photos-picker]").dispatchEvent("cancel");
  await verified(page, /Scelta annullata/u);
  assert.deepEqual(await visibleLinks(page), priorLinks);
  assert.match(await page.locator("[data-home-file-status]").innerText(), /ultimo file riconosciuto/u);

  await page.locator("[data-home-file-picker]").dispatchEvent("error");
  await verified(page, /Impossibile completare la selezione/u);
  assert.deepEqual(await visibleLinks(page), priorLinks);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  assert.deepEqual(await visibleLinks(page), priorLinks, "app switch/return must not clear good result");

  // Native picker can return an empty change event without a cancel event.
  await page.locator("[data-home-file-picker]").dispatchEvent("change");
  await verified(page, /Nessun nuovo file ricevuto/u);
  assert.deepEqual(await visibleLinks(page), priorLinks);

  // Simulate OS file-read denial at Blob.slice. This is not a physical OS
  // permission receipt; it verifies actual browser UI recovery on read error.
  await page.evaluate(() => {
    const original = File.prototype.slice;
    File.prototype.slice = function (...args) {
      if (this.name === "lettura-negata.png") throw new DOMException("Permission denied", "NotAllowedError");
      return original.apply(this, args);
    };
  });
  await page.locator("[data-home-photos-picker]").setInputFiles({ ...photo, name: "lettura-negata.png" });
  await verified(page, /Impossibile leggere il file/u);
  assert.deepEqual(await visibleLinks(page), priorLinks);
  assert.match(await page.locator("[data-home-file-status]").innerText(), /ultimo file riconosciuto/u);

  // Re-select same photo: file input resets after each result/refusal.
  await choose(page, "[data-home-photos-picker]", photo);
  await verified(page, /PNG riconosciuto localmente/u);

  // Files flow through to an actual PDF tool. User manually reselects after
  // navigation; no File object is persisted or transferred between pages.
  await choose(page, "[data-home-file-picker]", pdf);
  await verified(page, /PDF riconosciuto localmente/u);
  assert((await visibleLinks(page)).includes("/tools/pdf-page-count-verifier/"));
  assert.match(await page.locator("[data-home-file-result]").innerText(), /selezionare di nuovo il file/u);
  assert.equal(unexpectedTransfers.length, 0, "picker should not upload data or start background requests");
  await page.locator('[data-home-file-action-format="pdf"]:visible a').first().click();
  await page.waitForURL(/\/tools\/pdf-page-count-verifier\/?/u);
  const toolInput = page.locator('form input[type="file"]').first();
  await toolInput.waitFor();
  assert.equal(await toolInput.inputValue(), "", "no hidden file transfer to tool");
  await toolInput.setInputFiles(pdf);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-result-panel], [data-tool-result]')?.textContent ?? document.body.textContent ?? "";
    return /pagine|page count|pages/iu.test(text) && !/Il risultato locale apparirà qui/u.test(text);
  }, null, { timeout: 20_000 }).catch(async () => {
    throw Error("PDF output did not appear after explicit reselect/run: " + (await page.locator("body").innerText()).slice(-1200));
  });

  assert.deepEqual(errors, [], "browser errors: " + errors.join(" | "));
  await context.close();

  // Separate Chrome mobile viewport variant, not native iOS Safari proof.
  const iosLike = await browser.newContext({
    ...devices["iPhone 13"],
    viewport: { width: 390, height: 844 },
  });
  const iosPage = await open(iosLike);
  await choose(iosPage, "[data-home-photos-picker]", photo);
  await verified(iosPage, /PNG riconosciuto localmente/u);
  await iosPage.locator('[data-home-file-action-format="png"]:visible a[href="/tools/image-metadata-viewer/"]').click();
  await iosPage.waitForURL(/\/tools\/image-metadata-viewer\/?/u);
  assert.equal(await iosPage.locator('form input[type="file"]').first().inputValue(), "");
  assert.equal(await iosPage.locator("form input[type=file]").count(), 1);
  await iosPage.locator('form input[type="file"]').setInputFiles(photo);
  await iosPage.locator('form button[type="submit"]').first().click();
  await iosPage.locator(".result-panel [data-result-class]").waitFor({ timeout: 20_000 }).catch(async () => {
    const panel = await iosPage.locator(".result-panel").first().innerText();
    throw Error("Image result did not appear after explicit reselect/run: " + panel.slice(0, 800));
  });
  assert.match(await iosPage.locator(".result-panel").first().innerText(), /1×1 px/u);
  assert(!/L'operazione non è riuscita/u.test(await iosPage.locator("body").innerText()), "image tool returned an error");
  await iosLike.close();

  console.log("PASS #336 real desktop Chrome mobile emulation: Pixel 7 + iPhone-like contexts, 320/390/768/1024/1440, Photos/Files filechooser, keyboard, 44px targets, cancel/permission simulation, app return, stale-result clarity, same-file retry, Photos→image metadata result and Files→PDF result after explicit reselect, zero picker egress.");
  console.log("NOT_RUN #336 physical iOS Safari Photo Library, physical Android Chrome Photos/Files, real OS permission denial/background return.");
} finally {
  await browser.close();
  if (server) await new Promise((done) => server.close(done));
}

/** #334 — real Chrome generated-home acceptance, static production bundle. */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 19434;
const origin = process.env.FILE334_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.FILE334_ORIGIN ? null : spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser;
try {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* binding */ }
    if (server?.exitCode != null) throw new Error("Static HTTP server failed");
    if (i === 49) throw new Error("Static HTTP server timeout");
    await delay(200);
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const mutations = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (req) => {
    if (!req.url().startsWith(origin) || !["GET", "HEAD"].includes(req.method())) mutations.push(`${req.method()} ${req.url()}`);
  });
  const fixture = await readFile("quality/fixtures/pdf-gold/simple-2page.pdf");
  const image = await readFile("quality/fixtures/image-metadata/synthetic-1x1-rgb.png");
  assert.equal((await page.goto(origin, { waitUntil: "networkidle" }))?.status(), 200);
  const root = page.locator("[data-home-file-entry]");
  const status = root.locator("[data-home-file-status]");
  const actions = root.locator("[data-home-file-action-format]:visible a");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const measure = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      targets: [...document.querySelectorAll(".home-file-picker")].map((input) => ({
        height: input.getBoundingClientRect().height,
        width: input.getBoundingClientRect().width,
      })),
    }));
    assert(!measure.overflow, `Horizontal overflow ${width}px`);
    assert.equal(measure.targets.length, 2);
    assert(measure.targets.every(({ width: w, height }) => w > 0 && height >= 44), `Keyboard/touch targets ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.match(await status.innerText(), /Nessuna operazione parte automaticamente/u);
  assert.equal(await actions.count(), 0);

  // A real keyboard-focusable file chooser produces an *operation choice*,
  // never executes a PDF engine on this home page.
  const input = root.locator("[data-home-file-picker]");
  await input.focus();
  assert(await input.evaluate((element) => element === document.activeElement && element.matches(":focus-visible")));
  const fileChooser = page.waitForEvent("filechooser");
  await input.click();
  await (await fileChooser).setFiles({ name: "proof.pdf", mimeType: "application/pdf", buffer: fixture });
  await status.getByText(/PDF riconosciuto localmente/u).waitFor();
  const previous = await actions.evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert(previous.includes("/tools/pdf-page-count-verifier/"));
  assert.equal(await page.locator('[data-result-class="pdf"]').count(), 0, "No PDF generation on home selection");

  // Drag over may highlight; a cancelled drag must leave prior good choices.
  await root.locator("[data-home-file-dropzone]").evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "cancel.pdf", { type: "application/pdf" }));
    element.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    window.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }));
  });
  assert.equal(await root.locator(".home-file-drag-active").count(), 0);
  assert.deepEqual(await actions.evaluateAll((links) => links.map((link) => link.getAttribute("href"))), previous);

  // Actual HTML DragEvent+DataTransfer file drop, no special test-only hook.
  await root.locator("[data-home-file-dropzone]").evaluate((element, bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], "proof.png", { type: "image/png" }));
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, [...image]);
  await status.getByText(/PNG riconosciuto localmente/u).waitFor();
  const imageLinks = await actions.evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert(imageLinks.includes("/tools/image-metadata-viewer/"));
  assert(!imageLinks.includes("/tools/pdf-page-count-verifier/"));
  await root.locator("[data-home-file-reset]").click();
  assert.equal(await actions.count(), 0);
  assert.match(await status.innerText(), /Selezione rimossa/u);

  // Home link is a normal navigation; the PDF input is not uploaded or
  // prepopulated. The user controls whether to start the operation afterward.
  await input.setInputFiles({ name: "second.pdf", mimeType: "application/pdf", buffer: fixture });
  await status.getByText(/PDF riconosciuto localmente/u).waitFor();
  await root.locator("[data-home-file-action-format]:visible a[href='/tools/pdf-page-count-verifier/']").first().click();
  assert.match(page.url(), /\/tools\/pdf-page-count-verifier\//u);
  assert.equal(await page.locator('input[type="file"]').first().evaluate((input) => input.files?.length ?? -1), 0);
  assert.equal(await page.locator('[data-result-class="pdf"]').count(), 0);
  assert.deepEqual(mutations, [], "No upload, telemetry POST or off-origin request during home journeys");
  assert.deepEqual(errors, []);
  console.log("#334 Chromium static bundle PASS: keyboard chooser + dragged PDF/PNG→manual route, cancel/reset, 320–1440px, no autorun/transfer/exfiltration");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

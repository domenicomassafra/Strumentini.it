/** STR-375: real local editor, downloaded artifact, independent render and privacy. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { PDFDocument } from "pdf-lib";
import { chromium, webkit } from "@playwright/test";
import sharp from "sharp";

const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") return reject(new Error("no port"));
    server.close(() => resolve(address.port));
  });
});
const origin = "http://127.0.0.1:" + port;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"],
  { cwd: process.cwd(), stdio: "ignore" });

function renderPoppler(bytes) {
  const child = spawnSync("pdftoppm", ["-f", "1", "-l", "1", "-r", "72", "-png", "-singlefile", "-"],
    { input: Buffer.from(bytes), maxBuffer: 10_000_000, timeout: 20_000 });
  assert.equal(child.status, 0, String(child.stderr).slice(0, 400));
  return child.stdout;
}

async function fixture() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 400]);
  page.drawText("KEEP375", { x: 10, y: 200 });
  const field = doc.getForm().createTextField("customer");
  field.setText("KEEP_VALUE");
  field.addToPage(page, { x: 20, y: 40, width: 110, height: 20 });
  return doc.save({ useObjectStreams: false });
}

try {
  for (let retry = 0; retry < 100; retry++) {
    if (server.exitCode !== null) throw new Error("server stopped");
    try { if ((await fetch(origin + "/tools/pdf-page-reorder/")).ok) break; } catch { /* initial boot */ }
    if (retry === 99) throw new Error("static route unavailable");
    await sleep(100);
  }
  const input = await fixture();
  const redPng = readFileSync("quality/fixtures/image-metadata/workspace-overlay-red-2x2.png");
  const baseline = await sharp(renderPoppler(input)).raw().toBuffer({ resolveWithObject: true });
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 700 }]) {
        const context = await browser.newContext({ viewport, acceptDownloads: true });
        const page = await context.newPage();
        const external = [], uploads = [], pageErrors = [], cspErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("console", (entry) => {
          if (entry.type() === "error" && /Content Security Policy/iu.test(entry.text())) cspErrors.push(entry.text());
        });
        context.on("request", (request) => {
          if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") &&
            !request.url().startsWith("data:")) external.push(request.url());
          if (!["GET", "HEAD"].includes(request.method())) uploads.push(request.url());
        });
        await page.route("**/tools/pdf-page-reorder/", async (route) => {
          const response = await route.fetch();
          await route.fulfill({ response, headers: {
            ...response.headers(),
            "content-security-policy": "default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; " +
              "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:"
          } });
        });
        const response = await page.goto(origin + "/tools/pdf-page-reorder/", { waitUntil: "networkidle" });
        assert.equal(response?.status(), 200);
        await page.locator("[data-pdf-workspace-372]").waitFor({ timeout: 20_000 });
        await page.getByLabel("PDF da modificare").setInputFiles({
          name: "original.pdf", mimeType: "application/pdf", buffer: Buffer.from(input),
        });
        await page.locator("[data-workspace-image-editor]").waitFor({ timeout: 25_000 });
        await page.locator("[data-workspace-image-editor] summary").click();
        await page.getByLabel("Immagine da inserire").setInputFiles({
          name: "red.png", mimeType: "image/png", buffer: redPng,
        });
        await page.locator('[aria-label="Posizione immagine sulla pagina"]').waitFor({ timeout: 25_000 });
        const range = page.getByLabel("Larghezza immagine");
        await range.focus();
        await page.keyboard.press("ArrowRight");
        assert.equal(await range.inputValue(), "31");
        await page.keyboard.press("ArrowLeft");
        assert.equal(await range.inputValue(), "30");
        const overlay = page.locator('[aria-label="Posizione immagine sulla pagina"]');
        await overlay.scrollIntoViewIfNeeded();
        const box = await overlay.boundingBox();
        assert(box);
        assert(box.y >= 0 && box.y + box.height <= viewport.height,
          "image overlay must be within the viewport before pointer movement");
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 6, box.y + box.height / 2 + 9, { steps: 6 });
        await page.mouse.up();
        const xPercent = Number(await page.getByLabel("Posizione immagine orizzontale").inputValue());
        assert(xPercent > 12, "drag must move overlay");
        await page.getByRole("button", { name: "Salva PDF con immagine" }).click();
        await page.locator('[data-pdf-image-375] [data-state="success"]').first().waitFor({ timeout: 45_000 })
          .catch(async () => {
            await page.getByRole("link", { name: /Scarica/iu }).first().waitFor({ timeout: 25_000 });
          });
        const downloadPromise = page.waitForEvent("download");
        await page.locator("[data-pdf-image-375]").getByRole("link", { name: /Scarica/iu }).first().click();
        const download = await downloadPromise;
        const output = readFileSync(await download.path());
        assert(output.length > input.length);
        const reopened = await PDFDocument.load(output);
        assert.equal(reopened.getPageCount(), 1);
        assert.equal(reopened.getForm().getTextField("customer").getText(), "KEEP_VALUE");
        assert.equal(reopened.getPage(0).node.Annots()?.size(), 1);
        const after = await sharp(renderPoppler(output)).raw().toBuffer({ resolveWithObject: true });
        assert.equal(after.info.width, baseline.info.width);
        assert.equal(after.info.height, baseline.info.height);
        let changed = 0;
        for (let y = 35; y < 250; y++) {
          for (let x = 15; x < 210; x++) {
            const i = (y * after.info.width + x) * after.info.channels;
            if (Math.abs(after.data[i] - baseline.data[i]) > 30 ||
                Math.abs(after.data[i + 1] - baseline.data[i + 1]) > 30 ||
                Math.abs(after.data[i + 2] - baseline.data[i + 2]) > 30) changed++;
          }
        }
        assert(changed > 1000, "Poppler visual diff must see the embedded raster");
        assert.deepEqual(external, [], "no external requests");
        assert.deepEqual(uploads, [], "no network upload or POST");
        assert.deepEqual(pageErrors, [], "no browser JS errors");
        assert.deepEqual(cspErrors, [], "no blocked CSP attempts");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, "no horizontal overflow on mobile simulation");
        if (viewport.width === 390) {
          // Playwright's WebKit offline switch rejects even self-contained blob Workers.
          // Block all HTTP requests instead; prove the origin is unreachable, then re-save.
          // Chromium uses the native offline emulation.
          const allHttp = /^https?:\/\//;
          const webkitNetworkBlocked = engine.name() === "webkit";
          if (webkitNetworkBlocked) {
            await page.route(allHttp, (route) => route.abort("internetdisconnected"));
            const denied = await page.evaluate(async (url) => {
              try { await fetch(url + "/robots.txt", { cache: "no-store" }); return false; }
              catch { return true; }
            }, origin);
            assert(denied, "WebKit network blockade must deny the origin");
          } else await context.setOffline(true);
          await page.getByRole("button", { name: "Salva PDF con immagine" }).click();
          await page.locator("[data-pdf-image-375]").getByRole("link", { name: /Scarica/iu }).first().waitFor({ timeout: 12_000 })
            .catch(async (reason) => {
              console.error("OFFLINE_DEBUG", (await page.locator("[data-pdf-image-375]").innerText()).slice(-1800));
              console.error("OFFLINE_PAGE_ERRORS", pageErrors);
              throw reason;
            });
          const offlineDownload = page.waitForEvent("download");
          await page.locator("[data-pdf-image-375]").getByRole("link", { name: /Scarica/iu }).first().click();
          const offlineBytes = readFileSync(await (await offlineDownload).path());
          assert.equal((await PDFDocument.load(offlineBytes)).getPageCount(), 1, "offline saved PDF must independently reopen");
          if (webkitNetworkBlocked) await page.unroute(allHttp);
          else await context.setOffline(false);
        }
        assert.deepEqual(cspErrors, [], "strict CSP must not block the editor");
        console.log(engine.name() + " viewport=" + viewport.width + " PASS: drag, resize, PDF result, Poppler diff pixels=" + changed + ", form and annotations, local requests, CSP" + (viewport.width === 390 ? ", offline re-save" : ""));
        await context.close();
      }
    } finally { await browser.close(); }
  }
} finally {
  server.kill("SIGTERM");
}

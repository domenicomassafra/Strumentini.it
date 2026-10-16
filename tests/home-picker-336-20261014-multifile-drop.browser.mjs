/** #336: an unsupported multi-file DROP cannot revoke an already verified
 * file or cancel its pending browser read. Actual Chrome/WebKit File and
 * DataTransfer objects; no OS picker/mobile-hardware acceptance implied. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, webkit } from "@playwright/test";

const origin = "http://127.0.0.1:19836";
const server = spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", "19836", "--strictPort"], {
  cwd: process.cwd(), stdio: "ignore",
});
const photo = { name: "positive-336.png", mimeType: "image/png", buffer: await readFile("quality/fixtures/image-metadata/synthetic-1x1-rgb.png") };
const pdf = { name: "pending-336.pdf", mimeType: "application/pdf", buffer: await readFile("quality/fixtures/pdf-gold/simple-2page.pdf") };

async function ready() {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(`Local Astro exited ${server.exitCode}`);
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(900) })).ok) return; } catch { /* starting */ }
    await sleep(200);
  }
  throw Error("Local Astro was not available");
}

async function dropTwoRealFiles(page) {
  const result = await page.evaluate(() => {
    const input = new DataTransfer();
    input.items.add(new File([new Uint8Array([65])], "bad-first.txt", { type: "text/plain" }));
    input.items.add(new File([new Uint8Array([66])], "bad-second.txt", { type: "text/plain" }));
    const drop = document.querySelector("[data-home-file-dropzone]");
    const event = new DragEvent("drop", { dataTransfer: input, bubbles: true, cancelable: true });
    const accepted = drop.dispatchEvent(event);
    return { files: input.files.length, canceled: !accepted };
  });
  assert.deepEqual(result, { files: 2, canceled: true }, "Actual multi-file Drop is intercepted locally");
}

async function links(page) {
  return page.locator("[data-home-file-action-format]:visible a").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")));
}

try {
  await ready();
  for (const [name, engine] of [["Chrome", chromium], ["WebKit", webkit]]) {
    const browser = await engine.launch(name === "Chrome" ? { headless: true, channel: "chrome" } : { headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const pageErrors = [];
      const mutations = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("request", (request) => {
        if (!["GET", "HEAD"].includes(request.method())) mutations.push(`${request.method()} ${request.url()}`);
      });
      await page.goto(origin, { waitUntil: "networkidle" });
      const photos = page.locator("[data-home-photos-picker]");
      const files = page.locator("[data-home-file-picker]");
      const status = page.locator("[data-home-file-status]");

      // First select a genuine supported image through the browser's native
      // file input; an invalid multi-drop is not a replacement for it.
      await photos.setInputFiles(photo);
      await status.getByText(/PNG riconosciuto localmente/u).waitFor();
      const previous = await links(page);
      assert(previous.includes("/tools/image-metadata-viewer/"));
      await dropTwoRealFiles(page);
      assert.match(await status.innerText(), /Scegli un solo file alla volta/u);
      assert.deepEqual(await links(page), previous, `${name}: unsupported multi-drop must preserve last verified tool recommendation`);
      assert.match(await status.innerText(), /ultimo file riconosciuto/u);

      // Delay the *actual* selected PDF's File/Blob read and reject another
      // multi-file drop. An invalid drop must not abort that earlier read.
      await page.evaluate(() => {
        const original = File.prototype.slice;
        File.prototype.slice = function (...args) {
          const blob = original.apply(this, args);
          if (this.name === "pending-336.pdf" && !window.__delay336) {
            window.__delay336 = true;
            const read = blob.arrayBuffer.bind(blob);
            Object.defineProperty(blob, "arrayBuffer", { value: async () => {
              window.__readPending336 = true;
              await new Promise((resolve) => { window.__release336 = resolve; });
              return read();
            } });
          }
          return blob;
        };
      });
      await files.setInputFiles(pdf);
      await page.waitForFunction(() => window.__readPending336 === true);
      assert(await page.locator("[data-home-file-prior-notice]").isVisible(), "Prior valid result must be visibly marked while pending");
      await dropTwoRealFiles(page);
      assert.deepEqual(await links(page), previous, `${name}: pending selection should not hide prior good recommendation`);
      await page.evaluate(() => window.__release336());
      await status.getByText(/PDF riconosciuto localmente/u).waitFor({ timeout: 8000 });
      assert((await links(page)).includes("/tools/pdf-page-count-verifier/"), `${name}: pending genuine PDF must complete after invalid drop`);
      assert.deepEqual(mutations, [], `${name}: no implicit upload`);
      assert.deepEqual(pageErrors, [], `${name}: no JS page errors`);
      console.log(`#336 ${name} valid-result + in-flight-PDF multi-file DROP ignored: PASS, no upload`);
    } finally { await browser.close(); }
  }
  console.log("NOT_RUN #336 real iOS Safari/Android Chrome Photos/Files OS picker permissions and app return");
} finally {
  server.kill("SIGTERM");
}

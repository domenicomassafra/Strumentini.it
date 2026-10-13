/** #336: native file chosen before Astro's deferred HomeFileEntry module loads.
 * Run after a static build: PICKER336_DIST=/absolute/path/to/build node tests/picker-336-20261013-early-choice.browser.mjs
 * Browser engines with mobile-sized viewports, NOT physical iOS/Android picker receipts.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium, devices, webkit } from "@playwright/test";

const dist = resolve(process.env.PICKER336_DIST ?? "dist");
const photo = { name: "early-photo-336.png", mimeType: "image/png",
  buffer: await readFile("quality/fixtures/image-metadata/synthetic-1x1-rgb.png") };
const pdf = { name: "early-files-336.pdf", mimeType: "application/pdf",
  buffer: await readFile("quality/fixtures/pdf-gold/simple-2page.pdf") };
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const target = resolve(dist, "." + decodeURIComponent(pathname), pathname.endsWith("/") ? "index.html" : "");
    const rel = relative(dist, target);
    if (rel === ".." || rel.startsWith(".." + sep)) return res.writeHead(403).end();
    const data = await readFile(target);
    res.writeHead(200, { "Content-Type": mime[extname(target)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
const origin = "http://127.0.0.1:" + server.address().port;
try {
  for (const [engineName, engine, device] of [
    ["Chrome", chromium, devices["Pixel 7"]],
    ["WebKit", webkit, devices["iPhone 13"]],
  ]) {
    const browser = await engine.launch(engineName === "Chrome"
      ? { headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }
      : { headless: true });
    try {
      for (const width of [320, 390]) {
        const context = await browser.newContext({ ...device, viewport: { width, height: 844 } });
        const page = await context.newPage();
        const pageErrors = [];
        const nonGetRequests = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        page.on("request", request => {
          if (!["GET", "HEAD"].includes(request.method())) nonGetRequests.push(request.method() + " " + request.url());
        });
        let releaseModule;
        let sawModule;
        const moduleStarted = new Promise(done => { sawModule = done; });
        const moduleGate = new Promise(done => { releaseModule = done; });
        await page.route("**/HomeFileEntry.astro_astro_type_script_index_0_lang.*.js", async route => {
          sawModule();
          await moduleGate;
          await route.continue();
        });
        try {
          // `commit` does not wait for deferred <script type=module>. Both SSR
          // inputs can receive real Files while their change handler is absent.
          await page.goto(origin + "/", { waitUntil: "commit" });
          const selectedPhotos = width === 320;
          const selector = selectedPhotos ? "[data-home-photos-picker]" : "[data-home-file-picker]";
          const expected = selectedPhotos ? /PNG riconosciuto localmente/u : /PDF riconosciuto localmente/u;
          const route = selectedPhotos ? "/tools/image-metadata-viewer/" : "/tools/pdf-page-count-verifier/";
          const chosenFile = selectedPhotos ? photo : pdf;
          const input = page.locator(selector);
          await input.waitFor({ timeout: 8000 });
          const measurements = await page.evaluate(() => ({
            viewport: innerWidth, scroll: document.documentElement.scrollWidth,
            controls: [...document.querySelectorAll(".home-file-picker")].map(element => element.getBoundingClientRect().height),
          }));
          assert(measurements.scroll <= measurements.viewport + 1, `${engineName} ${width}px horizontal scroll: ${JSON.stringify(measurements)}`);
          assert.equal(measurements.controls.length, 2);
          assert(measurements.controls.every(height => height >= 44), `${engineName} ${width}px hit targets: ${JSON.stringify(measurements)}`);
          const chooser = page.waitForEvent("filechooser");
          await input.click();
          await (await chooser).setFiles(chosenFile);
          await moduleStarted;
          assert.match(await input.inputValue(), /early-(?:photo|files)-336/u,
            `${engineName} ${width}px real native File remains in the input before module initialization`);
          assert.match(await page.locator("[data-home-file-status]").innerText(), /Nessuna operazione parte/u);

          // Simulated tab/app return cannot revoke the early valid File.
          await page.evaluate(() => {
            window.dispatchEvent(new Event("blur"));
            document.dispatchEvent(new Event("visibilitychange"));
            window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
          });
          releaseModule();
          await page.locator("[data-home-file-status]").getByText(expected).waitFor({ timeout: 10_000 });
          assert.equal(await input.inputValue(), "", `${engineName} ${width}px input reset permits same-file reselect`);
          const links = await page.locator("[data-home-file-action-format]:visible a")
            .evaluateAll(nodes => nodes.map(node => node.getAttribute("href")));
          assert(links.includes(route), `${engineName} ${width}px correct local suggestion from early Blob File`);

          // Dismissing the other actual file chooser preserves the completed
          // selection, and selecting the same File again works without upload.
          const other = page.locator(selectedPhotos ? "[data-home-file-picker]" : "[data-home-photos-picker]");
          const cancel = page.waitForEvent("filechooser");
          await other.click();
          await (await cancel).setFiles([]);
          await other.dispatchEvent("cancel");
          assert((await page.locator("[data-home-file-action-format]:visible a")
            .evaluateAll(nodes => nodes.map(node => node.getAttribute("href")))).includes(route));
          const again = page.waitForEvent("filechooser");
          await input.click();
          await (await again).setFiles(chosenFile);
          await page.locator("[data-home-file-status]").getByText(expected).waitFor({ timeout: 10_000 });
          assert.deepEqual(nonGetRequests, [], `${engineName} ${width}px must not upload`);
          assert.deepEqual(pageErrors, [], `${engineName} ${width}px page errors`);
          console.log(`#336 early-selection ${engineName} ${width}px PASS (${selectedPhotos ? "Photos PNG" : "Files PDF"}, cancel & reselect, no upload)`);
        } finally {
          releaseModule();
          await context.close();
        }
      }
    } finally { await browser.close(); }
  }
  console.log("NOT_RUN #336 physical iOS Safari Photos, Android Chrome Files, real OS permissions and app return.");
} finally {
  await new Promise(done => server.close(done));
}

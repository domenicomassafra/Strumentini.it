/** #99 / STR-212: real built-site GIF first-frame download, independent pixels.
 * Start `npx astro preview --host 127.0.0.1 --port 19579` after `npm run build`,
 * then set IMAGE212_BUILT_ORIGIN=http://127.0.0.1:19579 and run this script.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { chromium, firefox, webkit } from "@playwright/test";

const origin = process.env.IMAGE212_BUILT_ORIGIN;
if (!origin || !/^http:\/\/127\.0\.0\.1:\d+$/u.test(origin)) {
  throw new Error("IMAGE212_BUILT_ORIGIN must point to the local pre-built static preview");
}
const root = resolve(import.meta.dirname, "..");
const still = await readFile(resolve(root, "quality/fixtures/image-format-matrix/source.gif"));
const partial = Buffer.from(still);
partial.set([4, 0, 3, 0], 6); // 4x3 transparent logical canvas
const imageAt = partial.indexOf(0x2c, 30);
assert(imageAt > 0);
partial.set([1, 0, 1, 0], imageAt + 1); // 2x2 frame starts at (1,1)
const animated = await readFile(resolve(root, "spikes/heavy-local-feasibility/public/corpus/sample-animated.gif"));
const cases = [
  { name: "offset-first-frame.gif", source: partial, frames: 1, delays: 0 },
  { name: "animated-first-frame.gif", source: animated, frames: 4, delays: 100 },
];
let checks = 0;
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    for (const entry of cases) {
      const oracle = await sharp(entry.source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const page = await context.newPage();
      const offsite = [];
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", route => {
        const request = route.request();
        if (["GET", "HEAD"].includes(request.method()) &&
            (request.url().startsWith(origin + "/") || /^(blob|data):/u.test(request.url()))) return route.continue();
        offsite.push(`${request.method()} ${request.url()}`);
        return route.abort();
      });
      const response = await page.goto(origin + "/tools/image-format-conversion/", { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200);
      await page.waitForFunction(() => {
        const island = document.querySelector('astro-island[component-url*="ImageFormatConversionTool"]');
        return island && !island.hasAttribute("ssr");
      }, null, { timeout: 60_000 });
      await page.locator('form input[type="file"]').first().setInputFiles({ name: entry.name, mimeType: "image/gif", buffer: entry.source });
      await page.getByRole("button", { name: "Esegui in locale" }).click();
      const link = page.locator('[data-result-class="image"] a[download$=".png"]').first();
      await link.waitFor({ timeout: 20_000 });
      const metrics = await page.locator('[data-result-slot="media-metrics"]').innerText();
      assert.match(metrics, new RegExp(`${entry.frames} frame`));
      assert.match(metrics, new RegExp(`${entry.delays} centesimi`));
      assert.match(metrics, /animazione non esportata/u);
      const pending = page.waitForEvent("download");
      await link.click();
      const download = await pending;
      assert.match(download.suggestedFilename(), /\.png$/u);
      const bytes = await readFile(await download.path());
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      const reopened = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([reopened.info.width, reopened.info.height], [oracle.info.width, oracle.info.height]);
      assert.deepEqual(reopened.data, oracle.data, `${name} ${entry.name}: RGBA differs from independent GIF decoder`);
      assert.deepEqual(offsite, [], `${name}: unexpected offsite/non-GET task requests`);
      assert.deepEqual(errors, [], `${name}: uncaught browser errors`);
      checks += 8;
      console.log(`PASS #212 built ${name}: ${entry.name}, ${entry.frames} frame(s), ${entry.delays} cs, PNG download RGBA=${reopened.data.length} bytes`);
      await page.close();
    }
    await context.close();
  } finally { await browser.close(); }
}
console.log(`PASS #212 compiled-site GIF conversion ${checks}/${checks} checks, three desktop browsers; physical iPhone/Android NOT_RUN`);

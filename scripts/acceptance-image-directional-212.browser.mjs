/** #212 real browser acceptance for first-frame GIF→PNG, not animation preserving. */
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const cases = [
  { file: "spikes/heavy-local-feasibility/public/corpus/sample-animated.gif", animated: true, frames: 4, width: 64, height: 64 },
  { file: "quality/fixtures/image-format-matrix/source.gif", animated: false, frames: 1, width: 2, height: 2 },
];
const examples = await Promise.all(cases.map(async entry => ({
  ...entry, base64: (await readFile(resolve(root, entry.file))).toString("base64"),
})));
const avif = (await readFile(resolve(root, "quality/fixtures/image-format-matrix/source.avif"))).toString("base64");
const vite = await createServer({
  configFile: false, root, logLevel: "error",
  server: { host: "127.0.0.1", port: 0, strictPort: false },
  plugins: [{ name: "acceptance-gif-212", configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== "/__acceptance-gif-212") return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end('<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>GIF first-frame isolated engine #212</body></html>');
    });
  } }],
});
let checks = 0;
try {
  await vite.listen();
  const address = vite.httpServer?.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const unexpectedRequests = [], jsErrors = [];
      page.on("request", req => {
        if (!req.url().startsWith(origin) && !req.url().startsWith("data:") && !req.url().startsWith("blob:")) unexpectedRequests.push(req.url());
      });
      page.on("pageerror", err => jsErrors.push(err.message));
      assert.equal((await page.goto(`${origin}/__acceptance-gif-212`))?.status(), 200);
      for (const entry of examples) {
        const proof = await page.evaluate(async ({ base64, animated }) => {
          const { gifFirstFrameToPng212 } = await import("/src/engines/image/directional-212.ts");
          const bytes = Uint8Array.from(atob(base64), x => x.charCodeAt(0));
          const source = new Blob([bytes], { type: "image/gif" });
          let refusedWithoutConsent = false;
          if (animated) {
            try { await gifFirstFrameToPng212(source); }
            catch (err) { refusedWithoutConsent = String(err).includes("IMAGE_212_ANIMATION_LOSS_NOT_ACKNOWLEDGED"); }
          }
          const output = await gifFirstFrameToPng212(source, { allowAnimationLoss: animated });
          const pixels = async (blob) => {
            const bitmap = await createImageBitmap(blob);
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
            return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
          };
          const gifPixels = await pixels(source);
          const pngPixels = await pixels(new Blob([output.png], { type: "image/png" }));
          const controller = new AbortController(); controller.abort();
          let abortRefused = false;
          try { await gifFirstFrameToPng212(source, { allowAnimationLoss: animated, signal: controller.signal }); }
          catch (err) { abortRefused = err?.name === "AbortError"; }
          return {
            frames: output.frameCount, width: output.width, height: output.height,
            firstPixelParity: gifPixels.every((byte, index) => byte === pngPixels[index]),
            delays: output.frameDelaysCentiseconds, discarded: output.animationDiscarded,
            framePolicy: output.framePolicy, prefix: Array.from(output.png.subarray(0, 8)),
            refusedWithoutConsent, abortRefused,
          };
        }, entry);
        assert.equal(proof.firstPixelParity, true);
        assert.deepEqual([proof.frames, proof.width, proof.height], [entry.frames, entry.width, entry.height]);
        assert.deepEqual(proof.prefix, [137, 80, 78, 71, 13, 10, 26, 10]);
        assert.equal(proof.discarded, entry.animated);
        assert.equal(proof.framePolicy, "first-frame-only");
        assert.equal(proof.refusedWithoutConsent, entry.animated);
        assert.equal(proof.abortRefused, true);
        if (entry.animated) assert.deepEqual(proof.delays, [25, 25, 25, 25]);
        checks += entry.animated ? 8 : 7;
        console.log(`${engine.name()} ${entry.animated ? "animated" : "still"} GIF first frame: pixels/alpha=${proof.firstPixelParity}, ${entry.frames} source frame(s) PASS`);
      }
      const avifProbe = await page.evaluate(async encoded => {
        const { probeAvifDecode212 } = await import("/src/engines/image/directional-212.ts");
        const blob = new Blob([Uint8Array.from(atob(encoded), x => x.charCodeAt(0))], { type: "image/avif" });
        const observed = await probeAvifDecode212(blob);
        return { supports: observed.runtimeDecodeSupported, approved: observed.productionApproved, format: observed.format };
      }, avif);
      assert.equal(avifProbe.approved, false);
      assert.equal(avifProbe.format, "avif");
      assert.deepEqual(unexpectedRequests, []);
      assert.deepEqual(jsErrors, []);
      checks += 4;
      console.log(`${engine.name()} native AVIF decode probe=${avifProbe.supports ? "yes" : "no"}, production approval=false`);
    } finally { await browser.close(); }
  }
  console.log(`PASS #212 isolated browser GIF and AVIF probe ${checks}/${checks} checks, physical-device HEIC=NOT_RUN`);
} finally { await vite.close(); }

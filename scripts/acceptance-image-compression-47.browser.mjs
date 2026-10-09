/** Browser and independent Sharp decoder acceptance for #047 PNG-IDAT subset. */
import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium, firefox, webkit } from "@playwright/test";
import sharp from "sharp";

const width = 160;
const height = 112;
const root = resolve(import.meta.dirname, "..");
const examples = await Promise.all([false, true].map(async (withAlpha) => {
  const channels = withAlpha ? 4 : 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * channels;
      pixels[at] = (x + y) & 255;
      pixels[at + 1] = (x * 2) & 255;
      pixels[at + 2] = (y * 3) & 255;
      if (withAlpha) pixels[at + 3] = (x * 3 + y * 2) & 255;
    }
  }
  const original = await sharp(pixels, { raw: { width, height, channels } })
    .png({ compressionLevel: 0, palette: false }).toBuffer();
  return { name: withAlpha ? "RGBA" : "RGB", original, pixels, channels };
}));

const vite = await createServer({
  configFile: false,
  root, logLevel: "error",
  server: { host: "127.0.0.1", port: 0, strictPort: false },
  plugins: [{ name: "acceptance-png-47-page", configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== "/__acceptance-png-47") return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>PNG verification #047</body></html>');
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
      const offsite = [];
      const pageErrors = [];
      page.on("request", request => {
        if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) offsite.push(request.url());
      });
      page.on("pageerror", error => pageErrors.push(error.message));
      assert.equal((await page.goto(`${origin}/__acceptance-png-47`))?.status(), 200);
      for (const entry of examples) {
        const browserProof = await page.evaluate(async ({ encoded, withAlpha }) => {
          const { compressPngLossless47 } = await import("/src/engines/image/png-lossless-47.ts");
          const input = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
          const source = new Blob([input], { type: "image/png" });
          const result = await compressPngLossless47(source);
          const output = new Uint8Array(await result.blob.arrayBuffer());
          const decode = async (blob) => {
            const bitmap = await createImageBitmap(blob);
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
            return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
          };
          const originalPixels = await decode(source);
          const compressedPixels = await decode(result.blob);
          const controller = new AbortController(); controller.abort();
          let abortRefused = false;
          try { await compressPngLossless47(source, controller.signal); }
          catch (error) { abortRefused = error?.name === "AbortError"; }
          return {
            mode: withAlpha ? "RGBA" : "RGB", inputBytes: input.length,
            outputBytes: output.length, savedBytes: result.savedBytes,
            dimensions: [result.width, result.height], hasAlphaChannel: result.hasAlphaChannel,
            proof: result.pixelVerification, exactCanvasPixels: originalPixels.every((byte, i) => byte === compressedPixels[i]),
            abortRefused, base64: btoa(Array.from(output, byte => String.fromCharCode(byte)).join("")),
          };
        }, { encoded: entry.original.toString("base64"), withAlpha: entry.channels === 4 });
        const exported = Buffer.from(browserProof.base64, "base64");
        const independentlyDecoded = await sharp(exported).raw().toBuffer({ resolveWithObject: true });
        assert.equal(browserProof.exactCanvasPixels, true);
        assert.deepEqual([...browserProof.dimensions, browserProof.hasAlphaChannel ? 4 : 3], [width, height, entry.channels]);
        assert.equal(browserProof.proof, "exact-filtered-scanlines");
        assert.equal(browserProof.abortRefused, true);
        assert(exported.length < entry.original.length);
        assert.equal(browserProof.savedBytes, entry.original.length - exported.length);
        assert.equal(independentlyDecoded.info.channels, entry.channels);
        assert.deepEqual(independentlyDecoded.data, entry.pixels);
        checks += 8;
        console.log(`${engine.name()} ${entry.name}: ${entry.original.length}→${exported.length} bytes; exact browser pixels + Sharp raw PASS`);
      }
      assert.deepEqual(offsite, []);
      assert.deepEqual(pageErrors, []);
      checks += 2;
    } finally { await browser.close(); }
  }
  console.log(`PASS #047 browser actual PNG recompression ${checks}/${checks} assertions; no physical mobile claimed`);
} finally {
  await vite.close();
}

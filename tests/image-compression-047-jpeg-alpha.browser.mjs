import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const width = 24;
const height = 16;
const rgba = Buffer.alloc(width * height * 4);
for (let p = 0; p < width * height; p++) {
  rgba[p * 4] = 55;
  rgba[p * 4 + 1] = 150;
  rgba[p * 4 + 2] = 205;
  rgba[p * 4 + 3] = p % 3 === 0 ? 0 : p % 3 === 1 ? 127 : 255;
}
const transparent = await sharp(rgba, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 0 }).toBuffer();
const opaque = await sharp(rgba, { raw: { width, height, channels: 4 } }).flatten({ background: "#ffffff" }).png().toBuffer();
const server = await createServer({
  configFile: false,
  root,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{
    name: "jpeg-alpha-47",
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url !== "/__jpeg-alpha-47") return next();
        res.setHeader("Content-Type", "text/html");
        res.end("<!doctype html><html><body>JPEG alpha verification</body></html>");
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const offsite = [];
  page.on("request", req => {
    if (!req.url().startsWith(origin) && !req.url().startsWith("blob:") && !req.url().startsWith("data:")) offsite.push(req.url());
  });
  assert.equal((await page.goto(origin + "/__jpeg-alpha-47"))?.status(), 200);
  const result = await page.evaluate(async ({ source, control }) => {
    const { compressImageLocal } = await import("/src/engines/image/visual-tools.ts");
    const makeFile = (b64, name) => new File([
      Uint8Array.from(atob(b64), c => c.charCodeAt(0)),
    ], name, { type: "image/png" });
    const modes = [
      { file: makeFile(source, "transparent.png"), mime: "image/jpeg", quality: 0.7 },
      { file: makeFile(source, "transparent.png"), mime: "image/jpeg", quality: 0.7, targetKiB: 10 },
      { file: makeFile(control, "opaque.png"), mime: "image/jpeg", quality: 0.7 },
    ];
    return Promise.all(modes.map(async (options) => {
      try {
        const output = await compressImageLocal(options);
        const bytes = new Uint8Array(await output.blob.arrayBuffer());
        return { accepted: true, bytes: [...bytes], mime: output.outputMime, dimensions: [output.width, output.height] };
      } catch (error) {
        return { accepted: false, error: String(error?.message ?? error) };
      }
    }));
  }, { source: transparent.toString("base64"), control: opaque.toString("base64") });
  for (const item of result.slice(0, 2)) {
    assert.equal(item.accepted, false, "transparent PNG JPEG compression must refuse silent alpha flattening");
    assert.match(item.error, /JPEG_ALPHA_BACKGROUND_REQUIRED/);
  }
  const valid = result[2];
  assert.equal(valid.accepted, true, valid.error);
  assert.equal(valid.mime, "image/jpeg");
  assert.deepEqual(valid.dimensions, [width, height]);
  const checked = await sharp(Buffer.from(valid.bytes)).raw().toBuffer({ resolveWithObject: true });
  assert.equal(checked.info.width, width);
  assert.equal(checked.info.height, height);
  assert.deepEqual(offsite, []);
  console.log("PASS #81 alpha refusal default/target and valid opaque JPEG independently decoded (3/3)");
} finally {
  if (browser) await browser.close();
  await server.close();
}

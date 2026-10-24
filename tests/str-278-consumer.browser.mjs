/** STR-278 compiled consumer acceptance in macOS WebKit (NOT native iOS Safari). */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import sharp from "sharp";
import { webkit, devices } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".wasm": "application/wasm" };

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const path = resolve(dist, pathname.replace(/^\/+/, ""), pathname.endsWith("/") ? "index.html" : "");
    if (!path.startsWith(dist + sep)) return response.writeHead(403).end();
    const file = (await stat(path)).isDirectory() ? resolve(path, "index.html") : path;
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
const origin = await new Promise((done, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", () => done(`http://127.0.0.1:${server.address().port}`));
});

const raw = Buffer.alloc(160 * 120 * 3);
for (let y = 0; y < 120; y++) {
  for (let x = 0; x < 160; x++) {
    const at = (y * 160 + x) * 3;
    if (x < 80) { raw[at] = 240; raw[at + 1] = 20; raw[at + 2] = 20; }
    else { raw[at] = 20; raw[at + 1] = 20; raw[at + 2] = 240; }
  }
}
const png = await sharp(raw, { raw: { width: 160, height: 120, channels: 3 } }).png().toBuffer();
const orientedJpeg = await sharp(raw, { raw: { width: 160, height: 120, channels: 3 } })
  .jpeg({ quality: 100 }).withMetadata({ orientation: 6 }).toBuffer();

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const cases = [
    { name: "left-right.png", mime: "image/png", buffer: png, width: 80, height: 60, vertical: false },
    { name: "exif-6.jpg", mime: "image/jpeg", buffer: orientedJpeg, width: 90, height: 120, vertical: true },
  ];
  const results = [];
  for (const fixture of cases) {
    const context = await browser.newContext({ ...devices["iPhone 17"], acceptDownloads: true });
    try {
      const page = await context.newPage();
      const offsite = [], uploads = [], errors = [];
      page.on("request", (req) => {
        if (!req.url().startsWith(origin + "/") && !req.url().startsWith("blob:") && !req.url().startsWith("data:")) offsite.push(req.url());
        if (!["GET", "HEAD"].includes(req.method())) uploads.push(req.method());
      });
      page.on("pageerror", (err) => errors.push(err.message));
      assert.equal((await page.goto(origin + "/tools/image-resize/"))?.status(), 200);
      const input = page.locator("#image-resize-file");
      await input.setInputFiles({ name: fixture.name, mimeType: fixture.mime, buffer: fixture.buffer });
      await page.locator("[data-resize-estimate]").waitFor();
      await page.getByLabel("Larghezza", { exact: true }).fill(String(fixture.width));
      await page.getByLabel("Altezza", { exact: true }).fill(String(fixture.height));
      const inputSha = async () => page.evaluate(async () => {
        const buffer = await document.querySelector("#image-resize-file").files[0].arrayBuffer();
        const sum = await crypto.subtle.digest("SHA-256", buffer);
        return [...new Uint8Array(sum)].map((value) => value.toString(16).padStart(2, "0")).join("");
      });
      assert.equal(await inputSha(), sha(fixture.buffer), "input bytes before resize");
      await page.getByRole("button", { name: "Ridimensiona", exact: true }).click();
      const link = page.locator("a[download]").first();
      await link.waitFor({ timeout: 60_000 });
      const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
      const output = await readFile(await download.path());
      const meta = await sharp(output).metadata();
      assert.equal(meta.format, "jpeg");
      assert.equal(meta.width, fixture.width);
      assert.equal(meta.height, fixture.height);
      assert.ok(!meta.orientation || meta.orientation === 1, "output must normalize EXIF orientation");
      assert.ok(output.length > 100, "nonempty independently reopened download");
      assert.deepEqual([...output.subarray(0, 3)], [0xff, 0xd8, 0xff]);
      const { data, info } = await sharp(output).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const sample = (x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
      const first = fixture.vertical ? sample(45, 8) : sample(8, 30);
      const second = fixture.vertical ? sample(45, 110) : sample(72, 30);
      assert.ok(first[0] > first[2] + 100, `red pixel changed orientation: ${first}`);
      assert.ok(second[2] > second[0] + 100, `blue pixel changed orientation: ${second}`);
      assert.equal(await inputSha(), sha(fixture.buffer), "input bytes after resize");
      assert.deepEqual(offsite, []);
      assert.deepEqual(uploads, []);
      assert.deepEqual(errors, []);
      results.push({ input: fixture.name, inputSha256: sha(fixture.buffer), outputSha256: sha(output),
        outputBytes: output.length, mime: "image/jpeg", width: meta.width, height: meta.height,
        orientation: meta.orientation ?? 1, independentPixelCheck: "PASS", networkUploads: 0 });
    } finally { await context.close(); }
  }
  console.log(JSON.stringify({ status: "PASS", evidenceKind: "MACOS_WEBKIT_IPHONE_PROFILE",
    nativeIosSimulatorPickerObserved: false, buildSha: process.env.STR278_BUILD_SHA ?? null,
    results }, null, 2));
} catch (error) {
  console.error("STR-278 consumer FAIL:", error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}

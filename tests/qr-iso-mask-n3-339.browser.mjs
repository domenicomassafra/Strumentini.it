import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import sharp from "sharp";

// Requires a compiled `dist` served locally and the existing pinned #278 spike:
// npm ci --prefix spikes/heavy-browser
// node tests/qr-iso-mask-n3-339.browser.mjs http://127.0.0.1:4939
const base = (process.argv[2] ?? "http://127.0.0.1:4939").replace(/\/$/u, "");
const requireSpike = createRequire(new URL("../spikes/heavy-browser/package.json", import.meta.url));
const jsQR = requireSpike("jsqr");
assert.equal(requireSpike("jsqr/package.json").version, "1.4.0");

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
const outgoing = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (!request.url().startsWith(base + "/") || !["GET", "HEAD"].includes(request.method())) {
    outgoing.push(`${request.method()} ${request.url()}`);
  }
});

try {
  const payload = "https://strumentini.it";
  const response = await page.goto(`${base}/tools/qr-generator/`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);
  await page.getByRole("textbox", { name: "Contenuto da codificare" }).fill(payload);
  await page.getByRole("button", { name: "Genera codice QR" }).click();
  const maskField = page.locator("dt", { hasText: "Maschera" }).locator("xpath=following-sibling::dd[1]");
  await maskField.waitFor({ timeout: 15_000 });
  assert.match(await maskField.innerText(), /^0 \(scelta automaticamente/u);

  const image = page.getByRole("img", { name: /Codice QR del contenuto/u });
  await image.waitFor();
  const inline = await image.getAttribute("src");
  assert(inline?.startsWith("data:image/svg+xml,"));
  const shownSvg = decodeURIComponent(inline.slice("data:image/svg+xml,".length));
  assert.match(shownSvg, /data-matrix="[01;]+"/u);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /SVG/u }).click(),
  ]);
  assert(download.suggestedFilename().endsWith(".svg"));
  const savedSvg = await readFile(await download.path(), "utf8");
  assert.equal(savedSvg, shownSvg, "Downloaded SVG must be the same generated symbol shown to the user");

  const { data, info } = await sharp(Buffer.from(savedSvg), { limitInputPixels: 1_000_000 })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height, { inversionAttempts: "dontInvert" });
  assert.equal(decoded?.data, payload, "Independent jsQR must decode the real SVG download");
  assert.deepEqual(errors, []);
  assert.deepEqual(outgoing, [], "QR must remain local without uploads or external requests");
  console.log(JSON.stringify({
    result: "PASS", page: "/tools/qr-generator/", viewport: "390x844", mask: 0,
    download: download.suggestedFilename(), independentReader: "jsQR@1.4.0", payload,
    pageErrors: errors.length, outgoingRequests: outgoing.length,
  }));
} finally {
  await context.close();
  await browser.close();
}

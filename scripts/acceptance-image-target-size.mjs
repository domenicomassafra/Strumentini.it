import { chromium, firefox, webkit } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const port = Number(process.env.STRUMENTINI_ACCEPTANCE_PORT ?? 18410);
const origin = `http://127.0.0.1:${port}`;
const root = resolve(import.meta.dirname, "..");
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Static preview failed to start");
}

/** A genuine browser-generated noisy image, not a copy of a gold oracle. */
async function chooseFixture(page) {
  await page.locator("form input[type=file]").first().evaluate(async (input) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 320;
    const context = canvas.getContext("2d");
    if (!context) throw Error("Canvas unavailable");
    const pixels = context.createImageData(320, 320);
    let seed = 0x25A7;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels.data[i] = seed & 255;
      pixels.data[i + 1] = (seed >>> 8) & 255;
      pixels.data[i + 2] = (seed >>> 16) & 255;
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const blob = await new Promise((resolveBlob) => canvas.toBlob(resolveBlob, "image/png"));
    if (!blob) throw Error("PNG fixture encoder failed");
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "target-noise.png", { type: "image/png" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function chooseMixedBatch(page) {
  await page.locator("form input[type=file]").first().evaluate(async (input) => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 160;
    const context = canvas.getContext("2d");
    if (!context) throw Error("Canvas unavailable");
    const pixels = context.createImageData(160, 160);
    let seed = 0x42A7;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels.data[i] = seed & 255;
      pixels.data[i + 1] = (seed >>> 8) & 255;
      pixels.data[i + 2] = (seed >>> 16) & 255;
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const makeBlob = (mime) => new Promise((done) => canvas.toBlob(done, mime));
    const png = await makeBlob("image/png");
    const jpeg = await makeBlob("image/jpeg");
    if (!png || !jpeg) throw Error("Missing browser encoders");
    const dt = new DataTransfer();
    dt.items.add(new File([png], "first.png", { type: "image/png" }));
    dt.items.add(new File([new Uint8Array([1, 2, 3])], "damaged.png", { type: "image/png" }));
    dt.items.add(new File([jpeg], "last.jpg", { type: "image/jpeg" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

let checks = 0;
try {
  await waitForServer();
  for (const [browserName, browserType] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      const page = await context.newPage();
      const offsite = [];
      page.on("request", (req) => {
        if (!req.url().startsWith(origin) && !req.url().startsWith("blob:") && !req.url().startsWith("data:")) offsite.push(req.url());
      });
      await page.goto(`${origin}/tools/image-compression/`, { waitUntil: "networkidle" });
      const form = page.locator("form").last();
      await chooseFixture(page);
      await form.getByLabel("Formato di uscita").selectOption("image/jpeg");
      const target = form.getByLabel("Dimensione massima, in KiB");
      await target.fill("1");
      await form.getByRole("button", { name: "Esegui in locale" }).click();
      await page.getByText("No: restituito il tentativo più piccolo").waitFor({ timeout: 20000 });
      const failedDownload = page.locator('[data-result-class="image"] a[download]').first();
      await failedDownload.waitFor();
      const failEvent = page.waitForEvent("download");
      await failedDownload.click();
      const failedBytes = await readFile(await (await failEvent).path());
      if (failedBytes.length <= 1024) throw Error(`${browserName}: impossible 1 KiB limit was marked unmet but downloaded ${failedBytes.length} bytes`);
      if (!failedBytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) throw Error(`${browserName}: invalid JPEG signature`);
      checks += 2;

      await target.fill("500");
      await form.getByRole("button", { name: "Esegui in locale" }).click();
      await page.getByText("Sì: dimensione effettiva verificata").waitFor({ timeout: 20000 });
      const successDownload = page.locator('[data-result-class="image"] a[download]').first();
      await successDownload.waitFor();
      const successEvent = page.waitForEvent("download");
      await successDownload.click();
      const successBytes = await readFile(await (await successEvent).path());
      if (successBytes.length > 500 * 1024) throw Error(`${browserName}: output exceeds claimed 500 KiB target`);
      if (!successBytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) throw Error(`${browserName}: invalid successful JPEG signature`);
      checks += 2;

      if (offsite.length > 0) throw Error(`${browserName}: offsite requests: ${offsite.join(", ")}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      if (overflow) throw Error(`${browserName}: 390 px horizontal overflow`);
      checks += 2;

      await form.getByLabel("Unità obiettivo").selectOption("MiB");
      await form.getByLabel("Dimensione massima, in MiB").fill("0.5");
      await form.getByRole("button", { name: "Esegui in locale" }).click();
      await page.getByText("Sì: dimensione effettiva verificata").waitFor({ timeout: 20000 });
      const mibEvent = page.waitForEvent("download");
      await page.locator('[data-result-class="image"] a[download]').first().click();
      const mibBytes = await readFile(await (await mibEvent).path());
      if (mibBytes.length > 512 * 1024) throw Error(`${browserName}: MiB conversion failed`);
      checks += 1;

      await form.getByLabel("Comprimi più immagini in coda (massimo 8, JPEG/PNG/WebP)").check();
      await chooseMixedBatch(page);
      await form.getByLabel("Dimensione massima, in MiB").fill("");
      await form.getByRole("button", { name: "Esegui in locale" }).click();
      await page.locator("[data-batch-failures] li").first().waitFor({ timeout: 20000 });
      const errors = await page.locator("[data-batch-failures] li").allTextContents();
      if (errors.length !== 1 || !errors[0].includes("damaged.png")) throw Error(`${browserName}: corrupt image not isolated: ${errors}`);
      if (await page.locator("[data-image-batch-details] li").count() !== 2) throw Error(`${browserName}: missing per-file savings rows`);
      const zipLink = page.getByRole("link", { name: "Scarica tutte le immagini riuscite (ZIP)" });
      await zipLink.waitFor();
      const zipEvent = page.waitForEvent("download");
      await zipLink.click();
      const zipBytes = await readFile(await (await zipEvent).path());
      const archive = unzipSync(new Uint8Array(zipBytes));
      const entries = Object.entries(archive);
      if (entries.length !== 2) throw Error(`${browserName}: ZIP must contain exactly 2 successful files`);
      if (!entries.some(([name, data]) => name.startsWith("01-") && data[0] === 0x89)
        || !entries.some(([name, data]) => name.startsWith("03-") && data[0] === 0xff)) {
        throw Error(`${browserName}: ZIP output signatures/order mismatch`);
      }
      if (offsite.length > 0) throw Error(`${browserName}: offsite requests from image job`);
      checks += 3;
      console.log(`${browserName}: PASS, target and mixed-batch ZIP / isolation / signatures / local only / 390px`);
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`tickets 210+211+48 browser acceptance PASS: ${checks}/30 checks`);
} finally {
  server.kill("SIGTERM");
}

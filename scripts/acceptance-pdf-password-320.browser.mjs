import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, firefox, webkit } from "@playwright/test";
import { createPdfToolkit } from "../src/engines/pdf/vendor/pdfstudio/index.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const origin = process.env.PDF320_BROWSER_ORIGIN ?? "http://127.0.0.1:4381";
const toolkit = await createPdfToolkit();
const source = new Uint8Array(readFileSync(new URL("../quality/fixtures/pdf-gold/simple-2page.pdf", import.meta.url)));
const locked = await toolkit.lock(source, { userPassword: "320-user-fixture", ownerPassword: "320-owner-fixture", keyLength: 256 });
if (!(await toolkit.isEncrypted(locked))) throw new Error("Fixture wasn't encrypted");

const browserName = process.env.PDF320_BROWSER ?? "chromium";
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error("Use PDF320_BROWSER=chromium|firefox|webkit");
const browser = await browserType.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await context.newPage();
const requests = [];
const errors = [];
const consoleErrors = [];
const responses = [];
let workerCreated = 0;
let workerClosed = 0;
page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("response", (response) => { if (response.status() >= 400) responses.push({ status: response.status(), url: response.url() }); });
page.on("worker", (worker) => { workerCreated++; worker.on("close", () => workerClosed++); });

try {
  await page.goto(origin + "/tools/pdf-password-check-remove/", { waitUntil: "domcontentloaded" });
  // Astro SSR controls exist before Preact event handlers have hydrated.
  await page.waitForFunction(() => [...document.querySelectorAll("astro-island")].every((item) => !item.hasAttribute("ssr")), null, { timeout: 30_000 });
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "aes-256-real.pdf", mimeType: "application/pdf", buffer: Buffer.from(locked) });
  await page.getByLabel("Modalità").selectOption("remove");
  await page.getByLabel("Password per sbloccare il PDF").fill("320-user-fixture");
  await page.getByRole("button", { name: "Crea PDF senza cifratura" }).click();

  const downloadLink = page.locator('[data-result-slot="file-workspace"] a').filter({ hasText: "Scarica" }).first();
  await downloadLink.waitFor({ state: "visible", timeout: 18_000 }).catch(async (error) => {
    const diagnostic = { formText: (await page.locator("form.tool-operation").innerText()).slice(0,2500), pageErrors: errors, consoleErrors, responses, requests: requests.slice(-20), workers: { workerCreated, workerClosed } };
    throw new Error(JSON.stringify(diagnostic), { cause: error });
  });
  const eventPromise = page.waitForEvent("download");
  await downloadLink.click();
  const download = await eventPromise;
  const downloaded = new Uint8Array(readFileSync(await download.path()));
  if (await toolkit.isEncrypted(downloaded)) throw new Error("Downloaded PDF remains encrypted");
  const load = getDocument({ data: Uint8Array.from(downloaded), useSystemFonts: true, disableFontFace: true });
  try {
    const doc = await load.promise;
    if (doc.numPages !== 2) throw new Error("Downloaded PDF page count isn't 2");
  } finally { await load.destroy(); }
  if ((await page.getByLabel("Password per sbloccare il PDF").inputValue()) !== "") throw new Error("Password input not cleared");
  const firstWorkerCount = workerCreated;

  await fileInput.setInputFiles({ name: "aes-256-real.pdf", mimeType: "application/pdf", buffer: Buffer.from(locked) });
  await page.getByLabel("Password per sbloccare il PDF").fill("wrong-320-fixture");
  await page.getByRole("button", { name: "Crea PDF senza cifratura" }).click();
  await page.getByRole("alert").filter({ hasText: "Password PDF non corretta." }).waitFor({ timeout: 40_000 });
  if (await page.locator('[data-result-slot="file-workspace"] a').count()) throw new Error("Wrong password generated a download");

  await page.getByLabel("Modalità").selectOption("check");
  await page.getByRole("button", { name: "Controlla cifratura" }).click();
  await page.getByText("PDF cifrato", { exact: true }).waitFor({ timeout: 10_000 });

  await page.waitForTimeout(300);
  const outbound = requests.filter(({ url, method }) => new URL(url).origin !== origin || method !== "GET");
  const wasmLoaded = requests.some(({ url }) => /qpdf[^/]*\.wasm(?:\?|$)/u.test(url));
  if (outbound.length !== 0 || errors.length !== 0 || !wasmLoaded || workerCreated < 2 || workerCreated !== workerClosed) {
    throw new Error(JSON.stringify({ outbound, errors, wasmLoaded, workerCreated, workerClosed, firstWorkerCount }));
  }
  const output = {
    ok: true, browser: browserName, url: origin + "/tools/pdf-password-check-remove/", viewport: "390x844",
    wasmLoadedSameOrigin: wasmLoaded, encryptedFixture: true, wrongPasswordRefused: true,
    downloadedDecryptedBytes: downloaded.length, independentlyReopenedPages: 2,
    workersCreated: workerCreated, workersClosed: workerClosed, outboundRequests: outbound.length, pageErrors: errors.length,
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  };
  mkdirSync(".scratch/strumentini-expansion-20261005/evidence", { recursive: true });
  writeFileSync(`.scratch/strumentini-expansion-20261005/evidence/320-password-${browserName}-browser.json`, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output));
  // Emscripten's Node glue leaves process.exitCode=2 after some qpdf commands
  // despite independently verified success. Only normalize after every assertion.
  process.exitCode = 0;
} finally {
  await context.close();
  await browser.close();
}

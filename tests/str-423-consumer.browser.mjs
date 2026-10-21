import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.P7M_176_PORT ?? 18576);
const origin = "http://127.0.0.1:" + port;
const route = origin + "/tools/p7m-extract/";
const corpus = resolve(root, "quality/fixtures/p7m-cms-176");
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const violations = [];
const originalInputs = new Map();
for (const name of ["documento-pdf.p7m", "documento-scaduto.p7m", "documento-manomesso.p7m", "troncato.p7m", "detached-senza-contenuto.p7m"]) {
  originalInputs.set(name, await readFile(resolve(corpus, name)));
}
let browser;
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function ready() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(route);
      if (response.ok && (await response.text()).includes("p7m-extract-file")) return;
    } catch { /* server starting */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Compiled P7M route missing from dist");
}
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", (error) => violations.push("PAGEERROR " + error.message));
  page.on("request", (request) => {
    if (!(request.url().startsWith(origin + "/") || request.url().startsWith("blob:") || request.url().startsWith("data:"))) {
      violations.push("NETWORK " + request.url());
    }
  });
  await page.route("**/*", async (routeRequest) => {
    if (!(routeRequest.request().url().startsWith(origin + "/") || routeRequest.request().url().startsWith("blob:") || routeRequest.request().url().startsWith("data:"))) {
      await routeRequest.abort();
    } else await routeRequest.continue();
  });
  await page.goto(route, { waitUntil: "networkidle" });
  await page.locator("#p7m-extract-file").waitFor({ timeout: 30000 }).catch(async (error) => { throw new Error(error.message + " | PAGEERRORS: " + violations.join("; ")); });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px page overflows");
  const notice = page.locator("[data-p7m-notice]");
  assert(await notice.isVisible(), "Unverified-signature notice is not visible before extraction");
  assert((await notice.innerText()).includes("firma NON verificata"), "Notice does not state the signature is NOT verified");

  await page.locator("#p7m-extract-file").setInputFiles(resolve(corpus, "documento-pdf.p7m"));
  await page.getByRole("button", { name: "Estrai il documento" }).click();
  await page.locator("[data-p7m-extraction]").waitFor({ timeout: 30000 });
  assert(await notice.isVisible(), "Notice disappeared after a successful extraction");
  const bytes = await page.locator("[data-p7m-bytes]").innerText();
  assert(bytes.includes("192 byte") && bytes.includes("application/pdf"), "Wrong extracted content summary: " + bytes);
  const signers = await page.locator("[data-p7m-signers]").innerText();
  assert(signers.includes("NON verificati"), "Signer line hides the unverified state: " + signers);

  const download = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("button", { name: "Scarica il documento estratto" }).click();
  const exported = await download;
  const downloaded = await readFile(await exported.path());
  const expected = await readFile(resolve(corpus, "inner.pdf"));
  assert(exported.suggestedFilename() === "documento-pdf.pdf", "Wrong download name: " + exported.suggestedFilename());
  assert(downloaded.equals(expected), "Downloaded payload differs from the signed inner PDF");
  assert(downloaded.subarray(0, 5).toString("latin1") === "%PDF-", "Downloaded payload is not a PDF");

  await page.locator("#p7m-extract-file").setInputFiles(resolve(corpus, "documento-manomesso.p7m"));
  await page.getByRole("button", { name: "Estrai il documento" }).click();
  await page.locator("[data-p7m-extraction]").waitFor({ timeout: 30000 });
  assert(await notice.isVisible(), "Notice disappeared on the tampered envelope");
  assert((await notice.innerText()).includes("NON autenticato"), "Tampered envelope lost the non-authentic notice");

  await page.locator("#p7m-extract-file").setInputFiles(resolve(corpus, "documento-scaduto.p7m"));
  await page.getByRole("button", { name: "Estrai il documento" }).click();
  await page.locator("[data-p7m-extraction]").waitFor({ timeout: 30000 });
  assert(await notice.isVisible(), "Notice disappeared for expired-certificate CMS");
  assert((await notice.innerText()).includes("NON autenticato"), "Expired certificate was presented as authentic");
  const expiredDownload = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("button", { name: "Scarica il documento estratto" }).click();
  const expiredExport = await expiredDownload;
  assert((await readFile(await expiredExport.path())).equals(expected), "Expired-certificate CMS content differs from known PDF bytes");

  await page.locator("#p7m-extract-file").setInputFiles(resolve(corpus, "troncato.p7m"));
  await page.getByRole("button", { name: "Estrai il documento" }).click();
  await page.getByText(/file non è un P7M leggibile|danneggiato/u).waitFor({ timeout: 30000 });
  assert(await page.locator("[data-p7m-extraction]").count() === 0, "Malformed envelope preserved a stale result");
  assert(await notice.isVisible(), "Notice disappeared on malformed P7M");

  await page.locator("#p7m-extract-file").setInputFiles(resolve(corpus, "detached-senza-contenuto.p7m"));
  await page.getByRole("button", { name: "Estrai il documento" }).click();
  await page.getByText(/Firma senza contenuto incluso/u).waitFor({ timeout: 30000 });
  assert(await page.locator("[data-p7m-extraction]").count() === 0, "Stale successful result after a detached signature");
  assert(await notice.isVisible(), "Notice disappeared after a refusal");
  for (const [name, before] of originalInputs) {
    assert((await readFile(resolve(corpus, name))).equals(before), "Original input changed: " + name);
  }
  assert(violations.length === 0, "Unexpected network or executable JavaScript: " + violations.join("; "));
  console.log("PASS compiled consumer P7M: 390px Chromium; valid/tampered/expired/malformed/detached, byte-identical PDF downloads, permanent NON-verificata banner, unchanged input files, external requests=0; page errors=0");
  await context.close();
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

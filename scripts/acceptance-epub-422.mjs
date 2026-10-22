import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.EPUB_422_PORT ?? 18575);
const origin = "http://127.0.0.1:" + port;
const route = origin + "/tools/epub-reader/";
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const violations = [];
let browser;
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function ready() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(route);
      if (response.ok && (await response.text()).includes("epub-reader-file")) return;
    } catch { /* server starting */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Compiled EPUB3 route missing from dist");
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
  await page.locator("#epub-reader-file").waitFor({ timeout: 30000 }).catch(async (error) => { throw new Error(error.message + " | PAGEERRORS: " + violations.join("; ") + " | ISLAND: " + await page.locator("astro-island").first().getAttribute("component-url")); });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px page overflows");
  await page.locator("#epub-reader-file").setInputFiles(resolve(root, "quality/fixtures/epub3-local-safe/sample.epub"));
  await page.getByRole("button", { name: "Leggi EPUB" }).click();
  await page.locator("[data-epub-book]").waitFor({ timeout: 30000 });
  const titles = await page.locator("#epub-reader-chapter option").allTextContents();
  assert(titles.length === 2 && titles[0].includes("Apertura") && titles[1].includes("Chiusura"), "EPUB navigation failed: " + titles);
  assert((await page.locator("[data-epub-text]").innerText()).includes("Vento e città, senza rete."), "First chapter text absent");
  await page.locator("#epub-reader-chapter").selectOption("1");
  assert((await page.locator("[data-epub-text]").innerText()).includes("Le parole restano sul dispositivo."), "Second chapter not navigable");

  const download = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("button", { name: "Esporta tutto in TXT" }).click();
  const exported = await download;
  const txt = await readFile(await exported.path(), "utf8");
  assert(exported.suggestedFilename() === "epub-testo.txt", "Wrong export name");
  assert(txt.includes("Vento e città, senza rete.") && txt.includes("Le parole restano sul dispositivo."), "Downloaded text missing chapters");
  assert(!txt.includes("<html") && !txt.includes("<script"), "Markup leaked to TXT export");

  await page.locator("#epub-reader-file").setInputFiles(resolve(root, "quality/fixtures/epub3-local-safe/script-rejected.epub"));
  await page.getByRole("button", { name: "Leggi EPUB" }).click();
  await page.getByText(/EPUB non supportato o non sicuro/u).waitFor({ timeout: 30000 });
  assert(await page.locator("[data-epub-book]").count() === 0, "Stale successful result after malicious upload");
  assert(violations.length === 0, "Unexpected network or executable JavaScript: " + violations.join("; "));
  console.log("PASS compiled consumer EPUB3: 390px Chromium; two navigable chapters; downloaded TXT independently reopened; scripted EPUB refused; external requests=0; page errors=0");
  await context.close();
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

/** Existing production route, real file-pickers/downloads and independent UTF-8 verification.
 * Run: ./node_modules/.bin/tsx tests/pdf-inspect-extract-compare-53.browser.ts
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createSimplePdf } from "../src/engines/pdf/writer";

const root = resolve(import.meta.dirname, "..");
const port = 18553;
const origin = `http://127.0.0.1:${port}`;
const route = `${origin}/tools/pdf-text-extraction/`;
const server = spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: root, stdio: "ignore" });
const source = createSimplePdf(["FIRST_REAL_PAGE53", "SECOND_REAL_PAGE53", "THIRD_REAL_PAGE53"]);
const download = async (page: import("@playwright/test").Page, selector: string) => {
  const waiting = page.waitForEvent("download");
  await page.locator(selector).click();
  const result = await waiting;
  return { name: result.suggestedFilename(), bytes: new Uint8Array(await readFile(await result.path())) };
};

try {
  let ready = false;
  for (let attempt = 0; attempt < 180; attempt++) {
    if (server.exitCode !== null) throw new Error(`Astro exited: ${server.exitCode}`);
    try { ready = (await fetch(route)).ok; if (ready) break; } catch { /* starting */ }
    await new Promise<void>((done) => setTimeout(done, 120));
  }
  assert(ready, "Public PDF text extraction route must load");
  const browser = await chromium.launch({ headless: true });
  let checks = 0;
  const check = (condition: unknown, label: string) => { assert(condition, label); checks++; };
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const outside: string[] = [], errors: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!(url.startsWith(origin) || url.startsWith("blob:") || url.startsWith("data:")) || request.method() !== "GET" || request.postData() !== null) outside.push(`${request.method()} ${url}`);
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(route, { waitUntil: "networkidle" });
    check(response?.status() === 200, "Production route responds 200");
    const picker = page.locator('input[type="file"]').first();
    await picker.setInputFiles({ name: "fattura-53.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) });
    const select = page.getByRole("combobox", { name: "Modalità estrazione testo" });
    await select.selectOption("visual-lines");
    await page.getByRole("textbox", { name: "Pagine da estrarre" }).fill("3,1");
    await page.getByRole("button", { name: "Estrai testo", exact: true }).click();
    await page.locator("[data-pdf-text-exports-53]").waitFor({ timeout: 25_000 });
    check((await page.locator("[data-pdf-text-exports-53]").innerText()).includes("2 pagine esportate"), "Correct page count and export mode");
    const txt = await download(page, "[data-53-txt]");
    const md = await download(page, "[data-53-md]");
    const plain = new TextDecoder("utf-8", { fatal: true }).decode(txt.bytes);
    const markdown = new TextDecoder("utf-8", { fatal: true }).decode(md.bytes);
    check(txt.name === "fattura-53.txt" && md.name === "fattura-53.md", "Correct content type and filenames");
    check(plain.startsWith("===== PAGINA 3 =====\n\nTHIRD_REAL_PAGE53"), "TXT PDF.js visually reads page 3");
    check(plain.includes("===== PAGINA 1 =====\n\nFIRST_REAL_PAGE53"), "TXT preserves requested ordering");
    check(!plain.includes("SECOND_REAL_PAGE53"), "Omitted page 2 not exported");
    check(markdown.includes("## Pagina 3\n\n```text\nTHIRD_REAL_PAGE53\n```"), "Markdown literal source text page markers");
    check(!markdown.includes("SECOND_REAL_PAGE53"), "Markdown omitted source page remains absent");
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px no horizontal overflow");
    await page.screenshot({ path: "/tmp/strumentini-53-chrome-390.png", fullPage: true });
    await page.getByRole("textbox", { name: "Pagine da estrarre" }).fill("4");
    check(await page.locator("[data-53-txt]").count() === 0, "Invalidated download after editing page selection");
    await page.getByRole("button", { name: "Estrai testo", exact: true }).click();
    await page.getByRole("alert").first().waitFor();
    check(await page.locator("[data-53-md]").count() === 0, "Out-of-range page refuses output");
    check(outside.length === 0, `No offsite/non-GET uploads: ${outside.join(",")}`);
    check(errors.length === 0, `No page exceptions: ${errors.join(";")}`);
    await page.close();
    console.log(`PDF #53 existing public text-extraction route Chromium 390×844 PASS (${checks} checks): full real TXT/Markdown downloads, page-order, PDF.js visual mode, stale and invalid guards, no offsite`);
  } finally { await browser.close(); }
} finally { server.kill("SIGTERM"); }

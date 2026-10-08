import { chromium, firefox, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
import { createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_PAGE_SELECTION_PORT ?? 18481);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid port");
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const source = Buffer.from(createSimplePdf(["ONE", "TWO", "THREE", "FOUR", "FIVE"]));
const pdfUpload = { name: "source.pdf", mimeType: "application/pdf", buffer: source };
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
async function ready() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await sleep(100);
  }
  throw new Error("PDF acceptance static site was not reachable");
}
let passed = 0;
try {
  await ready();
  for (const [browserName, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      const page = await context.newPage();
      const badRequests: string[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("request", (request) => {
        const url = request.url();
        if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) badRequests.push(url);
      });
      const response = await page.goto(`${origin}/tools/pdf-split/`, { waitUntil: "networkidle" });
      if (response?.status() !== 200) throw new Error("split route unavailable");
      await page.locator('form input[type="file"]').first().setInputFiles(pdfUpload);
      await page.getByLabel("Gruppi di pagine").fill("1-2; 3");
      if (await page.locator("[data-pdf-thumbnails]").count() !== 0) throw new Error("PDF.js thumbnails loaded without permission");
      await page.getByRole("button", { name: "Seleziona con miniature (facoltativo)" }).click();
      await page.locator('[data-pdf-page="4"][data-thumb-state="ready"] img').waitFor({ timeout: 30000 });
      await page.locator("[data-pdf-selection-preview]").getByText("2 PDF previsti", { exact: false }).waitFor();
      await page.getByLabel("Gruppo da modificare").selectOption("1");
      await page.getByRole("button", { name: "Seleziona pagina 4" }).focus();
      await page.keyboard.press("Space");
      if (await page.getByLabel("Gruppi di pagine").inputValue() !== "1, 2; 3, 4") {
        throw new Error("thumbnail selection did not preserve both source groups");
      }
      passed++;

      // Verify actual, downloaded ZIP contents, not merely the inspector index.
      await page.locator('form button[type="submit"]').first().click();
      await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 30000 });
      const downloadTask = page.waitForEvent("download");
      await page.getByRole("link", { name: "Scarica pdf-divisi.zip" }).click();
      const downloaded = await downloadTask;
      const zip = new Uint8Array(await readFile(await downloaded.path()));
      const unzipped = unzipSync(zip);
      if (Object.keys(unzipped).length !== 2) throw new Error("downloaded ZIP did not contain exactly 2 parts");
      const filenames = Object.keys(unzipped).sort();
      if (!filenames[0]?.endsWith("part-01.pdf") || !filenames[1]?.endsWith("part-02.pdf")) {
        throw new Error("ZIP split filenames are not deterministic");
      }
      const first = await extractPdfText(unzipped[filenames[0]!]!);
      const second = await extractPdfText(unzipped[filenames[1]!]!);
      if (first.map((entry) => entry.text).join(",") !== "ONE,TWO" || second.map((entry) => entry.text).join(",") !== "THREE,FOUR") {
        throw new Error("downloaded ZIP page grouping did not preserve requested pages");
      }
      passed++;
      await page.getByLabel("Gruppi di pagine").fill("1-2; bad");
      await page.locator("[data-pdf-selection-error]").getByText('token "bad"', { exact: false }).waitFor();
      await page.locator('form button[type="submit"]').first().click();
      await page.locator(".result-panel[data-state='error']").waitFor({ timeout: 15000 });
      if (await page.getByRole("link", { name: "Scarica pdf-divisi.zip" }).count() > 0) throw new Error("stale ZIP remained after invalid submission");
      passed++;
      await page.close();

      const extractPage = await context.newPage();
      await extractPage.goto(`${origin}/tools/pdf-page-delete-extract/`, { waitUntil: "networkidle" });
      await extractPage.locator('form input[type="file"]').first().setInputFiles(pdfUpload);
      await extractPage.getByRole("button", { name: "Seleziona con miniature (facoltativo)" }).click();
      await extractPage.locator('[data-pdf-page="4"][data-thumb-state="ready"] img').waitFor({ timeout: 30000 });
      await extractPage.getByRole("button", { name: "Seleziona pagina 2" }).click();
      await extractPage.getByRole("button", { name: "Seleziona pagina 4" }).focus();
      await extractPage.keyboard.press("Space");
      if (await extractPage.getByLabel("Pagine", { exact: true }).inputValue() !== "2, 4") throw new Error("extract selection inconsistent");
      await extractPage.getByRole("button", { name: "Inverti selezione" }).click();
      if (await extractPage.getByLabel("Pagine", { exact: true }).inputValue() !== "1, 3, 5") throw new Error("page selection inversion failed");
      await extractPage.getByRole("button", { name: "Inverti selezione" }).click();
      if (await extractPage.getByLabel("Pagine", { exact: true }).inputValue() !== "2, 4") throw new Error("page inversion did not round-trip");
      await extractPage.locator('form button[type="submit"]').first().click();
      await extractPage.locator(".result-panel[data-state='success']").waitFor({ timeout: 30000 });
      const artifactLink = extractPage.getByRole("link", { name: /Scarica .*extracted\.pdf/u }).first();
      const extractedEvent = extractPage.waitForEvent("download");
      await artifactLink.click();
      const extracted = new Uint8Array(await readFile(await (await extractedEvent).path()));
      if (inspectPdfBytes(extracted).pageCount !== 2 ||
        (await extractPdfText(extracted)).map((entry) => entry.text).join(",") !== "TWO,FOUR") {
        throw new Error("extracted PDF contains wrong pages");
      }
      passed++;
      // Same selected pages, opposite operation: output must contain the other pages.
      await extractPage.locator('form select').first().selectOption("delete");
      await extractPage.locator('form button[type="submit"]').first().click();
      await extractPage.locator(".result-panel[data-state='success']").waitFor({ timeout: 30000 });
      const deleteEvent = extractPage.waitForEvent("download");
      await extractPage.getByRole("link", { name: /Scarica .*pages-removed\.pdf/u }).first().click();
      const remaining = new Uint8Array(await readFile(await (await deleteEvent).path()));
      if ((await extractPdfText(remaining)).map((entry) => entry.text).join(",") !== "ONE,THREE,FIVE") {
        throw new Error("delete pages PDF still contains removed pages");
      }
      passed++;
      await extractPage.close();

      const mobile = await context.newPage();
      await mobile.goto(`${origin}/tools/pdf-split/`, { waitUntil: "networkidle" });
      if (await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw new Error("PDF selector overflow at 390px");
      await mobile.close();
      if (badRequests.length > 0 || errors.length > 0) throw new Error(`non-local traffic or script errors: ${JSON.stringify({ badRequests, errors })}`);
      passed++;
      console.log(`${browserName}: PASS strict parser, thumbnails, real ZIP and extracted/deleted pages, no network upload`);
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`ticket 217 browser acceptance PASS: ${passed}/18`);
} finally {
  server.kill("SIGTERM");
}

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_REORDER_STRICT_PORT ?? 18482);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid port");
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await pause(100);
  }
  throw new Error("PDF reorder acceptance server did not start");
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  try {
    const page = await context.newPage();
    const downloads: string[] = [];
    page.on("download", (download) => downloads.push(download.suggestedFilename()));
    const response = await page.goto(`${origin}/tools/pdf-page-reorder/`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error("PDF reorder page unavailable");
    await page.locator('form input[type="file"]').first().setInputFiles({
      name: "three-pages.pdf", mimeType: "application/pdf",
      buffer: Buffer.from(createSimplePdf(["FIRST", "SECOND", "THIRD"])),
    });
    const order = page.getByLabel("Nuovo ordine delle pagine");
    const submit = page.getByRole("button", { name: "Riordina pagine", exact: true });
    const cases = [
      { input: "3,NON_NUMERICO,1,2", reason: "NON_NUMERICO" },
      { input: "3,,1,2", reason: "separatore senza numero" },
      { input: "3,4,1,2", reason: "pagina oltre 3" },
      { input: "3,1,1", reason: "ripetuta" },
      { input: "3,1", reason: "tutte le 3 pagine" },
    ];
    for (const { input, reason } of cases) {
      await order.fill(input);
      await submit.click();
      await page.locator("form p.error[role='alert']").filter({ hasText: reason }).waitFor({ timeout: 15000 });
      if (await page.locator(".result-panel[data-state='success']").count() > 0) {
        throw new Error(`Invalid order unexpectedly created a successful job: ${input}`);
      }
      if (await page.getByRole("link", { name: /Scarica .*reordered\.pdf/u }).count() > 0 || downloads.length > 0) {
        throw new Error(`Invalid order made a PDF downloadable: ${input}`);
      }
    }

    await order.fill("3,1,2");
    await page.locator("[data-pdf-visual-order] li").first().waitFor({ timeout: 15000 });
    if (await page.locator("[data-pdf-visual-order] li").count() !== 3) {
      throw new Error("Valid order did not populate the visual organizer");
    }
    await page.getByRole("button", { name: "Sposta pagina 2 in alto" }).click();
    if (await order.inputValue() !== "3, 2, 1") throw new Error("Visual organizer did not move the selected page");
    await page.getByRole("button", { name: "Annulla ultimo spostamento" }).click();
    if (await order.inputValue() !== "3,1,2") throw new Error("Visual organizer did not restore the original valid order");

    await submit.click();
    await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 30000 });
    const link = page.getByRole("link", { name: "Scarica three-pages-reordered.pdf" });
    const target = await link.getAttribute("href");
    const fileName = await link.getAttribute("download");
    if (!target?.startsWith("blob:") || fileName !== "three-pages-reordered.pdf") {
      throw new Error(`Result link is not a verified local download: ${target} (${fileName})`);
    }
    const downloadTask = page.waitForEvent("download", { timeout: 15000 });
    await link.click();
    const downloaded = await downloadTask.catch(async () => {
      const status = await page.evaluate(async (url) => {
        try { const blob = await (await fetch(url)).blob(); return `blob bytes=${blob.size}`; }
        catch (cause) { return `blob fetch failed: ${String(cause)}`; }
      }, target);
      throw new Error(`Browser did not emit a download event; link ${fileName} ${target}, ${status}`);
    });
    const bytes = new Uint8Array(await readFile(await downloaded.path()));
    if (inspectPdfBytes(bytes).pageCount !== 3) throw new Error("Downloaded PDF has an incorrect page count");
    const texts = (await extractPdfText(bytes)).map((entry) => entry.text.trim());
    if (texts.join(",") !== "THIRD,FIRST,SECOND") {
      throw new Error(`Downloaded PDF has the wrong page order: ${texts.join(",")}`);
    }
    if (downloads.length !== 1) throw new Error(`Expected exactly one download, got ${downloads.length}`);
    await order.fill("3,NON_NUMERICO,1,2");
    if (await page.getByRole("link", { name: /Scarica .*reordered\.pdf/u }).count() > 0) {
      throw new Error("Editing the completed order kept a stale PDF available for download");
    }
    await submit.click();
    await page.locator("form p.error[role='alert']").filter({ hasText: "NON_NUMERICO" }).waitFor();
    if (downloads.length !== 1) throw new Error("Invalid edit triggered a second download");
    console.log("PDF reorder strict acceptance PASS: 5 rejected expressions, 0 invalid jobs/downloads, visual organizer, 3 downloaded pages in THIRD,FIRST,SECOND order");
  } finally {
    await context.close();
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}

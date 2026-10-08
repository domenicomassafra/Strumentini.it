import { chromium, firefox, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_THUMBNAILS_PORT ?? 18480);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid port");
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const fixture = Buffer.from(createSimplePdf(Array.from({ length: 200 }, (_, index) => `Page ${index + 1}`)));
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
async function waitForServer() {
  for (let n = 0; n < 100; n++) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await pause(100);
  }
  throw new Error("PDF static preview did not start");
}
let assertions = 0;
try {
  await waitForServer();
  for (const [name, browserType] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        const originalCreate = URL.createObjectURL.bind(URL);
        const originalRevoke = URL.revokeObjectURL.bind(URL);
        const created = new Set<string>();
        const revoked = new Set<string>();
        (window as unknown as { __thumbUrls: { created: Set<string>; revoked: Set<string> } }).__thumbUrls = { created, revoked };
        URL.createObjectURL = (blob) => {
          const url = originalCreate(blob);
          created.add(url);
          return url;
        };
        URL.revokeObjectURL = (url) => { revoked.add(url); originalRevoke(url); };
      });
      const offsite: string[] = [];
      page.on("request", (request) => {
        const url = request.url();
        if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) offsite.push(url);
      });
      await page.goto(`${origin}/tools/pdf-page-reorder/`, { waitUntil: "networkidle" });
      if (await page.locator("[data-pdf-thumbnails]").count() !== 0) throw new Error("preview loaded eagerly");
      await page.locator('form input[type="file"]').first().setInputFiles({ name: "large200.pdf", mimeType: "application/pdf", buffer: fixture });
      if (await page.locator("img[alt^='Anteprima pagina']").count() !== 0) throw new Error("render happened before consent");
      await page.getByRole("button", { name: "Apri miniature pagine (facoltativo)" }).click();
      await page.locator('[data-pdf-page="1"][data-thumb-state="ready"] img').waitFor({ timeout: 30000 });
      await page.locator('[data-pdf-page="4"][data-thumb-state="ready"] img').waitFor({ timeout: 30000 });
      if (await page.locator("[data-pdf-page]").count() !== 4 || !(await page.getByText("Pagine 1–4 di 200").isVisible())) {
        throw new Error("200 pages were not windowed into 4 visible thumbnails");
      }
      assertions++;
      await page.getByLabel("Inizia dalla pagina").fill("198");
      await page.locator('[data-pdf-page="200"][data-thumb-state="ready"] img').waitFor({ timeout: 30000 });
      if (await page.locator("[data-pdf-page]").count() !== 3 || !(await page.getByText("Pagine 198–200 di 200").isVisible())) {
        throw new Error("last 200-page window incorrect");
      }
      assertions++;
      await page.getByRole("button", { name: "Seleziona pagina 200" }).click();
      const order = await page.getByLabel("Nuovo ordine delle pagine").inputValue();
      if (order !== "200") throw new Error(`page identity not bound to authoritative order input: ${order}`);
      assertions++;
      await page.getByRole("button", { name: "Seleziona pagina 199" }).click();
      if (await page.getByLabel("Nuovo ordine delle pagine").inputValue() !== "200, 199") throw new Error("appending page lost stable identity");
      await page.getByRole("button", { name: "Sposta pagina 199 in alto" }).focus();
      await page.keyboard.press("Space");
      if (await page.getByLabel("Nuovo ordine delle pagine").inputValue() !== "199, 200") throw new Error("keyboard move reordered wrong page");
      await page.getByRole("button", { name: "Annulla ultimo spostamento" }).click();
      if (await page.getByLabel("Nuovo ordine delle pagine").inputValue() !== "200, 199") throw new Error("undo did not restore page order");
      assertions++;
      await page.locator('[data-pdf-visual-order] li').first().dragTo(page.locator('[data-pdf-visual-order] li').nth(1));
      if (await page.getByLabel("Nuovo ordine delle pagine").inputValue() !== "199, 200") throw new Error("drag move lost page identity");
      assertions++;
      await page.getByRole("button", { name: "Chiudi miniature pagine" }).click();
      await page.waitForFunction(() => {
        const registry = (window as unknown as { __thumbUrls: { created: Set<string>; revoked: Set<string> } }).__thumbUrls;
        return registry.created.size > 0 && [...registry.created].every((url) => registry.revoked.has(url));
      }, undefined, { timeout: 10000 });
      assertions++;
      if (offsite.length > 0) throw new Error(`offsite preview request: ${offsite.join(",")}`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw new Error("390px overflow");
      assertions++;
      await page.close();

      const rotated = await context.newPage();
      await rotated.goto(`${origin}/tools/pdf-rotate/`, { waitUntil: "networkidle" });
      await rotated.locator('form input[type="file"]').first().setInputFiles({ name: "small.pdf", mimeType: "application/pdf", buffer: Buffer.from(createSimplePdf(["A", "B", "C"])) });
      await rotated.getByRole("button", { name: "Apri miniature pagine (facoltativo)" }).click();
      await rotated.locator('[data-pdf-page="2"][data-thumb-state="ready"] img').waitFor({ timeout: 30000 });
      await rotated.getByRole("button", { name: "Seleziona pagina 2" }).focus();
      await rotated.keyboard.press("Space");
      await rotated.locator('[data-pdf-page="2"][data-thumb-state="ready"] img').waitFor({ timeout: 30000 });
      if (await rotated.locator('[data-pdf-page="2"] button').getAttribute("aria-pressed") !== "true") throw new Error("rotation selection is not accessible");
      if (await rotated.getByLabel("Pagine", { exact: true }).inputValue() !== "2") throw new Error("rotation selection did not reach authoritative pages input");
      assertions++;
      await rotated.getByLabel("Pagine", { exact: true }).fill("1-2");
      await rotated.getByRole("button", { name: "Inverti pagine da ruotare" }).click();
      if (await rotated.getByLabel("Pagine", { exact: true }).inputValue() !== "3") throw new Error("rotation inverse range did not preserve page identities");
      await rotated.locator('form button[type="submit"]').first().click();
      await rotated.locator(".gutter[data-state='success']").waitFor({ timeout: 30000 });
      const rotatedDownload = rotated.waitForEvent("download");
      await rotated.getByRole("link", { name: /Scarica .*rotated\.pdf/u }).click();
      const rotatedBytes = new Uint8Array(await readFile(await (await rotatedDownload).path()));
      if (inspectPdfBytes(rotatedBytes).pages.map((page) => page.rotation).join(",") !== "0,0,90") {
        throw new Error("downloaded PDF did not preserve selected rotation/inversion");
      }
      assertions++;
      await rotated.close();

      const broken = await context.newPage();
      await broken.goto(`${origin}/tools/pdf-page-reorder/`, { waitUntil: "networkidle" });
      await broken.locator('form input[type="file"]').first().setInputFiles({
        name: "invalid.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7\nno xref or valid document\n%%EOF\n"),
      });
      await broken.getByRole("button", { name: "Apri miniature pagine (facoltativo)" }).click();
      await broken.getByRole("alert").filter({ hasText: "Anteprima non disponibile" }).waitFor({ timeout: 20000 });
      if (await broken.locator("[data-pdf-page]").count() !== 0) throw new Error("invalid PDF unexpectedly generated thumbnails");
      if (!(await broken.locator('form button[type="submit"]').first().isEnabled())) throw new Error("preview failure disabled canonical PDF workflow");
      assertions++;
      await broken.close();

      const merged = await context.newPage();
      await merged.goto(`${origin}/tools/pdf-merge/`, { waitUntil: "networkidle" });
      await merged.locator('form input[type="file"]').first().setInputFiles([
        { name: "first.pdf", mimeType: "application/pdf", buffer: Buffer.from(createSimplePdf(["FIRST"])) },
        { name: "second.pdf", mimeType: "application/pdf", buffer: Buffer.from(createSimplePdf(["SECOND", "THIRD"])) },
      ]);
      await merged.locator("[data-pdf-source-count]").getByText("3 pagine totali", { exact: false }).waitFor({ timeout: 20000 });
      if (await merged.locator("[data-pdf-merge-organizer] li").count() !== 2) throw new Error("source file rows missing");
      assertions++;
      await merged.getByRole("button", { name: "Sposta file 2 su" }).focus();
      await merged.keyboard.press("Space");
      if (!(await merged.locator("[data-pdf-merge-organizer] li").first().innerText()).includes("second.pdf")) throw new Error("keyboard did not reorder merged file sources");
      await merged.getByRole("button", { name: "Ripristina ordine file precedente" }).click();
      if (!(await merged.locator("[data-pdf-merge-organizer] li").first().innerText()).includes("first.pdf")) throw new Error("merge source undo failed");
      assertions++;
      await merged.getByRole("button", { name: "Anteprima file 1" }).click();
      await merged.locator('[data-pdf-page="1"][data-thumb-state="ready"] img').waitFor({ timeout: 30000 });
      if (await merged.locator("[data-pdf-page]").count() !== 1) throw new Error("merge source preview rendered wrong page count");
      await merged.locator('form button[type="submit"]').first().click();
      await merged.locator(".gutter[data-state='success']").waitFor({ timeout: 30000 });
      const download = merged.waitForEvent("download");
      await merged.getByRole("link", { name: "Scarica merged.pdf" }).click();
      const mergedBytes = new Uint8Array(await readFile(await (await download).path()));
      if (inspectPdfBytes(mergedBytes).pageCount !== 3) throw new Error("downloaded merged PDF page total inconsistent");
      const mergedPages = await extractPdfText(mergedBytes);
      if (mergedPages.length !== 3 || !mergedPages[0]?.text.includes("FIRST") ||
          !mergedPages[1]?.text.includes("SECOND") || !mergedPages[2]?.text.includes("THIRD")) {
        throw new Error("actual downloaded merged PDF does not preserve selected source order");
      }
      assertions++;
      // Interleave page identities across two source files, rotate one, exclude
      // one, undo keyboard/drag edits, then inspect the downloaded binary PDF.
      await merged.getByRole("button", { name: "Personalizza ordine pagine" }).click();
      if (await merged.locator("[data-merge-page-order] li").count() !== 3) throw new Error("mixed file plan was not seeded");
      await merged.getByRole("button", { name: "Sposta File 2, pagina 2 su" }).focus();
      await merged.keyboard.press("Space");
      await merged.getByRole("button", { name: "Sposta File 2, pagina 2 su" }).click();
      const identities = await merged.locator("[data-merge-page-order] li").evaluateAll(
        (nodes) => nodes.map((node) => node.getAttribute("data-source-page")));
      if (identities.join(",") !== "1:2,0:1,1:1") throw new Error(`cross-file keyboard order lost identity: ${identities}`);
      assertions++;
      await merged.getByRole("button", { name: "Ruota File 2, pagina 2" }).click();
      await merged.getByRole("button", { name: "Escludi File 2, pagina 1" }).click();
      if (await merged.locator("[data-merge-page-order] li").count() !== 2) throw new Error("excluded page still in mixed plan");
      await merged.locator('[data-merge-page-order] [data-source-page="0:1"]').dragTo(
        merged.locator('[data-merge-page-order] [data-source-page="1:2"]'));
      const draggedOrder = await merged.locator("[data-merge-page-order] li").evaluateAll(
        (nodes) => nodes.map((node) => node.getAttribute("data-source-page")));
      if (draggedOrder.join(",") !== "0:1,1:2") throw new Error("drag move misidentified cross-file pages");
      await merged.getByRole("button", { name: "Ripristina modifica pagina" }).click();
      const restoredOrder = await merged.locator("[data-merge-page-order] li").evaluateAll(
        (nodes) => nodes.map((node) => node.getAttribute("data-source-page")));
      if (restoredOrder.join(",") !== "1:2,0:1") throw new Error("mixed page undo did not restore exact order");
      assertions++;
      await merged.getByRole("button", { name: "Sposta file 2 su" }).click();
      const remappedOrder = await merged.locator("[data-merge-page-order] li").evaluateAll(
        (nodes) => nodes.map((node) => node.getAttribute("data-source-page")));
      if (remappedOrder.join(",") !== "0:2,1:1") throw new Error("custom page plan lost file identity when source order changed");
      await merged.getByRole("button", { name: "Ripristina ordine file precedente" }).click();
      const originalIdentity = await merged.locator("[data-merge-page-order] li").evaluateAll(
        (nodes) => nodes.map((node) => node.getAttribute("data-source-page")));
      if (originalIdentity.join(",") !== "1:2,0:1") throw new Error("source-file undo failed to restore page identity");
      assertions++;
      await merged.getByRole("button", { name: "Anteprima file 2" }).click();
      await merged.locator('[data-pdf-page="1"][data-thumb-state="ready"] img').waitFor({ timeout: 30000 });
      await merged.getByRole("button", { name: "Seleziona pagina 1" }).click();
      if (await merged.locator("[data-merge-page-order] li").count() !== 3) throw new Error("thumbnail did not restore excluded page");
      await merged.getByRole("button", { name: "Seleziona pagina 1" }).click();
      if (await merged.locator("[data-merge-page-order] li").count() !== 2) throw new Error("thumbnail did not remove restored page");
      assertions++;
      await merged.locator('form button[type="submit"]').first().click();
      await merged.locator(".gutter[data-state='success']").waitFor({ timeout: 30000 });
      const mixedDownloadTask = merged.waitForEvent("download");
      await merged.getByRole("link", { name: "Scarica merged.pdf" }).click();
      const mixedBytes = new Uint8Array(await readFile(await (await mixedDownloadTask).path()));
      const mixedInspection = inspectPdfBytes(mixedBytes);
      if (mixedInspection.pageCount !== 2 || mixedInspection.pages[0]?.rotation !== 90 ||
          mixedInspection.pages[1]?.rotation !== 0) throw new Error("mixed PDF page count or rotation differs from plan");
      const mixedText = (await extractPdfText(mixedBytes)).map((page) => page.text);
      if (mixedText.join(",") !== "THIRD,FIRST") throw new Error(`mixed PDF output page order differs: ${mixedText}`);
      assertions++;
      await merged.close();
      console.log(`${name}: PASS bounded PDF thumbnails, undo/keyboard reorder, mixed-file merge source inventory and verified output`);
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`tickets 52/215/216 PDF thumbnail, page-order and merge acceptance PASS: ${assertions}/54`);
} finally {
  server.kill("SIGTERM");
}

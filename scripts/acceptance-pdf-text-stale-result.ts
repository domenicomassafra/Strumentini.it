import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSimplePdf } from "../src/engines/pdf";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_TEXT_STALE_PORT ?? 18483);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid port");
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await pause(100);
  }
  throw new Error("PDF text acceptance server did not start");
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  try {
    const page = await context.newPage();
    const requests: string[] = [];
    const errors: string[] = [];
    let loaded = false;
    page.on("request", (request) => {
      if (loaded && (request.method() !== "GET" || !request.url().startsWith(origin))) {
        requests.push(`${request.method()} ${request.url()}`);
      }
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`${origin}/tools/pdf-text-extraction/`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error("PDF text extraction page unavailable");
    loaded = true;
    await page.locator('form input[type="file"]').first().setInputFiles({
      name: "three-pages.pdf", mimeType: "application/pdf",
      buffer: Buffer.from(createSimplePdf(["FIRST", "SECOND", "THIRD"])),
    });
    const pages = page.getByRole("textbox", { name: "Pagine da estrarre" });
    const mode = page.getByLabel("Modalità estrazione testo");
    const submit = page.getByRole("button", { name: "Estrai testo", exact: true });
    const summary = page.locator('[data-result-class="text-code"]');
    const preview = page.locator('[data-result-slot="selectable-output"]');
    const txt = page.locator("a[data-53-txt]");
    const md = page.locator("a[data-53-md]");

    async function assertNoStale(why: string) {
      if (await summary.count() !== 0 || await preview.count() !== 0 ||
          await page.locator("[data-pdf-text-exports-53]").count() !== 0 ||
          await page.locator("a[download]").count() !== 0 ||
          await page.locator('[data-result-class]').count() !== 0) {
        throw new Error(`${why}: stale PDF result, preview or download remains`);
      }
    }

    async function assertExtracted(expectedPages: string, expectedMode: string, count: number) {
      await summary.waitFor({ timeout: 30_000 });
      await txt.waitFor();
      await md.waitFor();
      const content = await summary.innerText();
      const selectedPages = await summary.locator("dt").filter({ hasText: /^Pagine selezionate$/u })
        .locator("xpath=following-sibling::dd").innerText();
      if (!content.includes(`${count} pagine di testo`) || selectedPages.trim() !== expectedPages) {
        throw new Error(`Wrong extraction summary: ${JSON.stringify(content.slice(0, 1500))}`);
      }
      const status = await page.locator("[data-pdf-text-exports-53]").innerText();
      if (!status.includes(`modalità ${expectedMode}`)) throw new Error(`Incorrect extraction mode: ${status}`);
      if (await page.locator("a[data-53-txt], a[data-53-md]").count() !== 2) {
        throw new Error("Expected exactly two exported text formats");
      }
    }

    await pages.fill("1,3");
    await submit.click();
    await assertExtracted("1, 3", "content-order", 2);
    await pages.fill("2");
    await assertNoStale("Changing pages 1,3 → 2");

    await submit.click();
    await assertExtracted("2", "content-order", 1);
    if (!(await preview.innerText()).includes("SECOND")) throw new Error("Re-extraction lacks page two text");
    await mode.selectOption("operator-lines");
    await assertNoStale("Changing content-order → operator-lines");

    await submit.click();
    await assertExtracted("2", "operator-lines", 1);
    for (const [link, expectedHeading, expectedBody] of [
      [txt, "PAGINA 2", "SECOND"],
      [md, "## Pagina 2", "SECOND"],
    ] as const) {
      const event = page.waitForEvent("download", { timeout: 15_000 });
      await link.click();
      const download = await event;
      const bytes = await readFile(await download.path());
      const output = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (!output.includes(expectedHeading) || !output.includes(expectedBody) ||
          output.includes("FIRST") || output.includes("THIRD") || /PAGINA [13]/iu.test(output)) {
        throw new Error(`Wrong ${download.suggestedFilename()} content: ${JSON.stringify(output)}`);
      }
    }
    if (requests.length > 0 || errors.length > 0) {
      throw new Error(`Nonlocal browser traffic or runtime errors: ${JSON.stringify({ requests, errors })}`);
    }
    console.log("PDF text stale-result acceptance PASS: pages 1,3→2, mode content-order→operator-lines, stale panel/preview/downloads cleared twice, fresh page-2 TXT+MD bytes verified, local-only");
  } finally {
    await context.close();
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}

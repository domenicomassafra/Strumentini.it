import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { generateDocxFromSemanticText } from "../src/engines/ooxml/office-semantics";

const port = 18356;
const origin = `http://127.0.0.1:${port}`;
const root = new URL("..", import.meta.url);
const linked = await realpath(new URL("../node_modules", import.meta.url));
const server = spawn(process.execPath, ["node_modules/astro/bin/astro.mjs", "dev", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root, stdio: "ignore", env: { ...process.env, STRUMENTINI_DEV_LINKED_DEPS: linked },
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`${origin}/tools/printable-pdf-from-text/`)).ok) { ready = true; break; } } catch { /* startup */ }
    await sleep(300);
  }
  assert.equal(ready, true, "Astro did not start");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", message => { if (message.type() === "error") console.error("BROWSER_CONSOLE_ERROR", message.text()); });
    page.on("response", response => { if (response.status() >= 400) console.error("BROWSER_HTTP_ERROR", response.status(), response.url()); });
    await page.goto(`${origin}/tools/printable-pdf-from-text/`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-printable-pdf="true"] input[type="file"]').waitFor();
    await page.waitForFunction(() => (document.querySelector('[data-printable-pdf="true"] input[type="file"]') as HTMLInputElement)?.disabled === false, null, { timeout: 40_000 });
    const result = await generateDocxFromSemanticText("Ricevuta DOCX verificabile\n\nPrima voce: 25 euro\n\nSeconda voce: 15 euro", "text");
    await page.locator('[data-printable-pdf="true"] input[type="file"]').setInputFiles({
      name: "ricevuta.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from(result.bytes),
    });
    await page.getByText("DOCX importato come testo semplice").waitFor({ timeout: 20_000 });
    assert.match(await page.locator('[data-printable-pdf="true"] textarea').inputValue(), /Ricevuta DOCX verificabile/u);
    await page.getByRole("button", { name: "Genera e verifica PDF" }).click();
    await page.locator('[data-printable-result="success"]').waitFor({ timeout: 30_000 });
    const pending = page.waitForEvent("download");
    await page.getByRole("link", { name: /Scarica documento-stampabile\.pdf/u }).click();
    const download = await pending;
    const downloaded = await readFile(await download.path());
    assert.match(downloaded.subarray(0, 8).toString("utf8"), /^%PDF-/u);
    const task = getDocument({ data: Uint8Array.from(downloaded), useSystemFonts: true, disableFontFace: true });
    try {
      const pdf = await task.promise;
      assert(pdf.numPages >= 1);
      const page1 = await pdf.getPage(1);
      const text = (await page1.getTextContent()).items.filter((item): item is typeof item & { str: string } => "str" in item).map((item) => item.str).join(" ");
      assert.match(text, /Ricevuta DOCX verificabile/u);
      assert.match(text, /Seconda voce: 15 euro/u);
      console.log(`PASS #56 browser: DOCX semantic upload→actual PDF download, ${pdf.numPages} page(s), ${downloaded.length} bytes, independently re-opened`);
    } finally { await task.destroy(); }
    assert.equal(errors.length, 0, errors.join("; "));
  } finally { await browser.close(); }
} finally { server.kill("SIGTERM"); }

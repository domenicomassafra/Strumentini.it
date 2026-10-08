import { chromium, firefox, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createSimplePdf, inspectPdfBytes, comparePdfs } from "../src/engines/pdf";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_COMPARE_PORT ?? 18482);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("invalid acceptance port");
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const tick = (ms: number) => new Promise((resolveTick) => setTimeout(resolveTick, ms));
async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await tick(100);
  }
  throw new Error("PDF static comparison acceptance server not available");
}
const upload = (name: string, bytes: Uint8Array) => ({
  name, mimeType: "application/pdf", buffer: Buffer.from(bytes),
});

const original = createSimplePdf(["VISUAL SAME TEXT"]);
const moved = new TextEncoder().encode(new TextDecoder("latin1")
  .decode(original).replace("72 696 Td", "92 696 Td"));
if (new TextDecoder("latin1").decode(original).includes("72 696 Td") === false
  || inspectPdfBytes(moved).pageCount !== 1) {
  throw new Error("independent same-text, different-visual-position PDF fixture invalid");
}
const asBlob = (bytes: Uint8Array) => {
  const owned = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(owned).set(bytes);
  return new Blob([owned], { type: "application/pdf" });
};
const base = await comparePdfs(asBlob(original), asBlob(moved));
if (base.alignment.unchangedPairs.length !== 1 || base.visual.status !== "not-rendered") {
  throw new Error("comparison engine must never claim visual equality from extracted text");
}

let verified = 0;
try {
  await waitForServer();
  for (const [browserName, browserType] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      const page = await context.newPage();
      const external: string[] = [];
      const pageErrors: string[] = [];
      const scripts: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      page.on("request", (request) => {
        if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) external.push(request.url());
        if (request.resourceType() === "script") scripts.push(request.url());
        if (request.method() !== "GET") external.push(`${request.method()} ${request.url()}`);
      });
      await page.goto(`${origin}/tools/pdf-compare-lite/`, { waitUntil: "networkidle" });
      const inputs = page.locator('form input[type="file"]');
      await inputs.nth(0).setInputFiles(upload("first.pdf", original));
      await inputs.nth(1).setInputFiles(upload("moved-text.pdf", moved));
      await page.getByRole("button", { name: "Confronta PDF", exact: true }).click();
      await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 20000 });
      await page.locator("[data-pdf-compare-layers]").getByText("Riordinate 0", { exact: false }).waitFor();
      if (!(await page.locator("[data-compare-text-summary]").textContent())?.includes("extracted-match")) {
        throw new Error("text match was not reported as a scoped layer");
      }
      if (!(await page.locator(".result-panel").innerText()).includes("Visual appearance NOT checked")) {
        throw new Error("result falsely implied visual identity before rendering");
      }
      if (scripts.some((url) => url.includes("pdf.worker"))) throw new Error("PDF.js worker imported before explicit visual action");
      verified++;

      await page.getByRole("button", { name: "Apri confronto visivo delle miniature (facoltativo)" }).click();
      if (await page.locator("[data-visual-diff-state]").count() !== 0) throw new Error("eager render started on panel open");
      await page.getByRole("button", { name: "Confronta pixel delle miniature" }).click();
      const state = page.locator('[data-visual-diff-state="different"], [data-visual-diff-state="partial"], [data-visual-diff-state="sample-match"]');
      await state.waitFor({ timeout: 30000 });
      const observed = await state.getAttribute("data-visual-diff-state");
      if (observed !== "different") {
        throw new Error(`expected changed rendered pixels but observed ${observed}: ${await state.innerText()}; page errors=${pageErrors.join(" | ")}`);
      }
      if (!/pixel diversi/u.test(await state.innerText()) || await page.locator("[data-pdf-visual-compare] img").count() !== 3) {
        throw new Error("pixel difference was not rendered as an overlay");
      }
      verified++;

      // Identical sampled pages can match without claiming the entire file is visually identical.
      await inputs.nth(1).setInputFiles(upload("identical.pdf", original));
      await page.getByRole("button", { name: "Confronta PDF", exact: true }).click();
      await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 20000 });
      await page.getByRole("button", { name: "Apri confronto visivo delle miniature (facoltativo)" }).click();
      await page.getByRole("button", { name: "Confronta pixel delle miniature" }).click();
      await page.locator('[data-visual-diff-state="sample-match"]').waitFor({ timeout: 30000 });
      if (!(await page.locator('[data-visual-diff-state="sample-match"]').innerText()).includes("NON è certificata")) {
        throw new Error("a sampled pixel match incorrectly became full-document certification");
      }
      verified++;

      // Different page geometry must yield partial rather than a misleading pixel equality claim.
      await inputs.nth(1).setInputFiles(upload("different-size.pdf", createSimplePdf(["VISUAL SAME TEXT"], { width: 400 })));
      await page.getByRole("button", { name: "Confronta PDF", exact: true }).click();
      await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 20000 });
      await page.getByRole("button", { name: "Apri confronto visivo delle miniature (facoltativo)" }).click();
      await page.getByRole("button", { name: "Confronta pixel delle miniature" }).click();
      await page.locator('[data-visual-diff-state="partial"]').waitFor({ timeout: 30000 });
      verified++;

      await inputs.nth(0).setInputFiles(upload("three.pdf", createSimplePdf(["FIRST", "SECOND", "THIRD"])));
      await inputs.nth(1).setInputFiles(upload("swapped.pdf", createSimplePdf(["SECOND", "FIRST", "THIRD"])));
      await page.getByRole("button", { name: "Confronta PDF", exact: true }).click();
      await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 20000 });
      if (!(await page.locator("[data-compare-page-summary]").innerText()).includes("Riordinate 1")) {
        throw new Error("reordered page wrongly classified as content change");
      }
      verified++;

      await inputs.nth(1).setInputFiles(upload("inserted.pdf", createSimplePdf(["FIRST", "INSERT", "SECOND", "THIRD"])));
      await page.getByRole("button", { name: "Confronta PDF", exact: true }).click();
      await page.locator(".result-panel[data-state='success']").waitFor({ timeout: 20000 });
      const counts = await page.locator("[data-compare-page-summary]").innerText();
      if (!counts.includes("Aggiunte 1") || !counts.includes("Riordinate 0")) {
        throw new Error(`inserted page was classified incorrectly: ${counts}`);
      }
      verified++;
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) {
        throw new Error("PDF comparison UI overflow at 390px");
      }
      if (external.length > 0 || pageErrors.length > 0) throw new Error(`nonlocal activity or JS error: ${JSON.stringify({ external, pageErrors })}`);
      verified++;
      await page.close();

      // A PDF with a usable text/structure parser but a renderer that cannot
      // provide canvas pixels must never be upgraded to "visually equal".
      const unavailable = await context.newPage();
      await unavailable.goto(`${origin}/tools/pdf-compare-lite/`, { waitUntil: "networkidle" });
      const unavailableInputs = unavailable.locator('form input[type="file"]');
      await unavailableInputs.nth(0).setInputFiles(upload("first.pdf", original));
      await unavailableInputs.nth(1).setInputFiles(upload("second.pdf", original));
      await unavailable.getByRole("button", { name: "Confronta PDF", exact: true }).click();
      await unavailable.locator(".result-panel[data-state='success']").waitFor({ timeout: 20000 });
      // Force readFile failure *after* text comparison has succeeded. This is
      // the local preview-read boundary, without mutating PDF.js globals or
      // assuming a particular browser's OffscreenCanvas implementation.
      await unavailable.evaluate(() => {
        File.prototype.arrayBuffer = () => Promise.reject(new Error("PDF_PREVIEW_UNREADABLE (test only)"));
      });
      await unavailable.getByRole("button", { name: "Apri confronto visivo delle miniature (facoltativo)" }).click();
      await unavailable.getByRole("button", { name: "Confronta pixel delle miniature" }).click();
      await unavailable.locator('[data-visual-diff-state="partial"]').waitFor({ timeout: 30000 });
      if (!(await unavailable.locator('[data-visual-diff-state="partial"]').innerText()).includes("Confronto parziale")) {
        throw new Error("non-renderable PDF did not produce a qualified partial result");
      }
      verified++;
      await unavailable.close();
      console.log(`${browserName}: PASS alignment, rendered diff, sampled equality and fail-closed partial state`);
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`ticket 221 PDF comparison acceptance PASS: ${verified}/24`);
} finally {
  server.kill("SIGTERM");
}

import { chromium, firefox, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createSimplePdf } from "../src/engines/pdf";

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
      console.log(`${name}: PASS 200-page lazy window, keyboard navigation, resource revocation, rotation, failure isolation and mobile layout`);
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`ticket 215 PDF thumbnail acceptance PASS: ${assertions}/21`);
} finally {
  server.kill("SIGTERM");
}

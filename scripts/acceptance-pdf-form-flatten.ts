import { chromium, firefox, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractPdfText, inspectPdfFormAnnotations } from "../src/engines/pdf";
import { formAnnotationFixture } from "../tests/fixtures/pdf-form-annotation-fixture";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_FLATTEN_PORT ?? 18483);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid PDF flatten acceptance port");
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
async function ready() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await pause(100);
  }
  throw new Error("Static PDF flatten acceptance server did not start");
}
const hidden = formAnnotationFixture(2);
const visible = formAnnotationFixture(0);
const upload = (bytes: Uint8Array) => ({ name: "form.pdf", mimeType: "application/pdf", buffer: Buffer.from(bytes) });
let assertions = 0;
try {
  await ready();
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      const problems: string[] = [];
      const attachMonitor = (page: Awaited<ReturnType<typeof context.newPage>>) => {
        page.on("pageerror", (error) => problems.push(error.message));
        page.on("request", (request) => {
          if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) {
            problems.push(`External request: ${request.url()}`);
          }
          if (request.method() !== "GET") problems.push(`Non-GET: ${request.method()}`);
        });
      };
      const inspected = await context.newPage();
      attachMonitor(inspected);
      await inspected.goto(`${origin}/tools/pdf-form-inspector/`, { waitUntil: "networkidle" });
      await inspected.locator('form input[type="file"]').first().setInputFiles(upload(hidden));
      await inspected.getByRole("button", { name: "Analizza moduli" }).click();
      await inspected.locator(".result-panel[data-state='success']").waitFor({ timeout: 20000 });
      const counts = await inspected.locator("[data-form-audit-counts]").innerText();
      const inventory = await inspected.locator("[data-pdf-form-audit]").innerText();
      if (!counts.includes("1 campi AcroForm") || !counts.includes("1 annotazioni") ||
        !inventory.includes("client") || !inventory.includes("oggetto 7") ||
        !inventory.includes("widget 5") || !inventory.includes("Pagina 1")) {
        throw new Error(`Field/widget/page provenance lost: ${inventory}`);
      }
      assertions++;
      await inspected.locator('form input[type="file"]').first().setInputFiles(upload(visible));
      await inspected.getByRole("button", { name: "Analizza moduli" }).click();
      await inspected.locator(".result-panel[data-state='success']").waitFor({ timeout: 20000 });
      await inspected.locator("[data-form-audit-blockers]").waitFor({ timeout: 20000 });
      if (!(await inspected.locator("[data-form-audit-counts]").innerText()).includes("1 visibili")) {
        throw new Error("Visible annotation was misclassified as safely flattened");
      }
      assertions++;
      await inspected.close();

      const flattenPage = await context.newPage();
      attachMonitor(flattenPage);
      await flattenPage.goto(`${origin}/tools/pdf-flatten/`, { waitUntil: "networkidle" });
      await flattenPage.locator('form input[type="file"]').first().setInputFiles(upload(visible));
      await flattenPage.getByRole("button", { name: "Appiattisci PDF" }).click();
      await flattenPage.locator(".result-panel[data-state='error']").waitFor({ timeout: 20000 });
      if (!(await flattenPage.locator('[role="alert"]').allInnerTexts()).join(" ").includes("Non è possibile conservare")) {
        throw new Error("Unsafe visible widget did not fail closed");
      }
      if (await flattenPage.locator("a[download]").count() !== 0) throw new Error("Unsafe flatten exposed stale downloadable artifact");
      assertions++;

      await flattenPage.locator('form input[type="file"]').first().setInputFiles(upload(hidden));
      await flattenPage.getByRole("button", { name: "Appiattisci PDF" }).click();
      await flattenPage.locator(".result-panel[data-state='success']").waitFor({ timeout: 20000 });
      const details = await flattenPage.locator("[data-pdf-flatten-verification]").innerText();
      if (!details.includes("Campi 1 → 0") || !details.includes("annotazioni 1 → 0") ||
        !details.includes("testo stabile sì") || !details.includes("geometria stabile sì")) {
        throw new Error(`Flatten output verification not visible: ${details}`);
      }
      assertions++;
      const downloadTask = flattenPage.waitForEvent("download");
      await flattenPage.getByRole("link", { name: /Scarica .*flattened\.pdf/u }).click();
      const bytes = new Uint8Array(await readFile(await (await downloadTask).path()));
      const after = await inspectPdfFormAnnotations(bytes);
      if (after.audit.annotationCount !== 0 || after.audit.fieldCount !== 0 || after.inspection.pageCount !== 1 ||
        (await extractPdfText(bytes)).map((page) => page.text).join() !==
          (await extractPdfText(hidden)).map((page) => page.text).join()) {
        throw new Error("Downloaded flattened PDF failed independent form/annotation/text checks");
      }
      assertions++;
      await flattenPage.close();

      // Verify visual parity using real PDF.js rendered PNG pixels through the
      // independent existing visual comparator, NOT parser/text equality alone.
      const compared = await context.newPage();
      attachMonitor(compared);
      await compared.goto(`${origin}/tools/pdf-compare-lite/`, { waitUntil: "networkidle" });
      const inputs = compared.locator('form input[type="file"]');
      await inputs.nth(0).setInputFiles(upload(hidden));
      await inputs.nth(1).setInputFiles(upload(bytes));
      await compared.getByRole("button", { name: "Confronta PDF", exact: true }).click();
      await compared.locator(".result-panel[data-state='success']").waitFor({ timeout: 20000 });
      await compared.getByRole("button", { name: "Apri confronto visivo delle miniature (facoltativo)" }).click();
      await compared.getByRole("button", { name: "Confronta pixel delle miniature" }).click();
      const visual = compared.locator('[data-visual-diff-state="sample-match"], [data-visual-diff-state="partial"], [data-visual-diff-state="different"]');
      await visual.waitFor({ timeout: 30000 });
      if (await visual.getAttribute("data-visual-diff-state") !== "sample-match" ||
        !(await visual.innerText()).includes("0 /")) {
        throw new Error(`Real before/after PDF render differs or unavailable: ${await visual.innerText()}`);
      }
      assertions++;
      if (await compared.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) {
        throw new Error("PDF form/flatten comparison overflow on 390px viewport");
      }
      if (problems.length > 0) throw new Error(`Browser errors/nonlocal requests: ${problems.join(" | ")}`);
      assertions++;
      await compared.close();
      console.log(`${name}: PASS widget provenance, visible fail-closed, verified output and visual pixel parity`);
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`ticket 319 PDF form/flatten acceptance PASS: ${assertions}/21`);
} finally {
  server.kill("SIGTERM");
}

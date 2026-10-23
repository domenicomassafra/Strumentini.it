/** STR-379: compiled local-first project, crash recovery, undo/redo and storage refusal. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

const port = Number(process.env.STR138_PORT ?? 18438);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
const temp = mkdtempSync(join(tmpdir(), "pdf-project138-"));
let browser;
let context;
const runnerBrowser = process.env.STR138_BROWSER_MODE === "launch";
async function ready() {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error("Static consumer not running");
    try { if ((await fetch(origin + "/tools/pdf-page-reorder/")).status === 200) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Consumer route unavailable");
}
async function fixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 4; i++) doc.addPage([300 + i, 420]).drawText("PROJECT_138_PAGE_" + i, { x: 25, y: 125, font });
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
async function persisted(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("strumentini-optin-pdf-341", 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("projects", "readonly");
        const req = tx.objectStore("projects").getAll();
        req.onsuccess = () => {};
        tx.oncomplete = async () => {
          const rows = req.result;
          const bytes = rows[0]?.bytes;
          const digest = bytes ? await crypto.subtle.digest("SHA-256", bytes) : undefined;
          const hash = digest ? Array.from(new Uint8Array(digest)).map((n) => n.toString(16).padStart(2, "0")).join("") : null;
          resolve({ count: rows.length, hash, id: rows[0]?.id, version: rows[0]?.schemaVersion });
        };
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}
try {
  await ready();
  // GitHub Actions owns an isolated Chromium instance; MiniPC reuses its shared browser.
  browser = runnerBrowser
    ? await chromium.launch({ headless: true })
    : await chromium.connectOverCDP("http://127.0.0.1:17629", { timeout: 30_000 });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  // Regression fixture: withhold the PDF island module after the HTML is visible.
  // The upload must wait for Astro/Preact listeners, regardless of network timing.
  let delayedHydrationAssets = 0;
  await context.route("**/_astro/PdfPageReorderTool.*.js", async (route) => {
    delayedHydrationAssets++;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  const pageErrors = [];
  context.on("page", (tab) => {
    tab.on("pageerror", (error) => pageErrors.push(error.message));
    tab.on("console", (message) => { if (message.type() === "error") pageErrors.push(message.text()); });
  });
  context.on("requestfailed", (request) => pageErrors.push(`${request.url()}: ${request.failure()?.errorText}`));
  let page = await context.newPage();
  const offsite = [];
  context.on("request", (request) => {
    const target = request.url();
    if (!target.startsWith(origin) && !target.startsWith("blob:") && !target.startsWith("data:")) offsite.push(target);
  });
  const input = await fixture();
  const originalHash = createHash("sha256").update(input).digest("hex");
  // Seed legacy #341 at IDB version 1 before the project UI upgrades to v2.
  assert.equal((await page.goto(origin + "/robots.txt"))?.status(), 200);
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("strumentini-optin-pdf-341", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("pdf", { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("pdf", "readwrite");
        tx.objectStore("pdf").put({ id: "preexisting341", sentinel: "must-survive-upgrade" });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  assert.equal((await page.goto(origin + "/tools/pdf-page-reorder/", { waitUntil: "domcontentloaded" }))?.status(), 200);
  await page.getByLabel("PDF da modificare").setInputFiles({ name: "progetto138.pdf", mimeType: "application/pdf", buffer: input });
  const order = page.locator("[data-pdf-order-status]");
  try {
    await order.filter({ hasText: /4 pagine/u }).waitFor();
  } catch (error) {
    const body = await page.locator("body").innerText().catch(() => "<body unavailable>");
    await page.screenshot({ path: "/tmp/str138-browser-debug.png", fullPage: true }).catch(() => {});
    console.error("STR138_BROWSER_DIAGNOSTIC", JSON.stringify({ body: body.slice(-3000), pageErrors, delayedHydrationAssets, islandSsr: await page.locator("astro-island[ssr]").count(), file: await page.getByLabel("PDF da modificare").evaluate((input) => input.files?.[0]?.name ?? null) }));
    throw error;
  }
  await page.getByRole("button", { name: "Inverti ordine" }).click();
  await order.filter({ hasText: /4, 3, 2, 1/u }).waitFor();
  await page.getByRole("button", { name: "Annulla modifica" }).click();
  await order.filter({ hasText: /1, 2, 3, 4/u }).waitFor();
  await page.getByRole("button", { name: "Ripristina modifica" }).click();
  await order.filter({ hasText: /4, 3, 2, 1/u }).waitFor();
  await page.getByRole("button", { name: "Seleziona pagina originale 4" }).click();
  await page.locator('input[name="workspace-mode-372"]').last().check();
  await page.getByRole("button", { name: "Salva copia del progetto su questo dispositivo" }).click();
  await page.locator("[data-pdf-project-message]").getByText(/hash SHA-256 verificato/u).waitFor();
  let saved = await persisted(page);
  assert.equal(saved.count, 1);
  assert.equal(saved.version, 1);
  assert.equal(saved.hash, originalHash);
  assert.equal(await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("strumentini-optin-pdf-341", 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const req = db.transaction("pdf", "readonly").objectStore("pdf").get("preexisting341");
        req.onsuccess = () => resolve(req.result?.sentinel);
        req.onerror = () => reject(req.error);
      });
    } finally { db.close(); }
  }), "must-survive-upgrade", "legacy PDF store lost its record");

  // Closing the whole tab simulates a crashed tab; IndexedDB survives on the origin.
  await page.close();
  page = await context.newPage();
  assert.equal((await page.goto(origin + "/tools/pdf-page-reorder/"))?.status(), 200);
  await page.getByRole("button", { name: "Riprendi progetto" }).click();
  await page.locator("[data-pdf-order-status]").filter({ hasText: /4, 3, 2, 1/u }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Seleziona pagina originale 4" }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator('input[name="workspace-mode-372"]').last().isChecked(), true);
  await page.getByRole("button", { name: "Annulla modifica" }).click();
  assert.equal(await page.locator('input[name="workspace-mode-372"]').first().isChecked(), true);
  await page.getByRole("button", { name: "Ripristina modifica" }).click();
  assert.equal(await page.locator('input[name="workspace-mode-372"]').last().isChecked(), true);

  await page.getByRole("button", { name: "Crea PDF e verifica" }).click();
  await page.locator('[data-result-class="pdf"] [data-result-slot="file-workspace"]').waitFor({ timeout: 30_000 });
  const pendingDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: /Scarica.*\.pdf/u }).first().click();
  const bytes = readFileSync(await (await pendingDownload).path());
  const reopened = await PDFDocument.load(bytes);
  assert.equal(reopened.getPageCount(), 1);
  assert.equal(reopened.getPages()[0].getWidth(), 304);
  const outputPath = join(temp, "independent.pdf");
  writeFileSync(outputPath, bytes);
  assert.match(execFileSync("pdftotext", [outputPath, "-"], { encoding: "utf8" }), /PROJECT_138_PAGE_4/u);
  assert.match(execFileSync("pdfinfo", [outputPath], { encoding: "utf8" }), /^Pages:\s+1$/mu);
  assert.equal((await persisted(page)).hash, originalHash, "source SHA changed after export");

  // Force an IDB write failure in this disposable browser context.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    window.__str138OriginalAdd = original;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "projects") {
        this.transaction.abort();
        return;
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Salva copia del progetto su questo dispositivo" }).click();
  await page.locator("[data-pdf-project-message]").getByText(/Salvataggio non riuscito/u).waitFor();
  assert.equal((await persisted(page)).count, 1, "failed write replaced original project");

  await page.evaluate(() => {
    IDBObjectStore.prototype.add = window.__str138OriginalAdd;
    delete window.__str138OriginalAdd;
  });
  const saveProject = page.getByRole("button", { name: "Salva copia del progetto su questo dispositivo" });
  const selectProject = page.getByLabel("Progetto da riprendere");
  const deleteProject = page.getByRole("button", { name: "Elimina progetto selezionato" });
  for (let i = 0; i < 2; i++) {
    await saveProject.click();
    await page.locator("[data-pdf-project-message]").getByText(/hash SHA-256 verificato/u).waitFor();
  }
  assert.equal((await persisted(page)).count, 3);
  await saveProject.click();
  await page.locator("[data-pdf-project-message]").getByText(/Salvataggio non riuscito/u).waitFor();
  assert.equal((await persisted(page)).count, 3, "quota refusal should preserve all snapshots");
  const projectIds = await selectProject.locator("option").evaluateAll((options) => options.map((option) => option.value));
  const disposableId = projectIds.find((id) => id !== saved.id);
  assert.ok(disposableId, "expected another snapshot available for selective removal");
  await selectProject.selectOption(disposableId);
  page.once("dialog", (dialog) => dialog.dismiss());
  await deleteProject.click();
  assert.equal((await persisted(page)).count, 3, "cancelling deletion must preserve the archive");
  page.once("dialog", (dialog) => dialog.accept());
  await deleteProject.click();
  await page.locator("[data-pdf-project-message]").getByText(/Copia del progetto eliminata/u).waitFor();
  assert.equal((await persisted(page)).count, 2);
  await saveProject.click();
  await page.locator("[data-pdf-project-message]").getByText(/hash SHA-256 verificato/u).waitFor();
  assert.equal((await persisted(page)).count, 3, "saving after selective deletion must succeed");
  assert.equal((await persisted(page)).hash, originalHash);
  const extraIds = (await selectProject.locator("option").evaluateAll((options) => options.map((option) => option.value)))
    .filter((id) => id !== saved.id);
  for (const id of extraIds) {
    await selectProject.selectOption(id);
    page.once("dialog", (dialog) => dialog.accept());
    await deleteProject.click();
    await page.locator("[data-pdf-project-message]").getByText(/Copia del progetto eliminata/u).waitFor();
  }
  assert.equal((await persisted(page)).count, 1, "only the initial project remains for corruption refusal checks");

  // A damaged checksum must hide the project without mutating its PDF bytes.
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("strumentini-optin-pdf-341", 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("projects", "readwrite");
        const store = tx.objectStore("projects");
        const req = store.getAll();
        req.onsuccess = () => store.put({ ...req.result[0], sha256: "0".repeat(64) });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.reload();
  await page.getByText(/Alcuni progetti non sono leggibili/u).waitFor();
  assert.equal(await page.getByRole("button", { name: "Riprendi progetto" }).count(), 0);
  assert.equal((await persisted(page)).hash, originalHash, "corrupt checksum changed original bytes");

  // A future schema is kept untouched and hidden from restoration.
  await page.evaluate(async (originalHash) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("strumentini-optin-pdf-341", 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("projects", "readwrite");
        const store = tx.objectStore("projects");
        const req = store.getAll();
        req.onsuccess = () => {
          const existing = req.result[0];
          store.put({ ...existing, schemaVersion: 2, sha256: originalHash });
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, originalHash);
  await page.reload();
  await page.getByText(/Alcuni progetti non sono leggibili/u).waitFor();
  assert.equal(await page.getByRole("button", { name: "Riprendi progetto" }).count(), 0);
  assert.equal((await persisted(page)).version, 2);
  assert.equal((await persisted(page)).hash, originalHash);
  assert.deepEqual(offsite, []);
  console.log(JSON.stringify({
    test: "STR-379 compiled PDF project", status: "PASS", viewport: "390x844",
    undoRedo: true, selectionAndModeRestore: true, crashRecovery: true,
    originalSha256: originalHash, independentReadback: "pdf-lib and Poppler",
    failedWritePreservesRecord: true, corruptedHashRefused: true, futureSchemaRefused: true,
    selectiveDeleteAndResave: true, deleteCancellation: true,
    offsiteRequests: offsite.length, physicalDevice: "NOT_RUN",
  }));
} finally {
  await context?.close();
  // Only close a browser we launched. Keep the MiniPC's shared CDP Chrome alive.
  if (browser) {
    if (runnerBrowser) await browser.close();
    else browser._connection.close();
  }
  server.kill();
  rmSync(temp, { recursive: true, force: true });
}

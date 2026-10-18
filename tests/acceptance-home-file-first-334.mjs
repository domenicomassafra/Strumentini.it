// Local browser receipt: node tests/acceptance-home-file-first-334.mjs http://127.0.0.1:4934
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const base = process.argv[2] ?? "http://127.0.0.1:4934";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aRAAAAAASUVORK5CYII=", "base64");
const pdf = await readFile("quality/fixtures/pdf-gold/simple-2page.pdf");
const gif = Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64");
const zip = Buffer.from(zipSync({ "file.txt": strToU8("local archive contents") }));
const docx = Buffer.from(zipSync({
  "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
  "_rels/.rels": strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'),
  "word/document.xml": strToU8("<document/>"),
}));
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
// Cold Astro dev compilation of the full PDF tool page may exceed Playwright's
// default 30s navigation timeout on a busy shared workstation.
page.setDefaultNavigationTimeout(90_000);
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const requestsWithFileContents = [];
const sentinel = "PRIVATE_HOME_FILE_SECRET_334";
page.on("request", (request) => {
  if (request.url().includes(sentinel) || (
    request.method() !== "GET" && request.method() !== "HEAD" && (request.postData() ?? "").includes(sentinel)
  )) requestsWithFileContents.push(request.url());
});

async function resetHome() {
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator("[data-home-file-entry]").waitFor();
}

async function select(buffer, name, mime) {
  await page.locator("[data-home-file-picker]").setInputFiles({ name, mimeType: mime, buffer });
  await page.waitForFunction(() => {
    const text = document.querySelector("[data-home-file-status]")?.textContent ?? "";
    return text !== "Controllo locale del formato in corso…" && text !== "Il file rimane in questo browser. Nessuna operazione parte automaticamente.";
  });
}

async function visibleActions() {
  return page.locator("[data-home-file-action-format]:visible a").evaluateAll(
    (links) => links.map((link) => ({ href: link.getAttribute("href"), label: link.textContent?.trim() })),
  );
}

try {
  await resetHome();
  assert(await page.locator("[data-search-open]").count() > 0, "search-first control still exists");
  await page.locator("[data-search-open]").click();
  assert(await page.locator("[data-search-dialog]").isVisible(), "anonymous search opens a real dialog");
  await page.locator("[data-search-input]").fill("pdf");
  await page.locator("[data-search-results] a[href^='/tools/']").first().waitFor();
  await page.locator("[data-search-input]").press("Escape");
  assert(await page.locator("[data-search-dialog]").isHidden(), "search closes with keyboard");
  assert(await page.locator("[data-home-file-picker]").isVisible(), "picker available without drag");
  assert(await page.locator("[data-home-file-result]").isHidden(), "no recommendations before selection");

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    await page.evaluate(() => document.querySelector("[data-home-file-picker]")?.scrollIntoView());
    const result = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      picker: document.querySelector("[data-home-file-picker]")?.getBoundingClientRect().width,
      searchBottom: document.querySelector(".home-hero-search")?.getBoundingClientRect().bottom,
      fileTop: document.querySelector("[data-home-file-entry]")?.getBoundingClientRect().top,
    }));
    assert(result.picker > 0 && result.scrollWidth <= result.viewport + 1,
      "home overflows or picker missing at width " + width + ": " + JSON.stringify(result));
    assert(result.searchBottom < result.fileTop, "home search/file hierarchy inverted at width " + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("[data-home-file-picker]").focus();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-home-file-picker") !== null), true,
    "native file input is keyboard reachable");

  await select(pdf, "due-pagine.pdf", "application/pdf");
  await page.locator("[data-home-file-result]:visible").waitFor({ timeout: 5000 }).catch(async () => {
    throw new Error("PDF inspection failed: " + await page.locator("[data-home-file-status]").innerText()
      + "; browser errors: " + pageErrors.join(" | "));
  });
  assert.deepEqual((await visibleActions()).map((action) => action.href), [
    "/tools/pdf-page-count-verifier/", "/tools/pdf-merge/", "/tools/pdf-compression-lite/",
    "/tools/pdf-split/", "/tools/pdf-page-reorder/", "/tools/pdf-text-extraction/",
  ]);
  assert.match(await page.locator("[data-home-file-result]").innerText(), /selezionare di nuovo il file/u);
  assert.equal(await page.locator("[data-home-file-picker]").inputValue(), "", "file cleared immediately after local check");

  await page.locator('[data-home-file-action-format="pdf"]:visible a').first().click({ noWaitAfter: true });
  await page.waitForURL(/\/tools\/pdf-page-count-verifier\/?/u);
  assert.equal(await page.locator('input[type="file"]').first().inputValue(), "", "no implicit transfer to destination");
  await resetHome();

  await select(png, "immagine.png", "image/png");
  await page.locator("[data-home-file-result]:visible").waitFor();
  assert.deepEqual((await visibleActions()).map((action) => action.href), [
    "/tools/image-compression/", "/tools/image-resize/", "/tools/image-format-conversion/",
    "/tools/exif-remover/", "/tools/image-metadata-viewer/", "/tools/image-crop/",
  ]);
  await page.locator("[data-home-file-reset]").click();
  assert(await page.locator("[data-home-file-result]").isHidden());
  assert.equal((await visibleActions()).length, 0);

  await select(gif, "animazione.gif", "image/gif");
  await page.locator("[data-home-file-result]:visible").waitFor();
  assert.deepEqual((await visibleActions()).map((action) => action.href), [
    "/tools/image-format-conversion/", "/tools/images-to-pdf/",
  ]);

  await select(zip, "archivio.zip", "application/zip");
  await page.locator("[data-home-file-result]:visible").waitFor();
  assert.deepEqual((await visibleActions()).map((action) => action.href), [
    "/tools/zip-contents-inspector/", "/tools/archive-checksum-manifest/",
  ]);

  await select(docx, "documento.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  await page.locator("[data-home-file-result]:visible").waitFor();
  assert.match(await page.locator("[data-home-file-status]").innerText(), /DOCX riconosciuto localmente/u);
  assert(await page.locator("[data-home-file-no-actions]").isVisible(), "Office has no approved file-first workflow");
  assert.deepEqual(await visibleActions(), [], "Office must not show unverified routes");

  await select(Buffer.from("colonna,valore\n1," + sentinel), "privato.csv", "text/csv");
  assert.match(await page.locator("[data-home-file-status]").innerText(), /CSV riconosciuto localmente/u);
  assert.deepEqual((await visibleActions()).map((action) => action.href), [
    "/tools/csv-cleaner/", "/tools/csv-dedupe/", "/tools/csv-column-map/",
    "/tools/csv-filter/", "/tools/csv-column-selector/", "/tools/csv-group-count/",
  ]);
  assert.equal(requestsWithFileContents.length, 0, "CSV content must stay local");

  await select(Buffer.from("unknown " + sentinel), "privato.txt", "text/plain");
  assert.match(await page.locator("[data-home-file-status]").innerText(), /Formato non riconosciuto/u);
  assert(await page.locator("[data-home-file-result]").isHidden());
  const fallback = page.locator("[data-home-file-fallback]");
  assert(await fallback.isVisible(), "unsupported file must expose a nearby catalog fallback");
  await fallback.focus();
  await fallback.press("Enter");
  await page.waitForURL(/\/strumenti\/?$/u);
  await resetHome();
  assert.equal(requestsWithFileContents.length, 0, "file content must never be uploaded");

  await select(png, "sbagliato.pdf", "image/png");
  assert.match(await page.locator("[data-home-file-status]").innerText(), /estensione/u);
  assert(await page.locator("[data-home-file-result]").isHidden());

  await select(Buffer.alloc(0), "vuoto.pdf", "application/pdf");
  assert.match(await page.locator("[data-home-file-status]").innerText(), /vuoto/u);
  assert(await page.locator("[data-home-file-result]").isHidden());

  // Real DragEvent with in-memory local PDF: dragleave cancels the highlight,
  // drop selects exactly one file; two files refuse without choosing the first.
  await page.locator("[data-home-file-dropzone]").evaluate((zone) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n")], "dal-drop.pdf", { type: "application/pdf" }));
    zone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    if (!zone.classList.contains("home-file-drag-active")) throw Error("missing drag highlight");
    zone.dispatchEvent(new DragEvent("dragleave", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    if (zone.classList.contains("home-file-drag-active")) throw Error("drag cancellation left an active state");
    zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await page.locator("[data-home-file-result]:visible").waitFor();
  assert.match(await page.locator("[data-home-file-status]").innerText(), /PDF riconosciuto/u);

  await page.locator("[data-home-file-dropzone]").evaluate((zone) => {
    const transfer = new DataTransfer();
    for (const name of ["a.pdf", "b.pdf"]) {
      transfer.items.add(new File([new TextEncoder().encode("%PDF-1.7\n%%EOF\n")], name, { type: "application/pdf" }));
    }
    zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  assert.match(await page.locator("[data-home-file-status]").innerText(), /un solo file alla volta/u);
  assert(await page.locator("[data-home-file-result]").isVisible(), "invalid multi-drop retains prior approved suggestions");
  assert.equal((await visibleActions())[0]?.href, "/tools/pdf-page-count-verifier/");

  const seo = await page.locator('meta[name="description"]').getAttribute("content");
  assert(!seo?.includes("Oltre 200"), "stale SEO copy must be gone");
  const catalogSource = await readFile("src/generated/catalog.ts", "utf8");
  const expectedCount = [...catalogSource.matchAll(/^    "id": /gmu)].length;
  assert(expectedCount > 0, "generated catalog must contain tool IDs");
  assert(seo?.includes(`${expectedCount} strumenti`), "SEO count must match generated catalog (" + expectedCount + ")");
  assert.equal(requestsWithFileContents.length, 0, "no request carried private file contents");
  const noScript = await browser.newContext({ viewport: { width: 320, height: 850 }, javaScriptEnabled: false });
  try {
    const fallbackPage = await noScript.newPage();
    await fallbackPage.goto(base + "/", { waitUntil: "domcontentloaded" });
    assert(await fallbackPage.locator("[data-home-file-fallback]").isVisible(), "catalog fallback must render without JavaScript");
    await fallbackPage.locator("[data-home-file-fallback]").click();
    await fallbackPage.waitForURL(/\/strumenti\/?$/u);
  } finally {
    await noScript.close();
  }
  console.log("PASS #334 Chrome local 320/390/768/1024/1440 search, native picker, PDF/PNG/GIF/ZIP/CSV, failures, fallback without JS, no auto-transfer or upload, SEO.");
} finally {
  await browser.close();
}

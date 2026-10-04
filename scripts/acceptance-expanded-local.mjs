import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTIUTILI_ACCEPTANCE_PORT ?? 18159);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`invalid acceptance port: ${process.env.STRUMENTIUTILI_ACCEPTANCE_PORT ?? ""}`);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const pngBytes = await readFile(resolve(root, "quality/fixtures/image-metadata/synthetic-1x1-rgb.png"));
const textFile = (name = "one.txt", text = "one") => ({ name, mimeType: "text/plain", buffer: Buffer.from(text, "utf8") });
const pngFile = (name = "fixture.png") => ({ name, mimeType: "image/png", buffer: pngBytes });
const emptyZip = { name: "empty.zip", mimeType: "application/zip", buffer: Buffer.from("504b0506000000000000000000000000000000000000", "hex") };
const tempRoot = await mkdtemp(join(tmpdir(), "strumentiutili-expanded-local-"));
const directoryFixture = join(tempRoot, "directory");
const zeroByteFixture = join(tempRoot, "zero-byte");
await mkdir(directoryFixture, { recursive: true });
await mkdir(zeroByteFixture, { recursive: true });
await Promise.all([
  writeFile(join(directoryFixture, "one.txt"), "same", "utf8"),
  writeFile(join(directoryFixture, "two.txt"), "same", "utf8"),
  writeFile(join(zeroByteFixture, "empty.txt"), "", "utf8"),
]);

const fill = (label, value) => async (page) => page.getByLabel(label, { exact: true }).fill(value);
const fillFirstTextarea = (value) => async (_page, form) => form.locator("textarea").first().fill(value);
const uploadFirst = (files) => async (_page, form) => form.locator("input[type='file']").first().setInputFiles(files);

const cases = [
  { id: "batch-checksum-manifest", setup: uploadFirst(textFile()), expect: /one\.txt[\s\S]*(?:sha256|manifest)|(?:sha256|manifest)[\s\S]*one\.txt/iu },
  { id: "checksum-verifier", setup: async (_page, form) => { await form.locator("input[type='file']").first().setInputFiles(textFile()); await form.locator("textarea").fill(`${"0".repeat(64)}  one.txt`); }, expect: /mismatch/iu },
  { id: "clean-zip-creator", setup: uploadFirst(textFile()), expect: /local-clean\.zip|byteLength|compression/iu },
  { id: "client-handoff-index-generator", setup: uploadFirst(textFile()), expect: /one\.txt/iu },
  { id: "duplicate-file-finder", setup: async (_page, form) => form.locator("input[type='file']").first().setInputFiles(directoryFixture), expect: /duplicateGroups|duplicateFileCount|duplicati/iu },
  { id: "file-list-diff", setup: async (_page, form) => { const inputs = form.locator("input[type='file']"); await inputs.nth(0).setInputFiles(textFile("same.txt", "a")); await inputs.nth(1).setInputFiles(textFile("same.txt", "changed")); }, expect: /changedCount|modificati|changed/iu },
  { id: "file-signature-detector", setup: uploadFirst(pngFile()), expect: /image\/png/iu },
  { id: "filename-sanitizer", setup: fillFirstTextarea("bad name?.txt"), expect: /changedCount|modificati|ripulito/iu },
  { id: "folder-inventory", setup: async (_page, form) => form.locator("input[type='file']").first().setInputFiles(directoryFixture), expect: /one\.txt/iu },
  { id: "folder-size-type-summary", setup: async (_page, form) => form.locator("input[type='file']").first().setInputFiles(directoryFixture), expect: /txt|text\/plain/iu },
  { id: "safe-share-checklist", setup: uploadFirst(textFile()), expect: /allPassed|checks|passedCount/iu },
  { id: "secret-token-pattern-scanner", setup: fillFirstTextarea("password=12345678"), expect: /findingCount|private-key|secret-assignment|risultati/iu },
  { id: "zero-byte-orphan-finder", setup: async (_page, form) => form.locator("input[type='file']").first().setInputFiles(zeroByteFixture), expect: /emptyFiles|empty\.txt|unreferencedFiles/iu },
  { id: "zip-contents-inspector", setup: uploadFirst(emptyZip), expect: /entryCount|voci|totalUncompressedBytes/iu },
  { id: "zip-creator", setup: uploadFirst(textFile()), expect: /local-files\.zip|byteLength|compression/iu },

  { id: "contact-sheet-generator", setup: uploadFirst([pngFile("one.png"), pngFile("two.png")]), expect: /Colonne|columns|Righe|rows/iu },
  { id: "dominant-color-extractor", setup: uploadFirst(pngFile()), expect: /Colore dominante|dominant/iu },
  { id: "favicon-app-icon-size-generator", setup: uploadFirst(pngFile()), expect: /Scarica|16|512/iu },
  { id: "image-compare-slider", setup: async (_page, form) => { const inputs = form.locator("input[type='file']"); await inputs.nth(0).setInputFiles(pngFile("first.png")); await inputs.nth(1).setInputFiles(pngFile("second.png")); }, expect: /sameDimensions|differenceRatio|differentChannels/iu },
  { id: "image-compression", setup: uploadFirst(pngFile()), expect: /Nome file|filename|Scarica risultato/iu },
  { id: "image-crop", setup: uploadFirst(pngFile()), expect: /Larghezza[\s\S]*1|width[\s\S]*1/iu },
  { id: "image-dimensions-batch-inspector", setup: uploadFirst(pngFile()), expect: /fixture\.png|width|height/iu },
  { id: "image-format-conversion", setup: uploadFirst(pngFile()), expect: /image\/png|Scarica risultato/iu },
  { id: "image-metadata-viewer", setup: uploadFirst(pngFile()), expect: /image\/png/iu },
  { id: "image-rename-batch-preview", setup: uploadFirst(pngFile("hero image.png")), expect: /hero-image|hero image/iu },
  { id: "palette-extractor", setup: uploadFirst(pngFile()), expect: /#[0-9a-f]{6}/iu },
  { id: "perceptual-duplicate-finder", setup: uploadFirst([pngFile("one.png"), pngFile("two.png")]), expect: /one\.png[\s\S]*two\.png|two\.png[\s\S]*one\.png/iu },
  { id: "screenshot-border-background-helper", setup: uploadFirst(pngFile()), expect: /fixture-bordered\.png|NOME FILE/iu },
  { id: "aspect-ratio-calculator", setup: async () => {}, expect: /1:1/iu },
  { id: "color-converter", setup: async () => {}, expect: /#336699/iu },
  { id: "color-picker", setup: async () => {}, expect: /#336699/iu },
  { id: "contrast-checker", setup: async () => {}, expect: /21/iu },

  { id: "conversion-rate-scenario", setup: async (page) => { await fill("Visite", "1000")(page); await fill("Conversioni di partenza", "25")(page); await fill("Tasso di conversione obiettivo", "3")(page); }, expect: /30\.00|20\.00/iu },
  { id: "cpa-cpc-cpm-calculator", setup: async (page) => { await fill("Spesa", "200")(page); await fill("Quantità di riferimento", "8")(page); }, expect: /25\.00/iu },
  { id: "roas-calculator", setup: async (page) => { await fill("Spesa", "200")(page); await fill("Ricavi", "1000")(page); }, expect: /5\.00|500\.00/iu },

  { id: "doi-link-builder", setup: fill("DOI", "10.1000/182"), expect: /https:\/\/doi\.org\/10\.1000\/182/iu },
  { id: "doi-normalizer", setup: fill("DOI", "doi:10.1000/182"), expect: /10\.1000\/182/iu },
  { id: "isbn-validator-converter", setup: fill("ISBN", "0-306-40615-2"), expect: /9780306406157|ISBN-10/iu },
  { id: "quote-counter", setup: fill("Citazione o brano", "uno due tre"), expect: /3/iu },
  { id: "research-url-cleaner", setup: fill("URL di ricerca", "https://example.org/studio?utm_source=nota"), expect: /https:\/\/example\.org\/studio/iu },
  { id: "timeline-sorter", setup: fill("Eventi (array JSON oppure un oggetto per riga)", '[{"title":"Later","date":"2026-02-01"},{"title":"Earlier","date":"2026-01-01"}]'), expect: /Earlier[\s\S]*Later/iu },

  { id: "bulk-domain-extractor", setup: fill("URL o domini", "https://www.example.com/a https://api.example.com/b"), expect: /www\.example\.com|api\.example\.com/iu },
  { id: "canonical-url-helper", setup: async (page) => { await fill("URL della pagina", "https://example.com/articles/one")(page); await fill("Destinazione canonica", "../canonical")(page); }, expect: /https:\/\/example\.com\/canonical/iu },
  { id: "domain-subdomain-grouper", setup: fill("URL o domini", "www.example.com\napi.example.com"), expect: /example\.com/iu },
  { id: "email-domain-extractor", setup: fill("Indirizzi email", "a@example.com, b@example.com"), expect: /example\.com/iu },
  { id: "redirect-chain-inspector", setup: fill("Passaggi di reindirizzamento", "https://example.com/a|301|https://example.com/b\nhttps://example.com/b|200"), expect: /hopCount|2|example\.com\/b/iu },
  { id: "robots-directive-helper", setup: fill("robots.txt", "User-agent: *\nDisallow: /private\nSitemap: https://example.com/sitemap.xml"), expect: /private|sitemap\.xml/iu },
  { id: "url-bulk-normalizer", setup: fill("URL, uno per riga", "HTTPS://EXAMPLE.com/?b=2&a=1"), expect: /https:\/\/example\.com\/\?a=1&b=2/iu },
  { id: "utm-parser", setup: fill("URL della campagna", "https://example.com/?utm_source=a&utm_campaign=x%20y"), expect: /utm_source|x y|campaign/iu },
];

if (cases.length !== 49 || new Set(cases.map(({ id }) => id)).size !== 49) throw new Error(`expanded-local acceptance must contain exactly 49 unique tools; got ${cases.length}`);

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(origin); if (response.ok) return; } catch {}
    await sleep(100);
  }
  throw new Error(`static server did not become ready at ${origin}`);
}

async function a11yAudit(form) {
  return form.locator("input, textarea, select, button").evaluateAll((controls) => controls.filter((control) => {
    const element = control;
    if (element instanceof HTMLInputElement && element.type === "hidden") return false;
    if (element instanceof HTMLButtonElement && (element.textContent ?? "").trim() !== "") return false;
    const id = element.getAttribute("id");
    return !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby") && element.closest("label") === null && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
  }).map((control) => control.outerHTML.slice(0, 160)));
}

// The site shell asks the Worker for the current account session on every route.
// This acceptance server is a plain static file server, so that single endpoint
// answers 404 here by design. Every other failed response, and every console
// error, stays fatal. See scripts/acceptance-family-matrix.mjs for the same rule.
const staticOnlyFailurePaths = new Set(["/api/auth/session"]);
const isExpectedStaticFailure = (url) => {
  try {
    return staticOnlyFailurePaths.has(new URL(url).pathname);
  } catch {
    return false;
  }
};

async function acceptTool(context, testCase) {
  const page = await context.newPage();
  const requests = [];
  const scripts = [];
  const runtimeErrors = [];
  let started = false;
  page.on("request", (request) => {
    if (!started) return;
    requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push({ text: message.text(), url: message.location()?.url ?? "" }); });
  try {
    const response = await page.goto(`${origin}/tools/${testCase.id}/`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`${testCase.id}: HTTP ${response?.status()}`);
    const form = page.locator("form").last();
    await form.waitFor();
    await testCase.setup(page, form);
    const submit = form.locator("button[type='submit']");
    await submit.waitFor();
    started = true;
    await submit.focus();
    await page.keyboard.press("Enter");
    const panel = page.locator(".result-panel").last();
    const resultContent = panel.locator("pre, dl, ul, a.button").first();
    const inlineError = form.locator('[role="alert"]').last();
    const outcome = await Promise.race([
      resultContent.waitFor({ timeout: 15_000 }).then(() => "result"),
      inlineError.waitFor({ timeout: 15_000 }).then(() => "error"),
    ]).catch(() => "timeout");
    if (outcome !== "result") {
      const errorText = outcome === "error" ? await inlineError.innerText().catch(() => "") : "";
      throw new Error(`${testCase.id}: no visible result after submit${errorText === "" ? "" : `; UI error: ${errorText}`}`);
    }
    const output = await panel.innerText();
    if (!testCase.expect.test(output)) throw new Error(`${testCase.id}: contract assertion ${testCase.expect} failed for ${JSON.stringify(output.slice(0, 1200))}`);
    // A console error is tolerated only when its own source URL is the optional
  // account probe; anything else is fatal.
  const consoleErrors = runtimeErrors.filter((entry) => !isExpectedStaticFailure(entry.url));
  if (consoleErrors.length > 0) throw new Error(`${testCase.id}: runtime/console error: ${consoleErrors.map((entry) => `${entry.text} (${entry.url})`).join(" | ")}`);
    if (scripts.length === 0) throw new Error(`${testCase.id}: no lazy implementation script observed after submit`);
    const bad = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
    if (bad.length > 0) throw new Error(`${testCase.id}: external, non-GET, or task-body request observed: ${JSON.stringify(bad)}`);
    const unlabeled = await a11yAudit(form);
    if (unlabeled.length > 0) throw new Error(`${testCase.id}: unlabeled controls: ${unlabeled.join(" | ")}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`${testCase.id}: horizontal overflow at 390px`);
    return { toolId: testCase.id, status: "PASS", assertion: testCase.expect.source, outputSha256: sha256(output), lazyScriptCount: scripts.length, taskRequestCount: requests.length, externalTaskRequests: 0, nonGetTaskRequests: 0, taskContentLeaks: 0, runtimeErrors: 0, horizontalOverflow: false, unlabeledControls: 0 };
  } finally {
    await page.close();
  }
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];
  try {
    for (const testCase of cases) {
      console.log(`accepting ${testCase.id}`);
      results.push(await acceptTool(context, testCase));
    }
  } finally {
    await context.close();
    await browser.close();
  }
  const scriptText = await readFile(new URL(import.meta.url), "utf8");
  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    tools: cases.map(({ id }) => id),
    routesChecked: results.length,
    keyboard: "every submit action exercised with Enter",
    accessibility: "all interactive controls in each tool form have a label or accessible name",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    externalTaskRequests: 0,
    nonGetTaskRequests: 0,
    taskContentLeaks: 0,
    runtimeConsoleErrors: 0,
    network: "zero external, non-GET, or task-body requests after task start",
    implementationEager: false,
    lazyImplementationObservedFor: results.map(({ toolId }) => toolId),
    scriptSha256: sha256(scriptText),
    results,
  };
  const receiptRoot = resolve(root, "quality/receipts/expanded-local");
  await mkdir(receiptRoot, { recursive: true });
  await writeFile(resolve(receiptRoot, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`expanded-local browser acceptance PASS: ${results.length} tools with per-tool output/locality/lazy/mobile/a11y evidence`);
} finally {
  server.kill("SIGTERM");
  await rm(tempRoot, { recursive: true, force: true });
}

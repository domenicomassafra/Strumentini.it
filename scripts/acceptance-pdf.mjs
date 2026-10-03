import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18148;
const origin = `http://127.0.0.1:${port}`;
const fixtureDir = resolve(root, "quality/fixtures/pdf-gold");

// The site shell asks the Worker for the current account session on every route.
// This acceptance server is a plain static file server, so that single endpoint is
// expected to answer 404 here. Every other failed response — and every console error
// that is not a resource-load failure already attributed by URL — stays fatal.
const staticOnlyFailurePaths = new Set(["/api/auth/session"]);
const isExpectedStaticFailure = (url) => {
  try {
    return staticOnlyFailurePaths.has(new URL(url).pathname);
  } catch {
    return false;
  }
};

const simple3 = await readFile(resolve(fixtureDir, "simple-3page.pdf"));
const simple2 = await readFile(resolve(fixtureDir, "simple-2page.pdf"));
const simple2changed = await readFile(resolve(fixtureDir, "simple-2page-changed.pdf"));
const annotated = await readFile(resolve(fixtureDir, "annotated.pdf"));
const jpegPdf = await readFile(resolve(fixtureDir, "jpeg-1page.pdf"));
const encrypted = await readFile(resolve(fixtureDir, "encrypted-mark.pdf"));
const tinyJpg = await readFile(resolve(fixtureDir, "tiny.jpg"));

const pdfFile = (name, buffer) => ({ name, mimeType: "application/pdf", buffer });
const jpgFile = (name, buffer) => ({ name, mimeType: "image/jpeg", buffer });

const fileOnly = (buffer, name = "sample.pdf") => async (_page, form) => {
  await form.locator('input[type="file"]').first().setInputFiles(pdfFile(name, buffer));
};
const textField = (form, index = 0) => form.locator('input:not([type]), input[type="text"]').nth(index);

const cases = [
  { id: "pdf-merge", button: "Unisci PDF", setup: async (_page, form) => { await form.locator('input[type="file"]').first().setInputFiles([pdfFile("a.pdf", simple3), pdfFile("b.pdf", simple3)]); }, expect: /numero_pagine[\s\S]*6/u },
  { id: "pdf-split", button: "Dividi PDF", setup: async (_page, form) => { await form.locator('input[type="file"]').first().setInputFiles(pdfFile("sample.pdf", simple3)); await textField(form).fill("1; 2, 3"); }, expect: /file_generati/u },
  { id: "pdf-page-reorder", button: "Riordina pagine", setup: async (_page, form) => { await form.locator('input[type="file"]').first().setInputFiles(pdfFile("sample.pdf", simple3)); await textField(form).fill("3, 1, 2"); }, expect: /file_generati/u },
  { id: "pdf-rotate", button: "Ruota pagine", setup: async (_page, form) => { await form.locator('input[type="file"]').first().setInputFiles(pdfFile("sample.pdf", simple3)); await textField(form).fill("1"); }, expect: /rotations[\s\S]*"1": 90/u },
  { id: "pdf-page-delete-extract", button: "Applica operazione alle pagine", setup: async (_page, form) => { await form.locator('input[type="file"]').first().setInputFiles(pdfFile("sample.pdf", simple3)); await textField(form).fill("2"); await form.locator("select").first().selectOption({ label: "Elimina le pagine selezionate" }); }, expect: /file_generati/u },
  { id: "images-to-pdf", button: "Crea PDF", setup: async (_page, form) => { await form.locator('input[type="file"]').first().setInputFiles(jpgFile("tiny.jpg", tinyJpg)); }, expect: /numero_pagine[\s\S]*1/u },
  { id: "pdf-to-images", button: "Estrai immagini", setup: fileOnly(jpegPdf), expect: /file_generati/u },
  { id: "pdf-text-extraction", button: "Estrai testo", setup: fileOnly(annotated), expect: /link page/u },
  { id: "pdf-metadata-inspector", button: "Analizza PDF", setup: fileOnly(annotated), expect: /Annotated fixture/u },
  { id: "pdf-metadata-remover", button: "Rimuovi metadati", setup: fileOnly(simple2), expect: /file_generati/u },
  { id: "pdf-page-size-inspector", button: "Analizza dimensioni pagine", setup: fileOnly(annotated), expect: /larghezza[\s\S]*300/u },
  { id: "pdf-page-count-verifier", button: "Verifica numero pagine", setup: fileOnly(annotated), expect: /numero_pagine[\s\S]*1/u },
  { id: "pdf-password-check-remove", button: "Controlla cifratura", setup: fileOnly(encrypted, "encrypted.pdf"), expect: /cifrato[\s\S]*true/u },
  { id: "pdf-flatten", button: "Appiattisci PDF", setup: fileOnly(annotated), expect: /file_generati/u },
  { id: "pdf-form-inspector", button: "Analizza moduli", setup: fileOnly(annotated), expect: /full_name/u },
  { id: "pdf-link-extractor", button: "Estrai collegamenti", setup: fileOnly(annotated), expect: /example\.test/u },
  { id: "pdf-image-extractor", button: "Estrai immagini", setup: fileOnly(jpegPdf), expect: /file_generati/u },
  { id: "pdf-compare-lite", button: "Confronta PDF", setup: async (_page, form) => { const inputs = form.locator('input[type="file"]'); await inputs.nth(0).setInputFiles(pdfFile("first.pdf", simple2)); await inputs.nth(1).setInputFiles(pdfFile("second.pdf", simple2changed)); }, expect: /differences found|differenze/u },
  { id: "pdf-compression-lite", button: "Crea copia alleggerita", setup: fileOnly(simple2), expect: /file_generati/u },
  { id: "document-handoff-manifest", button: "Crea manifest", setup: async (_page, form) => { await form.locator('input[type="file"]').first().setInputFiles(pdfFile("sample.pdf", simple3)); }, expect: /sha256/u },
];

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
    }
    await sleep(250);
  }
  throw new Error("static server did not start");
}

async function acceptTool(context, testCase) {
  const page = await context.newPage();
  const requests = [];
  const scripts = [];
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  let started = false;
  page.on("request", (request) => {
    if (!started) return;
    requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(response.url());
  });
  try {
    const response = await page.goto(`${origin}/tools/${testCase.id}/`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`${testCase.id}: route returned ${response?.status()}`);
    await page.locator('[data-tool-page][data-runtime="LOCAL"]').waitFor();
    const form = page.locator("form.tool-operation");
    await testCase.setup(page, form);
    const submit = form.locator('button[type="submit"]');
    if ((await submit.innerText()).trim() !== testCase.button) throw new Error(`${testCase.id}: submit label is not the Italian action`);
    started = true;
    await submit.focus();
    await page.keyboard.press("Enter");
    const result = page.locator(".result-panel[data-state='success']");
    await result.waitFor({ timeout: 15000 });
    const output = await result.innerText();
    if (!testCase.expect.test(output)) throw new Error(`${testCase.id}: unexpected output ${JSON.stringify(output.slice(0, 900))}`);
    const staticEnvironmentFailures = [...new Set(failedResponses)].filter((url) => isExpectedStaticFailure(url));
    const unexpectedStaticFailures = [...new Set(failedResponses)].filter((url) => !isExpectedStaticFailure(url));
    const unexpectedConsoleErrors = consoleErrors.filter((text) => !/Failed to load resource/u.test(text));
    if (pageErrors.length > 0 || unexpectedConsoleErrors.length > 0 || unexpectedStaticFailures.length > 0) {
      throw new Error(`${testCase.id}: runtime/console error: ${[...pageErrors, ...unexpectedConsoleErrors, ...unexpectedStaticFailures].join(" | ")}`);
    }
    if (scripts.length === 0) throw new Error(`${testCase.id}: no lazy implementation script observed after submit`);
    const bad = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
    if (bad.length > 0) throw new Error(`${testCase.id}: external, non-GET, or task-body request observed`);
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`${testCase.id}: horizontal overflow at 390px`);
    const unlabeled = await form.locator("input, textarea, select, button").evaluateAll((controls) => controls.filter((control) => {
      const element = control;
      if (element instanceof HTMLInputElement && element.type === "hidden") return false;
      if (element instanceof HTMLButtonElement && (element.textContent ?? "").trim() !== "") return false;
      const id = element.getAttribute("id");
      const labelledBy = element.getAttribute("aria-labelledby");
      const ariaLabel = element.getAttribute("aria-label");
      const wrappingLabel = element.closest("label");
      return !ariaLabel && !labelledBy && !wrappingLabel && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
    }).map((control) => control.outerHTML.slice(0, 120)));
    if (unlabeled.length > 0) throw new Error(`${testCase.id}: unlabeled controls: ${unlabeled.join(" | ")}`);
    await page.close();
    return { toolId: testCase.id, lazyScriptCount: scripts.length, taskRequestCount: requests.length, horizontalOverflow: false, unlabeledControls: 0, staticEnvironmentFailures };
  } catch (error) {
    await page.close();
    throw error;
  }
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];
  for (const testCase of cases) results.push(await acceptTool(context, testCase));
  await context.close();
  await browser.close();
  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    tools: cases.map(({ id }) => id),
    routesChecked: results.length,
    keyboard: "every submit action exercised with Enter",
    accessibility: "all interactive controls in the tool form have a label or accessible name",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    externalTaskRequests: 0,
    nonGetTaskRequests: 0,
    taskContentLeaks: 0,
    runtimeConsoleErrors: 0,
    staticEnvironmentFailures: [...new Set(results.flatMap((result) => result.staticEnvironmentFailures))],
    network: "zero external, non-GET, or task-body requests after task start",
    implementationEager: false,
    lazyImplementationObservedFor: results.map((result) => result.toolId),
    results,
  };
  await mkdir(resolve(root, "quality/receipts/pdf"), { recursive: true });
  await writeFile(resolve(root, "quality/receipts/pdf/browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`pdf browser acceptance PASS: ${results.length} tools, keyboard/mobile/a11y/locality/lazy-load observed`);
} finally {
  server.kill("SIGTERM");
}

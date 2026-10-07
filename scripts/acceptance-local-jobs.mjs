import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_LOCAL_JOBS_PORT ?? 18177);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`invalid acceptance port: ${process.env.STRUMENTINI_LOCAL_JOBS_PORT ?? ""}`);
const origin = `http://127.0.0.1:${port}`;
const dist = process.env.STRUMENTINI_ACCEPTANCE_DIST ?? "dist";
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// Binary fixtures come from the committed fixture families, so the browser run
// exercises the very bytes the certification vectors pin.
const binaryFixture = async (family) => JSON.parse(await readFile(resolve(root, `quality/fixtures/${family}/vectors.json`), "utf8"));
const archiveVectors = await binaryFixture("archive-checksum-manifest");
const metadataVectors = await binaryFixture("metadata-risk-scan");
const zipFixture = (id) => {
  const vector = archiveVectors.vectors.find((entry) => entry.id === id);
  if (!vector) throw new Error(`missing archive fixture vector: ${id}`);
  return { name: vector.input.files[0].name, mimeType: "application/zip", buffer: Buffer.from(vector.input.files[0].base64, "base64") };
};
const binaryFixtureFile = (id) => {
  const vector = metadataVectors.vectors.find((entry) => entry.id === id);
  if (!vector) throw new Error(`missing metadata fixture vector: ${id}`);
  const declared = vector.input.files[0];
  const mimeType = declared.name.endsWith(".jpg") ? "image/jpeg" : declared.name.endsWith(".png") ? "image/png" : declared.name.endsWith(".pdf") ? "application/pdf" : "text/plain";
  return { name: declared.name, mimeType, buffer: Buffer.from(declared.base64, "base64") };
};
// The site shell asks the Worker for the current account session on every route.
// This acceptance server is a plain static file server, so that single endpoint
// answers 404 here by design. Every other failed response, and every console
// error, stays fatal.
const staticOnlyFailurePaths = new Set(["/api/auth/session"]);
const isExpectedStaticFailure = (url) => {
  try {
    return staticOnlyFailurePaths.has(new URL(url).pathname);
  } catch {
    return false;
  }
};

const tempRoot = await mkdtemp(join(tmpdir(), "strumentini-local-jobs-"));
const beforeDir = join(tempRoot, "prima");
const afterDir = join(tempRoot, "dopo");
await mkdir(beforeDir, { recursive: true });
await mkdir(afterDir, { recursive: true });
await Promise.all([
  writeFile(join(beforeDir, "relazione.txt"), "stesura uno\n", "utf8"),
  writeFile(join(beforeDir, "uguale.txt"), "identico\n", "utf8"),
  writeFile(join(afterDir, "relazione.txt"), "stesura due\n", "utf8"),
  writeFile(join(afterDir, "uguale.txt"), "identico\n", "utf8"),
  writeFile(join(afterDir, "nuovo.txt"), "aggiunto\n", "utf8"),
]);

// A `<label>` that wraps a help line exposes the whole help text as its
// accessible name, so tool fields with help are matched by substring.
const fill = (label, value, exact = true) => async (page) => page.getByLabel(label, { exact }).fill(value);
const fillFirstTextarea = (value) => async (_page, form) => form.locator("textarea").first().fill(value);
const uploadFirst = (files) => async (_page, form) => form.locator("input[type='file']").first().setInputFiles(files);

const cases = [
  {
    id: "archive-checksum-manifest",
    setup: uploadFirst(zipFixture("zip-two-entries")),
    expect: /consegna\.zip[\s\S]*83f9b22880df83d5713a7c60950be1a93fd34cac056d8e62568d987672132c4a|83f9b22880df83d5713a7c60950be1a93fd34cac056d8e62568d987672132c4a[\s\S]*consegna\.zip/iu,
    note: "digest of the fixture archive must appear in the rendered result",
    errorSetup: async () => {},
  },
  {
    id: "batch-rename-preview",
    setup: async (_page, form) => {
      await form.locator("textarea").first().fill("Foto IMG_1.JPG\nFoto IMG_1.JPG");
      await form.getByPlaceholder("{name}-{index}{ext}").fill("{index}-{name}{ext}");
    },
    expect: /1-Foto IMG_1\.jpg[\s\S]*2-Foto IMG_1-2\.jpg|collisionCount|collision/iu,
    errorSetup: async (_page, form) => { await form.locator("textarea").first().fill(""); },
  },
  {
    id: "folder-compare",
    setup: async (_page, form) => {
      const inputs = form.locator("input[type='file']");
      await inputs.nth(0).setInputFiles(beforeDir);
      await inputs.nth(1).setInputFiles(afterDir);
    },
    expect: /modificati|changedCount|addedCount|aggiunti/iu,
    errorSetup: async () => {},
  },
  {
    id: "metadata-risk-inspector",
    setup: uploadFirst(binaryFixtureFile("jpeg-exif-with-gps")),
    expect: /GPSInfoIFD|Model|metadataFields|contenitori|rischi/iu,
    errorSetup: async () => {},
  },
  {
    id: "language-aware-text-statistics",
    setup: fillFirstTextarea("Ciao, mondo! Привет мир."),
    expect: /Latin|alfabete_dominante|dominantScript|alfabeti/iu,
    noErrorReachable: "the only inputs are free text and the form never rejects them: empty text is a valid zero-count result",
  },
  {
    id: "lorem-sample-data-generator",
    setup: async (page) => {
      await page.getByLabel("Tipo di dati").selectOption("words");
      await fill("Quantità", "4", false)(page);
      await fill("Seme", "7", false)(page);
    },
    expect: /craft[\s\S]*field[\s\S]*quiet[\s\S]*maple/iu,
    note: "the deterministic seed-7 word vector must appear verbatim",
    errorSetup: async (page) => { await fill("Quantità", "0", false)(page); },
  },
  {
    id: "reading-time-estimator",
    setup: async (page) => {
      await page.locator("textarea").first().fill(new Array(250).fill("parola").join(" "));
      await fill("Parole al minuto", "250", false)(page);
    },
    expect: /250[\s\S]*(?:1 minuto|minuti)|\b250\b[\s\S]*60/iu,
    errorSetup: async (page) => { await fill("Parole al minuto", "0", false)(page); },
  },
  {
    id: "smart-quote-normalizer",
    setup: async (_page, form) => {
      await form.locator("textarea").first().fill("\"l'acqua\"");
      await form.getByLabel("Direzione").selectOption("straight-to-curly");
    },
    expect: /“l’[aà]cqua”|convertedCount|virgolette_convertite/iu,
    noErrorReachable: "the direction selector only offers the two valid conversions, so the form cannot submit an invalid direction",
  },
  {
    id: "public-holiday-lookup",
    setup: async (page) => {
      await page.getByLabel("Paese").selectOption("GB");
      await fill("Anno", "2021")(page);
    },
    expect: /2021-12-27[\s\S]*2021-12-28|sostitutiva/iu,
    note: "the 2021 UK weekend Christmas substitutes must both appear",
    errorSetup: async (page) => { await fill("Anno", "1899")(page); },
  },
];

const filePrivacyIds = new Set([
  "archive-checksum-manifest",
  "batch-rename-preview",
  "folder-compare",
  "metadata-risk-inspector",
]);

if (cases.length !== 9 || new Set(cases.map(({ id }) => id)).size !== 9) throw new Error(`local-jobs acceptance must contain exactly 9 unique tools; got ${cases.length}`);

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
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

// Every tool must fail in Italian when it can fail at all. A tool whose form
// cannot produce an error records why, instead of being silently skipped.
async function italianErrorState(context, testCase) {
  if (testCase.noErrorReachable !== undefined) return { verified: false, reason: testCase.noErrorReachable };
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/tools/${testCase.id}/`, { waitUntil: "networkidle" });
    const form = page.locator("form").last();
    await form.waitFor();
    if (testCase.errorSetup !== undefined) await testCase.errorSetup(page, form);
    const submit = form.locator("button[type='submit']");
    await submit.focus();
    await page.keyboard.press("Enter");
    const alert = form.locator('[role="alert"]').last();
    const outcome = await Promise.race([
      alert.waitFor({ timeout: 15_000 }).then(() => "error"),
      form.locator("pre, dl, ul, a.button").last().waitFor({ timeout: 15_000 }).then(() => "result"),
    ]).catch(() => "timeout");
    if (outcome !== "error") throw new Error(`${testCase.id}: the declared error state produced no alert`);
    const text = await alert.innerText();
    const verified = !/[A-Z][A-Z0-9_]{4,}/u.test(text) && /[àèéìòù]|\b(?:controlla|verifica|inserisci|scegli|operazione|file|testo|limite|annullata|riprova|parametri)\b/iu.test(text);
    return { verified, sample: text.slice(0, 200) };
  } finally {
    await page.close();
  }
}

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
  const responseFailures = [];
  page.on("response", (response) => { if (response.status() >= 400) responseFailures.push(`${response.status()} ${response.url()}`); });
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
    const terminalResult = page.locator(".result-panel[data-state='success'], .result-panel[data-state='warning'], .result-panel[data-state='partial']").last();
    const inlineError = form.locator('[role="alert"]').last();
    const outcome = await Promise.race([
      terminalResult.waitFor({ timeout: 15_000 }).then(() => "result"),
      inlineError.waitFor({ timeout: 15_000 }).then(() => "error"),
    ]).catch(() => "timeout");
    if (outcome !== "result") {
      const errorText = outcome === "error" ? await inlineError.innerText().catch(() => "") : "";
      throw new Error(`${testCase.id}: no visible result after submit${errorText === "" ? "" : `; UI error: ${errorText}`}`);
    }
    const output = await panel.innerText();
    if (!testCase.expect.test(output)) throw new Error(`${testCase.id}: contract assertion ${testCase.expect} failed for ${JSON.stringify(output.slice(0, 1200))}`);
    let resultV2Class = null;
    let fileWorkspace = false;
    if (filePrivacyIds.has(testCase.id)) {
      const semantic = panel.locator("[data-result-class]").last();
      if (await semantic.count() !== 1) throw new Error(`${testCase.id}: Result v2 semantic root is missing`);
      resultV2Class = await semantic.getAttribute("data-result-class");
      const expectedClass = testCase.id === "archive-checksum-manifest"
        ? "text-code"
        : testCase.id === "metadata-risk-inspector"
          ? "validator"
          : "batch";
      if (resultV2Class !== expectedClass) throw new Error(`${testCase.id}: Result v2 class ${resultV2Class} does not match ${expectedClass}`);
      const slots = await semantic.locator("[data-result-slot]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-result-slot")));
      const requiredSlot = expectedClass === "text-code" ? "selectable-output" : expectedClass === "validator" ? "checks" : "batch-summary";
      if (!slots.includes(requiredSlot)) throw new Error(`${testCase.id}: Result v2 slot ${requiredSlot} is missing (${slots.join(",")})`);
      fileWorkspace = await semantic.locator('section[aria-label="File elaborati"]').count() === 1;
      if (!fileWorkspace) throw new Error(`${testCase.id}: FileResultWorkspace is missing`);
      const privacyCopy = await semantic.locator('section[aria-label="File elaborati"] .file-note').first().innerText();
      if (!/browser|rete/iu.test(privacyCopy)) throw new Error(`${testCase.id}: local privacy copy is missing from FileResultWorkspace`);
      const actionIds = await semantic.locator("[data-result-action]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-result-action")));
      for (const required of ["retry", "reset"]) {
        if (!actionIds.includes(required)) throw new Error(`${testCase.id}: Result v2 action ${required} is missing`);
      }
    }
    const expectedFailures = responseFailures.filter((failure) => isExpectedStaticFailure(failure.slice(failure.indexOf(" ") + 1)));
    const unexpectedFailures = responseFailures.filter((failure) => !expectedFailures.includes(failure));
    if (unexpectedFailures.length > 0) throw new Error(`${testCase.id}: unexpected failed response: ${unexpectedFailures.join(" | ")}`);
    // A console error is tolerated only when its own source URL is the optional
    // account probe; anything else is fatal.
    const consoleErrors = runtimeErrors.filter((entry) => !isExpectedStaticFailure(entry.url));
    if (consoleErrors.length > 0) throw new Error(`${testCase.id}: runtime/console error: ${consoleErrors.map((entry) => `${entry.text} (${entry.url})`).join(" | ")}`);
    if (expectedFailures.length > 1) throw new Error(`${testCase.id}: more than one optional-account failure observed: ${expectedFailures.join(" | ")}`);
    if (scripts.length === 0) throw new Error(`${testCase.id}: no lazy implementation script observed after submit`);
    const bad = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
    if (bad.length > 0) throw new Error(`${testCase.id}: external, non-GET, or task-body request observed: ${JSON.stringify(bad)}`);
    const unlabeled = await a11yAudit(form);
    if (unlabeled.length > 0) throw new Error(`${testCase.id}: unlabeled controls: ${unlabeled.join(" | ")}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`${testCase.id}: horizontal overflow at 390px`);
    return {
      toolId: testCase.id,
      status: "PASS",
      assertion: testCase.note ?? testCase.expect.source,
      outputSha256: sha256(output),
      lazyScriptCount: scripts.length,
      taskRequestCount: requests.length,
      externalTaskRequests: 0,
      nonGetTaskRequests: 0,
      taskContentLeaks: 0,
      runtimeErrors: consoleErrors.length,
      horizontalOverflow: false,
      unlabeledControls: 0,
      optionalAccountProbeFailures: expectedFailures.length,
      resultV2Class,
      fileWorkspace,
    };
  } finally {
    await page.close();
  }
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];
  const italianErrors = {};
  try {
    for (const testCase of cases) {
      console.log(`accepting ${testCase.id}`);
      results.push(await acceptTool(context, testCase));
      const observed = await italianErrorState(context, testCase);
      if (observed.verified !== true && observed.reason === undefined) throw new Error(`${testCase.id}: Italian error state is missing or leaks a machine code: ${JSON.stringify(observed)}`);
      italianErrors[testCase.id] = observed;
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
    italianErrorStates: italianErrors,
    scriptSha256: sha256(scriptText),
    results,
  };
  const receiptRoot = resolve(root, "quality/receipts/local-jobs");
  await mkdir(receiptRoot, { recursive: true });
  await writeFile(resolve(receiptRoot, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`local-jobs browser acceptance PASS: ${results.length} tools with per-tool output/locality/lazy/mobile/a11y/Italian-error evidence`);
} finally {
  server.kill("SIGTERM");
  await rm(tempRoot, { recursive: true, force: true });
}

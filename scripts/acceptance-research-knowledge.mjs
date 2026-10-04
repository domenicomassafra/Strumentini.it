import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTIUTILI_ACCEPTANCE_PORT ?? 18161);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`invalid acceptance port: ${process.env.STRUMENTIUTILI_ACCEPTANCE_PORT ?? ""}`);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const RIS_SOURCE = "TY  - JOUR\nAU  - Ada Smith\nTI  - A Synthetic Fixture\nJO  - Journal of Fixtures\nPY  - 2026\nSP  - 10\nEP  - 18\nDO  - 10.1000/182\nER  - \n";
const BIBTEX_SOURCE = "@comment{nota per i manutentori, da non mostrare}\n@article{rossi2026,\n  year = {2026},\n  title = {Uno studio},\n  author = {Ada Rossi},\n  doi = {10.1000/182}\n}\n";
const CITATIONS = [
  { title: "Uno studio", author: "Ada Smith", year: "2026", doi: "10.1000/182" },
  { title: "Due studi", author: "Bob Jones", year: "2025", isbn: "0-306-40615-2" },
  { title: "Uno studio", author: "Ada Smith", year: "2026", doi: "doi:10.1000/182" },
];
const READING_LIST = [
  { title: "Un libro", isbn: "0-306-40615-2" },
  { title: "Un libro (edizione 978)", isbn: "978-0-306-40615-7" },
  { title: "Un articolo", url: "https://example.org/paper" },
  { title: "Un articolo", url: "https://example.org/paper?utm_source=nota" },
];
const REFERENCES = [
  { title: "Zeta", authors: ["Ada Rossi"], year: "2020" },
  { title: "Alfa", authors: ["Bob Neri"], year: "2019" },
];
const EVIDENCE = [
  { title: "Uno studio", url: "https://example.org/a", date: "2026", doi: "10.1000/182" },
  { title: "Due studi", source: "Journal of Fixtures", year: "2025" },
];
const URL_LIST = [
  "https://example.org/a",
  "https://EXAMPLE.org/b",
  "https://example.org/a?utm_source=nota",
  "not a url",
  "javascript:alert(1)",
];

const cases = [
  {
    id: "bibtex-formatter",
    boundary: { kind: "typed-error", invalid: { BibTeX: "" } },
    fill: { BibTeX: BIBTEX_SOURCE },
    // A @comment directive is skipped, disclosed, and never emitted as an entry.
    expect: /@article\{rossi2026,[\s\S]*author = \{Ada Rossi\}[\s\S]*year = \{2026\}/su,
    alsoExpect: [/Le direttive @comment non sono voci bibliografiche/u],
    mustNotMatch: [/@article\{comment/u],
  },
  {
    id: "bibtex-deduplicator",
    boundary: { kind: "typed-error", invalid: { BibTeX: "" } },
    fill: { BibTeX: "@article{a, title = {A}, doi = {10.1000/182}}\n@article{b, title = {B}, doi = {doi:10.1000/182}}\n" },
    expect: /1 duplicato rimosso · regole: doi/u,
    alsoExpect: [/@article\{a,\n  title = \{A\}/u],
    mustNotMatch: [/@article\{b,/u],
  },
  {
    id: "citation-deduplicator",
    // The identity rule is a fixed option list, so an invalid mode is not
    // reachable from the page; the module-level rejection is covered by unit tests.
    boundary: { kind: "empty-result" },
    fill: { "Citazioni (array JSON oppure un oggetto per riga)": JSON.stringify(CITATIONS), "Regola di identità": "identifier" },
    expect: /1 duplicato rimosso/u,
  },
  {
    id: "citation-key-generator",
    boundary: { kind: "empty-result" },
    fill: { "Citazioni (array JSON oppure un oggetto per riga)": JSON.stringify([{ author: "Smith, Ada", title: "Deep Learning", year: "2026" }, { author: "Ada Smith", title: "Deep Learning", year: "2026" }]) },
    expect: /smith_2026_deep_2/u,
    alsoExpect: [/1 chiave con suffisso/u],
  },
  {
    id: "date-source-normalizer",
    boundary: { kind: "typed-error", invalid: { Data: "" } },
    fill: { Data: "24 settembre 2026" },
    expect: /2026-09-24/u,
  },
  {
    id: "domain-frequency-counter",
    boundary: { kind: "empty-result" },
    fill: { "URL (uno per riga)": URL_LIST.join("\n") },
    expect: /3 occorrenze, 1 dominio · 2 valori non validi/u,
  },
  {
    id: "evidence-table-builder",
    boundary: { kind: "empty-result" },
    fill: { "Evidenze (array JSON oppure un oggetto per riga)": JSON.stringify(EVIDENCE) },
    expect: /title,url,date,source,doi,notes/u,
  },
  {
    id: "notes-deduplicator",
    boundary: { kind: "empty-result" },
    fill: { "Note (array JSON oppure una per riga)": "prima\nPRIMA\nseconda" },
    expect: /1 duplicato rimosso/u,
  },
  {
    id: "pdf-page-citation-helper",
    boundary: { kind: "typed-error", invalid: { Pagine: "" } },
    fill: { Autore: "A. Rossi", "Titolo del documento": "Uno studio", Anno: "2026", Pagine: "12--15", Stile: "mla" },
    expect: /pp\. 12–15/u,
  },
  {
    id: "reading-list-deduplicator",
    boundary: { kind: "empty-result" },
    fill: { "Elementi della lista (array JSON oppure un oggetto per riga)": JSON.stringify(READING_LIST) },
    expect: /"rimossi": 1|"removed": 1/u,
  },
  {
    id: "reference-list-sorter",
    boundary: { kind: "empty-result" },
    fill: { "Riferimenti (array JSON oppure un oggetto per riga)": JSON.stringify(REFERENCES), "Ordina per": "author" },
    expect: /"confronto":\s*"cognome del primo autore/u,
  },
  {
    id: "research-pack-manifest",
    boundary: { kind: "typed-error", invalid: { "Nome del pacchetto": "" } },
    fill: { "Nome del pacchetto": "Ricerca di base", "ID strumenti (uno per riga)": "quote-counter\ndoi-normalizer\nquote-counter" },
    expect: /"algoritmo_checksum":\s*"SHA-256"/u,
  },
  {
    id: "ris-bibtex-converter",
    boundary: { kind: "typed-error", invalid: { "RIS o BibTeX": "" } },
    fill: { "RIS o BibTeX": RIS_SOURCE, Direzione: "ris-to-bibtex" },
    expect: /smith_2026_synthetic/u,
    alsoExpect: [/@article\{smith_2026_synthetic,\n  author = \{Ada Smith\}/u],
  },
  {
    id: "vocabulary-frequency-analyzer",
    boundary: { kind: "typed-error", invalid: { Testo: "" } },
    fill: { Testo: "il gatto e il cane con una casa per la città", "Lunghezza minima del termine": "1", "Numero massimo di termini": "10" },
    expect: /"percorso_parole_chiave":\s*"it\+en"/u,
  },
];

if (cases.length !== 14 || new Set(cases.map(({ id }) => id)).size !== 14) throw new Error(`research-knowledge acceptance must contain exactly 14 unique tools; got ${cases.length}`);
for (const testCase of cases) {
  if (testCase.boundary === undefined) throw new Error(`${testCase.id}: every case must declare its boundary behaviour`);
}

// The site shell asks the optional account Worker for the current session on every
// route. This acceptance server is a plain static file server, so that one endpoint
// is expected to answer 404 here — the same static-only boundary the family matrix
// already records. Every other failed response or console error stays fatal.
const staticOnlyFailurePaths = new Set(["/api/auth/session"]);
const isExpectedStaticFailure = (url) => {
  try {
    return staticOnlyFailurePaths.has(new URL(url).pathname);
  } catch {
    return false;
  }
};

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

/**
 * Probes the declared boundary. A tool with a rejected input must show a
 * non-empty Italian message and never leak a machine code; a tool whose contract
 * accepts an empty or free-form input must still render a deterministic result
 * instead of crashing or hanging.
 */
async function checkBoundaryState(page, form, submit, testCase) {
  if (testCase.boundary.kind === "empty-result") {
    const firstField = form.locator("input[type='text'], textarea").first();
    await firstField.fill("");
    await submit.focus();
    await page.keyboard.press("Enter");
    const output = page.locator(".result-panel").last().locator("pre").first();
    await output.waitFor({ timeout: 15_000 });
    const text = await page.locator(".result-panel").last().innerText();
    if (text.trim() === "") throw new Error(`${testCase.id}: an empty input produced no visible deterministic result`);
    return "empty-input-result";
  }
  for (const [label, value] of Object.entries(testCase.boundary.invalid ?? {})) {
    const control = form.locator("label").filter({ hasText: label }).locator("input, textarea, select").first();
    await control.waitFor();
    const tag = await control.evaluate((element) => element.tagName);
    if (tag === "SELECT") await control.selectOption(value.trim());
    else await control.fill(value);
  }
  if (testCase.boundary.invalid === undefined) {
    await form.locator("input[type='text'], textarea").first().fill("");
  }
  await submit.focus();
  await page.keyboard.press("Enter");
  const alert = form.locator('[role="alert"]').last();
  await alert.waitFor({ timeout: 15_000 });
  const alertText = await alert.innerText();
  if (alertText.trim() === "") throw new Error(`${testCase.id}: empty public error state`);
  if (/INVALID_INPUT|INPUT_TOO_LARGE|NOT_FOUND|RUNTIME_ERROR|ABORT|CANCELLED/u.test(alertText)) {
    throw new Error(`${testCase.id}: machine error code leaked into the public error state: ${alertText}`);
  }
  return "typed-italian-error";
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
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    if (isExpectedStaticFailure(location)) return;
    runtimeErrors.push(`${message.text()} @ ${location}`);
  });
  page.on("requestfailed", (request) => {
    if (isExpectedStaticFailure(request.url())) return;
    runtimeErrors.push(`request failed ${request.url()}`);
  });
  try {
    const response = await page.goto(`${origin}/tools/${testCase.id}/`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`${testCase.id}: HTTP ${response?.status()}`);
    const form = page.locator("form").last();
    await form.waitFor();
    for (const [label, value] of Object.entries(testCase.fill)) {
      // Resolve the control through its own <label>, which proves the visible
      // label is bound to the control instead of only sitting next to it.
      const control = form.locator("label").filter({ hasText: label }).locator("input, textarea, select").first();
      await control.waitFor();
      const tag = await control.evaluate((element) => element.tagName);
      if (tag === "SELECT") await control.selectOption(value);
      else await control.fill(value);
    }
    const submit = form.locator("button[type='submit']");
    await submit.waitFor();
    started = true;
    await submit.focus();
    await page.keyboard.press("Enter");
    const panel = page.locator(".result-panel").last();
    const output = panel.locator("pre").first();
    const inlineError = form.locator('[role="alert"]').last();
    const outcome = await Promise.race([
      output.waitFor({ timeout: 15_000 }).then(() => "result"),
      inlineError.waitFor({ timeout: 15_000 }).then(() => "error"),
    ]).catch(() => "timeout");
    if (outcome !== "result") {
      const errorText = outcome === "error" ? await inlineError.innerText().catch(() => "") : "";
      throw new Error(`${testCase.id}: no visible result after submit${errorText === "" ? "" : `; UI error: ${errorText}`}`);
    }
    const text = await panel.innerText();
    if (!testCase.expect.test(text)) throw new Error(`${testCase.id}: contract assertion ${testCase.expect} failed for ${JSON.stringify(text.slice(0, 1200))}`);
    for (const assertion of testCase.alsoExpect ?? []) {
      if (!assertion.test(text)) throw new Error(`${testCase.id}: secondary assertion ${assertion} failed for ${JSON.stringify(text.slice(0, 1200))}`);
    }
    for (const forbidden of testCase.mustNotMatch ?? []) {
      if (forbidden.test(text)) throw new Error(`${testCase.id}: forbidden pattern ${forbidden} appeared for ${JSON.stringify(text.slice(0, 1200))}`);
    }
    if (runtimeErrors.length > 0) throw new Error(`${testCase.id}: runtime/console error: ${runtimeErrors.join(" | ")}`);
    if (scripts.length === 0) throw new Error(`${testCase.id}: no lazy implementation script observed after submit`);
    const bad = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
    if (bad.length > 0) throw new Error(`${testCase.id}: external, non-GET, or task-body request observed: ${JSON.stringify(bad)}`);
    const unlabeled = await a11yAudit(form);
    if (unlabeled.length > 0) throw new Error(`${testCase.id}: unlabeled controls: ${unlabeled.join(" | ")}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`${testCase.id}: horizontal overflow at 390px`);
    const boundary = await checkBoundaryState(page, form, submit, testCase);
    return { toolId: testCase.id, status: "PASS", assertion: testCase.expect.source, outputSha256: sha256(text), lazyScriptCount: scripts.length, taskRequestCount: requests.length, externalTaskRequests: 0, nonGetTaskRequests: 0, taskContentLeaks: 0, runtimeErrors: 0, horizontalOverflow: false, unlabeledControls: 0, publicErrorCopy: "it", boundaryState: boundary };
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
    keyboard: "every submit action exercised with Enter, including the error state",
    accessibility: "all interactive controls in each tool form have a label or accessible name",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    externalTaskRequests: 0,
    nonGetTaskRequests: 0,
    taskContentLeaks: 0,
    runtimeConsoleErrors: 0,
    network: "zero external, non-GET, or task-body requests after task start",
    implementationEager: false,
    lazyImplementationObservedFor: results.map(({ toolId }) => toolId),
    publicErrorCopy: "tools with a rejected input show a non-empty Italian message and never a machine code; the others still render a deterministic result for an empty input",
    scriptSha256: sha256(scriptText),
    results,
  };
  const receiptRoot = resolve(root, "quality/receipts/research-knowledge");
  await mkdir(receiptRoot, { recursive: true });
  await writeFile(resolve(receiptRoot, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`research-knowledge browser acceptance PASS: ${results.length} tools with per-tool output/locality/lazy/mobile/a11y/Italian-error evidence`);
} finally {
  server.kill("SIGTERM");
}

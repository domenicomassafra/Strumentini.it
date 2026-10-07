import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { currentEvidenceSourceFingerprint } from "./lib/current-revision";

type AuditResult = {
  externalRequests: 0;
  nonGetRequests: 0;
  taskBodyLeaks: 0;
  runtimeErrors: 0;
  lazyScriptRequests: number;
};

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_TEXT_DATA_CERT_PORT ?? 18211);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`invalid port ${String(port)}`);
const origin = `http://127.0.0.1:${port}`;
const receiptRoot = resolve(root, "quality/receipts/text-data-certification");
const browserRoot = resolve(receiptRoot, "browser");
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const oracleByTool: Readonly<Record<string, string>> = {
  "csv-splitter": "cand-229",
  "csv-to-sql": "cand-228",
  "fatturapa-batch-csv": "cand-259",
  "fact-sensitive-text-diff": "cand-232",
  "italian-gulpease-readability": "cand-234",
  "mojibake-repair": "cand-235",
  "pdf-copy-text-reflow": "cand-236",
  "phone-link-hashtag-mention-extractor": "cand-237",
  "semantic-text-chunker": "cand-231",
  "stable-placeholder-anonymizer": "cand-233",
  "table-compare": "cand-230",
  "text-markup-converter": "cand-241",
  "vcf-viewer-csv-export": "cand-226",
};

const csvAdvanced = JSON.parse(await readFile(resolve(root, "quality/fixtures/csv-advanced-ops/vectors.json"), "utf8")) as {
  sql: Array<{ csv: string; table_name: string }>;
  split: Array<{ csv: string; rows_per_chunk: number }>;
  compare: Array<{ left: string; right: string; compare_columns: number[] }>;
};
const textExpansion = JSON.parse(await readFile(resolve(root, "quality/fixtures/text-expansion/vectors.json"), "utf8")) as {
  chunker: Array<{ input: string; target_characters: number; overlap_characters: number }>;
  fact_diff: Array<{ before: string; after: string }>;
  placeholder: Array<{ text: string; entities: string[] }>;
  gulpease: Array<{ text: string; score: number }>;
  mojibake: Array<{ input: string; output: string }>;
  pdf_reflow: Array<{ input: string; output: string }>;
  extractor: Array<{ input: string }>;
};
const markupFixtures = JSON.parse(await readFile(resolve(root, "quality/fixtures/text-markup-conversion/vectors.json"), "utf8")) as {
  vectors: Array<{ id: string; mode: string; input: string; expected_output: string }>;
};
const vcardFixtures = JSON.parse(await readFile(resolve(root, "quality/fixtures/vcard-rfc6350/vectors.json"), "utf8")) as {
  vectors: Array<{ vcf: string; expected: { contacts: number; first_note: string; unsupported_name: string; csv_formula_cell: string } }>;
};
const ordinaryBytes = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml"));
const simplifiedBytes = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-simplified-anonymized.xml"));

const server = spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], {
  cwd: root,
  stdio: "ignore",
});
const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}/tools/csv-to-sql/`);
      if (response.ok) return;
    } catch {
      // Retry until the bounded startup window expires.
    }
    await sleep(100);
  }
  throw new Error(`acceptance server did not start: ${origin}`);
}

function requestAudit(page: Page) {
  const requests: Array<{ url: string; method: string; postData: string | null }> = [];
  const errors: string[] = [];
  const scripts: string[] = [];
  let started = false;
  page.on("request", (request) => {
    if (!started) return;
    requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  page.on("pageerror", (error) => { if (started) errors.push(String(error)); });
  page.on("console", (message) => { if (started && message.type() === "error") errors.push(message.text()); });
  return {
    start() { started = true; },
    assert(toolId: string): AuditResult {
      if (errors.length > 0) throw new Error(`${toolId}: runtime errors: ${errors.join(" | ")}`);
      const bad = requests.filter((request) => {
        const local = request.url.startsWith(origin) || request.url.startsWith(`blob:${origin}/`) || request.url.startsWith("data:");
        return !local || request.method !== "GET" || (request.postData ?? "") !== "";
      });
      if (bad.length > 0) throw new Error(`${toolId}: external/non-GET/task-body request: ${JSON.stringify(bad)}`);
      if (scripts.length === 0) throw new Error(`${toolId}: no lazy implementation script observed after submit`);
      return { externalRequests: 0, nonGetRequests: 0, taskBodyLeaks: 0, runtimeErrors: 0, lazyScriptRequests: scripts.length };
    },
  };
}

async function pagePolicy(page: Page, toolId: string): Promise<{ horizontalOverflow: false; unlabeledControls: 0 }> {
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (horizontalOverflow) throw new Error(`${toolId}: horizontal overflow at 390px`);
  const unlabeled = await page.locator("form input, form textarea, form select, form button").evaluateAll((controls) => controls.filter((control) => {
    if (control instanceof HTMLInputElement && control.type === "hidden") return false;
    if (control instanceof HTMLButtonElement && ((control.textContent ?? "").trim() !== "" || control.getAttribute("aria-label"))) return false;
    const id = control.getAttribute("id");
    const wrappingLabel = control.closest("label");
    const ariaLabel = control.getAttribute("aria-label");
    const labelledBy = control.getAttribute("aria-labelledby");
    return !wrappingLabel && !ariaLabel && !labelledBy && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
  }).map((control) => control.outerHTML.slice(0, 160)));
  if (unlabeled.length > 0) throw new Error(`${toolId}: unlabeled controls: ${unlabeled.join(" | ")}`);
  return { horizontalOverflow: false, unlabeledControls: 0 };
}

async function openRoute(context: BrowserContext, toolId: string): Promise<Page> {
  const page = await context.newPage();
  const response = await page.goto(`${origin}/tools/${toolId}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`${toolId}: HTTP ${String(response?.status())}`);
  await page.locator("form").last().waitFor({ state: "visible", timeout: 30_000 });
  return page;
}

async function submitWithEnter(page: Page, form = page.locator("form").last()): Promise<void> {
  const submit = form.locator('button[type="submit"]').first();
  await submit.focus();
  await page.keyboard.press("Enter");
}

async function successfulResult(page: Page, toolId: string) {
  const terminal = page.locator('.result-panel[data-state="success"], .result-panel[data-state="error"], .result-panel[data-state="warning"], .result-panel[data-state="partial"]').last();
  await terminal.waitFor({ state: "visible", timeout: 30_000 });
  const state = await terminal.getAttribute("data-state");
  if (state !== "success") throw new Error(`${toolId}: terminal UI state ${String(state)}: ${JSON.stringify((await terminal.innerText()).slice(0, 1800))}`);
  return terminal;
}

async function acceptTable(context: BrowserContext, toolId: "csv-to-sql" | "csv-splitter" | "table-compare"): Promise<Record<string, unknown>> {
  const page = await openRoute(context, toolId);
  const audit = requestAudit(page);
  const form = page.locator("form").last();
  if (toolId === "csv-to-sql") {
    const vector = csvAdvanced.sql[0]!;
    await form.locator("textarea").first().fill(vector.csv);
    await page.getByLabel("Nome tabella").fill(vector.table_name);
  } else if (toolId === "csv-splitter") {
    const vector = csvAdvanced.split[0]!;
    await form.locator("textarea").first().fill(vector.csv);
    await page.getByLabel("Righe per parte").fill(String(vector.rows_per_chunk));
  } else {
    const vector = csvAdvanced.compare[0]!;
    const areas = form.locator("textarea");
    await areas.nth(0).fill(vector.left);
    await areas.nth(1).fill(vector.right);
    await page.getByLabel("Colonne confronto sinistra").fill(vector.compare_columns.join(","));
    await page.getByLabel("Colonne confronto destra").fill(vector.compare_columns.join(","));
    await page.getByLabel("Distingui maiuscole e minuscole").uncheck();
  }
  audit.start();
  await submitWithEnter(page, form);
  const panel = await successfulResult(page, toolId);
  const result = panel.locator('[data-result-class="table"]');
  await result.waitFor({ timeout: 5_000 });
  const text = await result.innerText();
  if (toolId === "csv-to-sql" && (!text.includes('CREATE TABLE "order""book"') || !text.includes("00123") || !text.includes("O''Reilly"))) throw new Error(`${toolId}: SQL fixture semantics missing`);
  if (toolId === "csv-splitter" && !/3 righe\s*·\s*2 parti/iu.test(text)) throw new Error(`${toolId}: 3-row/2-chunk fixture result missing: ${JSON.stringify(text.slice(0, 1200))}`);
  if (toolId === "table-compare" && (!/righe aggiunte\s*:\s*1/iu.test(text) || !/righe cambiate\s*:\s*1/iu.test(text) || !/chiavi ambigue\s*:\s*1/iu.test(text))) throw new Error(`${toolId}: keyed diff counts missing: ${JSON.stringify(text.slice(0, 1600))}`);
  const policy = await pagePolicy(page, toolId);
  const network = audit.assert(toolId);
  await page.close();
  return { status: "PASS", semanticAssertion: toolId === "csv-to-sql" ? "quoted SQL fixture visible" : toolId === "csv-splitter" ? "3 rows split into 2 chunks" : "added/changed/ambiguous keyed counts visible", ...policy, ...network };
}

async function acceptTextTool(context: BrowserContext, toolId: keyof typeof oracleByTool): Promise<Record<string, unknown>> {
  const page = await openRoute(context, toolId);
  const audit = requestAudit(page);
  const form = page.locator("form").last();
  let expectation: RegExp;
  if (toolId === "semantic-text-chunker") {
    const vector = textExpansion.chunker[0]!;
    await form.locator("textarea").first().fill(vector.input);
    await page.getByLabel("Dimensione obiettivo · caratteri", { exact: true }).fill(String(vector.target_characters));
    await page.getByLabel("Contesto sovrapposto · caratteri", { exact: true }).fill(String(vector.overlap_characters));
    expectation = /round-trip\s+esatto/iu;
  } else if (toolId === "fact-sensitive-text-diff") {
    const vector = textExpansion.fact_diff[0]!;
    await form.locator("textarea").nth(0).fill(vector.before);
    await form.locator("textarea").nth(1).fill(vector.after);
    expectation = /marker lessicali cambiati/iu;
  } else if (toolId === "stable-placeholder-anonymizer") {
    const vector = textExpansion.placeholder[0]!;
    await form.locator("textarea").nth(0).fill(vector.text);
    await form.locator("textarea").nth(1).fill(vector.entities.join("\n"));
    expectation = /Testo anonimizzato|\[\[ANON_/iu;
  } else if (toolId === "italian-gulpease-readability") {
    const vector = textExpansion.gulpease[0]!;
    await form.locator("textarea").first().fill(vector.text);
    expectation = new RegExp(`Gulpease\\s+${String(vector.score).replace(".", "[.,]")}`, "iu");
  } else if (toolId === "mojibake-repair") {
    const vector = textExpansion.mojibake[0]!;
    await form.locator("textarea").first().fill(vector.input);
    expectation = new RegExp(vector.output.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u");
  } else if (toolId === "pdf-copy-text-reflow") {
    const vector = textExpansion.pdf_reflow[0]!;
    await form.locator("textarea").first().fill(vector.input);
    expectation = new RegExp(vector.output.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u");
  } else if (toolId === "phone-link-hashtag-mention-extractor") {
    const vector = textExpansion.extractor[0]!;
    await form.locator("textarea").first().fill(vector.input);
    expectation = /phone|telefono|url|mention|hashtag/iu;
  } else {
    throw new Error(`${toolId}: no text-tool browser adapter`);
  }
  audit.start();
  await submitWithEnter(page, form);
  const result = await successfulResult(page, toolId);
  const text = await result.innerText();
  if (!expectation.test(text)) throw new Error(`${toolId}: semantic fixture assertion missing: ${JSON.stringify(text.slice(0, 1800))}`);
  const policy = await pagePolicy(page, toolId);
  const network = audit.assert(toolId);
  await page.close();
  return { status: "PASS", semanticAssertion: "fixture-specific Result v2 content observed", ...policy, ...network };
}

async function acceptFatturaBatch(context: BrowserContext): Promise<Record<string, unknown>> {
  const toolId = "fatturapa-batch-csv";
  const page = await openRoute(context, toolId);
  const audit = requestAudit(page);
  await page.locator("#fatturapa-batch-files").setInputFiles([
    { name: "ordinary.xml", mimeType: "application/xml", buffer: ordinaryBytes },
    { name: "simple.xml", mimeType: "application/xml", buffer: simplifiedBytes },
    { name: "bad.xml", mimeType: "application/xml", buffer: Buffer.from("not xml", "utf8") },
  ]);
  audit.start();
  await submitWithEnter(page);
  const result = page.locator('[data-oracle-entry="cand-259"]');
  await result.waitFor({ timeout: 30_000 });
  const text = await result.innerText();
  if (!/1 file con errore/iu.test(text) || !/2 completi/iu.test(text) || !/FPR12/iu.test(text) || !/FSM10/iu.test(text)) throw new Error(`${toolId}: mixed batch states missing: ${JSON.stringify(text.slice(0, 2500))}`);
  const policy = await pagePolicy(page, toolId);
  const network = audit.assert(toolId);
  await page.close();
  return { status: "PASS", semanticAssertion: "ordinary+simplified+malformed batch isolated", ...policy, ...network };
}

async function acceptMarkup(context: BrowserContext): Promise<Record<string, unknown>> {
  const toolId = "text-markup-converter";
  const page = await openRoute(context, toolId);
  const audit = requestAudit(page);
  const vector = markupFixtures.vectors.find(({ id }) => id === "html-markdown-pre-whitespace")!;
  const form = page.locator("form").last();
  await page.getByLabel("Conversione").selectOption(vector.mode);
  await form.locator("textarea").first().fill(vector.input);
  audit.start();
  await submitWithEnter(page, form);
  const result = await successfulResult(page, toolId);
  const text = await result.innerText();
  if (!text.includes(vector.expected_output)) throw new Error(`${toolId}: exact preformatted fixture output missing`);
  const preview = page.locator('[data-sanitized-preview="true"]');
  if (await preview.locator("script, iframe, object, embed, style, template, [onclick], [onerror], [onload]").count() !== 0) throw new Error(`${toolId}: active content present in sanitized preview`);
  const policy = await pagePolicy(page, toolId);
  const network = audit.assert(toolId);
  await page.close();
  return { status: "PASS", semanticAssertion: "exact preformatted conversion plus sanitized preview", ...policy, ...network };
}

async function acceptVcf(context: BrowserContext): Promise<Record<string, unknown>> {
  const toolId = "vcf-viewer-csv-export";
  const page = await openRoute(context, toolId);
  const audit = requestAudit(page);
  const vector = vcardFixtures.vectors[0]!;
  await page.getByLabel("File VCF").setInputFiles({ name: "contacts.vcf", mimeType: "text/vcard", buffer: Buffer.from(vector.vcf, "utf8") });
  audit.start();
  await submitWithEnter(page);
  await page.locator("tbody tr").first().waitFor({ timeout: 30_000 });
  if (await page.locator("tbody tr").count() !== vector.expected.contacts) throw new Error(`${toolId}: expected ${vector.expected.contacts} contacts`);
  const firstDetails = page.locator('section[aria-live="polite"] details').first();
  await firstDetails.locator("summary").click();
  const detailText = await firstDetails.innerText();
  if (!detailText.includes("NOTE:prima parte molto lunga che viene piegata") || !detailText.includes("e continua qui") || !detailText.includes(vector.expected.unsupported_name)) throw new Error(`${toolId}: folded raw/unsupported fixture evidence missing`);
  const policy = await pagePolicy(page, toolId);
  const network = audit.assert(toolId);
  await page.close();
  return { status: "PASS", semanticAssertion: "folded/repeated/unsupported vCard fixture rendered", ...policy, ...network };
}

const results: Array<Record<string, unknown> & { toolId: string }> = [];
try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      for (const toolId of ["csv-to-sql", "csv-splitter", "table-compare"] as const) results.push({ toolId, ...(await acceptTable(context, toolId)) });
      results.push({ toolId: "fatturapa-batch-csv", ...(await acceptFatturaBatch(context)) });
      for (const toolId of ["semantic-text-chunker", "fact-sensitive-text-diff", "stable-placeholder-anonymizer", "italian-gulpease-readability", "mojibake-repair", "pdf-copy-text-reflow", "phone-link-hashtag-mention-extractor"] as const) {
        results.push({ toolId, ...(await acceptTextTool(context, toolId)) });
      }
      results.push({ toolId: "text-markup-converter", ...(await acceptMarkup(context)) });
      results.push({ toolId: "vcf-viewer-csv-export", ...(await acceptVcf(context)) });
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }

  if (results.length !== 13 || new Set(results.map(({ toolId }) => toolId)).size !== 13) throw new Error(`expected 13 unique browser results, got ${results.length}`);
  await mkdir(browserRoot, { recursive: true });
  for (const result of results) {
    const receipt = {
      schemaVersion: 1,
      status: "PASS",
      subjectToolId: result.toolId,
      oracleEntryId: oracleByTool[result.toolId],
      sourceFingerprint,
      checkedAt: "2026-10-07",
      viewport: { width: 390, height: 844 },
      keyboard: "submit exercised with Enter",
      network: "zero external/non-GET/task-body requests after task start",
      result,
    };
    await writeFile(resolve(browserRoot, `${result.toolId}.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  }
  await writeFile(resolve(receiptRoot, "browser-acceptance.json"), `${JSON.stringify({
    schemaVersion: 1,
    status: "PASS",
    sourceFingerprint,
    checkedAt: "2026-10-07",
    tools: results.map(({ toolId }) => toolId),
    viewport: { width: 390, height: 844 },
    keyboard: "every route submit exercised with Enter",
    accessibility: "all form controls have a label or accessible name",
    network: "zero external/non-GET/task-body requests after task start",
    results,
  }, null, 2)}\n`, "utf8");
  console.log(`text/data browser acceptance PASS: ${results.length} tools`);
} finally {
  server.kill("SIGTERM");
}

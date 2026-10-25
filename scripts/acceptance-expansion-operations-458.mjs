/** Positive/refusal probes on one compiled route per new engine (issue #458).
 * Uses a page target in the existing dedicated Studio automation Chrome.
 * Reports failed or missing evidence explicitly; no Gold/physical receipt.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(import.meta.dirname, "..");
const port = 18458;
const origin = `http://127.0.0.1:${port}`;
const endpoint = process.env.STRUMENTINI_ACCEPTANCE_CDP ?? "http://127.0.0.1:17630";
const tests = [
  { engine: "barcode-linear-v1", id: "barcode-generator",
    valid: { fill: [["input[type=text]", 0, "978047138429"]], button: "Genera barcode" },
    invalid: { fill: [["input[type=text]", 0, "97804713BAD"]], button: "Genera barcode" } },
  { engine: "browser-audio", id: "audio-generator",
    valid: { button: "Avvia", expect: /Tono 440 Hz attivo/u, after: "Ferma" },
    invalid: { fill: [["input[type=number]", 0, "0"]], button: "Avvia", expect: /Impostazione non valida/iu } },
  { engine: "browser-diagnostics", id: "connection-device-info",
    valid: { button: "Aggiorna dati locali" },
    invalid: { button: "Trova IP pubblico (rete)", allowBlockedOrigin: "https://api64.ipify.org",
      expect: /impossibile|non disponibile|errore|richiesta|connessione/iu } },
  { engine: "business-math", id: "basic-unit-converter",
    valid: { button: "Calcola", expect: /0[,.]0015|0[,.]001/iu },
    invalid: { fill: [["input[type=text]", 0, "errato"]], button: "Calcola" } },
  { engine: "date-time", id: "italian-document-expiry",
    valid: { button: "Calcola scadenza" },
    invalid: { fill: [["input[type=date]", 1, "1900-01-01"]], button: "Calcola scadenza" } },
  { engine: "design-css", id: "css-design-helper",
    valid: { button: "Genera CSS", expect: /linear-gradient/iu },
    invalid: { fill: [["input[type=number]", 0, "361"]], button: "Genera CSS" } },
  { engine: "developer-web", id: "base-converter",
    valid: { button: "Converti base", expect: /255/iu },
    invalid: { fill: [["input[type=text]", 0, "G"]], button: "Converti base" } },
  { engine: "file-privacy", id: "file-size-analyzer",
    valid: { file: "quality/fixtures/image-metadata/synthetic-1x1-rgb.png", button: "Esegui in locale" },
    invalid: { button: "Esegui in locale" } },
  { engine: "image", id: "color-blindness-image-simulation",
    valid: { file: "quality/fixtures/image-metadata/workspace-base-4x4.png", button: "Esegui in locale" },
    invalid: { file: "quality/fixtures/pdf-gold/simple-2page.pdf", button: "Esegui in locale" } },
  { engine: "ooxml", id: "ooxml-media-compression",
    valid: { file: "tests/ooxml-media-fixtures/embedded.docx", button: "Comprimi media Office" },
    invalid: { file: "quality/fixtures/image-metadata/synthetic-1x1-rgb.png", button: "Comprimi media Office", disabledRefusal: true } },
  { engine: "pdf", id: "printable-pdf-from-text",
    valid: { fill: [["textarea", 0, "Prova PDF indipendente 458"]], button: "Genera e verifica PDF", export: "pdf" },
    invalid: { button: "Genera e verifica PDF" } },
  { engine: "research-reference", id: "iban-validator",
    valid: { fill: [["input[type=text]", 0, "IT60X0542811101000000123456"]], button: "Verifica IBAN", expect: /Valido/iu },
    invalid: { fill: [["input[type=text]", 0, "IT00X0542811101000000123456"]], button: "Verifica IBAN", expect: /Non valido/iu } },
  { engine: "table-csv", id: "fatturapa-reader",
    valid: { file: "quality/fixtures/italy-2026-consumers/fatturapa-simplified-anonymized.xml", button: "Leggi fattura" },
    invalid: { file: "quality/fixtures/image-metadata/synthetic-1x1-rgb.png", button: "Leggi fattura" } },
  { engine: "table-operations", id: "csv-to-sql",
    valid: { fill: [["textarea", 0, "nome,valore\nuno,2"]], button: "Converti CSV in SQL", expect: /INSERT INTO|CREATE TABLE/iu },
    invalid: { fill: [["textarea", 0, "\"virgolette non chiuse"]], button: "Converti CSV in SQL" } },
  { engine: "text-markup-conversion", id: "text-markup-converter",
    valid: { button: "Calcola", expect: /<h1>|&lt;h1&gt;/iu },
    invalid: { fill: [["select", 0, "html-to-markdown"],
      ["textarea", 0, '<script>alert("UNSAFE_458")</script><p>Testo sicuro</p>']],
      button: "Calcola", unsafeRejected: "UNSAFE_458", expect: /Testo sicuro/iu } },
  { engine: "text-writing", id: "italian-gulpease-readability",
    valid: { fill: [["textarea", 0, "Questa frase italiana è semplice. Questa seconda frase descrive una prova riproducibile."]], button: "Calcola Gulpease" },
    invalid: { button: "Calcola Gulpease" } },
  { engine: "url-marketing", id: "sitemap-xml-generator",
    valid: { button: "Genera sitemap.xml", expect: /<urlset|&lt;urlset/iu },
    invalid: { fill: [["textarea", 0, "javascript:alert(1)"]], button: "Genera sitemap.xml" } },
  { engine: "video", id: "video-inspector",
    valid: { file: "quality/fixtures/video-inspection/video-12fps.mp4", button: "Analizza metadati" },
    invalid: { file: "quality/fixtures/image-metadata/synthetic-1x1-rgb.png", button: "Analizza metadati" } },
];

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"],
  { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
let target, ws, serial = 0;
const pending = new Map();
const blocked = [];
const interceptionFailures = [];

function send(method, params = {}) {
  return new Promise((resolveCall, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("CDP_TIMEOUT_" + method)); }, 12000);
    pending.set(id, { resolveCall, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error("JS_" + JSON.stringify(result.exceptionDetails).slice(0, 400));
  return result.result?.value;
}

async function navigate(id) {
  blocked.length = 0;
  interceptionFailures.length = 0;
  const pathname = `/tools/${id}/`;
  await send("Page.navigate", { url: origin + pathname });
  for (let attempt = 0; attempt < 60; attempt++) {
    const state = await evaluate("({ path: location.pathname, ready: document.readyState, controls: document.querySelectorAll('main button').length })");
    if (state.path === pathname && state.ready === "complete" && state.controls > 0) {
      await sleep(150);
      return;
    }
    await sleep(150);
  }
  throw new Error("COMPILED_TOOL_HYDRATION_TIMEOUT");
}

async function setInput(selector, index, value) {
  const accepted = await evaluate(`(() => {
    const element = document.querySelectorAll('main ' + ${JSON.stringify(selector)})[${index}];
    if (!element) return false;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: ${JSON.stringify(value)}, inputType: 'insertText' }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!accepted) throw new Error(`INPUT_NOT_FOUND_${selector}_${index}`);
}

async function setFile(relativePath) {
  const full = resolve(root, relativePath);
  await readFile(full); // Only existing tracked synthetic fixtures are accepted.
  const dom = await send("DOM.getDocument");
  const input = await send("DOM.querySelector", { nodeId: dom.root.nodeId, selector: "main input[type=file]" });
  if (!input.nodeId) throw new Error("FILE_CONTROL_MISSING");
  await send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [full] });
  await sleep(100);
}

async function snapshot() {
  return evaluate(`(() => {
    const tool = document.querySelector('[data-tool-page]');
    const panel = tool?.querySelector('.result-panel, [data-state=success], [role=status]');
    const alerts = [...(tool?.querySelectorAll('[role=alert]') ?? [])].map(x => x.innerText.trim()).filter(Boolean);
    const downloads = [...(tool?.querySelectorAll('a[download]') ?? [])].map(x => ({ href:x.href, type:x.getAttribute('download') }));
    const values = [...(tool?.querySelectorAll('.result-panel textarea, [data-printable-result] textarea, [data-text-writing-result] textarea') ?? [])]
      .map(x=>x.value).filter(Boolean);
    const statuses = [...(tool?.querySelectorAll('[role=status]') ?? [])].map(x=>x.innerText.trim()).filter(Boolean);
    const outputPreview = tool?.querySelector('[aria-label="Anteprima risultato"] pre, [aria-label="Anteprima del risultato"] pre')?.textContent ?? '';
    return { content: (tool?.innerText ?? '').slice(0, 6000), panel: panel?.innerText.slice(0, 2500) ?? '',
      alerts, statuses, downloads, values, outputPreview };
  })()`);
}

async function operate(caseData) {
  for (const [selector, index, value] of caseData.fill ?? []) await setInput(selector, index, value);
  if (caseData.file) await setFile(caseData.file);
  const before = await snapshot();
  const position = await evaluate(`(() => {
    const button = [...document.querySelectorAll('main button')]
      .find(b => b.innerText.trim() === ${JSON.stringify(caseData.button)});
    if (!button) return null;
    if (button.disabled) return { disabled: true };
    button.scrollIntoView({block:'center'});
    const rect = button.getBoundingClientRect();
    return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
  })()`);
  if (position?.disabled && caseData.disabledRefusal) {
    const refused = await snapshot();
    if (!refused.alerts.length) throw new Error("DISABLED_WITHOUT_REFUSAL");
    return { before, after: refused, outputSha256: hash(refused.content), disabledRefusal: true };
  }
  if (!position || position.disabled) throw new Error("ACTION_UNAVAILABLE_" + caseData.button);
  await send("Input.dispatchMouseEvent", { type:"mousePressed", x:position.x, y:position.y, button:"left", clickCount:1 });
  await send("Input.dispatchMouseEvent", { type:"mouseReleased", x:position.x, y:position.y, button:"left", clickCount:1 });
  let after = before;
  for (let i = 0; i < 100; i++) {
    await sleep(150);
    after = await snapshot();
    const changed = after.content !== before.content || after.alerts.join() !== before.alerts.join()
      || after.statuses.join() !== before.statuses.join() || after.downloads.length !== before.downloads.length;
    if (caseData.export && after.downloads.some((x) => /^blob:|^data:/u.test(x.href))) break;
    if (changed && caseData.expect?.test([after.panel, after.content, ...after.values, ...after.statuses].join("\n"))) break;
    if (changed && !caseData.expect && !caseData.export && (after.alerts.length || i >= 5)) break;
  }
  if (caseData.after) {
    const stop = await evaluate(`(() => { const b=[...document.querySelectorAll('main button')].find(x => x.innerText.trim()===${JSON.stringify(caseData.after)} && !x.disabled); if (!b)return false; b.click(); return true })()`);
    if (!stop) throw new Error("AFTER_ACTION_UNAVAILABLE");
  }
  const unexpected = blocked.filter((request) => request.origin !== caseData.allowBlockedOrigin);
  if (unexpected.length || interceptionFailures.length)
    throw new Error("NONLOCAL_NETWORK_" + JSON.stringify({ blocked, interceptionFailures }));
  if (caseData.allowBlockedOrigin && !blocked.some((request) => request.origin === caseData.allowBlockedOrigin))
    throw new Error("REFERENCE_NETWORK_ACTION_NOT_OBSERVED");
  if (caseData.expect && !caseData.expect.test([after.panel, after.content, ...after.values, ...after.statuses].join("\n")))
    throw new Error("SEMANTIC_OUTPUT_MISSING_" + String(caseData.expect));
  if (caseData.unsafeRejected && (!after.outputPreview.includes("Testo sicuro")
    || after.outputPreview.includes(caseData.unsafeRejected)
    || await evaluate("!!document.querySelector('[data-sanitized-preview] script')")))
    throw new Error("UNSAFE_CONTENT_LEAKED_TO_OUTPUT");
  if (after.content === before.content && after.alerts.join() === before.alerts.join()
    && after.statuses.join() === before.statuses.join() && after.downloads.length === before.downloads.length)
    throw new Error("NO_OBSERVABLE_OPERATION_RESULT");
  return { before, after, outputSha256: hash([after.content, ...after.values].join("\n")) };
}

async function checkExport(result, kind) {
  const exportLink = result.after.downloads.find((x) => /^blob:|^data:/u.test(x.href));
  if (!exportLink) throw new Error("EXPORT_LINK_MISSING");
  const encoded = await evaluate(`(async () => {
    const link = [...document.querySelectorAll('a[download]')].find(x => x.href === ${JSON.stringify(exportLink.href)});
    const bytes = new Uint8Array(await (await fetch(link.href)).arrayBuffer());
    return Array.from(bytes, b=>b.toString(16).padStart(2,'0')).join('');
  })()`);
  const bytes = Buffer.from(encoded, "hex");
  if (kind === "pdf" && bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("EXPORT_NOT_PDF");
  const temporary = await mkdtemp(join(tmpdir(), "strumentini-458-export-"));
  try {
    const filename = join(temporary, "result.pdf");
    await writeFile(filename, bytes);
    const reopened = await readFile(filename);
    if (!reopened.equals(bytes)) throw new Error("EXPORT_READBACK_BYTES_DRIFT");
    const loading = getDocument({ data: Uint8Array.from(reopened),
      disableAutoFetch: true, disableStream: true, useSystemFonts: false,
      standardFontDataUrl: join(root, "node_modules/pdfjs-dist/standard_fonts") + "/" });
    try {
      const document = await loading.promise;
      if (document.numPages < 1) throw new Error("EXPORT_NO_PAGES");
      const page = await document.getPage(1);
      const content = await page.getTextContent();
      const text = content.items.map((item) => "str" in item ? item.str : "").join(" ");
      if (!text.includes("Prova PDF indipendente 458")) throw new Error("EXPORT_TEXT_MISMATCH");
      page.cleanup();
      return { sha256: hash(reopened), bytes: reopened.length, independentlyReopened: true,
        parsedPages: document.numPages, verifiedTextSha256: hash(text) };
    } finally { await loading.destroy().catch(() => undefined); }
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);
const selected = only ? tests.filter(({ engine, id }) => engine === only || id === only) : tests;
if (!selected.length) throw new Error("UNKNOWN_ENGINE");
const results = [];
try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* startup */ }
    await sleep(150);
  }
  const created = await fetch(`${endpoint}/json/new?about:blank`, { method: "PUT", signal: AbortSignal.timeout(8000) });
  if (!created.ok) throw new Error("CDP_NEW_TARGET_FAILED_" + created.status);
  target = await created.json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id !== undefined) {
      const callback = pending.get(message.id);
      if (!callback) return;
      pending.delete(message.id);
      clearTimeout(callback.timer);
      if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
      else callback.resolveCall(message.result ?? {});
    } else if (message.method === "Fetch.requestPaused") {
      const request = message.params.request;
      const url = new URL(request.url);
      const allowed = (url.origin === origin || ["blob:", "data:"].includes(url.protocol))
        && ["GET", "HEAD"].includes(request.method);
      if (!allowed) blocked.push({ origin: url.origin, method: request.method });
      send(allowed ? "Fetch.continueRequest" : "Fetch.failRequest", allowed
        ? { requestId: message.params.requestId }
        : { requestId: message.params.requestId, errorReason: "BlockedByClient" })
        .catch((error) => interceptionFailures.push(String(error)));
    }
  });
  await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error("CDP_TAB_TIMEOUT")), 8000);
    ws.addEventListener("open", () => { clearTimeout(timer); done(); }, { once: true });
    ws.addEventListener("error", (error) => { clearTimeout(timer); fail(error); }, { once: true });
  });
  await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  for (const test of selected) {
    const result = { engine: test.engine, route: test.id, positive: "NOT_RUN", refusal: "NOT_RUN", export: "NOT_RUN" };
    try {
      await navigate(test.id);
      const positive = await operate(test.valid);
      if (positive.after.alerts.length) throw new Error("POSITIVE_ALERT_" + positive.after.alerts.join(" | "));
      result.positive = "PASS";
      result.positiveSha256 = positive.outputSha256;
      result.positiveEvidence = (positive.after.panel || positive.after.statuses.at(-1)
        || positive.after.content.slice(-250)).slice(0, 200);
      if (test.valid.export) result.export = await checkExport(positive, test.valid.export);
    } catch (error) { result.positive = "FAIL"; result.positiveReason = String(error);
      result.positiveDiagnostic = JSON.stringify(await snapshot().catch(() => ({}))).slice(-500); }
    try {
      await navigate(test.id);
      const refusal = await operate(test.invalid);
      if (!refusal.disabledRefusal && !refusal.after.alerts.length
        && !test.invalid.expect?.test([refusal.after.content, ...refusal.after.statuses].join("\n")))
        throw new Error("REFUSAL_NOT_OBSERVED");
      result.refusal = "PASS";
      result.refusalSha256 = refusal.outputSha256;
      result.refusalEvidence = (refusal.after.alerts.join(" | ") || refusal.after.statuses.at(-1)
        || refusal.after.panel).slice(0, 180);
    } catch (error) { result.refusal = "FAIL"; result.refusalReason = String(error);
      result.refusalDiagnostic = JSON.stringify(await snapshot().catch(() => ({}))).slice(-500); }
    results.push(result);
    console.log(JSON.stringify(result));
  }
  const passedPositive = results.filter((x) => x.positive === "PASS").length;
  const passedRefusal = results.filter((x) => x.refusal === "PASS").length;
  console.log(JSON.stringify({ families: selected.length, passedPositive, passedRefusal,
    passedExports: results.filter((x) => typeof x.export === "object").length, physical: "NOT_RUN", release: "NO_GO" }));
  if (passedPositive !== selected.length || passedRefusal !== selected.length) process.exitCode = 1;
} finally {
  ws?.close();
  if (target) await fetch(`${endpoint}/json/close/${target.id}`, { signal: AbortSignal.timeout(8000) }).catch(() => undefined);
  server.kill("SIGTERM");
}

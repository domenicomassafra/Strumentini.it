/** STR-369: compiled-site editing in the existing automation Chrome via CDP.
 * Requires a built dist/ and the dedicated automation-browser-visible on :17630.
 * Uses its existing browser context and closes only the tab it creates.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { editorHydrated, invalidPdfRejected } from "./pdf-engine-369-browser-state.mjs";

const root = resolve(import.meta.dirname, "..");
const port = 18469;
const origin = `http://127.0.0.1:${port}`;
const source = await readFile(join(root, "quality/fixtures/pdf-gold/simple-2page.pdf"));
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"],
  { cwd: root, stdio: "ignore" });
let tab;
let temporary;
const errors = [];
const externalRequests = [];
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function openAutomationTab(url) {
  // A direct CDP target leaves the existing Chrome and its other tabs alone.
  // Playwright's Browser.getBrowserContexts handshake can stall on a busy shared
  // automation browser even though its direct CDP target responds normally.
  const endpoint = process.env.PDF369_CDP_URL ?? "http://127.0.0.1:17630";
  const response = await fetch(endpoint + "/json/new?" + encodeURIComponent(url), { method: "PUT" });
  assert.equal(response.status, 200, "dedicated automation browser new tab");
  const target = await response.json();
  const websocket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let serial = 0;
  websocket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id !== undefined) {
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      clearTimeout(item.timer);
      if (message.error) item.reject(Error(JSON.stringify(message.error)));
      else item.resolve(message.result ?? {});
    } else if (message.method === "Runtime.exceptionThrown") {
      errors.push(JSON.stringify(message.params?.exceptionDetails ?? {}).slice(0, 200));
    } else if (message.method === "Network.requestWillBeSent") {
      const request = message.params?.request;
      if (request && !request.url.startsWith(origin) && !request.url.startsWith("blob:")
        && !request.url.startsWith("data:")) {
        externalRequests.push(request.method + " " + request.url);
      }
    }
  });
  const send = (method, params = {}) => {
    const id = ++serial;
    return new Promise((resolveCall, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error("CDP timeout " + method));
      }, 20_000);
      pending.set(id, { resolve: resolveCall, reject, timer });
      websocket.send(JSON.stringify({ id, method, params }));
    });
  };
  const open = new Promise((resolveOpen, reject) => {
    websocket.addEventListener("open", resolveOpen, { once: true });
    websocket.addEventListener("error", reject, { once: true });
  });
  await open;
  return {
    send,
    async evaluate(expression) {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw Error("browser evaluate: " + JSON.stringify(result.exceptionDetails).slice(0, 350));
      return result.result?.value;
    },
    async close() {
      websocket.close();
      await fetch(endpoint + "/json/close/" + target.id).catch(() => undefined);
    },
  };
}
async function waitFor(expression, label) {
  for (let attempts = 0; attempts < 80; attempts++) {
    if (await tab.evaluate(expression)) return;
    await sleep(250);
  }
  throw Error("Chrome timeout waiting for " + label);
}
async function setFile(path) {
  const document = await tab.send("DOM.getDocument");
  const input = await tab.send("DOM.querySelector", {
    nodeId: document.root.nodeId, selector: '[data-pdf-watermark] input[type="file"]',
  });
  assert(input.nodeId, "compiled editor file control");
  await tab.send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [path] });
}
async function fillLabel(label, value) {
  const outcome = await tab.evaluate(`(() => {
    const label = [...document.querySelectorAll("[data-pdf-watermark] label")]
      .find((item) => item.querySelector("span")?.textContent.trim() === ${JSON.stringify(label)});
    const input = label?.querySelector("input");
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  assert(outcome, "label input exists: " + label);
}
async function independentRead(bytes) {
  const loading = getDocument({
    data: Uint8Array.from(bytes), disableAutoFetch: true, disableStream: true, useSystemFonts: false,
    standardFontDataUrl: join(root, "node_modules/pdfjs-dist/standard_fonts") + "/",
  });
  try {
    const document = await loading.promise;
    const pages = [];
    for (let i = 1; i <= document.numPages; i++) {
      const p = await document.getPage(i);
      const words = await p.getTextContent();
      const operations = await p.getOperatorList();
      pages.push({
        text: words.items.map((w) => "str" in w ? w.str : "").join(" ").trim(),
        operators: operations.fnArray.length,
      });
      p.cleanup();
    }
    return pages;
  } finally {
    await loading.destroy().catch(() => undefined);
  }
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const res = await fetch(origin + "/tools/pdf-watermark/");
      if (res.ok) { ready = true; break; }
    } catch { /* static server starting */ }
    await sleep(200);
  }
  assert(ready, "compiled static site did not start");
  tab = await openAutomationTab(origin + "/tools/pdf-watermark/");
  await tab.send("Page.enable");
  await tab.send("Runtime.enable");
  await tab.send("Network.enable");
  await tab.send("DOM.enable");
  await tab.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await waitFor(editorHydrated, "editor hydration");
  // DOM.setFileInputFiles already dispatches the native change event.
  // Count real events to catch a duplicate synthetic dispatch in the harness.
  await tab.evaluate(`(() => {
    window.__pdf369FileChanges = 0;
    document.querySelector('[data-pdf-watermark] input[type=file]')
      .addEventListener('change', () => { window.__pdf369FileChanges++; }, { capture: true });
  })()`);
  assert(await tab.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"),
    "PDF editor route must fit 390px");
  temporary = await mkdtemp(join(tmpdir(), "pdf-369-browser-"));
  const invalid = join(temporary, "invalid.pdf");
  await writeFile(invalid, Buffer.from("%PDF-1.7\ninvalid\n%%EOF\n"));
  await setFile(invalid);
  await waitFor(invalidPdfRejected, "invalid PDF rejection");
  assert.equal(await tab.evaluate('window.__pdf369FileChanges'), 1,
    "invalid PDF must trigger exactly one native file-change event");
  assert.equal(await tab.evaluate(
    '[...document.querySelectorAll("a")].filter((a)=>a.textContent.includes("Scarica PDF con filigrana")).length'), 0,
    "invalid input must not generate a PDF");

  await setFile(join(root, "quality/fixtures/pdf-gold/simple-2page.pdf"));
  await waitFor('Boolean(document.querySelector("[data-watermark-plan]"))', "editor plan");
  assert.equal(await tab.evaluate('window.__pdf369FileChanges'), 2,
    "valid PDF must trigger exactly one additional native file-change event");
  await fillLabel("Pagine", "1");
  await fillLabel("Testo filigrana", "STR369_WEB");
  await fillLabel("Rotazione (gradi)", "0");
  assert(await tab.evaluate(`(() => {
    const button = [...document.querySelectorAll("button")]
      .find((item) => item.textContent.trim() === "Applica filigrana");
    if (!button || button.disabled) return false;
    button.click(); return true;
  })()`), "apply watermark button enabled");
  await waitFor('Boolean(document.querySelector(\'.result-panel[data-state="success"]\'))', "edited PDF result");
  const encoded = await tab.evaluate(`(async () => {
    const link = [...document.querySelectorAll("a")].find((a) => a.textContent.includes("Scarica PDF con filigrana"));
    if (!link) throw Error("PDF download link missing");
    const bytes = new Uint8Array(await (await fetch(link.href)).arrayBuffer());
    return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
  })()`);
  const downloaded = Buffer.from(encoded, "base64");
  assert.equal(downloaded.subarray(0, 5).toString("ascii"), "%PDF-");
  const [original, edited] = await Promise.all([independentRead(source), independentRead(downloaded)]);
  assert.equal(edited.length, 2);
  assert.match(edited[0].text, /alpha.*STR369_WEB/u);
  assert.equal(edited[1].text, original[1].text, "second page text unchanged");
  assert(edited[0].operators > original[0].operators, "visible operator list must gain drawing instructions");
  assert.equal(edited[1].operators, original[1].operators, "second page draw operators unchanged");
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, [], "PDF editing must be local");
  console.log("PDF369_COMPILED_BROWSER_PASS", JSON.stringify({
    route: "/tools/pdf-watermark/", browser: "existing automation Chrome CDP",
    inputBytes: source.length, outputBytes: downloaded.length, pages: edited.length,
    page1: edited[0].text, page2: edited[1].text,
    visibleOperationsBefore: original[0].operators, visibleOperationsAfter: edited[0].operators,
    offsiteRequests: externalRequests.length, physicalMobile: "NOT_RUN",
  }));
} finally {
  await tab?.close().catch(() => undefined);
  if (temporary) await rm(temporary, { recursive: true, force: true });
  server.kill("SIGTERM");
}

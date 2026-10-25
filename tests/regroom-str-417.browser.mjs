/** STR-417: compiled AES-256 PDF round-trip using the existing Studio Chrome CDP.
 * The direct target protocol is also used by STR-369: Playwright's browser-context
 * handshake can stall on an otherwise responsive shared automation browser.
 * Opens and closes only its own tab; never launches or stops Chrome.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(import.meta.dirname, "..");
const port = 18417;
const base = `http://127.0.0.1:${port}`;
const route = "/tools/pdf-password-check-remove/";
const password = "legit-STR417-browser";
const original = fileURLToPath(new URL("../quality/fixtures/pdf-gold/simple-2page.pdf", import.meta.url));
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const offsite = [], exceptions = [];
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let tab, temporary;

async function openAutomationTab() {
  const endpoint = process.env.PDF417_CDP_URL ?? "http://127.0.0.1:17630";
  const response = await fetch(endpoint + "/json/new?about:blank", { method: "PUT" });
  assert.equal(response.status, 200, "existing Studio automation Chrome must create a tab");
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
      exceptions.push(JSON.stringify(message.params?.exceptionDetails ?? {}).slice(0, 250));
    } else if (message.method === "Network.requestWillBeSent") {
      const request = message.params?.request;
      if (request && !request.url.startsWith(base) && !request.url.startsWith("blob:")
        && !request.url.startsWith("data:")) offsite.push(request.method + " " + request.url);
    }
  });
  const opened = new Promise((resolveOpen, reject) => {
    websocket.addEventListener("open", resolveOpen, { once: true });
    websocket.addEventListener("error", reject, { once: true });
  });
  await opened;
  const send = (method, params = {}) => {
    const id = ++serial;
    return new Promise((resolveCall, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error("CDP timeout " + method));
      }, 30_000);
      pending.set(id, { resolve: resolveCall, reject, timer });
      websocket.send(JSON.stringify({ id, method, params }));
    });
  };
  return {
    send,
    async evaluate(expression) {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw Error("browser evaluate failed: " + JSON.stringify(result.exceptionDetails).slice(0, 350));
      return result.result?.value;
    },
    async close() {
      websocket.close();
      await fetch(endpoint + "/json/close/" + target.id).catch(() => undefined);
    },
  };
}

async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await tab.evaluate(expression)) return;
    await sleep(250);
  }
  throw Error("Studio Chrome timeout waiting for " + label);
}

async function setInput(path) {
  const document = await tab.send("DOM.getDocument");
  const input = await tab.send("DOM.querySelector", {
    nodeId: document.root.nodeId, selector: 'input[type="file"]',
  });
  assert(input.nodeId, "PDF file input exists");
  // DOM.setFileInputFiles dispatches the native change event itself.
  await tab.send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [path] });
}

async function setMode(mode) {
  assert(await tab.evaluate(`(() => {
    const select = [...document.querySelectorAll("select")]
      .find((item) => [...item.options].some((option) => option.value === "protect"));
    if (!select) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(select, ${JSON.stringify(mode)});
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`), "PDF mode selector exists");
  await waitFor(`document.querySelector('input[type="password"]') !== null && [...document.querySelectorAll("select")].some(s => s.value === ${JSON.stringify(mode)})`, "mode and password field");
}

async function fillPassword(value) {
  assert(await tab.evaluate(`(() => {
    const input = document.querySelector('input[type="password"]');
    if (!input || input.disabled) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`), "password input is enabled");
}

async function clickButton(label) {
  await waitFor(`[...document.querySelectorAll("button")].some(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled)`, "button " + label);
  assert(await tab.evaluate(`(() => {
    const button = [...document.querySelectorAll("button")]
      .find((item) => item.textContent.trim() === ${JSON.stringify(label)} && !item.disabled);
    if (!button) return false;
    button.click();
    return true;
  })()`), "PDF action triggered");
}

async function download(name) {
  await waitFor(`[...document.querySelectorAll('[data-result-class="pdf"] a')].some(a => a.textContent.includes(${JSON.stringify("Scarica " + name)}))`, "PDF download " + name);
  const encoded = await tab.evaluate(`(async () => {
    const link = [...document.querySelectorAll('[data-result-class="pdf"] a')]
      .find(a => a.textContent.includes(${JSON.stringify("Scarica " + name)}));
    const bytes = new Uint8Array(await (await fetch(link.href)).arrayBuffer());
    return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
  })()`);
  return Buffer.from(encoded, "base64");
}

async function readWithIndependentParser(bytes, credential) {
  const task = getDocument({ data: Uint8Array.from(bytes), ...(credential ? { password: credential } : {}), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent();
      pages.push(content.items.flatMap((item) => "str" in item ? [item.str] : []).join(" "));
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

try {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw Error("Compiled server exited");
    try { const response = await fetch(base + route); if (response.ok) break; }
    catch { /* Waiting for static server. */ }
    if (attempt === 39) throw Error("Compiled server did not start");
    await sleep(150);
  }
  tab = await openAutomationTab();
  await tab.send("Page.enable");
  await tab.send("Runtime.enable");
  await tab.send("Network.enable");
  await tab.send("DOM.enable");
  await tab.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await tab.send("Page.navigate", { url: base + route });
  await waitFor(`[...document.querySelectorAll("astro-island")].some(island =>
    island.getAttribute("component-url")?.includes("PdfPasswordCheckRemoveTool") && !island.hasAttribute("ssr"))`, "tool hydration");
  assert(await tab.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), "no horizontal overflow at 390px");
  await setInput(original);
  await setMode("protect");
  await fillPassword(password);
  await clickButton("Proteggi con AES-256");
  const encrypted = await download("protetto-aes256.pdf");
  const lockedSource = encrypted.toString("latin1");
  assert.match(lockedSource, /\/Encrypt\s/u);
  assert.match(lockedSource, /\/R\s+6\b/u, "encrypted download uses revision R6");
  assert.match(lockedSource, /\/V\s+5\b/u, "encrypted download uses AES-256");
  await assert.rejects(readWithIndependentParser(encrypted));
  await assert.rejects(readWithIndependentParser(encrypted, "sbagliata"));
  const lockedPages = await readWithIndependentParser(encrypted, password);
  assert.equal(lockedPages.length, 2);
  assert.match(lockedPages.join(" "), /alpha[\s\S]*beta/u);

  temporary = await mkdtemp(join(tmpdir(), "pdf-417-browser-"));
  const encryptedFile = join(temporary, "locked.pdf");
  await writeFile(encryptedFile, encrypted);
  await setInput(encryptedFile);
  await setMode("remove");
  await fillPassword("sbagliata");
  await clickButton("Sblocca o copia PDF");
  await waitFor('document.body.textContent.includes("Password PDF non corretta")', "incorrect password rejection");
  assert.equal(await tab.evaluate("document.querySelectorAll('[data-result-class=\"pdf\"]').length"), 0,
    "wrong password never produces output");
  await fillPassword(password);
  await clickButton("Sblocca o copia PDF");
  const decrypted = await download("sbloccato.pdf");
  assert.doesNotMatch(decrypted.toString("latin1"), /\/Encrypt\s/u);
  const unlockedPages = await readWithIndependentParser(decrypted);
  assert.equal(unlockedPages.length, 2);
  assert.match(unlockedPages.join(" "), /alpha[\s\S]*beta/u);
  assert.deepEqual(exceptions, []);
  assert.deepEqual(offsite, []);
  console.log("STR417_COMPILED_BROWSER_PASS", JSON.stringify({
    inputBytes: (await readFile(original)).length, encryptedBytes: encrypted.length,
    decryptedBytes: decrypted.length, pages: 2, cipher: "AES-256 R6",
    encryptedSha256: createHash("sha256").update(encrypted).digest("hex"),
    decryptedSha256: createHash("sha256").update(decrypted).digest("hex"),
    independentParser: "PDF.js", incorrectPassword: "REJECTED", offsiteRequests: offsite.length,
    browser: "existing Studio automation Chrome direct CDP 17630", physicalMobile: "NOT_RUN",
  }));
} finally {
  await tab?.close().catch(() => undefined);
  if (temporary) await rm(temporary, { recursive: true, force: true });
  server.kill("SIGTERM");
}

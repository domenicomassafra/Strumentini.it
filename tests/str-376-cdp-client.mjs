/** STR-376 browser consumer: isolated CDP tab in the existing MiniPC Chrome.
 * Reuses the direct-target pattern from scripts/acceptance-pdf-engine-369.browser.mjs.
 * Playwright 1.63 connectOverCDP can hang on unrelated sleeping tabs (#42882).
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function connect(url, emit = () => {}) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let serial = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id !== undefined) {
      const entry = pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(message.id);
      if (message.error) entry.reject(Error(JSON.stringify(message.error)));
      else entry.resolve(message.result ?? {});
    } else emit(message);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++serial;
        const timer = setTimeout(() => { pending.delete(id); reject(Error("CDP timeout " + method)); }, 20000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

export async function openPdf136Cdp({ base, directory, policy, errors, externalRequests }) {
  const endpoint = "http://127.0.0.1:17629";
  let root, tab, contextId;
  const listeners = new Set();
  let cspCount = 0;
  const discovery = await (await fetch(endpoint + "/json/version")).json();
  const evaluate = async (expression) => {
    const value = await tab.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (value.exceptionDetails) throw Error("Browser evaluation: " + JSON.stringify(value.exceptionDetails).slice(0, 350));
    return value.result?.value;
  };
  const waitFor = async (expression, label, timeout = 20000) => {
    for (let i = 0; i < timeout / 250; i++) {
      if (await evaluate(expression)) return;
      await pause(250);
    }
    throw Error("Browser timeout waiting for " + label);
  };
  const click = async (selector) => {
    const ok = await evaluate('(() => { const element=document.querySelector(' + JSON.stringify(selector)
      + '); if (!element || element.disabled) return false; element.click(); return true; })()');
    assert(ok, "Missing actionable UI: " + selector);
  };
  try {
    root = await connect(discovery.webSocketDebuggerUrl, (event) => {
      for (const listener of listeners) listener(event);
    });
    ({ browserContextId: contextId } = await root.send("Target.createBrowserContext"));
    const created = await root.send("Target.createTarget", {
      url: "about:blank", browserContextId: contextId, background: true,
    });
    const targets = await (await fetch(endpoint + "/json/list")).json();
    const target = targets.find((entry) => entry.id === created.targetId);
    assert(target?.webSocketDebuggerUrl, "Temporary CDP target missing");
    tab = await connect(target.webSocketDebuggerUrl, (event) => {
      if (event.method === "Runtime.exceptionThrown")
        errors.push(JSON.stringify(event.params?.exceptionDetails ?? {}).slice(0, 200));
      if (event.method === "Network.requestWillBeSent") {
        const url = event.params?.request?.url;
        if (url && !url.startsWith(base) && !url.startsWith("blob:") && !url.startsWith("data:"))
          externalRequests.push(url);
      }
      if (event.method === "Fetch.requestPaused") {
        const request = event.params;
        if (request.responseStatusCode) {
          cspCount++;
          const headers = (request.responseHeaders ?? []).filter(
            (header) => header.name.toLowerCase() !== "content-security-policy");
          headers.push({ name: "Content-Security-Policy", value: policy });
          void tab.send("Fetch.continueResponse", {
            requestId: request.requestId, responseCode: request.responseStatusCode,
            responseHeaders: headers,
          }).catch((cause) => errors.push("CSP response: " + cause.message));
        } else {
          void tab.send("Fetch.continueRequest", { requestId: request.requestId })
            .catch((cause) => errors.push("CSP request: " + cause.message));
        }
      }
    });
    for (const method of ["Page.enable", "Runtime.enable", "Network.enable", "DOM.enable"])
      await tab.send(method);
    await tab.send("Emulation.setDeviceMetricsOverride", {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: false,
    });
    await root.send("Browser.setDownloadBehavior", {
      browserContextId: contextId, behavior: "allow", downloadPath: directory, eventsEnabled: true,
    });
    await tab.send("Fetch.enable", { patterns: [{
      urlPattern: base + "/tools/pdf-form-inspector/*", requestStage: "Response",
    }] });
    await tab.send("Page.navigate", { url: base + "/tools/pdf-form-inspector/" });
    await waitFor('document.readyState==="complete" && !!document.querySelector("[data-pdf-form-editor-136] input[type=file]")',
      "compiled editor hydration");
    assert(cspCount > 0, "CSP interception did not happen");
    assert.equal(await evaluate('(async()=>{const r=await fetch("/tools/pdf-form-inspector/");return r.headers.get("content-security-policy")})()'), policy);
    return {
      evaluate, waitFor, click, get cspCount() { return cspCount; },
      async upload(bytes, name) {
        const path = join(directory, name);
        await writeFile(path, bytes);
        const document = await tab.send("DOM.getDocument");
        const element = await tab.send("DOM.querySelector", {
          nodeId: document.root.nodeId, selector: '[data-pdf-form-editor-136] input[type=file]',
        });
        assert(element.nodeId, "PDF upload field missing");
        await tab.send("DOM.setFileInputFiles", { nodeId: element.nodeId, files: [path] });
      },
      async select(selector, value, type = "input") {
        const applied = await evaluate('(() => { const el=document.querySelector(' + JSON.stringify(selector)
          + '); if (!el) return false; const proto=el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;'
          + ' Object.getOwnPropertyDescriptor(proto,"value").set.call(el,' + JSON.stringify(value) + ');'
          + ' el.dispatchEvent(new Event(' + JSON.stringify(type) + ',{bubbles:true})); return true; })()');
        assert(applied, "PDF form control missing: " + selector);
      },
      async offline(value) {
        await tab.send("Network.emulateNetworkConditions", {
          offline: value, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
        });
      },
      async download() {
        let guid, name, handler;
        const done = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(Error("PDF download timeout")), 30000);
          handler = (event) => {
            if (event.method === "Browser.downloadWillBegin" && event.params?.url?.startsWith("blob:" + base)) {
              guid = event.params.guid;
              name = event.params.suggestedFilename;
            }
            if (event.method === "Browser.downloadProgress" && event.params?.guid === guid) {
              if (event.params.state === "completed") { clearTimeout(timer); resolve(); }
              if (event.params.state === "canceled") { clearTimeout(timer); reject(Error("Download canceled")); }
            }
          };
          listeners.add(handler);
        });
        try {
          await click('[data-form-result-136] a[download]');
          await done;
          let path = join(directory, guid);
          try { return { path, bytes: await readFile(path) }; }
          catch { path = join(directory, name); return { path, bytes: await readFile(path) }; }
        } finally { listeners.delete(handler); }
      },
      async close() {
        tab?.close();
        if (root && contextId) await root.send("Target.disposeBrowserContext", { browserContextId: contextId }).catch(() => {});
        root?.close();
      },
    };
  } catch (error) {
    tab?.close();
    if (root && contextId) await root.send("Target.disposeBrowserContext", { browserContextId: contextId }).catch(() => {});
    root?.close();
    throw error;
  }
}

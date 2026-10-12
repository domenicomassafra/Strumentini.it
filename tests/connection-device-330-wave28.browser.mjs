/** #330 wave28: real Chrome clipboard and strictly intercepted user-initiated IP action. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.CONNECTION330_PORT ?? 18578);
const origin = process.env.CONNECTION330_ORIGIN ?? `http://127.0.0.1:${port}`;
const endpoint = "https://api64.ipify.org?format=json";
const toolId = "connection-device-info";
const server = process.env.CONNECTION330_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" });
const pause = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

async function idb(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" && !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return [];
    return new Promise((resolveValue, reject) => {
      const opened = indexedDB.open("utility-workbench", 1);
      opened.onerror = () => reject(opened.error);
      opened.onsuccess = () => {
        const db = opened.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolveValue([]); return; }
        const tx = db.transaction("state", "readonly");
        const get = tx.objectStore("state").get("workbench/state:v1");
        get.onerror = () => reject(get.error);
        get.onsuccess = () => resolveValue(get.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}

async function count(page, expected, forbidden = []) {
  const deadline = Date.now() + 8000;
  let rows;
  do {
    rows = await idb(page);
    const match = rows.filter((entry) => entry.toolId === toolId);
    if ((expected === 0 && match.length === 0) || (match.length === 1 && match[0].useCount === expected)) {
      if (expected > 0) {
        assert.deepEqual(Object.keys(match[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
        assert(Number.isFinite(Date.parse(match[0].lastUsedAt)));
      }
      const text = JSON.stringify(rows);
      for (const secret of forbidden) assert(!text.includes(secret), `Recenti contains browser/clipboard/IP content: ${secret.slice(0, 24)}`);
      return;
    }
    await pause(95);
  } while (Date.now() < deadline);
  assert.fail(`expected ${toolId} useCount=${expected}, observed ${JSON.stringify(rows)}`);
}

async function awaitCalls(records, expected) {
  const deadline = Date.now() + 4000;
  while (records.length < expected && Date.now() < deadline) await pause(35);
  assert.equal(records.length, expected, `unexpected public IP GET count: expected ${expected}, got ${records.length}`);
}

function captureNetwork(page, records, unexpected, failures) {
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") unexpected.push(`${request.method()} ${request.url()}`);
    if (request.postData() !== null) unexpected.push(`request body to ${request.url()}`);
  });
  return page.route("**/*", (route) => {
    const request = route.request();
    const url = request.url();
    if (new URL(url).origin === new URL(endpoint).origin
      && new URL(url).pathname === "/"
      && new URL(url).search === "?format=json") {
      const headers = request.headers();
      assert.equal(request.method(), "GET", "public IP must require GET only");
      assert.equal(headers.referer, undefined, "no referrer may leave the page");
      assert.equal(headers.cookie, undefined, "no cookies sent to public-IP provider");
      assert.equal(headers.authorization, undefined, "no credentials sent to public-IP provider");
      records.push(route); // Deliberately hold: the actual external network is NEVER contacted.
      return;
    }
    if (url.startsWith(origin + "/") || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
    unexpected.push(`blocked offsite ${url}`);
    return route.abort();
  });
}

async function respond(route, body, status = 200) {
  await route.fulfill({ status, headers: {
    "access-control-allow-origin": "*", "content-type": "application/json", "cache-control": "no-store",
  }, body: typeof body === "string" ? body : JSON.stringify(body) });
}

let browser;
try {
  let started = false;
  for (let i = 0; i < 120; i++) {
    try { started = (await fetch(`${origin}/tools/${toolId}/`)).ok; if (started) break; } catch { /* local dev startup */ }
    await pause(100);
  }
  assert(started, "real public connection/device route unavailable");
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const page = await context.newPage();
  const records = [], unexpected = [], errors = [];
  await captureNetwork(page, records, unexpected, errors);
  assert.equal((await page.goto(`${origin}/tools/${toolId}/`, { waitUntil: "networkidle" }))?.status(), 200);
  const copyButton = page.getByRole("button", { name: "Copia riepilogo di supporto" });
  const refreshButton = page.getByRole("button", { name: "Aggiorna dati locali" });
  const lookupButton = page.getByRole("button", { name: "Trova IP pubblico (rete)" });
  await copyButton.waitFor();
  await count(page, 0);
  await refreshButton.click();
  await pause(160);
  await count(page, 0);
  assert.equal(records.length, 0, "passive mount/refresh leaked public IP GET");

  // Real browser clipboard API: no stub, no synthetic successful write.
  await copyButton.evaluate((button) => { button.click(); button.click(); });
  await page.getByText(/Riepilogo locale copiato/u).waitFor();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(clipboard, /Informazioni di supporto.*Browser:/su);
  assert.match(clipboard, /User-Agent:/u);
  assert.match(clipboard, /IP pubblico: escluso/u);
  assert(!clipboard.includes("203.0.113.42"), "public IP must not enter support clipboard");
  assert.match(await page.getByText(/Riepilogo locale copiato/u).innerText(), /Riepilogo locale copiato/u);
  const privateFields = await page.evaluate(() => [navigator.userAgent, navigator.language]);
  await count(page, 1, [clipboard, ...privateFields, "203.0.113.42"]);
  assert.equal(records.length, 0, "copy cannot trigger optional IP network call");
  console.log("CONNECTION_W28_COPY_REAL_CHROME clipboard.readText verified actual support summary; IP excluded; double-click count1");

  // An invalid response must be treated as failure, never a completion.
  await lookupButton.click();
  await awaitCalls(records, 1);
  await respond(records[0], { ip: "<script>" });
  await page.getByRole("alert").waitFor();
  await count(page, 1, [clipboard, ...privateFields, "<script>"]);

  // Double same-turn action must trigger exactly one external request. This
  // also catches a disabled={loading} state update arriving a render late.
  await page.getByRole("button", { name: "Trova IP pubblico (rete)" }).evaluate((button) => { button.click(); button.click(); });
  await awaitCalls(records, 2);
  await pause(175);
  assert.equal(records.length, 2, "duplicate rapid clicks initiated multiple public-IP fetches");
  await respond(records[1], { ip: "203.0.113.42" });
  await page.getByText("203.0.113.42", { exact: true }).waitFor();
  await count(page, 2, [clipboard, ...privateFields, "203.0.113.42"]);
  console.log("CONNECTION_W28_PUBLIC_IP_VERIFIED opt-in only GET, referrer/cookie/auth omitted, duplicate=1, 203.0.113.42 parsed, count2");

  // A refresh supersedes the pending lookup and permits an explicit newer
  // lookup. A late old response cannot overwrite the new IP or count.
  await page.getByRole("button", { name: "Trova IP pubblico (rete)" }).click();
  await awaitCalls(records, 3);
  await refreshButton.click();
  await page.getByRole("button", { name: "Trova IP pubblico (rete)" }).click();
  await awaitCalls(records, 4);
  await respond(records[3], { ip: "2001:db8::99" });
  await page.getByText("2001:db8::99", { exact: true }).waitFor();
  try { await respond(records[2], { ip: "203.0.113.77" }); } catch { /* intentional aborted route */ }
  await pause(300);
  assert.equal(await page.getByText("203.0.113.77", { exact: true }).count(), 0, "stale IP superseded newer result");
  await count(page, 3, [clipboard, ...privateFields, "2001:db8::99", "203.0.113.77"]);

  // Failed network (HTTP status) and passive reload have no completion.
  await page.getByRole("button", { name: "Trova IP pubblico (rete)" }).click();
  await awaitCalls(records, 5);
  await respond(records[4], { error: "failure" }, 503);
  await page.getByRole("alert").waitFor();
  await count(page, 3, [clipboard, ...privateFields, "2001:db8::99"]);
  await page.reload({ waitUntil: "networkidle" });
  await count(page, 3, [clipboard, ...privateFields, "2001:db8::99"]);
  assert.equal(records.length, 5, "reloading the page cannot contact public-IP service");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), "mobile viewport overflow");
  assert.deepEqual(unexpected, [], "no provider/network beyond exactly intercepted endpoint, zero POST/upload");
  assert.deepEqual(errors, [], "real-browser JS errors");
  await context.close();

  // Clipboard unavailable: do not falsely report success or append history.
  const clipboardDeniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await clipboardDeniedContext.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });
  const deniedCopy = await clipboardDeniedContext.newPage();
  const deniedCalls = [], deniedUnexpected = [];
  await captureNetwork(deniedCopy, deniedCalls, deniedUnexpected, errors);
  await deniedCopy.goto(`${origin}/tools/${toolId}/`, { waitUntil: "networkidle" });
  await deniedCopy.getByRole("button", { name: "Copia riepilogo di supporto" }).click();
  assert.match(await deniedCopy.getByText(/Gli appunti non sono disponibili/u).innerText(), /non sono disponibili/u);
  await count(deniedCopy, 0);
  assert.equal(deniedCalls.length, 0);
  await clipboardDeniedContext.close();

  // Actual success remains useful when metadata persistence is denied.
  const blockedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await blockedContext.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await blockedContext.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new DOMException("Denied", "SecurityError"); } });
  });
  const blocked = await blockedContext.newPage();
  const blockedCalls = [], blockedUnexpected = [];
  await captureNetwork(blocked, blockedCalls, blockedUnexpected, errors);
  await blocked.goto(`${origin}/tools/${toolId}/`, { waitUntil: "networkidle" });
  await blocked.getByRole("button", { name: "Copia riepilogo di supporto" }).click();
  await blocked.getByText(/Riepilogo locale copiato/u).waitFor();
  assert.match(await blocked.getByText(/Riepilogo locale copiato/u).innerText(), /Riepilogo locale copiato/u);
  assert.match(await blocked.evaluate(() => navigator.clipboard.readText()), /Browser:/u);
  await blocked.getByRole("button", { name: "Trova IP pubblico (rete)" }).click();
  await awaitCalls(blockedCalls, 1);
  await respond(blockedCalls[0], { ip: "198.51.100.19" });
  await blocked.getByText("198.51.100.19", { exact: true }).waitFor();
  assert.deepEqual(blockedUnexpected, [], "storage denied caused unexpected egress");
  assert.deepEqual(deniedUnexpected, [], "clipboard unavailable caused unexpected egress");
  assert.deepEqual(errors, [], "denial behavior produced JS errors");
  await blockedContext.close();
  console.log("CONNECTION_330_WAVE28_PASS Chrome390 live clipboard, explicit intercepted IP, stale/duplicate suppressed, Recenti canonical metadata only, failures/passive zero, denied IDB nonblocking, zero actual provider calls/POST/offsite");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

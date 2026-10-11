/** #340 compiled-static, real user-visible chain on canonical /preferiti/. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = process.env.SESSION340_ORIGIN ? null : await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (typeof address === "string" || !address) return reject(new Error("No local port"));
    server.close(() => resolve(address.port));
  });
});
const origin = process.env.SESSION340_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = port === null ? null : spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  stdio: "ignore", cwd: process.cwd(),
});
let browser;
try {
  for (let attempt = 0; attempt < 75; attempt++) {
    try { if ((await fetch(`${origin}/preferiti/`, { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* startup */ }
    if (server?.exitCode !== null && server) throw new Error("Static preview terminated");
    if (attempt === 74) throw new Error("Static preview unavailable");
    await sleep(170);
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));
  assert.equal((await page.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" }))?.status(), 200);

  const panel = page.locator("[data-session340]");
  await panel.waitFor({ timeout: 10_000 });
  const textarea = panel.getByRole("textbox", { name: "Testo di partenza" });
  assert.match(await panel.innerText(), /solo in questa pagina/i);
  assert.match(await panel.innerText(), /ricaricando/i);
  const existingRequests = requests.length;
  // The surrounding /preferiti route legitimately accesses membership IDB
  // and an account session GET at initial load. Measure ONLY post-hydration
  // interaction with this island, not unrelated bootstrap traffic.
  await page.evaluate(() => {
    window.__session340Touches = { storage: 0, network: 0 };
    const count = (kind) => { window.__session340Touches[kind]++; };
    for (const method of ["getItem", "setItem", "removeItem", "clear", "key"]) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        count("storage");
        return original.apply(this, args);
      };
    }
    const oldOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      count("storage");
      return oldOpen.apply(this, args);
    };
    const oldFetch = window.fetch;
    window.fetch = function (...args) {
      count("network");
      return oldFetch.apply(this, args);
    };
    const oldXhr = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      count("network");
      return oldXhr.apply(this, args);
    };
    const oldBeacon = navigator.sendBeacon?.bind(navigator);
    if (oldBeacon) navigator.sendBeacon = (...args) => {
      count("network");
      return oldBeacon(...args);
    };
  });
  await textarea.fill("  abc    ");
  const steps = panel.locator("[data-session340-stage]");
  assert.equal(await steps.count(), 3);
  const run = async (stage) => {
    const button = steps.nth(stage - 1).getByRole("button", { name: /Esegui/u });
    if (stage === 1) { await button.focus(); await page.keyboard.press("Enter"); }
    else await button.click();
    await steps.nth(stage - 1).locator("[data-session340-sha]").waitFor({ timeout: 10_000 });
  };
  await run(1);
  await run(2);
  await run(3);
  assert.equal(await panel.locator("[data-session340-receipt]").count(), 3);
  const receipts = await panel.locator("[data-session340-sha]").allTextContents();
  assert.equal(receipts[0], `sha256:${createHash("sha256").update("abc").digest("hex")}`);
  assert.equal(receipts[1], `sha256:${createHash("sha256").update("ABC").digest("hex")}`);
  assert.equal(receipts[2], `sha256:${createHash("sha256").update("QUJD").digest("hex")}`);
  assert.equal(await panel.locator("[data-session340-parent]").count(), 2);
  const mobileWidth = await panel.evaluate((element) => ({ content: element.clientWidth, scroll: element.scrollWidth }));
  assert(mobileWidth.scroll <= mobileWidth.content + 1, `390px panel has horizontal overflow: ${JSON.stringify(mobileWidth)}`);
  await steps.nth(0).getByRole("button", { name: /Recupera/u }).click();
  assert.equal(await panel.locator("[data-session340-output]").inputValue(), "abc");
  await steps.nth(1).getByRole("button", { name: /Recupera/u }).click();
  assert.equal(await panel.locator("[data-session340-output]").inputValue(), "ABC");
  await steps.nth(2).getByRole("button", { name: /Recupera/u }).click();
  assert.equal(await panel.locator("[data-session340-output]").inputValue(), "QUJD");
  assert.equal(await panel.locator("[data-session340-output]").evaluate((el) => new TextEncoder().encode(el.value).length), 4);
  assert.equal(requests.length, existingRequests, "chain must not send extra requests to same or external servers");

  await panel.getByRole("button", { name: "Svuota cronologia di questa pagina" }).click();
  assert.equal(await panel.locator("[data-session340-receipt]").count(), 0);
  await textarea.fill("CANCELLA PRIMA");
  await steps.nth(0).getByRole("button", { name: /Esegui/u }).click();
  await steps.nth(0).getByRole("button", { name: /Annulla/u }).click();
  await steps.nth(0).getByText(/annullata/i).waitFor();
  await page.waitForTimeout(450);
  assert.equal(await panel.locator("[data-session340-receipt]").count(), 0, "cancelled task must never commit a late result");
  assert.equal(await steps.nth(1).getByRole("button", { name: /Esegui/u }).isDisabled(), true);

  await textarea.fill("a".repeat(60_000));
  await run(1);
  await run(2);
  await steps.nth(2).getByRole("button", { name: /Esegui/u }).click();
  await steps.nth(2).getByText(/limite|quota|memoria/i).waitFor({ timeout: 10_000 });
  assert.equal(await panel.locator("[data-session340-receipt]").count(), 2, "quota refuse must keep previous good snapshot bytes");
  await steps.nth(1).getByRole("button", { name: /Recupera/u }).click();
  assert.equal((await panel.locator("[data-session340-output]").inputValue()).length, 60_000);
  assert.equal(requests.length, existingRequests, "quota/cancel/recovery must remain network-free");
  assert.deepEqual(await page.evaluate(() => window.__session340Touches), { storage: 0, network: 0 },
    "three operations, cancellation, recovery and quota must never touch Storage or network APIs");

  await page.reload({ waitUntil: "networkidle" });
  await panel.waitFor();
  assert.equal(await panel.locator("[data-session340-receipt]").count(), 0, "reload clears private byte history");
  assert.equal(await panel.locator("[data-session340-output]").inputValue(), "");
  assert.equal(await steps.nth(1).getByRole("button", { name: /Esegui/u }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log("#340 Chromium 390 compiled-static PASS: three actual engines, 3 digest/parent proofs, all byte readbacks, cancel no late success, 64KiB quota fail-closed, cleared on reload, no extra requests");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}

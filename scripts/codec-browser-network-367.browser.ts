/** Explicit native Chromium proof for #367. This must run separately from the
 * normal Vitest CI suite, whose runner intentionally has no Playwright browser
 * installation. The forbidden destination is another local ephemeral port. */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium } from "@playwright/test";
import { enforceLocalNetwork367 } from "./codec-browser-network-367";

let forbiddenReceiverHits = 0;
const allowed = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html" });
  response.end("<!doctype html><title>Codec guard origin</title>");
});
const forbidden = createServer((_request, response) => {
  forbiddenReceiverHits += 1;
  response.writeHead(200);
  response.end("should never be received");
});

async function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

try {
  const origin = await listen(allowed);
  const forbiddenOrigin = await listen(forbidden);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const blocked: string[] = [];
    await enforceLocalNetwork367(context, origin, blocked);
    const page = await context.newPage();
    await page.goto(`${origin}/allowed`);
    const blockedUrl = `${forbiddenOrigin}/popup-first-request`;
    const popupPromise = context.waitForEvent("page");
    await page.evaluate((url) => { window.open(url, "_blank"); }, blockedUrl);
    await popupPromise;
    assert.ok(blocked.includes(blockedUrl), "popup first request must be intercepted");
    assert.equal(forbiddenReceiverHits, 0, "forbidden local server must receive zero requests");
    process.stdout.write(JSON.stringify({ ticket: 367, browser: "chromium", firstPopupRequest: "BLOCKED",
      forbiddenReceiverHits, boundTo: origin, result: "PASS", hardwareMobile: "NOT_RUN" }) + "\n");
  } finally { await browser.close(); }
} finally {
  await Promise.all([close(allowed), close(forbidden)]);
}

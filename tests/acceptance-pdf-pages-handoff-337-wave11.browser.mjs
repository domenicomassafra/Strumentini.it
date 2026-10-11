/** #337 real pages: verified PDF producer -> ephemeral one-shot File -> manual PNG -> independent decoder. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, webkit } from "@playwright/test";
import sharp from "sharp";
import { createSimplePdf } from "../src/engines/pdf/writer.ts";

const port = await new Promise((resolvePort, reject) => {
  const socket = createServer();
  socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const info = socket.address();
    if (!info || typeof info === "string") return reject(new Error("No local port"));
    socket.close(() => resolvePort(info.port));
  });
});
const origin = process.env.PDF337_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.PDF337_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--ignore-lock", "--host", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: "ignore" });

try {
  for (let i = 0; i < 120; i++) {
    if (server && server.exitCode !== null) throw new Error(`Astro exited ${server.exitCode}`);
    try { if ((await fetch(`${origin}/tools/pdf-merge/`, { signal: AbortSignal.timeout(1200) })).ok) break; } catch { /* local start */ }
    if (i === 119) throw new Error("PDF #337 local Astro route unavailable");
    await sleep(180);
  }
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
      const page = await context.newPage();
      const offOrigin = [], errors = [], requestsWithBody = [], unintendedDownloads = [];
      context.on("page", (opened) => {
        opened.on("pageerror", (error) => errors.push(error.message));
        opened.on("download", (download) => unintendedDownloads.push(download.suggestedFilename()));
      });
      page.on("pageerror", (error) => errors.push(error.message));
      context.on("request", (request) => {
        const url = request.url();
        if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) offOrigin.push(url);
        if (!["GET", "HEAD"].includes(request.method())) requestsWithBody.push(url);
      });

      assert.equal((await page.goto(`${origin}/tools/pdf-merge/`, { waitUntil: "networkidle" }))?.status(), 200);
      await page.waitForFunction(() => [...document.querySelectorAll("astro-island")].every((island) => !island.hasAttribute("ssr")), { timeout: 25_000 });
      await page.locator('input[type="file"]').first().setInputFiles([
        { name: "alpha.pdf", mimeType: "application/pdf", buffer: Buffer.from(createSimplePdf(["PDF_HANDOFF_337_ALPHA"])) },
        { name: "beta.pdf", mimeType: "application/pdf", buffer: Buffer.from(createSimplePdf(["PDF_HANDOFF_337_BETA"])) },
      ]);
      await page.getByRole("button", { name: "Unisci PDF", exact: true }).click();
      const send = page.locator("[data-pdf-handoff337] button");
      try { await send.waitFor({ timeout: 40_000 }); }
      catch (error) {
        console.error("PDF337 source status:", (await page.locator("main").innerText()).slice(-4000));
        console.error("PDF337 browser errors:", errors);
        throw error;
      }
      const popupPromise = page.waitForEvent("popup");
      await send.click();
      const popup = await popupPromise;
      await popup.locator("[data-pdf-handoff337-status]").getByText("PDF ricevuto localmente", { exact: false }).waitFor({ timeout: 40_000 });
      assert.equal(new URL(popup.url()).pathname, "/tools/pdf-to-images/");
      assert.equal(new URL(popup.url()).hash, "", "Capability fragment must be consumed once");
      assert.match(await popup.locator("[data-pdf-handoff337-status]").innerText(), /merged\.pdf/);
      assert.match(await page.locator("[data-pdf-handoff337-status]").innerText(), /PDF consegnato/);
      assert.equal(await popup.locator('input[type="file"]').first().evaluate((input) => input.files?.length ?? -1), 0,
        "No file picker was used at the receiving route");
      assert.equal(await popup.locator('.result-panel [data-result-class="image"]').count(), 0, "No automatic render");
      assert.deepEqual(unintendedDownloads, [], "Handoff never downloads anything by itself");
      await popup.getByLabel("Pagine (facoltativo)").fill("1");
      await popup.locator('form.tool-operation button[type="submit"]').click();
      await popup.getByRole("link", { name: /Scarica .*png/i }).first().waitFor({ timeout: 50_000 });
      const downloaded = popup.waitForEvent("download");
      await popup.getByRole("link", { name: /Scarica .*png/i }).first().click();
      const png = readFileSync(await (await downloaded).path());
      const decoded = await sharp(png).metadata();
      assert.equal(decoded.format, "png");
      assert((decoded.width ?? 0) > 64 && (decoded.height ?? 0) > 64);
      assert.deepEqual(offOrigin, [], "No outbound requests");
      assert.deepEqual(requestsWithBody, [], "No server uploads");
      assert.deepEqual(errors, [], "No browser errors");
      console.log(`${engine.name()}: real PDF merge→one-shot native File→manual PNG→independent Sharp decode PASS (${png.length} bytes)`);
      await context.close();
    } finally { await browser.close(); }
  }
} finally {
  if (server !== null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise((resolveDone) => server.once("exit", resolveDone)), sleep(1500)]);
  }
}

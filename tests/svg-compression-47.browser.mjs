import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = 18347;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("node", ["node_modules/astro/bin/astro.mjs", "dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: new URL("..", import.meta.url), stdio: "ignore", env: { ...process.env, STRUMENTINI_DEV_LINKED_DEPS: realpathSync(new URL("../node_modules", import.meta.url)) } });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
${"\n   ".repeat(75)}
<rect x="0" y="0" width="96" height="64" fill="#ff0000"/>
</svg>`;

try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try { if ((await fetch(`${origin}/tools/image-compression/`)).ok) { ready = true; break; } } catch { /* launching */ }
    await delay(350);
  }
  assert.equal(ready, true, "Astro development server did not become ready");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    page.on("pageerror", error => console.error("BROWSER_PAGE_ERROR", error.message));
    page.on("console", message => { if (message.type() === "error") console.error("BROWSER_CONSOLE_ERROR", message.text()); });
    page.on("response", response => { if (response.status() >= 400) console.error("BROWSER_HTTP_ERROR", response.status(), response.url()); });
    const response = await page.goto(`${origin}/tools/image-compression/`, { waitUntil: "commit", timeout: 35_000 });
    assert.equal(response?.status(), 200);
    await page.waitForFunction(() => document.querySelector('[data-image-compression-hydration-gate]')?.disabled === false, null, { timeout: 40_000 });
    const form = page.locator("[data-svg-compression-47] form");
    await form.locator('input[type="file"]').setInputFiles({ name: "quadrato.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) });
    await form.getByRole("button", { name: "Ottimizza e verifica SVG" }).click();
    await page.locator('[data-svg-optimized="true"]').waitFor({ timeout: 40_000 });
    const details = await page.locator('[data-svg-optimized="true"]').innerText();
    assert.match(details, /SVG verificato pixel per pixel/u);
    assert.match(details, /Risparmio reale/u);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Scarica SVG ottimizzato" }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "quadrato-ottimizzato.svg");
    const bytes = await readFile(await download.path());
    assert(bytes.byteLength < Buffer.byteLength(svg), "the optimization did not really shrink the source");
    assert.match(bytes.toString("utf8"), /^<svg\b/u);
    assert(!bytes.toString("utf8").includes("<script"));
    console.log(`PASS #47 local SVG: original=${Buffer.byteLength(svg)} bytes, optimized=${bytes.length}, exact canvas pixels, real browser download`);

    await form.locator('input[type="file"]').setInputFiles({ name: "malicious.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>') });
    await form.getByRole("button", { name: "Ottimizza e verifica SVG" }).click();
    await page.locator('[data-svg-compression-47] [role="alert"]').waitFor();
    assert.equal(await page.locator('[data-svg-optimized="true"]').count(), 0);
    console.log("PASS #47 unsafe SVG rejected, previous download invalidated");
  } finally { await browser.close(); }
} finally {
  server.kill("SIGTERM");
}

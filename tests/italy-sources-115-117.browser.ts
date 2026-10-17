import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = 18315;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/astro/bin/astro.mjs", "dev", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: new URL("..", import.meta.url), stdio: "ignore",
  env: { ...process.env, STRUMENTINI_DEV_LINKED_DEPS: await realpath(new URL("../node_modules", import.meta.url)) },
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${origin}/codici-geografici-italia/`)).ok) { ready = true; break; } } catch { /* boot */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert(ready, "geography page did not boot");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const geo = await page.goto(`${origin}/codici-geografici-italia/`, { waitUntil: "domcontentloaded" });
    assert.equal(geo?.status(), 200);
    const search = page.getByRole("searchbox", {name:/Nome o codice ISTAT/u});
    await page.waitForFunction(() => !(document.querySelector('section.geo115 input[type="search"]') as HTMLInputElement)?.disabled, null, { timeout: 30_000 });
    await search.fill("Bari");
    await page.getByRole("button", { name: "Cerca nella copia ufficiale" }).click();
    await page.getByRole("rowheader", { name: "Bari", exact: true }).waitFor();
    const content = await page.locator("section.geo115").innerText();
    assert.match(content, /Bari/u);
    assert.match(content, /Codice provincia ISTAT/u);
    console.log("PASS #115 public browser lookup Bari: real pinned ISTAT row and province code displayed");

    const fiscal = await page.goto(`${origin}/fonti-fiscali-italia/`, { waitUntil: "domcontentloaded" });
    assert.equal(fiscal?.status(), 200);
    const pageText = await page.locator("main.sources-fiscal").innerText();
    for (const expected of ["Anno fiscale 2025", "Anno fiscale 2026", "33%", "35%", "2024", "Agenzia delle Entrate"]) {
      assert(pageText.includes(expected), `missing ${expected}`);
    }
    const citations = await page.locator("main.sources-fiscal a[href^='https://']").count();
    assert(citations >= 5);
    assert.equal(errors.length, 0, errors.join("; "));
    console.log(`PASS #117 public browser: 2024/2025/2026 official-year references, 33/35% bands, ${citations} official links`);
  } finally { await browser.close(); }
} finally { server.kill("SIGTERM"); }

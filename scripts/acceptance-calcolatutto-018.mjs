import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const port = 18418;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: resolve(import.meta.dirname, ".."), stdio: "ignore" });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
    await sleep(100);
  }
  if (!ready) throw new Error("Static preview did not start");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const landing = await page.goto(`${origin}/calcoli-essenziali/`);
    if (landing?.status() !== 200) throw new Error("Calculator landing returned a non-200 status");
    const routes = await page.locator("main ul li a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    if (routes.length !== 13 || new Set(routes).size !== 13) throw new Error("Expected 13 distinct calculator links");
    for (const route of routes) {
      const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
      if (response?.status() !== 200) throw new Error(`${route}: HTTP ${response?.status()}`);
    }
    await page.goto(`${origin}/tools/percentage-helper/`, { waitUntil: "networkidle" });
    await page.locator('[data-vat-form] [name="operation"]').selectOption("scorporo");
    await page.locator('[data-vat-form] [name="amount"]').fill("122,00");
    await page.locator('[data-vat-form] [name="rate"]').fill("22");
    await page.locator('[data-vat-form] button[type="submit"]').click();
    const output = (await page.locator('[data-vat-result]').innerText()).replace(/\s+/gu, " ");
    if (!output.includes("100,00") || !output.includes("22,00") || !output.includes("122,00")) {
      throw new Error(`Unexpected scorporo result: ${output}`);
    }
    console.log(`STR-018 PREVIEW PASS: ${routes.length} calculator links HTTP 200; IVA scorporo: ${output}`);
  } finally { await browser.close(); }
} finally { server.kill("SIGTERM"); }

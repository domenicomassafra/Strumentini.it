import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = 18787;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], {
  cwd: process.cwd(), stdio: "ignore",
});

async function waitForLocalPage() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${origin}/tools/partita-iva-validator/`)).ok) return;
    } catch { /* Server still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Local Astro server unavailable");
}

let browser;
try {
  await waitForLocalPage();
  browser = await chromium.launch({ headless: true });
  const cases = [
    { input: "IT 12345678903", expected: ["Valido", "12345678903", "Paese IVA", "IT", "Esistenza nel registro verificata", "No"] },
    { input: "BE 0411905847", expected: ["Valido", "BE0411905847", "Paese IVA", "BE", "Esistenza nel registro verificata", "No"] },
    { input: "DE136695977", expected: ["Non valido", "national-rule", "DE"] },
    { input: "BE", expected: ["Non valido", "incomplete", "Manca il numero"] },
    { input: "XX123456", expected: ["Non valido", "country", "Prefisso IVA UE non supportato"] },
  ];

  for (const { input, expected } of cases) {
    const page = await browser.newPage();
    const requests = [];
    const errors = [];
    try {
      const response = await page.goto(`${origin}/tools/partita-iva-validator/`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200);
      const form = page.locator("form:has(#partita-iva-validator-value)");
      await form.locator("#partita-iva-validator-value").fill(input);
      page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
      page.on("pageerror", (error) => errors.push(String(error)));
      await form.locator("button[type='submit']").first().click();
      const result = page.locator(".result-panel[data-state='success']").last();
      await result.waitFor({ timeout: 15000 });
      const text = await result.innerText();
      for (const value of expected) assert.ok(text.includes(value), `${input}: missing ${value} in ${text}`);
      assert.deepEqual(errors, [], `${input}: browser errors`);
      assert.ok(requests.every(({ url, method }) => url.startsWith(origin) && method === "GET"), `${input}: non-local or non-GET network request`);
      console.log(`STR287_BROWSER_PASS ${input}: ${expected.join(" | ")} offline`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

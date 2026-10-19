import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const origin = "http://127.0.0.1:18300";
const server = spawn("python3", ["-m", "http.server", "18300", "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root, stdio: "ignore",
});
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

try {
  let ready = false;
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(`${origin}/tools/text-diff/`)).ok) { ready = true; break; }
    } catch { /* server starting */ }
    await sleep(100);
  }
  assert(ready, "static build server unavailable");
  for (const [name, type] of [["Chromium", chromium], ["Firefox", firefox], ["WebKit", webkit]]) {
    console.log(`${name}: launching`);
    const browser = await type.launch({ headless: true, timeout: 15_000 });
    try {
      console.log(`${name}: opening page`);
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.setDefaultTimeout(15_000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      const response = await page.goto(`${origin}/tools/text-diff/`, { waitUntil: "networkidle" });
      console.log(`${name}: loaded page`);
      assert.equal(response?.status(), 200);
      await page.getByRole("textbox", { name: "Prima", exact: true }).fill("caffè\r\nvecchia\r\n");
      await page.getByRole("textbox", { name: "Dopo", exact: true }).fill("caffè\nnuova\n");
      const taskRequests = [];
      page.on("request", (request) => taskRequests.push({ url: request.url(), method: request.method(), body: request.postData() }));
      await page.getByRole("button", { name: "Confronta i testi" }).click();
      console.log(`${name}: submitted first diff`);
      const result = page.locator(".diff-result[data-state='success']");
      await result.waitFor({ timeout: 15000 });
      const output = await result.innerText();
      assert.match(output, /vecchia/u);
      assert.match(output, /nuova/u);
      assert(taskRequests.some((request) => request.url.endsWith(".js")), "no on-demand implementation script loaded");
      assert(taskRequests.every((request) => request.url.startsWith(origin) && request.method === "GET" && !request.body), "task leaked over network");
      assert.equal(errors.length, 0, errors.join("; "));

      const refused = Array.from({ length: 1001 }, (_, i) => `line-${i}`).join("\n");
      await page.getByRole("textbox", { name: "Prima", exact: true }).fill(refused);
      await page.getByRole("textbox", { name: "Dopo", exact: true }).fill(refused);
      await page.getByRole("button", { name: "Confronta i testi" }).click();
      console.log(`${name}: submitted refusal`);
      await page.getByText("Il confronto riga per riga supera il limite locale.", { exact: false }).waitFor({ timeout: 15000 });
      console.log(`${name}: PASS output+refusal+lazy-script+no-egress+no-pageerror`);
      await page.close();
    } finally {
      await browser.close({ reason: "acceptance complete" });
    }
  }
} finally {
  server.kill("SIGTERM");
}

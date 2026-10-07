import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_SEARCH_MARKDOWN_PORT ?? 18187);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("invalid port " + String(port));
const origin = "http://127.0.0.1:" + String(port);
const route = origin + "/tests/browser-fixtures/pdf-search-markdown-harness.html";
const server = spawn(resolve(root, "node_modules/.bin/vite"), ["--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(route);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("acceptance server did not start: " + route);
}

const cases = [
  {
    button: "#search",
    name: "ticket248-search",
    assertions: [/2 corrispondenze/iu, /searchable\.pdf.*matches/isu, /scan\.pdf.*no-text/isu, /broken\.pdf.*unreadable/isu, /OCR: .*non è disponibile/isu, /pagina 1/iu, /pagina 2/iu],
  },
  {
    button: "#markdown",
    name: "ticket252-markdown",
    assertions: [/PDF→Markdown: converted/iu, /strumentini-pdf-page file="report\.pdf" page="1"/u, /Perdite dichiarate/iu, /colonne multiple/iu, /Immagini/iu, /tipografici/iu],
  },
];

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const results = [];
    try {
      for (const testCase of cases) {
        const page = await context.newPage();
        const requests = [];
        const errors = [];
        let started = false;
        page.on("request", (request) => {
          if (started) requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
        });
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        try {
          const response = await page.goto(route, { waitUntil: "networkidle" });
          if (response?.status() !== 200) throw new Error(testCase.name + ": HTTP " + String(response?.status()));
          started = true;
          await page.locator(testCase.button).click();
          await page.locator("#result [data-result-class]").waitFor({ timeout: 15_000 });
          const text = await page.locator("#result").innerText();
          for (const assertion of testCase.assertions) {
            if (!assertion.test(text)) throw new Error(testCase.name + ": assertion " + String(assertion) + " failed for " + JSON.stringify(text.slice(0, 3000)));
          }
          if (testCase.name === "ticket252-markdown" && !text.includes("\\# heading \\*literal\\*")) {
            throw new Error(testCase.name + ": Markdown metacharacters were not visibly escaped");
          }
          if (errors.length > 0) throw new Error(testCase.name + ": runtime errors " + errors.join(" | "));
          const bad = requests.filter((request) => {
            const local = request.url.startsWith(origin) || request.url.startsWith("blob:" + origin + "/") || request.url.startsWith("data:");
            return !local || request.method !== "GET" || (request.postData ?? "") !== "";
          });
          if (bad.length > 0) throw new Error(testCase.name + ": external/non-GET/task-body request " + JSON.stringify(bad));
          const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
          if (horizontalOverflow) throw new Error(testCase.name + ": horizontal overflow at 390px");
          results.push({ name: testCase.name, status: "PASS", externalRequests: 0, nonGetRequests: 0, taskBodyLeaks: 0, runtimeErrors: 0, horizontalOverflow: false });
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
    const evidence = { schemaVersion: 1, status: "PASS", tools: ["pdf-multi-text-search", "pdf-to-markdown"], scope: [248, 252], harness: "production PDF modules + production PdfResultV2", mobileViewport: { width: 390, height: 844, horizontalOverflow: false }, network: "zero external/non-GET/task-body requests after operation start", cases: results, globalReceiptRebound: false };
    const evidenceDir = resolve(root, ".scratch/strumentini-expansion-20261005/evidence");
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(resolve(evidenceDir, "pdf-248-252-browser.json"), JSON.stringify(evidence, null, 2) + "\n", "utf8");
    const receiptDir = resolve(root, "quality/receipts/pdf-search-markdown");
    await mkdir(receiptDir, { recursive: true });
    await writeFile(resolve(receiptDir, "browser-acceptance.json"), JSON.stringify(evidence, null, 2) + "\n", "utf8");
    console.log("PDF 248/252 browser acceptance PASS: " + String(results.length) + " cases");
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}

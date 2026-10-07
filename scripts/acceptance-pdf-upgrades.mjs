import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_UPGRADE_PORT ?? 18186);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`invalid port ${String(port)}`);
const origin = `http://127.0.0.1:${port}`;
const route = `${origin}/tests/browser-fixtures/pdf-upgrades-harness.html`;
const server = spawn(resolve(root, "node_modules/.bin/vite"), ["--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(route); if (response.ok) return; } catch {}
    await sleep(100);
  }
  throw new Error(`acceptance server did not start: ${route}`);
}

const cases = [
  {
    button: "#text",
    name: "ticket220-text",
    assertions: [/Pagine selezionate\s*2, 1/iu, /Modalità\s*operator-lines/iu, /===== PAGINA 2 =====/u, /page one\s*second line/iu],
  },
  {
    button: "#images",
    name: "ticket220-images",
    assertions: [/Immagini con provenienza\s*1/iu, /p\.1\/ImShared, p\.2\/ImShared/iu, /Immagini non esportate per filtro\s*1/iu, /FlateDecode/u],
  },
  {
    button: "#metadata",
    name: "ticket318-inspect",
    assertions: [/Campi metadata riconosciuti\s*3/iu, /Campi Info sconosciuti\s*1/iu, /Info sconosciuto: CustomKey\s*unknown-value/iu, /Stream XMP \/Metadata\s*9/iu],
  },
  {
    button: "#remove",
    name: "ticket318-remove",
    assertions: [/Output riaperto e riparsato\s*Sì/iu, /Metadati rimossi dopo reparse\s*Sì/iu, /Numero pagine stabile\s*Sì/iu, /Baseline testo\s*Verificata · stabile: Sì/iu],
  },
];

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const results = [];
    try {
      for (const testCase of cases) {
        const page = await context.newPage();
        const requests = [];
        const errors = [];
        let started = false;
        page.on("request", (request) => { if (started) requests.push({ url: request.url(), method: request.method(), postData: request.postData() }); });
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
        try {
          const response = await page.goto(route, { waitUntil: "networkidle" });
          if (response?.status() !== 200) throw new Error(`${testCase.name}: HTTP ${String(response?.status())}`);
          started = true;
          await page.locator(testCase.button).click();
          await page.locator("#result [data-result-class]").waitFor({ timeout: 15_000 });
          const text = await page.locator("#result").innerText();
          for (const assertion of testCase.assertions) if (!assertion.test(text)) throw new Error(`${testCase.name}: assertion ${String(assertion)} failed for ${JSON.stringify(text.slice(0, 2500))}`);
          if (errors.length > 0) throw new Error(`${testCase.name}: runtime errors ${errors.join(" | ")}`);
          const bad = requests.filter((request) => {
            const local = request.url.startsWith(origin) || request.url.startsWith(`blob:${origin}/`) || request.url.startsWith("data:");
            return !local || request.method !== "GET" || (request.postData ?? "") !== "";
          });
          if (bad.length > 0) throw new Error(`${testCase.name}: external/non-GET/task-body request ${JSON.stringify(bad)}`);
          await page.setViewportSize({ width: 390, height: 844 });
          await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
          const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
          if (horizontalOverflow) throw new Error(`${testCase.name}: horizontal overflow at 390px`);
          results.push({ name: testCase.name, status: "PASS", externalRequests: 0, nonGetRequests: 0, taskBodyLeaks: 0, runtimeErrors: 0, horizontalOverflow: false });
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
    const evidence = { schemaVersion: 1, status: "PASS", scope: [220, 318], harness: "production PDF modules + production PdfResultV2", cases: results, globalReceiptRebound: false };
    const evidenceDir = resolve(root, ".scratch/strumentiutili-expansion-20261005/evidence");
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(resolve(evidenceDir, "pdf-220-318-browser.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log(`PDF 220/318 browser acceptance PASS: ${results.length} cases`);
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}

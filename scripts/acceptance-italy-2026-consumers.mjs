import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_ITALY_2026_PORT ?? 18196);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`invalid port ${String(port)}`);
const origin = `http://127.0.0.1:${port}`;
const evidenceDir = resolve(root, ".scratch/strumentini-expansion-20261005/evidence");
const ordinaryPath = resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml");
const simplifiedPath = resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-simplified-anonymized.xml");
await mkdir(evidenceDir, { recursive: true });
const ordinary = await readFile(ordinaryPath, "utf8");
const hostilePath = resolve("/tmp", "strumentini-fatturapa-hostile-browser.xml");
await writeFile(hostilePath, ordinary.replace(
  "<p:FatturaElettronica",
  '<!DOCTYPE invoice [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n<p:FatturaElettronica',
), "utf8");

const server = spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}/tools/fatturapa-reader/`);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`acceptance server did not start: ${origin}`);
}

function requestAudit(page) {
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
  return {
    start() { started = true; },
    assert(routeId) {
      if (errors.length > 0) throw new Error(`${routeId}: runtime errors ${errors.join(" | ")}`);
      const bad = requests.filter((request) => {
        const local = request.url.startsWith(origin) || request.url.startsWith(`blob:${origin}/`) || request.url.startsWith("data:");
        return !local || request.method !== "GET" || (request.postData ?? "") !== "";
      });
      if (bad.length > 0) throw new Error(`${routeId}: external/non-GET/task-body request ${JSON.stringify(bad)}`);
      return { externalRequests: 0, nonGetRequests: 0, taskBodyLeaks: 0, runtimeErrors: 0 };
    },
  };
}

async function assertMobile(page, routeId) {
  const mobile = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    operationVisible: Boolean(document.querySelector("[data-tool-operation]")),
    widest: [...document.querySelectorAll("*")]
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          id: element.id,
          className: String(element.getAttribute("class") ?? "").slice(0, 100),
          left: Math.round(box.left),
          right: Math.round(box.right),
          width: Math.round(box.width),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      })
      .filter((entry) => entry.left < 0 || entry.right > document.documentElement.clientWidth || entry.scrollWidth > entry.clientWidth + 2)
      .sort((left, right) => Math.max(right.right, right.scrollWidth) - Math.max(left.right, left.scrollWidth))
      .slice(0, 12),
  }));
  if (mobile.horizontalOverflow) throw new Error(`${routeId}: horizontal overflow at 390px: ${JSON.stringify(mobile)}`);
  if (!mobile.operationVisible) throw new Error(`${routeId}: tool operation is not visible`);
  const { widest: _widest, ...evidence } = mobile;
  return evidence;
}

async function openRoute(context, id) {
  const page = await context.newPage();
  const response = await page.goto(`${origin}/tools/${id}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`${id}: HTTP ${String(response?.status())}`);
  await page.locator("[data-tool-operation]").waitFor({ state: "visible", timeout: 15_000 });
  return page;
}

const results = [];
try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      {
        const page = await openRoute(context, "inps-artigiani-commercianti");
        const audit = requestAudit(page);
        audit.start();
        await page.locator("#inps-ac-income").fill("56224");
        await page.locator("#inps-ac-profile").selectOption("artigiano");
        await page.locator("#inps-ac-seniority").selectOption("before-1996");
        await page.getByRole("button", { name: "Calcola contributi" }).click();
        await page.locator('[data-oracle-entry="cand-256"]').waitFor({ timeout: 15_000 });
        const text = await page.locator('[data-oracle-entry="cand-256"]').innerText();
        if (!/13[\.\s]?501,20\s*€/u.test(text) || !/56[\.\s]?224,00\s*€/u.test(text)) throw new Error(`cand-256: unexpected result ${JSON.stringify(text.slice(0, 2400))}`);
        results.push({ id: "inps-artigiani-commercianti", oracle: "cand-256", status: "PASS", ...audit.assert("cand-256"), mobile: await assertMobile(page, "cand-256") });
        await page.close();
      }
      {
        const page = await openRoute(context, "gestione-separata-contributi");
        const audit = requestAudit(page);
        audit.start();
        await page.locator("#gs-income").fill("10000");
        await page.getByRole("button", { name: "Calcola contributi" }).click();
        await page.locator('[data-oracle-entry="cand-257"]').waitFor({ timeout: 15_000 });
        const text = await page.locator('[data-oracle-entry="cand-257"]').innerText();
        if (!/2[\.\s]?607,00\s*€/u.test(text) || !/18[\.\s]?808,00\s*€/u.test(text) || !/sotto la soglia/iu.test(text)) throw new Error(`cand-257: unexpected result ${JSON.stringify(text.slice(0, 2400))}`);
        results.push({ id: "gestione-separata-contributi", oracle: "cand-257", status: "PASS", ...audit.assert("cand-257"), mobile: await assertMobile(page, "cand-257") });
        await page.close();
      }
      {
        const page = await openRoute(context, "ponti-ferie-optimizer");
        const audit = requestAudit(page);
        audit.start();
        await page.locator("#ponti-budget").fill("4");
        await page.getByRole("button", { name: "Trova i ponti" }).click();
        await page.locator('[data-oracle-entry="cand-258"]').waitFor({ timeout: 15_000 });
        const text = await page.locator('[data-oracle-entry="cand-258"]').innerText();
        if (!/2026-04-03.*2026-04-06/isu.test(text) || !/4 giorni.*1 ferie/isu.test(text)) throw new Error(`cand-258: ranked Easter bridge missing ${JSON.stringify(text.slice(0, 3200))}`);
        results.push({ id: "ponti-ferie-optimizer", oracle: "cand-258", status: "PASS", ...audit.assert("cand-258"), mobile: await assertMobile(page, "cand-258") });
        await page.close();
      }
      {
        const page = await openRoute(context, "fatturapa-reader");
        const audit = requestAudit(page);
        await page.locator("#fatturapa-reader-file").setInputFiles(ordinaryPath);
        audit.start();
        await page.getByRole("button", { name: "Leggi fattura" }).click();
        await page.locator('[data-oracle-entry="cand-255"]').waitFor({ timeout: 15_000 });
        const text = await page.locator('[data-oracle-entry="cand-255"]').innerText();
        if (!/DEMO-1/u.test(text) || !/FPR12/u.test(text) || !/1\.2\.3/u.test(text) || !/Fornitore Demo/u.test(text)) throw new Error(`cand-255: unexpected reader output ${JSON.stringify(text.slice(0, 3200))}`);
        results.push({ id: "fatturapa-reader", oracle: "cand-255", status: "PASS", ...audit.assert("cand-255"), mobile: await assertMobile(page, "cand-255") });
        await page.close();
      }
      {
        const page = await openRoute(context, "fatturapa-batch-csv");
        const audit = requestAudit(page);
        await page.locator("#fatturapa-batch-files").setInputFiles([ordinaryPath, simplifiedPath, hostilePath]);
        audit.start();
        await page.getByRole("button", { name: "Crea tabella e CSV" }).click();
        await page.locator('[data-oracle-entry="cand-259"]').waitFor({ timeout: 15_000 });
        const text = await page.locator('[data-oracle-entry="cand-259"]').innerText();
        if (!/3/u.test(text) || !/hostile/iu.test(text) || !/matched/u.test(text) || !/error/u.test(text)) throw new Error(`cand-259: mixed-batch evidence missing ${JSON.stringify(text.slice(0, 5000))}`);
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: /Scarica risultato/u }).click();
        const download = await downloadPromise;
        const downloadedPath = await download.path();
        if (downloadedPath === null) throw new Error("cand-259: download path unavailable");
        const csv = await readFile(downloadedPath, "utf8");
        if (!csv.includes("filename,fileStatus,bodyIndex,schemaFamily,transmissionFormat,xsdVersion") || !csv.includes("fatturapa-ordinary-anonymized.xml") || !csv.includes("fatturapa-hostile-browser.xml")) {
          throw new Error(`cand-259: complete CSV download did not contain expected rows: ${JSON.stringify(csv.slice(0, 2500))}`);
        }
        results.push({ id: "fatturapa-batch-csv", oracle: "cand-259", status: "PASS", downloadRows: csv.split("\n").length - 1, ...audit.assert("cand-259"), mobile: await assertMobile(page, "cand-259") });
        await page.close();
      }
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
  const evidence = {
    schemaVersion: 1,
    status: "PASS",
    tools: results.map(({ id }) => id),
    checkedAt: "2026-10-06",
    scope: [131, 132, 148, 149, 151],
    viewport: { width: 390, height: 844 },
    cases: results,
    privacy: "zero external/non-GET/task-body requests after operation start",
    globalReceiptRebound: false,
  };
  await writeFile(resolve(evidenceDir, "italy-131-132-148-149-151-browser.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  const receiptDir = resolve(root, "quality/receipts/italy-2026-consumers");
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, "browser-acceptance.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`Italy 2026 consumer browser acceptance PASS: ${results.length} routes`);
} finally {
  server.kill("SIGTERM");
}

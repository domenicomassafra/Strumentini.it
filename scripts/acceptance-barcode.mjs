import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_ACCEPTANCE_PORT ?? 18269);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const tempRoot = resolve(tmpdir(), "strumentini-barcode-acceptance");
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`barcode acceptance server unavailable at ${origin}`);
}

async function accessibleControls(form) {
  return form.locator("input, textarea, select, button").evaluateAll((controls) => controls.filter((control) => {
    if (control instanceof HTMLInputElement && control.type === "hidden") return false;
    if (control instanceof HTMLButtonElement && (control.textContent ?? "").trim() !== "") return false;
    const id = control.getAttribute("id");
    return !control.getAttribute("aria-label")
      && !control.getAttribute("aria-labelledby")
      && control.closest("label") === null
      && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
  }).map((control) => control.outerHTML.slice(0, 180)));
}

async function downloadBytes(page, buttonName, filename) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: buttonName }).click(),
  ]);
  const path = resolve(tempRoot, filename);
  await download.saveAs(path);
  return readFile(path);
}

try {
  await rm(tempRoot, { recursive: true, force: true });
  await mkdir(tempRoot, { recursive: true });
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  let started = false;
  page.on("request", (request) => {
    if (started) requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error" && !/Failed to load resource/u.test(message.text())) errors.push(message.text()); });
  try {
    const response = await page.goto(`${origin}/tools/barcode-generator/`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`barcode-generator route returned HTTP ${response?.status()}`);
    const form = page.locator("form").last();
    await form.waitFor();

    await page.getByLabel("Prime 12 cifre EAN-13", { exact: true }).fill("978047138429");
    started = true;
    await form.locator("button[type='submit']").focus();
    await page.keyboard.press("Enter");
    await page.locator(".result-panel img").waitFor({ timeout: 15_000 });
    const eanText = await page.locator(".result-panel").innerText();
    if (!/9780471384298/u.test(eanText) || !/atteso 8.*presente 8/iu.test(eanText)) throw new Error(`EAN result missing value/checksum: ${eanText.slice(0, 600)}`);

    const svgBytes = await downloadBytes(page, /SVG/u, "ean.svg");
    const svg = svgBytes.toString("utf8");
    if (!svg.startsWith("<svg") || !svg.includes("<rect") || svg.includes("<script") || /href=/u.test(svg)) throw new Error("downloaded EAN SVG is not clean local barcode geometry");
    if (!svg.includes("9780471384298")) throw new Error("downloaded EAN SVG omitted enabled human-readable value");

    const png = await downloadBytes(page, /PNG/u, "ean.png");
    if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("downloaded barcode PNG has no PNG signature");

    await form.locator("label").filter({ hasText: "Modalità EAN-13" }).locator("select").selectOption("validate");
    await page.getByLabel("EAN-13 completo, 13 cifre", { exact: true }).fill("9780471384297");
    await form.locator("button[type='submit']").click();
    await page.getByText(/EAN-13 non valido/u).waitFor();
    if (await page.locator(".result-panel img").count() !== 0) throw new Error("invalid EAN unexpectedly rendered a barcode image");

    await page.reload({ waitUntil: "networkidle" });
    const codeForm = page.locator("form").last();
    await codeForm.waitFor();
    await codeForm.locator("label").filter({ hasText: "Formato barcode" }).locator("select").selectOption("code128b");
    await page.getByLabel("Testo Code 128 B", { exact: true }).fill("AB12");
    await page.getByText(/Subset dichiarato: Code Set B/u).waitFor();
    await page.getByLabel(/Mostra il valore leggibile/u).uncheck();
    await codeForm.locator("button[type='submit']").click();
    await page.locator(".result-panel img").waitFor();
    const codeText = await page.locator(".result-panel").innerText();
    if (!/19 \(mod 103\)/u.test(codeText) || !/Code Set B.*ASCII 32-126/isu.test(codeText)) throw new Error(`Code 128 B result missing checksum/subset disclosure: ${codeText.slice(0, 600)}`);
    const codeSvg = (await downloadBytes(page, /SVG/u, "code128.svg")).toString("utf8");
    if (codeSvg.includes("<text")) throw new Error("human-readable text remained in SVG after option was disabled");

    const unlabeled = await accessibleControls(codeForm);
    if (unlabeled.length > 0) throw new Error(`barcode form has unlabeled controls: ${unlabeled.join(" | ")}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error("barcode route horizontally overflows at 390px");
    if (errors.length > 0) throw new Error(`barcode route runtime errors: ${errors.join(" | ")}`);
    const badRequests = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
    if (badRequests.length > 0) throw new Error(`barcode task made an external/non-GET/body request: ${JSON.stringify(badRequests)}`);
    if (requests.some((request) => request.url.includes("978047138429") || request.url.includes("AB12") || (request.postData ?? "").includes("AB12"))) throw new Error("barcode payload leaked into a task network request");

    const scriptText = await readFile(new URL(import.meta.url), "utf8");
    const receipt = {
      schemaVersion: 1,
      status: "PASS",
      tool: "barcode-generator",
      ean13: { keyboardGenerate: "PASS", knownVector: "9780471384298", invalidChecksumRefused: "PASS" },
      code128b: { subsetDisclosure: "PASS", checksumVector: 19, humanReadableToggle: "PASS" },
      downloads: { svgClean: true, pngSignatureVerified: true },
      mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
      accessibility: { unlabeledControls: 0 },
      network: "zero external, non-GET or task-body requests after task start",
      runtimeErrors: 0,
      svgSha256: sha256(svgBytes),
      pngSha256: sha256(png),
      scriptSha256: sha256(scriptText),
    };
    const receiptRoot = resolve(root, "quality/receipts/barcode");
    await mkdir(receiptRoot, { recursive: true });
    await writeFile(resolve(receiptRoot, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    console.log("barcode browser acceptance PASS: EAN generate/validate, Code128B subset, SVG+PNG download, mobile, a11y, locality");
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
  await rm(tempRoot, { recursive: true, force: true });
}

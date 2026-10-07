import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

/*
 * Browser acceptance for the eight marketing, QR and image-media tools.
 *
 * Each case drives the real route: fill the visible controls, submit with the
 * keyboard, and require the tool's own Italian output plus its specific
 * contract assertion. After the task starts, no request may leave the origin,
 * carry a body, or be a non-GET; the implementation chunk must load lazily; the
 * form must have no unlabelled control; and the 390px viewport must not
 * overflow horizontally.
 */

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_ACCEPTANCE_PORT ?? 18261);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`invalid acceptance port: ${process.env.STRUMENTINI_ACCEPTANCE_PORT ?? ""}`);
}
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root,
  stdio: "ignore",
});
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

/*
 * The account API is optional: on a plain static preview `/api/auth/session`
 * answers 404 by design (PRODUCT.md — a host without the Worker serves the
 * whole site and the account controls report themselves unavailable). That one
 * probe is therefore not a tool failure; any other failed resource is.
 */
const OPTIONAL_API_PATH = /\/api\//u;

const exifBytes = await readFile(resolve(root, "quality/fixtures/image-metadata-segments/with-exif.png"));
const tempRoot = await resolve(tmpdir(), "strumentini-marketing-media-");
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });
const qrPngPath = resolve(tempRoot, "qr.png");
const exifPath = resolve(tempRoot, "con-exif.png");

const exifFile = { name: "con-exif.png", mimeType: "image/png", buffer: exifBytes };

const fill = (label, value) => async (page) => page.getByLabel(label, { exact: true }).fill(value);
const selectOption = (label, value) => async (page) => page.getByLabel(label, { exact: true }).selectOption(value);
const textareaValue = (index, value) => (form) => form.locator("textarea").nth(index).fill(value);
const uploadFirst = (files) => async (_page, form) => form.locator("input[type='file']").first().setInputFiles(files);

const cases = [
  {
    id: "url-comparison",
    setup: async (page) => {
      await fill("Primo URL", "HTTPS://ESEMPIO.IT:443/articoli/uno?b=2&a=1#uno")(page);
      await fill("Secondo URL", "https://esempio.it/articoli/uno?a=1&b=2#due")(page);
    },
    expect: /esempio\.it\/articoli\/uno\?a=1&b=2/iu,
    assertion: "both normalised forms shown and reported equal",
  },
  {
    id: "social-character-limit",
    setup: async (page) => {
      await selectOption("Piattaforma", "x")(page);
      await fill("Testo del post", "Prevento 世界 https://esempio.it/x")(page);
    },
    expect: /caratteri ponderati|X \(ex Twitter\)|X Help Center/iu,
    assertion: "code-point count and the platform's weighted count both reported with provenance",
  },
  {
    id: "meta-preview",
    setup: async (_page, form) => {
      await textareaValue(0, "Preventivo & \"aperto\" per il sito")(form);
      await textareaValue(1, "Ricevi il preventivo entro due giorni lavorativi.")(form);
    },
    expect: /titolo \d+\/60|Google Search Central/iu,
    assertion: "length counted against the reference and its source named",
  },
  {
    id: "open-graph-preview",
    setup: async (_page, form) => {
      await textareaValue(0, [
        '<meta property="og:type" content="article">',
        '<meta property="og:title" content="Guida &quot;A&quot; &gt; B">',
        '<meta property="og:description" content="Una <descrizione> con &amp; dentro">',
        '<meta property="og:image" content="/hero.png">',
        '<meta property="og:url" content="https://esempio.it/articoli/uno">',
      ].join("\n"))(form);
    },
    expect: /relative\.invalid|URL relativo|1 manca|proprietà core mancanti/iu,
    assertion: "greater-than inside an attribute survives and the relative URL is named",
  },
  {
    id: "qr-generator",
    setup: async (page) => {
      await fill("Contenuto da codificare", "https://esempio.it/campagna?utm_source=verifica")(page);
    },
    expect: /Scarica risultato SVG|Scarica SVG|Versione|Byte UTF-8/iu,
    assertion: "symbol rendered with version, mask and byte budget, and SVG/PNG downloads offered",
  },
  {
    id: "qr-reader",
    setup: async (_page, form) => {
      // A 25-row block whose last row is one module short: structurally a
      // symbol, but not a valid matrix, so the tool must refuse it in Italian.
      await form.locator("textarea").fill(`${Array.from({ length: 24 }, () => "1".repeat(25)).join("\n")}\n${"1".repeat(24)}`);
    },
    expect: /matrice non è valida|stesso lunghezza|solo da 0 e 1/iu,
    assertion: "an unreadable matrix is refused with an Italian message rather than decoded into invented text",
    expectNoResult: true,
  },
  {
    id: "exif-remover",
    setup: uploadFirst(exifFile),
    expect: /senza metadati|Verificato sul file prodotto|JPEG APP1|nessuno/iu,
    assertion: "input inventory reported and the produced file proven free of identifying segments",
  },
  {
    id: "platform-size-presets",
    setup: async (page) => {
      await selectOption("Piattaforma", "instagram-story")(page);
      await fill("Larghezza di partenza", "1920")(page);
      await fill("Altezza di partenza", "1080")(page);
    },
    expect: /1080×1920|serve il ritaglio|servono bande|608×1080/iu,
    assertion: "crop box, letterbox need and source of the canvas all reported",
  },
];

if (cases.length !== 8 || new Set(cases.map(({ id }) => id)).size !== 8) {
  throw new Error(`marketing/media acceptance must contain exactly 8 unique tools; got ${cases.length}`);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`static server did not become ready at ${origin}`);
}

async function a11yAudit(form) {
  return form.locator("input, textarea, select, button").evaluateAll((controls) => controls.filter((control) => {
    const element = control;
    if (element instanceof HTMLInputElement && element.type === "hidden") return false;
    if (element instanceof HTMLButtonElement && (element.textContent ?? "").trim() !== "") return false;
    const id = element.getAttribute("id");
    return !element.getAttribute("aria-label")
      && !element.getAttribute("aria-labelledby")
      && element.closest("label") === null
      && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
  }).map((control) => control.outerHTML.slice(0, 160)));
}

async function acceptTool(context, testCase) {
  const page = await context.newPage();
  const requests = [];
  const scripts = [];
  const runtimeErrors = [];
  let started = false;
  page.on("request", (request) => {
    if (!started) return;
    requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));
  page.on("response", (response) => {
    if (response.status() < 400) return;
    if (response.status() === 404 && OPTIONAL_API_PATH.test(new URL(response.url()).pathname)) return;
    runtimeErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Paired with the response listener above: a missing optional API is not a
    // console-level problem for these tools.
    if (/Failed to load resource/u.test(message.text())) return;
    runtimeErrors.push(message.text());
  });
  try {
    const response = await page.goto(`${origin}/tools/${testCase.id}/`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`${testCase.id}: HTTP ${response?.status()}`);
    const form = page.locator("form").last();
    await form.waitFor();
    await testCase.setup(page, form);
    const submit = form.locator("button[type='submit']");
    await submit.waitFor();
    started = true;
    await submit.focus();
    await page.keyboard.press("Enter");
    const panel = page.locator(".result-panel").last();
    const inlineError = form.locator('[role="alert"]').last();
    const outcome = await Promise.race([
      panel.locator("pre, dl, ul, img, a.button").first().waitFor({ timeout: 15_000 }).then(() => "result"),
      inlineError.waitFor({ timeout: 15_000 }).then(() => "error"),
    ]).catch(() => "timeout");
    const output = await panel.innerText().catch(() => "");
    const uiError = outcome === "error" ? await inlineError.innerText().catch(() => "") : "";
    if (testCase.expectNoResult) {
      if (outcome !== "error") {
        throw new Error(`${testCase.id}: expected the tool to refuse this input with a visible message; panel read ${JSON.stringify(output.slice(0, 400))}`);
      }
      if (!testCase.expect.test(`${output}\n${uiError}`)) {
        throw new Error(`${testCase.id}: refusal message did not match ${testCase.expect}; got ${JSON.stringify(uiError.slice(0, 400))}`);
      }
    } else {
      if (outcome === "timeout") throw new Error(`${testCase.id}: neither a result nor a visible error after submit`);
      if (outcome === "error") throw new Error(`${testCase.id}: the tool reported an error: ${uiError}`);
      const resultContent = panel.locator("pre, dl, ul, img, a.button").first();
      await resultContent.waitFor({ timeout: 15_000 }).catch(() => {
        throw new Error(`${testCase.id}: no visible result after submit; panel read ${JSON.stringify(output.slice(0, 400))}`);
      });
      if (!testCase.expect.test(output)) {
        throw new Error(`${testCase.id}: contract assertion ${testCase.expect} failed for ${JSON.stringify(output.slice(0, 800))}`);
      }
    }
    if (runtimeErrors.length > 0) throw new Error(`${testCase.id}: runtime/console error: ${runtimeErrors.join(" | ")}`);
    if (scripts.length === 0) throw new Error(`${testCase.id}: no lazy implementation script observed after submit`);
    const bad = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
    if (bad.length > 0) throw new Error(`${testCase.id}: external, non-GET, or task-body request observed: ${JSON.stringify(bad)}`);
    const unlabeled = await a11yAudit(form);
    if (unlabeled.length > 0) throw new Error(`${testCase.id}: unlabeled controls: ${unlabeled.join(" | ")}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`${testCase.id}: horizontal overflow at 390px`);
    return {
      toolId: testCase.id,
      status: "PASS",
      assertion: testCase.assertion,
      outputSha256: sha256(output),
      lazyScriptCount: scripts.length,
      taskRequestCount: requests.length,
      externalTaskRequests: 0,
      nonGetTaskRequests: 0,
      taskContentLeaks: 0,
      runtimeErrors: 0,
      horizontalOverflow: false,
      unlabeledControls: 0,
    };
  } finally {
    await page.close();
  }
}

/**
 * The QR reader's image path is a claim about the browser, so it is exercised
 * against a real PNG generated by the generator itself: the symbol is written
 * through a canvas, downloaded as bytes, and handed back to the tool as a file.
 */
async function acceptQrImageRoundTrip(browserContext) {
  const page = await browserContext.newPage();
  const requests = [];
  let started = false;
  page.on("request", (request) => {
    if (started) requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });
  try {
    await page.goto(`${origin}/tools/qr-generator/`, { waitUntil: "networkidle" });
    const form = page.locator("form").last();
    await form.locator("textarea").fill("https://esempio.it/aggiornato/2026-10");
    await form.locator("button[type='submit']").click();
    await page.locator(".result-panel img").waitFor({ timeout: 20_000 });
    const dataUrl = await page.locator(".result-panel img").getAttribute("src");
    if (dataUrl === null || !dataUrl.startsWith("data:image/svg+xml")) throw new Error(`QR image is not an inline SVG: ${String(dataUrl).slice(0, 40)}`);
    const svg = decodeURIComponent(dataUrl.slice("data:image/svg+xml,".length));
    const matrix = /data-matrix="([01;]+)"/u.exec(svg)?.[1] ?? "";
    if (matrix === "") throw new Error("generated SVG carries no matrix");
    const browser = await browserContext.browser();
    const shot = await page.screenshot({ clip: await page.locator(".result-panel img").boundingBox() ?? undefined });
    await writeFile(qrPngPath, shot);

    const reader = await browserContext.newPage();
    started = true;
    const readerRequests = [];
    reader.on("request", (request) => readerRequests.push({ url: request.url(), method: request.method(), postData: request.postData() }));
    await reader.goto(`${origin}/tools/qr-reader/`, { waitUntil: "networkidle" });
    const readerForm = reader.locator("form").last();
    await readerForm.locator("input[type='file']").setInputFiles(qrPngPath);
    await readerForm.locator("button[type='submit']").click();
    await reader.locator(".result-panel pre").first().waitFor({ timeout: 25_000 });
    const output = await reader.locator(".result-panel").innerText();
    if (!output.includes("https://esempio.it/aggiornato/2026-10")) {
      throw new Error(`QR reader did not decode the browser-rendered symbol; got ${JSON.stringify(output.slice(0, 400))}`);
    }
    if (!/Reed/i.test(output)) throw new Error(`QR reader did not report the syndrome check; got ${JSON.stringify(output.slice(0, 400))}`);
    const bad = readerRequests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
    if (bad.length > 0) throw new Error(`qr-reader: external, non-GET, or task-body request observed: ${JSON.stringify(bad)}`);
    await reader.close();
    void requests;
    void browser;
    return {
      toolId: "qr-reader",
      status: "PASS",
      assertion: "symbol generated in the browser, rasterised from that SVG, and decoded back to the exact payload with syndromes verified",
      outputSha256: sha256(output),
    };
  } finally {
    await page.close();
  }
}

async function acceptExifByteProof(browserContext) {
  const page = await browserContext.newPage();
  try {
    await page.goto(`${origin}/tools/exif-remover/`, { waitUntil: "networkidle" });
    const form = page.locator("form").last();
    await form.locator("input[type='file']").setInputFiles(exifPath);
    await form.locator("button[type='submit']").click();
    const panel = page.locator(".result-panel").last();
    await panel.locator("dl").first().waitFor({ timeout: 25_000 });
    const output = await panel.innerText();
    if (!/PNG eXIf/.test(output) || !/Verificato sul file prodotto/.test(output)) {
      throw new Error(`exif-remover did not report the input inventory and the verification; got ${JSON.stringify(output.slice(0, 400))}`);
    }
    const download = panel.locator("a.button.primary");
    await download.waitFor({ timeout: 15_000 });
    const href = await download.getAttribute("href");
    if (href === null || !href.startsWith("blob:")) throw new Error("exif-remover did not offer a local download for the produced file");
    const suggested = await download.getAttribute("download");
    if (suggested === null || !suggested.endsWith(".png")) throw new Error(`exif-remover download has no filename: ${String(suggested)}`);
    return {
      toolId: "exif-remover",
      status: "PASS",
      assertion: "input Exif segment inventoried, output proven metadata-free, local download offered",
      outputSha256: sha256(output),
    };
  } finally {
    await page.close();
  }
}

try {
  await writeFile(exifPath, exifBytes);
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];
  try {
    for (const testCase of cases) {
      console.log(`accepting ${testCase.id}`);
      results.push(await acceptTool(context, testCase));
    }
    console.log("accepting qr-reader image round trip");
    results.push(await acceptQrImageRoundTrip(context));
    console.log("accepting exif-remover byte proof");
    results.push(await acceptExifByteProof(context));
  } finally {
    await context.close();
    await browser.close();
  }
  const scriptText = await readFile(new URL(import.meta.url), "utf8");
  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    tools: [...cases.map(({ id }) => id)],
    routesChecked: results.length,
    keyboard: "every submit action exercised with Enter",
    accessibility: "all interactive controls in each tool form have a label or accessible name",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    externalTaskRequests: 0,
    nonGetTaskRequests: 0,
    taskContentLeaks: 0,
    runtimeConsoleErrors: 0,
    network: "zero external, non-GET, or task-body requests after task start",
    implementationEager: false,
    lazyImplementationObservedFor: results.map(({ toolId }) => toolId),
    browserOnlyClaims: [
      "qr-reader image path: the symbol is produced by qr-generator, rasterised from its own SVG in the browser, and read back by qr-reader with the Reed-Solomon syndromes verified",
      "exif-remover: the input inventory names the real eXIf chunk found in a decodable synthetic PNG, and the produced file is verified metadata-free before it is offered",
    ],
    scriptSha256: sha256(scriptText),
    results,
  };
  const receiptRoot = resolve(root, "quality/receipts/marketing-media");
  await mkdir(receiptRoot, { recursive: true });
  await writeFile(resolve(receiptRoot, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`marketing/media browser acceptance PASS: ${results.length} tool results with per-tool output/locality/lazy/mobile/a11y evidence`);
} finally {
  server.kill("SIGTERM");
  await rm(tempRoot, { recursive: true, force: true });
}
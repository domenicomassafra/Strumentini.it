import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18198;
const suppliedOrigin = process.env.FILE_FRONTIER_ACCEPTANCE_ORIGIN?.replace(/\/$/u, "");
const origin = suppliedOrigin ?? `http://127.0.0.1:${port}`;
const server = suppliedOrigin === undefined
  ? spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" })
  : null;
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await sleep(100);
  }
  throw new Error(`file frontier acceptance server unavailable at ${origin}`);
}

async function acceptTool(context, id, setup, assertion, verify = async () => undefined) {
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  let started = false;
  page.on("request", (request) => {
    if (started) requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });
  page.on("pageerror", (error) => errors.push({ text: String(error), url: "" }));
  page.on("console", (message) => { if (message.type() === "error") errors.push({ text: message.text(), url: message.location()?.url ?? "" }); });
  try {
    const response = await page.goto(`${origin}/tools/${id}/`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`${id}: HTTP ${String(response?.status())}`);
    const form = page.locator("form").last();
    await form.waitFor();
    await setup(page, form);
    started = true;
    const submit = form.locator("button[type='submit']");
    await submit.focus();
    await page.keyboard.press("Enter");
    const panel = page.locator(".result-panel").last();
    await panel.locator("pre, dl, ul, table, a.button").first().waitFor({ timeout: 15_000 });
    const text = await panel.innerText();
    if (!assertion.test(text)) throw new Error(`${id}: assertion ${String(assertion)} failed for ${JSON.stringify(text.slice(0, 1600))}`);
    await verify(page, panel);
    const bad = requests.filter((request) => {
      const local = request.url.startsWith(origin) || request.url.startsWith("blob:") || request.url.startsWith("data:");
      return !local || request.method !== "GET" || (request.postData ?? "") !== "";
    });
    if (bad.length > 0) throw new Error(`${id}: external/non-GET/task-body request ${JSON.stringify(bad)}`);
    const unexpectedErrors = errors.filter((entry) => {
      try { return new URL(entry.url).pathname !== "/api/auth/session"; } catch { return true; }
    });
    if (unexpectedErrors.length > 0) throw new Error(`${id}: runtime errors ${unexpectedErrors.map(({ text: message, url }) => `${message} (${url})`).join(" | ")}`);
    await page.setViewportSize({ width: 390, height: 844 });
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (horizontalOverflow) throw new Error(`${id}: horizontal overflow at 390px`);
    return { toolId: id, status: "PASS", keyboardSubmit: true, externalTaskRequests: 0, nonGetTaskRequests: 0, taskContentLeaks: 0, runtimeErrors: 0, horizontalOverflow: false };
  } finally {
    await page.close();
  }
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const results = [];
    try {
      results.push(await acceptTool(
        context,
        "ai-code-fence-bundle",
        async (_page, form) => form.locator("textarea").fill('filename: src/app.ts\n```ts\nexport const answer = 42;\n```\n\n```json filename=package.json\n{"name":"demo"}\n```'),
        /2 file pronti nello ZIP/iu,
        async (page, panel) => {
          const details = panel.locator("details[data-result-secondary-raw]");
          await details.locator("summary").click();
          const raw = await details.innerText();
          if (!raw.includes("src/app.ts") || !raw.includes("package.json")) throw new Error(`ai-code-fence-bundle: exact preview filenames missing from expanded result: ${JSON.stringify(raw.slice(0, 1800))}`);
          const [download] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: /Scarica risultato/u }).click()]);
          const path = await download.path();
          if (path === null) throw new Error("ai-code-fence-bundle: download path unavailable");
          const bytes = await readFile(path);
          if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("ai-code-fence-bundle: downloaded artifact is not ZIP");
        },
      ));
      results.push(await acceptTool(
        context,
        "file-size-analyzer",
        async (_page, form) => form.locator("input[type='file']").first().setInputFiles({ name: "sample.bin", mimeType: "application/octet-stream", buffer: Buffer.from("opaque-size-fixture", "utf8") }),
        /unknown|sconosciut|file-signature-detector|byte/iu,
      ));
    } finally {
      await context.close();
    }
    const receipt = {
      schemaVersion: 1,
      status: "PASS",
      tools: results.map(({ toolId }) => toolId),
      routesChecked: results.length,
      keyboard: "submit exercised with Enter",
      mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
      externalTaskRequests: 0,
      nonGetTaskRequests: 0,
      taskContentLeaks: 0,
      runtimeErrors: 0,
      network: "zero external, non-GET or task-body requests after operation start",
      results,
    };
    const outputDir = resolve(root, "quality/receipts/file-certification-frontier");
    await mkdir(outputDir, { recursive: true });
    await writeFile(resolve(outputDir, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    console.log("file certification frontier browser acceptance PASS: ai-code-fence-bundle + file-size-analyzer");
  } finally {
    await browser.close();
  }
} finally {
  server?.kill("SIGTERM");
}

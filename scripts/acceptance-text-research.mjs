import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18128;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root,
  stdio: "ignore",
});
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function acceptPage(browser, route, sensitiveValues, operate) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const taskRequests = [];
  const lazyScripts = [];
  let taskStarted = false;
  page.on("request", (request) => {
    if (taskStarted) {
      if (request.resourceType() === "script") lazyScripts.push(request.url());
      taskRequests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    }
  });

  const response = await page.goto(`${origin}${route}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`${route}: route returned ${response?.status()}`);
  await page.locator('[data-tool-page][data-runtime="LOCAL"]').waitFor();

  await operate(page, () => { taskStarted = true; });
  await page.waitForTimeout(100);

  if (lazyScripts.length === 0) throw new Error(`${route}: expected lazy tool implementation script after first operation`);
  const externalRequests = taskRequests.filter((request) => !request.url.startsWith(origin));
  if (externalRequests.length > 0) {
    throw new Error(`${route}: unexpected external request after task start: ${JSON.stringify(externalRequests)}`);
  }
  const contentLeaks = taskRequests.filter((request) => {
    const haystack = `${request.url}\n${request.postData ?? ""}`;
    return request.method !== "GET" || sensitiveValues.some((value) => value !== "" && haystack.includes(value));
  });
  if (contentLeaks.length > 0) {
    throw new Error(`${route}: task content appeared in network request: ${JSON.stringify(contentLeaks)}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${route}: mobile layout has horizontal overflow`);

  await page.close();
  return { route, lazyScripts: lazyScripts.length, taskRequests: taskRequests.length, externalRequests: 0, contentLeaks: 0, mobileOverflow: false };
}

try {
  await sleep(500);
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const listLeft = " café \ncafe\u0301\ntea\n";
  const listRight = "café\nwater\n";
  const listReceipt = await acceptPage(browser, "/tools/list-compare", ["café", "water", "tea"], async (page, startTask) => {
    await page.getByLabel("Lista A").fill(listLeft);
    await page.getByLabel("Lista B").fill(listRight);
    await page.getByRole("radio", { name: "Spazi ai bordi + NFC" }).check();
    startTask();
    const submit = page.getByRole("button", { name: "Confronta liste" });
    await submit.focus();
    await page.keyboard.press("Enter");
    const comparisonTable = page.getByRole("region", { name: "Righe mostrate" }).locator("table");
    await comparisonTable.getByText("In entrambe", { exact: true }).first().waitFor();
    await comparisonTable.getByText("Solo in A", { exact: true }).first().waitFor();
    await page.getByText("water", { exact: true }).first().waitFor();
  });

  const diffBefore = "a\nb\n";
  const diffAfter = "a\nc\n";
  const diffReceipt = await acceptPage(browser, "/tools/text-diff", ["a%0Ab", "a%0Ac", "a\nb", "a\nc"], async (page, startTask) => {
    await page.getByRole("textbox", { name: "Prima", exact: true }).fill(diffBefore);
    await page.getByRole("textbox", { name: "Dopo", exact: true }).fill(diffAfter);
    startTask();
    const submit = page.getByRole("button", { name: "Confronta i testi" });
    await submit.focus();
    await page.keyboard.press("Enter");
    const diffTable = page.getByRole("region", { name: "Righe mostrate" }).locator("table");
    await diffTable.getByText("Rimossa", { exact: true }).waitFor();
    await diffTable.getByText("Aggiunta", { exact: true }).waitFor();
    const removedText = await diffTable.locator("tbody tr").filter({ hasText: "Rimossa" }).innerText();
    const addedText = await diffTable.locator("tbody tr").filter({ hasText: "Aggiunta" }).innerText();
    if (!removedText.includes("Rimossa")) {
      throw new Error("text diff removal semantics depend on more than visible symbol+text");
    }
    if (!addedText.includes("Aggiunta")) {
      throw new Error("text diff addition semantics depend on more than visible symbol+text");
    }
  });

  const doi = "doi:10.1000/182";
  const isbn = "0-306-40615-2";
  const referenceReceipt = await acceptPage(browser, "/tools/doi-isbn-normalizer", [doi, isbn, "10.1000/182", "0306406152"], async (page, startTask) => {
    const field = page.getByRole("textbox", { name: "DOI" });
    await field.fill(doi);
    startTask();
    await field.press("Enter");
    const doiResult = page.locator('[data-result-class="validator"][data-research-result-tool="doi-isbn-normalizer"]');
    await doiResult.getByText("Valido", { exact: true }).waitFor();
    await doiResult.getByText("10.1000/182", { exact: false }).first().waitFor();
    const doiProvenance = doiResult.locator('[data-oracle-entry="cand-181"]');
    if (!/rete vietata/u.test(await doiProvenance.innerText())) throw new Error("DOI/ISBN provenance no longer proves the local no-network boundary");
    for (const action of ["copy", "download", "reuse", "retry", "reset"]) {
      if (await doiResult.locator(`[data-result-action="${action}"]`).count() !== 1) throw new Error(`DOI Result v2 action ${action} missing`);
    }

    await page.getByRole("radio", { name: "ISBN" }).check();
    const isbnField = page.getByRole("textbox", { name: "ISBN" });
    await isbnField.fill(isbn);
    await isbnField.press("Enter");
    const isbnResult = page.locator('[data-result-class="validator"][data-research-result-tool="doi-isbn-normalizer"]');
    await isbnResult.getByText("Valido", { exact: true }).waitFor();
    await isbnResult.getByText("9780306406157", { exact: false }).first().waitFor();
  });

  await browser.close();
  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    keyboard: "submit actions exercised via Enter",
    diffSemantics: "visible Invariata/Rimossa/Aggiunta table-state text; not color-only",
    network: "zero external requests and zero task-content-bearing requests after task start",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    tools: [listReceipt, diffReceipt, referenceReceipt],
  };
  const receiptDir = resolve(root, "quality/receipts/text-research");
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log("text/research browser acceptance PASS: 3 tools, keyboard + mobile + non-color diff + zero task-content network");
} finally {
  server.kill("SIGTERM");
}

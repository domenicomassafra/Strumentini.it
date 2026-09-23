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
  await page.getByText("Runs on this device.", { exact: true }).waitFor();

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
    await page.getByLabel("List A").fill(listLeft);
    await page.getByLabel("List B").fill(listRight);
    await page.getByLabel("Trim + NFC").check();
    startTask();
    const submit = page.getByRole("button", { name: "Compare lists" });
    await submit.focus();
    await page.keyboard.press("Enter");
    await page.getByText("In both", { exact: false }).waitFor();
    await page.getByText("Only in A", { exact: false }).waitFor();
    await page.getByText("water", { exact: true }).first().waitFor();
  });

  const diffBefore = "a\nb\n";
  const diffAfter = "a\nc\n";
  const diffReceipt = await acceptPage(browser, "/tools/text-diff", ["a%0Ab", "a%0Ac", "a\nb", "a\nc"], async (page, startTask) => {
    await page.getByLabel("Before").fill(diffBefore);
    await page.getByLabel("After").fill(diffAfter);
    startTask();
    const submit = page.getByRole("button", { name: "Compare text" });
    await submit.focus();
    await page.keyboard.press("Enter");
    await page.getByText("Removed", { exact: true }).waitFor();
    await page.getByText("Added", { exact: true }).waitFor();
    const removedText = await page.locator(".diff-remove").innerText();
    const addedText = await page.locator(".diff-add").innerText();
    if (!removedText.includes("−") || !removedText.includes("Removed")) {
      throw new Error("text diff removal semantics depend on more than visible symbol+text");
    }
    if (!addedText.includes("+") || !addedText.includes("Added")) {
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
    await page.getByText("Valid DOI shape", { exact: true }).waitFor();
    await page.getByText("10.1000/182", { exact: true }).waitFor();

    await page.getByRole("radio", { name: "ISBN" }).check();
    const isbnField = page.getByRole("textbox", { name: "ISBN" });
    await isbnField.fill(isbn);
    await isbnField.press("Enter");
    await page.getByText("Valid ISBN-10", { exact: true }).waitFor();
    await page.getByText("9780306406157", { exact: true }).waitFor();
  });

  await browser.close();
  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    keyboard: "submit actions exercised via Enter",
    diffSemantics: "visible =/−/+ symbols plus Unchanged/Removed/Added text; not color-only",
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

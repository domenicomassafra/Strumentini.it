import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const receiptDir = resolve(root, "quality/receipts/onboarding");
const port = 18400 + (process.pid % 500);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // Retry until the child server has bound its port.
    }
    await sleep(100);
  }
  throw new Error(`Static acceptance server did not become ready at ${origin}`);
}

async function currentRevision() {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  return (await promisify(execFile)("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
}

// Every Gold tool the starter set is allowed to offer, read from the certification index
// that onboarding itself consumes. A starter tool outside this set is a product violation.
async function goldToolIds() {
  const index = JSON.parse(await readFile(resolve(root, "quality/receipts/expanded-catalog-certification.json"), "utf8"));
  return new Set(
    index.tools
      .filter((tool) => typeof tool.certificationReceipt === "string" && tool.goldEligible === true)
      .map((tool) => tool.id),
  );
}

const checks = [];
function record(id, description, observed) {
  checks.push({ id, description, status: "PASS", observed });
}

const revision = await currentRevision();
const gold = await goldToolIds();
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });

try {
  await waitForServer();
  assert(gold.size > 0, "No Gold-certified tool is available to seed a starter set");

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const requests = [];
  const pageErrors = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(`${origin}/onboarding/`, { waitUntil: "networkidle" });
  await page.locator("[data-ready='true']").waitFor();

  // AC-01 / principle 3: onboarding never blocks arrival, and never blocks a job.
  assert(await page.locator("dialog[open], [role='dialog']").count() === 0, "Onboarding opened a blocking dialog on arrival");
  record("no-blocking-modal", "No onboarding dialog blocks arrival", "no dialog element present on load");

  const direct = await context.newPage();
  await direct.goto(`${origin}/tools/business-day/`, { waitUntil: "networkidle" });
  // The tool page declares its own execution contract as data, so this asserts
  // the fact instead of pinning a sentence that is free to change.
  await direct.locator('[data-tool-page="business-day"][data-runtime="LOCAL"][data-network="forbidden"]').waitFor();
  assert(await direct.locator("dialog[open], [role='dialog']").count() === 0, "An onboarding dialog appeared over an unrelated tool task");
  await direct.getByRole("button").first().waitFor();
  record("first-task-uninterrupted", "A tool job stays fully usable without ever completing onboarding", "tool route hydrated with no onboarding interstitial");

  // Stage 1 is the welcome: it asks for nothing, so it must be a single action.
  assert(await page.locator("[data-onboarding-action='start']").isVisible(), "The welcome stage offers no way forward");
  await page.locator("[data-onboarding-action='start']").click();

  // AC-02.1: the flow gates on a real answer rather than pre-selecting for the user.
  const continueButton = page.locator("[data-onboarding-action='continue-context']");
  await continueButton.waitFor();
  assert(await continueButton.isDisabled(), "The work-context stage was continuable with nothing selected");
  await page.locator("[data-context-id]").first().click();
  await continueButton.click();
  record("context-required", "The work-context stage cannot advance until a context is chosen", "Continue stayed disabled until a context was selected");

  await page.locator("#jobs-title").waitFor();
  await page.locator("[data-onboarding-action='continue-jobs']").click();
  record("jobs-stage-traversed", "The recurring-jobs stage is reachable and does not trap the user", "advanced to the review without selecting a job");

  await page.locator("#review-title").waitFor();

  // AC-05: a small, distinct, reviewable set — never the 200-tool catalogue.
  const review = page.locator("[aria-labelledby='review-title']");
  const offeredIds = await review.locator("[data-starter-tool-id]").evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute("data-starter-tool-id")).filter(Boolean),
  );
  assert(offeredIds.length > 0, "Starter review offered no tools");
  assert(offeredIds.length <= 12, `Starter review offered ${offeredIds.length} tools; the starter set must stay small`);
  assert(new Set(offeredIds).size === offeredIds.length, "Starter review offered a duplicate tool");
  record("starter-set-bounded", "The starter review offers a small, distinct, editable set", `${offeredIds.length} starter tool(s): ${offeredIds.join(", ")}`);

  // AC-05.4 / DAG scope integrity: every starter tool must already be Gold.
  const unproven = offeredIds.filter((id) => !gold.has(id));
  assert(unproven.length === 0, `Starter review offered non-Gold tool(s): ${unproven.join(", ")}`);
  record("starter-tools-gold", "Every starter tool is Gold-certified before it can be a default surface", `all ${offeredIds.length} starter tool(s) are Gold in the certification index`);

  const save = page.locator("[data-onboarding-action='save']");
  await save.waitFor();
  assert(await save.isEnabled(), "Save starter set stayed disabled for a valid review");
  await save.click();

  // AC-02.4: the saved set lands in this device's own store, with no account.
  await page.waitForURL(`${origin}/`, { timeout: 15000 });
  const installed = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("utility-workbench", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stored = await new Promise((resolve, reject) => {
      const request = db.transaction("state").objectStore("state").get("workbench/state:v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return Array.isArray(stored?.installedTools) ? stored.installedTools : [];
  });
  assert(installed.length > 0, "No tool was stored locally after onboarding saved a starter set");
  record("starter-persisted-locally", "The saved starter set is stored on this device, with no account", `${installed.length} tool(s) in the local workbench state after save`);

  // DEC-21 / principle 4: onboarding answers never leave the device.
  const offOrigin = requests.filter((request) => !request.url.startsWith(origin));
  assert(offOrigin.length === 0, `Onboarding made an off-origin request: ${offOrigin.map((r) => r.url).join(", ")}`);
  record("no-off-origin-traffic", "Onboarding performs no off-origin network request", "every observed request stayed on the local static origin");

  assert(pageErrors.length === 0, `Onboarding raised page errors: ${pageErrors.join(" | ")}`);
  record("no-page-errors", "Onboarding runs without uncaught page errors", "none observed");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), "Workbench overflowed horizontally at 390px after onboarding");
  record("mobile-usable", "The post-onboarding Workbench is usable at 390px", "no horizontal overflow at 390px");

  await context.close();

  const receipt = {
    schemaVersion: 1,
    kind: "browser-acceptance",
    subject: "onboarding",
    generatedBy: "scripts/acceptance-onboarding.mjs",
    revision,
    status: "PASS",
    browser: "chrome",
    viewport: { width: 1280, height: 900, mobileWidth: 390 },
    checks,
    note: "Local static browser acceptance. No physical-device or deployment evidence is produced here.",
  };
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Onboarding acceptance PASS: ${checks.length} check(s)`);
  for (const check of checks) console.log(`  - ${check.id}: ${check.observed}`);
  console.log("receipt: quality/receipts/onboarding/browser-acceptance.json");
} finally {
  await browser.close();
  server.kill("SIGTERM");
}

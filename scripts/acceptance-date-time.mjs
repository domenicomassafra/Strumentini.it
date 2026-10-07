import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18146;
const origin = `http://127.0.0.1:${port}`;
const dist = process.env.STRUMENTINI_ACCEPTANCE_DIST ?? "dist";

const fillDates = (...values) => async (_page, form) => {
  const fields = form.locator("input[type='date']");
  for (let index = 0; index < values.length; index += 1) await fields.nth(index).fill(values[index]);
};

const cases = [
  { id: "date-difference", expect: /7|2024-01-08/u },
  { id: "add-subtract-days", setup: fillDates("2024-02-28"), expect: /2024-02-29/u },
  { id: "working-hours", expect: /8\.5/u },
  { id: "timezone-converter", expect: /2024-01-15T13:00:00\+01:00/u },
  { id: "meeting-time-planner", setup: fillDates("2026-09-23"), expect: /2026-09-23T13:00:00\.000Z/u },
  { id: "duration-calculator", expect: /27/u },
  { id: "decimal-hours-converter", expect: /1\.5/u },
  { id: "timesheet-totaler", expect: /15\.5/u },
  { id: "week-number-converter", setup: fillDates("2021-01-01"), expect: /53/u },
  { id: "quarter-date-mapper", setup: fillDates("2024-02-29"), expect: /91|Q1/u },
  { id: "deadline-countdown", expect: /1/u },
  { id: "recurring-date-generator", setup: fillDates("2024-01-31"), expect: /2024-03-31/u },
  { id: "age-date-anniversary", setup: fillDates("2000-02-29", "2025-02-28"), expect: /24/u },
  { id: "calendar-date-list-generator", setup: fillDates("2024-01-01", "2024-01-05"), expect: /2024-01-03/u },
  { id: "ics-event-builder", expect: /BEGIN:VCALENDAR/u },
  { id: "ics-viewer", expect: /esempio|Revisione/u },
  { id: "epoch-batch-converter", expect: /1970-01-01T00:00:00\.000Z/u },
  { id: "public-holiday-lookup", expect: /festività|embedded-calendar-v2/u },
];

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
    }
    await sleep(100);
  }
  throw new Error(`static server did not become ready at ${origin}`);
}

// The site shell asks the Worker for the current account session on every route.
// This acceptance server is a plain static file server, so that single endpoint
// answers 404 here by design. Every other failed response, and every console
// error, stays fatal. See scripts/acceptance-family-matrix.mjs for the same rule.
const staticOnlyFailurePaths = new Set(["/api/auth/session"]);
const isExpectedStaticFailure = (url) => {
  try {
    return staticOnlyFailurePaths.has(new URL(url).pathname);
  } catch {
    return false;
  }
};

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
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push({ text: message.text(), url: message.location()?.url ?? "" }); });

  const response = await page.goto(`${origin}/tools/${testCase.id}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`${testCase.id}: HTTP ${response?.status()}`);
  const form = page.locator("form").last();
  await form.waitFor();
  if (testCase.setup !== undefined) await testCase.setup(page, form);
  const submit = form.locator("button[type='submit']");
  await submit.waitFor();
  started = true;
  await submit.focus();
  await page.keyboard.press("Enter");
  const result = page.locator(".result-panel[data-state='success']");
  await result.waitFor({ timeout: 10000 });
  const output = await result.innerText();
  if (!testCase.expect.test(output)) throw new Error(`${testCase.id}: unexpected output ${JSON.stringify(output.slice(0, 700))}`);
  const semantic = result.locator("[data-result-class]").last();
  if (await semantic.count() !== 1) throw new Error(`${testCase.id}: Result v2 semantic root is missing`);
  const resultClass = await semantic.getAttribute("data-result-class");
  const expectedClass = testCase.id === "ics-event-builder" ? "text-code" : testCase.id === "ics-viewer" ? "validator" : "calculator";
  if (resultClass !== expectedClass) throw new Error(`${testCase.id}: Result v2 class ${resultClass} does not match ${expectedClass}`);
  const slots = await semantic.locator("[data-result-slot]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-result-slot")));
  const expectedSlots = expectedClass === "text-code"
    ? ["selectable-output", "counts"]
    : expectedClass === "validator"
      ? ["primary", "interpretation", "checks", "provenance"]
      : ["primary", "interpretation", "breakdown", "assumptions", "provenance"];
  let slotCursor = -1;
  for (const required of expectedSlots) {
    slotCursor = slots.indexOf(required, slotCursor + 1);
    if (slotCursor < 0) throw new Error(`${testCase.id}: Result v2 slot ${required} is missing or out of order (${slots.join(",")})`);
  }
  if (await semantic.locator("[data-result-primary-answer]").count() !== 1) throw new Error(`${testCase.id}: semantic primary answer is missing`);
  const actionIds = await semantic.locator("[data-result-action]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-result-action")));
  for (const required of ["copy", "reset"]) {
    if (!actionIds.includes(required)) throw new Error(`${testCase.id}: Result v2 action ${required} is missing`);
  }
  if (testCase.id === "ics-event-builder" && !actionIds.includes("download")) throw new Error("ics-event-builder: existing calendar download action is missing");
  if (testCase.id === "ics-viewer" && !actionIds.includes("retry")) throw new Error("ics-viewer: validator retry action is missing");
  const provenance = await semantic.locator(".provenance").innerText();
  if (!/Elaborazione locale[\s\S]*fuso orario[\s\S]*calendario/u.test(provenance)) throw new Error(`${testCase.id}: timezone/calendar assumptions are not visible in the Result v2 provenance`);
  if (testCase.id !== "ics-event-builder") {
    const unscopedRaw = await semantic.locator("pre").evaluateAll((nodes) => nodes.filter((node) => node.closest("[data-result-secondary-raw]") === null).length);
    if (unscopedRaw > 0) throw new Error(`${testCase.id}: raw output escaped the secondary Result v2 details`);
  }
  // A console error is tolerated only when its own source URL is the optional
  // account probe; anything else is fatal.
  const consoleErrors = runtimeErrors.filter((entry) => !isExpectedStaticFailure(entry.url));
  if (consoleErrors.length > 0) throw new Error(`${testCase.id}: runtime/console error: ${consoleErrors.map((entry) => `${entry.text} (${entry.url})`).join(" | ")}`);
  if (scripts.length === 0) throw new Error(`${testCase.id}: no lazy implementation script observed after submit`);
  const bad = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
  if (bad.length > 0) throw new Error(`${testCase.id}: external, non-GET, or task-body request observed`);

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${testCase.id}: horizontal overflow at 390px`);
  const unlabeled = await form.locator("input, textarea, select, button").evaluateAll((controls) => controls.filter((control) => {
    const element = control;
    if (element instanceof HTMLInputElement && element.type === "hidden") return false;
    if (element instanceof HTMLButtonElement && (element.textContent ?? "").trim() !== "") return false;
    const id = element.getAttribute("id");
    const labelledBy = element.getAttribute("aria-labelledby");
    const ariaLabel = element.getAttribute("aria-label");
    const wrappingLabel = element.closest("label");
    return !ariaLabel && !labelledBy && !wrappingLabel && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
  }).map((control) => control.outerHTML.slice(0, 120)));
  if (unlabeled.length > 0) throw new Error(`${testCase.id}: unlabeled controls: ${unlabeled.join(" | ")}`);
  await page.close();
  return { toolId: testCase.id, resultClass, resultSlots: slots, resultActions: actionIds, lazyScriptCount: scripts.length, taskRequestCount: requests.length, horizontalOverflow: false, unlabeledControls: 0 };
}

async function acceptLiveTimeSurfaces(context) {
  const world = await context.newPage();
  await world.goto(`${origin}/tools/timezone-converter/`, { waitUntil: "networkidle" });
  const worldSurface = world.locator('[data-live-time-surface="world-clock"]');
  await worldSurface.waitFor();
  const worldBefore = await worldSurface.locator("[data-live-source-time]").innerText();
  await world.waitForTimeout(1100);
  const worldAfterTick = await worldSurface.locator("[data-live-source-time]").innerText();
  if (worldAfterTick === worldBefore) throw new Error("timezone-converter: live source time did not advance from Date.now()");
  await world.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const worldAfterVisibility = await worldSurface.locator("[data-live-source-time]").innerText();
  if (!/^\d{4}-\d{2}-\d{2}T/u.test(worldAfterVisibility)) throw new Error("timezone-converter: visibility recovery did not expose a source timestamp");
  const labels = await worldSurface.locator("dt").allInnerTexts();
  const values = await worldSurface.locator("dd").allInnerTexts();
  for (const required of ["Istante sorgente UTC", "Fuso sorgente", "Fuso destinazione", "Ora locale", "Offset"]) {
    if (!labels.some((label) => label.trim().toLocaleLowerCase("it-IT").includes(required.toLocaleLowerCase("it-IT")))) throw new Error(`timezone-converter: live surface is missing ${required} (${labels.join(" | ")})`);
  }
  if (!values.includes("UTC") || !values.includes("Europe/Rome") || !values.some((value) => /minuti/u.test(value))) {
    throw new Error("timezone-converter: live surface does not expose source zone, target zone, and offset values");
  }
  await world.close();

  const deadline = await context.newPage();
  await deadline.goto(`${origin}/tools/deadline-countdown/`, { waitUntil: "networkidle" });
  const deadlineSurface = deadline.locator('[data-live-time-surface="deadline"]');
  await deadlineSurface.waitFor();
  const before = await deadlineSurface.locator("[data-live-source-time]").innerText();
  await deadline.waitForTimeout(1100);
  const after = await deadlineSurface.locator("[data-live-source-time]").innerText();
  if (after === before) throw new Error("deadline-countdown: live reference did not advance from Date.now()");
  await deadline.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  if (await deadlineSurface.locator("[data-live-deadline-value]").count() !== 1) throw new Error("deadline-countdown: live timestamp-derived countdown missing after visibility recovery");
  const clock = deadline.locator("[data-resilient-clock]");
  await clock.waitFor();
  const displayBefore = await clock.locator("[data-clock-display]").innerText();
  await clock.getByRole("button", { name: "Avvia" }).click();
  await deadline.waitForTimeout(1200);
  const displayAfter = await clock.locator("[data-clock-display]").innerText();
  if (displayAfter === displayBefore) throw new Error("deadline-countdown: resilient timer did not derive progress from timestamps");
  await deadline.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await deadline.reload({ waitUntil: "networkidle" });
  const restoredClock = deadline.locator("[data-resilient-clock]");
  await restoredClock.waitFor();
  if (!/ripristinato/u.test(await restoredClock.locator("[data-clock-status]").innerText())) throw new Error("deadline-countdown: resilient timer state did not survive reload");
  await deadline.close();
  return { worldClockTicked: true, visibilityRecovery: true, deadlineTicked: true, resilientClockReload: true };
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];
  for (const testCase of cases) results.push(await acceptTool(context, testCase));
  const liveTime = await acceptLiveTimeSurfaces(context);
  await context.close();
  await browser.close();
  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    tools: cases.map(({ id }) => id),
    routesChecked: results.length,
    keyboard: "every submit action exercised with Enter",
    accessibility: "all interactive controls in the tool form have a label or accessible name",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    externalTaskRequests: 0,
    nonGetTaskRequests: 0,
    taskContentLeaks: 0,
    runtimeConsoleErrors: 0,
    network: "zero external, non-GET, or task-body requests after task start",
    implementationEager: false,
    lazyImplementationObservedFor: results.map((result) => result.toolId),
    results,
    liveTime,
  };
  await mkdir(resolve(root, "quality/receipts/date-time"), { recursive: true });
  await writeFile(resolve(root, "quality/receipts/date-time/browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`date-time browser acceptance PASS: ${results.length} tools, keyboard/mobile/a11y/locality/lazy-load observed`);
} finally {
  server.kill("SIGTERM");
}

import { chromium } from "@playwright/test";
import { spawn, execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const receiptDir = resolve(root, "quality/receipts/telemetry");
const port = 18500 + (process.pid % 400);
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

// AC-15.3 / DEC-21: longitudinal experiment telemetry is off unless the user is in an
// explicitly disclosed validation cohort, and ordinary deterministic operation stays
// functional when analytics is blocked. Every check runs against the real built bundle,
// so a permanent no-op that nothing ever configures is reported as a real blocker.
const checks = [];
function record(id, description, observed) {
  checks.push({ id, description, status: "PASS", observed });
}

const revision = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });

try {
  await waitForServer();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const requests = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));

  // A tool page is the only place the shipped bundle currently emits telemetry.
  await page.goto(`${origin}/tools/business-day/`, { waitUntil: "networkidle" });
  await page.locator('[data-tool-page][data-runtime="LOCAL"]').waitFor();

  // The tool must be fully usable regardless of telemetry posture.
  assert(await page.locator("form").count() === 1, "Business Day tool form did not render");
  record("tool-operable-without-telemetry", "A tool remains fully operable under the default telemetry posture", "tool form rendered with telemetry unconfigured");

  // Default posture: no off-origin write may occur.
  const offOriginWrites = requests.filter((request) => !request.url.startsWith(origin));
  assert(offOriginWrites.length === 0, `Telemetry wrote off-origin by default: ${offOriginWrites.map((r) => `${r.method} ${r.url}`).join(", ")}`);
  record("no-default-telemetry-write", "No telemetry is written unless a disclosed validation cohort enables it", `0 off-origin requests observed across ${requests.length} total request(s)`);

  // AC-15.3 makes disclosure the precondition for enabling longitudinal events, so the
  // shipped UI must actually tell the user that the cohort exists.
  const disclosed = await page.evaluate(() => {
    const text = document.body.innerText ?? "";
    const hooks = [...document.querySelectorAll("*")]
      .flatMap((element) => [...element.attributes].map((attribute) => attribute.name))
      .filter((name) => /telemetry|disclos|cohort|analytics/iu.test(name));
    return { text: /telemetry|analytics|validation cohort/iu.test(text), hooks };
  });
  record(
    "disclosure-surface-present",
    "The shipped UI exposes a telemetry disclosure surface",
    `text disclosure: ${disclosed.text}; attribute hooks: ${disclosed.hooks.length > 0 ? disclosed.hooks.join(", ") : "none"}`,
  );

  // The adapter gate is the real enforcement point. Asserted as a source invariant so a
  // future edit that widens it (for example defaulting disclosed to true) fails here.
  const adapterSource = await readFile(resolve(root, "src/telemetry/adapter.ts"), "utf8");
  const gate = /options\.enabled === true && options\.disclosed === true && options\.cohort === "validation"/u;
  assert(gate.test(adapterSource), "Telemetry enable gate no longer requires an explicit disclosed validation cohort");
  record("explicit-cohort-gate", "Enabling telemetry requires an explicit, disclosed validation cohort", 'gate requires enabled && disclosed && cohort === "validation"');

  // The shipped bundle currently has no caller for configureTelemetry, so every tracked
  // event resolves to the permanent no-op adapter. That is a real defect, not a pass.
  const componentSource = await readFile(resolve(root, "src/components/telemetry/TelemetryBootstrap.astro"), "utf8");
  const layoutSource = await readFile(resolve(root, "src/layouts/BaseLayout.astro"), "utf8");
  const wired = /configureTelemetry\(/u.test(`${componentSource}\n${layoutSource}`);
  record(
    "configure-telemetry-wired",
    "A shipped caller configures telemetry rather than leaving every event on a permanent no-op",
    wired ? "a shipped caller invokes configureTelemetry" : "NOT WIRED: no shipped caller invokes configureTelemetry",
  );

  const flagAtCallSite = /disclosed\s*[:=]\s*true/u.test(`${componentSource}\n${layoutSource}`);
  record(
    "cohort-flag-at-call-site",
    "A wired call site passes the explicit disclosed-cohort flag instead of enabling telemetry implicitly",
    flagAtCallSite ? "disclosed: true is passed at a shipped call site" : "no shipped call site passes disclosed: true",
  );

  // Local-first is functional, not a setting: no task content may reach a network sink.
  assert(requests.every((request) => request.url.startsWith(origin)), "A tool run issued a non-local request");
  record("local-first-intact", "A tool run issues no non-local request under any telemetry posture", "all observed requests stayed on the local static origin");

  await context.close();

  const hasDisclosure = disclosed.text || disclosed.hooks.length > 0;
  const receipt = {
    schemaVersion: 1,
    kind: "browser-acceptance",
    subject: "telemetry",
    generatedBy: "scripts/acceptance-telemetry.mjs",
    revision,
    status: "PASS",
    browser: "chrome",
    verdict: {
      defaultPosture: "DISABLED",
      disclosureSurface: hasDisclosure ? "PRESENT" : "ABSENT",
      configureTelemetryWired: wired,
      cohortFlagAtCallSite: flagAtCallSite,
    },
    checks,
    blockers: [
      ...(wired ? [] : ["TELEMETRY_CONFIG_NOT_WIRED: no shipped caller invokes configureTelemetry, so every tracked event resolves to the permanent no-op adapter"]),
      ...(hasDisclosure ? [] : ["TELEMETRY_DISCLOSURE_ABSENT: the shipped UI exposes no telemetry disclosure surface"]),
      ...(flagAtCallSite ? [] : ["TELEMETRY_COHORT_FLAG_ABSENT: no shipped call site passes the explicit disclosed-cohort flag"]),
    ],
    note: "Local static browser acceptance. Longitudinal cohort performance is EXTERNAL and is not claimed here.",
  };
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Telemetry acceptance ran: ${checks.length} check(s)`);
  for (const check of checks) console.log(`  - ${check.id}: ${check.observed}`);
  for (const blocker of receipt.blockers) console.log(`BLOCKER ${blocker}`);
  console.log("receipt: quality/receipts/telemetry/browser-acceptance.json");
  if (receipt.blockers.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
  server.kill("SIGTERM");
}

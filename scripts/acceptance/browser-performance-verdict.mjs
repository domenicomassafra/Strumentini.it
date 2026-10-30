import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The browser command must fail when any observed release prerequisite is not PASS.
// A complete matrix and sibling suite are required: missing evidence cannot pass.
export const SIBLING_ACCEPTANCE = [
  { command: "npm run acceptance:browser", script: "scripts/browser-acceptance.mjs" },
  { command: "npm run acceptance:onboarding", script: "scripts/acceptance-onboarding.mjs" },
  { command: "npm run acceptance:telemetry", script: "scripts/acceptance-telemetry.mjs" },
  { command: "node scripts/acceptance-text-research.mjs", script: "scripts/acceptance-text-research.mjs" },
  { command: "node scripts/acceptance-campaign-url.mjs", script: "scripts/acceptance-campaign-url.mjs" },
  { command: "node scripts/acceptance-client-time-math.mjs", script: "scripts/acceptance-client-time-math.mjs" },
  { command: "npm run acceptance:business-math", script: "scripts/acceptance-business-math.mjs" },
  { command: "npm run acceptance:developer-web", script: "scripts/acceptance-developer-web.mjs" },
  { command: "node scripts/acceptance-directory.mjs", script: "scripts/acceptance-directory.mjs" },
  { command: "node scripts/acceptance-table-handoff.mjs", script: "scripts/acceptance-table-handoff.mjs" },
  { command: "node scripts/acceptance-file-hash.mjs", script: "scripts/acceptance-file-hash.mjs" },
];

export function browserMatrixIsSuccessful(receipt, requiredEngineNames, requiredAcceptanceCommands) {
  const engines = receipt?.browserMatrix?.requestedEngines;
  const acceptance = receipt?.freshAcceptance;
  const required = new Set(requiredEngineNames);
  const commands = new Set(requiredAcceptanceCommands);
  return required.size > 0 && required.size === requiredEngineNames.length
    && Array.isArray(engines) && engines.length === required.size
    && new Set(engines.map((engine) => engine.engine)).size === required.size
    && engines.every((engine) => required.has(engine.engine) && engine.status === "PASS")
    && commands.size > 0 && commands.size === requiredAcceptanceCommands.length
    && Array.isArray(acceptance) && acceptance.length === commands.size
    && new Set(acceptance.map((check) => check.command)).size === commands.size
    && acceptance.every((check) => commands.has(check.command) && check.status === "PASS");
}

const REQUIRED_ENGINES = ["chrome", "edge", "chromium", "firefox", "webkit"];
const REQUIRED_ACCEPTANCE = [
  "npm run build",
  ...REQUIRED_ENGINES.map((name) => `node scripts/acceptance/browser-performance-matrix.mjs (${name})`),
  ...SIBLING_ACCEPTANCE.map(({ command }) => command),
];

/** Require the complete expected matrix, and report every observed rejection. */
export function browserPerformanceVerdict(report, requiredEngines = REQUIRED_ENGINES, requiredAcceptance = REQUIRED_ACCEPTANCE) {
  const failures = [];
  if (report?.staticInspection?.lazyEngineGate !== "PASS") failures.push("static:lazy-engine");
  if (report?.staticInspection?.bundleBaseline?.gate !== "PASS") failures.push("static:bundle-baseline");
  const engines = report?.browserMatrix?.requestedEngines;
  if (!Array.isArray(engines) || engines.length === 0) failures.push("browser:missing");
  else for (const engine of engines) {
    if (engine?.status !== "PASS") failures.push(`browser:${engine?.engine ?? "unknown"}:${engine?.status ?? "NOT_RUN"}`);
  }
  const acceptance = report?.freshAcceptance;
  if (!Array.isArray(acceptance) || acceptance.length === 0) failures.push("acceptance:missing");
  else for (const check of acceptance) {
    if (check?.status !== "PASS") failures.push(`acceptance:${check?.command ?? "unknown"}:${check?.status ?? "NOT_RUN"}`);
  }
  if (!browserMatrixIsSuccessful(report, requiredEngines, requiredAcceptance) && failures.length === 0) {
    failures.push("browser-or-acceptance:incomplete");
  }
  return { status: failures.length === 0 ? "PASS" : "NO_GO", failureCount: failures.length, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const receipt = process.argv[2];
  if (!receipt) {
    process.stderr.write("Usage: node browser-performance-verdict.mjs receipt.json\n");
    process.exitCode = 2;
  } else {
    try {
      const verdict = browserPerformanceVerdict(JSON.parse(await readFile(receipt, "utf8")));
      console.log(JSON.stringify(verdict));
      if (verdict.status !== "PASS") process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`Browser-performance verdict unavailable: ${String(error)}\n`);
      process.exitCode = 2;
    }
  }
}

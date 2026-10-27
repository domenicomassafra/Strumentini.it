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

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SIBLING_ACCEPTANCE } from "./browser-performance-verdict.mjs";
export { SIBLING_ACCEPTANCE };

// Report the actual exit status of every sibling command from this run;
// missing scripts cannot inherit a historical PASS.

export async function runSiblingAcceptance(root) {
  const entries = [];
  for (const { command, script } of SIBLING_ACCEPTANCE) {
    const path = resolve(root, script);
    if (!existsSync(path)) {
      entries.push({ command, status: "NOT_RUN", evidence: `${script} does not exist` });
      continue;
    }
    const outcome = await new Promise((resolveOutcome) => {
      const child = spawn(process.execPath, [script], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { output += chunk; });
      child.on("close", (code) => resolveOutcome({ code, output }));
      child.on("error", (error) => resolveOutcome({ code: null, output: String(error) }));
    });
    const summary = outcome.output.trim().split("\n").filter(Boolean).slice(-1)[0] ?? "";
    entries.push({
      command,
      status: outcome.code === 0 ? "PASS" : "FAIL",
      evidence: summary.length > 0 ? summary.slice(0, 300) : `exit ${outcome.code}`,
    });
  }
  return entries;
}

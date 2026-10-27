/**
 * #404 Git-aware, source-only change gate. This is NOT release certification:
 * manual security, browser, physical-device and official-source proof remains
 * NOT_RUN until independently verified. Labels are deliberately not inputs.
 *
 * Usage:
 *   npm run ci:scope -- --base=<commit/ref> [--head=HEAD] [--run]
 *   npm run ci:scope -- --base=<commit/ref> --run --require-release-ready
 *
 * --run checks changed source; --require-release-ready adds the cumulative,
 * read-only release validator. It cannot invent receipts or waive blockers.
 */
import { execFile, spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

import { classifyPath, shippedOcrRuntimeAsset } from "./ci-path-classification-404";
import type { ChangeDomain } from "./ci-path-classification-404";
export { classifyPath } from "./ci-path-classification-404";
export type { ChangeDomain } from "./ci-path-classification-404";
export type GateId = "security-review" | "d1-migration-review" | "auth-integration" | "physical-device" | "official-source-year" | "browser-a11y" | "release-readiness";
export type SourceCommand = { readonly program: string; readonly args: readonly string[] };
export type ImpactPlan = {
  readonly schemaVersion: 1;
  readonly status: "NO_CHANGES" | "DOCS_ONLY" | "SOURCE_CHECKS_REQUIRED" | "NO_GO";
  readonly paths: readonly string[];
  readonly domains: readonly ChangeDomain[];
  readonly selectedTests: readonly string[];
  readonly commands: readonly SourceCommand[];
  readonly gates: readonly { readonly id: GateId; readonly status: "NOT_RUN"; readonly reason: string }[];
  readonly blockers: readonly string[];
};

const domainOrder: readonly ChangeDomain[] = ["docs", "frontend", "shared", "spreadsheet", "worker-auth", "d1", "pdf", "image", "italy", "ci", "unknown"];
const allGates: readonly GateId[] = [
  "security-review", "d1-migration-review", "auth-integration", "physical-device", "official-source-year", "browser-a11y", "release-readiness",
];

const gateReasons: Record<GateId, string> = {
  "security-review": "Independent auth, privacy and abuse/security verification; selected unit tests are insufficient.",
  "d1-migration-review": "D1 migration compatibility, rollback and existing-state proof; no database is migrated here.",
  "auth-integration": "Actual auth Worker integration acceptance against an isolated local D1 state.",
  "physical-device": "Real mobile-device and browser acceptance receipts; simulated or desktop-only tests do not substitute.",
  "official-source-year": "Independent dated primary-source review for Italian fiscal/legal assumptions.",
  "browser-a11y": "Real browser, mobile and WCAG 2.2 AA regression acceptance.",
  "release-readiness": "Cumulative npm test/check/build plus non-writing release validator --require-ready before publication.",
};

const requiredSpreadsheetSuites = ["tests/spreadsheet-interchange.test.ts", "tests/donor-spreadsheets-370.test.ts"] as const;

const familyTestMatchers: Partial<Record<ChangeDomain, RegExp>> = {
  "worker-auth": /^tests\/(auth-worker|auth-worker-cloudflare-kdf-328|auth-password-race-328|auth-csrf-328|password-kdf-328|staging-isolation-328|deploy-staging-328|feasibility-server-optin-348|google-auth-worker|turnstile-worker|vies-worker|current-revision-worker-347|release-validation)\.test\.ts$/u,
  d1: /^tests\/(auth-worker|auth-worker-cloudflare-kdf-328|auth-password-race-328|auth-csrf-328|password-kdf-328|staging-isolation-328|deploy-staging-328|feasibility-server-optin-348|google-auth-worker|turnstile-worker|vies-worker|current-revision-worker-347|release-validation)\.test\.ts$/u,
  // Prefix families alone are not enough: real suites for an engine do not
  // always share its filename prefix. Each added alternative below is an
  // existing suite that directly reads the named engine or script, so an
  // affected change must run it (AC-404.1). Selection only ever grows.
  pdf: /^tests\/(pdf-|ocr-|ooxml-|printable-pdf|forensic-redaction-|audit-pdf-engine-provenance-)/u,
  image: /^tests\/(image-|svg-|metadata-)/u,
  italy: /^tests\/(italy-|italian-|vies-|codice-fiscale-|partita-iva-|stipendio-netto-|fatturapa-|inps-|irpef-|tax-|audit-397)/u,
  spreadsheet: /^tests\/(?:spreadsheet-interchange|donor-spreadsheets-370|xml-interchange|pdf-table-xlsx-254|ooxml-[^/]+)\.test\.ts$/u,
};

export function buildImpactPlan(changedPaths: readonly string[], availableTests: readonly string[]): ImpactPlan {
  const paths = [...new Set(changedPaths)].sort();
  const domains = [...new Set(paths.flatMap((path) => classifyPath(path)))].sort((a, b) => domainOrder.indexOf(a) - domainOrder.indexOf(b));
  const blockers: string[] = [];
  for (const path of paths) if (classifyPath(path).includes("unknown")) blockers.push(`UNKNOWN_CHANGE_PATH: ${JSON.stringify(path)}`);
  const sourceDomains = domains.filter((domain) => domain !== "docs" && domain !== "unknown");
  const needsFullSuite = sourceDomains.some((domain) => ["shared", "frontend", "ci"].includes(domain));
  const tests = new Set<string>();
  if (sourceDomains.length > 0) {
    if (!availableTests.includes("tests/release-validation.test.ts")) blockers.push("MISSING_GATE_SUITE: tests/release-validation.test.ts");
    else tests.add("tests/release-validation.test.ts");
    for (const domain of sourceDomains) {
      const matcher = familyTestMatchers[domain];
      if (!matcher) continue;
      const matches = availableTests.filter((path) => matcher.test(path) && path.endsWith(".test.ts"));
      if (matches.length === 0) blockers.push(`MISSING_AFFECTED_SUITE: ${domain}`);
      for (const path of matches) tests.add(path);
    }
    // Parser plus independent hostile-workbook donor probes are inseparable:
    // selecting a different OOXML test cannot substitute for either suite.
    if (sourceDomains.includes("spreadsheet")) {
      for (const suite of requiredSpreadsheetSuites) {
        if (!availableTests.includes(suite)) blockers.push(`MISSING_AFFECTED_SUITE: ${suite}`);
      }
    }
  }
  const selectedTests = [...tests].sort();
  const gates = new Set<GateId>();
  if (sourceDomains.length > 0) gates.add("release-readiness");
  if (domains.includes("frontend")) gates.add("browser-a11y");
  if (domains.includes("worker-auth") || domains.includes("d1") || domains.includes("ci") || domains.includes("spreadsheet")) gates.add("security-review");
  if (paths.some((path) => /^src\/(runtime\/(file-detection|file-threat-gate-407|artifact-verifier|binary-handoff|ephemeral-file-handoff-337)|telemetry\/consent)/u.test(path))) gates.add("security-review");
  // Privacy-sensitive byte/storage boundaries must not silently inherit only
  // the generic shared or image/frontend gate. Passing tests here never
  // substitutes for a separate inspection of what leaves the user's device.
  if (paths.some((path) => /^src\/(workbench\/saved-pdf-341\.ts|runtime\/(browser-download-339|download-policy-339)\.ts|engines\/image\/(strip-metadata|metadata)\.ts|engines\/file-privacy\/[^/]+|components\/tools\/image-visual\/ExifRemoverTool\.tsx)$/u.test(path))) {
    gates.add("security-review");
  }
  // This engine promises irreversible erasure, unlike a visual PDF overlay.
  // Source changes must never ship solely on generic PDF/device tests.
  if (paths.includes("src/engines/pdf/secure-raster-redaction-237.ts")) gates.add("security-review");
  if (paths.some((path) => path === "scripts/forensic-redaction-378.ts" || path === "tests/forensic-redaction-378.test.ts")) gates.add("security-review");
  // File-byte processors, private in-memory result chains, and UI entrypoints
  // that now initiate consent-controlled browser downloads also need their
  // own independent privacy/security review; source tests alone are not proof.
  if (paths.some((path) => /^src\/(?:runtime\/batch-file-410\.ts|workbench\/session-history-340\.ts|components\/(?:workbench\/SessionChain340\.tsx|lab\/BatchGzipLab410\.astro|tools\/(?:image-visual\/ImageVisualTool|pdf\/PdfTool)\.tsx))$/u.test(path))) {
    gates.add("security-review");
  }
  // Never treat vendored OCR script/WASM or its loadable language payload as
  // an ordinary visual asset: the user runs these third-party bytes locally.
  if (paths.some((path) => shippedOcrRuntimeAsset.test(path) || path.startsWith("src/engines/ocr/") || path.startsWith("src/components/tools/ocr246/"))) {
    gates.add("security-review");
  }
  if (domains.includes("worker-auth") || domains.includes("d1")) gates.add("auth-integration");
  if (domains.includes("d1")) gates.add("d1-migration-review");
  if (domains.includes("pdf") || domains.includes("image") || domains.includes("spreadsheet")) gates.add("physical-device");
  if (paths.some((path) => /^src\/(workbench\/saved-pdf-341\.ts|runtime\/(browser-download-339|download-policy-339)\.ts)$/u.test(path))) gates.add("physical-device");
  if (domains.includes("italy")) gates.add("official-source-year");
  const commands: SourceCommand[] = [];
  if (sourceDomains.length > 0 && blockers.length === 0) {
    // Selected Vitest suites bypass `npm test`; build ignored catalog modules
    // before imports on a fresh CI checkout (same reviewed #404 PR #11 fix).
    if (!needsFullSuite) commands.push({ program: "npm", args: ["run", "catalog:build"] });
    if (needsFullSuite) commands.push({ program: "npm", args: ["run", "test"] });
    else commands.push({ program: "node", args: ["node_modules/vitest/vitest.mjs", "run", ...selectedTests] });
    // The workerd project uses a separate Vite config and real local D1/DO;
    // it cannot run in the normal Node Vitest pool selected above.
    if (domains.includes("worker-auth") || domains.includes("d1")) {
      commands.push({ program: "npm", args: ["run", "test:workerd"] });
    }
    commands.push({ program: "npm", args: ["run", "check"] }, { program: "npm", args: ["run", "build"] });
  }
  const status: ImpactPlan["status"] = blockers.length ? "NO_GO" :
    paths.length === 0 ? "NO_CHANGES" : sourceDomains.length === 0 ? "DOCS_ONLY" : "SOURCE_CHECKS_REQUIRED";
  return {
    schemaVersion: 1, status, paths, domains, selectedTests, commands,
    gates: allGates.filter((id) => gates.has(id)).map((id) => ({ id, status: "NOT_RUN" as const, reason: gateReasons[id] })),
    blockers,
  };
}

const gitArgs = { cwd: "", encoding: "buffer" as const, maxBuffer: 16 * 1024 * 1024 };
async function git(root: string, args: readonly string[]): Promise<Buffer> {
  const result = await execFileAsync("git", [...args], { ...gitArgs, cwd: root });
  return result.stdout;
}

function nullPaths(buffer: Buffer): string[] {
  // -z is vital: Git filenames may contain spaces, newlines, tabs or Unicode.
  return buffer.toString("utf8").split("\0").filter(Boolean);
}

async function commitId(root: string, ref: string): Promise<string> {
  if (!ref || ref.startsWith("-") || /[\u0000-\u001f\u007f]/u.test(ref)) throw new Error("Invalid Git reference");
  const value = (await git(root, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`])).toString("utf8").trim();
  if (!/^[0-9a-f]{40,64}$/u.test(value)) throw new Error("Git commit could not be resolved");
  return value;
}

/** Union of both commits plus index, working tree and untracked files. Renames
 * are split into deletion/addition so moving worker/auth.ts to docs/ is NOT a
 * docs-only change. Unknown paths and unavailable Git history fail closed.
 */
export async function collectGitChanges(root: string, baseRef: string, headRef = "HEAD"): Promise<string[]> {
  const base = await commitId(root, baseRef);
  const head = await commitId(root, headRef);
  const [range, local, untracked] = await Promise.all([
    git(root, ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--name-only", "-z", base, head, "--"]),
    git(root, ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--name-only", "-z", "HEAD", "--"]),
    git(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  return [...new Set([...nullPaths(range), ...nullPaths(local), ...nullPaths(untracked)])].sort();
}

async function execute(command: SourceCommand, root: string): Promise<void> {
  await new Promise<void>((ok, reject) => {
    const child = spawn(command.program, [...command.args], { cwd: root, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? ok() : reject(new Error(`Check failed: ${command.program} ${command.args.join(" ")} (exit=${String(code)}, signal=${String(signal)})`)));
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: npm run ci:scope -- --base=<git-ref> [--head=<git-ref>] [--run] [--require-release-ready]\nGit-aware source scope; mandatory manual release gates remain NOT_RUN.");
    return;
  }
  try {
    const supported = args.every((arg) => arg.startsWith("--base=") || arg.startsWith("--head=") || arg === "--run" || arg === "--require-release-ready");
    if (!supported || args.filter((arg) => arg.startsWith("--base=")).length !== 1 || args.filter((arg) => arg.startsWith("--head=")).length > 1) {
      throw new Error("Explicit one --base=<ref> is required; unknown/duplicate CLI options are rejected");
    }
    if (args.includes("--require-release-ready") && !args.includes("--run")) throw new Error("--require-release-ready requires --run");
    const root = process.cwd();
    const base = args.find((arg) => arg.startsWith("--base="))!.slice(7);
    const head = args.find((arg) => arg.startsWith("--head="))?.slice(7) ?? "HEAD";
    const changes = await collectGitChanges(root, base, head);
    const availableTests = (await readdir(resolve(root, "tests"))).filter((path) => path.endsWith(".test.ts")).map((path) => `tests/${path}`);
    const plan = buildImpactPlan(changes, availableTests);
    if (plan.status === "NO_GO") {
      console.log(JSON.stringify({ ...plan, base, head, sourceCheckStatus: "NOT_RUN" }, null, 2));
      process.exitCode = 2;
      return;
    }
    if (args.includes("--run")) {
      for (const command of plan.commands) await execute(command, root);
      if (args.includes("--require-release-ready")) {
        // Even docs-only PRs cannot use their label to skip a release gate.
        if (plan.commands.length === 0 || !plan.commands.some((command) => command.args.includes("test"))) {
          await execute({ program: "npm", args: ["run", "test"] }, root);
          await execute({ program: "npm", args: ["run", "check"] }, root);
          await execute({ program: "npm", args: ["run", "build"] }, root);
        } else if (!plan.commands.some((command) => command.program === "npm" && command.args.includes("test"))) {
          await execute({ program: "npm", args: ["run", "test"] }, root);
        }
        // Bind even the explicit source CLI's required admission to the exact
        // checked-out commit; a changed HEAD, PR ref or dirty tree cannot be
        // silently treated as a release candidate.
        const pinnedSha = await commitId(root, "HEAD");
        await execute({ program: "node", args: ["node_modules/tsx/dist/cli.mjs", "scripts/validate-release.ts", "--no-write-receipt", "--require-ready", `--expected-sha=${pinnedSha}`] }, root);
      }
    }
    const releaseValidated = args.includes("--require-release-ready");
    console.log(JSON.stringify({
      ...plan, base, head,
      gates: plan.gates.map((gate) => gate.id === "release-readiness" && releaseValidated ? { ...gate, status: "PASS" } : gate),
      sourceCheckStatus: args.includes("--run") ? plan.commands.length > 0 ? "PASS" : "NOT_APPLICABLE" : "NOT_RUN",
      releaseReadinessStatus: releaseValidated ? "PASS" : "NOT_RUN",
      note: "Source checks alone cannot certify security, physical-device, browser, fiscal authority or publication. Independent gates remain NOT_RUN until evidenced.",
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ schemaVersion: 1, status: "NO_GO", reason: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

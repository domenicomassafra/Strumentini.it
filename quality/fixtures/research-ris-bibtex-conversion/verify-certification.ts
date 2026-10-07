import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import manifest from "../../../src/tools/ris-bibtex-converter/manifest";
import toolModule from "../../../src/tools/ris-bibtex-converter/module";

interface OracleEntry {
  readonly id: string;
  readonly maintenance_class: string;
  readonly confidence: string;
  readonly unresolved_gaps?: readonly string[];
}

interface FixtureEntry {
  readonly id: string;
  readonly path: string;
}

interface BrowserResult {
  readonly toolId: string;
  readonly status: string;
  readonly lazyScriptCount: number;
  readonly externalTaskRequests: number;
  readonly nonGetTaskRequests: number;
  readonly taskContentLeaks: number;
  readonly runtimeErrors: number;
  readonly horizontalOverflow: boolean;
  readonly unlabeledControls: number;
  readonly publicErrorCopy: string;
  readonly boundaryState: string;
}

const root = resolve(import.meta.dirname, "../../..");
const oracleRegistry = JSON.parse(readFileSync(resolve(root, "quality/oracles/registry.json"), "utf8")) as { readonly entries: readonly OracleEntry[] };
const fixtureIndex = JSON.parse(readFileSync(resolve(root, "quality/fixtures/index.json"), "utf8")) as { readonly families: readonly FixtureEntry[] };
const browserAcceptance = JSON.parse(readFileSync(resolve(root, "quality/receipts/research-knowledge/browser-acceptance.json"), "utf8")) as {
  readonly status: string;
  readonly results: readonly BrowserResult[];
};
const issues: string[] = [];

if (manifest.id !== "ris-bibtex-converter") issues.push(`manifest id is ${manifest.id}`);
if (manifest.category !== "research") issues.push(`manifest category is ${manifest.category}`);
if (manifest.runtime.location !== "LOCAL" || manifest.runtime.network !== "forbidden") issues.push("Gold requires LOCAL/network-forbidden runtime");
if (manifest.gold === undefined) issues.push("manifest has no Gold metadata");

const oracleId = manifest.gold?.oracleEntryId ?? "";
const oracle = oracleRegistry.entries.find(({ id }) => id === oracleId);
if (oracle === undefined) issues.push(`oracle ${oracleId} is missing from the canonical registry`);
else {
  if (oracle.maintenance_class !== manifest.gold?.maintenanceClass) issues.push(`oracle maintenance class ${oracle.maintenance_class} does not match manifest ${manifest.gold?.maintenanceClass}`);
  if (oracle.confidence !== "high") issues.push(`canonical oracle ${oracle.id} confidence is ${oracle.confidence}, expected high`);
  for (const gap of oracle.unresolved_gaps ?? []) {
    if (!/^No unresolved gap\b/iu.test(gap)) issues.push(`canonical oracle still has open gap: ${gap}`);
  }
}

for (const family of manifest.gold?.fixtureFamilies ?? []) {
  const fixture = fixtureIndex.families.find(({ id }) => id === family);
  if (fixture === undefined) issues.push(`fixture family ${family} is missing from the canonical fixture index`);
  else {
    try {
      readFileSync(resolve(root, fixture.path));
    } catch {
      issues.push(`fixture family ${family} does not resolve at ${fixture.path}`);
    }
  }
}

if (browserAcceptance.status !== "PASS") issues.push(`research browser acceptance is ${browserAcceptance.status}`);
const browser = browserAcceptance.results.find(({ toolId }) => toolId === manifest.id);
if (browser === undefined) issues.push("browser acceptance has no ris-bibtex-converter result");
else {
  if (browser.status !== "PASS") issues.push(`browser result is ${browser.status}`);
  if (browser.lazyScriptCount < 1) issues.push("browser acceptance did not observe lazy implementation load");
  if (browser.externalTaskRequests !== 0 || browser.nonGetTaskRequests !== 0 || browser.taskContentLeaks !== 0) issues.push("browser acceptance did not prove local/no-leak behavior");
  if (browser.runtimeErrors !== 0) issues.push(`browser acceptance recorded ${browser.runtimeErrors} runtime error(s)`);
  if (browser.horizontalOverflow) issues.push("browser acceptance recorded mobile horizontal overflow");
  if (browser.unlabeledControls !== 0) issues.push(`browser acceptance recorded ${browser.unlabeledControls} unlabeled control(s)`);
  if (browser.publicErrorCopy.trim() === "" || browser.boundaryState.trim() === "") issues.push("browser acceptance is missing the public error/boundary-state evidence");
}

const deterministicInput = {
  direction: "ris-to-bibtex",
  text: "TY  - JOUR\nTI  - Determinism\nA1  - Alpha, Alice\nAU  - Beta, Bob\nDA  - 2026/10/05\nER  - \n",
};
const first = JSON.stringify(toolModule.run(deterministicInput, { defaults: {} }));
const second = JSON.stringify(toolModule.run(deterministicInput, { defaults: {} }));
if (first !== second) issues.push("two identical converter runs produced different output");
const controller = new AbortController();
controller.abort();
try {
  toolModule.run(deterministicInput, { defaults: {} }, controller.signal);
  issues.push("an aborted converter run produced a result");
} catch (error) {
  if (!(error instanceof Error) || error.name !== "AbortError") issues.push(`aborted converter run failed with ${String(error)}`);
}

if (issues.length > 0) {
  console.error(`RIS/BibTeX Gold preflight BLOCKED (${issues.length} issue(s))`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("RIS/BibTeX Gold preflight PASS: canonical oracle, fixtures, browser/locality/mobile/a11y, determinism and abort gates are green");

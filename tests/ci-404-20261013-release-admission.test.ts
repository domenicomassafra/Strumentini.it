import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(resolve(import.meta.dirname, "../.github/workflows/ci.yml"), "utf8");

/** Read job bodies, ignoring prose comments: a comment is not an executable gate. */
function job(name: string, source = workflow): string {
  const actual = source.split(/\r?\n/u).filter(line => !/^\s*#/u.test(line)).join("\n");
  const match = new RegExp(`^  ${name}:\\s*$`, "mu").exec(actual);
  if (!match) return "";
  const tail = actual.slice(match.index + match[0].length);
  return tail.split(/^  [a-z][a-z-]*:\s*$/mu, 1)[0] ?? "";
}

/** Fail closed when the read-only release proof is not demanded by dispatch. */
function releaseAdmissionFailures(source = workflow): string[] {
  const failures: string[] = [];
  const main = job("cumulative-on-main", source);
  const events = source.slice(0, source.indexOf("jobs:"));
  if (!/^  workflow_dispatch:\s*$/mu.test(events)) failures.push("MANUAL_RELEASE_TRIGGER_MISSING");
  if (!/if:\s*[^\n]*github\.event_name\s*==\s*'push'[^\n]*github\.event_name\s*==\s*'workflow_dispatch'/u.test(main)) {
    failures.push("CUMULATIVE_RELEASE_EVENT_MISSING");
  }
  // Manual admission must attest the exact integrated main revision. Running
  // source checks against a separate branch cannot certify main for publish.
  if (!main.includes('if: github.event_name == \'workflow_dispatch\'\n        run: test "$GITHUB_REF" = "refs/heads/main"')) {
    failures.push("RELEASE_DISPATCH_MAIN_REF_NOT_GUARDED");
  }
  for (const command of ["npm test -- --maxWorkers=1", "npm run tickets:test", "npm run check", "npm run build"]) {
    if (!main.includes(`- run: ${command}`)) failures.push(`MISSING_CUMULATIVE_COMMAND: ${command}`);
  }
  const gate = /- name: ([^\n]+)\n\s+if: github\.event_name == 'workflow_dispatch'\n\s+run: ([^\n]+)/gu;
  const steps = [...main.matchAll(gate)];
  if (!steps.some((match) => {
    const command = match[2];
    return typeof command === "string" && command.includes("scripts/validate-release.ts") &&
      command.includes("--require-ready") && command.includes("--no-write-receipt");
  })) {
    failures.push("CUMULATIVE_RELEASE_VALIDATOR_NOT_MANDATORY");
  }
  return failures;
}

describe("#404 cumulative main and explicit release source admission", () => {
  it("runs actual Python ticket oracle in main cumulative CI and both suites on release dispatch", () => {
    expect(releaseAdmissionFailures(workflow)).toEqual([]);
    expect(workflow).toContain("branches: [main]");
    const pr = job("changed-source");
    expect(pr).toContain("github.event_name == 'pull_request'");
    expect(pr).toContain('npm run ci:scope -- --base="$BASE_SHA" --run');
    expect(pr).not.toContain("--require-release-ready");
  });

  it("cannot claim gate coverage if release validator, fail-closed flags or Python tests are removed", () => {
    const cases = [
      ["npm run tickets:test", "MISSING_CUMULATIVE_COMMAND: npm run tickets:test"],
      ["--require-ready", "CUMULATIVE_RELEASE_VALIDATOR_NOT_MANDATORY"],
      ["--no-write-receipt", "CUMULATIVE_RELEASE_VALIDATOR_NOT_MANDATORY"],
      ["workflow_dispatch:", "MANUAL_RELEASE_TRIGGER_MISSING"],
      ['test "$GITHUB_REF" = "refs/heads/main"', "RELEASE_DISPATCH_MAIN_REF_NOT_GUARDED"],
    ] as const;
    for (const [fragment, expected] of cases) {
      expect(releaseAdmissionFailures(workflow.replace(fragment, "")), fragment).toContain(expected);
    }
  });
});

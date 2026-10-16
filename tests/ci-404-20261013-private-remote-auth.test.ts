/** #404: execute BOTH real release YAML step bodies with a synthetic private
 * Git remote. The validator step runs the real CLI; only Git transport is mocked.
 * No network, Cloudflare, credentials or release receipts are produced. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { buildImpactPlan } from "../scripts/ci-change-impact-404";

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
const token = "synthetic-read-token-no-network";
const canonicalRepository = "domenicomassafra/strumentini-it";
const canonicalUrl = `https://github.com/${canonicalRepository}.git`;

type Step = { name?: string; if?: string; uses?: string; with?: Record<string, unknown>; env?: Record<string, string>; run?: string };
type ChildExit = { status: number | null; error?: Error | undefined };
function requireCompletedExit(result: ChildExit): number {
  if (result.error !== undefined || typeof result.status !== "number") {
    throw new Error("RELEASE_404_CHILD_DID_NOT_COMPLETE");
  }
  return result.status;
}
const workflow = YAML.parse(source) as { permissions: Record<string, string>; jobs: Record<string, { steps: Step[] }> };
const steps = workflow.jobs["cumulative-on-main"]!.steps;
const remote = steps.find((step) => step.name === "Require current remote main for release admission")!;
const admission = steps.find((step) => step.name === "Read-only cumulative release admission")!;

function invoke(step: Step, mode: "current" | "advanced" | "unreachable", passToken = true) {
  const folder = mkdtempSync(join(tmpdir(), "strumentini-404-private-auth-"));
  try {
    // A hostile predecessor could prepare this local Git config under
    // RUNNER_TEMP; the authoritative probe must not execute inside it.
    mkdirSync(join(folder, ".git"));
    writeFileSync(join(folder, ".git/config"), '[url "file:///tmp/forged-404-origin/"]\n\tinsteadOf = https://github.com/\n');
    const path = join(folder, "git");
    const log = join(folder, "remote-check.log");
    // The actual YAML Bash command runs unchanged. A fake Git transport
    // verifies the transient auth environment passed into a child process.
    const program = `#!/bin/sh
if [ "$1" = "ls-remote" ]; then
  printf 'read-attempt\\n' >> "${log}"
  [ "\${GIT_TERMINAL_PROMPT:-}" = "0" ] || exit 61
  [ "\${GIT_CONFIG_COUNT:-}" = "1" ] || exit 62
  [ "\${GIT_CONFIG_KEY_0:-}" = "http.https://github.com/.extraheader" ] || exit 63
  [ "\${GIT_CONFIG_GLOBAL:-}" = "/dev/null" ] || exit 66
  [ "\${GIT_CONFIG_NOSYSTEM:-}" = "1" ] || exit 67
  [ "$4" = "${canonicalUrl}" ] && [ "$5" = "refs/heads/main" ] || exit 68
  [ "$(pwd -P)" = "/" ] || exit 69
  [ -z "\${GIT_CONFIG_PARAMETERS:-}" ] || exit 70
  [ -z "\${GIT_DIR:-}" ] || exit 71
  [ -z "\${GIT_WORK_TREE:-}" ] || exit 72
  required="AUTHORIZATION: basic $(printf 'x-access-token:%s' '${token}' | base64 | tr -d '\\r\\n')"
  [ "\${GIT_CONFIG_VALUE_0:-}" = "$required" ] || exit 64
  [ "${mode}" = "unreachable" ] && exit 65
  if [ "${mode}" = "advanced" ]; then sha="$(printf '%040d' 2)"; else sha="${head}"; fi
  printf '%s\\t%s\\n' "$sha" refs/heads/main
  exit 0
fi
if [ "$1" = "status" ] && [ "$2" = "--porcelain" ]; then exit 0; fi
exec /usr/bin/git "$@"
`;
    writeFileSync(path, program, { mode: 0o700 });
    chmodSync(path, 0o700);
    const result = spawnSync("bash", ["-euo", "pipefail", "-c", step.run!], {
      cwd: root, encoding: "utf8", timeout: 30000,
      env: {
        ...process.env, PATH: `${folder}${delimiter}${process.env.PATH ?? ""}`,
        GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main", GITHUB_SHA: head,
        GITHUB_REPOSITORY: canonicalRepository, RUNNER_TEMP: folder,
        RUNNER_OS: "Synthetic",
        RELEASE_READ_TOKEN: passToken ? token : "",
        GIT_CONFIG_PARAMETERS: "'url.file:///tmp/forged-404-origin/.insteadOf=https://github.com/'",
        ...(step === remote ? { GIT_DIR: join(folder, "attacker-git-dir"), GIT_WORK_TREE: folder } : {}),
      },
    });
    const attempted = (() => { try { return readFileSync(log, "utf8").trim().split("\n").length; } catch { return 0; } })();
    return { ...result, attempted };
  } finally { rmSync(folder, { recursive: true, force: true }); }
}

describe("#404 private GitHub release admission uses no persistent credentials", () => {
  it("does not mistake a timed-out or crashed child for an explicit admission refusal", () => {
    const timedOut = spawnSync(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeout: 25, encoding: "utf8" });
    expect(timedOut.status).toBeNull();
    expect(timedOut.error).toBeDefined();
    expect(() => requireCompletedExit(timedOut)).toThrow("RELEASE_404_CHILD_DID_NOT_COMPLETE");
    expect(() => requireCompletedExit({ status: null })).toThrow("RELEASE_404_CHILD_DID_NOT_COMPLETE");
    expect(requireCompletedExit({ status: 1 })).toBe(1);
  });
  it("marks the new authoritative GitHub probe as CI and demands independent security review", () => {
    const suites = readdirSync(join(root, "tests")).filter((item) => item.endsWith(".test.ts")).map((item) => `tests/${item}`);
    const plan = buildImpactPlan(["docs/innocuous.md", "scripts/lib/current-remote-main-404.ts"], suites);
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.domains).toContain("ci");
    expect(plan.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "security-review", status: "NOT_RUN" }),
      expect.objectContaining({ id: "release-readiness", status: "NOT_RUN" }),
    ]));
  });

  it("restricts read-only credentials to exactly two dispatch-only steps and keeps checkout uncredentialed", () => {
    expect(workflow.permissions).toEqual({ contents: "read" });
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps) {
        if (step.uses?.startsWith("actions/checkout@")) expect(step.with?.["persist-credentials"]).toBe(false);
        const hasToken = step.env?.RELEASE_READ_TOKEN !== undefined;
        expect(hasToken, step.name ?? step.uses ?? "anonymous step")
          .toBe(step === remote || step === admission);
      }
    }
    for (const step of [remote, admission]) {
      expect(step.if).toBe("github.event_name == 'workflow_dispatch'");
      expect(step.env?.RELEASE_READ_TOKEN).toBe("${{ github.token }}");
      expect(step.run).toContain("node_modules/tsx/dist/cli.mjs");
      expect(step.run).not.toMatch(/git config .*extraheader|>>?\s*\$GITHUB_ENV/u);
    }
    expect(remote.run).toContain("scripts/lib/current-remote-main-404.ts --expected-sha=\"$GITHUB_SHA\"");
    expect(admission.run).toContain("--no-write-receipt --require-ready --expected-sha=\"$GITHUB_SHA\"");
  });

  it("runs real YAML remote-read Bash and fails closed for obsolete main, missing token and inaccessible origin", () => {
    const current = invoke(remote, "current");
    expect(requireCompletedExit(current), `${current.stderr}\n${current.stdout}`).toBe(0);
    expect(current.attempted).toBe(1);
    for (const sample of [invoke(remote, "advanced"), invoke(remote, "unreachable"), invoke(remote, "current", false)]) {
      expect(requireCompletedExit(sample)).not.toBe(0);
    }
  }, 150_000);

  it("runs the actual read-only validator YAML command with temporary Git authentication and no receipt write", () => {
    const current = invoke(admission, "current");
    expect(current.attempted, `${current.stderr}\n${current.stdout}`).toBe(1);
    expect(current.stdout, current.stderr).not.toBe("");
    const result = JSON.parse(current.stdout) as {
      status: string; receipt: string | null; findings: { code: string }[];
    };
    expect(result.receipt).toBeNull();
    expect(result.status).not.toBe("PASS");
    // Both supported local receipt conditions refuse publication: a fresh
    // explicitly UNPROVEN rollback and a prior receipt whose source is stale.
    // This test is about fail-closed source admission, not the incidental
    // fingerprint of whichever isolated checkout it runs within.
    const findings = result.findings.map((finding) => finding.code);
    expect(findings).toEqual(expect.arrayContaining([
      "GOLD_RECEIPT_MISSING", "PHYSICAL_DEVICE_EVIDENCE_MISSING",
    ]));
    expect(findings.some((code) => code === "ROLLBACK_UNPROVEN" || code === "ROLLBACK_SOURCE_STALE"),
      `Expected a concrete rollback blocker, got ${findings.join(",")}`).toBe(true);
    expect(requireCompletedExit(current)).not.toBe(0);
    const advanced = invoke(admission, "advanced");
    expect(advanced.attempted).toBe(1);
    expect(`${advanced.stderr}\n${advanced.stdout}`).toMatch(/RELEASE_404_REMOTE_MAIN_SHA_MISMATCH_OR_UNAVAILABLE/u);
    expect(requireCompletedExit(advanced)).not.toBe(0);
    const missingToken = invoke(admission, "current", false);
    expect(missingToken.attempted).toBe(0);
    expect(requireCompletedExit(missingToken)).not.toBe(0);
  }, 150_000);
});

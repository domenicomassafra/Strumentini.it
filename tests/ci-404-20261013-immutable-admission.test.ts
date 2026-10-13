import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { assertCurrentRemoteMain404, assertReleaseRevision404 } from "../scripts/validate-release";

const workflow = readFileSync(resolve(import.meta.dirname, "../.github/workflows/ci.yml"), "utf8");
const SHA = "c38da86458eec0512721a5b4abc612b1f7b74a67";

describe("#404 release admission must bind the exact immutable main SHA", () => {
  it("requires expected SHA to be exact, clean and equal to checked-out HEAD, never another branch or event SHA", () => {
    expect(() => assertReleaseRevision404({ expectedSha: SHA, currentSha: SHA, githubSha: SHA })).not.toThrow();
    for (const expectedSha of [undefined, "", "main", "HEAD", SHA.slice(0, 8), SHA.toUpperCase(), "a".repeat(40) + "x"]) {
      expect(() => assertReleaseRevision404({ expectedSha, currentSha: SHA, githubSha: SHA }), String(expectedSha)).toThrow();
    }
    expect(() => assertReleaseRevision404({ expectedSha: SHA, currentSha: "b".repeat(40), githubSha: SHA })).toThrow(/mismatch/iu);
    expect(() => assertReleaseRevision404({ expectedSha: SHA, currentSha: SHA, githubSha: "b".repeat(40) })).toThrow(/mismatch/iu);
    expect(() => assertReleaseRevision404({ expectedSha: SHA, currentSha: SHA, githubSha: SHA, githubRef: "refs/heads/preview" })).toThrow(/main/iu);
    expect(() => assertReleaseRevision404({ expectedSha: SHA, currentSha: SHA, githubSha: SHA, githubRef: "refs/heads/main" })).not.toThrow();
    expect(() => assertReleaseRevision404({ expectedSha: SHA, currentSha: SHA, githubSha: SHA, dirty: true })).toThrow(/dirty/iu);
  });

  it("the live release dispatch checks out the exact event SHA and supplies it to the nonwriting readiness gate", () => {
    expect(workflow).toMatch(/name: Source checks \(no deployment\)/u);
    const main = workflow.split("  cumulative-on-main:")[1] ?? "";
    expect(main).toContain('run: test "$GITHUB_REF" = "refs/heads/main"');
    expect(main).toContain('run: test "$(git rev-parse HEAD)" = "$GITHUB_SHA"');
    expect(main).toContain('scripts/validate-release.ts --no-write-receipt --require-ready --expected-sha="$GITHUB_SHA"');
    expect(main).not.toMatch(/(?<!--dry-run)wrangler deploy/u);
  });

  it("fails closed if authoritative remote main advanced after the event was queued, despite correct event SHA and checkout", () => {
    // This is the genuine race: old main event and checked-out old main agree,
    // while origin's current remote main has progressed. No network request.
    expect(() => assertReleaseRevision404({
      expectedSha: SHA, currentSha: SHA, githubSha: SHA, githubRef: "refs/heads/main",
    })).not.toThrow();
    expect(() => assertCurrentRemoteMain404({ expectedSha: SHA, remoteListing: `${SHA}\trefs/heads/main\n` })).not.toThrow();
    for (const listing of [
      `${"b".repeat(40)}\trefs/heads/main\n`,
      "", "fatal: origin unreachable", `${SHA}\trefs/heads/preview\n`,
      `${SHA}\trefs/heads/main\n${"b".repeat(40)}\trefs/heads/main\n`,
      ` ${SHA}\trefs/heads/main\n`,
    ]) {
      expect(() => assertCurrentRemoteMain404({ expectedSha: SHA, remoteListing: listing }), listing).toThrow(/REMOTE_MAIN/u);
    }
  });

  it("executes actual YAML dispatch step with a synthetic git-only remote, allowing current SHA and blocking advanced or unreachable main", () => {
    type Step = { name?: string; run?: string; if?: string; env?: Record<string, string> };
    const parsed = YAML.parse(workflow) as { jobs: Record<string, { steps: Step[] }> };
    const steps = parsed.jobs["cumulative-on-main"]!.steps;
    const remoteIndex = steps.findIndex((step) => step.name === "Require current remote main for release admission");
    const admissionIndex = steps.findIndex((step) => step.name === "Read-only cumulative release admission");
    expect(remoteIndex).toBeGreaterThan(0);
    expect(remoteIndex).toBeLessThan(admissionIndex);
    const step = steps[remoteIndex]!;
    expect(step.if).toBe("github.event_name == 'workflow_dispatch'");
    // checkout deliberately does not persist credentials. Both private-repo
    // remote reads must receive a temporary read-only token in the step env.
    expect(step.env?.RELEASE_READ_TOKEN).toBe("${{ github.token }}");
    expect(steps[admissionIndex]?.env?.RELEASE_READ_TOKEN).toBe("${{ github.token }}");
    expect(steps[admissionIndex]?.run).toContain("GIT_CONFIG_VALUE_0");
    expect(step.run).toContain("git ls-remote --exit-code --refs origin refs/heads/main");
    const simulate = (remoteSha: string, exitCode = 0, token = "synthetic-readonly") => {
      // A shell function intercepts *all* git calls. No git provider/network.
      const mockGit = `git() { if [ "$*" != "ls-remote --exit-code --refs origin refs/heads/main" ]; then return 9; fi; if [ "$SYNTHETIC_REMOTE_EXIT" != "0" ]; then return "$SYNTHETIC_REMOTE_EXIT"; fi; printf '%s\\t%s\\n' "$SYNTHETIC_REMOTE_SHA" refs/heads/main; }\n`;
      return spawnSync("bash", ["-euo", "pipefail", "-c", mockGit + step.run], {
        encoding: "utf8", timeout: 5000,
        env: { ...process.env, GITHUB_SHA: SHA, RELEASE_READ_TOKEN: token, SYNTHETIC_REMOTE_SHA: remoteSha, SYNTHETIC_REMOTE_EXIT: String(exitCode) },
      });
    };
    expect(simulate(SHA).status).toBe(0);
    expect(simulate(SHA, 0, "").status).not.toBe(0);
    expect(simulate("b".repeat(40)).status).not.toBe(0);
    expect(simulate(SHA, 2).status).not.toBe(0);
  });

  it("the actual validator CLI refuses a forged immutable SHA before generating any receipt", () => {
    const root = resolve(import.meta.dirname, "..");
    const processResult = spawnSync(process.execPath, [
      resolve(root, "node_modules/tsx/dist/cli.mjs"), resolve(root, "scripts/validate-release.ts"),
      "--no-write-receipt", "--require-ready", `--expected-sha=${"0".repeat(40)}`,
    ], { cwd: root, encoding: "utf8", timeout: 15000,
      env: { ...process.env, GITHUB_SHA: "", GITHUB_REF: "", GITHUB_ACTIONS: "" },
    });
    expect(processResult.status).not.toBe(0);
    expect(`${processResult.stderr}\n${processResult.stdout}`).toMatch(/RELEASE_404_SHA_MISMATCH/iu);
    expect(processResult.stdout).not.toContain('"receipt":');
  }, 20_000);
});

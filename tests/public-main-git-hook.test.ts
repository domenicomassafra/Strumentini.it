import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const reviewedHook = resolve(".githooks/pre-push");
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

describe("Strumentini public-main push discipline", () => {
  it("rejects an origin/main push but accepts a pushed short-lived review branch", () => {
    const sandbox = mkdtempSync(join(tmpdir(), "strumentini-public-push-"));
    try {
      const origin = join(sandbox, "remote.git");
      const checkout = join(sandbox, "checkout");
      mkdirSync(checkout);
      git(sandbox, "init", "--bare", "-q", origin);
      git(checkout, "init", "-b", "main", "-q");
      git(checkout, "config", "user.name", "Test");
      git(checkout, "config", "user.email", "fixture@example.invalid");
      writeFileSync(join(checkout, "README.md"), "baseline\n");
      git(checkout, "add", "README.md");
      git(checkout, "commit", "-qm", "initial");
      git(checkout, "remote", "add", "origin", origin);
      git(checkout, "push", "-q", "origin", "main");
      const originalMain = git(checkout, "rev-parse", "HEAD");

      const hooks = join(checkout, ".githooks");
      mkdirSync(hooks);
      copyFileSync(reviewedHook, join(hooks, "pre-push"));
      chmodSync(join(hooks, "pre-push"), 0o755);
      git(checkout, "config", "--local", "core.hooksPath", ".githooks");

      git(checkout, "switch", "-q", "-c", "fix/owner-manual-bug");
      writeFileSync(join(checkout, "README.md"), "fixed in review\n");
      git(checkout, "add", "README.md");
      git(checkout, "commit", "-qm", "fix: owner bug captured");
      const reviewHead = git(checkout, "rev-parse", "HEAD");
      git(checkout, "push", "-q", "origin", "HEAD:refs/heads/fix/owner-manual-bug");
      expect(git(sandbox, "--git-dir", origin, "rev-parse", "refs/heads/fix/owner-manual-bug")).toBe(reviewHead);

      const blocked = spawnSync("git", ["push", "origin", "HEAD:refs/heads/main"], { cwd: checkout, encoding: "utf8" });
      expect(blocked.status).not.toBe(0);
      expect(blocked.stderr).toContain("BLOCKED_PUBLIC_MAIN_PUSH");
      expect(git(sandbox, "--git-dir", origin, "rev-parse", "refs/heads/main")).toBe(originalMain);
      expect(readFileSync(join(checkout, "README.md"), "utf8")).toBe("fixed in review\n");
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});

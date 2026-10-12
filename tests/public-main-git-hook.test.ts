import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const reviewedHook = resolve(".githooks/pre-push");
const installer = resolve("scripts/install-public-git-hooks.sh");
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

describe("Strumentini public-main push discipline", () => {
  it("refuses to override default executable hooks and inherited global hooksPath", () => {
    const sandbox = mkdtempSync(join(tmpdir(), "strumentini-owned-hooks-"));
    try {
      const checkout = join(sandbox, "checkout");
      mkdirSync(checkout);
      git(checkout, "init", "-b", "main", "-q");
      mkdirSync(join(checkout, "scripts"));
      mkdirSync(join(checkout, ".githooks"));
      copyFileSync(installer, join(checkout, "scripts/install-public-git-hooks.sh"));
      copyFileSync(reviewedHook, join(checkout, ".githooks/pre-push"));
      chmodSync(join(checkout, ".githooks/pre-push"), 0o755);
      const options = { cwd: checkout, encoding: "utf8" as const, env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } };

      const oldHook = join(checkout, ".git/hooks/pre-push");
      writeFileSync(oldHook, "#!/bin/sh\nexit 13\n");
      chmodSync(oldHook, 0o755);
      const blockedDefault = spawnSync("bash", ["scripts/install-public-git-hooks.sh"], options);
      expect(blockedDefault.status).toBe(3);
      expect(blockedDefault.stderr).toContain("existing executable Git hook");
      expect(spawnSync("git", ["config", "--local", "--get", "core.hooksPath"], options).status).toBe(1);

      rmSync(oldHook);
      const global = join(sandbox, "gitconfig");
      writeFileSync(global, "[core]\n  hooksPath = /tmp/owner-hooks\n");
      const blockedInherited = spawnSync("bash", ["scripts/install-public-git-hooks.sh"], {
        ...options, env: { ...options.env, GIT_CONFIG_GLOBAL: global },
      });
      expect(blockedInherited.status).toBe(3);
      expect(blockedInherited.stderr).toContain("another effective Git hooksPath");
      expect(spawnSync("git", ["config", "--local", "--get", "core.hooksPath"], options).status).toBe(1);

      const installed = spawnSync("bash", ["scripts/install-public-git-hooks.sh"], options);
      expect(installed.status).toBe(0);
      expect(git(checkout, "config", "--local", "--get", "core.hooksPath")).toBe(".githooks");
      const installedAgain = spawnSync("bash", ["scripts/install-public-git-hooks.sh"], options);
      expect(installedAgain.status).toBe(0);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
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

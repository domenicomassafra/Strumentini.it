/** #404 manual, read-only GitHub main admission. Never trust the mutable
 * checkout `origin` alias or its Git URL rewrites for production admission.
 * This is source-only evidence, not a Cloudflare deploy authorization. */
import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export const RELEASE_REPOSITORY_404 = "domenicomassafra/strumentini-it";
export const RELEASE_REPOSITORY_URL_404 = `https://github.com/${RELEASE_REPOSITORY_404}.git`;

export function assertCurrentRemoteMain404(input: { expectedSha: string; remoteListing: string }): void {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(input.expectedSha) ||
      input.remoteListing.trimEnd() !== `${input.expectedSha}\trefs/heads/main` ||
      input.remoteListing.trimEnd().split(/\r?\n/u).length !== 1) {
    throw new Error("RELEASE_404_REMOTE_MAIN_SHA_MISMATCH_OR_UNAVAILABLE");
  }
}

export async function verifyCurrentGithubMain404(expectedSha: string): Promise<void> {
  if (process.env.GITHUB_REPOSITORY !== RELEASE_REPOSITORY_404 ||
      process.env.GITHUB_REF !== "refs/heads/main" ||
      process.env.GITHUB_SHA !== expectedSha || !process.env.RUNNER_TEMP ||
      !process.env.RELEASE_READ_TOKEN) {
    throw new Error("RELEASE_404_TRUSTED_GITHUB_REMOTE_REQUIRED");
  }
  assertCurrentRemoteMain404({ expectedSha, remoteListing: `${expectedSha}\trefs/heads/main` });

  // Construct the child Git environment from scratch. Inherited local/system
  // configuration, GIT_CONFIG_PARAMETERS, GIT_DIR, Git aliases, credential
  // helpers and url.*.insteadOf must not redirect this source admission.
  const gitEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.RELEASE_READ_TOKEN}`, "utf8").toString("base64")}`,
  };
  // GitHub's reserved RUNNER_OS=Linux selects the trusted system Git, not a
  // PATH-prepended binary left by earlier npm/workflow steps. Other values
  // support local no-network tests with a synthetic Git transport in PATH.
  const gitExecutable = process.env.RUNNER_OS === "Linux" ? "/usr/bin/git" : "git";
  // Do not use RUNNER_TEMP as cwd: prior npm/test code can write
  // $RUNNER_TEMP/.git/config and spoof url.*.insteadOf from local config.
  // GitHub's unprivileged hosted runner cannot write a repository at `/`.
  const result = await execFileAsync(gitExecutable, [
    "ls-remote", "--exit-code", "--refs", RELEASE_REPOSITORY_URL_404, "refs/heads/main",
  ], { cwd: "/", env: gitEnv });
  assertCurrentRemoteMain404({ expectedSha, remoteListing: result.stdout });
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(import.meta.filename)) {
  const flags = process.argv.slice(2);
  if (flags.length !== 1 || !flags[0]?.startsWith("--expected-sha=")) {
    console.error("RELEASE_404_EXPECTED_SHA_REQUIRED");
    process.exitCode = 1;
  } else {
    try { await verifyCurrentGithubMain404(flags[0].slice("--expected-sha=".length)); }
    catch (error) {
      console.error(`RELEASE_404_NO_GO: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
}

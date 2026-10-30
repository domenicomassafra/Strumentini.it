/**
 * #404 opt-in, source-controlled production deployment entrypoint.
 * This is NOT a Cloudflare account/branch protection policy: direct Wrangler
 * CLI, dashboard or other external deployers remain outside this wrapper.
 * A failing or missing Gold/physical/security/rollback gate never reaches
 * Wrangler deploy. Tests pass mock commands and never contact a provider.
 */
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, realpathSync } from "node:fs";
import { lstat, open, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { assertReleaseRevision404 } from "./validate-release";
import { inspectReleaseWorkingTree162 } from "./lib/release-evidence-worktree-162";

const execFileAsync = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "..");

export interface PrepublishStep404 {
  readonly name: string;
  readonly program: string;
  readonly args: readonly string[];
  readonly publishes: boolean;
}

/**
 * Owner decision 20/10/2026 makes the automatic evidence (suite, browser matrix,
 * simulator/emulator lanes, proven rollback) the release criterion. The strict
 * per-tool Gold and physical-device admission stays available with
 * STRUMENTINI_RELEASE_STRICT=1.
 */
export function releasePolicy420Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.STRUMENTINI_RELEASE_STRICT !== "1";
}

export function prepublishSteps404(expectedSha: string, policy420 = releasePolicy420Enabled()): readonly PrepublishStep404[] {
  const admission: PrepublishStep404[] = policy420
    ? [{
        name: "owner-policy-automatic-admission", program: "node",
        args: ["node_modules/tsx/dist/cli.mjs", "scripts/release-gate-420.ts", `--expected-sha=${expectedSha}`],
        publishes: false,
      }]
    : [
        {
          name: "read-only-required-admission", program: "node",
          args: ["node_modules/tsx/dist/cli.mjs", "scripts/validate-release.ts", "--no-write-receipt", "--require-ready", `--expected-sha=${expectedSha}`],
          publishes: false,
        },
        // Production publishes the entire dist, so every catalog tool is in scope.
        {
          name: "scope-and-staging-rollback-admission", program: "node",
          args: ["node_modules/tsx/dist/cli.mjs", "scripts/verify-release-scope-405.ts", "--all"],
          publishes: false,
        },
      ];
  return [
    { name: "source-and-engine-tests", program: "npm", args: ["test", "--", "--maxWorkers=1"], publishes: false },
    { name: "astro-source-validation", program: "npm", args: ["run", "check"], publishes: false },
    { name: "cumulative-build", program: "npm", args: ["run", "build"], publishes: false },
    { name: "cloudflare-static-dry-run", program: "npm", args: ["run", "deploy:check"], publishes: false },
    ...admission,
    { name: "wrangler-production-deploy", program: "node_modules/.bin/wrangler", args: ["deploy"], publishes: true },
  ];
}

/** The deployed asset directory is gitignored. Its actual bytes must remain
 * identical from the successful build through the last pre-deploy gate.
 * This source-only check cannot make a provider deployment atomic. */
export async function fingerprintPublicationAssets404(directory: string): Promise<string> {
  const digest = createHash("sha256");
  let files = 0;
  let totalBytes = 0;
  const walk = async (absolute: string, relative: string): Promise<void> => {
    const directoryInfo = await lstat(absolute);
    if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
      throw new Error("RELEASE_404_ASSET_UNSAFE_DIRECTORY");
    }
    const names = (await readdir(absolute)).sort();
    for (const name of names) {
      const path = join(absolute, name);
      const key = relative ? `${relative}/${name}` : name;
      const entry = await lstat(path);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        digest.update(`D\0${key}\0`);
        await walk(path, key);
        continue;
      }
      if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1 || ++files > 50_000) {
        throw new Error("RELEASE_404_ASSET_UNSAFE_FILE");
      }
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const first = await handle.stat();
        if (!first.isFile() || first.nlink !== 1 || first.dev !== entry.dev ||
            first.ino !== entry.ino || first.size !== entry.size) {
          throw new Error("RELEASE_404_ASSET_CHANGED_DURING_READ");
        }
        digest.update(`F\0${key}\0${first.size}\0`);
        const block = Buffer.allocUnsafe(64 * 1024);
        let offset = 0;
        while (offset < first.size) {
          const { bytesRead } = await handle.read(block, 0, Math.min(block.length, first.size - offset), offset);
          if (bytesRead <= 0) throw new Error("RELEASE_404_ASSET_CHANGED_DURING_READ");
          digest.update(block.subarray(0, bytesRead));
          offset += bytesRead;
          totalBytes += bytesRead;
          if (totalBytes > 512 * 1024 * 1024) throw new Error("RELEASE_404_ASSET_SIZE_BUDGET");
        }
        const last = await handle.stat();
        const current = await lstat(path);
        if (last.size !== first.size || last.mtimeMs !== first.mtimeMs ||
            last.ctimeMs !== first.ctimeMs || current.dev !== first.dev || current.ino !== first.ino) {
          throw new Error("RELEASE_404_ASSET_CHANGED_DURING_READ");
        }
        digest.update("\0END\0");
      } finally {
        await handle.close();
      }
    }
  };
  await walk(directory, "");
  if (files === 0) throw new Error("RELEASE_404_ASSET_EMPTY_BUILD");
  return digest.digest("hex");
}

/** No fallthrough on failed checks; re-attest immutable revision immediately
 * before the ONLY publishing command. The boundary is tested with mocks. */
export async function runPrepublish404(input: {
  expectedSha?: string | undefined;
  /** Explicit override for tests and operators; defaults to the owner policy. */
  policy420?: boolean | undefined;
  verifyRevision(): Promise<void>;
  snapshotAssets(): Promise<string>;
  snapshotEvidence(): Promise<string>;
  runStep(step: PrepublishStep404): Promise<void>;
}): Promise<void> {
  // Validate format before executing even a harmless external binary.
  assertReleaseRevision404({ expectedSha: input.expectedSha, currentSha: input.expectedSha ?? "" });
  await input.verifyRevision();
  const steps = prepublishSteps404(input.expectedSha!, input.policy420 ?? releasePolicy420Enabled());
  let builtAssets: string | undefined;
  let admittedEvidence: string | undefined;
  for (const step of steps) {
    if (step.publishes) {
      if (!builtAssets) throw new Error("RELEASE_404_ASSET_SNAPSHOT_MISSING");
      if (!admittedEvidence) throw new Error("RELEASE_404_EVIDENCE_SNAPSHOT_MISSING");
      await input.verifyRevision();
      const currentAssets = await input.snapshotAssets();
      if (currentAssets !== builtAssets) throw new Error("RELEASE_404_ASSET_CHANGED_AFTER_BUILD");
      if (await input.snapshotEvidence() !== admittedEvidence) {
        throw new Error("RELEASE_404_EVIDENCE_CHANGED_AFTER_ADMISSION");
      }
    }
    await input.runStep(step);
    if (step.name === "cumulative-build") {
      builtAssets = await input.snapshotAssets();
      if (!/^[a-f0-9]{64}$/u.test(builtAssets)) throw new Error("RELEASE_404_ASSET_SNAPSHOT_INVALID");
    }
    if (step.name === "owner-policy-automatic-admission" || step.name === "scope-and-staging-rollback-admission") {
      admittedEvidence = await input.snapshotEvidence();
      if (!/^[a-f0-9]{64}$/u.test(admittedEvidence)) throw new Error("RELEASE_404_EVIDENCE_SNAPSHOT_INVALID");
    }
  }
}

async function git(...args: string[]): Promise<string> {
  return (await execFileAsync("git", args, { cwd: ROOT })).stdout.trim();
}

async function verifyReleaseCandidate404(expectedSha: string): Promise<void> {
  const [currentSha, originMainSha, remoteMain] = await Promise.all([
    git("rev-parse", "HEAD"),
    git("rev-parse", "refs/remotes/origin/main"),
    // Fetch-less current remote identity: no local stale origin/main can
    // authorize publishing after another commit lands on GitHub.
    git("ls-remote", "--exit-code", "origin", "refs/heads/main"),
  ]);
  const remote = remoteMain.split(/\s+/u);
  if (remote.length !== 2 || remote[1] !== "refs/heads/main" || remote[0] !== expectedSha || originMainSha !== expectedSha) {
    throw new Error("RELEASE_404_MAIN_REMOTE_SHA_MISMATCH");
  }
  assertReleaseRevision404({
    expectedSha, currentSha, githubSha: process.env.GITHUB_SHA || undefined,
    githubRef: process.env.GITHUB_REF || undefined, dirty: inspectReleaseWorkingTree162(ROOT).dirty,
  });
}

async function executeStep404(step: PrepublishStep404): Promise<void> {
  await new Promise<void>((ok, reject) => {
    const child = spawn(step.program, [...step.args], { cwd: ROOT, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? ok() : reject(new Error(`RELEASE_404_${step.name}_FAILED: exit=${String(code)}, signal=${String(signal)}`)));
  });
}

async function main(): Promise<void> {
  const flags = process.argv.slice(2);
  if (flags.length !== 1 || !flags[0]!.startsWith("--expected-sha=")) {
    throw new Error("RELEASE_404_EXPECTED_SHA_REQUIRED: use --expected-sha=<40-character origin/main commit>");
  }
  const expectedSha = flags[0]!.slice("--expected-sha=".length);
  await runPrepublish404({
    expectedSha,
    verifyRevision: () => verifyReleaseCandidate404(expectedSha),
    snapshotAssets: () => fingerprintPublicationAssets404(resolve(ROOT, "dist")),
    snapshotEvidence: () => fingerprintPublicationAssets404(resolve(ROOT, "quality/receipts")),
    runStep: executeStep404,
  });
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(import.meta.filename)) {
  try { await main(); }
  catch (error) {
    console.error(`RELEASE_404_NO_GO: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

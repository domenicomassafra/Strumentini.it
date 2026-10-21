import { readFileSync, readdirSync } from "node:fs";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildImpactPlan } from "../scripts/ci-change-impact-404";
import { fingerprintPublicationAssets404, prepublishSteps404, runPrepublish404, type PrepublishStep404 } from "../scripts/prepublish-404";
import { BATCH_410_MAX_FILE_BYTES, runBatchTextGzip410 } from "../src/runtime/batch-file-410";

const SHA = "c38da86458eec0512721a5b4abc612b1f7b74a67";
const root = resolve(import.meta.dirname, "..");
const goodAssets = () => Promise.resolve("a".repeat(64));
const file = (name: string, value: string) => new File([value], name, { type: "text/plain" });

describe("#404 opt-in guarded publish: fail closed without provider access", () => {
  it("treats the real prepublish boundary and its security regressions as CI/security changes, not generic shared", () => {
    const suites = readdirSync(resolve(root, "tests")).filter((name) => name.endsWith(".test.ts")).map((name) => `tests/${name}`);
    for (const path of [
      "scripts/prepublish-404.ts",
      "tests/ci-404-20261013-prepublish.test.ts",
      "tests/ci-404-20261013-immutable-admission.test.ts",
      "tests/ci-404-20261013-release-admission.test.ts",
    ]) {
      const plan = buildImpactPlan(["docs/harmless.md", path], suites);
      expect(plan.status, path).toBe("SOURCE_CHECKS_REQUIRED");
      expect(plan.domains, path).toContain("ci");
      expect(plan.gates, path).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "security-review", status: "NOT_RUN" }),
        expect.objectContaining({ id: "release-readiness", status: "NOT_RUN" }),
      ]));
      for (const command of ["test", "check", "build"]) {
        expect(plan.commands.some((step) => step.program === "npm" && step.args.join(" ") === `run ${command}`), `${path}: ${command}`).toBe(true);
      }
    }
  });

  it("requires real negative/huge/cancel local output evidence without losing the previous good output", async () => {
    const abort = new AbortController();
    const huge = new File([new Uint8Array(BATCH_410_MAX_FILE_BYTES + 1)], "huge.txt", { type: "text/plain" });
    const truncated = file("truncated.txt", "must never be published");
    Object.defineProperty(truncated, "arrayBuffer", { value: async () => new Uint8Array(1).buffer });
    const outputs = await runBatchTextGzip410([file("good.txt", "prior-valid\n"), huge, truncated, file("later.txt", "next-valid\n")]);
    expect(outputs.map((row) => row.status)).toEqual(["success", "unsupported", "unsupported", "success"]);
    expect(outputs[1]).toMatchObject({ reason: "FILE_TOO_LARGE" });
    expect(outputs[2]).toMatchObject({ reason: "UNSUPPORTED_ENCODING" });
    expect(outputs[1]!.output).toBeUndefined();
    expect(outputs[2]!.output).toBeUndefined();
    const bytes = new Uint8Array(await outputs[0]!.output!.blob.arrayBuffer());
    expect(gunzipSync(bytes)).toEqual(Buffer.from("prior-valid\n"));
    expect(gunzipSync(new Uint8Array(await outputs[3]!.output!.blob.arrayBuffer()))).toEqual(Buffer.from("next-valid\n"));
    const cancelled = await runBatchTextGzip410([file("first.txt", "saved"), file("second.txt", "never"), file("third.txt", "never")], {
      signal: abort.signal, onItem(item) { if (item.status === "success") abort.abort(); },
    });
    expect(cancelled.map((row) => row.status)).toEqual(["success", "cancelled", "cancelled"]);
    expect(cancelled.slice(1).every((item) => item.output === undefined)).toBe(true);
    expect(gunzipSync(bytes)).toEqual(Buffer.from("prior-valid\n"));
  });

  it("source impact includes synthetic UI, Worker/auth/D1, PDF engine and non-waivable security/physical gates", () => {
    const suites = readdirSync(resolve(root, "tests")).filter((name) => name.endsWith(".test.ts")).map((name) => `tests/${name}`);
    const plan = buildImpactPlan(["src/components/Shell.astro", "worker/index.ts", "worker/migrations/0002_auth.sql", "src/engines/pdf/secure-raster-redaction-237.ts"], suites);
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.domains).toEqual(expect.arrayContaining(["frontend", "worker-auth", "d1", "pdf"]));
    expect(plan.selectedTests).toEqual(expect.arrayContaining(["tests/auth-worker.test.ts", "tests/pdf-redaction-237.test.ts"]));
    const gateMap = Object.fromEntries(plan.gates.map((gate) => [gate.id, gate.status]));
    for (const id of ["security-review", "auth-integration", "physical-device", "browser-a11y", "release-readiness"]) {
      expect(gateMap[id], id).toBe("NOT_RUN");
    }
  });

  it("will not invoke Wrangler when release validation refuses missing Gold or physical evidence", async () => {
    const run: string[] = [];
    const actual = async (step: PrepublishStep404) => {
      run.push(step.name);
      if (step.name === "read-only-required-admission") throw new Error("BLOCKED: GOLD_RECEIPT_MISSING; PHYSICAL_DEVICE_EVIDENCE_MISSING");
    };
    await expect(runPrepublish404({ expectedSha: SHA, policy420: false, verifyRevision: async () => {}, snapshotAssets: goodAssets, runStep: actual })).rejects.toThrow(/GOLD_RECEIPT_MISSING/u);
    expect(run.at(-1)).toBe("read-only-required-admission");
    expect(run).not.toContain("wrangler-production-deploy");
    const steps = prepublishSteps404(SHA, false);
    expect(steps.filter((step) => step.publishes).map((step) => step.name)).toEqual(["wrangler-production-deploy"]);
    const validator = steps.find((step) => step.name === "read-only-required-admission");
    expect(validator?.args).toEqual(expect.arrayContaining(["--no-write-receipt", "--require-ready", `--expected-sha=${SHA}`]));
  });

  it("requires the full deployed scope and a proven staging rollback even after cumulative admission", async () => {
    const calls: string[] = [];
    await expect(runPrepublish404({
      expectedSha: SHA, policy420: false, verifyRevision: async () => {}, snapshotAssets: goodAssets,
      runStep: async (step) => {
        calls.push(step.name);
        if (step.name === "scope-and-staging-rollback-admission") throw new Error("STAGING_CANARY_NOT_RUN");
      },
    })).rejects.toThrow("STAGING_CANARY_NOT_RUN");
    expect(calls).toContain("read-only-required-admission");
    expect(calls).not.toContain("wrangler-production-deploy");
    expect(prepublishSteps404(SHA, false).find((step) => step.name === "scope-and-staging-rollback-admission")?.args)
      .toEqual(["node_modules/tsx/dist/cli.mjs", "scripts/verify-release-scope-405.ts", "--all"]);
  });

  it("refuses absent SHA, stale revision and any failing cumulative stage before deployment", async () => {
    for (const expectedSha of [undefined, "", "main", SHA.slice(0, 8), "0".repeat(40)]) {
      const run: string[] = [];
      await expect(runPrepublish404({ expectedSha, snapshotAssets: goodAssets, verifyRevision: async () => {
        if (expectedSha === "0".repeat(40)) throw new Error("RELEASE_404_SHA_MISMATCH");
      }, runStep: async (step) => { run.push(step.name); } })).rejects.toThrow();
      expect(run).toEqual([]);
    }
    const steps = prepublishSteps404(SHA);
    for (const failed of steps.filter((step) => !step.publishes)) {
      const run: string[] = [];
      await expect(runPrepublish404({
        expectedSha: SHA, verifyRevision: async () => {}, snapshotAssets: goodAssets,
        runStep: async (step) => { run.push(step.name); if (step.name === failed.name) throw new Error("NO_GO"); },
      })).rejects.toThrow("NO_GO");
      expect(run).not.toContain("wrangler-production-deploy");
    }
    let verifications = 0;
    const calls: string[] = [];
    await expect(runPrepublish404({
      expectedSha: SHA,
      snapshotAssets: goodAssets,
      verifyRevision: async () => { verifications++; if (verifications === 2) throw new Error("MAIN SHA CHANGED"); },
      runStep: async (step) => { calls.push(step.name); },
    })).rejects.toThrow(/SHA CHANGED/u);
    expect(calls).not.toContain("wrangler-production-deploy");
    expect(verifications).toBe(2);
  });

  it("synthetic all-green runner executes exactly one deploy LAST; production command is never actually called", async () => {
    const steps: string[] = [];
    let verified = 0;
    await runPrepublish404({ expectedSha: SHA, verifyRevision: async () => { verified++; },
      snapshotAssets: goodAssets,
      runStep: async (step) => { steps.push(step.name); },
    });
    expect(verified).toBe(2);
    expect(steps).toEqual(prepublishSteps404(SHA).map((step) => step.name));
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["deploy:production:guarded"]).toBe("tsx scripts/prepublish-404.ts");
    // External direct Wrangler use is not constrained by this script; do NOT
    // close original AC404.1 until an independent provider gate exists.
  });

  it("fails closed when ignored distribution bytes change after build, before publish", async () => {
    let outputBytes = "reviewed-static-artifact";
    const calls: string[] = [];
    await expect(runPrepublish404({
      expectedSha: SHA,
      policy420: false,
      verifyRevision: async () => {},
      snapshotAssets: async () => createHash("sha256").update(outputBytes).digest("hex"),
      runStep: async (step) => {
        calls.push(step.name);
        if (step.name === "read-only-required-admission") outputBytes = "unreviewed-mutated-artifact";
      },
    })).rejects.toThrow("RELEASE_404_ASSET_CHANGED_AFTER_BUILD");
    expect(calls).not.toContain("wrangler-production-deploy");
  });

  it("binds real artifact file bytes and refuses symlinks, not only source revision", async () => {
    const directory = await mkdtemp(join(tmpdir(), "strumentini-404-dist-"));
    try {
      const file = join(directory, "index.html");
      await writeFile(file, "<h1>validated</h1>");
      const first = await fingerprintPublicationAssets404(directory);
      expect(first).toMatch(/^[a-f0-9]{64}$/u);
      await writeFile(file, "<h1>mutated</h1>");
      expect(await fingerprintPublicationAssets404(directory)).not.toBe(first);
      await symlink(file, join(directory, "outside-link.html"));
      await expect(fingerprintPublicationAssets404(directory)).rejects.toThrow("RELEASE_404_ASSET_UNSAFE_FILE");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

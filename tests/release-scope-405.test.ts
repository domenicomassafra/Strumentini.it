import { describe, expect, it } from "vitest";
import {
  assessReleaseScope405,
  runIsolatedRollbackDrill405,
  type ScopeEvidence405,
} from "../scripts/verify-release-scope-405";

const fingerprint = "a".repeat(64);
const revision = "b".repeat(40);
const sha = "c".repeat(64);

function browserEngine(engine: string) {
  return {
    engine, status: "PASS", classification: "observed",
    coreRoute: "PASS", homeRoute: "PASS", directoryRoute: "PASS",
    mobile: { toolOverflow: false, homeOverflow: false, directoryOverflow: false },
    lazy: { observedEngineChunk: ["app.x.js"] },
    longTasks: { observerSupported: true, gate: "PASS" },
    networkPrivacy: { externalTaskRequests: 0, taskContentLeaks: 0, nonGetTaskRequests: 0 },
    performance: { ttfbMs: 3 },
    consoleErrors: [], pageErrors: [], failures: [],
  };
}

function physical(target: "ios-safari" | "android-chrome") {
  return {
    schemaVersion: 1, status: "PASS", target, revision, sourceFingerprint: fingerprint,
    device: "Observed physical phone", browser: target === "ios-safari" ? "Safari" : "Chrome",
    route: "/tools/image-resize/", observedAt: "2026-10-10T09:00:00Z",
    source: { width: 100, height: 100, pixels: 10000 },
    output: { width: 50, height: 50, pixels: 2500 },
    thresholdCoverage: { sourcePixelLimitFraction: 0.99, decodedWorkingSetLimitFraction: 0.98 },
    policyLimits: { sourcePixelLimit: 20000 }, maxSourcePixelsTested: 10000, maxEstimatedDecodedBytesTested: 40000,
    checks: {
      filesOrPhotosPicker: "PASS", resizeCompleted: "PASS", verifiedDownloadOpened: "PASS",
      noCrashOrReload: "PASS", mobileLayoutUsable: "PASS", boundaryPolicyCase: "PASS",
    },
  };
}

function fixture(): ScopeEvidence405 {
  const checks = Object.fromEntries([
    "toolSurface", "cloudflareStaticAssets", "publicSiteUrl", "publicMetadata", "staticAssets",
    "truthfulClaims", "gold", "browserEvidence", "physicalDeviceEvidence", "rollback",
  ].map((key) => [key, "PASS"]));
  return {
    revision, sourceFingerprint: fingerprint, workingTreeDirty: false,
    catalog: [
      { id: "pdf-rotate", route: "/tools/pdf-rotate" },
      { id: "image-resize", route: "/tools/image-resize" },
    ],
    requestedIds: ["pdf-rotate"],
    goldReceipts: [
      {
        toolId: "pdf-rotate", status: "GOLD", schemaVersion: 1, revision,
        sourceFingerprint: fingerprint, runtime: { location: "LOCAL" },
        oracleEntryId: "oracle-rotate", fixtureFamilies: ["pdf-page-oracle"],
        identities: { manifestSha256: sha },
      },
    ],
    browser: {
      revision, sourceFingerprint: fingerprint,
      browserMatrix: { requestedEngines: ["chrome", "edge", "chromium", "firefox", "webkit"].map(browserEngine) },
      staticInspection: { bundleBaseline: { gate: "PASS" } },
      freshAcceptance: [{ status: "PASS" }],
    },
    physicalReceipts: [physical("ios-safari"), physical("android-chrome")],
    rollback: {
      schemaVersion: 1, kind: "cloudflare-static-assets-rollback", status: "VERIFIED",
      externalDeploymentPerformed: true, currentRevision: revision, sourceFingerprint: fingerprint,
      currentDeploymentId: "new-deployment", previousKnownGoodDeploymentId: "old-deployment",
      rollbackCommand: "wrangler rollback old-deployment",
      dryRunCommand: "wrangler deploy --dry-run --outdir .wrangler-dry-run",
      rollbackVerified: true, reason: "synthetic regression test",
    },
    cumulative: {
      schemaVersion: 1, kind: "release-validation", generatedBy: "scripts/validate-release.ts",
      revision, sourceFingerprint: fingerprint, workingTreeDirty: false,
      checks, validation: { schemaVersion: 1, status: "PASS", findings: [] },
      staticAssets: { status: "PASS", contentSha256: sha },
    },
    staging: {
      schemaVersion: 1, kind: "staging-canary-rollback", status: "PASS",
      environment: "staging", externalRunObserved: true, simulated: false,
      sourceFingerprint: fingerprint, scopeIds: ["pdf-rotate"], observedAt: "2026-10-10T09:00:00Z",
      rollback: {
        beforeSha256: sha, afterSha256: "d".repeat(64), restoredSha256: sha,
        previousVersion: "old-deployment", candidateVersion: "new-deployment",
      },
      checks: {
        canaryHealth: "PASS", rollbackRestored: "PASS", previousVersionAccessible: "PASS",
        candidateRestored: "PASS", rejectedInput: "PASS", oversizeInput: "PASS",
        partialOutput: "PASS", cancellation: "PASS",
      },
    },
    distSha256: sha,
  };
}

function status(input: ScopeEvidence405, id: string) {
  return assessReleaseScope405(input).gates.find((item) => item.id === id);
}

describe("#405 scope release read-only gates", () => {
  it("binds selected catalog IDs to a stable source-dependent fingerprint and emits all gates", () => {
    const good = fixture();
    const result = assessReleaseScope405(good);
    expect(result.decision).toBe("EVIDENCE_READY_FOR_REVIEW");
    expect(result.scope).toEqual([{
      id: "pdf-rotate", route: "/tools/pdf-rotate",
      scopeFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }]);
    expect(result.gates).toHaveLength(7);
    expect(result.gates.every((item) => item.status === "PASS")).toBe(true);
    const inventoried = assessReleaseScope405({
      ...good,
      receiptFiles: [{ kind: "gold", path: "quality/receipts/pdf/pdf-rotate.gold.json", sha256: sha }],
    });
    expect(inventoried.receiptFiles).toEqual([{
      kind: "gold", path: "quality/receipts/pdf/pdf-rotate.gold.json", sha256: sha,
    }]);
    const changed = assessReleaseScope405({ ...good, sourceFingerprint: "f".repeat(64) });
    expect(changed.scope[0]?.scopeFingerprint).not.toBe(result.scope[0]?.scopeFingerprint);
    expect(changed.decision).toBe("NO_GO");
  });

  it("rejects missing, weak, duplicated and source-stale Gold for the chosen tool", () => {
    const good = fixture();
    expect(status({ ...good, goldReceipts: [] }, "gold")?.codes).toContain("GOLD_RECEIPT_MISSING");
    expect(status({ ...good, goldReceipts: [{ toolId: "pdf-rotate", status: "GOLD" }] }, "gold")?.codes).toContain("GOLD_RECEIPT_EVIDENCE_MISSING");
    expect(status({ ...good, goldReceipts: [...good.goldReceipts, ...good.goldReceipts] }, "gold")?.codes).toContain("GOLD_RECEIPT_DUPLICATE");
    expect(status({ ...good, goldReceipts: [{ ...good.goldReceipts[0]!, sourceFingerprint: "f".repeat(64) }] }, "gold")?.codes).toContain("GOLD_RECEIPT_SOURCE_STALE");
    expect(status({ ...good, requestedIds: ["image-resize"] }, "gold")?.codes).toContain("GOLD_RECEIPT_MISSING");
  });

  it("does not turn desktop browser evidence into physical evidence", () => {
    const good = fixture();
    expect(status({ ...good, physicalReceipts: [] }, "physical")?.codes).toContain("PHYSICAL_DEVICE_EVIDENCE_MISSING");
    expect(status({ ...good, physicalReceipts: [physical("ios-safari")] }, "physical")?.codes).toContain("PHYSICAL_DEVICE_EVIDENCE_MISSING");
    expect(status({ ...good, browser: { revision, sourceFingerprint: fingerprint } }, "browser")?.codes).toContain("BROWSER_MATRIX_MISSING");
    expect(status({ ...good, browser: { ...good.browser as object, sourceFingerprint: "f".repeat(64) } }, "browser")?.codes).toContain("BROWSER_EVIDENCE_SOURCE_STALE");
  });

  it("requires external rollback evidence, fresh staging canary and all failure cases", () => {
    const good = fixture();
    expect(status({ ...good, rollback: undefined }, "rollback")?.codes).toContain("ROLLBACK_NOT_VERIFIED");
    expect(status({ ...good, rollback: { ...good.rollback as object, sourceFingerprint: "f".repeat(64) } }, "rollback")?.codes).toContain("ROLLBACK_SOURCE_STALE");
    expect(status({ ...good, staging: undefined }, "staging-canary")?.codes).toContain("STAGING_CANARY_NOT_RUN");
    const stages = good.staging as { checks: Record<string, string> };
    expect(status({ ...good, staging: { ...stages, simulated: true, checks: { ...stages.checks, cancellation: "NOT_RUN" } } }, "staging-canary")?.codes)
      .toEqual(expect.arrayContaining(["STAGING_CANARY_PROOF_INVALID", "STAGING_CANARY_CASES_UNPROVEN"]));
    expect(status({ ...good, staging: { ...stages, scopeIds: ["image-resize"] } }, "staging-canary")?.codes).toContain("STAGING_CANARY_SCOPE_MISSING");
  });

  it("rejects stale cumulative validation or changed dist assets, even if scoped Gold passes", () => {
    const good = fixture();
    expect(status({ ...good, cumulative: undefined }, "cumulative-release")?.status).toBe("BLOCKED");
    expect(status({ ...good, cumulative: { ...good.cumulative as object, sourceFingerprint: "f".repeat(64) } }, "cumulative-release")?.codes).toContain("CUMULATIVE_SOURCE_STALE");
    expect(status({ ...good, distSha256: null }, "cumulative-release")?.codes).toContain("CUMULATIVE_ASSETS_STALE");
    expect(status({ ...good, distSha256: "f".repeat(64) }, "cumulative-release")?.codes).toContain("CUMULATIVE_ASSETS_STALE");
    expect(status({ ...good, workingTreeDirty: true }, "source")?.codes).toContain("SOURCE_WORKTREE_DIRTY");
  });

  it("rejects unknown, duplicate and empty scopes", () => {
    const good = fixture();
    for (const requestedIds of [[], ["not-in-catalog"], ["pdf-rotate", "pdf-rotate"]]) {
      expect(() => assessReleaseScope405({ ...good, requestedIds })).toThrow(/unique, known/);
    }
  });
});

describe("#405 isolated local rollback simulation", () => {
  it("proves byte restoration for synthetic candidate and prior versions only", async () => {
    expect(await runIsolatedRollbackDrill405()).toEqual({
      status: "PASS", authority: "LOCAL_FIXTURE_ONLY",
      steps: [
        "previous-fixture-observed", "candidate-fixture-observed",
        "previous-fixture-restored", "candidate-fixture-restored",
      ],
    });
  });

  it("fails on corrupt/missing previous snapshot and respects cancellation", async () => {
    const corrupt = await runIsolatedRollbackDrill405("corrupt-rollback");
    const missing = await runIsolatedRollbackDrill405("missing-previous");
    const canceled = await runIsolatedRollbackDrill405("cancel-before-rollback");
    expect(corrupt.status).toBe("FAIL");
    expect(missing.status).toBe("FAIL");
    expect(canceled.status).toBe("CANCELED");
    for (const item of [corrupt, missing, canceled]) {
      expect(item.authority).toBe("LOCAL_FIXTURE_ONLY");
      expect(item.steps).not.toContain("candidate-fixture-restored");
    }
  });
});

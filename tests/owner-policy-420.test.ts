import { describe, expect, it } from "vitest";
import {
  OWNER_RELEASE_POLICY_420,
  assessOwnerPolicy420,
  validateOwnerAndroidPolicy420,
  validateOwnerBrowserPolicy420,
  validateOwnerIosPolicy420,
} from "../src/release/owner-policy-420";
import { prepublishSteps404, releasePolicy420Enabled } from "../scripts/prepublish-404";

const SHA = "c38da86458eec0512721a5b4abc612b1f7b74a67";
const FINGERPRINT = "a".repeat(64);
const TOOL_HTML = "b".repeat(64);
const AUDIO_HTML = "c".repeat(64);

const engine = (name: string) => ({
  engine: name,
  status: "PASS",
  coreRoute: "PASS",
  homeRoute: "PASS",
  directoryRoute: "PASS",
  mobile: { toolOverflow: false, homeOverflow: false, directoryOverflow: false },
  lazy: { observedEngineChunk: ["engine.js"] },
  networkPrivacy: { externalTaskRequests: 0, taskContentLeaks: 0, nonGetTaskRequests: 0 },
  performance: { navigationMs: 120 },
  consoleErrors: [],
  pageErrors: [],
  failures: [],
});

const browserReceipt = (overrides: Record<string, unknown> = {}) => ({
  revision: SHA,
  sourceFingerprint: FINGERPRINT,
  generatedAt: "2026-10-21T00:00:00.000Z",
  browserMatrix: {
    requestedEngines: [
      engine("chrome"), engine("chromium"), engine("firefox"), engine("webkit"),
      { engine: "edge", status: "UNAVAILABLE", classification: "local-executable-unavailable", reason: "no Edge on this host" },
    ],
  },
  staticInspection: { bundleBaseline: { gate: "PASS" } },
  freshAcceptance: [
    { command: "npm run build", status: "PASS" },
    { command: "node scripts/acceptance/browser-performance-matrix.mjs (edge)", status: "UNAVAILABLE" },
  ],
  ...overrides,
});

const androidReceipt = (overrides: Record<string, unknown> = {}) => ({
  evidenceKind: "ANDROID_EMULATOR_CHROME_SIMULATED",
  physicalDeviceObserved: false,
  build: { revision: SHA, route: "/tools/image-resize/", htmlSha256: TOOL_HTML },
  browser: { package: "com.android.chrome", userAgent: "Mozilla/5.0 (Linux; Android 15) Chrome/155.0.0.0 Mobile Safari/537.36" },
  operation: { androidPickerOpened: true, fileSelected: true, resizedInChrome: true, androidDownloadSaved: true },
  negative: { pickerCancelledWithoutSelection: true, corruptJpegRefused: true, offsiteRequests: 0 },
  output: { reopened: true, decoder: "sharp/libvips", sha256: "d".repeat(64) },
  ...overrides,
});

const iosReceipt = (overrides: Record<string, unknown> = {}) => ({
  evidenceKind: "SIMULATED_DESKTOP_WEBKIT_MOBILE",
  physicalDeviceObserved: false,
  build: { revision: SHA, pages: { "/tools/image-resize/": TOOL_HTML, "/tools/audio-generator/": AUDIO_HTML } },
  routes: [{ route: "/tools/image-resize/", status: "PASS" }, { route: "/tools/audio-generator/", status: "PASS" }],
  ...overrides,
});

const pages = { "tools/image-resize/": TOOL_HTML, "tools/audio-generator/": AUDIO_HTML };

describe("owner release policy 20/10/2026 for Strumentini.it", () => {
  it("records the owner's words instead of reinterpreting them", () => {
    expect(OWNER_RELEASE_POLICY_420.statement).toContain("Pubblica con test automatici verdi");
    expect(OWNER_RELEASE_POLICY_420.statement).toContain("telefono fisico è opzionale dopo la release");
    expect(OWNER_RELEASE_POLICY_420.mobileDecision).toBe("basta simulatore ed emulatore");
    expect(OWNER_RELEASE_POLICY_420.requiredBrowserEngines).toEqual(["chrome", "chromium", "firefox", "webkit"]);
  });

  it("labels waived evidence as WAIVED_OWNER_DECISION, never as PASS", () => {
    const result = assessOwnerPolicy420({
      revision: SHA, sourceFingerprint: FINGERPRINT, workingTreeDirty: false,
      browserReceipt: browserReceipt(), browserReceiptPath: "browser.json",
      androidReceipt: androidReceipt(), androidReceiptPath: "android.json",
      iosReceipt: iosReceipt(), iosReceiptPath: "ios.json",
      distPageHashes: pages,
    });
    expect(result.status).toBe("PASS");
    expect(result.waived).toEqual([
      { gate: "gold-per-tool", status: "WAIVED_OWNER_DECISION" },
      { gate: "physical-device", status: "WAIVED_OWNER_DECISION" },
    ]);
    expect(JSON.stringify(result.waived)).not.toContain("PASS");
  });

  it("refuses a stale or incomplete browser matrix", () => {
    const stale = validateOwnerBrowserPolicy420({
      browser: browserReceipt({ revision: "1".repeat(40) }), path: "browser.json",
      revision: SHA, sourceFingerprint: FINGERPRINT,
    });
    expect(stale.map((item) => item.code)).toContain("POLICY_BROWSER_SOURCE_STALE");
    const missing = validateOwnerBrowserPolicy420({
      browser: browserReceipt({ browserMatrix: { requestedEngines: [engine("chrome"), engine("chromium"), engine("firefox")] } }),
      path: "browser.json", revision: SHA, sourceFingerprint: FINGERPRINT,
    });
    expect(missing.map((item) => item.code)).toContain("POLICY_BROWSER_ENGINE_MISSING");
    const brokenRoute = validateOwnerBrowserPolicy420({
      browser: browserReceipt({ browserMatrix: { requestedEngines: [
        engine("chrome"), engine("chromium"), engine("firefox"), { ...engine("webkit"), homeRoute: "FAIL" },
      ] } }),
      path: "browser.json", revision: SHA, sourceFingerprint: FINGERPRINT,
    });
    expect(brokenRoute.map((item) => item.code)).toContain("POLICY_BROWSER_ROUTE_UNPROVEN");
  });

  it("accepts a simulator/emulator receipt only when it never claims physical hardware", () => {
    const physicalClaim = validateOwnerAndroidPolicy420({
      receipt: androidReceipt({ physicalDeviceObserved: true }), path: "android.json",
      revision: SHA, distPageHashes: pages,
    });
    expect(physicalClaim.map((item) => item.code)).toContain("POLICY_MOBILE_ANDROID_KIND");
    const staleBytes = validateOwnerAndroidPolicy420({
      receipt: androidReceipt({ build: { revision: SHA, route: "/tools/image-resize/", htmlSha256: "e".repeat(64) } }),
      path: "android.json", revision: SHA, distPageHashes: pages,
    });
    expect(staleBytes.map((item) => item.code)).toContain("POLICY_MOBILE_ANDROID_SOURCE_STALE");
    expect(validateOwnerAndroidPolicy420({
      receipt: androidReceipt(), path: "android.json", revision: SHA, distPageHashes: pages,
    })).toEqual([]);
  });

  it("refuses an iOS receipt whose compiled page hashes no longer match the release", () => {
    const stale = validateOwnerIosPolicy420({
      receipt: iosReceipt({ build: { revision: SHA, pages: { "/tools/image-resize/": "f".repeat(64) } } }),
      path: "ios.json", revision: SHA, distPageHashes: pages,
    });
    expect(stale.map((item) => item.code)).toContain("POLICY_MOBILE_IOS_SOURCE_STALE");
    expect(validateOwnerIosPolicy420({
      receipt: iosReceipt(), path: "ios.json", revision: SHA, distPageHashes: pages,
    })).toEqual([]);
  });

  it("blocks promotion when any required automatic gate is missing", () => {
    const result = assessOwnerPolicy420({
      revision: SHA, sourceFingerprint: FINGERPRINT, workingTreeDirty: false,
      browserReceipt: undefined, browserReceiptPath: "browser.json",
      androidReceipt: undefined, androidReceiptPath: "android.json",
      iosReceipt: undefined, iosReceiptPath: "ios.json",
      distPageHashes: pages,
    });
    expect(result.status).toBe("NO_GO");
    expect(result.gates).toEqual({ source: "PASS", browser: "NO_GO", "simulated-mobile": "NO_GO" });
  });

  it("routes the guarded publisher through the automatic gate unless strict mode is asked for", () => {
    expect(releasePolicy420Enabled({})).toBe(true);
    expect(releasePolicy420Enabled({ STRUMENTINI_RELEASE_STRICT: "1" })).toBe(false);
    const policy = prepublishSteps404(SHA, true);
    expect(policy.map((step) => step.name)).toEqual([
      "source-and-engine-tests", "python-ticket-oracle", "astro-source-validation",
      "cumulative-build", "cloudflare-static-dry-run", "owner-policy-automatic-admission",
      "wrangler-production-deploy",
    ]);
    expect(policy.find((step) => step.name === "owner-policy-automatic-admission")?.args)
      .toEqual(["node_modules/tsx/dist/cli.mjs", "scripts/release-gate-420.ts", `--expected-sha=${SHA}`]);
    expect(policy.filter((step) => step.publishes).map((step) => step.name)).toEqual(["wrangler-production-deploy"]);
    const strict = prepublishSteps404(SHA, false);
    expect(strict.map((step) => step.name)).toContain("scope-and-staging-rollback-admission");
    expect(strict.map((step) => step.name)).not.toContain("owner-policy-automatic-admission");
  });
});

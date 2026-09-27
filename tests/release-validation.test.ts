import { describe, expect, it } from "vitest";
import {
  buildRobotsTxt,
  buildSitemapXml,
  createUnprovenRollbackReceipt,
  extractPublicMetadata,
  validateCloudflareStaticAssets,
  validateExternalEvidence,
  validateGoldReceipts,
  validatePublicMetadata,
  validatePublicSiteUrl,
  validateRelease,
  validateRollbackReceipt,
  validateRobotsTxt,
  validateSitemapXml,
  validateStaticAssetSurface,
  validateToolSurface,
  validateTruthfulClaims,
  RELEASE_TOOL_COUNT,
} from "../src/release/validation";

const validCloudflareConfig = `{
  "name": "strumentiutili-it",
  "compatibility_date": "2026-09-24",
  "assets": { "directory": "./dist", "not_found_handling": "404-page" }
}`;

function toolSurface() {
  const catalog = Array.from({ length: RELEASE_TOOL_COUNT }, (_, index) => ({
    id: `tool-${index}`,
    route: `/tools/tool-${index}`,
  }));
  return {
    catalog,
    manifests: catalog.map((entry) => `src/tools/${entry.id}/manifest.ts`),
    pages: catalog.map((entry) => `src/pages${entry.route}.astro`),
  };
}

describe("release validation tool surface", () => {
  it("requires exactly 200 manifests, catalog entries, and public pages", () => {
    const surface = toolSurface();
    expect(validateToolSurface(surface.catalog, surface.manifests, surface.pages)).toEqual([]);
  });

  it("fails closed on an unindexed public page and a count mismatch", () => {
    const surface = toolSurface();
    const findings = validateToolSurface(surface.catalog.slice(1), surface.manifests, [...surface.pages.slice(1), "src/pages/tools/extra.astro"]);
    expect(findings.map((item) => item.code)).toEqual(expect.arrayContaining(["TOOL_COUNT_MISMATCH", "UNINDEXED_MANIFEST", "UNINDEXED_TOOL_PAGE"]));
  });
});

describe("Cloudflare static asset validation", () => {
  it("accepts a static dist configuration without a Worker entry", () => {
    expect(validateCloudflareStaticAssets(validCloudflareConfig)).toEqual([]);
    expect(validatePublicSiteUrl("https://release.example.test")).toEqual([]);
    expect(validatePublicSiteUrl("https://example.invalid").map((item) => item.code)).toEqual(["PUBLIC_SITE_URL_PLACEHOLDER"]);
  });

  it("rejects a non-static or worker-first configuration", () => {
    const findings = validateCloudflareStaticAssets(`{
      "compatibility_date": "2026-09-24",
      "main": "src/worker.ts",
      "assets": { "directory": "./public", "not_found_handling": "single-page-application", "run_worker_first": true }
    }`);
    expect(findings.map((item) => item.code)).toEqual(expect.arrayContaining([
      "CLOUDFLARE_ASSETS_DIRECTORY",
      "CLOUDFLARE_NOT_FOUND_HANDLING",
      "CLOUDFLARE_WORKER_MAIN",
      "CLOUDFLARE_WORKER_FIRST",
    ]));
  });
});

describe("public metadata and discovery", () => {
  it("builds a complete canonical metadata surface and validates it", () => {
    const html = `<!doctype html><html><head>
      <title>Example tool</title>
      <meta name="description" content="Runs a bounded local task.">
      <meta name="robots" content="index, follow">
      <link rel="canonical" href="https://example.invalid/tools/example/">
      <link rel="sitemap" href="/sitemap.xml">
      <meta property="og:title" content="Example tool">
      <meta property="og:description" content="Runs a bounded local task.">
      <meta property="og:type" content="website">
      <meta property="og:url" content="https://example.invalid/tools/example/">
      <meta property="og:image" content="https://example.invalid/og-image.png">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="Example tool">
      <meta name="twitter:description" content="Runs a bounded local task.">
      <meta name="twitter:image" content="https://example.invalid/og-image.png">
    </head></html>`;
    expect(validatePublicMetadata(extractPublicMetadata(html), "dist/tools/example/index.html", "https://example.invalid/tools/example/")).toEqual([]);
  });

  it("keeps sitemap URLs and robots discovery in sync", () => {
    const site = new URL("https://example.invalid");
    const sitemap = buildSitemapXml(site, ["/", "/library/", "/tools/example"]);
    const urls = ["/", "/library/", "/tools/example"].map((path) => new URL(path === "/" ? path : `${path.replace(/\/+$/u, "")}/`, site).href);
    expect(validateSitemapXml(sitemap, urls)).toEqual([]);
    const robots = buildRobotsTxt(site);
    expect(validateRobotsTxt(robots, new URL("sitemap.xml", site).href)).toEqual([]);
  });

  it("requires hashed static assets and every catalog page", () => {
    const surface = toolSurface();
    const files = [
      "index.html",
      "library/index.html",
      "404.html",
      "sitemap.xml",
      "robots.txt",
      "og-image.png",
      "_astro/app.A1b2C3d4.js",
      ...surface.catalog.map((entry) => `${entry.route.slice(1)}/index.html`),
    ];
    expect(validateStaticAssetSurface({ distExists: true, files, toolIds: surface.catalog.map((entry) => entry.id) }, surface.catalog)).toEqual([]);
    const findings = validateStaticAssetSurface({ distExists: true, files: [...files, "_astro/unhashed.js"], toolIds: [] }, surface.catalog);
    expect(findings.some((item) => item.code === "STATIC_ASSET_NOT_CONTENT_HASHED")).toBe(true);
  });
});

describe("truthful claims and evidence boundaries", () => {
  it("allows concrete local mechanics and rejects unsupported public claims", () => {
    expect(validateTruthfulClaims([{ path: "src/pages/tools/example.astro", text: "Runs on this device. The file is not uploaded." }])).toEqual([]);
    expect(validateTruthfulClaims([{ path: "src/pages/index.astro", text: "StrumentiUtili.it" }])).toEqual([]);
    const findings = validateTruthfulClaims([
      { path: "src/pages/index.astro", text: "The best unique workspace for 200 Gold tools." },
      { path: "src/pages/tools/other.astro", text: "[BRAND] is privacy-first and available offline." },
    ]);
    expect(findings.map((item) => item.code)).toEqual(expect.arrayContaining([
      "PUBLIC_BRAND_PLACEHOLDER",
      "UNSUPPORTED_BEST",
      "UNSUPPORTED_UNIQUE",
      "UNSUPPORTED_PRIVACY",
      "UNSUPPORTED_SCALE",
      "UNSUPPORTED_PROMISE",
    ]));
  });

  it("does not convert an unproven rollback into deployment evidence", () => {
    const receipt = createUnprovenRollbackReceipt("abc123");
    expect(validateRollbackReceiptForTest(receipt)).toEqual([]);
    expect(validateRollbackReceiptForTest({ ...receipt, status: "VERIFIED" }).map((item) => item.code)).toEqual(expect.arrayContaining(["ROLLBACK_VERIFIED_FIELD", "ROLLBACK_VERIFIED_DEPLOYMENT_FLAG"]));
  });

  it("reports missing Gold, browser, and physical evidence as blockers", () => {
    const surface = toolSurface();
    expect(validateGoldReceipts(surface.catalog, [], "abc123").map((item) => item.code)).toContain("GOLD_RECEIPT_MISSING");
    const weak = validateGoldReceipts([surface.catalog[0]!], [{ toolId: "tool-0", status: "GOLD", revision: "abc123" }], "abc123");
    expect(weak.map((item) => item.code)).toContain("GOLD_RECEIPT_EVIDENCE_MISSING");
    const evidence = validateExternalEvidence({ browser: undefined, physicalDeviceReceipts: [] }, "abc123");
    expect(evidence.map((item) => item.code)).toEqual(expect.arrayContaining(["BROWSER_EVIDENCE_MISSING", "PHYSICAL_DEVICE_EVIDENCE_MISSING"]));
  });

  it("rejects malformed browser entries and incomplete physical checks", () => {
    const evidence = validateExternalEvidence({
      browser: {
        revision: "abc123",
        browserMatrix: { requestedEngines: [null] },
        staticInspection: {},
        freshAcceptance: [],
      },
      physicalDeviceReceipts: [{
        status: "PASS",
        target: "ios-safari",
        revision: "abc123",
        device: "Test phone",
        browser: "Safari",
        route: "/tools/image-resize/",
        observedAt: new Date().toISOString(),
        checks: {},
      }],
    }, "abc123");
    expect(evidence.map((item) => item.code)).toEqual(expect.arrayContaining([
      "BROWSER_ENGINE_MALFORMED",
      "BROWSER_BUNDLE_INSPECTION_MISSING",
      "BROWSER_ACCEPTANCE_MISSING",
      "PHYSICAL_DEVICE_CHECKS",
      "PHYSICAL_DEVICE_EVIDENCE_MISSING",
    ]));
  });
});

describe("consolidated release result", () => {
  it("reports blocked rather than passing when rollback proof is absent", () => {
    const surface = toolSurface();
    const result = validateRelease({
      catalog: surface.catalog,
      manifestFiles: surface.manifests,
      toolPageFiles: surface.pages,
      cloudflareConfig: validCloudflareConfig,
      rollbackReceipt: createUnprovenRollbackRevision(),
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.findings.map((item) => item.code)).toEqual(expect.arrayContaining(["PUBLIC_METADATA_NOT_RUN", "GOLD_RECEIPTS_NOT_RUN", "EXTERNAL_EVIDENCE_NOT_RUN"]));
    expect(result.catalogToolCount).toBe(RELEASE_TOOL_COUNT);
  });
});

function validateRollbackReceiptForTest(value: unknown) {
  return validateRollbackReceipt(value);
}

function createUnprovenRollbackRevision() {
  return createUnprovenRollbackReceipt("abc123");
}

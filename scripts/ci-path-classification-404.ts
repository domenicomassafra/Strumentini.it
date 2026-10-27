export type ChangeDomain = "docs" | "frontend" | "shared" | "spreadsheet" | "worker-auth" | "d1" | "pdf" | "image" | "italy" | "ci" | "unknown";

/** Real Tesseract scripts, WebAssembly and the downloaded model are executable
 * or parser-consumed bytes in the OCR browser pipeline, not decorative assets. */
export const shippedOcrRuntimeAsset = /^public\/ocr-246\/(?:core\/[^/]+\.(?:js|wasm)|vendor\/[^/]+\.js|lang\/[^/]+\.traineddata\.gz)$/u;

/** Browser-worker XLSX import/export and the test seams that constrain it.
 * Keep the shared domain so all existing source checks continue to run. */
const spreadsheetBoundary = /^(?:src\/engines\/table\/spreadsheet-interchange\.ts|src\/engines\/office-local\/(?:worker|client|worker-protocol)\.ts|tests\/(?:spreadsheet-interchange|donor-spreadsheets-370)\.test\.ts)$/u;

/** Actual Italy fiscal tool routes and their local implementations. Keep this
 * scoped to tool names; generic business-math and other pages are not taxes. */
const fiscalToolPath = /^src\/(?:pages\/tools|tools)\/(?:codice-fiscale|partita-iva|iva-|irpef-|forfettario|fatturapa-|stipendio-netto|calcoli-fiscali-italia|tfr-calculator|gestione-separata-contributi|inps-artigiani-commercianti)/u;
const fiscalToolComponent = /^src\/components\/tools\/(?:ItalyContributionTools\.tsx|TfrCalculator15\.tsx|codice-fiscale\/)/u;

/** Only known documentation roots count as docs; never infer from a .md suffix. */
export function classifyPath(path: string): readonly ChangeDomain[] {
  if (!path || path.startsWith("/") || path.includes("\\") || /[\u0000-\u001f\u007f\ufffd]/u.test(path) || path.split("/").some((part) => part === "." || part === ".." || part === "")) return ["unknown"];
  // Reviewed root hooks and agent budget files require CI/security gates.
  if ([".githooks/pre-push", ".githooks/pre-commit", ".gitattributes", ".gitignore", ".agent-size-baseline", ".agent-size-ignore", "orca.yaml", "scripts/ci-path-classification-404.ts"].includes(path)) return ["ci"];
  if (path.startsWith(".github/") || path === "package.json" || path === "package-lock.json" || path === "astro.config.mjs" ||
      path === "tsconfig.json" || path === "vitest.config.ts" || path === "wrangler.toml") return ["ci"];
  // Both Cloudflare deploy contracts can route the Worker or bind D1, so
  // staging config is just as review-sensitive as the production contract.
  if (path === "wrangler.jsonc" || path === "worker/wrangler.staging.jsonc") return ["worker-auth", "d1", "ci"];
  if (path === "vitest.workerd.config.ts" || /^tests\/workerd\//u.test(path)) return ["worker-auth", "d1"];
  // The staging publisher and its refusal test can change deployment targets;
  // never reduce an isolated edit to generic shared-source checks.
  if (path === "scripts/deploy-staging-328.ts" || path === "tests/deploy-staging-328.test.ts") return ["worker-auth", "d1", "ci"];
  // These tests carry the CPU-bound password/auth and Turnstile trust contract.
  // An isolated test-only edit must still demand independent auth/security proof.
  if (/^tests\/(?:auth-worker-cloudflare-kdf-328|auth-password-race-328|auth-csrf-328|password-kdf-328|staging-isolation-328|feasibility-server-optin-348)\.test\.ts$/u.test(path)) return ["worker-auth", "d1"];
  if (/^tests\/(?:turnstile-328-20261013-submission-race|turnstile-login-wave20-328|account-page-turnstile-328-329)\.browser\.mjs$/u.test(path)) return ["frontend", "worker-auth"];
  // This public site-key is the browser half of real Turnstile Siteverify:
  // a change requires auth, browser, and security gates, not generic shared.
  if (path === "src/config/security.ts") return ["frontend", "worker-auth"];
  // Any implementation/test change to the optional production publishing
  // boundary must demand independent security review. Generic scripts/tests
  // otherwise fall into "shared" and omit security-review entirely.
  if (path === "scripts/prepublish-404.ts" || /^tests\/ci-404-2026\d{4}-[a-z0-9-]+\.test\.ts$/u.test(path)) return ["ci"];
  if (/^(scripts\/(ci-change-impact-404\.ts|ci-path-classification-404\.ts|validate-release\.ts|audit-gold-source-binding-347\.ts|lib\/(?:current-revision|current-remote-main-404)\.ts|build-certification-index\.ts)|src\/(release\/|quality\/)|tests\/release-validation\.test\.ts)/u.test(path)) return ["ci"];
  // Donor provenance reads this JSON as executable audit input, not prose.
  // Altering its package/license records must be reviewed and tested.
  if (path === "docs/donor-provenance-366-candidate-packages-2026-10-10.json") return ["ci"];
  // design/WORLD.md controls the shipped palette's source contract. It is
  // reviewed frontend input, not disposable documentation; unknown design
  // files must still fail closed rather than receive a broad wildcard pass.
  if (path === "design/WORLD.md") return ["frontend"];
  // Historical research retirement #498: these known reports and the old
  // Impeccable journal are prose/data, not executable product inputs. Keep
  // unreviewed design/build paths unknown; a census script still needs CI.
  if (["IMPLEMENTATION-PLAN.md", "design/FRONTEND-SYSTEM-STANDARDIZATION.md", "research/implementation/10-hash-dependency-gate.md",
       ".impeccable/build/state.json", "spikes/core-engines/README.md", "spikes/heavy-local-feasibility/README.md"].includes(path)) return ["docs"];
  if (path === "research/lanes/06-oss-donor-evidence/build_census.py") return ["ci"];
  // Only the exact retired records are reviewed documentation. Future inputs
  // under this deleted tree must be evaluated before CI can skip them.
  if ([
    "research/lanes/01-market-demand-jobs-census.md",
    "research/lanes/02-competitor-business-model-stress-test.md",
    "research/lanes/03-brand-naming-gtm.md",
    "research/lanes/03-name-screen.csv",
    "research/lanes/06-oss-donor-evidence/census-summary.json",
    "research/lanes/06-oss-donor-evidence/deep-primary-metadata.json",
    "research/lanes/06-oss-donor-evidence/npm-latest-metadata.json",
    "research/lanes/06-oss-donor-evidence/package-seed.json",
    "research/lanes/06-oss-donor-matrix.csv",
    "research/lanes/06-oss-github-donor-census.md",
    "research/lanes/07-core-engine-spike-results.md",
    "research/lanes/08-gold-oracle-factory.md",
    "research/lanes/09-heavy-browser-dependency-spike.md",
    "research/lanes/10-heavy-local-media-ocr-office-feasibility-refresh.md",
    "research/lanes/11-italian-syllabification-feasibility.md",
    "research/lanes/12-heavy-feasibility-ticket-decisions-267-275.md",
    "research/lanes/13-astronomy-location-date-feasibility.md",
  ].includes(path)) return ["docs"];
  if (path.startsWith("research/lanes/")) return ["unknown"];
  if (/^(README\.md|CHANGELOG\.md|LICENSE|AGENTS\.md|HANDOFF\.md|PROJECT-STATUS\.md)$/u.test(path) || /^(docs|tasks|\.scratch)\//u.test(path)) return ["docs"];
  if (path.startsWith("worker/migrations/")) return ["d1"];
  if (path.startsWith("worker/")) return ["worker-auth"];
  // The shipped OCR engine is executed in the browser even though its JS,
  // WASM and trained data live under public/ rather than src/. Changes to
  // these production bytes must select OCR/PDF tests and device evidence.
  if (shippedOcrRuntimeAsset.test(path)) return ["frontend", "pdf"];
  if (path.startsWith("src/engines/ocr/")) return ["pdf"];
  if (path.startsWith("src/components/tools/ocr246/")) return ["frontend", "pdf"];
  // The standalone evidence auditor and anonymous tax-journey browser tests
  // validate official year-scoped rules, even though neither filename follows
  // the generic `italy-` matcher. They cannot skip primary-source review.
  if (path === "scripts/validator/audit-397.ts" || path === "tests/audit-397.test.ts") return ["italy"];
  if (path === "tests/tax-journeys-396.browser.mjs") return ["frontend", "italy"];
  if (path === "scripts/forensic-redaction-378.ts" || path === "tests/forensic-redaction-378.test.ts") return ["pdf"];
  // Tool-specific Gold admission must never pass through generic script review.
  if (path === "scripts/audit-per-tool-proof-415.ts" || path === "tests/per-tool-proof-wave15-415.test.ts") return ["ci"];
  if (spreadsheetBoundary.test(path)) return ["shared", "spreadsheet"];
  if (/^(tests\/(auth-worker|google-auth-worker|turnstile-worker|vies-worker|current-revision-worker-347)\.test\.ts|scripts\/acceptance-auth\.mjs)/u.test(path)) return ["worker-auth"];

  // Match domain-specific code and fixtures before the broad shared/frontend roots.
  if (/^src\/(components\/tools\/(?:pdf\/|Pdf[^/]*|ImagesToPdf[^/]*)|pages\/tools\/(pdf-|ocr-|ooxml-))/u.test(path)) return ["frontend", "pdf"];
  if (/^src\/(components\/tools\/(?:image(?:\/|-)|Image[^/]*|Images[^/]*)|pages\/tools\/(image-|png-|jpg-|jpeg-|svg-|webp-))/u.test(path)) return ["frontend", "image"];
  if (fiscalToolComponent.test(path)) return ["frontend", "italy"];
  if (fiscalToolPath.test(path)) return path.startsWith("src/pages/") ? ["frontend", "italy"] : ["italy"];
  if (/^(src\/engines\/(pdf|ocr|ooxml)\/|src\/(tools|pages\/tools)\/(pdf-|ocr-|ooxml-)|tests\/(pdf-|ocr-|ooxml-|printable-pdf)|quality\/fixtures\/(pdf-|ocr-)|scripts\/[^/]*pdf[-.])/u.test(path)) return ["pdf"];
  if (/^(src\/engines\/image\/|src\/(tools|pages\/tools)\/(image-|png-|jpg-|jpeg-|svg-|webp-)|tests\/(image-|svg-)|quality\/fixtures\/image-|scripts\/[^/]*image[-.])/u.test(path)) return ["image"];
  if (/^(src\/engines\/italy\/|tests\/(italy-|italian-|vies-)|quality\/fixtures\/(italy-|italian-)|scripts\/[^/]*(italy|italian)[-.])/u.test(path)) return ["italy"];
  if (/^(src\/pages\/(accedi|registrati|impostazioni)\.astro|src\/components\/(auth|account)\/)/u.test(path)) return ["frontend", "worker-auth"];
  if (path.startsWith("src/pages/") || path.startsWith("src/components/") || path.startsWith("src/layouts/") ||
      path.startsWith("src/styles/") || path.startsWith("public/")) return ["frontend"];
  if (path.startsWith("scripts/") || path.startsWith("src/") || path.startsWith("tests/") ||
      path.startsWith("quality/") || path.startsWith("types/")) return ["shared"];
  return ["unknown"];
}

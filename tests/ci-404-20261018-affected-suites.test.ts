import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildImpactPlan, classifyPath } from "../scripts/ci-change-impact-404";

/**
 * AC-404.1 says the *affected engine and integration tests* run on each batch.
 * Selecting a family by filename prefix silently skips every real suite whose
 * name does not start with that prefix. Each case below names an existing
 * source file and the existing suites that exercise it directly, so a mapping
 * regression fails here instead of shipping an unreviewed engine change.
 */
const root = resolve(import.meta.dirname, "..");

async function realSuites(): Promise<string[]> {
  return (await readdir(resolve(root, "tests")))
    .filter((path) => path.endsWith(".test.ts"))
    .map((path) => `tests/${path}`)
    .sort();
}

describe("#404 affected engine and integration suites are selected, not just prefix families", () => {
  it("selects the real metadata-engine suites when the stripping engine changes", async () => {
    const suites = await realSuites();
    for (const source of ["src/engines/image/strip-metadata.ts", "src/engines/image/metadata.ts"]) {
      const plan = buildImpactPlan([source], suites);
      expect(plan.status, source).toBe("SOURCE_CHECKS_REQUIRED");
      expect(plan.domains, source).toContain("image");
      expect(plan.selectedTests, source).toEqual(expect.arrayContaining([
        "tests/metadata-394-20261013-jpeg-app.test.ts",
        "tests/metadata-394-20261013-jpeg-privacy-review.test.ts",
        "tests/metadata-forensic-394.test.ts",
        "tests/metadata-trailing-394.test.ts",
      ]));
      // The privacy-sensitive bytes keep their non-waivable gates.
      expect(plan.gates.map((gate) => [gate.id, gate.status]), source).toContainEqual(["security-review", "NOT_RUN"]);
      expect(plan.gates.map((gate) => gate.id), source).toContain("physical-device");
    }
  });

  it("selects the real forensic-redaction suites when the forensic PDF script changes", async () => {
    const suites = await realSuites();
    const plan = buildImpactPlan(["scripts/forensic-redaction-378.ts"], suites);
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.domains).toContain("pdf");
    expect(plan.selectedTests).toEqual(expect.arrayContaining([
      "tests/forensic-redaction-378.test.ts",
      "tests/forensic-redaction-378-20261013-pages-stream-bound.test.ts",
      "tests/forensic-redaction-378-20261014-authentic-signed.test.ts",
    ]));
    expect(plan.gates.map((gate) => [gate.id, gate.status])).toContainEqual(["security-review", "NOT_RUN"]);
    expect(plan.gates.map((gate) => gate.id)).toContain("physical-device");
  });

  it("selects the real PDF provenance-audit suites when the PDF engine changes", async () => {
    const suites = await realSuites();
    for (const source of ["src/engines/pdf/parser.ts", "src/engines/pdf/index.ts"]) {
      const plan = buildImpactPlan([source], suites);
      expect(plan.status, source).toBe("SOURCE_CHECKS_REQUIRED");
      expect(plan.domains, source).toContain("pdf");
      // scripts/audit-pdf-engine-provenance-369.ts enumerates src/engines/pdf.
      expect(plan.selectedTests, source).toEqual(expect.arrayContaining([
        "tests/audit-pdf-engine-provenance-369.test.ts",
        "tests/audit-pdf-engine-provenance-369-20261013-callee-alias.test.ts",
      ]));
    }
  });

  it("selects the real Italy fiscal suites when Italy engines or the official-source auditor change", async () => {
    const suites = await realSuites();
    const codiceFiscale = buildImpactPlan(["src/engines/italy/codice-fiscale-121.ts"], suites);
    expect(codiceFiscale.domains).toContain("italy");
    expect(codiceFiscale.selectedTests).toContain("tests/codice-fiscale-121-122.test.ts");
    expect(codiceFiscale.gates.map((gate) => gate.id)).toContain("official-source-year");

    const auditor = buildImpactPlan(["scripts/validator/audit-397.ts"], suites);
    expect(auditor.domains).toContain("italy");
    expect(auditor.selectedTests).toEqual(expect.arrayContaining([
      "tests/audit-397.test.ts",
      "tests/tax-source-inventory-397-20261013.test.ts",
    ]));
    expect(auditor.gates.map((gate) => [gate.id, gate.status])).toContainEqual(["official-source-year", "NOT_RUN"]);
  });

  it("admits every dated #404 CI regression suite as full CI source with the security gate", () => {
    for (const path of ["tests/ci-404-20261018-affected-suites.test.ts", "tests/ci-404-20261013-prepublish.test.ts"]) {
      expect(classifyPath(path), path).toContain("ci");
      const plan = buildImpactPlan([path], ["tests/release-validation.test.ts"]);
      expect(plan.domains, path).toContain("ci");
      expect(plan.gates.map((gate) => [gate.id, gate.status]), path).toContainEqual(["security-review", "NOT_RUN"]);
      expect(plan.gates.map((gate) => [gate.id, gate.status]), path).toContainEqual(["release-readiness", "NOT_RUN"]);
    }
  });
});

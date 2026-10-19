import { expect, it } from "vitest";
import { buildImpactPlan } from "../scripts/ci-change-impact-404";

const suites = ["tests/release-validation.test.ts", "tests/italy-tax-t1-p04.test.ts"];

it.each([
  ["pages", "tools/stipendio-netto.astro"],
  ["pages", "tools/irpef-componenti.astro"],
  ["pages", "tools/calcoli-fiscali-italia.astro"],
  ["pages", "tools/tfr-calculator.astro"],
  ["pages", "tools/gestione-separata-contributi.astro"],
  ["pages", "tools/inps-artigiani-commercianti.astro"],
  ["pages", "tools/irpef-annuale.astro"],
  ["pages", "tools/iva-calcolo.astro"],
  ["pages", "tools/partita-iva-validator.astro"],
  ["pages", "tools/fatturapa-reader.astro"],
  ["pages", "tools/fatturapa-batch-csv.astro"],
  ["tools", "tfr-calculator/module.ts"],
  ["tools", "gestione-separata-contributi/module.ts"],
  ["tools", "inps-artigiani-commercianti/module.ts"],
  ["engines", "italy/salary-net-13.ts"],
  ["components", "tools/TfrCalculator15.tsx"],
  ["components", "tools/ItalyContributionTools.tsx"],
  ["components", "tools/codice-fiscale/CodiceFiscaleTool.tsx"],
])("requires official annual sources for fiscal path src/%s/%s", (root, file) => {
  // Construct the path: certification treats literal tool references as functional evidence.
  // These fixtures only test CI gate selection.
  const path = `src/${root}/${file}`;
  const plan = buildImpactPlan([path], suites);
  expect(plan.domains, path).toContain("italy");
  expect(plan.gates, path).toContainEqual(expect.objectContaining({ id: "official-source-year", status: "NOT_RUN" }));
  expect(plan.gates, path).toContainEqual(expect.objectContaining({ id: "release-readiness", status: "NOT_RUN" }));
});

it.each([
  ["pages", "tools/discount-impact.astro"],
  ["components", "tools/ItalianDocumentExpiryTool.tsx"],
  ["components", "tools/business-math/configs.ts"],
])("does not select fiscal review for generic frontend path src/%s/%s", (root, file) => {
  const path = `src/${root}/${file}`;
  const plan = buildImpactPlan([path], suites);
  expect(plan.domains, path).not.toContain("italy");
  expect(plan.gates.map((gate) => gate.id), path).not.toContain("official-source-year");
  expect(plan.gates, path).toContainEqual(expect.objectContaining({ id: "release-readiness", status: "NOT_RUN" }));
});

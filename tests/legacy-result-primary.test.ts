import { describe, expect, it } from "vitest";
import {
  assertNoLegacyPrimaryOutputs,
  auditLegacyPrimaryOutputSource,
} from "../src/quality/legacy-result-primary";

describe("legacy primary-result detector", () => {
  it("catches raw JsonResult primary callers with exact path class", () => {
    const source = [
      "export function Fixture() {",
      "  return <ToolResultPanel eyebrow='x' placeholder='x'>",
      "    <JsonResult value={{ secret: 1 }} />",
      "  </ToolResultPanel>;",
      "}",
    ].join("\n");
    expect(auditLegacyPrimaryOutputSource("Fixture.tsx", source)).toEqual([
      expect.objectContaining({ file: "Fixture.tsx", pathClass: "raw-json-component" }),
    ]);
  });

  it("catches generic JSON serialization rendered through a primary result pre", () => {
    const source = [
      "function output(value: unknown) { return JSON.stringify(value, null, 2); }",
      "export function Fixture({ value }) {",
      "  return <ToolResultPanel eyebrow='x' placeholder='x'>",
      "    <pre class='result-json'>{output(value)}</pre>",
      "  </ToolResultPanel>;",
      "}",
    ].join("\n");
    expect(auditLegacyPrimaryOutputSource("Fixture.tsx", source)).toEqual([
      expect.objectContaining({ pathClass: "generic-json-primary" }),
    ]);
  });

  it("catches manual result-panel paths", () => {
    const source = "<section class='result-panel gutter'><strong>{value}</strong></section>";
    expect(auditLegacyPrimaryOutputSource("Manual.tsx", source)).toEqual([
      expect.objectContaining({ pathClass: "manual-result-panel" }),
    ]);
  });

  it("rejects a new manually authored primary output even with real consumer selectors", () => {
    const source = [
      "export function NewTool() {",
      "  return <form><section data-new-result className='gutter result-panel' data-state='success'>",
      "    <a download='example.pdf' href={url}>Scarica PDF</a>",
      "  </section></form>;",
      "}",
    ].join("\n");
    const findings = auditLegacyPrimaryOutputSource("src/components/tools/NewTool.tsx", source);
    expect(findings).toEqual([expect.objectContaining({ pathClass: "manual-result-panel" })]);
    expect(() => assertNoLegacyPrimaryOutputs(findings)).toThrow(/NewTool\.tsx/u);
  });

  it.each(["before", "after"] as const)(
    "rejects a manual primary result %s a secondary raw details block",
    (position) => {
      const primary = "<section class='result-panel gutter'><a download='result.pdf'>Scarica PDF</a></section>";
      const secondary = "<details data-result-secondary-raw><summary>Dati grezzi</summary><pre>Debug</pre></details>";
      const source = position === "before" ? `${primary}${secondary}` : `${secondary}${primary}`;
      const findings = auditLegacyPrimaryOutputSource("Adjacent.tsx", source);
      expect(findings).toEqual([expect.objectContaining({ pathClass: "manual-result-panel" })]);
      expect(() => assertNoLegacyPrimaryOutputs(findings)).toThrow(/Adjacent\.tsx/u);
    },
  );

  it("allows a manual raw representation only inside its secondary container", () => {
    const source = [
      "<div data-result-secondary-raw>",
      "  <section class='result-panel'><pre>Debug</pre></section>",
      "</div>",
    ].join("\n");
    expect(auditLegacyPrimaryOutputSource("Secondary.tsx", source)).toEqual([]);
  });

  it("allows an explicitly secondary raw/debug representation", () => {
    const source = [
      "<ToolResultPanel eyebrow='x' placeholder='x'>",
      "  <ResultPrimaryAnswer>42</ResultPrimaryAnswer>",
      "  <details data-result-secondary-raw>",
      "    <summary>Dati grezzi</summary>",
      "    <pre class='result-json'>{JSON.stringify(debug, null, 2)}</pre>",
      "  </details>",
      "</ToolResultPanel>",
    ].join("\n");
    expect(auditLegacyPrimaryOutputSource("Allowed.tsx", source)).toEqual([]);
  });

  it("provides a final zero-fallback gate", () => {
    const findings = auditLegacyPrimaryOutputSource(
      "Fixture.tsx",
      "<ToolResultPanel eyebrow='x' placeholder='x'><JsonResult value={value} /></ToolResultPanel>",
    );
    expect(() => assertNoLegacyPrimaryOutputs(findings)).toThrow(/Fixture\.tsx/u);
    expect(() => assertNoLegacyPrimaryOutputs([])).not.toThrow();
  });
});

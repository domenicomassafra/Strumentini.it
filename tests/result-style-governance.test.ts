import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditResultV2Source } from "../src/quality/result-style-governance";

const RESULT_PRIMITIVE_FILES = [
  "src/components/tools/shared/ResultPrimitives.tsx",
  "src/components/tools/shared/ResultActions.tsx",
  "src/components/tools/shared/BoundedResultPreview.tsx",
  "src/components/tools/shared/FileResultWorkspace.tsx",
  "src/components/tools/shared/BatchResult.tsx",
  "src/components/tools/shared/ReferenceResultProvenance.tsx",
  "src/components/tools/shared/ResultV2Exemplars.tsx",
] as const;

describe("Result v2 style governance", () => {
  it("keeps every Result v2 primitive inside the existing style authority", () => {
    for (const file of RESULT_PRIMITIVE_FILES) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      expect(auditResultV2Source(file, source), file).toEqual([]);
    }
  });

  it("rejects a seeded bespoke visual authority deterministically", () => {
    const source = [
      'import "./new-result.css";',
      'export const Bad = () => <div style="color:#ff0000; --result-gap: 12px">x</div>;',
    ].join("\n");
    expect(auditResultV2Source("BadResult.tsx", source).map((issue) => issue.rule).toSorted()).toEqual([
      "color-literal",
      "inline-style",
      "stylesheet",
      "token-authority",
    ]);
  });

  it("maps semantic result states only to canonical design tokens", () => {
    const css = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
    expect(css).toContain('.result-panel[data-state="success"] { border-inline-start: 3px solid var(--success); }');
    expect(css).toContain('.result-panel[data-state="warning"],');
    expect(css).toContain('.result-panel[data-state="partial"] { border-inline-start: 3px solid var(--warning); }');
    expect(css).toContain('.result-panel[data-state="error"] { border-inline-start: 3px solid var(--danger); }');
    expect(css).not.toMatch(/\.result-panel\[data-state[^\n]+#[0-9a-f]{3,8}/iu);
  });
});

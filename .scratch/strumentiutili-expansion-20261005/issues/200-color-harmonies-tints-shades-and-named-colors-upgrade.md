# 200 — Color harmonies tints shades and named-colors upgrade

**What to build:** Extend existing color tools with deterministic harmony/tint/shade and CSS named-color modes instead of duplicate color-converter routes.

**Traces to:** US-EXP-05, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 97 — Migrate image shared renderers to Result v2.

**Status:** completed

**Suggested skills:** design-system → code-typescript → code-tdd → inclusive-design

- [x] Converter results state `sRGB/HSL`; harmony hue rotations use HSL over resolved sRGB, while tint/shade generation explicitly uses encoded-sRGB channel interpolation toward white/black.
- [x] `color-converter` remains the canonical route and gains named-color, harmonies and tint/shade modes; existing contrast/picker primitives are reused rather than duplicated.
- [x] Generated palette entries expose numeric contrast ratios against pure white/black with copy stating they are contrast numbers, not an accessibility verdict.

**Verification:** `tests/image-visual-tools.test.ts` covers CSS named-color resolution, red/cyan complementary harmony, deterministic tint/shade percentages and existing WCAG contrast regression. The bundled named-color table covers all 148 standard CSS keywords.

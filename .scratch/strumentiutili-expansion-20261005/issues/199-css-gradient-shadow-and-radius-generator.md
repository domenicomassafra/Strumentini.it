# 199 — CSS gradient shadow and radius generator

**What to build:** Add live-preview CSS gradient, box-shadow and border-radius helpers using standards-valid output and one shared design-helper shell.

**Traces to:** US-EXP-05, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** design-system → interaction-design → code-typescript → qa-browser

- [x] Gradient, shadow and radius preview styles plus copied declarations derive from the same `CssDesignResult.value/css` model.
- [x] Numeric bounds and color parsing reject invalid angle/offset/blur/spread/radius/color fields with field-specific machine errors before CSS is produced.
- [x] The shared responsive field grid uses native number/color/select controls and contains no fixed-width interaction surface, preserving keyboard/touch use at 390px.

**Verification:** `tests/css-design-helper.test.ts` parses every fixture through `css-tree`, proves preview/copy canonical-value identity and covers field-specific invalid cases. Route browser acceptance is included in the final catalog/mobile smoke gate.

# 77 — Bounded large-output preview primitive

**What to build:** Build a shared preview for large text, code and table results with an explicit truncation boundary while preserving the complete artifact for copy/download.

**Traces to:** US-EXP-01, US-EXP-05; AC-05.1

**Constraints:** C-EXP-04, C-EXP-08, C-EXP-09; preview truncation never implies data loss.

**Blocked by:** 76 — Typed output artifact descriptor and download truth.

**Status:** completed

**Suggested skills:** design-system → inclusive-design → interaction-design → qa-browser

- [x] Preview states shown/total lines rows or bytes.
- [x] Full download remains byte-identical to engine output.
- [x] Preview is selectable, keyboard usable and no-overflow at 390px.

**Verification:** Huge text/code/table fixtures with byte-equality and mobile/keyboard checks.

**Evidence:** tests/bounded-preview.test.ts plus Result v2 browser conformance/a11y prove shown-vs-total boundaries, keyboard-selectable text/table previews, 390px reflow and complete artifact retention.

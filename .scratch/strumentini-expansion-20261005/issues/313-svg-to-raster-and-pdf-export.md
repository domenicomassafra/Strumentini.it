# 313 — SVG to raster and PDF export

**What to build:** Add SVG→PNG/JPG/WebP/PDF with explicit dimensions/scale/background and safe SVG parsing, keeping this separate from SVG optimization and never claiming raster→SVG vectorization.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 209, 103, 269.

**Status:** blocked

**Suggested skills:** security-audit → code-module-design → code-tdd → qa-browser

- [ ] Raster export dimensions and background are explicit.
- [ ] External/script refs follow safe SVG policy.
- [ ] No raster-in-SVG wrapper is marketed as vectorization.

**Verification:** SVG corpus, output signatures/pixels and malicious-reference cases.

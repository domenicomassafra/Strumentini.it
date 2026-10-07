# 240 — PDF crop and page-size normalization

**What to build:** Add visual crop boxes and page-size normalization with explicit media/crop box semantics, presets/custom size and per-page/range application.

**Traces to:** US-EXP-04; AC-04.1, AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** blocked

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [ ] Crop never silently deletes outside content unless the selected operation truly does so.
- [ ] Page-size transformation states scale/position behavior.
- [ ] Per-page geometry and rendered result are independently checked.

**Verification:** Mixed-size PDF corpus and box/geometry/render fixtures.

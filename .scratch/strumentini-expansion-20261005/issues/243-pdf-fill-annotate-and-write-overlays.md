# 243 — PDF fill annotate and write overlays

**What to build:** Add bounded text/drawing/highlight/form-fill annotation workflows where the PDF stack preserves integrity, with page thumbnail navigation and explicit flatten/preserve behavior.

**Traces to:** US-EXP-04; AC-04.1, AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [ ] Existing form fields are filled without inventing unsupported field types.
- [ ] Annotation placement has keyboard/touch alternatives where feasible.
- [ ] Flattened vs editable annotation output is explicit and independently checked.

**Verification:** Form/annotation corpus, visual review and reopen inspection.

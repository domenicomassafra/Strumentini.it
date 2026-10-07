# 319 — PDF form inspector and flatten upgrade

**What to build:** Deepen form inspection and flatten with field/annotation counts, page provenance and exact before→after capability report; preserve visual appearance under supported flatten mode.

**Traces to:** US-EXP-04

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 98, 215, 269.

**Status:** blocked

**Suggested skills:** pdf → code-tdd → qa-browser

- [ ] Fields/annotations affected are counted and identified.
- [ ] Flatten result is reinspected for remaining interactive structures.
- [ ] Visual regression stays within declared tolerance.

**Verification:** Form/annotation corpus, post-flatten inspection and render compare.

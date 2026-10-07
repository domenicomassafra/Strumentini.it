# 308 — Video AI context contact-sheet export

**What to build:** Create deterministic timestamped contact sheets plus source metadata/context manifest for video review/AI workflows without calling any AI service.

**Traces to:** US-EXP-08

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 232, 305.

**Status:** blocked

**Suggested skills:** code-module-design → code-tdd → qa-browser

- [ ] Timestamps and extracted frames correspond deterministically.
- [ ] Manifest includes source facts and frame timestamps only, no generated interpretation.
- [ ] Multi-output download is complete and locally produced.

**Verification:** Known video timeline corpus and frame/timestamp/manifest equality.

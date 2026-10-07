# 307 — Audio loudness and LUFS analysis

**What to build:** Add offline loudness analysis only if the approved DSP path can implement a documented standard profile; result is analysis, not automatic broadcast compliance certification.

**Traces to:** US-EXP-06

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 273 — Audio codec and DSP feasibility spike.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [ ] Measurement mode/standard assumptions are named.
- [ ] Integrated/peak values are reproducible on fixture signals.
- [ ] No compliance claim is made without full required measurement context.

**Verification:** Reference audio signals and independent expected ranges.

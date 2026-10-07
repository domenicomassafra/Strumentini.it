# 126 — IVA add and scorporo with versioned presets

**What to build:** Add IVA calculation/scorporo using user-selectable sourced year/rate presets plus explicit custom rate, showing imponibile, IVA and totale with reproducible rounding.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 117, 125.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-tdd

- [ ] Preset rates link to version/year source metadata.
- [ ] Add↔scorporo round-trip follows documented rounding policy.
- [ ] Custom rate is visibly user-supplied, not sourced preset.

**Verification:** Preset snapshot, cent rounding and round-trip fixtures.

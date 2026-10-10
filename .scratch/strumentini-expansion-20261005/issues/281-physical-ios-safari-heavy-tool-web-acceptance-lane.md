# 281 — Physical iOS Safari heavy-tool web acceptance lane

**What to build:** Define the reusable real iOS Safari lane for accepted heavy local routes, including file picker, memory/resource limits, cancel/retry and download/share behavior.

**Traces to:** US-EXP-06; AC-06.1, AC-09.1

**Constraints:** C-EXP-02, C-EXP-04, C-EXP-08; do not route this web task through native-app ios-qa.

**Blocked by:** 206 — Heavy local-job mobile and performance acceptance gate.

**Status:** blocked

**Suggested skills:** qa-browser → browser-performance-benchmark

- [ ] Lane uses physical iOS Safari and records current build fingerprint.
- [ ] Safari resource/Blob/download constraints are measured per representative route.
- [ ] Unsupported behavior remains an explicit limitation, not a desktop WebKit substitution.

**Verification:** Representative accepted heavy route on real iOS Safari with artifact/console evidence.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #362, #363.

**Next actionable AC:** Lane uses physical iOS Safari and records current build fingerprint.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.

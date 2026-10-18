MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 280 — Physical Android heavy-tool web acceptance lane

**What to build:** Define the reusable physical Android Chrome lane for accepted heavy image/PDF/Office/OCR/audio/video routes with file selection, progress/cancel, memory failure and download evidence.

**Traces to:** US-EXP-06; AC-06.1, AC-09.1

**Constraints:** C-EXP-02, C-EXP-04, C-EXP-08; physical web evidence only.

**Blocked by:** 206 — Heavy local-job mobile and performance acceptance gate.

**Status:** blocked

**Suggested skills:** qa-browser → browser-performance-benchmark

- [ ] Lane records device/browser/build and exact route/input class.
- [ ] OOM/unsupported state is recoverable and captured as failure/limit.
- [ ] Receipt schema can be consumed by heavy-route promotion gates.

**Verification:** Representative accepted heavy route on real Android plus artifact verification.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #362, #363.

**Next actionable AC:** Lane records device/browser/build and exact route/input class.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.

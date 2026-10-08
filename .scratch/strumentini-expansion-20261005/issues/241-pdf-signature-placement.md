# 241 — PDF signature placement

**What to build:** Add local visible signature image/drawing/text placement on selected pages with precise scope; do not label it cryptographic digital signing unless a certificate-signing stack is separately implemented and verified.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → security-audit → interaction-design → code-tdd → qa-browser

- [ ] Visible signature mode is named accurately and previewed.
- [ ] No cryptographic validity claim is made for image/drawn signatures.
- [ ] Placed appearance/page/order survive independent render/reopen.

**Verification:** Signature placement corpus and visual/reopen verification.

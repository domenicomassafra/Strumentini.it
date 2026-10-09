# 251 — PDF booklet and front-back interleave

**What to build:** Add booklet imposition and front/back interleave as separate page-order operations with explicit duplex/blank-page assumptions and print-order preview.

**Traces to:** US-EXP-04; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 250.

**Status:** ready-for-agent

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [ ] Imposition order is shown before export.
- [ ] Required blank insertion is explicit.
- [ ] Interleave detects unequal/front-back length mismatch and asks for a deterministic policy.

**Verification:** Numbered-page order fixtures for booklet/interleave and rendered verification.

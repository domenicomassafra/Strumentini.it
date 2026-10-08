# 239 — PDF watermark and overlay placement

**What to build:** Add text/image watermark and generic overlay placement with page range, opacity, rotation, scale and position preview, keeping watermark distinct from irreversible redaction.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [ ] Overlay range/placement is previewed on real page geometry.
- [ ] Watermark remains clearly labelled as visible overlay, not privacy redaction.
- [ ] Output page count/signature and rendered placement are verified.

**Verification:** Range/opacity/rotation/position corpus and rendered visual review.

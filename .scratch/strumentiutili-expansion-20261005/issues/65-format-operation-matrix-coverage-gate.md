# 65 — Format-operation matrix coverage gate

**What to build:** Materialize `docs/11-format-operation-matrix.md` as a machine-readable coverage report so every high-priority compression/conversion direction is classified as implemented, spike-blocked or deliberately refused with a reason, and no advertised route lacks verified output/fidelity evidence.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1, AC-09.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06, DEC-EXP-07; C-EXP-01, C-EXP-02, C-EXP-08

**Constraints:** “Refused” is valid when fidelity/local feasibility is poor; silent omission is not. Coverage must not reward adding combinatorial low-value routes.

**Blocked by:** 47, 48, 49, 51, 52, 53, 54, 55, 56, 57, 58, 59, 67, 68, 108, 109.

**Status:** blocked

- [ ] Every high-priority matrix row has route/tool evidence, an active blocker, or a documented refusal.
- [ ] Every implemented conversion verifies output signature/type and declares fidelity loss.
- [ ] Every compressor reports actual before→after bytes and target-size truthfulness.

**Verification:** CI coverage generator fails on unclassified high-priority rows, missing route evidence, or unsupported claims.

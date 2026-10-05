# 44 — Lightweight generators/productivity family

**What to build:** Add useful deterministic generators that fit the product thesis: barcode EAN-13/Code-128, random numbers, random picker/draw, balanced team splitter, coupon-code generator, and small local productivity counters/lists only where they solve a concrete one-shot job and do not turn the site into a persistent task manager.

**Traces to:** US-EXP-03, US-EXP-10; AC-10.1; DEC-EXP-06, DEC-EXP-07; C-EXP-04, C-EXP-07

**Constraints:** Secure randomness where uniqueness/security matters; entertainment games remain out of implementation scope; no persistent multi-user workflow product.

**Blocked by:** 01.

**Status:** blocked

- [ ] Barcode outputs validate against their format/checksum rules and download cleanly.
- [ ] Random/selection tools disclose secure-vs-nonsecure randomness semantics and support reproducible options only when intentionally seeded.
- [ ] No tool introduces accounts/workflows just to persist a trivial list/counter.

**Verification:** Barcode decode round-trips, randomness/path tests, uniqueness constraints, and mobile accessibility checks.


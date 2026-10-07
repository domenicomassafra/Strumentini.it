# 44 — Lightweight generators/productivity family

**What to build:** Add useful deterministic generators that fit the product thesis: barcode EAN-13/Code-128, random numbers, random picker/draw, balanced team splitter, coupon-code generator, and small local productivity counters/lists only where they solve a concrete one-shot job and do not turn the site into a persistent task manager.

**Traces to:** US-EXP-03, US-EXP-10; AC-10.1; DEC-EXP-06, DEC-EXP-07; C-EXP-04, C-EXP-07

**Constraints:** Secure randomness where uniqueness/security matters; entertainment games remain out of implementation scope; no persistent multi-user workflow product.

**Blocked by:** 204, 205.

**Status:** completed

- [x] Ticket 204 validates/generates EAN-13 checksums and a documented Code 128 B subset, with independent decode checks and local SVG/PNG export.
- [x] Ticket 205 distinguishes WebCrypto-backed secure selection from explicitly non-secure seeded reproducibility and defines deterministic uniqueness/team/coupon policies.
- [x] Both tools remain one-shot LOCAL utilities with no account, shared workflow or task-manager persistence.

**Verification:** Barcode independent SVG decode/PNG signature tests and the random utility/property suites cover checksums, secure sampling, seeded reproducibility, uniqueness constraints and bounded browser UI behavior.

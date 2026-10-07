# 71 — Generated Result v2 inventory projection

**What to build:** Generate a deterministic report listing every current tool id, engine, actual renderer seam, Result v2 declaration state and migration owner. Missing stays missing; the report cannot auto-classify a tool as migrated.

**Traces to:** US-EXP-01; AC-01.1; docs/10 §7

**Constraints:** C-EXP-01; exact 200/200 parity; no default generic class.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-architecture-review → code-typescript → code-tdd

- [x] Inventory exactly matches current catalog ids.
- [x] Each row records an actual renderer seam.
- [x] Report regeneration is deterministic and non-mutating.

**Verification:** Catalog parity plus sabotage cases for missing/duplicate ids.

**Evidence:** tests/result-v2-inventory.test.ts passes exact 200-id parity, real renderer seams, deterministic regeneration and missing/duplicate sabotage; generated inventory is current under catalog:check.

# 70 — Result declaration in Tool Manifest

**What to build:** Add an optional expand-phase Result v2 declaration to the manifest/catalog contract: semantic result class plus explicit result capabilities. Existing manifests stay valid until migrated; no renderer work in this slice.

**Traces to:** US-EXP-01; AC-01.1, AC-01.2; DEC-EXP-03

**Constraints:** C-EXP-01, C-EXP-09; expand-contract only; no implicit generic default.

**Blocked by:** None — can start immediately.

**Status:** completed

**Suggested skills:** code-architecture-review → code-typescript → code-tdd

- [x] Schema accepts only approved result classes/capabilities.
- [x] All existing 200 manifests still build during expand phase.
- [x] Generated catalog types carry result declaration without renderer fields.

**Verification:** Manifest/schema/catalog tests plus invalid declaration fixtures.

**Evidence:** Manifest/catalog contract is proven by tests/catalog.test.ts (7/7), including rejected generic classes, unknown/duplicate capabilities and renderer fields; catalog:check still covers all 200 manifests.

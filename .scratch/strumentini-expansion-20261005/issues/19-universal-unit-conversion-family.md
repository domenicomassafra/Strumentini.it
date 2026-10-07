# 19 — Universal unit-conversion family

**What to build:** Build a dimension-aware conversion engine and job views for the high-value physical/digital dimensions in the source plan, sharing unit definitions and precision rules rather than one engine per page.

**Traces to:** US-EXP-03, US-EXP-10; AC-03.1, AC-10.1; DEC-EXP-01; C-EXP-03

**Constraints:** Separate affine conversions such as temperature from multiplicative units; declare decimal vs binary storage; no unsupported cross-dimension conversions.

**Blocked by:** 136, 137, 138, 139, 140.

**Status:** completed

- [x] Tickets 136–140 now share one unit registry declaring dimension, symbol, aliases, rational scale/offset and source/authority notes.
- [x] Multiplicative and affine conversions round-trip under the documented 12-decimal display policy; temperature uses the shared offset path rather than a special duplicate engine.
- [x] Distinct high-intent routes reuse the same registry for general units, engineering units, storage/download-time, battery/vehicle/power and reference-size helpers.
- [x] Common symbols/aliases are indexed with explicit ambiguity refusal (`AMBIGUOUS_UNIT_ALIAS`) instead of silent matches; Italian comma-decimal input is covered.

**Verification:** `tests/unit-conversion.test.ts` plus the focused unit-tool suites cover known answers, cross-dimension refusal, affine temperature, alias collisions, SI-vs-IEC storage, battery/fuel/power, paper/model/TV helpers and Italian decimal input. Catalog/build checks include all five routes and the shared registry.

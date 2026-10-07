# 136 — Unit engine tranche 1 basic dimensions

**What to build:** Build the shared unit registry and first vertical slice for length, mass, temperature, area and volume with dimension, symbol, aliases, scale/offset and documented precision.

**Traces to:** US-EXP-03, US-EXP-10; AC-03.1, AC-10.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-module-design → code-typescript → code-tdd

- [x] Cross-dimension conversion is rejected.
- [x] Affine temperature conversion is modeled correctly.
- [x] Round-trip/precision and Italian decimal behavior are documented/tested.

**Verification:** Known-answer and round-trip property tests per dimension.

**Evidence:** `src/engines/unit-conversion/index.ts` provides the shared dimension/unit registry and rational scale+offset conversion path. `tests/unit-conversion.test.ts` covers cross-dimension refusal, ambiguous aliases, Celsius/Fahrenheit/Kelvin/Rankine fixed points, comma-decimal input and round trips across length/mass/area/volume/temperature. Focused/regression run: 53/53 tests passed. Oracle/fixture validator passes; catalog generation/check passes at 220 tools and the static build completes 240 pages. The only current global TypeScript failure is the unrelated concurrent `src/tools/csv-dedupe/module.ts` output-shape mismatch.

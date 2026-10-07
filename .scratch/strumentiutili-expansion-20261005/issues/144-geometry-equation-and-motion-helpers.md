# 144 — Geometry equation and motion helpers

**What to build:** Add deterministic areas/perimeters/volumes, Pythagorean, quadratic roots and speed-distance-time modes with explicit units and invalid-domain behavior.

**Traces to:** US-EXP-03; AC-03.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 136, 142.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd

- [x] Negative/degenerate dimensions are rejected.
- [x] Quadratic discriminant policy for non-real roots is explicit.
- [x] Speed-distance-time avoids unit mismatch and division by zero.

**Verification:** Known geometry/equation/motion literals and invalid domains.

**Evidence (2026-10-06):** `tests/business-math-expansion.test.ts` passes known rectangle, 3-4-5 Pythagorean, real quadratic and 180 km / 2 h literals; it also proves negative dimensions, `a=0`, negative discriminant, zero time/speed and cross-dimension unit inputs fail or report the declared real-root boundary. Shared unit-registry normalization is used for motion. The built `/tools/geometry-equation-motion-helper/` route also passed the scoped 390px LOCAL browser acceptance.

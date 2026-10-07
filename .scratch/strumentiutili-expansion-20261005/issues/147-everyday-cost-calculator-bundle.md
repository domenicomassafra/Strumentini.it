# 147 — Everyday cost calculator bundle

**What to build:** Add unit price, split bill/tip, annual subscription, energy cost, car-trip cost and salary↔hourly modes by reusing conversion/rate primitives and making work/usage assumptions explicit.

**Traces to:** US-EXP-03; AC-03.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 125, 136.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd

- [x] Unit normalization is explicit for comparison modes.
- [x] Split remainder and zero-use/distance cases are deterministic.
- [x] Salary↔hourly states the assumed working basis.

**Verification:** Worked literals for each mode and assumption boundaries.

**Evidence (2026-10-06):** `tests/business-math-expansion.test.ts` passes worked unit-price, split-bill remainder, annual subscription, kWh energy, L/100 km trip and salary↔hourly literals. It proves incompatible units and zero people fail closed while zero usage/distance returns deterministic zero; salary conversion exposes the exact hours/week × weeks/year basis. The built `/tools/everyday-cost-calculator/` route also passed the scoped 390px LOCAL browser acceptance.

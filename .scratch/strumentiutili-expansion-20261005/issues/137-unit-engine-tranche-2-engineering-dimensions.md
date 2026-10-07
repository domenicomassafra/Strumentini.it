# 137 — Unit engine tranche 2 engineering dimensions

**What to build:** Extend the registry with speed, time, angle, energy, pressure, power, force, torque, frequency, density, flow and illuminance using sourced definitions where nontrivial.

**Traces to:** US-EXP-03; AC-03.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 136 — Unit engine tranche 1 basic dimensions.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → research-primary-sources

- [x] Each new unit belongs to exactly one compatible dimension.
- [x] Alias collisions are explicit rather than silently resolved.
- [x] Standards-derived constants carry a source note where appropriate.

**Verification:** Known literals, round trips and alias-collision cases.

**Evidence:** The same registry now covers speed, duration, angle, energy, pressure, power, force, torque, frequency, density, flow and illuminance. Unit descriptors expose authority/source notes, and resolver collisions throw `AMBIGUOUS_UNIT_ALIAS`. Focused tests cover 100 km/h, 1 atm, 60 rpm, turn↔degree/radian and source-note presence. BIPM SI Brochure revision 4.01 (2026) is named for SI definitions; all nontrivial constants carry explicit registry notes.

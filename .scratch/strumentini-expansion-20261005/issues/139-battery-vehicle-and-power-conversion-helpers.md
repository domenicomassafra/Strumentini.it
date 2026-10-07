# 139 — Battery vehicle and power conversion helpers

**What to build:** Add mAh↔Wh with required voltage, fuel-consumption conversions with explicit US/Imperial gallon, and kW↔CV↔HP with declared constants.

**Traces to:** US-EXP-03; AC-03.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 136, 137.

**Status:** completed

**Suggested skills:** research-primary-sources → code-tdd

- [x] mAh↔Wh refuses missing/nonpositive voltage.
- [x] US and Imperial MPG cannot be confused.
- [x] Power-unit constants are source/documented and reversible within precision policy.

**Verification:** Voltage-required, gallon-system and round-trip fixtures.

**Evidence:** Battery mode requires positive voltage and implements `Wh = mAh × V / 1000` bidirectionally. Fuel mode uses separate exact US liquid and Imperial gallon constants plus the exact international mile; 30 MPG yields different L/100 km results in tests. Power mode reuses the engineering registry for W/kW/MW/mechanical hp/CV and passes round-trip checks within the 12-decimal display policy.

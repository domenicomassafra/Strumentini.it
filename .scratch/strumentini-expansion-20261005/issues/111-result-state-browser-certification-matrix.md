# 111 — Result-state browser certification matrix

**What to build:** Create fresh browser receipts sampling every semantic result class and relevant state with console/network/390px evidence instead of inheriting historical PASS.

**Traces to:** US-EXP-01; AC-01.3, AC-04.1, AC-05.1

**Constraints:** C-EXP-02, C-EXP-04; evidence must come from current build.

**Blocked by:** 81, 87.

**Status:** completed

**Suggested skills:** qa-browser → code-tdd

- [x] All result classes and required states have a current browser sample.
- [x] Console/runtime errors fail the receipt.
- [x] 390px behavior is recorded for every sampled class.

**Verification:** Real browser acceptance run producing fresh machine-readable receipts.

**Evidence:** `acceptance:result-state-matrix` passes 54 semantic class/state browser samples from the current build and writes `quality/receipts/result-v2/browser-state-matrix.json`; the harness treats runtime/console errors as fatal and records the 390px viewport contract for every sampled class.

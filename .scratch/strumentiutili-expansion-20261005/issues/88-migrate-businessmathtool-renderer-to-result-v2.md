# 88 — Migrate BusinessMathTool renderer to Result v2

**What to build:** Migrate the shared business-math renderer to calculator/validator Result v2 without changing formulas, then prove every current tool using that seam inherits answer-first formatting, assumptions and actions.

**Traces to:** US-EXP-01; AC-01.1, AC-01.2; DEC-EXP-03

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-09; preserve Gold numeric behavior.

**Blocked by:** 81, 82, 85.

**Status:** completed

**Suggested skills:** code-module-design → code-typescript → code-tdd → qa-browser

- [x] All BusinessMathTool-owned tools declare the correct result class.
- [x] Primary answer, breakdown/formula and assumptions use shared primitives.
- [x] Gold numeric values remain unchanged at engine boundary.

**Verification:** Business-math Gold suite plus representative mobile/browser results.

**Evidence:** the generated inventory reports all 16 owner-88 tools declared. `gold:business-math` passes all 16 exact independent vectors and `acceptance:business-math` passes all 16 routes with keyboard/mobile/locality/lazy-load evidence. Shared Result v2 primitives remain in use and `result-v2:legacy-zero` reports 0 findings.

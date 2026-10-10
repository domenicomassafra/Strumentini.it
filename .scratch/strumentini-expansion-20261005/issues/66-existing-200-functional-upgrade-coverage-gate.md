# 66 — Existing 200 functional-upgrade coverage gate

**What to build:** Add a second 200/200 gate beside Result v2 proving every original tool was audited not only for presentation but also for missing expected functionality/options, with each route marked upgraded, already-complete, or explicitly refusing an option for a documented reason.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07; C-EXP-01, C-EXP-09

**Constraints:** Do not force feature creep into tools whose current narrow contract is already correct; “already complete” requires evidence, not assumption.

**Blocked by:** 50, 53, 60, 61, 62, 63, 64, 110, 297.

**Status:** completed

- [x] Original catalog coverage is exactly 200/200.
- [x] Each original route has a functional-audit result and links to any upgrade acceptance evidence.
- [x] No tool is counted as upgraded solely because Result v2 changed its visuals.

**Verification:** Generated audit index checked against the current catalog and failing CI on any missing original tool.

**Evidence (2026-10-10):** `npm run audit:original-200:final` verifies the preserved 200-id original assignment snapshot against the larger current catalog: 200/200 final decisions, 196 `ALREADY_COMPLETE`, 3 `UPGRADED` (`regex-tester`, `ris-bibtex-converter`, `uuid-generator`) and 1 explicit `REFUSED` (`image-resize`). Each decided route has a record pointing to expected/observed functionality, acceptance, a tool-specific Gold/Partial receipt, its original fixtures and oracle, and a real-route browser reference. `scripts/functional-audit-evidence-66.ts` cross-checks those functional bindings and requires executable non-visual upgrade evidence plus completed implementation tickets; `tests/functional-audit-66.test.ts` exercises eight negative fixtures, including receipt identity, fixtures, missing browser route, visual-only upgrade and uncompleted child acceptance. Targeted audit test suite 19/19 and final audit gate PASS. `image-resize` remains REFUSED because physical Android/iOS acceptance is absent; the separate broader functionality program #62 remains blocked on its own scope and does not silently grant upgrades to these original narrow route contracts.

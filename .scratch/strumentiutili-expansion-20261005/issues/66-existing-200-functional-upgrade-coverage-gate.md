# 66 — Existing 200 functional-upgrade coverage gate

**What to build:** Add a second 200/200 gate beside Result v2 proving every original tool was audited not only for presentation but also for missing expected functionality/options, with each route marked upgraded, already-complete, or explicitly refusing an option for a documented reason.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07; C-EXP-01, C-EXP-09

**Constraints:** Do not force feature creep into tools whose current narrow contract is already correct; “already complete” requires evidence, not assumption.

**Blocked by:** 50, 53, 60, 61, 62, 63, 64, 110, 297.

**Status:** blocked

- [ ] Original catalog coverage is exactly 200/200.
- [ ] Each original route has a functional-audit result and links to any upgrade acceptance evidence.
- [ ] No tool is counted as upgraded solely because Result v2 changed its visuals.

**Verification:** Generated audit index checked against the current catalog and failing CI on any missing original tool.

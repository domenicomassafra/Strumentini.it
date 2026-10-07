# 157 — CAP to Comune lookup

**What to build:** Implement CAP↔Comune lookup only if ticket 120 records IMPLEMENT; model one-to-many/many-to-one ambiguity and show dataset version/source.

**Traces to:** US-EXP-07, US-EXP-10; AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 120 — CAP to Comune source feasibility decision.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → inclusive-design

- [ ] Ambiguous CAP returns all supported candidates instead of guessing.
- [ ] Comune→CAP returns documented coverage semantics.
- [x] If 120 is REFUSE this ticket is closed as refused, not replaced with scraped data.

**Verification:** Known ambiguous/current cases and source-version display.

**Evidence (2026-10-06):** Ticket 120 is `completed (REFUSED)`. Its versioned decision `120-feasibility-2026-10-06.1` and SHA-256-bound evidence at `quality/reference-data/italy/120-cap-comune-feasibility-evidence.json` show that the allowed repository evidence does not prove an authoritative, maintainable, licensable nationwide CAP↔Comune source with explicit ambiguity semantics. Per this ticket's own acceptance rule, no lookup route or scraped replacement is implemented. The two lookup-specific acceptance items remain intentionally inapplicable under the REFUSED outcome; this ticket can reopen only if ticket 120's documented source requirements are later satisfied.

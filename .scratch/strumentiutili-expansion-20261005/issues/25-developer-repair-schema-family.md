# 25 — Developer repair/schema family

**What to build:** Add deterministic developer jobs including JSON repair with disclosed edits, structural JSON diff, XML validation/formatting/conversion, CSV→SQL and JSON→TypeScript/Schema where rules are explicit.

**Traces to:** US-EXP-05, US-EXP-08; AC-05.1, AC-08.1; DEC-EXP-01; C-EXP-07

**Constraints:** Repairs may not invent missing semantic values; every mutation is listed; parsers must report location/context without executing input.

**Blocked by:** 01 — Result System v2 primitives.

**Status:** blocked

- [ ] JSON repair produces both repaired output and an ordered repair log.
- [ ] Diffs distinguish structural/value/type changes with stable paths.
- [ ] Validators expose precise line/column/path when the parser can provide it.
- [ ] Generated schemas/types state inference limits and preserve a reproducible mapping.

**Verification:** Malformed corpus fixtures, repair idempotence tests, parser security tests, large-output bounded preview and browser acceptance.

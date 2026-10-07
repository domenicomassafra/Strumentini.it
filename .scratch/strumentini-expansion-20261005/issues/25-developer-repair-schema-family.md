# 25 — Developer repair/schema family

**What to build:** Add deterministic developer jobs including JSON repair with disclosed edits, structural JSON diff, XML validation/formatting/conversion, CSV→SQL and JSON→TypeScript/Schema where rules are explicit.

**Traces to:** US-EXP-05, US-EXP-08; AC-05.1, AC-08.1; DEC-EXP-01; C-EXP-07

**Constraints:** Repairs may not invent missing semantic values; every mutation is listed; parsers must report location/context without executing input.

**Blocked by:** 164, 165, 166, 167, 168, 170.

**Status:** completed

- [x] JSON repair produces both repaired output and an ordered repair log.
- [x] Diffs distinguish structural/value/type changes with stable paths.
- [x] Validators expose precise line/column/path when the parser can provide it.
- [x] Generated schemas/types state inference limits and preserve a reproducible mapping.

**Verification:** Tickets 164–168 and 170 are all completed. Focused developer structured-data suites cover malformed corpora, repair idempotence, parser security, bounded diff/schema output and CSV→SQL quoting; shared DeveloperWeb/Table Result v2 seams provide the browser/result path.

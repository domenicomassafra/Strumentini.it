# 148 — FatturaPA single-invoice local reader

**What to build:** Parse supported FatturaPA XML locally into a human-readable invoice view with schema/version provenance and isolated malformed-field errors.

**Traces to:** US-EXP-07, US-EXP-09; AC-07.1, AC-09.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** None. Ticket 119 is READY and the route is catalog/oracle/fixture bound.

**Status:** completed — local public reader

**Suggested skills:** code-module-design → security-audit → code-tdd → inclusive-design

- [x] Parser validates supported namespace/version without external entity resolution.
- [x] Core invoice parties/totals/lines map to explicit fields.
- [x] Malformed/unknown versions fail without uploading data.

**Verification:** Official/anonymized invoice fixtures and hostile XML cases.

**Progress (2026-10-06):** `src/engines/italy/fatturapa-reader.ts` reuses the project's bounded local XML parser, which rejects DTD/ENTITY declarations and never resolves external entities. It validates root namespace, pinned transmission format and root `versione` together against ticket-119 identities (ordinary FPA12/FPR12 XSD 1.2.3 and simplified FSM10 XSD 1.0.2), maps supplier/customer, document metadata, ordinary lines/VAT summaries and simplified line data, and records malformed date/decimal fields independently while preserving other readable fields. `/tools/fatturapa-reader/` is a LOCAL/network-forbidden public route with Result v2 file contract, oracle `cand-255` and fixture family `italy-2026-consumers`. Ordinary/simplified/anonymized and hostile XML tests pass; browser acceptance at 390px confirms the local file flow, no page overflow and zero external/non-GET/task-body requests after operation start.

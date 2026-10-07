# 119 — FatturaPA technical-spec and XSD source pack

**What to build:** Pin supported FatturaPA technical specification/XSD versions and source metadata so invoice parsing can state exactly which schema version is recognized.

**Traces to:** US-EXP-07; AC-07.1, AC-09.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** None for the pinned current format identities. Ticket 07 is complete.

**Status:** completed

**Suggested skills:** research-primary-sources → code-typescript → code-tdd

- [x] Supported schema versions and namespaces are explicit.
- [x] Unknown/newer version is not parsed as if current.
- [x] Official source/version is available to result provenance.

**Verification:** Official XSD/spec fixtures plus unknown-version rejection.

**Progress (2026-10-06):** Ticket 119 is `READY`. The official FatturaPA portal's v1.4 technical-specification PDF and current XSD bytes are vendored with exact URLs and SHA-256 hashes: ordinary FPA12/FPR12 schema version 1.2.3 in namespace `http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2`, and simplified FSM10 schema version 1.0.2 in namespace `http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.0`. The evidence pack defines a fail-closed unknown-version policy, and focused tests verify the checked-in XSD identities directly.

# 170 — CSV to SQL dialect generator

**What to build:** Generate previewable INSERT/schema output for PostgreSQL, MySQL and SQLite without executing SQL, with explicit inferred/overridden types and safe quoting.

**Traces to:** US-EXP-05; AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 94 — Migrate TableWorkbench shared path to Result v2.

**Status:** completed

**Suggested skills:** code-typescript → code-module-design → security-audit → code-tdd

- [x] Identifiers and values are quoted for selected dialect.
- [x] NULL/Unicode/quote/leading-zero cases follow explicit column policy.
- [x] No SQL is executed or networked.

**Verification:** Known dialect literals and injection-like data fixtures.

Evidence (2026-10-06): `src/engines/table/advanced.ts` implements PostgreSQL/MySQL/SQLite identifier and value quoting, conservative inference plus explicit per-column overrides, configurable NULL/empty policy and leading-zero preservation. `csv-to-sql` is LOCAL with `network: forbidden` and produces text only. `tests/table-advanced-operations.test.ts` passes the dialect, Unicode, quote/backslash injection-like, NULL/empty, leading-zero and override cases.

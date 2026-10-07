# 181 — Timezone-aware cron next-runs

**What to build:** Extend cron next-run output with a selected IANA timezone and UTC, documenting supported grammar and deterministic DST gap/overlap behavior.

**Traces to:** US-EXP-05; AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 91 — Migrate DeveloperWebTool renderer to Result v2.

**Status:** completed

**Suggested skills:** code-module-design → code-typescript → code-tdd

- [x] Next-run output states the selected IANA timezone and preserves each matching UTC instant.
- [x] Spring gaps are skipped and fall overlaps include both distinct UTC instants, with the policy returned in `dstPolicy`.
- [x] Existing POSIX DOM/DOW OR semantics remain compatible.

**Verification:** `tests/developer-web-engine.test.ts` covers UTC compatibility plus Europe/Rome 2026 spring-gap and fall-overlap fixtures.

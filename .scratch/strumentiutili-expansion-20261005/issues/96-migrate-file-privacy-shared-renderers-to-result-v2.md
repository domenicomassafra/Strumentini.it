# 96 — Migrate file privacy shared renderers to Result v2

**What to build:** Migrate file/privacy/hash result paths to file/batch/validator semantics with detected type, bytes, before→after facts, privacy outcome and isolated failures.

**Traces to:** US-EXP-01, US-EXP-04, US-EXP-09; AC-01.1, AC-04.1, AC-04.2

**Constraints:** C-EXP-01, C-EXP-05, C-EXP-09; byte facts authoritative; no upload introduced.

**Blocked by:** 78, 79, 81, 82.

**Status:** completed

**Suggested skills:** code-module-design → security-audit → code-tdd → qa-browser

- [x] Assigned file/privacy/hash ids declare correct result semantics.
- [x] Destructive/privacy tools report measured changes, not generic success.
- [x] Mixed batch failures preserve successes.

**Verification:** File/privacy Gold plus byte-level destructive and mixed-batch browser fixtures.

**Evidence:** the generated Result v2 inventory reports all 19 owner-96 ids declared. File/privacy Result v2, engine, module and local-job fixture suites pass 42/42. The shared FilePrivacy result path exposes measured counts and before/after or privacy facts, bounded selectable output with complete verified artifacts, file workspace rows and isolated batch states rather than generic success. Fresh local-jobs browser acceptance passes 9/9 routes with locality/lazy/mobile/a11y/Italian-error evidence, and the matching Gold certifier passes all nine fixture families. TypeScript, diff-check and the global legacy-primary zero gate pass.

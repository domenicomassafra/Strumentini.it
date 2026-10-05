# 26 — Structured-data bulk/SQL family

**What to build:** Add CSV→SQL for major SQL dialects, huge-CSV splitting by row count/output size with repeated headers, representable XML↔CSV paths, and table compare improvements for bulk structured-data jobs.

**Traces to:** US-EXP-04, US-EXP-05; AC-04.1, AC-05.1; DEC-EXP-01, DEC-EXP-06; C-EXP-03, C-EXP-05, C-EXP-08

**Constraints:** Stream/chunk large inputs where possible; preserve identifiers/leading zeros; SQL generation must quote identifiers/values safely for its declared dialect and never execute SQL.

**Blocked by:** 01, 23.

**Status:** blocked

- [ ] CSV→SQL offers explicit dialect and inferred/overridden column types with preview.
- [ ] Split CSV does not load the entire source into duplicate memory and repeats headers correctly.
- [ ] Nested/ambiguous XML structures are rejected or explained rather than silently flattened.

**Verification:** Large-file benchmark, dialect fixture snapshots, leading-zero/Unicode cases, and browser memory acceptance.


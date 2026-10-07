# 99 — Migrate URL marketing QR and bespoke results to Result v2

**What to build:** Close remaining current-catalog Result v2 renderer seams across URL/web operations, campaign URL, meta/social preview, QR and bespoke file hash paths.

**Traces to:** US-EXP-01, US-EXP-09; AC-01.1, AC-01.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; live network checks remain distinct from local parsing.

**Blocked by:** 80, 81, 82.

**Status:** completed

**Suggested skills:** code-module-design → interaction-design → code-tdd → qa-browser

- [x] Every remaining id has one migration/no-change owner.
- [x] Reference-network states use provenance semantics.
- [x] 200-tool ledger has no orphan after closure.

**Verification:** Exact migration coverage plus marketing/URL/QR/hash suites and browser fixtures.

**Evidence:** all 15 owner-99 ids are projected as declared by the generated 200-tool inventory and remain uniquely owned by ticket 99. The eight former JsonResult-primary URL/web renderers use StructuredTextResultV2 with human-readable structured metrics, local provenance, bounded secondary JSON preview, complete verified JSON copy/download and reset; the remaining bespoke file-hash/meta/Open Graph/QR/social/URL-comparison renderers retain their existing semantic UI and now carry truthful Result v2 declarations. Focused URL/QR/hash plus inventory/ledger tests pass 83/83. Browser evidence passes the eight URL/web routes at 390px with keyboard/a11y/locality, the three campaign-URL tools, and file-hash with a 48 MiB cancellation fixture and zero private-value leakage. TypeScript and Astro build pass, and the global legacy-primary detector reports 0 findings.

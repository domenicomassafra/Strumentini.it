# 138 — Digital storage and download-time calculator

**What to build:** Add SI-vs-IEC storage conversion and entered-throughput download-time estimation with explicit bit/byte distinction and overhead assumption; no live speed-test network call.

**Traces to:** US-EXP-03; AC-03.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 136 — Unit engine tranche 1 basic dimensions.

**Status:** completed

**Suggested skills:** code-tdd

- [x] 1000 and 1024 bases are visibly distinct.
- [x] b/B ambiguity is rejected or clarified.
- [x] Download time uses user-entered throughput and disclosed overhead.

**Verification:** 1000/1024 boundary and bit/byte fixtures.

**Evidence:** Storage units are normalized to exact bits with SI decimal and IEC binary prefixes explicitly separated (`1 kB = 1000 B`, `1 KiB = 1024 B`); exact symbols preserve b/B case and ambiguous text is rejected. Download-time mode uses only entered throughput and an explicit overhead percentage; no network capability is declared or used. IEC 80000-13:2025 is recorded in the registry source note. Focused tests cover the 1000/1024 boundary, 8 b = 1 B and a 20%-overhead download literal.

# 225 — OOXML package analyzer and safe DEFLATE rebuild

**What to build:** Build DOCX/PPTX/XLSX package inspection grouped by XML/media/fonts/other plus valid max-DEFLATE repack without changing member content.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.1, AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** none for this specialized OOXML path. Generic ZIP DEFLATE ticket 222 remains unpromoted; this ticket uses a stricter OOXML-only wrapper in the already-proven terminable heavy-worker runtime.

**Status:** completed (bounded OOXML-only analyze/rebuild core)

**Suggested skills:** security-audit → code-module-design → code-tdd → browser-performance-benchmark

- [x] Relationships/content-types and document/slide/sheet counts survive rebuild.
- [x] Unsupported/macro/password packages follow explicit audited policy.
- [x] Untouched member bytes remain identical where expected.

**Verification:** OOXML corpus, relationship/content-type validation and independent reopen.

**Evidence (2026-10-07 refresh):** generic ticket 222's refusal remains truthful, but its missing controls now exist for the narrower OOXML operation: `src/engines/ooxml/package.ts` parses the ZIP central directory before decompression, refuses traversal/duplicate paths, encryption, ZIP64, unsupported methods, macro packages, >2,048 members, >12 MiB per member, >40 MiB cumulative expansion and >100× entry expansion. `src/engines/ooxml/package-codec.ts` performs level-9 DEFLATE only after that preflight inside `src/engines/office-local/worker.ts`; the shared runtime terminates the Worker on cancellation and enforces a 128 MiB hard working-set estimate/accounting boundary. Rebuild then reopens itself and rejects unless the member set, every member byte, every `.rels` byte, `[Content_Types].xml`, package kind and document/slide/sheet/relationship counts remain unchanged. External relationships are preserved byte-for-byte but never resolved; encrypted and macro-enabled packages are refused. Corpus results: XLSX 8698→5747, DOCX 9503→9617 (correctly reported **larger**, not a saving), PPTX 45410→14675; `/usr/bin/unzip -t` independently reopens all three and `zipinfo` reports every output member as deflated. Hostile traversal, >100× expansion and macro fixtures fail closed before promotion. Browser acceptance is local/lazy/worker-owned with zero external requests. Physical iOS/Android evidence is still not claimed, so this completion does not promote generic ticket 222. See `tests/ooxml-package-rebuild.test.ts` and `quality/benchmarks/heavy-local-feasibility/office-ooxml-refresh-2026-10-07.json`.

# 219 — PDF target-size solver and batch compressor

**What to build:** Add ≤KB/MB best-effort iteration over proven PDF profiles plus a bounded multi-PDF queue with isolated failures and ZIP successes.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 79, 218, 222.

**Status:** blocked

**Suggested skills:** pdf → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Target success comes only from final byte count.
- [ ] Impossible target names limiting content and suggests valid next actions.
- [ ] Batch failures isolate and successful outputs remain downloadable.

**Verification:** Target boundary, scan/text-heavy, cancel/memory and ZIP integrity fixtures.

**2026-10-10 dependency-first actual implementation (ticket still BLOCKED on #218):**
New `src/engines/pdf/target-batch-219.ts` exposes `solvePdfTarget219` and
`runPdfTargetBatch219`; the existing public **pdf-compression-lite** route
gains an explicit `target-best-effort` mode, exact integer target in KiB, and
up to four local PDF files (each ≤8 MiB; ≤20 MiB total). The solver attempts
three real, source-based JPEG RGB and Flate scan recompression profile pairs
at descending quality and pixel edge; each pass starts from the **original**
PDF, never cumulatively reencodes already lossy generations. It reparses
every actual candidate, verifies page counts/geometry and tracks the
**final PDF bytes**, reporting `met` only for `finalBytes <= targetBytes`.
Unattainable requests report the actual smallest observed candidate (or the
unchanged original), and offer `pdf-split` / `pdf-page-delete-extract`
as next actions rather than declaring success. Unsupported encoders and
input format errors remain explicit. Each batch member independently
returns `met`, `unmet` or `refused`, source/final byte sizes and attempt
outcomes; a verified STORE ZIP includes **only met PDFs**, with exact
reopen/integrity checks; best-effort PDFs remain separately downloadable,
never mislabeled as under target. Cancellation rejects the whole running
batch with no published partial output. The UI distinguishes status/counts,
warnings, target byte size and available ZIP.

`tests/pdf-target-batch-219.test.ts` uses real fixture PDFs to test exact
target equality, genuine impossibility/bounded attempt reporting, corrupt
file isolation, ZIP archive reparse and input/cancel limits; focused 4/4
PASS. A standalone compiled-route browser acceptance
`scripts/acceptance-pdf-target-batch-219.mjs` selects three files (true mixed
JPEG/Flate PDF, corrupt PDF, vector PDF) and verifies a strict 400 KiB
target, 2 valid PDFs in actual downloadable ZIP, corrupt member isolated,
independent parser reopening and network/viewport assertions. **Browser
result remains NOT_RUN until clean build executes.** Scope is deliberately
bounded: no universal compressor/target guarantee, cross-browser/physical
device memory or final #218 full-capability promotion. Numeric predecessor
#218 remains OPEN: keep #219 `blocked`, do not falsely close by bypassing
DAG or claiming Gold.

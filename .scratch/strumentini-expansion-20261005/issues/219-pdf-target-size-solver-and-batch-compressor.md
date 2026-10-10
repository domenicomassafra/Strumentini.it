# 219 — PDF target-size solver and batch compressor

**2026-10-10 FUNCTIONAL ACCEPTANCE COMPLETED:** The public `pdf-compression-lite` target mode now accepts **KiB or MiB with byte-exact unit conversion** (without reinterpreting the limit on switching units), builds up to three real JPEG/Flate quality+size candidates per file from the **original** PDF, and marks success only when the final independent PDF reopen/byte measurement is at or below the requested target. Sources with unachievable targets explain what content limits compression and link to actual compatible split/delete actions. A bounded four-PDF queue isolates invalid/unsupported inputs; genuine eligible results remain separately downloadable and a verified ZIP contains only outputs below target. Cancellation races even a suspended browser File.arrayBuffer read and never publishes partial ZIP. Existing safe #218 upstream profile is functionally completed, with exact fail-closed supported scope; arbitrary PDF transformations and physical mobile acceptance are **not** implied. `tests/pdf-target-batch-219.test.ts` **5/5 PASS**, with real `File`/ZIP/byte assertions and cancel regression. Real Chromium compiled-public-route test `scripts/acceptance-pdf-target-batch-219.mjs` independently reopened downloaded ZIP PDFs, confirmed 2/2 below **409,600 bytes**, 1 corrupt PDF isolated, and zero offsite requests: `PDF_TARGET_219_CHROMIUM_PASS source=598519 target=409600 passed=2 refused=1 ZIP=133581 no-offsite`. Browser also switched 400 KiB → 0.390625 MiB → 400 KiB, then submitted in MiB while preserving exact 409,600-byte target. This completes the bounded original functional ACs, **not Gold**, a universal PDF-compression guarantee or real physical iPhone/Android certification (separate #280/#281 remain OPEN).

**What to build:** Add ≤KB/MB best-effort iteration over proven PDF profiles plus a bounded multi-PDF queue with isolated failures and ZIP successes.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 79, 218, 222.

**Status:** completed

**Suggested skills:** pdf → code-tdd → qa-browser → browser-performance-benchmark

- [x] Target success comes only from reopened final output byte count, including KiB/MiB conversion.
- [x] Impossible target names limiting content and suggests actual compatible actions without false guarantees.
- [x] Batch failures isolate; verified successful PDFs and accepted-only ZIP remain downloadable and independently reopened.

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

**2026-10-10 post-sync cancellation fix:** Real RED in `tests/pdf-target-batch-219.test.ts`: when a browser `File.arrayBuffer()` promise never settles, aborting the batch previously left `runPdfTargetBatch219` indefinitely waiting (`expected "aborted", received "stalled"`). The narrowly scoped `readLocalFile219` races that read with the caller's `AbortSignal`, detaches its listener reliably, discards late reads, and prevents publishing partial reports/ZIP after cancellation. This **does not physically cancel underlying browser I/O**. Test GREEN after fix; #218/#219/#249 focused **17/17 PASS**. Broader memory/device acceptance and complete parent #218 remain blocked, so #219 stays OPEN.

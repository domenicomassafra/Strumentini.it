# 171 — Streaming huge CSV splitter

**What to build:** Split large CSV by row count or approximate output byte target while repeating headers, preserving dialect and avoiding duplicate whole-file memory.

**Traces to:** US-EXP-04; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 94, 101.

**Status:** completed

**Suggested skills:** code-typescript → code-module-design → code-tdd → browser-performance-benchmark

- [x] Decoded rows reconstructed from chunks match source semantics.
- [x] Each chunk repeats the intended header exactly once.
- [x] Cancellation and bounded memory work on 50MB-class fixture.

**Verification:** Large benchmark, abort and reconstruction tests.

Evidence (2026-10-06): `splitCsvBlob` reads Blob slices capped at 256 KiB through a streaming `TextDecoder`, keeps quote-aware logical records across slice boundaries, repeats the original header and record separator in every output chunk, and observes `AbortSignal` between reads and while tokenizing. `tests/table-advanced-operations.test.ts` reconstructs quoted CRLF/semicolon rows exactly, verifies byte-mode row preservation and abort, and passes a >47 MiB (50 MB-class) fixture while asserting the parser-input buffer upper bound stays below 2 MiB.

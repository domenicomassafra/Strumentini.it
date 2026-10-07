# 272 — Archive codec feasibility spike

**What to build:** Choose exact local ZIP DEFLATE/GZIP implementation and separately decide 7z/RAR inspect/extract against license, method coverage, bomb defenses, memory and mobile cost.

**Traces to:** US-EXP-04, US-EXP-06, US-EXP-09; AC-06.1

**Constraints:** C-EXP-02, C-EXP-05, C-EXP-08; security before format breadth.

**Blocked by:** None — ticket 100 is completed.

**Status:** completed

**Suggested skills:** security-audit → browser-performance-benchmark → code-tdd

- [x] ZIP/GZIP have a maintained accepted path or explicit refusal.
- [x] 7z/RAR are independent decisions and may remain REFUSE.
- [x] Expansion/cancellation/resource limits are part of selection.

**Verification:** Archive corpus and dependency/license/perf matrix.

**Evidence (2026-10-06):** decision is **REFUSE production promotion**. The isolated spike measures `fflate@0.8.3` (MIT, ~12.4 KB gzip lazy) on valid/corrupt ZIP and GZIP fixtures across all five desktop engines. Corrupt inputs are rejected, but the codec exposes a hostile `../escape.txt` entry unchanged; the small adversarial corpus also demonstrates ~228× ZIP and ~320× GZIP expansion, and the synchronous API requires outer worker termination or a bounded streaming wrapper for cancellation. Any future reopening must reject absolute/parent-traversal paths, cap entries/per-entry/cumulative expanded bytes and expansion ratio, and own computation in the shared terminable runtime. 7z and RAR are independently **REFUSE** because no approved maintained local codec is installed/proven. Missing physical-mobile cost is recorded as an additional reason not to promote the candidate.

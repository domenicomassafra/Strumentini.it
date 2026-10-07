# 222 — Real ZIP DEFLATE compression tranche

**What to build:** Upgrade ZIP creation with store/fast/balanced/max DEFLATE while preserving current safe-path creation and reporting per-entry method plus total compression.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.1, AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 103, 272.

**Status:** completed

**Suggested skills:** security-audit → code-module-design → code-tdd → browser-performance-benchmark

- [x] **REFUSED for production promotion:** ticket 272 proved `fflate@0.8.3` can round-trip valid ZIP/GZIP fixtures but also records unresolved path-traversal, expansion-ratio and physical-mobile/cancellation evidence; therefore no DEFLATE mode is exposed until that gate is reopened and passes.
- [x] The existing canonical ZIP creator remains store-only and does not claim compression savings for incompressible inputs.
- [x] No synchronous DEFLATE codec is promoted without the shared terminable runtime plus per-entry/cumulative expanded-byte and expansion-ratio limits required by ticket 272.

**Verification:** Closed as a refusal downstream of ticket 272. Evidence: `quality/benchmarks/heavy-local-feasibility/ticket-decisions-267-275.json` and `research/lanes/12-heavy-feasibility-ticket-decisions-267-275.md`; reopen only after the documented safety/mobile promotion conditions are satisfied.

**2026-10-07 scoped refresh:** ticket 225 now uses `fflate@0.8.3` only behind an OOXML-specific central-directory preflight, strict entry/expanded-byte/ratio limits and the shared terminable Worker runtime. That narrower proof does **not** promote generic ZIP fast/balanced/max modes, does not change the canonical STORE-only ZIP creator, and does not invent physical-device evidence for this ticket.

# 237 — True PDF redaction with post-export proof

**What to build:** Add page-region redaction only when underlying content can be proven removed/inactivated; covering rectangles alone never count, and unsupported cases must refuse.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → security-audit → code-tdd → qa-browser

- [ ] Post-export text/image/object inspection proves supported redacted content absent.
- [ ] Visual result matches selected regions.
- [ ] Unsupported content model returns refusal/warning, never fake success.

**Verification:** Recoverability adversarial corpus, post-redaction extraction and rendered review.

**2026-10-09 PRIME security review — SOURCE-ONLY, NOT PUBLIC, NOT GOLD:** Preserved the bounded raster-only engine and offline tests from worker commit `aeb73b3`; added pre-render declared-image pixel caps against small compressed memory-bomb input. **16/16** focused tests PASS including deliberately recoverable pixels, hidden orphan object, trailing bytes, oversized declared image geometry and unsupported source refusals. The engine constructs a fresh image-only PDF and checks the decompressed RGB output; unlike opaque rectangles on the source PDF, it does not copy original objects. However, this does **not** close the original security-sensitive acceptance: independent security audit, broader malicious/complex PDF corpus (including rotated/scanned/mixed transparency models), end-user verification and physical mobile cancellation/memory tests are still missing. The public `src/tools/pdf-secure-redaction/manifest.ts`, route and UI from the worker branch are intentionally **not integrated**. Therefore no claim of generally secure redaction, no public download, no new Gold, and **Status remains `ready-for-agent`**. `cand-269` belongs exclusively to #243; reserve `cand-270` if/when a separately audited manifest is admitted. Re-evaluate the parser's coverage of unsupported models and PDF.js rasterization, downstream rendering and no-recoverability with truly independent tools before publication.

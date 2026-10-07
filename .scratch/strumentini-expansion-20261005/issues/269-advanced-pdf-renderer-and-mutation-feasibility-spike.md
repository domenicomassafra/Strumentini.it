# 269 — Advanced PDF renderer and mutation feasibility spike

**What to build:** Benchmark local PDF render/edit options needed for thumbnails, overlays, encryption, redaction, repair, PDF/A and rich conversion while preserving current in-house engine where it is already stronger/smaller.

**Traces to:** US-EXP-04, US-EXP-06; AC-06.1

**Constraints:** C-EXP-02, C-EXP-05, C-EXP-08; no dependency promotion without measured evidence.

**Blocked by:** None for the feasibility decision. Ticket 100 preflight and ticket 101 shared worker/cancellation runtime are complete; physical mobile memory evidence remains a promotion prerequisite.

**Status:** completed

**Suggested skills:** pdf → security-audit → browser-performance-benchmark → qa-browser

- [x] Capabilities are decided independently rather than one all-or-nothing library choice.
- [x] The 200-page desktop case is measured; production promotion is refused until physical iOS/Android memory cases exist.
- [x] License and fidelity limitations are recorded.

**Verification:** Dependency/capability matrix and representative PDF corpus.

**Evidence (2026-10-07 re-evaluation):** decision is **REFUSE new advanced-PDF dependency production promotion**. Existing in-house operations remain preferred; @cantoo/pdf-lib@2.11.1 stays a bounded mutation spike and pdfjs-dist@6.4.299 a lazy render/text spike. The 200-page corpus passes page-count/mutation/save, page-200 text extraction and immediate PDF.js render cancellation in every desktop engine with zero external requests. Ticket 100 preflight and ticket 101 worker termination/resource ceilings are complete. Encryption, irreversible redaction, repair, PDF/A and rich conversion remain explicit REFUSE outcomes. Genuine iOS Safari/Android Chrome memory cases remain NOT_RUN, so no candidate is promoted from this decision.

# 56 — Office-to-PDF and printable export pack

**What to build:** Add DOCX→PDF, XLSX→PDF, PPTX→PDF where rendering fidelity passes the feasibility gate, plus deterministic TXT/Markdown/HTML/CSV→PDF printable exports with explicit page size, orientation, margins, fonts, wrapping and page-number controls.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-03, C-EXP-05, C-EXP-08

**Constraints:** Rich Office routes are not promoted until font/layout/table/image fidelity is measured; text/markup printable export must be deterministic and not rely on remote rendering.

**Blocked by:** 256, 257, 258, 259.

**Status:** blocked

- [ ] TXT/MD/HTML/CSV→PDF share a print-layout engine with format-specific content mapping.
- [ ] DOCX/XLSX/PPTX→PDF each have a fidelity corpus and unsupported-feature list before public claims.
- [ ] Output reports pages, page size and any layout warnings.

**Verification:** Visual/fidelity corpus, PDF structural validation, page/layout snapshots, font fallback cases, and genuine mobile acceptance for supported sizes.

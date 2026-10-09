# 56 — Office-to-PDF and printable export pack

**What to build:** Add DOCX→PDF, XLSX→PDF, PPTX→PDF where rendering fidelity passes the feasibility gate, plus deterministic TXT/Markdown/HTML/CSV→PDF printable exports with explicit page size, orientation, margins, fonts, wrapping and page-number controls.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-03, C-EXP-05, C-EXP-08

**Constraints:** Rich Office routes are not promoted until font/layout/table/image fidelity is measured; text/markup printable export must be deterministic and not rely on remote rendering.

**Blocked by:** 256, 257, 258, 259.

**Status:** ready-for-agent

- [x] TXT/MD/HTML/CSV→PDF share a print-layout engine with format-specific content mapping (completed downstream #256; new bounded file-input gate tested here).
- [ ] DOCX/XLSX/PPTX→PDF each have a fidelity corpus and unsupported-feature list before public claims.
- [x] Output reports pages, page size and any layout warnings for the accepted printable text/markup subset.

**Verification:** Visual/fidelity corpus, PDF structural validation, page/layout snapshots, font fallback cases, and genuine mobile acceptance for supported sizes.

**2026-10-09 independent #056 worker tranche, candidate only:** New, isolated
`src/engines/pdf/office-print-pack-56.ts` exposes a **file-input-only** semantic
print pack for UTF-8 `.txt/.text/.md/.markdown/.html/.htm/.csv`. It calls the
existing, already accepted `#256 buildPrintablePdf` (A4/Letter, portrait/
landscape, 24–90 pt margins, Courier 8–14 pt, optional page numbering, bounded
wrapping/tables) rather than inventing a competing renderer. A real PDF is
returned only after an independent, lazy PDF.js reopen checks page count, all
MediaBox sizes and at least one body text item beyond the numeric footer;
`verifyEveryPage=false` explicitly records only first/middle/last inspection.
Output includes source kind, `SEMANTIC_PRINT_ONLY`, page sizes, page count,
real layout warnings, inspected-page count and explicit fidelity limitations.

The supported file path is **local-only** and refuses empty or >512 KiB,
malformed UTF-8, UTF-16 BOM, binary controls, size mutation during read,
unrecognized/conflicting MIME, and spoofed Office ZIP/OLE/PDF/RTF magic in a
`.txt` file. File extensions/MIME for **DOCX/XLSX/PPTX/ODT/ODS/ODP**, including
legacy and macro-enabled variants, are rejected **before reading bytes** via
`PDF56_OFFICE_FIDELITY_REFUSED`. The #270 feasibility spike has not approved a
browser-local page-faithful Office renderer; #257/#258/#259 record the explicit
production refusals. There is **no cloud/server backend, fake converter, silent
loss of workbook layout, or claim of Office PDF fidelity**. HTML is parsed
as inert markup and CSS, scripts, embedded media and remote links are not
executed/resolved. Unicode unsupported by Courier WinAnsi refuses without
glyph replacement. A file containing only active/stripped HTML is refused
as `PDF56_BLANK_OUTPUT` even when the page footer exists.

`src/engines/pdf/office-print-worker-56.ts` is a private disposable Worker
for real browser-side cancellation of synchronous #256 page layout; abort
terminates it and prevents any partial artifact. The independent PDF.js
reopen can also be aborted/destroyed. The Node-only test fallback executes
the same layout synchronously and checks cancellation before/after it; it
does **not** claim mid-layout interruption. The Worker message/abort lifecycle
is unit-tested with a deterministic worker stub. No live browser test of this
new Worker chunk, no production UI/route, and no generated catalog/registry
or public manifest were introduced.

**Scoped proof:** `npx vitest run tests/office-print-pack-56.test.ts
tests/printable-pdf-256.test.ts` → **15/15 PASS (11 new #056 tests + 4
regression #256)**. Real TXT (multipage with source tail and footers), Markdown
(landscape Letter), HTML (anti-exec/zero fetch), multiline CSV (heading on
every page and last-row proof) are emitted and **reopened with an independent
PDF.js parser**; layout byte determinism, font/glyph refusal, cancelled reads,
Worker termination, MIME/magic spoofing and Office refusals are covered.
Isolated TypeScript check of new engine/worker/test and Git whitespace check
PASS. Prior complete browser #256 render proof (23/23 pages with no clipping)
remains valid for its original integrated route; it is not recast as a test
of this new file-input/Worker seam.

**Canonical status remains `ready-for-agent` / OPEN.** Office fidelity corpus,
approved local renderer and public routes remain absent by safety decision.
The new Worker's actual browser message/termination path and mobile device
memory are untested, so no COMPLETE, Gold, release or UI approval is implied.

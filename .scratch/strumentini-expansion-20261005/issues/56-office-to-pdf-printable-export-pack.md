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

**PRIME browser acceptance 2026-10-09 17:00 (source-only, 14 checks PASS):** A standalone real Chromium 390×844 test in `scripts/acceptance-office-print-56.browser.mjs` starts a temporary local Vite HTTP server, imports the actual `office-print-pack-56.ts`, creates a genuine UTF-8 `File`, runs its real Vite-bundled disposable layout Worker, obtains a `%PDF-` A4 artifact (816 bytes), and checks one-page/MediaBox/text parity both through the engine's PDF.js verification and a **separate unbundled PDF.js instance**. Source text `Capitolo locale Riga verificata 123 Fine documento` and footer `1 / 1` survive. A `.docx` is refused before any file read, in-flight operation abort returns `AbortError`, and browser sees no offsite request or JavaScript error. The first live browser attempt discovered `No GlobalWorkerOptions.workerSrc specified` in the engine's independent PDF.js verification: fixed by assigning the Vite-local `pdfjs-dist/legacy/build/pdf.worker.mjs?url` before reopening output; browser retest PASS. This proves the bounded *desktop browser* Worker/verification seam, not physical mobile memory, full cancellation latency benchmarking or Office fidelity. Original rich Office AC remains unchecked; no public route, Gold or deploy.

**2026-10-09 separate abort-during-File-read RED→GREEN (still OPEN):** A genuine gap remained before Worker execution: `exportOfficePrintable56` awaited `file.arrayBuffer()` without being able to settle when the local file read promise stalled. The new deterministic test in `tests/office-print-pack-56.test.ts` reproduced **RED** (`expected aborted, received stalled` at 109ms). `readFile56` now races the read with the caller's AbortSignal, rejects promptly with `AbortError`, cleans up its listener and ignores any late read instead of publishing an artifact. This does **not** claim that the native, underlying browser `File.arrayBuffer()` I/O is physically cancelled. Focused #056 + #256 **16/16 PASS**, the real Chromium standalone browser acceptance **14 checks PASS**, scoped strict TypeScript and `git diff --check` PASS. File extension/MIME and rich Office fidelity refusals remain unchanged; no public route or Gold. The original DOCX/XLSX/PPTX fidelity and physical-mobile AC are still open.

**2026-10-10 actual OOXML source-fidelity challenge corpus (conditional REFUSE, still OPEN):** `tests/office-print-corpus-56.test.ts` now opens three **existing, tracked, editable** packages under `tests/ooxml-68-corpus/complex.{docx,xlsx,pptx}`. They were created by real Office libraries in `tests/ooxml-68-generate-corpus.py` and include: DOCX styles/font table, editable table, hyperlink and raster media; XLSX worksheet, formats, chart, drawing and embedded images; PPTX editable slide, master, chart, embedded spreadsheet and raster media. The new tests assert real package parts/markup, verify the #056 public capability map names **format-specific unsupported features**, then prove actual Office MIME/extensions are rejected **without reading the file**, and a renamed ZIP `.txt` is rejected as binary. Initial test run was **RED 3/3**, because generic capability descriptions omitted Word tables, spreadsheet formulas and slide media; after replacing them with specific unsupported-feature descriptions in `src/engines/pdf/office-print-pack-56.ts`, focused #056 corpus + existing pack tests **15/15 PASS**. The browser-local Worker/PDF.js source acceptance continues to pass **14 checks**, including independent reopen, aborted work and zero external requests.

**Residual acceptance boundary:** These OOXML files are a real *source-side challenge corpus* and prove refusal and feature inventory only. There is still **no approved local Office layout engine, no reference visual/page-geometry corpus comparison, and no trustworthy DOCX/XLSX/PPTX→PDF artifact**. The original rich-Office checklist item remains unchecked, consistent with #257/#258/#259 completed as conditional refusals under #270, and physical iOS Safari/Android Chrome acceptance remains **NOT_RUN**. The accepted TXT/Markdown/HTML/CSV printable route is owned by completed #256; the extra #056 file-input/Worker seam is not publicly routed. Final focused regression including downstream #256: **19/19 PASS**; strict scoped TypeScript with `vite/client` declarations **PASS**; `git diff --check` **PASS**. Full-tree TypeScript was blocked during parallel edits by another worker's incomplete `tests/image-compression-palette-quantization-47.test.ts`; it was not altered in this task. This tranche makes the refusal precise and auditable but is not evidence for falsely closing #056, #024, Gold or production certification.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #368, #392.

**Next actionable AC:** DOCX/XLSX/PPTX→PDF each have a fidelity corpus and unsupported-feature list before public claims.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.

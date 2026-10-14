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

**2026-10-12 wave16 independent UTF-8 BOM signature guard (OPEN):** A material file-gateway fail-open remained: `decodeText56` checked Office ZIP/RTF/PDF signatures only at byte 0, while UTF-8 decoding discarded a leading BOM (`EF BB BF`). A real `.txt`/`.md` file declared `text/plain;charset=UTF-8` with a BOM followed by `{\\rtf1` or `%PDF-` was therefore exported as a valid but misleading semantic PDF; actual output was independently reopened with PDF.js and its text retained the RTF/PDF header literally. New `tests/office-print-pack-wave16-56.test.ts` reproduced this as **RED** (conversion unexpectedly resolved). The isolated `src/engines/pdf/office-print-pack-56.ts` gate now skips leading UTF-8 BOMs **only for signature inspection** before text decoding; RTF/PDF and genuine OOXML ZIP renamed `.txt` behind a BOM now refuse `PDF56_BINARY_REFUSED`, including repeated BOMs. A legitimate BOM-prefixed UTF-8 `.txt` still exports an actual Letter PDF, whose MediaBox and Italian body text are independently verified with PDF.js. New suite **3/3 PASS**, combined #056 and #256 focused regression **22/22 PASS across four suites**, strict scoped TypeScript (`es2023`, `vite/client`) **PASS**. This fixes source-format refusal only; **no rich Office conversion, production route, Gold/deploy, physical mobile proof or device approval** follows. Original checklist/status and HEIC-unrelated work are unchanged; #056 remains OPEN pending the actual DOCX/XLSX/PPTX visual fidelity corpus, approved renderer and mobile AC.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #368, #392.

**Next actionable AC:** DOCX/XLSX/PPTX→PDF each have a fidelity corpus and unsupported-feature list before public claims.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.

**2026-10-13 worker-3 isolated #056 print-layout integrity (OPEN / NO_GO for Office fidelity):** Actual #256 PDFs with genuine PDF.js text, but with a Worker-returned Letter-landscape page for an A4-portrait request, wrong margin/font metadata or wrong source kind, previously passed the independent reopen gate because it compared page geometry against the Worker's own metadata. `tests/office-print-056-20261013-layout-integrity.test.ts` reproduced four real, parsable wrong-output false accepts (RED 4/4). A separate genuine PDF with the requested page numbers omitted also passed (RED); conversely a genuine PDF with unwanted footer passed when page numbers were disabled (RED). The isolated `src/engines/pdf/office-print-pack-56.ts` now validates expected A4/Letter dimensions, orientation, margins, font size and format against the **original request** and independent PDF MediaBoxes; reconstructs the footer from PDF.js items at the known footer baseline (PDF.js may split single glyphs) to enforce page-number toggles on inspected pages. The accepted semantic engine, file/MIME refusals, source limits and physical font policy are unchanged. New regression **6/6 GREEN**; five focused #056/#256 suites **28/28 PASS**; strict targeted TypeScript **PASS**; genuine 390×844 Chromium browser/Vite disposable Worker + independent PDF.js reopen **14 checks PASS** (unrelated heavy-browser spike dependency-scan warning did not block result). No public route, Gold, deploy or mobile device evidence. **Office fidelity decision remains NO_GO**: native `window.print()` initiates a browser print dialog and cannot by itself establish reproducible DOCX/XLSX/PPTX rendering, embedded-font equivalence, layout/graphics accuracy or deterministic cross-device PDF output; `@page`/CSS print handling and local/web fonts are browser/runtime-dependent. The existing DOCX/XLSX/PPTX source corpus is a feature/refusal challenge, not an approved visual-reference-to-PDF parity corpus. Keep the original Office conversion AC unchecked and status OPEN, pending approved renderer, page/shape/font/image comparison, and real iOS Safari/Android Chrome acceptance. This source-only worker diff is left for serial prime integration; no worker Git writes.

**2026-10-13 urgent independent P2 review follow-up (source-only, still OPEN):** Independent worker-4 found that a genuine A4 PDF could be produced with **actual** Courier `fontPt=12`, `marginPt=60`, page numbers disabled, while the Worker response **falsely claimed** `fontPt=10`, `marginPt=42`. The earlier gate trusted those claimed values and accepted the real PDF bytes, despite PDF.js exposing the first text glyph's scale and baseline as 12 pt and `841.89−60−12=769.89 pt`, instead of requested 10 pt at `841.89−42−10=789.89 pt`. Separately, legitimate TXT containing *only* `1 / 1` or `2/7` wrongly failed `PDF56_BLANK_OUTPUT` because its body was classified as a page-number footer by regex despite appearing at the body baseline. Expanded `tests/office-print-056-20261013-layout-integrity.test.ts` with three actual, independently parseable Worker-output PDFs that lie about their measured margins/font (both independently and together), four legitimate numeric-only source exports both with and without page numbering, and one multiline/leading-blank TXT plus CSV-pagination positive. Initial **RED 7/7** for the new negative/positive cases; after correction, complete isolated **14/14 GREEN**, combined five #056/#256 suites **36/36 PASS**. `verifyPrintedPdf56` now inspects the actual PDF.js body glyph transforms on inspected pages: actual Courier font size, printable horizontal bounds, first/top baseline and integer line-height grid, and fixed-width text horizontal grid; the numeric-only body detection excludes actual footer *by its coordinate*, not by its numeric content. Existing footer and MediaBox verification remains. This **detects the documented metadata-lie repro** without rejecting these valid printable cases; it is a bounded page-layout integrity gate, **not full source-to-PDF textual/visual parity or arbitrary-document font equivalence**. Post-fix real browser/Vite Worker and independently reopened PDF **14/14 checks PASS**; unrelated optional Vite spike-import warnings remain. Original rich Office fidelity, screenshot comparison, physical mobile and public release gates stay OPEN/NO_GO. No Git actions by worker; prime serial integration/QA required.

## 2026-10-14 worker-4 — actual printable UI late-upload private-document leak (RED → GREEN; Office fidelity still OPEN)

**New P1 real-user wrong-document reproduction:** The *existing public* `/tools/printable-pdf-from-text/` UI `PrintablePdfTool.tsx` awaited `file.arrayBuffer()` without binding the response to the user's latest selected source. With a first `private-slow.txt` file read suspended, selecting `approved-second.txt` displayed the approved content; releasing the older read later silently replaced it and let the user export the *first/private* document. `tests/printable-pdf-56-20261014-upload-order.browser.mjs` reproduces this against the real built Astro static route and real Chromium UI at 390×844, obtains an **actual downloaded PDF** and independently opens it with `pypdf.PdfReader(strict=True)`, `pdfminer.high_level.extract_text` and native macOS PDFKit. **RED before fix, exit 1:** genuine 699-byte PDF, all three consumers find `PRIVATE_STALE_UPLOAD_56_73411`, all three do **not** find `APPROVED_SECOND_UPLOAD_56_93527`. This was a source-choice privacy/fidelity defect, not an allegation of network exfiltration: the browser made zero offsite requests.

**Bounded consumer-only fix:** `src/components/tools/PrintablePdfTool.tsx` associates each asynchronous file read with a monotonically increasing UI epoch. Superseded reads may finish but cannot overwrite a newer upload or user-entered text, set stale errors, or republish a PDF; manual text edits, format selection, reset/cancel and generation revoke old epochs. While the current selection is reading, generation is disabled rather than exporting a previously typed document. File input remains enabled to let the user replace a stalled selection. Existing #256 PDF generator, #56 Office fidelity refusal, shared PDF parser/inflate, upload size/Unicode contract and no-offsite policy are unchanged.

**GREEN with same actual product/independent readers:** `npm run build` exit 0 (293 static pages, existing Vite chunk/externalization warnings); rebuilt public route downloaded a 701-byte PDF with **only** the approved newer-source marker, with `pypdf`, `pdfminer` and native PDFKit all independently reporting `PRIVATE=false APPROVED=true`, browser external requests **0**. Same browser test also covers manual textarea edit winning over delayed file read, reset while read remains pending (no stale text/output), a valid successful PDF and a real >512 KiB file refusal that revokes the prior success. Five adjacent #56/#256 Vitest suites **36/36 PASS** and `git diff --check` PASS. No Print dialog or physical device was invoked or represented as passing. Original `DOCX/XLSX/PPTX` layout parity/font/image/slide/worksheet corpus remains **NOT_RUN/NO_GO**; the only exported document under this test is the supported deterministic semantic TXT PDF. Physical iOS Safari/Android Chrome and final release/Gold/security acceptance remain **OPEN**, ticket status unchanged.

# 243 — PDF fill annotate and write overlays

**What to build:** Add bounded text/drawing/highlight/form-fill annotation workflows where the PDF stack preserves integrity, with page thumbnail navigation and explicit flatten/preserve behavior.

**Traces to:** US-EXP-04; AC-04.1, AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Dependencies:** existing PDF parser, safe page-content cloning and local PDF.js thumbnail. Earlier #215/#269 blockers do not prevent the verified flattened-only subset.

**Status:** completed

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [x] Existing form fields are filled without inventing unsupported field types.
- [x] Annotation placement has keyboard/touch alternatives where feasible.
- [x] Flattened vs editable annotation output is explicit and independently checked.

**Verification:** Form/annotation corpus, visual review and reopen inspection.

**2026-10-09 worker-1 bounded completion; NOT Gold or arbitrary PDF editor:** New stand-alone `src/engines/pdf/fill-overlays-243.ts`, `src/components/tools/pdf/PdfFillOverlays243Tool.tsx`, `src/pages/tools/pdf-fill-overlays.astro`, own manifest/module (`cand-269`), unit and Chromium acceptance. Supported source subset: (a) user text overlay on a page without existing fields/annotations; (b) visible semi-transparent rectangle highlight on such a page (not redaction); (c) a real AcroForm with single page-backed terminal text widget `/FT /Tx`, plain ASCII field name, no pre-existing appearance/actions, no options/children, no signature flags, no special field flags. The user picks the actual supported field; text is fitted into its existing `/Rect`. All paths **always flatten into visible non-editable page-content streams**, preserving prior page-content bytes and page counts; original widget and AcroForm are intentionally removed, verified by reparse and independently by PDF.js. No supported editable-form export, text underline/drawing pen, annotations with editable appearance, arbitrary field formats, PDF signatures or security redaction are claimed. Refuses `/Sig`, button/choice, XFA, signatures/certification, JavaScript/actions, pre-existing unsupported annotations, page actions, unusual CropBox/UserUnit/rotation, multiline/non-ASCII text and clipped placement. PDF ≤8 MiB/24 pages, short ASCII ≤70 glyphs.

**UX and independent acceptance:** Per-page PDF.js thumbnail navigation, pointer/touch position selection and accessible keyboard numeric X/Y/size controls. Explicit flattened-versus-editable disclosure next to the form and in result. Generated result is re-opened with local PDF.js thumbnail before download. `npx vitest run tests/pdf-fill-overlays-243.test.ts` **3/3 PASS**, including true AcroForm `/Tx` fixture, signatures/buttons/extra widgets/page actions refusal, source text preserved and fields removed. `npx tsc --noEmit` **PASS**. Browser `PDF243_DEV_BASE=http://127.0.0.1:18543 npx tsx scripts/acceptance-pdf-fill-overlays-243.ts` **PASS** using one isolated temporary Vite server at 390×844: real AcroForm widget discovered, filled with `ACRO 001`, PDF downloaded and independently reopened with PDF.js (text visible; zero annotations); original PDF overlay `OVR 002` placed with keyboard/pointer then reopened with PDF.js (original+new text present, zero annotations); highlight's PDF.js raster independently sampled **RGB [255,242,166]**, zero editable annotations. Unsupported emoji fails closed with no stale download, **0 offsite requests/browser errors**. `git diff --check` PASS. Ordinary `npx astro build` is blocked **outside the new files** by stale generated catalog for pre-existing `/tools/pdf-booklet-interleave` in the worker worktree; prime owns catalog authority. The #243 route is a noindex fallback until prime registers manifest `cand-269`; no shared generated catalog/oracle/dashboard, Gold, production, main, push or deploy edits.

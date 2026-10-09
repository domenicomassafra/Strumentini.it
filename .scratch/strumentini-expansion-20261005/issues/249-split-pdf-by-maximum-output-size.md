# 249 — Split PDF by maximum output size

**What to build:** Add deterministic page-group splitting toward a requested maximum part size, proving every successful part is ≤ ceiling or explaining why a single page/content unit prevents it.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 217, 218.

**Status:** blocked

**Suggested skills:** pdf → code-module-design → code-tdd

- [ ] Every successful part is measured under requested ceiling.
- [ ] Impossible single-page case is explicit.
- [ ] Page order is preserved and part naming/grouping previewed.

**Verification:** Boundary-size corpus and reconstructed page-order verification.

**2026-10-10 Chromium acceptance/fix:** Real compiled `pdf-split` page from an independent detached HEAD was exercised at 390px. First RED uncovered a missing human diagnostic: the engine correctly refused a >1 KiB single-page PDF, but `friendlyToolErrorIt` hid page number and exact measured bytes. The new narrow anchored `PDF_SINGLE_PAGE_TOO_LARGE` Italian mapping in `src/i18n/it/errors.ts` displays page/required byte count/requested ceiling without leaking arbitrary input. `tests/italian-errors.test.ts` adds this regression (2/2 focused suite PASS). Real browser **GREEN** on the same canonical route via the current Astro dev server: `PDF_SIZE_SPLIT_249_CHROMIUM_PASS ZIP_PARTS=2 RECONSTRUCTED_PAGES=3 LIMIT=1024 BYTE_EXACT no-offsite`; independently ZIP reopened, both PDFs verified ≤1024 B and all 3 pages retained, next impossible scan page refused with no stale ZIP, zero offsite/errors and 390px no overflow. The compiled static route had already proved source ZIP integrity before the error-message fix; the final GREEN diagnostic test was run in dev, **not** a completed all-pages production static build. Source and browser tests do not waive the unmet upstream #218 gate or physical-device requirements; status remains blocked.

**2026-10-10 dependency-first implementation (source verified, #218 gate still OPEN):** New bounded `src/engines/pdf/size-split-249.ts` implements real **exact byte measured** greedy PDF page grouping. Each candidate is actually built from contiguous original pages using the existing PDF writer, reopened with independent inspection, and compared for page count, geometry and rotation. At most 200 pages/50 parts/400 candidate builds (bounded 25 MiB source, ≤20 MiB requested per part). It never assumes individual source page byte shares, omits a page or labels an oversized part valid. If the minimum actual single-page PDF exceeds the ceiling, it throws `PDF_SINGLE_PAGE_TOO_LARGE` with precise failing page, minimum measured bytes and requested ceiling, without publishing a partial output. Interactive forms/annotations and encrypted PDFs are refused until preservation is proven. The final concatenated page sequence must be exactly 1..N. Existing `pdf-split` route (not a duplicate tool) now has an explicit mutually exclusive `size-limit` mode with KiB input; original manual grouping stays the default unchanged, manual thumbnail controls are hidden in size mode. Existing ZIP writer verifies each real part and archive bytes; no offsite route or fake estimate. New `tests/pdf-size-split-249.test.ts` first pass **3/3 PASS**: real split/actual output bytes/reopened text/pages/order, impossible 598k mixed-image single page, invalid target and cancellation. Independent compiled Chromium acceptance is `scripts/acceptance-pdf-size-split-249.mjs` with actual PDF ZIP download, independently reopened content under exact 1024-byte ceiling and failure with no stale output; its result must be run on a fresh isolated build before marking browser proof. #249 remains `blocked` because full #218 prerequisite and physical/mobile corpus are still unmet; no ticket closure/Gold/deploy claimed.

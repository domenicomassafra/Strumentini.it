# 45 — Expanded catalog IA and job-route discovery

**What to build:** Reconcile the accepted expansion into public information architecture and search so users can find concrete jobs across new families such as Conversioni e calcoli, Italia, Sicurezza/privacy, and Audio/video without exposing hundreds of indistinguishable cards or duplicating engine-level routes.

**Traces to:** US-EXP-10, US-EXP-02, US-EXP-03, US-EXP-04, US-EXP-05, US-EXP-06, US-EXP-07, US-EXP-08; AC-10.1, AC-02.1; DEC-EXP-01, DEC-EXP-07; C-EXP-03, C-EXP-04, C-EXP-09

**Constraints:** Category/count claims derive from the generated catalog; job routes need unique intent/copy/default/result behavior; no fabricated popularity ranking.

**Blocked by:** 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 65, 66, 104, 105, 106, 107.

**Status:** completed

- [x] Public groups remain cognitively manageable despite expansion and have generated real counts.
- [x] Search aliases/jobs/input types find specific high-intent routes while deduplicating equivalent engines.
- [x] Related-tool/handoff suggestions connect natural sequences such as HEIC→compress→redact or XLSX→CSV→clean.
- [x] Mobile directory/search remains usable without dumping the full catalog onto one surface.

**Verification:** Search ranking fixtures for representative Italian queries, category-count generation, duplicate-intent assertions, and desktop/mobile directory acceptance.

**2026-10-10 verified functional closure (accepted public routes only):** Source commit `cd1bf05` integrates four compact thematic public groups (`Conversioni e calcoli`, `Italia`, `Sicurezza e privacy`, `Audio e video`) on the existing directory, derives facet counts from the **actual 269-entry generated catalog** and keeps canonical tool routes unique. The `/cerca/` page adds supported Italian HEIC/EXIF/TSV job aliases and paginates search results in sets of 12, rather than rendering the entire catalog. `src/catalog/job-routes.ts` validates four step-by-step journeys against existing manifests: local image conversion → compression → EXIF removal, PDF metadata inspection → removal → re-inspection, TSV→CSV → cleanup → deduplication, and SRT/VTT subtitle extraction → word counting. `ItalianToolPage.astro` exposes relevant next-step links. **No automatic binary/text handoff:** every link instructs manual re-selection or copying into the next tool; each route keeps its own real defaults and output semantics. The visible-signature link resolves to the **existing** `/tools/pdf-watermark/#firma-grafica-visiva` section, explicitly *not* to a digital certificate signature or a new catalog record. The HEIC journey is **conditional on browser support** and expressly lacks authentic iPhone-origin/physical acceptance, consistent with still-blocked #58/#268; no unapproved codec is presented as universally supported.

**Measured acceptance:** `tests/catalog-job-routes-45.test.ts` verifies all generated category membership exactly once, missing and duplicate route failures, manifest-backed journey edges, and eight specific Italian intent searches. Focused job/search/catalog suites **28/28 PASS**. Real browser `scripts/acceptance-job-routes-45.mjs` verified discovery, concrete canonical routes, signature anchor, EXIF search, progressive show-more and no overflow at **390px mobile CSS** and **1280px desktop CSS**. Generated catalog check PASS and `git diff --check` PASS. This closes the four **functional discovery AC**, not unrelated source-fidelity or physical-device implementation blockers in the earlier program DAG.

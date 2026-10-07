# 299 — Image combine grid stack and social slicing

**What to build:** Add horizontal/vertical/grid composition plus deterministic social/carousel slicing with ordering, gaps/backgrounds and multi-output ZIP.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 213, 222.

**Status:** completed

**Suggested skills:** interaction-design → code-module-design → code-tdd → qa-browser

- [x] Ordering/removal is previewed before export.
- [x] Slice dimensions/counts are exact and named deterministically.
- [x] Multi-output ZIP contains only previewed outputs.

**Verification:** Mixed aspect fixtures, pixel dimensions and ZIP integrity.

**Evidence (2026-10-07):** The existing `/tools/contact-sheet-generator/` route now contains stack/grid and social-slicing modes instead of adding duplicate public routes. The compose UI previews the exact selected order and supports move/remove before export; the engine records each source name, dimensions, bytes and final placement plus produced PNG bytes. `planSlices` partitions the requested axis exactly, including deterministic remainder distribution, and filenames include index/total/real dimensions. Multi-output packaging uses the existing safe STORE-only ZIP seam and reinspects the central directory after creation; entry names, ordering and method must exactly match the preview list or the job fails. `scripts/acceptance-image-advanced-workspace.mjs` proves reordered composition, exact 10px→[4,3,3] slicing, three preview rows, downloaded `PK` ZIP, central-directory equality, keyboard/mobile-width usability and local-only traffic. Focused image suites pass 47/47.

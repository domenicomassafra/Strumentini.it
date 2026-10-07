# 317 — Contact sheet favicon and platform export upgrades

**What to build:** Deepen contact-sheet, favicon/app-icon and platform-size tools with ordering, exact output sizes, multi-output ZIP and generated-vs-source dimension summary.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 97, 222.

**Status:** completed

**Suggested skills:** interaction-design → code-tdd → qa-browser

- [x] All generated files have verified dimensions/type.
- [x] Ordering/naming is deterministic.
- [x] ZIP output matches previewed variant list exactly.

**Verification:** Output dimension/signature fixtures and ZIP integrity.

**Evidence (2026-10-06):** Existing canonical routes/oracles are extended in place: contact sheet `cand-156`, favicon/app-icon `cand-157`, platform presets `cand-146`; no duplicate public routes or new oracle IDs were added. Contact sheets declare selection vs filename-A→Z ordering, record each source name/dimensions in generated order and produce one PNG through the existing signature+decode+dimension verifier. Favicon/app-icon sizes are deduplicated then sorted numerically, filenames are deterministic, and every PNG records/verifies exact square size/type. The batch is packaged only through the pre-existing safe ZIP STORE seam: after creation its central directory is reinspected, every method must be 0, and entry paths must match the previewed output filenames exactly and in the same order; DEFLATE remains untouched. `platform-size-presets` keeps calculation mode and adds an optional same-route file export using the sourced centred crop, no stretch, deterministic preset filename and an exact verified PNG canvas. Focused tests prove deterministic size normalization and STORE ZIP order; Chromium acceptance proves contact filename ordering/dimensions, favicon sizes `[16,32,64]`, exact ZIP preview/entry equality and PK download, plus a verified 1080×1080 Instagram-square PNG export.

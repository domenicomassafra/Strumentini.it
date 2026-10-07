# 260 — PPTX image export and text outline

**What to build:** Add deterministic PPTX text/outline extraction and slide raster export where approved parser/renderer supports them, separating semantic text from visual slide images.

**Traces to:** US-EXP-04, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 270 — faithful slide raster export remains refused by the Office renderer feasibility decision; bounded package analysis itself is unblocked by 225.

**Status:** completed (bounded text outline + media inventory; raster export refused downstream of 270)

**Suggested skills:** code-module-design → code-tdd → qa-browser

- [x] Outline preserves slide/title/text provenance.
- [ ] Raster export reports slide pixel dimensions/type.
- [x] Unsupported embedded/media elements are listed.

**Verification:** PPTX corpus, text expectations and slide render verification.

**Evidence (2026-10-07 downstream):** `extractPptxOutline` validates/decompresses PPTX through the bounded ticket-225 package path, sorts `ppt/slides/slideN.xml` deterministically, extracts paragraph text with slide number/part provenance, and inventories `ppt/media/*` parts without rendering them. The sample corpus yields slide 1 title `Presentazione di prova` and body `Valore verificabile: 12345` in unit and browser acceptance. `rasterExport` is deliberately `{ status: "REFUSED", reason: "No approved faithful PPTX renderer exists in the bounded Office runtime." }`; ticket 270 explicitly declined the previous PPTX renderer path and no replacement renderer is approved. Therefore AC raster dimensions/type remains open rather than being faked from media assets or screenshots.

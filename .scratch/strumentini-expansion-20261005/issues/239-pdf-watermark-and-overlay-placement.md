# 239 — PDF watermark and overlay placement

**What to build:** Add text/image watermark and generic overlay placement with page range, opacity, rotation, scale and position preview, keeping watermark distinct from irreversible redaction.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [x] Text overlay range/placement is previewed on actual PDF.js page geometry, within a four-page window.
- [x] Watermark is visibly labelled as overlay, NOT privacy redaction; original PDF contents remain readable.
- [x] Text-overlay output PDF page count/signature and rendered placement are verified on bounded browser fixture.

**Verification:** Range/opacity/rotation/position corpus and rendered visual review.

**2026-10-08 bounded text-overlay implementation (partial #239, NOT Gold):** Implemented `src/engines/pdf/watermark.ts` with text watermark and strict page ranges, 0.1–1 alpha in separate `/ExtGState`, arbitrary -180..180 rotation, 0.5–3 scale, nine positions, 12–72pt margin, CropBox and 0/90/180/270 source page rotation. New per-page `/Contents` overlay and font/transparency resources are created without touching original content streams; output is re-parsed and every original stream's bytes plus page geometry/count are checked. Only ASCII text is supported and escaped against PDF content injection; invalid, duplicate, reversed, out-of-range inputs and impossible rotated bounds fail closed. Preview on real local PDF.js thumbnails and export UI at `/tools/pdf-watermark/` prominently state that overlay does **not** redact or erase underlying data. Route registered as `cand-262` with `pdf-gold`/`pdf-signature` and **no Gold receipt**; 262 catalog tools/257 historical Gold unchanged. `tests/pdf-watermark-239.test.ts` **21/21 PASS**; `astro check` **0 errors/0 warnings**; static build **282 pages**. Real desktop Chromium **390×844** acceptance `npx tsx tests/pdf-watermark-239.browser.ts` **PASS**: invalid range refused, preview for selected pages 2–3, downloaded four-page PDF (1343→2363 bytes), original streams verified unchanged, opacity 0.45 explicitly re-parsed. Independent PDF.js PNG rendering: unselected page 1 **0 changed pixels**, selected page 2 **1384 changed pixels** in centered bounding box `[172,285,289,311]`; 0 offsite requests. Local screenshots `/tmp/str239-watermark-preview.png` and `/tmp/str239-watermark-page2.png` (not physical-device evidence).

**Remaining OPEN before full #239 completion:** image watermark / JPEG Image XObject embedding and preview not implemented (optional in this sprint, but part of broader ticket), physical devices, cross-browser and diverse complex real PDFs, independent Gold and exhaustive rotated overlay visual corpus. No privacy redaction is offered or claimed. The dashboard's supported `ready-for-agent` state denotes this **OPEN partial implementation**, not that work is unstarted or completed; the source registry intentionally has no in_progress status.

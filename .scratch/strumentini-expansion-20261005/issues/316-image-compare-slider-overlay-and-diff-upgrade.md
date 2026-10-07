# 316 — Image compare slider overlay and diff upgrade

**What to build:** Upgrade comparison with actual slider/overlay/diff visualization plus dimensions, bytes and bounded pixel-difference metrics, handling unequal dimensions explicitly.

**Traces to:** US-EXP-04

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 97 — Migrate image shared renderers to Result v2.

**Status:** completed

**Suggested skills:** interaction-design → code-tdd → qa-browser

- [x] Slider and keyboard alternative expose both images.
- [x] Unequal dimensions require alignment policy rather than silent stretch.
- [x] Pixel-diff summary states algorithm/threshold.

**Verification:** Identical/changed/different-size image corpus and visual browser checks.

**Evidence (2026-10-06):** The existing `image-compare-slider` route/oracle `cand-159` remains canonical. `compareImagesLocal` now uses the explicit `top-left-overlap-no-stretch` policy; unequal dimensions are never silently stretched, the native overlap box is reported and unmatched pixels are counted separately. `compareRgbaBounded` samples at most 250,000 native overlap pixels at deterministic evenly spaced indices, compares RGBA channels against an integer 0–255 threshold and reports sampled/different pixels, ratio and mean absolute channel difference. A verified PNG absolute-RGB diff is generated from the overlap. The route UI exposes slider, overlay and diff modes; the range controls work by keyboard and A/Metà/B buttons give a non-drag alternative exposing both images. Focused tests cover threshold behavior, unequal row strides and the sampling bound. Real Chromium acceptance uses different-size images, proves ArrowRight/ArrowLeft range control, A/B buttons, diff rendering, no 390px horizontal overflow and LOCAL/no task-content network behavior.

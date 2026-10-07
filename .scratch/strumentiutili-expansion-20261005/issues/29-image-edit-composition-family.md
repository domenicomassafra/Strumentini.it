# 29 — Image edit/composition family

**What to build:** Add reusable local image operations for rotate/flip, text/watermark overlay, combine/stack/grid, round/profile crop, borders/backgrounds, image↔Base64, social/carousel slicing, and basic grayscale/sepia/brightness/contrast/saturation controls using one preview/export workspace.

**Traces to:** US-EXP-04; AC-04.1, AC-04.2; DEC-EXP-01, DEC-EXP-03, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-09

**Constraints:** Preserve orientation/color-space transparency behavior as far as the chosen browser APIs support it and disclose format changes.

**Blocked by:** 213, 298, 299, 300.

**Status:** completed

- [x] Editing controls update a real preview and export the intended pixel result.
- [x] Batch/composition tools provide ordering/removal and before→after dimensions/size.
- [x] Existing crop/resize/compression tools can reuse the same file workspace without behavior regression.

**Verification:** Pixel-level fixtures for transforms, alpha/orientation cases, mobile touch editing, and output metadata/size assertions.

**Evidence (2026-10-07):** Dependency tickets 213, 298, 299 and 300 are completed on the existing canonical image routes. Crop/rotate/flip/round-crop/background/tonal editing continues to use the shared transform workspace and exact preview/export pixel pipeline; watermark/overlay extends the screenshot helper, while stack/grid/slicing extends the contact-sheet route. Composition now reports source dimensions/bytes and produced dimensions/bytes, with explicit pre-export ordering/removal. Base64 remains a bounded mode on its existing route. Regression coverage across `image-resize-engine`, `image-transform-workspace`, `image-advanced-workspace`, `image-media-tools`, `image-upgrade-cluster` and `image-result-v2` passes 47/47, and the advanced browser acceptance passes the new composition modes at 390px without adding duplicate public routes.

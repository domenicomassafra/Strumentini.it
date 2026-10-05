# 29 — Image edit/composition family

**What to build:** Add reusable local image operations for rotate/flip, text/watermark overlay, combine/stack/grid, round/profile crop, borders/backgrounds, image↔Base64, social/carousel slicing, and basic grayscale/sepia/brightness/contrast/saturation controls using one preview/export workspace.

**Traces to:** US-EXP-04; AC-04.1, AC-04.2; DEC-EXP-01, DEC-EXP-03, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-09

**Constraints:** Preserve orientation/color-space transparency behavior as far as the chosen browser APIs support it and disclose format changes.

**Blocked by:** 01, 28.

**Status:** blocked

- [ ] Editing controls update a real preview and export the intended pixel result.
- [ ] Batch/composition tools provide ordering/removal and before→after dimensions/size.
- [ ] Existing crop/resize/compression tools can reuse the same file workspace without behavior regression.

**Verification:** Pixel-level fixtures for transforms, alpha/orientation cases, mobile touch editing, and output metadata/size assertions.


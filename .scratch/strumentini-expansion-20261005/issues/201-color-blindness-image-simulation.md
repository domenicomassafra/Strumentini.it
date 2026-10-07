# 201 — Color-blindness image simulation

**What to build:** Add a local image simulation tool for documented color-vision deficiency transforms with clear simulation-not-diagnosis language and original/result comparison.

**Traces to:** US-EXP-04, US-EXP-05

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 97, 103.

**Status:** completed

**Suggested skills:** inclusive-design → code-module-design → code-tdd → qa-browser

- [x] Transform model/source is documented.
- [x] Original/result preview and downloadable output show exact chosen mode.
- [x] Tool does not present simulation as medical diagnosis or universal perception.

**Verification:** Known transform matrix fixtures and visual/browser comparison.

**Evidence:** `cand-244` binds the Machado, Oliveira & Fernandes (2009) complete-dichromacy matrices to an independent R `colorspace` transcription and the dedicated `color-vision-simulation` fixture family. The implementation exposes only protanopia, deuteranopia and tritanopia at the documented complete-dichromacy endpoint, linearizes sRGB before matrix application, clamps/re-encodes to sRGB and preserves alpha. `tests/color-vision-simulation.test.ts` passes 5/5 with exact matrix and pixel fixtures. The production Image Result v2 path renders a labeled original/result comparison, shows the exact selected mode/model/DOI, keeps simulation-not-diagnosis and not-universal-perception language visible, and exposes a PNG download only after shared signature/MIME/dimension verification. `node scripts/acceptance-color-vision-simulation.mjs` passes Chromium acceptance for all three modes with two labeled previews, exact mode-bearing filenames, zero external/non-GET/task-body requests, no runtime errors and no 390px overflow; receipt: `quality/receipts/color-vision-simulation/browser-acceptance.json`. `python3 quality/oracles/validate.py` passes. Global catalog generation was attempted but is currently blocked by unrelated concurrently staged tickets (`audio-generator` cand-248/browser-audio-utilities, `image-transform-workspace` cand-247/image-transform-workspace and an overlong browser-TTS summary), so generated catalog/inventory refresh is left to the shared integration gate rather than overlapping those lanes.

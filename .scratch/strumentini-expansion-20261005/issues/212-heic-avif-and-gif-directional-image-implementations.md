# 212 — HEIC AVIF and GIF directional image implementations

**What to build:** After the codec feasibility decision, implement only accepted directional HEIC/HEIF decode, AVIF encode/decode and GIF still/animated conversion jobs with explicit fidelity/animation rules.

**Traces to:** US-EXP-04, US-EXP-06, US-EXP-10; AC-06.1, AC-10.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 103, 206, 268.

**Status:** in-progress — GIF still-frame disclosure verified; HEIC/iPhone and physical mobile acceptance pending

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Only ACCEPTED directions from feasibility matrix become routes/modes.
- [ ] HEIC real-iPhone and animated GIF fixtures keep orientation/timing/transparency within declared limits.
- [x] Static-frame extraction is distinct from animated conversion.

**Verification:** Real corpus, signature/decode, animation timing and physical mobile receipts.

**Implementation evidence (2026-10-09, partial):** `src/engines/image/gif-structure.ts` bounds GIF container inspection at the existing 40 MiB image limit and 256 frames, validates frame boundaries, and measures the raw 1/100-second frame delays, transparency flags and disposal methods. The existing `image-format-conversion` route continues to export a **still of frame 1 only**; the result now shows measured input frame count/nominal timing and explicitly says animation is discarded. A malformed/truncated GIF cannot obtain an apparent successful static conversion. Unit tests `tests/image-gif-212.test.ts` plus existing matrix tests pass 5/5; `tests/image-gif-212.browser.mjs` confirms Chromium desktop at 390px with the actual 4-frame, 64×64 fixture (delays 25/25/25/25 centiseconds; 3 transparent frames) and independent first-frame pixel equality, PNG signature, 64×64 reopening, visible UI policy and no external requests. The 2×2 transparent still GIF also passes; existing AVIF→PNG browser decode stays capability-gated. Neither animated GIF writing nor AVIF encoding was added: feasibility #268 refuses their uniform promotion. Real-iPhone HEIC, genuine device orientation, physical iOS/Android memory/performance, and GIF animation-preserving conversion remain unproved/unpromoted; **do not mark this ticket completed or Gold**.

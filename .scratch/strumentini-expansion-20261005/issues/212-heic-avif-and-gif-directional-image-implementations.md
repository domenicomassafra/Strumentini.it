# 212 — HEIC AVIF and GIF directional image implementations

**What to build:** After the codec feasibility decision, implement only accepted directional HEIC/HEIF decode, AVIF encode/decode and GIF still/animated conversion jobs with explicit fidelity/animation rules.

**Traces to:** US-EXP-04, US-EXP-06, US-EXP-10; AC-06.1, AC-10.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 103, 206, 268.

**Status:** ready-for-agent

**Progress:** GIF still-frame disclosure verified; HEIC/iPhone and physical mobile acceptance pending (ticket remains open).

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Only ACCEPTED directions from feasibility matrix become routes/modes.
- [ ] HEIC real-iPhone and animated GIF fixtures keep orientation/timing/transparency within declared limits.
- [x] Static-frame extraction is distinct from animated conversion.

**Verification:** Real corpus, signature/decode, animation timing and physical mobile receipts.

**Implementation evidence (2026-10-09, partial):** `src/engines/image/gif-structure.ts` bounds GIF container inspection at the existing 40 MiB image limit and 256 frames, validates frame boundaries, and measures the raw 1/100-second frame delays, transparency flags and disposal methods. The existing `image-format-conversion` route continues to export a **still of frame 1 only**; the result now shows measured input frame count/nominal timing and explicitly says animation is discarded. A malformed/truncated GIF cannot obtain an apparent successful static conversion. Unit tests `tests/image-gif-212.test.ts` plus existing matrix tests pass 5/5; `tests/image-gif-212.browser.mjs` confirms Chromium desktop at 390px with the actual 4-frame, 64×64 fixture (delays 25/25/25/25 centiseconds; 3 transparent frames) and independent first-frame pixel equality, PNG signature, 64×64 reopening, visible UI policy and no external requests. The 2×2 transparent still GIF also passes; existing AVIF→PNG browser decode stays capability-gated. Neither animated GIF writing nor AVIF encoding was added: feasibility #268 refuses their uniform promotion. Real-iPhone HEIC, genuine device orientation, physical iOS/Android memory/performance, and GIF animation-preserving conversion remain unproved/unpromoted; **do not mark this ticket completed or Gold**.

**2026-10-09 additional isolated #212 tranche (OPEN):** `src/engines/image/directional-212.ts` adds an independent pure-local GIF **first-frame only** decoder/PNG exporter (bounded 4 MiB GIF, 1M pixels, max 256 frames under existing structural inspector). Its GIF LZW decoder reconstructs indexed pixels with transparency, emits an 8-bit RGBA PNG with checked signature/chunk CRC and independent zlib scanline roundtrip. Only a full-canvas, noninterlaced first frame is accepted; partial/interlaced images fail closed. **Animated sources require explicit `allowAnimationLoss: true`** before exporting a still. The result discloses source frame count, exact raw centisecond delays, disposal, transparent frames, dimensions, byte counts and animation loss. Transparent RGB is normalized to black with alpha zero, preserving visual transparency. Animation-preserving export, frame compositing beyond the first, GIF interlacing, palette metadata and looping are not claimed.

**Runtime capability boundary:** `probeAvifDecode212` checks actual BMFF `ftyp` brands, rejects AVIF image sequences and uses `createImageBitmap` only where the current runtime exposes it. The result is `productionApproved: false` whether decode succeeds or fails: one fixture/runtime probe does not approve an AVIF encoder or physical browser matrix. `probeHeicDecode212` always refuses promotion because the HEIC fixture derives from macOS `sips`, not an actual iPhone-origin capture; real iPhone and mobile conditions remain `NOT_RUN`. The isolated engine does not load HEIC libraries or register routes, change catalog/Gold, or affect the existing converter.

**Proof:** `tests/image-directional-212.test.ts` covers GIF static/animated, loss consent, malformed input, bounds, cancellation, AVIF brand/runtime gate, synthetic decoder contract and HEIC refusal. `scripts/acceptance-image-directional-212.ts` writes PNG output for the checked-in real GIF fixtures and reopens them independently with Pillow: 64×64 4-frame GIF with 25/25/25/25 cs yields PNG RGBA **16,384 decoded pixel bytes**, 806 encoded bytes; still 2×2 transparent GIF yields PNG RGBA **16 decoded bytes**, 73 encoded bytes. Pillow compares every visible RGB pixel and every alpha component to the original first frame, with transparent RGB canonicalized. The GIF source timing is checked independently through Pillow as **250/250/250/250 ms** (raw 25/25/25/25 cs). Pillow also independently decodes the 2×2 AVIF fixture on the desktop, which **does not** prove that a browser can decode it. This proves a desktop fixture subset only. All remaining AC keep the canonical **Status: ready-for-agent** and are not marked complete.

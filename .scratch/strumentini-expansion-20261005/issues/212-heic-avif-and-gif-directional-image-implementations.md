MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

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

**PRIME live browser matrix 2026-10-09 (57/57 PASS, no production promotion):** `scripts/acceptance-image-directional-212.browser.mjs` Vite-serves the actual isolated engine under local HTTP, then opens each real GIF fixture in Chromium, Firefox and WebKit at 390×844. For the actual 4-frame 64×64 animated source, exporting first frame **without** explicit `allowAnimationLoss` refuses; consenting exports a true PNG, which each browser decodes with `createImageBitmap` and checks full RGBA Canvas pixel parity against frame 1 of the original GIF, preserves measured 25/25/25/25 cs source timing facts and discloses animation loss. The static transparent 2×2 GIF similarly preserves all pixels. All browsers refuse pre-aborted operations; zero remote requests/JS page errors. The 2×2 AVIF native runtime probe returned supported in all three tested desktop engines, **but `productionApproved=false` in all three**, and HEIC from a real iPhone and mobile memory/orientation remain NOT RUN. No animation-preserving conversion or AVIF encoder is enabled, no Gold/public route change. Status remains `ready-for-agent` / OPEN.

**2026-10-09 PRIME actual GIF first-frame interlace support (bounded, source engine only):** Updated `src/engines/image/directional-212.ts` to accept **full-canvas interlaced** GIF first frames and reorder decoded LZW indices from the four GIF passes `(0,8)`, `(4,8)`, `(2,4)`, `(1,2)` into display-row order. Partial-canvas images and unsupported formats continue to fail closed, animation still requires explicit first-frame-only loss consent, and GIF timing/alpha/source bounds stay unchanged. `scripts/generate-gif-interlaced-212.py` deterministically creates a genuine 8×8 GIF89a binary with different RGB values in each row, 8-bit indexed 9-bit LZW literal codes, true interlace flag, 12 cs GCE and transparent index 0; **independent Pillow** decodes the actual GIF and confirms each of all 64 RGBA pixels. Added the stored fixture `quality/fixtures/image-format-matrix/interlaced-8x8.gif`. `tests/image-directional-212.test.ts` compares exported PNG vs Sharp independent decoded interlaced GIF **pixel-for-pixel including alpha**; clearing only the interlace flag must yield a **different** image, demonstrating real deinterlacing rather than accepting a bit flag. Updated `scripts/acceptance-image-directional-212.ts` to reopen both source and output with independent Pillow, verify 8×8 RGBA and GCE 120 ms; updated browser script to test the additional fixture and measured delay, resulting **81/81 live Chromium/Firefox/WebKit browser checks PASS** at 390×844, zero offsite/JS errors. GIF animation re-encoding/composition and iPhone HEIC/AVIF encode remain unimplemented/unpromoted; #212 still OPEN with its physical-device AC unmet. Final clean QA gate pending at this checkpoint, no new Gold/route/deploy.

**PRIME clean-commit full QA 2026-10-09** (#212): Clean detached HEAD `ccdfde5` at `/Users/domenico/Code/Strumentini-prime-cleanqa-20261009`: `npm run check` **1848 files, 0 errors, 0 warnings, 21 hints**; `npm run build` **289 static pages PASS**, 645 JS assets and public PDF secure redaction route **ABSENT**; `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000` **199/199 suites, 1588/1588 tests PASS** in 218.73s, original-200 audit 200 final (199 verified, 1 explicitly refused), 327 ticket dashboard with 262 done/65 OPEN, 269 catalog entries/257 historical Gold unchanged. Exact logs `/tmp/strumentini-ccdfde5-{check,build,tests}.log`. Both browser suites re-executed from this CLEAN worktree: **#047 126/126 and #212 81/81 PASS** with Chromium/Firefox/WebKit at 390x844, native Canvas pixel parity, independent Sharp/Pillow proofs, zero offsite/error, logs `/tmp/strumentini-ccdfde5-{47,212}-clean-browser.log`. No physical iPhone/Android evidence, unsupported JPEG/WebP/SVG and animated full GIF remain refused. No route, Gold promotion, dashboard completion or Cloudflare deploy.

**2026-10-10 worker-3 bounded GIF geometry tranche (OPEN, partial evidence):** The isolated `src/engines/image/directional-212.ts` first-frame-only LZW→RGBA→PNG engine now handles genuine **transparent partial first-frame rectangles**, including 4-pass interlaced frames, by compositing decoded indices at descriptor `(left, top)` on the *logical canvas* (previously refused unless full-canvas). The decoder still rejects malformed/out-of-bounds frames, and rejects partial opaque frames whose background-index compositing has not been independently established; animation still requires explicit loss consent. Dedicated tests show RED before the fix, then `tests/image-directional-212.test.ts` and `tests/image-gif-212.test.ts` **13/13 PASS** including shifted 4×3 transparent still and shifted 10×10 interlaced GIF exact RGBA parity vs independent Sharp, plus opaque-partial refusal. `scripts/acceptance-image-directional-212.ts` reopened all **5/5** GIF sources and PNGs with independent Pillow, checking all visible RGB, every alpha byte and declared source frame delays; AVIF desktop fixture independently decodes, no browser/physical approval implied. `scripts/acceptance-image-directional-212.browser.mjs` exercises Chromium, Firefox and WebKit **102/102 scoped checks PASS** at 390×844, with PNG RGBA parity against Sharp in all three and no offsite requests or page errors. **Known native browser disagreement:** Firefox `createImageBitmap` ignores the tested GIF's nonzero first-frame offset (source GIF pixel 0 rendered opaque red while Sharp/Pillow and the canonical PNG make it transparent); Chrome and WebKit match the source. The test discloses this instead of claiming cross-browser native-GIF visual identity. No production route or Gold promotion, no animation-preserving GIF writer, no uniform AVIF encoder, no authentic iPhone HEIC orientation provenance or physical iOS/Android memory evidence. Checklist/status remain OPEN under #268's codec promotion refusal; dependencies #49 and #235 cannot be declared released from #212.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #367, #393.

**Next actionable AC:** Only ACCEPTED directions from feasibility matrix become routes/modes.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.

## 2026-10-12 worker-17 wave22 — bounded GIF89a structural safety, RED → GREEN (OPEN)

**Source-bound ownership:** Starting clean `main` at `53bc0cfd3053ae772e750ccb9a2df93a0c1f1b4c`; exclusively `src/engines/image/gif-structure.ts`, new `tests/gif-structure-212-wave22.test.ts`, and this original ticket. GIF89a section 12/23/25 is the normative basis for Graphic Control Extension (GCE) scope: a Plain Text Extension is a graphic-rendering block which **consumes** pending GCE, unlike Comment/Application extensions. GIF89a section 23 reserves disposal methods **4–7**, whose behavior is undefined (defined: 0–3). This is container structure only; no claim of animation compositing or decoder fidelity.

**RED cases on original parser:** (1) Four-frame genuinely decodable GIF with a valid 12-byte Plain Text Extension after a 73-centisecond GCE, before frame 2, was reported with **image frame delays `[25,73,25,25]`**; the 73 cs belong to the plain-text rendering block, so image timing should be `[25,0,25,25]`, with second image disposal 0 and no GCE transparency. Pillow decodes the mutated GIF's four image frames and verifies first-frame pixel SHA-256; Pillow itself ignores plain-text scoping and reports the control on image 2, so the expected metadata here is grounded in the **GIF89a block-scope definition**, not a claim that every decoder honors it. (2) Replacing second image's LZW sub-block chain with an immediate zero terminator retained four reported frames and allowed the first-frame conversion workflow to treat an impossible four-frame animation as structurally acceptable; **Pillow fails** on decoding image 2 with `OSError: broken data stream`. (3) Injecting GCE disposal methods 4–7 also previously passed inspection and misleadingly reported unassigned animation semantics; Pillow may decode those values permissively, but the standard leaves their effect undefined.

**GREEN implementation:** In the existing bounded scanner, count actual LZW sub-block bytes and reject an image with **zero** compressed bytes (necessary structural check, not full LZW validation); check disposal method range at GCE read; parse the fixed 12-byte Plain Text Extension header, skip its bounded text data and clear pending GCE delay/disposal/transparency. Comment extensions still preserve pending GCE; normal GIF first-frame conversions and cancellation still work. No new dependencies or changes to codec routes, `directional-212.ts`, UI, release or Gold policy.

**Current local evidence:** New test ran **RED 3 failures / 2 passes before fix**, then **5/5 PASS**. Alongside original `tests/image-gif-212.test.ts` and `tests/image-directional-212.test.ts`: **18/18 PASS** with Vitest. For present Pillow 12.2.0, independently decoded all four mutated GIF image frames, compared original first-frame and exported PNG RGBA SHA-256 byte-for-byte, verified PNG signature, and independently rejected empty-LZW frame 2; Python/Pillow oracle is optional in the reusable unit test when Pillow is not installed, and is recorded as independently **RUN** on this Mac Studio. Existing `scripts/acceptance-image-directional-212.ts` completed **5/5 Pillow GIF→PNG pixel/alpha proofs** and kept HEIC refused and AVIF fixture-only. `scripts/acceptance-image-directional-212.browser.mjs` completed **102/102 checks** on desktop Chromium/Firefox/WebKit at 390×844 with independent Sharp RGBA comparison, explicit first-frame animation-loss consent, bounded cancel, no remote requests or uncaught errors, `AVIF productionApproved=false`; existing Firefox GIF native renderer's partial-offset discrepancy persists, with Sharp parity correct. Vite logged an incidental unresolved-dependency prebundle warning for unrelated `spikes/heavy-browser` imports but the browser acceptance **exited 0**. All original #212 AC remain OPEN; GIF-preserving animation writing, iPhone-sourced HEIC, physical iOS/Android, device memory/performance and AVIF encoder production approval remain **NOT_RUN/NO_GO**. No commit, push or deploy.

## 2026-10-12 worker-21 wave23 — first-frame GIF89a GCE scope and alpha fidelity (RED → GREEN; OPEN)

**New cross-boundary defect distinct from wave22's container scanner:** In a
genuinely decodeable GIF89a, a Graphic Control Extension (GCE) with
transparency can be followed by a valid **Plain Text Extension**, then by
the **first image descriptor**. Per GIF89a's graphic-rendering block scope,
the GCE belongs to the intervening plain-text grid, **not** to the later
first image. The already-correct wave22 `inspectGifStructure` reports
`transparentFrameCount: 0`, but the isolated
`src/engines/image/directional-212.ts` first-frame LZW decoder previously
carried its stale `transparentIndex` forward and emitted a PNG with an
**incorrect zero-alpha pixel**. It also incorrectly accepted a shifted
first-frame rectangle by treating the GCE as permission to compose on a
transparent canvas, although the image itself was now **opaque partial** and
the background-compositing policy explicitly requires refusal.

**TDD / independent pixels:** New
`tests/image-directional-212-wave23.test.ts` starts from the repository's
real 2×2 still-GIF palette/LZW bytes (valid GIF89a header), inserts a
fully bounded Plain Text Extension containing the single text byte `A`,
and reopens the *actual directional-engine PNG*. For an independently
decoded comparison, a bytewise-equivalent GIF with only the GCE removed
gives the image's correct opaque palette RGB: the second pixel is
`[0,0,0,255]` rather than transparent `[0,0,0,0]`. **Sharp** decodes
source/reference and emitted PNG pixels; installed **Pillow** independently
reopens the PNG and the known opaque first-image control GIF and compares
the entire RGBA byte array. This exact control avoids claiming Pillow's
historical GIF Plain Text Extension/GCE scoping is authoritative: the
structural expectation comes from GIF89a's rendering-block semantics.
Before the directional patch, **2/5** new tests were RED on genuinely wrong
alpha and a wrongly accepted opaque partial first frame (three relevant
positive/refusal tests already green).

**Small scoped source correction:** Only
`src/engines/image/directional-212.ts` now consumes a pending
`transparentIndex` on a valid Plain Text Extension, checking its 12-byte
fixed header and skipping its bounded sub-block chain. Comment and
Application extensions continue to preserve a pending GCE; a **new GCE
after** Plain Text correctly re-establishes transparency for the image.
The pre-existing blanket refusal of nontransparent partial first frames
now applies correctly. No modifications to frozen `gif-structure.ts`, no
codec dependencies or route changes, no animation-preserving export.

**GREEN checks:** New test **5/5 PASS** using Sharp/Pillow with standard
unit execution; with `STRUMENTINI_212_BROWSER_PROOF=1` the new opt-in
**real desktop Chromium 390×844** case also passes (**6/6**) by bundling
the genuine engine, reopening its returned PNG with `createImageBitmap`,
comparing all RGBA bytes against independent Sharp and asserting no
network requests. Opt-in browser condition prevents default CI runners
without installed Chromium binaries from falsely claiming they ran it.
Combined existing `tests/image-directional-212.test.ts`,
`tests/image-gif-212.test.ts` and frozen
`tests/gif-structure-212-wave22.test.ts` plus new unit tests:
**23/23 PASS** before the extra optional browser case. Existing
`scripts/acceptance-image-directional-212.ts` continues to pass
**5/5 Pillow GIF→PNG source/output comparisons**, while AVIF remains
fixture-only, HEIC refused, real iPhone source and mobile devices NOT_RUN.
Abort/preflight limits and explicit animation-loss consent remain tested.

**Disposition:** Only this first-frame GIF89a conversion bug was corrected.
The original ticket is still **ready-for-agent / OPEN** and the existing
unchecked HEIC/AVIF/GIF full-direction AC remain unchecked; no decoder
license, physical iOS/Android proof, 100% browser matrix, full animation
compositing or animated PNG/GIF writer is claimed. **NO_GO** to production
HEIC/AVIF direction promotion; no commit, push, deployment or Gold/receipt
changes in this worker scope.

**Final gates and test scheduling nuance:** Full
`./node_modules/.bin/tsc --noEmit --pretty false` **PASS**; full
`npm run check` **PASS**, Astro **2036 files / 0 errors / 0 warnings /
24 hints**. Final four focused Vitest suites (existing #212 tests, frozen
wave22 structure test, new wave23 directional regression) run serially with
`--maxWorkers=2 --fileParallelism=false --testTimeout=30000`:
**23/23 PASS plus 1 intentionally skipped optional browser test**.
That same optional test was run explicitly with
`STRUMENTINI_212_BROWSER_PROOF=1` and **6/6 PASS** in real Chromium.
During one intermediate run concurrently with global `npm run check`,
Pillow subprocess contention exceeded Vitest's default 5000 ms threshold
in the new and frozen existing tests; all timed-out tests passed on the
bounded serial rerun. No unrelated test files were modified or claimed
fixed. Scoped `git diff --check` **PASS**.
